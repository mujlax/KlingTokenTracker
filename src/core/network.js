import { getPageWindow } from './storage.js';
import { parseJsonText, normalizeUrl, getHeader } from '../lib/utils.js';
import { extractTaskId } from '../lib/balance-parse.js';

export function createNetwork(ctx) {
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

    function looksRelevantForDebug(url, payload) {
        const text = String(url || '').toLowerCase();
        if (/wallet|balance|credit|quota|token|account|profile|video|generate|task/.test(text)) return true;
        try {
            return /wallet|balance|credit|quota|token|task|video/i.test(JSON.stringify(payload).slice(0, 3000));
        } catch (_) {
            return false;
        }
    }

    function handlePayload(payload, context) {
        const activeAdapter = ctx.getActiveAdapter();
        if (!activeAdapter || !activeAdapter.networkEnabled) return;
        const taskId = extractTaskId(payload);
        if (taskId && context.pending) {
            context.pending.taskId = taskId;
        }

        const balanceCandidate = activeAdapter.extractBalance(payload, context.url);
        if (!balanceCandidate) {
            if (ctx.runtime.debug && activeAdapter.isRelevantDebugUrl(context.url, payload)) {
                ctx.addDiagnostic('network payload candidate without balance', context.method || '', context.url);
            }
            return;
        }

        ctx.addDiagnostic('balance candidate', balanceCandidate.value, balanceCandidate.path, context.url);
        ctx.observeBalance(balanceCandidate.value, 'network', {
            url: context.url,
            method: context.method,
            path: balanceCandidate.path,
            taskId: taskId || (context.pending && context.pending.taskId) || null,
            pending: context.pending || null,
            score: balanceCandidate.score
        });
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
            ctx.addDiagnostic('fetch response parse failed', metaInfo.url, error && error.message ? error.message : error);
        });
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
            ctx.addDiagnostic('xhr response parse failed', metaInfo.url, error && error.message ? error.message : error);
        }
    }

    function patchFetch() {
        const pageWindow = getPageWindow();
        if (typeof pageWindow.fetch !== 'function' || pageWindow.fetch.__kttPatched) return;

        const originalFetch = pageWindow.fetch;
        function wrappedFetch(input, init) {
            const metaInfo = getFetchMeta(input, init);

            return originalFetch.apply(this, arguments).then(function (response) {
                inspectFetchResponse(response, metaInfo);
                return response;
            });
        }

        wrappedFetch.__kttPatched = true;
        wrappedFetch.__kttOriginal = originalFetch;
        pageWindow.fetch = wrappedFetch;
    }

    function patchXMLHttpRequest() {
        const pageWindow = getPageWindow();
        if (typeof pageWindow.XMLHttpRequest !== 'function') return;
        const proto = pageWindow.XMLHttpRequest.prototype;
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

    return {
        patchFetch,
        patchXMLHttpRequest,
        inspectFetchResponse,
        inspectXhrResponse,
        handlePayload,
        getFetchMeta,
        stringifyBody,
        looksRelevantForDebug
    };
}
