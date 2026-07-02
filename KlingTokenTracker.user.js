// ==UserScript==
// @name         Kling Token Tracker
// @namespace    http://tampermonkey.net/
// @version      0.2.1
// @description  Tracks Kling credits/tokens spending from the Generate UI and reads balance from account API.
// @match        https://kling.ai/app/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (window.__KLING_TOKEN_TRACKER_INSTALLED__) return;
    window.__KLING_TOKEN_TRACKER_INSTALLED__ = true;

    const VERSION = '0.2.1';
    const UI_CLICK_DEDUP_MS = 3000;
    const STORAGE_PREFIX = 'klingTokenTracker.';
    const HISTORY_KEY = STORAGE_PREFIX + 'history.v1';
    const SESSION_KEY = STORAGE_PREFIX + 'session.v1';
    const META_KEY = STORAGE_PREFIX + 'meta.v1';
    const DEBUG_KEY = STORAGE_PREFIX + 'debug.v1';
    const PANEL_KEY = STORAGE_PREFIX + 'panel.v1';
    const UI_KEY = STORAGE_PREFIX + 'ui.v1';
    const PROJECT_KEY = STORAGE_PREFIX + 'project.v1';
    const MAX_EVENTS = 200;
    const DUPLICATE_WINDOW_MS = 45 * 1000;
    const UI_SCAN_DEBOUNCE_MS = 450;
    const UI_SCAN_INTERVAL_MS = 3000;
    const MIN_BALANCE_SCORE = 14;
    const MIN_UI_SCORE = 14;

    const runtime = {
        balance: null,
        balanceSource: 'none',
        balancePath: '',
        lastBalanceAt: null,
        pending: [],
        sourceSeen: { network: false, ui: false },
        panelHost: null,
        shadowRoot: null,
        uiObserver: null,
        uiScanTimer: null,
        uiInterval: null,
        renderTimer: null,
        debug: false,
        diagnostics: [],
        lastUiSpend: null,
        activeTab: sanitizeUiState(readJson(UI_KEY, {})).activeTab,
        project: sanitizeProject(readJson(PROJECT_KEY, {}))
    };

    let history = sanitizeEvents(readJson(HISTORY_KEY, []));
    let session = sanitizeSession(readJson(SESSION_KEY, null)) || createSession();
    let meta = sanitizeMeta(readJson(META_KEY, {}));
    const ADAPTERS = [createKlingAdapter()];
    const activeAdapter = getActiveAdapter();
    runtime.debug = readJson(DEBUG_KEY, false) === true;
    runtime.balance = meta.balance;
    runtime.balanceSource = meta.balanceSource || 'none';
    runtime.balancePath = meta.balancePath || '';
    runtime.lastBalanceAt = meta.lastBalanceAt || null;

    exposeApi();
    patchFetch();
    patchXMLHttpRequest();
    bootWhenBodyExists();

    function exposeApi() {
        window.KlingTokenTracker = {
            version: VERSION,
            getState,
            resetSession,
            exportJSON,
            setDebug,
            clearHistory,
            forgetBalance,
            resetAll,
            setProject,
            clearProject,
            getDebugReport,
            copyDebugReport
        };
    }

    function getState() {
        return deepClone({
            version: VERSION,
            service: activeAdapter.id,
            serviceName: activeAdapter.name,
            balance: runtime.balance,
            balanceSource: runtime.balanceSource,
            balancePath: runtime.balancePath,
            lastBalanceAt: runtime.lastBalanceAt,
            session,
            project: runtime.project,
            history,
            pending: runtime.pending.map(function (item) {
                return Object.assign({}, item);
            }),
            diagnostics: runtime.diagnostics.slice(-80),
            debug: runtime.debug
        });
    }

    function resetSession() {
        session = createSession();
        saveSession();
        renderSoon();
        return getState();
    }

    function exportJSON() {
        return JSON.stringify(getState(), null, 2);
    }

    function getDebugReport() {
        return JSON.stringify(createDebugReport(), null, 2);
    }

    function copyDebugReport() {
        const report = getDebugReport();
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
            return navigator.clipboard.writeText(report).then(function () {
                addDiagnostic('debug report copied');
                return report;
            });
        }
        return report;
    }

    function createDebugReport() {
        return {
            version: VERSION,
            service: activeAdapter.id,
            serviceName: activeAdapter.name,
            page: redactUrl(window.location.href),
            capturedAt: new Date().toISOString(),
            balance: runtime.balance,
            balanceSource: runtime.balanceSource,
            balancePath: runtime.balancePath,
            lastBalanceAt: runtime.lastBalanceAt,
            sessionTotal: session.total || 0,
            todayTotal: getTodayTotal(),
            project: runtime.project,
            history: history.slice(0, 10),
            pending: runtime.pending.slice(-10).map(function (pending) {
                return Object.assign({}, pending);
            }),
            diagnostics: summarizeDiagnostics(runtime.diagnostics)
        };
    }

    function clearHistory() {
        history = [];
        session = createSession();
        saveHistory();
        saveSession();
        renderSoon();
        return getState();
    }

    function forgetBalance() {
        runtime.balance = null;
        runtime.balanceSource = 'none';
        runtime.balancePath = '';
        runtime.lastBalanceAt = null;
        meta = {
            balance: null,
            balanceSource: 'none',
            balancePath: '',
            lastBalanceAt: null
        };
        saveMeta();
        renderSoon();
        return getState();
    }

    function resetAll() {
        history = [];
        session = createSession();
        runtime.pending = [];
        runtime.diagnostics = [];
        runtime.sourceSeen = { network: false, ui: false };
        runtime.project = sanitizeProject({});
        runtime.balance = null;
        runtime.balanceSource = 'none';
        runtime.balancePath = '';
        runtime.lastBalanceAt = null;
        meta = {
            balance: null,
            balanceSource: 'none',
            balancePath: '',
            lastBalanceAt: null
        };
        saveHistory();
        saveSession();
        saveMeta();
        saveProject();
        renderSoon();
        return getState();
    }

    function setProject(project) {
        runtime.project = sanitizeProject(project || {});
        saveProject();
        renderSoon();
        return getState();
    }

    function clearProject() {
        return setProject({});
    }

    function setDebug(enabled) {
        runtime.debug = Boolean(enabled);
        writeJson(DEBUG_KEY, runtime.debug);
        renderSoon();
        addDiagnostic('debug', runtime.debug ? 'enabled' : 'disabled');
        if (runtime.debug) {
            console.info('[Kling Token Tracker] Debug is collecting a compact report. Use window.KlingTokenTracker.copyDebugReport() or the Copy report button.');
        }
        return runtime.debug;
    }

    function patchFetch() {
        if (typeof window.fetch !== 'function' || window.fetch.__kttPatched) return;

        const originalFetch = window.fetch;
        function wrappedFetch(input, init) {
            const metaInfo = getFetchMeta(input, init);

            return originalFetch.apply(this, arguments).then(function (response) {
                inspectFetchResponse(response, metaInfo);
                return response;
            });
        }

        wrappedFetch.__kttPatched = true;
        wrappedFetch.__kttOriginal = originalFetch;
        window.fetch = wrappedFetch;
    }

    function inspectFetchResponse(response, metaInfo) {
        if (!response || typeof response.clone !== 'function') return;
        if (response.type === 'opaque' || response.type === 'opaqueredirect') return;

        const contentType = getHeader(response.headers, 'content-type');
        if (contentType && !/json|javascript|text/i.test(contentType)) return;

        response.clone().text().then(function (text) {
            const payload = parseJsonText(text);
            if (payload == null) return;
            handlePayload(payload, {
                source: 'network',
                transport: 'fetch',
                url: metaInfo.url,
                method: metaInfo.method,
                pending: metaInfo.pending || null
            });
        }).catch(function (error) {
            addDiagnostic('fetch response parse failed', metaInfo.url, error && error.message ? error.message : error);
        });
    }

    function patchXMLHttpRequest() {
        if (typeof window.XMLHttpRequest !== 'function') return;
        const proto = window.XMLHttpRequest.prototype;
        if (!proto || proto.__kttPatched) return;

        const originalOpen = proto.open;
        const originalSend = proto.send;

        proto.open = function (method, url) {
            this.__kttMeta = {
                method: String(method || 'GET').toUpperCase(),
                url: normalizeUrl(url),
                bodyText: '',
                pending: null
            };
            return originalOpen.apply(this, arguments);
        };

        proto.send = function (body) {
            const metaInfo = this.__kttMeta || {
                method: 'GET',
                url: '',
                bodyText: '',
                pending: null
            };
            metaInfo.bodyText = stringifyBody(body);

            this.addEventListener('loadend', function () {
                inspectXhrResponse(this, metaInfo);
            });

            return originalSend.apply(this, arguments);
        };

        proto.__kttPatched = true;
    }

    function inspectXhrResponse(xhr, metaInfo) {
        try {
            const responseType = xhr.responseType || '';
            let payload = null;
            if (responseType === 'json') {
                payload = xhr.response;
            } else if (responseType === '' || responseType === 'text') {
                payload = parseJsonText(xhr.responseText);
            }
            if (payload == null) return;
            handlePayload(payload, {
                source: 'network',
                transport: 'xhr',
                url: metaInfo.url,
                method: metaInfo.method,
                pending: metaInfo.pending || null
            });
        } catch (error) {
            addDiagnostic('xhr response parse failed', metaInfo.url, error && error.message ? error.message : error);
        }
    }

    function handlePayload(payload, context) {
        const taskId = extractTaskId(payload);
        if (taskId && context.pending) {
            context.pending.taskId = taskId;
        }

        const balanceCandidate = activeAdapter.extractBalance(payload, context.url);
        if (!balanceCandidate) {
            if (runtime.debug && activeAdapter.isRelevantDebugUrl(context.url, payload)) {
                addDiagnostic('network payload candidate without balance', context.method || '', context.url);
            }
            return;
        }

        addDiagnostic('balance candidate', balanceCandidate.value, balanceCandidate.path, context.url);
        observeBalance(balanceCandidate.value, 'network', {
            url: context.url,
            method: context.method,
            path: balanceCandidate.path,
            taskId: taskId || (context.pending && context.pending.taskId) || null,
            pending: context.pending || null,
            score: balanceCandidate.score
        });
    }

    function bootWhenBodyExists() {
        if (document.body) {
            initDomFeatures();
            return;
        }
        const timer = window.setInterval(function () {
            if (!document.body) return;
            window.clearInterval(timer);
            initDomFeatures();
        }, 50);
    }

    function initDomFeatures() {
        createPanel();
        installClickTracker();
        renderSoon();
    }

    function installUiObserver() {
        if (!document.body || runtime.uiObserver || typeof window.MutationObserver !== 'function') return;
        runtime.uiObserver = new MutationObserver(function () {
            scheduleUiScan(UI_SCAN_DEBOUNCE_MS);
        });
        runtime.uiObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        runtime.uiInterval = window.setInterval(function () {
            scheduleUiScan(0);
        }, UI_SCAN_INTERVAL_MS);
    }

    function installClickTracker() {
        document.addEventListener('click', function (event) {
            const target = event.target;
            if (!target || !target.closest) return;
            if (runtime.panelHost && runtime.panelHost.contains(target)) return;

            const clickable = target.closest('button, a, [role="button"], [data-testid], [class*="button"], [class*="Button"]');
            if (!clickable) return;

            const parsed = activeAdapter.parseGenerateClick(clickable, event);
            if (!parsed) return;

            addDiagnostic('ui generation click candidate', parsed.detail);
            recordUiGenerateClick(parsed, clickable);
        }, true);
    }

    function getDirectClickableText(clickable) {
        return compactText([
            clickable.textContent || '',
            clickable.getAttribute('aria-label') || '',
            clickable.getAttribute('title') || ''
        ].join(' ')).slice(0, 160);
    }

    function createKlingAdapter() {
        return {
            id: 'kling',
            name: 'Kling',
            matchesLocation: function (url) {
                return /https:\/\/kling\.ai\/app\//i.test(String(url || ''));
            },
            parseGenerateClick: function (clickable, event) {
                const directText = getDirectClickableText(clickable);
                if (!isUiGenerationText(directText)) return null;
                if (!hasGenerateCostInDirectText(directText)) {
                    addDiagnostic('ignored generate-like click without direct cost', directText);
                    return null;
                }
                if (!isLikelyGenerateButton(clickable, event)) {
                    addDiagnostic('ignored generate-like click outside generate button bounds', directText, getElementRectSummary(clickable));
                    return null;
                }

                const detail = getGenerateClickText(clickable);
                const amount = extractCostFromUiText(detail);
                if (!isFiniteCredit(amount) || amount <= 0) {
                    addDiagnostic('ui generate click without cost', detail);
                    return null;
                }

                return {
                    amount,
                    detail,
                    metadata: parseKlingMetadata(detail)
                };
            },
            extractBalance: function (payload, url) {
                return extractBalanceFromPayload(payload, url);
            },
            isRelevantDebugUrl: function (url, payload) {
                return looksRelevantForDebug(url, payload);
            }
        };
    }

    function getActiveAdapter() {
        for (let i = 0; i < ADAPTERS.length; i += 1) {
            if (ADAPTERS[i].matchesLocation(window.location.href)) return ADAPTERS[i];
        }
        return ADAPTERS[0];
    }

    function hasGenerateCostInDirectText(text) {
        const normalized = compactText(text);
        if (!normalized) return false;
        return /(?:^|[^\d:])\d+(?:[.,]\d+)?\s*(?:generate|生成|創建|创建)\b/i.test(normalized);
    }

    function isLikelyGenerateButton(clickable, event) {
        if (!clickable || typeof clickable.getBoundingClientRect !== 'function') return true;
        const rect = clickable.getBoundingClientRect();
        if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return true;

        if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
            const inside =
                event.clientX >= rect.left &&
                event.clientX <= rect.right &&
                event.clientY >= rect.top &&
                event.clientY <= rect.bottom;
            if (!inside) return false;
        }

        const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        if (rect.width > 360) return false;
        if (viewportWidth && rect.width > viewportWidth * 0.35) return false;
        if (rect.height > 96) return false;
        if (viewportHeight && rect.height > viewportHeight * 0.16) return false;
        if (rect.width < 80 || rect.height < 28) return false;

        return true;
    }

    function getElementRectSummary(element) {
        if (!element || typeof element.getBoundingClientRect !== 'function') return '';
        const rect = element.getBoundingClientRect();
        if (!rect) return '';
        return [
            'w=' + Math.round(rect.width || 0),
            'h=' + Math.round(rect.height || 0),
            'x=' + Math.round(rect.left || 0),
            'y=' + Math.round(rect.top || 0)
        ].join(' ');
    }

    function getGenerateClickText(clickable) {
        const parts = [
            clickable.textContent || '',
            clickable.getAttribute('aria-label') || '',
            clickable.getAttribute('title') || ''
        ];

        let element = clickable.parentElement;
        for (let depth = 0; element && depth < 4; depth += 1) {
            if (runtime.panelHost && runtime.panelHost.contains(element)) break;
            const text = compactText(element.textContent || '');
            if (text && text.length <= 220 && /generate|生成|創建|创建/i.test(text)) {
                parts.push(text);
            }
            element = element.parentElement;
        }

        return compactText(parts.join(' ')).slice(0, 260);
    }

    function recordUiGenerateClick(parsed, clickable) {
        const amount = parsed && parsed.amount;
        if (!isFiniteCredit(amount) || amount <= 0) {
            addDiagnostic('ui generate click without cost', parsed && parsed.detail);
            return null;
        }

        const now = Date.now();
        if (
            runtime.lastUiSpend &&
            nearlyEqual(runtime.lastUiSpend.amount, amount) &&
            now - runtime.lastUiSpend.ts < UI_CLICK_DEDUP_MS
        ) {
            addDiagnostic('deduped ui spend click', amount, parsed.detail);
            return null;
        }

        const before = runtime.balance == null ? amount : runtime.balance;
        const event = recordSpend({
            amount,
            before,
            after: runtime.balance == null ? 0 : runtime.balance,
            source: 'ui',
            service: activeAdapter.id,
            serviceName: activeAdapter.name,
            taskId: null,
            url: window.location.href,
            method: 'UI',
            path: 'ui generate button',
            score: null,
            pendingId: null,
            detail: String(parsed.detail || '').slice(0, 180),
            metadata: parsed.metadata || {},
            estimated: true
        }, now);

        if (event) {
            runtime.lastUiSpend = {
                ts: now,
                amount,
                text: parsed.detail,
                target: getElementSignature(clickable)
            };
            runtime.sourceSeen.ui = true;
            addDiagnostic('recorded ui spend click', event);
            renderSoon();
        }

        return event;
    }

    function scheduleUiScan(delay) {
        if (runtime.uiScanTimer) {
            window.clearTimeout(runtime.uiScanTimer);
            runtime.uiScanTimer = null;
        }
        runtime.uiScanTimer = window.setTimeout(scanUiBalance, delay);
    }

    function scanUiBalance() {
        runtime.uiScanTimer = null;
        if (!document.body) return;

        const candidate = extractUiBalanceCandidate(document.body);
        if (!candidate) return;

        addDiagnostic('ui balance candidate', candidate.value, candidate.context);
        observeBalance(candidate.value, 'ui', {
            path: 'visible text',
            context: candidate.context,
            score: candidate.score,
            pending: null,
            url: window.location.href
        });
    }

    function extractUiBalanceCandidate(root) {
        const candidates = [];
        const seenContexts = new Set();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                if (!node || !node.nodeValue) return NodeFilter.FILTER_REJECT;
                const parent = node.parentElement;
                if (!parent) return NodeFilter.FILTER_REJECT;
                if (isIgnoredUiElement(parent)) return NodeFilter.FILTER_REJECT;
                const text = compactText(node.nodeValue);
                if (!/\d/.test(text) && !/(credit|token|balance|wallet)/i.test(text)) {
                    return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
            }
        });

        let node;
        let count = 0;
        while ((node = walker.nextNode()) && count < 1500) {
            count += 1;
            const context = getNodeContext(node);
            if (!context || seenContexts.has(context)) continue;
            seenContexts.add(context);

            const extracted = extractBalanceFromText(context);
            if (extracted && extracted.score >= MIN_UI_SCORE) {
                candidates.push(extracted);
            }
        }

        if (!candidates.length) return null;
        candidates.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return String(a.context).length - String(b.context).length;
        });
        return candidates[0];
    }

    function getNodeContext(node) {
        let element = node.parentElement;
        for (let depth = 0; element && depth < 3; depth += 1) {
            if (isIgnoredUiElement(element)) return '';
            const text = compactText(element.textContent || '');
            if (text.length > 0 && text.length <= 220 && /(credit|token|balance|wallet|\d)/i.test(text)) {
                return text;
            }
            element = element.parentElement;
        }
        return compactText(node.nodeValue || '');
    }

    function isIgnoredUiElement(element) {
        if (!element) return true;
        const tag = String(element.tagName || '').toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'textarea') return true;
        if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'option') return true;
        if (element.closest && element.closest('button, a, [role="button"], [data-ktt-root]')) return true;
        if (runtime.panelHost && (element === runtime.panelHost || runtime.panelHost.contains(element))) return true;
        return false;
    }

    function extractBalanceFromText(text) {
        const normalized = compactText(text);
        if (!normalized) return null;

        const patterns = [
            {
                re: /\b(?:credit|credits|token|tokens|balance|wallet)\b[^\d]{0,35}(\d[\d\s,.]*)/i,
                score: 10
            },
            {
                re: /(\d[\d\s,.]*)[^\w]{0,16}\b(?:credit|credits|token|tokens)\b/i,
                score: 8
            }
        ];

        let best = null;
        patterns.forEach(function (pattern) {
            const match = normalized.match(pattern.re);
            if (!match) return;
            const value = parseLooseNumber(match[1]);
            if (!isFiniteCredit(value)) return;

            let score = pattern.score;
            if (/\bbalance\b/i.test(normalized)) score += 5;
            if (/\bwallet\b/i.test(normalized)) score += 3;
            if (/\bremaining\b|\bremain\b|\bavailable\b/i.test(normalized)) score += 4;
            if (/\bcost\b|\bprice\b|\bspent\b|\bused\b|\bconsume/i.test(normalized)) score -= 8;
            if (isPriceLikeUiContext(normalized)) score -= 8;
            if (!/\bbalance\b|\bwallet\b|\bremaining\b|\bremain\b|\bavailable\b/i.test(normalized)) score -= 3;

            const candidate = {
                value: normalizeCredit(value),
                score,
                context: normalized.slice(0, 180)
            };
            if (!best || candidate.score > best.score) best = candidate;
        });

        return best;
    }

    function isPriceLikeUiContext(text) {
        return /\bcost\b|\bprice\b|\bspent\b|\bused\b|\bconsume|\bconsumed\b|\bupgrade\b|\bsubscribe\b|\bbuy\b|\bpurchase\b|\bstandard\b|\bpro\b|\bmaster\b|\bgenerate\b|\bgeneration\b/i.test(String(text || ''));
    }

    function observeBalance(nextBalance, source, context) {
        if (!isFiniteCredit(nextBalance)) return;
        const next = normalizeCredit(nextBalance);
        const previous = runtime.balance;
        const now = Date.now();

        runtime.sourceSeen[source] = true;

        if (previous != null && nearlyEqual(previous, next)) {
            updateBalanceMeta(next, source, context, now);
            return;
        }

        if (
            source === 'ui' &&
            runtime.balanceSource === 'network' &&
            previous != null &&
            runtime.lastBalanceAt &&
            now - runtime.lastBalanceAt < 15000
        ) {
            addDiagnostic('ignored early ui balance drift', next, 'current', previous);
            return;
        }

        if (previous != null && next < previous) {
            const amount = normalizeCredit(previous - next);
            addDiagnostic('observed balance decrease without spend record', {
                previous,
                next,
                amount,
                source,
                path: context && context.path,
                url: context && context.url
            });
        }

        updateBalanceMeta(next, source, context, now);
        saveMeta();
        renderSoon();
    }

    function updateBalanceMeta(balance, source, context, now) {
        runtime.balance = normalizeCredit(balance);
        runtime.balanceSource = source || runtime.balanceSource || 'none';
        runtime.balancePath = (context && context.path) || runtime.balancePath || '';
        runtime.lastBalanceAt = now || Date.now();
        meta = {
            balance: runtime.balance,
            balanceSource: runtime.balanceSource,
            balancePath: runtime.balancePath,
            lastBalanceAt: runtime.lastBalanceAt
        };
        saveMeta();
        renderSoon();
    }

    function recordSpend(input, now) {
        if (!input || !isFiniteCredit(input.amount) || input.amount <= 0) return null;

        const duplicate = findDuplicateSpend(input, now);
        if (duplicate) {
            duplicate.source = mergeSources(duplicate.source, input.source);
            duplicate.updatedAt = now;
            if (!duplicate.taskId && input.taskId) duplicate.taskId = input.taskId;
            if (duplicate.estimated && !input.estimated) {
                duplicate.estimated = false;
                duplicate.amount = normalizeCredit(input.amount);
                duplicate.before = normalizeCredit(input.before);
                duplicate.after = normalizeCredit(input.after);
                duplicate.path = input.path || duplicate.path;
            }
            saveHistory();
            renderSoon();
            addDiagnostic('merged duplicate spend', duplicate);
            return duplicate;
        }

        const event = {
            id: input.taskId ? 'task:' + input.taskId + ':' + input.amount : createEventId(input, now),
            ts: now,
            localDate: localDateKey(now),
            amount: normalizeCredit(input.amount),
            before: normalizeCredit(input.before),
            after: normalizeCredit(input.after),
            source: input.source || 'unknown',
            service: input.service || activeAdapter.id,
            serviceName: input.serviceName || activeAdapter.name,
            taskId: input.taskId || null,
            url: redactUrl(input.url || ''),
            method: input.method || '',
            path: input.path || '',
            score: input.score || null,
            pendingId: input.pendingId || null,
            detail: input.detail || '',
            metadata: sanitizeMetadata(input.metadata || {}),
            project: sanitizeProject(input.project || runtime.project),
            estimated: input.estimated === true
        };

        history.unshift(event);
        history = sanitizeEvents(history);
        addEventToSession(event);
        saveHistory();
        saveSession();
        addDiagnostic('recorded spend', event);
        return event;
    }

    function findDuplicateSpend(input, now) {
        for (let i = 0; i < history.length; i += 1) {
            const event = history[i];
            if (!event || now - event.ts > DUPLICATE_WINDOW_MS) continue;
            if (input.taskId && event.taskId && input.taskId === event.taskId) return event;
            if (
                input.source === 'ui' &&
                event.source === 'ui' &&
                event.estimated === true &&
                input.estimated === true &&
                now - event.ts <= UI_CLICK_DEDUP_MS &&
                nearlyEqual(event.amount, input.amount)
            ) {
                return event;
            }
            if (
                nearlyEqual(event.amount, input.amount) &&
                nearlyEqual(event.before, input.before) &&
                nearlyEqual(event.after, input.after)
            ) {
                return event;
            }
        }
        return null;
    }

    function extractBalanceFromPayload(payload, url) {
        const candidates = [];
        walkJson(payload, [], function (value, path) {
            const number = normalizeJsonNumber(value);
            if (!isFiniteCredit(number)) return;
            const pathText = path.join('.').toLowerCase();
            const score = scoreBalancePath(pathText, url);
            if (score >= MIN_BALANCE_SCORE) {
                candidates.push({
                    value: normalizeCredit(number),
                    path: path.join('.'),
                    score
                });
            }
        });

        if (!candidates.length) return null;
        candidates.sort(function (a, b) {
            if (b.score !== a.score) return b.score - a.score;
            return String(a.path).length - String(b.path).length;
        });
        return candidates[0];
    }

    function scoreBalancePath(pathText, url) {
        const path = String(pathText || '').toLowerCase();
        const urlText = String(url || '').toLowerCase();
        let score = 0;

        if (/\/api\/notify\/expiredpoint/.test(urlText)) return -100;
        if (/\/api\/task\/price|\/api\/task\/calculate-price/.test(urlText)) return -100;
        if (/remainpoints|remain_points/.test(path)) return -100;
        if (/quota/.test(path) && !/\/api\/account\//.test(urlText)) return -100;

        if (/\/api\/account\/pointandticket/.test(urlText) && /^data\.points\.\d+\.balance$/.test(path)) score += 20;
        if (/\/api\/account\//.test(urlText) && /balance|point|credit|ticket/.test(path)) score += 12;

        if (/balance/.test(path)) score += 12;
        if (/remain|remaining|available|left/.test(path)) score += 10;
        if (/wallet|account|quota/.test(path)) score += 7;
        if (/credit|credits|token|tokens/.test(path)) score += 6;
        if (/coin|coins/.test(path)) score += 4;

        if (/wallet|account|balance|credit|quota|asset|pointandticket/.test(urlText)) score += 3;
        if (/\/api\/user\/|\/api\/elements|\/api\/product|\/api\/libraries|\/api\/lora|\/api\/task\//.test(urlText)) score -= 8;
        if (/generate|generation|submit|create|task/.test(urlText)) score -= 4;

        if (/cost|consume|consumed|spend|spent|used|usage|price|deduct|fee|charge/.test(path)) score -= 8;
        if (/count|num|number|duration|second|width|height|fps|size|limit|max|min|id$/.test(path)) score -= 5;
        if (/expire|expiry|deadline|timestamp|time|date/.test(path)) score -= 6;

        return score;
    }

    function extractTaskId(payload) {
        let found = null;
        walkJson(payload, [], function (value, path) {
            if (found != null) return;
            if (typeof value !== 'string' && typeof value !== 'number') return;
            const pathText = path.join('.').toLowerCase();
            if (!/(task|job|generation|video).*(id)|(^|\.)(taskid|task_id|jobid|job_id)$/.test(pathText)) return;
            const text = String(value);
            if (text.length < 3 || text.length > 120) return;
            found = text;
        });
        return found;
    }

    function extractCostFromUiText(text) {
        const normalized = compactText(text);
        if (!normalized) return NaN;
        const generateMatches = Array.from(normalized.matchAll(/(?:^|[^\d:])(\d+(?:[.,]\d+)?)\s*(?:generate|生成|創建|创建)\b/gi));
        if (generateMatches.length) return parseLooseNumber(generateMatches[generateMatches.length - 1][1]);

        const hdMatches = Array.from(normalized.matchAll(/hd\s*(\d+(?:[.,]\d+)?)/gi));
        if (hdMatches.length) return parseLooseNumber(hdMatches[hdMatches.length - 1][1]);

        const numbers = normalized.match(/\d+(?:[.,]\d+)?/g) || [];
        if (!numbers.length) return NaN;
        return parseLooseNumber(numbers[numbers.length - 1]);
    }

    function parseKlingMetadata(text) {
        const normalized = compactText(text);
        const metadata = {};

        const resolution = normalized.match(/\b(720p|1080p|2k|4k)\b/i);
        if (resolution) metadata.resolution = resolution[1];

        const duration = normalized.match(/\b(\d+)\s*s\b/i);
        if (duration) metadata.duration = duration[1] + 's';

        const aspectRatio = normalized.match(/\b(\d{1,2}:\d{1,2})\b/);
        if (aspectRatio) metadata.aspectRatio = aspectRatio[1];

        const outputs = normalized.match(/(?:^|[^\d:])([1-4])\s+(?:Native Audio|Audio|HD|Generate|\d+\s*Generate)/i);
        if (outputs) metadata.outputs = Number(outputs[1]);

        if (/Native Audio/i.test(normalized)) metadata.audio = 'Native Audio';
        else if (/\bAudio\b/i.test(normalized)) metadata.audio = 'Audio';

        const mode = normalized.match(/\b(Standard|Professional|Pro|Master|High Quality|Quality)\b/i);
        if (mode) metadata.mode = mode[1];

        const model = normalized.match(/\b(?:Model|Kling)\s*([A-Za-z0-9._-]+)/i);
        if (model) metadata.model = model[1];

        return metadata;
    }

    function sanitizeMetadata(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
        const allowed = ['resolution', 'duration', 'outputs', 'audio', 'mode', 'aspectRatio', 'model'];
        const result = {};
        allowed.forEach(function (key) {
            if (value[key] == null || value[key] === '') return;
            result[key] = typeof value[key] === 'number' ? value[key] : String(value[key]).slice(0, 80);
        });
        return result;
    }

    function sanitizeProject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return { name: '', url: '' };
        return {
            name: String(value.name || '').trim().slice(0, 160),
            url: sanitizeProjectUrl(value.url || '')
        };
    }

    function sanitizeProjectUrl(value) {
        const raw = String(value || '').trim();
        if (!raw) return '';
        if (!/^https?:\/\//i.test(raw)) return raw.slice(0, 300);
        try {
            return new URL(raw).toString().slice(0, 500);
        } catch (_) {
            return raw.slice(0, 300);
        }
    }

    function getElementSignature(element) {
        if (!element) return '';
        const tag = String(element.tagName || '').toLowerCase();
        const classes = String(element.className || '').split(/\s+/).filter(Boolean).slice(0, 3).join('.');
        const testId = element.getAttribute && element.getAttribute('data-testid');
        const role = element.getAttribute && element.getAttribute('role');
        return [
            tag,
            testId ? '[data-testid="' + testId + '"]' : '',
            role ? '[role="' + role + '"]' : '',
            classes ? '.' + classes : ''
        ].join('');
    }

    function walkJson(value, path, visitor, depth) {
        const currentDepth = depth || 0;
        if (currentDepth > 10) return;
        visitor(value, path);

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length && i < 80; i += 1) {
                walkJson(value[i], path.concat(String(i)), visitor, currentDepth + 1);
            }
            return;
        }

        if (value && typeof value === 'object') {
            Object.keys(value).slice(0, 120).forEach(function (key) {
                walkJson(value[key], path.concat(key), visitor, currentDepth + 1);
            });
        }
    }

    function iconSvg(name) {
        const icons = {
            'trash-2': [
                '<path d="M3 6h18"/>',
                '<path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
                '<path d="M19 6l-1 14c0 1-1 2-2 2H8c-1 0-2-1-2-2L5 6"/>',
                '<path d="M10 11v6"/>',
                '<path d="M14 11v6"/>'
            ],
            'clipboard-copy': [
                '<rect x="8" y="8" width="12" height="12" rx="2"/>',
                '<path d="M16 8V6c0-1-1-2-2-2H6C5 4 4 5 4 6v8c0 1 1 2 2 2h2"/>'
            ],
            'rotate-ccw': [
                '<path d="M3 12a9 9 0 1 0 3-6.7"/>',
                '<path d="M3 4v6h6"/>'
            ],
            download: [
                '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
                '<path d="M7 10l5 5 5-5"/>',
                '<path d="M12 15V3"/>'
            ],
            bug: [
                '<path d="M8 2l1.5 2"/>',
                '<path d="M16 2l-1.5 2"/>',
                '<path d="M9 9h6"/>',
                '<path d="M8 13h8"/>',
                '<path d="M3 13h4"/>',
                '<path d="M17 13h4"/>',
                '<path d="M5 7l3 2"/>',
                '<path d="M19 7l-3 2"/>',
                '<rect x="7" y="4" width="10" height="16" rx="5"/>'
            ],
            x: [
                '<path d="M18 6L6 18"/>',
                '<path d="M6 6l12 12"/>'
            ]
        };
        return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (icons[name] || []).join('') + '</svg>';
    }

    function createPanel() {
        if (!document.body || runtime.panelHost) return;

        const savedPanel = sanitizePanel(readJson(PANEL_KEY, {}));
        const host = document.createElement('div');
        host.setAttribute('data-ktt-root', '1');
        Object.assign(host.style, {
            position: 'fixed',
            right: savedPanel.right,
            bottom: savedPanel.bottom,
            zIndex: '2147483647',
            font: '13px/1.35 Arial, sans-serif'
        });

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = [
            '<style>',
            ':host{all:initial}',
            '.panel{width:286px;color:#f6f7f8;background:rgba(18,20,24,.92);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(0,0,0,.26);border-radius:8px;overflow:hidden;font:13px/1.35 Arial,sans-serif;backdrop-filter:blur(8px)}',
            '.header{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,.06);cursor:move;user-select:none}',
            '.title{font-weight:700;letter-spacing:0}',
            '.badge{font-size:11px;border-radius:999px;padding:2px 7px;background:#2d6cdf;color:#fff;text-transform:uppercase}',
            '.body{padding:10px 12px 12px}',
            '.tabs{display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:8px 10px 0}',
            '.tab{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#bfc6d1;border-radius:6px;padding:6px 8px;font:12px Arial,sans-serif;cursor:pointer}',
            '.tab.active{background:#2d6cdf;border-color:#2d6cdf;color:#fff}',
            '.tabPanel{display:none}',
            '.tabPanel.active{display:block}',
            '.grid{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:baseline}',
            '.label{color:#aeb6c2}',
            '.value{font-weight:700;text-align:right;color:#fff}',
            '.muted{color:#aeb6c2}',
            '.events{margin-top:10px;border-top:1px solid rgba(255,255,255,.12);padding-top:8px;display:flex;flex-direction:column;gap:5px;max-height:138px;overflow:auto}',
            '.event{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;color:#d8dde6;font-size:12px}',
            '.history{margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto}',
            '.histItem{border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:8px;background:rgba(255,255,255,.04)}',
            '.histTop{display:flex;justify-content:space-between;gap:8px;color:#fff;font-weight:700;font-size:12px}',
            '.histMeta{margin-top:5px;color:#bfc6d1;font-size:11px;display:flex;flex-wrap:wrap;gap:5px}',
            '.pill{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 6px;background:rgba(255,255,255,.05)}',
            '.raw{margin-top:5px;color:#8f98a6;font-size:11px;word-break:break-word}',
            '.projectBox{margin-top:10px;border-top:1px solid rgba(255,255,255,.12);padding-top:9px;display:grid;gap:6px}',
            '.projectHead{display:flex;align-items:center;justify-content:space-between;color:#bfc6d1;font-size:12px}',
            '.projectFields{display:grid;gap:6px}',
            '.field{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;border-radius:6px;padding:7px 8px;font:12px Arial,sans-serif;outline:none}',
            '.field:focus{border-color:#2d6cdf;background:rgba(255,255,255,.09)}',
            '.miniBtn{width:26px;height:26px}',
            '.miniBtn svg{width:14px;height:14px}',
            '.dot{width:7px;height:7px;border-radius:50%;background:#28b67a}',
            '.source{color:#aeb6c2;text-transform:uppercase;font-size:10px}',
            '.actions{display:flex;gap:8px;margin-top:10px;align-items:center;justify-content:space-between}',
            'button{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;border-radius:6px;padding:6px 8px;font:12px Arial,sans-serif;cursor:pointer;min-width:0}',
            'button:hover{background:rgba(255,255,255,.14)}',
            'button.active{background:#2d6cdf;border-color:#2d6cdf}',
            '.iconBtn{position:relative;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:7px}',
            '.iconBtn svg{width:17px;height:17px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}',
            '.iconBtn[data-tooltip]::after{content:attr(data-tooltip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);padding:5px 7px;border-radius:5px;background:rgba(8,10,14,.96);border:1px solid rgba(255,255,255,.14);color:#fff;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s, transform .12s;box-shadow:0 4px 14px rgba(0,0,0,.28);z-index:2}',
            '.iconBtn[data-tooltip]::before{content:"";position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);border:5px solid transparent;border-top-color:rgba(8,10,14,.96);opacity:0;pointer-events:none;transition:opacity .12s;z-index:2}',
            '.iconBtn[data-tooltip]:hover::after{opacity:1;transform:translateX(-50%) translateY(-2px)}',
            '.iconBtn[data-tooltip]:hover::before{opacity:1}',
            '.empty{color:#aeb6c2;font-size:12px}',
            '</style>',
            '<div class="panel">',
            '  <div class="header" data-drag-handle>',
            '    <div class="title">Kling Token Tracker</div>',
            '    <div class="badge" data-field="source">none</div>',
            '  </div>',
            '  <div class="tabs">',
            '    <button type="button" class="tab" data-tab="summary">Summary</button>',
            '    <button type="button" class="tab" data-tab="history">History</button>',
            '  </div>',
            '  <div class="body">',
            '   <div class="tabPanel" data-panel="summary">',
            '    <div class="grid">',
            '      <div class="label">Balance</div><div class="value" data-field="balance">-</div>',
            '      <div class="label">Last spend</div><div class="value" data-field="lastSpend">-</div>',
            '      <div class="label">Session</div><div class="value" data-field="sessionTotal">0</div>',
            '      <div class="label">Today</div><div class="value" data-field="todayTotal">0</div>',
            '    </div>',
            '    <div class="projectBox">',
            '      <div class="projectHead"><span>Project / Bitrix task</span><button type="button" class="iconBtn miniBtn" data-action="clearProject" data-tooltip="Clear project" aria-label="Clear project">' + iconSvg('x') + '</button></div>',
            '      <div class="projectFields">',
            '        <input class="field" data-field="projectName" type="text" placeholder="Task name">',
            '        <input class="field" data-field="projectUrl" type="url" placeholder="Task URL">',
            '      </div>',
            '    </div>',
            '    <div class="events" data-field="events"></div>',
            '   </div>',
            '   <div class="tabPanel" data-panel="history">',
            '    <div class="history" data-field="history"></div>',
            '   </div>',
            '    <div class="actions">',
            '      <button type="button" class="iconBtn" data-action="resetAll" data-tooltip="Reset all" aria-label="Reset all">' + iconSvg('trash-2') + '</button>',
            '      <button type="button" class="iconBtn" data-action="copyReport" data-tooltip="Copy report" aria-label="Copy report">' + iconSvg('clipboard-copy') + '</button>',
            '      <button type="button" class="iconBtn" data-action="reset" data-tooltip="Reset session" aria-label="Reset session">' + iconSvg('rotate-ccw') + '</button>',
            '      <button type="button" class="iconBtn" data-action="export" data-tooltip="Export JSON" aria-label="Export JSON">' + iconSvg('download') + '</button>',
            '      <button type="button" class="iconBtn" data-action="debug" data-tooltip="Collect debug report" aria-label="Collect debug report">' + iconSvg('bug') + '</button>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('');

        shadow.querySelector('[data-action="reset"]').addEventListener('click', function () {
            resetSession();
        });
        shadow.querySelector('[data-action="resetAll"]').addEventListener('click', function () {
            resetAll();
        });
        shadow.querySelector('[data-action="copyReport"]').addEventListener('click', function () {
            copyDebugReport();
        });
        shadow.querySelector('[data-action="export"]').addEventListener('click', function () {
            downloadExport();
        });
        shadow.querySelector('[data-action="debug"]').addEventListener('click', function () {
            setDebug(!runtime.debug);
        });
        shadow.querySelector('[data-action="clearProject"]').addEventListener('click', function () {
            clearProject();
        });
        shadow.querySelector('[data-field="projectName"]').addEventListener('input', function (event) {
            updateProjectFromInputs(event.currentTarget.getRootNode());
        });
        shadow.querySelector('[data-field="projectUrl"]').addEventListener('input', function (event) {
            updateProjectFromInputs(event.currentTarget.getRootNode());
        });
        Array.from(shadow.querySelectorAll('[data-tab]')).forEach(function (button) {
            button.addEventListener('click', function () {
                setActiveTab(button.getAttribute('data-tab'));
            });
        });
        installPanelDrag(host, shadow.querySelector('[data-drag-handle]'));

        document.body.appendChild(host);
        runtime.panelHost = host;
        runtime.shadowRoot = shadow;
    }

    function installPanelDrag(host, handle) {
        if (!host || !handle) return;
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startRight = 0;
        let startBottom = 0;

        handle.addEventListener('pointerdown', function (event) {
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            const rect = host.getBoundingClientRect();
            startRight = Math.max(8, window.innerWidth - rect.right);
            startBottom = Math.max(8, window.innerHeight - rect.bottom);
            handle.setPointerCapture(event.pointerId);
        });

        handle.addEventListener('pointermove', function (event) {
            if (!dragging) return;
            const nextRight = clamp(startRight - (event.clientX - startX), 8, Math.max(8, window.innerWidth - 80));
            const nextBottom = clamp(startBottom - (event.clientY - startY), 8, Math.max(8, window.innerHeight - 60));
            host.style.right = nextRight + 'px';
            host.style.bottom = nextBottom + 'px';
        });

        handle.addEventListener('pointerup', function (event) {
            if (!dragging) return;
            dragging = false;
            try {
                handle.releasePointerCapture(event.pointerId);
            } catch (_) {}
            writeJson(PANEL_KEY, {
                right: host.style.right || '16px',
                bottom: host.style.bottom || '16px'
            });
        });
    }

    function renderSoon() {
        if (runtime.renderTimer) return;
        runtime.renderTimer = window.setTimeout(function () {
            runtime.renderTimer = null;
            renderPanel();
        }, 50);
    }

    function renderPanel() {
        if (!runtime.shadowRoot) return;
        const root = runtime.shadowRoot;
        const last = history[0] || null;
        const source = getDisplaySource();

        setText(root, 'source', source);
        setText(root, 'balance', runtime.balance == null ? '-' : formatCredit(runtime.balance));
        setText(root, 'lastSpend', last ? '-' + formatCredit(last.amount) : '-');
        setText(root, 'sessionTotal', formatCredit(session.total || 0));
        setText(root, 'todayTotal', formatCredit(getTodayTotal()));
        renderProjectFields(root);
        renderTabs(root);

        const debugButton = root.querySelector('[data-action="debug"]');
        if (debugButton) {
            debugButton.classList.toggle('active', runtime.debug);
            debugButton.setAttribute('data-tooltip', runtime.debug ? 'Collecting debug report' : 'Collect debug report');
            debugButton.setAttribute('aria-label', runtime.debug ? 'Collecting debug report' : 'Collect debug report');
        }

        const eventsEl = root.querySelector('[data-field="events"]');
        if (!eventsEl) return;
        eventsEl.textContent = '';
        if (!history.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No spend events yet';
            eventsEl.appendChild(empty);
            renderHistory(root);
            return;
        }

        history.slice(0, 6).forEach(function (event) {
            const row = document.createElement('div');
            row.className = 'event';

            const dot = document.createElement('div');
            dot.className = 'dot';
            if (event.source === 'ui') dot.style.background = '#f2b84b';
            if (event.source === 'mixed') dot.style.background = '#28b67a';
            if (event.source === 'network') dot.style.background = '#2d6cdf';

            const label = document.createElement('div');
            label.textContent = formatTime(event.ts) + '  -' + formatCredit(event.amount) + (event.estimated ? ' est.' : '');

            const src = document.createElement('div');
            src.className = 'source';
            src.textContent = event.source || 'unknown';

            row.appendChild(dot);
            row.appendChild(label);
            row.appendChild(src);
            eventsEl.appendChild(row);
        });

        renderHistory(root);
    }

    function renderTabs(root) {
        Array.from(root.querySelectorAll('[data-tab]')).forEach(function (button) {
            button.classList.toggle('active', button.getAttribute('data-tab') === runtime.activeTab);
        });
        Array.from(root.querySelectorAll('[data-panel]')).forEach(function (panel) {
            panel.classList.toggle('active', panel.getAttribute('data-panel') === runtime.activeTab);
        });
    }

    function renderHistory(root) {
        const historyEl = root.querySelector('[data-field="history"]');
        if (!historyEl) return;
        historyEl.textContent = '';
        if (!history.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = 'No history yet';
            historyEl.appendChild(empty);
            return;
        }

        history.slice(0, 50).forEach(function (event) {
            const item = document.createElement('div');
            item.className = 'histItem';

            const top = document.createElement('div');
            top.className = 'histTop';
            const left = document.createElement('div');
            left.textContent = formatTime(event.ts) + '  -' + formatCredit(event.amount) + (event.estimated ? ' est.' : '');
            const right = document.createElement('div');
            right.textContent = event.serviceName || event.service || activeAdapter.name;
            top.appendChild(left);
            top.appendChild(right);

            const meta = document.createElement('div');
            meta.className = 'histMeta';
            getHistoryPills(event).forEach(function (text) {
                const pill = document.createElement('span');
                pill.className = 'pill';
                pill.textContent = text;
                meta.appendChild(pill);
            });

            const raw = document.createElement('div');
            raw.className = 'raw';
            if (event.project && event.project.url) {
                const link = document.createElement('a');
                link.href = event.project.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = event.project.name || event.project.url;
                link.style.color = '#8eb6ff';
                link.style.textDecoration = 'none';
                raw.appendChild(link);
                if (event.detail) raw.appendChild(document.createTextNode(' · ' + event.detail));
            } else {
                raw.textContent = event.detail || '';
            }

            item.appendChild(top);
            item.appendChild(meta);
            if (event.detail) item.appendChild(raw);
            historyEl.appendChild(item);
        });
    }

    function getHistoryPills(event) {
        const metadata = event.metadata || {};
        const pills = [
            event.source || 'unknown'
        ];
        if (event.estimated) pills.push('estimated');
        if (event.project && event.project.name) pills.push('project: ' + event.project.name);
        ['resolution', 'duration', 'outputs', 'audio', 'mode', 'aspectRatio', 'model'].forEach(function (key) {
            if (metadata[key] == null || metadata[key] === '') return;
            pills.push(key + ': ' + metadata[key]);
        });
        return pills;
    }

    function setActiveTab(tab) {
        runtime.activeTab = tab === 'history' ? 'history' : 'summary';
        writeJson(UI_KEY, { activeTab: runtime.activeTab });
        renderSoon();
    }

    function setText(root, field, value) {
        const el = root.querySelector('[data-field="' + field + '"]');
        if (el) el.textContent = String(value);
    }

    function renderProjectFields(root) {
        const active = root.activeElement;
        const nameInput = root.querySelector('[data-field="projectName"]');
        const urlInput = root.querySelector('[data-field="projectUrl"]');
        if (nameInput && active !== nameInput) nameInput.value = runtime.project.name || '';
        if (urlInput && active !== urlInput) urlInput.value = runtime.project.url || '';
    }

    function updateProjectFromInputs(root) {
        const nameInput = root.querySelector('[data-field="projectName"]');
        const urlInput = root.querySelector('[data-field="projectUrl"]');
        runtime.project = sanitizeProject({
            name: nameInput ? nameInput.value : '',
            url: urlInput ? urlInput.value : ''
        });
        saveProject();
    }

    function getDisplaySource() {
        if (runtime.sourceSeen.network && runtime.sourceSeen.ui) return 'mixed';
        if (runtime.sourceSeen.network) return 'network';
        if (runtime.sourceSeen.ui) return 'ui';
        return runtime.balanceSource || 'none';
    }

    function downloadExport() {
        const blob = new Blob([exportJSON()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'kling-token-tracker-' + localDateKey(Date.now()) + '.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(function () {
            URL.revokeObjectURL(url);
        }, 1000);
    }

    function getFetchMeta(input, init) {
        let method = 'GET';
        let url = '';
        let bodyText = '';

        if (input && typeof input === 'object' && 'url' in input) {
            url = normalizeUrl(input.url);
            method = String(input.method || method).toUpperCase();
        } else {
            url = normalizeUrl(input);
        }

        if (init && init.method) method = String(init.method).toUpperCase();
        if (init && 'body' in init) bodyText = stringifyBody(init.body);

        return { url, method, bodyText, pending: null };
    }

    function normalizeUrl(input) {
        if (input == null) return '';
        try {
            if (typeof input === 'string') return input;
            if (input && typeof input.toString === 'function') return input.toString();
        } catch (_) {}
        return String(input || '');
    }

    function stringifyBody(body) {
        if (body == null) return '';
        if (typeof body === 'string') return body.slice(0, 5000);
        if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body.toString().slice(0, 5000);
        if (typeof FormData !== 'undefined' && body instanceof FormData) {
            const parts = [];
            try {
                body.forEach(function (value, key) {
                    parts.push(key + '=' + (typeof value === 'string' ? value : '[file]'));
                });
            } catch (_) {}
            return parts.join('&').slice(0, 5000);
        }
        if (typeof Blob !== 'undefined' && body instanceof Blob) return '[blob]';
        if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) return '[arraybuffer]';
        try {
            return JSON.stringify(body).slice(0, 5000);
        } catch (_) {
            return String(body).slice(0, 5000);
        }
    }

    function isUiGenerationText(text) {
        const normalized = String(text || '').toLowerCase();
        if (!normalized) return false;
        if (/generate|create|submit|start|try|render/.test(normalized) && /video|generation|generate|create|submit|render/.test(normalized)) {
            return true;
        }
        if (/生成|創建|创建/.test(normalized)) return true;
        return false;
    }

    function looksRelevantForDebug(url, payload) {
        const text = String(url || '').toLowerCase();
        if (/wallet|balance|credit|quota|token|account|profile|video|generate|task/.test(text)) return true;
        try {
            return /wallet|balance|credit|quota|token|task|video/i.test(JSON.stringify(payload).slice(0, 3000));
        } catch (_) {
            return false;
        }
    }

    function parseJsonText(text) {
        if (typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return null;
        try {
            return JSON.parse(trimmed);
        } catch (_) {
            return null;
        }
    }

    function getHeader(headers, name) {
        try {
            return headers && typeof headers.get === 'function' ? headers.get(name) || '' : '';
        } catch (_) {
            return '';
        }
    }

    function normalizeJsonNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return parseLooseNumber(value);
        return NaN;
    }

    function parseLooseNumber(value) {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return NaN;
        let text = value.trim();
        if (!text) return NaN;
        text = text.replace(/\s+/g, '');
        if (!/^\d[\d,.]*$/.test(text)) return NaN;
        if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
            text = text.replace(/,/g, '');
        } else if (text.indexOf(',') >= 0) {
            const parts = text.split(',');
            if (parts.length === 2 && parts[1].length !== 3) {
                text = parts[0] + '.' + parts[1];
            } else {
                text = text.replace(/,/g, '');
            }
        }
        return Number(text);
    }

    function isFiniteCredit(value) {
        return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1000000000;
    }

    function normalizeCredit(value) {
        return Math.round(Number(value) * 1000000) / 1000000;
    }

    function nearlyEqual(a, b) {
        return Math.abs(Number(a) - Number(b)) < 0.000001;
    }

    function formatCredit(value) {
        if (!isFiniteCredit(Number(value))) return '-';
        const rounded = normalizeCredit(value);
        return rounded.toLocaleString(undefined, {
            maximumFractionDigits: 3
        });
    }

    function formatTime(ts) {
        try {
            return new Date(ts).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
        } catch (_) {
            return '';
        }
    }

    function localDateKey(ts) {
        const date = new Date(ts);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return year + '-' + month + '-' + day;
    }

    function getTodayTotal() {
        const today = localDateKey(Date.now());
        return normalizeCredit(history.reduce(function (sum, event) {
            return sum + (event.localDate === today ? Number(event.amount || 0) : 0);
        }, 0));
    }

    function summarizeDiagnostics(items) {
        const list = Array.isArray(items) ? items.slice(-80) : [];
        const grouped = {};
        list.forEach(function (entry) {
            const args = entry && Array.isArray(entry.args) ? entry.args : [];
            const label = String(args[0] || 'unknown');
            const key = label + '|' + String(args[1] || '') + '|' + String(args[2] || '');
            if (!grouped[key]) {
                grouped[key] = {
                    count: 0,
                    lastAt: null,
                    sample: args
                };
            }
            grouped[key].count += 1;
            grouped[key].lastAt = entry.ts || null;
            grouped[key].sample = args;
        });
        return Object.keys(grouped).map(function (key) {
            return grouped[key];
        }).sort(function (a, b) {
            return (b.lastAt || 0) - (a.lastAt || 0);
        }).slice(0, 30);
    }

    function addEventToSession(event) {
        if (!session || !Array.isArray(session.eventIds)) session = createSession();
        if (session.eventIds.indexOf(event.id) >= 0) return;
        session.eventIds.push(event.id);
        session.total = normalizeCredit(Number(session.total || 0) + Number(event.amount || 0));
    }

    function createSession() {
        return {
            id: createId('session'),
            startedAt: Date.now(),
            total: 0,
            eventIds: []
        };
    }

    function sanitizeSession(value) {
        if (!value || typeof value !== 'object') return null;
        return {
            id: String(value.id || createId('session')),
            startedAt: Number(value.startedAt || Date.now()),
            total: normalizeCredit(Number(value.total || 0)),
            eventIds: Array.isArray(value.eventIds) ? value.eventIds.map(String).slice(0, MAX_EVENTS) : []
        };
    }

    function sanitizeEvents(value) {
        if (!Array.isArray(value)) return [];
        return value.filter(function (event) {
            return event && typeof event === 'object' && isFiniteCredit(Number(event.amount));
        }).map(function (event) {
            return {
                id: String(event.id || createId('event')),
                ts: Number(event.ts || Date.now()),
                localDate: String(event.localDate || localDateKey(event.ts || Date.now())),
                amount: normalizeCredit(Number(event.amount || 0)),
                before: normalizeCredit(Number(event.before || 0)),
                after: normalizeCredit(Number(event.after || 0)),
                source: String(event.source || 'unknown'),
                service: String(event.service || 'kling'),
                serviceName: String(event.serviceName || (event.service === 'kling' || !event.service ? 'Kling' : event.service)),
                taskId: event.taskId == null ? null : String(event.taskId),
                url: redactUrl(event.url || ''),
                method: String(event.method || ''),
                path: String(event.path || ''),
                score: event.score == null ? null : Number(event.score),
                pendingId: event.pendingId == null ? null : String(event.pendingId),
                detail: String(event.detail || ''),
                metadata: sanitizeMetadata(event.metadata || {}),
                project: sanitizeProject(event.project || {}),
                estimated: event.estimated === true,
                updatedAt: event.updatedAt ? Number(event.updatedAt) : undefined
            };
        }).sort(function (a, b) {
            return b.ts - a.ts;
        }).slice(0, MAX_EVENTS);
    }

    function sanitizeMeta(value) {
        const balance = isFiniteCredit(Number(value && value.balance)) ? normalizeCredit(Number(value.balance)) : null;
        return {
            balance,
            balanceSource: value && value.balanceSource ? String(value.balanceSource) : 'none',
            balancePath: value && value.balancePath ? String(value.balancePath) : '',
            lastBalanceAt: value && value.lastBalanceAt ? Number(value.lastBalanceAt) : null
        };
    }

    function sanitizePanel(value) {
        return {
            right: value && /^-?\d+(\.\d+)?px$/.test(String(value.right || '')) ? String(value.right) : '16px',
            bottom: value && /^-?\d+(\.\d+)?px$/.test(String(value.bottom || '')) ? String(value.bottom) : '16px'
        };
    }

    function sanitizeUiState(value) {
        return {
            activeTab: value && value.activeTab === 'history' ? 'history' : 'summary'
        };
    }

    function createEventId(input, ts) {
        return [
            'delta',
            Math.floor(ts / 1000),
            normalizeCredit(input.before),
            normalizeCredit(input.after),
            normalizeCredit(input.amount)
        ].join(':');
    }

    function createId(prefix) {
        return prefix + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 9);
    }

    function mergeSources(a, b) {
        const first = a || '';
        const second = b || '';
        if (!first) return second || 'unknown';
        if (!second || first === second) return first;
        if (first === 'estimated' && second === 'network') return 'network';
        if (first === 'network' && second === 'estimated') return 'network';
        if (first === 'estimated' && second === 'ui') return 'ui';
        if (first === 'ui' && second === 'estimated') return 'ui';
        if (first === 'mixed' || second === 'mixed') return 'mixed';
        if ((first === 'network' && second === 'ui') || (first === 'ui' && second === 'network')) return 'mixed';
        return first;
    }

    function readJson(key, fallback) {
        try {
            const raw = window.localStorage.getItem(key);
            if (raw == null || raw === '') return fallback;
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }

    function writeJson(key, value) {
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            addDiagnostic('storage write failed', key, error && error.message ? error.message : error);
        }
    }

    function saveHistory() {
        writeJson(HISTORY_KEY, history);
    }

    function saveSession() {
        writeJson(SESSION_KEY, session);
    }

    function saveMeta() {
        writeJson(META_KEY, meta);
    }

    function saveProject() {
        writeJson(PROJECT_KEY, runtime.project);
    }

    function deepClone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function compactText(text) {
        return String(text || '').replace(/\s+/g, ' ').trim();
    }

    function redactUrl(value) {
        const raw = String(value || '');
        if (!raw) return '';
        if (raw.indexOf('?') < 0 && raw.indexOf('#') < 0) return raw;

        try {
            const base = window.location && window.location.origin ? window.location.origin : 'https://kling.ai';
            const parsed = new URL(raw, base);
            const keys = [];
            parsed.searchParams.forEach(function (_paramValue, key) {
                if (keys.indexOf(key) < 0) keys.push(key);
            });
            const query = keys.length ? '?' + keys.map(function (key) {
                return key + '=...';
            }).join('&') : '';
            const origin = /^https?:\/\//i.test(raw) ? parsed.origin : '';
            return origin + parsed.pathname + query;
        } catch (_) {
            return raw.replace(/\?[^#\s]*/g, '?...');
        }
    }

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function addDiagnostic() {
        const args = Array.prototype.slice.call(arguments);
        runtime.diagnostics.push({
            ts: Date.now(),
            args: args.map(formatDebugArg)
        });
        runtime.diagnostics = runtime.diagnostics.slice(-120);
    }

    function formatDebugArg(value) {
        if (value == null) return value;
        if (typeof value === 'string') return maybeRedactDebugString(value);
        if (typeof value === 'number' || typeof value === 'boolean') return value;
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (_) {
            return String(value);
        }
    }

    function maybeRedactDebugString(value) {
        const text = String(value);
        if (/^(https?:\/\/|\/)/.test(text) && text.indexOf('?') >= 0) return redactUrl(text);
        return text.replace(/(https?:\/\/[^\s]+|\/[A-Za-z0-9_./-]+\?[^\s]+)/g, function (match) {
            return redactUrl(match);
        });
    }
})();
