import {
    UI_CLICK_DEDUP_MS,
    UI_SCAN_DEBOUNCE_MS,
    UI_SCAN_INTERVAL_MS,
    MIN_UI_SCORE
} from './constants.js';
import { resolveUiSpendBalance } from './events.js';
import { compactText } from '../lib/utils.js';
import {
    isFiniteCredit,
    normalizeCredit,
    nearlyEqual,
    parseLooseNumber
} from '../lib/credits.js';

export function createBalance(ctx) {
    function adapterSupportsUiBalance(adapter) {
        if (!adapter) return false;
        if (adapter.uiBalanceEnabled === true) return true;
        if (adapter.networkEnabled === true) return true;
        return false;
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

    function resolveUiSpendBalanceForRuntime(amount, now) {
        return resolveUiSpendBalance(amount, now, {
            balance: ctx.runtime.balance,
            lastUiSpend: ctx.runtime.lastUiSpend
        });
    }

    function updateBalanceMeta(balance, source, context, now) {
        ctx.runtime.balance = normalizeCredit(balance);
        ctx.runtime.balanceSource = source || ctx.runtime.balanceSource || 'none';
        ctx.runtime.balancePath = (context && context.path) || ctx.runtime.balancePath || '';
        ctx.runtime.lastBalanceAt = now || Date.now();
        ctx.setMeta({
            balance: ctx.runtime.balance,
            balanceSource: ctx.runtime.balanceSource,
            balancePath: ctx.runtime.balancePath,
            lastBalanceAt: ctx.runtime.lastBalanceAt
        });
        ctx.saveMeta();
        ctx.renderSoon();
    }

    function observeBalance(nextBalance, source, context) {
        if (!isFiniteCredit(nextBalance)) return;
        const next = normalizeCredit(nextBalance);
        const previous = ctx.runtime.balance;
        const now = Date.now();

        ctx.runtime.sourceSeen[source] = true;

        if (previous != null && nearlyEqual(previous, next)) {
            updateBalanceMeta(next, source, context, now);
            return;
        }

        if (
            source === 'ui' &&
            ctx.runtime.balanceSource === 'network' &&
            previous != null &&
            ctx.runtime.lastBalanceAt &&
            now - ctx.runtime.lastBalanceAt < 15000
        ) {
            ctx.addDiagnostic('ignored early ui balance drift', next, 'current', previous);
            return;
        }

        if (previous != null && next < previous) {
            const amount = normalizeCredit(previous - next);
            ctx.addDiagnostic('observed balance decrease without spend record', {
                previous,
                next,
                amount,
                source,
                path: context && context.path,
                url: context && context.url
            });
        }

        updateBalanceMeta(next, source, context, now);
        ctx.saveMeta();
        ctx.renderSoon();
    }

    function isPriceLikeUiContext(text) {
        return /\bcost\b|\bprice\b|\bspent\b|\bused\b|\bconsume|\bconsumed\b|\bupgrade\b|\bsubscribe\b|\bbuy\b|\bpurchase\b|\bstandard\b|\bpro\b|\bmaster\b|\bgenerate\b|\bgeneration\b/i.test(String(text || ''));
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

    function isIgnoredUiElement(element) {
        if (!element) return true;
        const tag = String(element.tagName || '').toLowerCase();
        if (tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'textarea') return true;
        if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'option') return true;
        if (element.closest && element.closest('button, a, [role="button"], [data-ktt-root]')) return true;
        if (ctx.runtime.panelHost && (element === ctx.runtime.panelHost || ctx.runtime.panelHost.contains(element))) return true;
        return false;
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

    function scheduleUiScan(delay) {
        if (ctx.runtime.uiScanTimer) {
            window.clearTimeout(ctx.runtime.uiScanTimer);
            ctx.runtime.uiScanTimer = null;
        }
        ctx.runtime.uiScanTimer = window.setTimeout(scanUiBalance, delay);
    }

    function scanUiBalance() {
        ctx.runtime.uiScanTimer = null;
        if (!document.body) return;
        const activeAdapter = ctx.getActiveAdapter();
        if (!adapterSupportsUiBalance(activeAdapter)) return;

        let candidate = null;
        if (activeAdapter && typeof activeAdapter.extractUiBalance === 'function') {
            candidate = activeAdapter.extractUiBalance(document.body, ctx.runtime.panelHost);
        } else {
            candidate = extractUiBalanceCandidate(document.body);
        }
        if (!candidate) return;

        ctx.addDiagnostic('ui balance candidate', candidate.value, candidate.context);
        observeBalance(candidate.value, 'ui', {
            path: 'visible text',
            context: candidate.context,
            score: candidate.score,
            pending: null,
            url: window.location.href
        });
    }

    function recordUiGenerateClick(parsed, clickable) {
        const amount = parsed && parsed.amount;
        if (!isFiniteCredit(amount) || amount <= 0) {
            ctx.addDiagnostic('ui generate click without cost', parsed && parsed.detail);
            return null;
        }

        const now = Date.now();
        if (
            ctx.runtime.lastUiSpend &&
            nearlyEqual(ctx.runtime.lastUiSpend.amount, amount) &&
            now - ctx.runtime.lastUiSpend.ts < UI_CLICK_DEDUP_MS
        ) {
            ctx.addDiagnostic('deduped ui spend click', amount, parsed.detail);
            return null;
        }

        const balanceSnapshot = resolveUiSpendBalanceForRuntime(amount, now);
        const before = balanceSnapshot.before;
        const after = balanceSnapshot.after;
        const metadata = parsed.metadata || {};
        const detailRaw = ctx.cleanUiDetailText(String(parsed.detail || ''), { project: ctx.runtime.project });
        const event = ctx.recordSpend({
            amount,
            before: before == null ? amount : before,
            after: after == null ? (before == null ? 0 : before) : after,
            source: 'ui',
            service: ctx.getActiveAdapter().id,
            serviceName: ctx.getActiveAdapter().name,
            taskId: null,
            url: window.location.href,
            method: 'UI',
            path: 'ui generate button',
            score: null,
            pendingId: null,
            detail: ctx.hasDisplayMetadata({ metadata: metadata }) ? '' : detailRaw.slice(0, 180),
            metadata: metadata,
            estimated: parsed.estimated === true
        }, now);

        if (event) {
            ctx.runtime.lastUiSpend = {
                ts: now,
                amount,
                text: parsed.detail,
                target: getElementSignature(clickable),
                beforeAtClick: ctx.runtime.balance,
                expectedAfter: after
            };
            ctx.runtime.sourceSeen.ui = true;
            ctx.addDiagnostic('recorded ui spend click', event);
            ctx.renderSoon();
        }

        return event;
    }

    function installUiObserver() {
        if (!document.body || ctx.runtime.uiObserver || typeof window.MutationObserver !== 'function') return;
        ctx.runtime.uiObserver = new MutationObserver(function () {
            scheduleUiScan(UI_SCAN_DEBOUNCE_MS);
        });
        ctx.runtime.uiObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
        ctx.runtime.uiInterval = window.setInterval(function () {
            scheduleUiScan(0);
        }, UI_SCAN_INTERVAL_MS);
    }

    function installClickTracker() {
        document.addEventListener('click', function (event) {
            const target = event.target;
            if (!target || !target.closest) return;
            if (ctx.runtime.panelHost && ctx.runtime.panelHost.contains(target)) return;

            if (adapterSupportsUiBalance(ctx.getActiveAdapter())) {
                scheduleUiScan(350);
            }

            const clickable = target.closest('button, a, [role="button"], [data-testid], [class*="button"], [class*="Button"]');
            if (!clickable) return;

            const parsed = ctx.getActiveAdapter().parseGenerateClick(clickable, event);
            if (!parsed) return;

            ctx.addDiagnostic('ui generation click candidate', parsed.detail);
            recordUiGenerateClick(parsed, clickable);
        }, true);
    }

    return {
        adapterSupportsUiBalance,
        observeBalance,
        updateBalanceMeta,
        scanUiBalance,
        scheduleUiScan,
        extractUiBalanceCandidate,
        recordUiGenerateClick,
        resolveUiSpendBalanceForRuntime,
        installUiObserver,
        installClickTracker
    };
}
