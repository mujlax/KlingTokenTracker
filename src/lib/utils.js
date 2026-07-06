export function compactText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

export function escapeRegExp(text) {
    return String(text || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

export function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export function redactUrl(value) {
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

export function walkJson(value, path, visitor, depth) {
    depth = depth || 0;
    if (depth > 12) return;
    visitor(value, path);
    if (value == null) return;
    if (Array.isArray(value)) {
        value.forEach(function (item, index) {
            walkJson(item, path.concat(String(index)), visitor, depth + 1);
        });
        return;
    }
    if (typeof value === 'object') {
        Object.keys(value).forEach(function (key) {
            walkJson(value[key], path.concat(key), visitor, depth + 1);
        });
    }
}

export function parseJsonText(text) {
    if (text == null || text === '') return null;
    try {
        return JSON.parse(text);
    } catch (_) {
        return null;
    }
}

export function normalizeUrl(input) {
    if (input == null) return '';
    try {
        if (typeof input === 'string') return input;
        if (input && typeof input.toString === 'function') return input.toString();
    } catch (_) {}
    return String(input || '');
}

export function getHeader(headers, name) {
    if (!headers || !name) return '';
    try {
        return headers.get ? headers.get(name) || '' : '';
    } catch (_) {
        return '';
    }
}

export function maybeRedactDebugString(value) {
    const text = String(value);
    if (/^(https?:\/\/|\/)/.test(text) && text.indexOf('?') >= 0) return redactUrl(text);
    return text.replace(/(https?:\/\/[^\s]+|\/[A-Za-z0-9_./-]+\?[^\s]+)/g, function (match) {
        return redactUrl(match);
    });
}
