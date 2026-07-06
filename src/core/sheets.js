import { VERSION, SHEETS_SYNC_KEY, SETTINGS_KEY } from './constants.js';
import { readJson, writeJson } from './storage.js';

const SHEETS_POST_HEADERS = { 'Content-Type': 'text/plain;charset=utf-8' };

export function buildProjectKey(name) {
    return String(name || '').trim().toLowerCase();
}

export function sanitizeSheetsWebAppUrl(value) {
    const url = String(value || '').trim();
    if (!url) return '';
    if (/script\.googleusercontent\.com/i.test(url)) return '';
    if (/^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/(exec|dev)$/i.test(url)) {
        return url.replace(/\/dev$/i, '/exec').slice(0, 500);
    }
    if (/^https:\/\/script\.google\.com\//i.test(url)) {
        return url.slice(0, 500);
    }
    return '';
}

export function canSyncToSheets(settings) {
    if (!settings || settings.sheetsEnabled !== true) return false;
    if (!sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl)) return false;
    if (!String(settings.sheetsSecretToken || '').trim()) return false;
    if (!String(settings.sheetsNickname || '').trim()) return false;
    return true;
}

export function buildSheetsPayload(event, settings) {
    const project = (event && event.project) || {};
    const projectName = String(project.name || '').trim();
    return {
        eventId: String(event.id || ''),
        ts: new Date(event.ts || Date.now()).toISOString(),
        localDate: String(event.localDate || ''),
        amount: event.amount,
        service: String(event.service || ''),
        serviceName: String(event.serviceName || event.service || ''),
        projectId: String(project.id || ''),
        projectName: projectName,
        projectKey: buildProjectKey(projectName),
        user: String(settings.sheetsNickname || '').trim(),
        source: String(event.source || 'unknown'),
        estimated: event.estimated === true,
        trackerVersion: VERSION
    };
}

function loadSyncState() {
    const raw = readJson(SHEETS_SYNC_KEY, {});
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
}

function saveSyncState(state) {
    const keys = Object.keys(state);
    if (keys.length > 500) {
        const sorted = keys.sort(function (a, b) {
            return String(state[b] || '').localeCompare(String(state[a] || ''));
        });
        sorted.slice(500).forEach(function (key) {
            delete state[key];
        });
    }
    writeJson(SHEETS_SYNC_KEY, state);
}

export function getSyncState(eventId) {
    const state = loadSyncState();
    return state[String(eventId || '')] || null;
}

export function markSyncState(eventId, status) {
    if (!eventId) return;
    const state = loadSyncState();
    state[String(eventId)] = status;
    saveSyncState(state);
}

function updateSheetsStatus(ctx, patch) {
    ctx.runtime.settings = Object.assign({}, ctx.runtime.settings, patch);
    writeJson(SETTINGS_KEY, ctx.runtime.settings);
    if (typeof ctx.renderSoon === 'function') ctx.renderSoon();
}

function postJsonToSheets(settings, body) {
    const url = sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl);
    if (!url) {
        return Promise.reject(new Error('invalid web app url — use .../macros/s/.../exec'));
    }

    const payload = JSON.stringify(Object.assign({}, body, {
        token: String(settings.sheetsSecretToken || '').trim()
    }));

    if (typeof GM_xmlhttpRequest === 'function') {
        return new Promise(function (resolve, reject) {
            GM_xmlhttpRequest({
                method: 'POST',
                url: url,
                headers: SHEETS_POST_HEADERS,
                data: payload,
                onload: function (response) {
                    resolve({
                        status: response.status,
                        body: response.responseText || '',
                        finalUrl: response.finalUrl || ''
                    });
                },
                onerror: function (error) {
                    reject(error || new Error('network error'));
                },
                ontimeout: function () {
                    reject(new Error('timeout'));
                },
                timeout: 20000
            });
        });
    }

    if (typeof fetch === 'function') {
        return fetch(url, {
            method: 'POST',
            headers: SHEETS_POST_HEADERS,
            body: payload
        }).then(function (response) {
            return response.text().then(function (text) {
                return {
                    status: response.status,
                    body: text,
                    finalUrl: response.url || ''
                };
            });
        });
    }

    return Promise.reject(new Error('no http client'));
}

function parseSheetsResponse(response) {
    const body = response.body || '';
    let data = null;
    try {
        data = JSON.parse(body);
    } catch (_) {
        data = null;
    }
    return { data: data, status: response.status, body: body };
}

function isSuccessResponse(parsed) {
    const data = parsed.data;
    if (data && data.ok === true) return true;
    if (data && data.error === 'duplicate') return true;
    if (parsed.status === 409) return true;
    return false;
}

export function getSheetsErrorMessage(parsed) {
    const body = parsed.body || '';
    const data = parsed.data;

    if (data && data.error) return String(data.error);
    if (parsed.status === 401 || (data && data.error === 'unauthorized')) return 'unauthorized — check secret token';
    if (
        parsed.status === 404 ||
        /Страница не найдена|не удалось открыть файл|Page Not Found/i.test(body)
    ) {
        return 'web app 404 — redeploy Apps Script (Execute as Me, Anyone access)';
    }
    if (parsed.status === 405) {
        return 'method not allowed — redeploy Web App deployment';
    }
    if (!data && body && body.charAt(0) === '<') {
        return 'invalid web app response — check /exec URL and deployment';
    }
    if (parsed.status) return 'sync failed (' + parsed.status + ')';
    return 'sync failed';
}

export function sendSheetsRequest(ctx, action, payload) {
    const settings = ctx.getSettings();
    if (!canSyncToSheets(settings) && action !== 'ping') {
        return Promise.reject(new Error('sheets not configured'));
    }
    if (action === 'ping' && !sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl)) {
        return Promise.reject(new Error('invalid web app url — use .../macros/s/.../exec'));
    }
    if (action === 'ping' && !String(settings.sheetsSecretToken || '').trim()) {
        return Promise.reject(new Error('missing secret token'));
    }

    return postJsonToSheets(settings, {
        action: action,
        payload: payload || null
    }).then(function (response) {
        const parsed = parseSheetsResponse(response);
        if (isSuccessResponse(parsed)) {
            updateSheetsStatus(ctx, {
                sheetsLastSyncAt: Date.now(),
                sheetsLastError: ''
            });
            return parsed.data || { ok: true };
        }
        const message = getSheetsErrorMessage(parsed);
        updateSheetsStatus(ctx, { sheetsLastError: message });
        throw new Error(message);
    }).catch(function (error) {
        const message = error && error.message ? error.message : 'network error';
        updateSheetsStatus(ctx, { sheetsLastError: message });
        throw error;
    });
}

export function syncEventToSheets(ctx, event) {
    if (!event || !event.id) return Promise.resolve(null);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (getSyncState(event.id) === 'synced') return Promise.resolve(null);

    const payload = buildSheetsPayload(event, ctx.getSettings());
    return sendSheetsRequest(ctx, 'appendEvent', payload).then(function () {
        markSyncState(event.id, 'synced');
        ctx.addDiagnostic('sheets sync ok', event.id);
        return event;
    }).catch(function (error) {
        markSyncState(event.id, 'failed');
        ctx.addDiagnostic('sheets sync failed', event.id, error && error.message);
        return null;
    });
}

export function retryFailedSyncs(ctx) {
    if (!canSyncToSheets(ctx.getSettings())) {
        return Promise.resolve({ retried: 0, synced: 0 });
    }

    const history = ctx.getHistory();
    const failed = history.filter(function (event) {
        return event && getSyncState(event.id) === 'failed';
    });

    let synced = 0;
    let chain = Promise.resolve();
    failed.forEach(function (event) {
        chain = chain.then(function () {
            return syncEventToSheets(ctx, event).then(function (result) {
                if (result) synced += 1;
            });
        });
    });

    return chain.then(function () {
        return { retried: failed.length, synced: synced };
    });
}

export function testSheetsConnection(ctx) {
    return sendSheetsRequest(ctx, 'ping', null);
}

export function createSheets(ctx) {
    return {
        syncEventToSheets: function (event) {
            return syncEventToSheets(ctx, event);
        },
        retryFailedSyncs: function () {
            return retryFailedSyncs(ctx);
        },
        testSheetsConnection: function () {
            return testSheetsConnection(ctx);
        },
        buildSheetsPayload: function (event) {
            return buildSheetsPayload(event, ctx.getSettings());
        },
        canSyncToSheets: function () {
            return canSyncToSheets(ctx.getSettings());
        }
    };
}
