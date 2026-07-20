import { HISTORY_KEY, PROJECT_KEY, PROJECTS_LIBRARY_KEY, PROJECTS_SYNC_KEY, MAX_EVENTS } from './constants.js';

const SHARED_KEYS = new Set([HISTORY_KEY, PROJECT_KEY, PROJECTS_LIBRARY_KEY, PROJECTS_SYNC_KEY]);

function gmAvailable() {
    return typeof GM_getValue === 'function' && typeof GM_setValue === 'function';
}

export function getPageWindow() {
    try {
        if (typeof unsafeWindow !== 'undefined' && unsafeWindow) return unsafeWindow;
    } catch (_) {}
    return typeof window !== 'undefined' ? window : globalThis;
}

function readLocalJson(key, fallback) {
    try {
        const raw = window.localStorage.getItem(key);
        if (raw == null || raw === '') return fallback;
        return JSON.parse(raw);
    } catch (_) {
        return fallback;
    }
}

function parseGmValue(raw, fallback) {
    if (raw == null || raw === '') return fallback;
    if (typeof raw === 'string') {
        try {
            return JSON.parse(raw);
        } catch (_) {
            return fallback;
        }
    }
    return raw;
}

export function mergeEventHistories(a, b, max) {
    const limit = typeof max === 'number' && max > 0 ? max : MAX_EVENTS;
    const byId = new Map();
    const lists = [a, b];

    lists.forEach(function (list) {
        if (!Array.isArray(list)) return;
        list.forEach(function (event) {
            if (!event || typeof event !== 'object') return;
            const id = event.id ? String(event.id) : '';
            if (id) {
                const existing = byId.get(id);
                if (!existing || Number(event.ts || 0) >= Number(existing.ts || 0)) {
                    byId.set(id, event);
                }
                return;
            }
            byId.set('anon:' + byId.size + ':' + String(event.ts || 0), event);
        });
    });

    return Array.from(byId.values()).sort(function (left, right) {
        return Number(right.ts || 0) - Number(left.ts || 0);
    }).slice(0, limit);
}

export function loadSharedHistory(fallback) {
    const empty = Array.isArray(fallback) ? fallback : [];

    if (!gmAvailable()) {
        const localOnly = readLocalJson(HISTORY_KEY, null);
        return Array.isArray(localOnly) ? localOnly : empty;
    }

    const fromGm = parseGmValue(GM_getValue(HISTORY_KEY, null), []);
    const fromLocal = readLocalJson(HISTORY_KEY, []);
    const gmList = Array.isArray(fromGm) ? fromGm : [];
    const localList = Array.isArray(fromLocal) ? fromLocal : [];
    const merged = mergeEventHistories(gmList, localList, MAX_EVENTS);

    writeJson(HISTORY_KEY, merged);
    return merged;
}

export function readJson(key, fallback) {
    if (key === HISTORY_KEY) {
        return loadSharedHistory(fallback);
    }

    if (SHARED_KEYS.has(key) && gmAvailable()) {
        try {
            const fromGm = parseGmValue(GM_getValue(key, null), null);
            if (fromGm != null) return fromGm;

            const fromLocal = readLocalJson(key, null);
            if (fromLocal != null) {
                writeJson(key, fromLocal);
                return fromLocal;
            }
            return fallback;
        } catch (_) {
            return readLocalJson(key, fallback);
        }
    }
    return readLocalJson(key, fallback);
}

export function writeJson(key, value) {
    const serialized = JSON.stringify(value);

    if (SHARED_KEYS.has(key) && gmAvailable()) {
        try {
            GM_setValue(key, serialized);
        } catch (error) {
            console.warn('[AI Token Tracker] GM_setValue failed for', key, error);
        }
    }

    try {
        window.localStorage.setItem(key, serialized);
    } catch (error) {
        console.warn('[AI Token Tracker] localStorage write failed for', key, error);
    }
}
