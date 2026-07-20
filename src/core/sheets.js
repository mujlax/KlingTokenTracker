import {
    VERSION,
    SHEETS_SYNC_DELAY_MS,
    SHEETS_PULL_INTERVAL_MS,
    SHEETS_SYNC_KEY,
    PROJECTS_SYNC_KEY,
    SETTINGS_KEY,
    MAX_EVENTS
} from './constants.js';
import { readJson, writeJson, mergeEventHistories } from './storage.js';
import { sanitizeEvents, localDateKey } from './events.js';
import { sanitizeProject, sanitizeProjectEntry, sanitizeProjectLibrary } from './project-model.js';
import { projectsAreEquivalent } from './project-search.js';
import { ADAPTERS } from '../adapters/registry.js';

const SHEETS_POST_HEADERS = { 'Content-Type': 'text/plain;charset=utf-8' };

function serviceNameForId(service) {
    const id = String(service || '');
    for (let i = 0; i < ADAPTERS.length; i += 1) {
        if (ADAPTERS[i] && ADAPTERS[i].id === id) return ADAPTERS[i].name;
    }
    if (!id) return '';
    return id.charAt(0).toUpperCase() + id.slice(1);
}

export function convertRemoteRowToEvent(row, knownProjectIds) {
    if (!row || !row.eventId) return null;
    const parsedTs = row.syncedAt ? Date.parse(row.syncedAt) : NaN;
    const ts = Number.isFinite(parsedTs) ? parsedTs : Date.now();
    return {
        id: String(row.eventId),
        ts: ts,
        localDate: localDateKey(ts),
        amount: Number(row.amount || 0),
        before: 0,
        after: 0,
        source: 'remote',
        service: String(row.service || ''),
        serviceName: serviceNameForId(row.service),
        taskId: null,
        url: '',
        method: '',
        path: '',
        score: null,
        pendingId: null,
        detail: '',
        metadata: {},
        project: {
            id: knownProjectIds && knownProjectIds[String(row.projectId || '')]
                ? String(row.projectId || '')
                : '',
            name: String(row.projectName || ''),
            url: ''
        },
        estimated: false,
        user: String(row.user || ''),
        remote: true
    };
}

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
        amount: event.amount,
        service: String(event.service || ''),
        projectId: String(project.id || ''),
        projectName: projectName,
        user: String(settings.sheetsNickname || '').trim(),
        trackerVersion: VERSION
    };
}

export function buildEventProjectPayload(event) {
    const project = event && event.project || {};
    return {
        eventId: String(event && event.id || ''),
        projectId: String(project.id || ''),
        projectName: String(project.name || '').trim()
    };
}

export function buildProjectPayload(project, settings) {
    const entry = sanitizeProjectEntry(project || {});
    const createdAt = Number.isFinite(entry.createdAt) ? entry.createdAt : Date.now();
    return {
        projectId: entry.id,
        name: entry.name,
        url: entry.url,
        status: entry.status,
        createdAt: new Date(createdAt).toISOString(),
        updatedBy: String(settings && settings.sheetsNickname || '').trim(),
        trackerVersion: VERSION
    };
}

export function convertRemoteRowToProject(row) {
    if (!row || !row.projectId || !row.name) return null;
    const createdAt = Date.parse(row.createdAt || '');
    const updatedAt = Date.parse(row.updatedAt || '');
    return sanitizeProjectEntry({
        id: String(row.projectId),
        name: String(row.name),
        url: String(row.url || ''),
        status: row.status === 'archived' ? 'archived' : 'active',
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
        updatedBy: String(row.updatedBy || '')
    });
}

export function loadProjectSyncState() {
    const raw = readJson(PROJECTS_SYNC_KEY, {});
    const pending = raw && raw.pending && typeof raw.pending === 'object' && !Array.isArray(raw.pending)
        ? raw.pending
        : {};
    return {
        initialized: raw && raw.initialized === true,
        pending: Object.assign({}, pending)
    };
}

export function saveProjectSyncState(state) {
    writeJson(PROJECTS_SYNC_KEY, {
        initialized: state && state.initialized === true,
        pending: Object.assign({}, state && state.pending || {})
    });
}

export function mergeProjectCatalogs(localProjects, remoteProjects, syncState) {
    const local = sanitizeProjectLibrary(localProjects);
    const remote = sanitizeProjectLibrary(remoteProjects);
    const state = syncState || { initialized: false, pending: {} };
    const initialMerge = state.initialized !== true;
    const pending = Object.assign({}, state.pending || {});
    const remoteById = {};
    const usedRemote = {};
    const result = [];
    const idMap = {};

    remote.forEach(function (entry) {
        remoteById[entry.id] = entry;
    });

    local.forEach(function (entry) {
        const sameId = remoteById[entry.id];
        if (sameId) {
            usedRemote[sameId.id] = true;
            result.push(pending[entry.id] ? entry : sameId);
            return;
        }

        let equivalent = null;
        if (initialMerge) {
            equivalent = remote.find(function (candidate) {
                return !usedRemote[candidate.id] && projectsAreEquivalent(entry, candidate);
            }) || null;
        }
        if (equivalent) {
            usedRemote[equivalent.id] = true;
            idMap[entry.id] = equivalent.id;
            delete pending[entry.id];
            result.push(equivalent);
            return;
        }

        if (initialMerge || pending[entry.id]) {
            result.push(entry);
            if (!pending[entry.id]) {
                pending[entry.id] = entry.status === 'archived' ? 'archive' : 'upsert';
            }
        }
    });

    remote.forEach(function (entry) {
        if (!usedRemote[entry.id]) result.push(entry);
    });

    return {
        projects: sanitizeProjectLibrary(result),
        idMap: idMap,
        state: {
            initialized: true,
            pending: pending
        }
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

export function clearSyncState(eventId) {
    if (!eventId) return;
    const state = loadSyncState();
    delete state[String(eventId)];
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
                    reject(error || new Error('сетевая ошибка'));
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
    if (parsed.status === 401 || (data && data.error === 'unauthorized')) return 'нет доступа — проверьте секретный токен';
    if (
        parsed.status === 404 ||
        /Страница не найдена|не удалось открыть файл|Page Not Found/i.test(body)
    ) {
        return 'веб-приложение 404 — переразверните Apps Script (Execute as Me, Anyone access)';
    }
    if (parsed.status === 405) {
        return 'метод не разрешён — переразверните веб-приложение';
    }
    if (!data && body && body.charAt(0) === '<') {
        return 'некорректный ответ веб-приложения — проверьте URL /exec и развёртывание';
    }
    if (parsed.status) return 'ошибка синхронизации (' + parsed.status + ')';
    return 'ошибка синхронизации';
}

export function sendSheetsRequest(ctx, action, payload) {
    const settings = ctx.getSettings();
    if (!canSyncToSheets(settings) && action !== 'ping') {
        return Promise.reject(new Error('sheets не настроен'));
    }
    if (action === 'ping' && !sanitizeSheetsWebAppUrl(settings.sheetsWebAppUrl)) {
        return Promise.reject(new Error('некорректный URL веб-приложения — используйте .../macros/s/.../exec'));
    }
    if (action === 'ping' && !String(settings.sheetsSecretToken || '').trim()) {
        return Promise.reject(new Error('отсутствует секретный токен'));
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
        const message = error && error.message ? error.message : 'сетевая ошибка';
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

export function updateEventProjectInSheets(ctx, event) {
    if (!event || !event.id) return Promise.resolve(null);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    return sendSheetsRequest(ctx, 'updateEventProject', buildEventProjectPayload(event)).then(function (data) {
        if (data && data.updated === false) return data;
        markSyncState(event.id, 'synced');
        ctx.addDiagnostic('sheets event project update ok', event.id);
        return data || { ok: true, updated: true };
    }).catch(function (error) {
        markSyncState(event.id, 'projectUpdateFailed');
        ctx.addDiagnostic('sheets event project update failed', event.id, error && error.message);
        return null;
    });
}

export function resumeEventSyncAfterUndo(ctx, event, delayMs) {
    if (!event || !event.id) return Promise.resolve(null);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (getSyncState(event.id) !== 'synced') {
        scheduleEventSyncToSheets(ctx, event, delayMs);
        return Promise.resolve({ scheduled: true });
    }
    return updateEventProjectInSheets(ctx, event).then(function (data) {
        if (data && data.updated === false) {
            clearSyncState(event.id);
            scheduleEventSyncToSheets(ctx, event, delayMs);
            return { scheduled: true, missingRemote: true };
        }
        return data;
    });
}

export function scheduleEventSyncToSheets(ctx, event, delayMs) {
    if (!event || !event.id) return null;
    if (!canSyncToSheets(ctx.getSettings())) return null;

    const eventId = event.id;
    const current = getSyncState(eventId);
    if (current === 'synced') return null;

    ctx.runtime.sheetsSyncTimers = ctx.runtime.sheetsSyncTimers || {};
    if (ctx.runtime.sheetsSyncTimers[eventId]) {
        window.clearTimeout(ctx.runtime.sheetsSyncTimers[eventId]);
    }

    markSyncState(eventId, 'pending');
    const delay = Number(delayMs);
    ctx.runtime.sheetsSyncTimers[eventId] = window.setTimeout(function () {
        delete ctx.runtime.sheetsSyncTimers[eventId];
        const currentEvent = ctx.getHistory().find(function (item) {
            return item && item.id === eventId;
        });
        if (!currentEvent) {
            clearSyncState(eventId);
            ctx.addDiagnostic('sheets sync canceled before append', eventId);
            return;
        }
        syncEventToSheets(ctx, currentEvent);
    }, Number.isFinite(delay) && delay >= 0 ? delay : SHEETS_SYNC_DELAY_MS);

    ctx.addDiagnostic('sheets sync scheduled', eventId);
    return event;
}

export function cancelEventSyncToSheets(ctx, eventId) {
    if (!eventId) return;
    ctx.runtime.sheetsSyncTimers = ctx.runtime.sheetsSyncTimers || {};
    if (ctx.runtime.sheetsSyncTimers[eventId]) {
        window.clearTimeout(ctx.runtime.sheetsSyncTimers[eventId]);
        delete ctx.runtime.sheetsSyncTimers[eventId];
    }
    if (getSyncState(eventId) === 'pending') {
        clearSyncState(eventId);
    }
}

export function deleteEventFromSheets(ctx, event) {
    if (!event || !event.id) return Promise.resolve(null);
    cancelEventSyncToSheets(ctx, event.id);
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (getSyncState(event.id) !== 'synced') {
        clearSyncState(event.id);
        return Promise.resolve(null);
    }

    return sendSheetsRequest(ctx, 'deleteEvent', { eventId: event.id }).then(function () {
        markSyncState(event.id, 'deleted');
        ctx.addDiagnostic('sheets delete ok', event.id);
        return event;
    }).catch(function (error) {
        markSyncState(event.id, 'deleteFailed');
        ctx.addDiagnostic('sheets delete failed', event.id, error && error.message);
        return null;
    });
}

export function retryFailedSyncs(ctx) {
    if (!canSyncToSheets(ctx.getSettings())) {
        return Promise.resolve({ retried: 0, synced: 0 });
    }

    const history = ctx.getHistory();
    const failed = history.filter(function (event) {
        const status = event && getSyncState(event.id);
        return status === 'failed' || status === 'projectUpdateFailed';
    });

    let synced = 0;
    let chain = Promise.resolve();
    failed.forEach(function (event) {
        chain = chain.then(function () {
            const retry = getSyncState(event.id) === 'projectUpdateFailed'
                ? updateEventProjectInSheets(ctx, event)
                : syncEventToSheets(ctx, event);
            return retry.then(function (result) {
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

function setPendingProjectOperation(projectId, operation) {
    const id = String(projectId || '');
    if (!id) return;
    const state = loadProjectSyncState();
    state.pending[id] = operation;
    saveProjectSyncState(state);
}

function clearPendingProjectOperation(projectId) {
    const id = String(projectId || '');
    if (!id) return;
    const state = loadProjectSyncState();
    delete state.pending[id];
    saveProjectSyncState(state);
}

export function queueProjectUpsert(ctx, project) {
    if (!project || !project.id) return null;
    setPendingProjectOperation(project.id, 'upsert');
    if (canSyncToSheets(ctx.getSettings())) {
        const state = loadProjectSyncState();
        const sync = state.initialized ? flushPendingProjectSyncs(ctx) : syncProjectsFromSheets(ctx);
        sync.catch(function () {});
    }
    return project;
}

export function queueProjectArchive(ctx, project) {
    if (!project || !project.id) return null;
    setPendingProjectOperation(project.id, 'archive');
    if (canSyncToSheets(ctx.getSettings())) {
        const state = loadProjectSyncState();
        const sync = state.initialized ? flushPendingProjectSyncs(ctx) : syncProjectsFromSheets(ctx);
        sync.catch(function () {});
    }
    return project;
}

export function flushPendingProjectSyncs(ctx) {
    if (!canSyncToSheets(ctx.getSettings())) {
        return Promise.resolve({ retried: 0, synced: 0 });
    }
    if (ctx.runtime.projectsFlushPromise) return ctx.runtime.projectsFlushPromise;

    const initialState = loadProjectSyncState();
    const ids = Object.keys(initialState.pending);
    let synced = 0;
    let chain = Promise.resolve();

    ids.forEach(function (id) {
        chain = chain.then(function () {
            const state = loadProjectSyncState();
            const operation = state.pending[id];
            const entry = typeof ctx.findProjectRecordById === 'function'
                ? ctx.findProjectRecordById(id)
                : null;
            if (!operation || !entry) {
                clearPendingProjectOperation(id);
                return null;
            }
            const action = operation === 'archive' ? 'archiveProject' : 'upsertProject';
            return sendSheetsRequest(ctx, action, buildProjectPayload(entry, ctx.getSettings())).then(function (data) {
                const canonical = convertRemoteRowToProject(data && data.project);
                if (canonical && typeof ctx.replaceProjectEntry === 'function') {
                    ctx.replaceProjectEntry(canonical);
                }
                clearPendingProjectOperation(id);
                synced += 1;
                ctx.addDiagnostic('project sync ok', id, action);
                return canonical;
            }).catch(function (error) {
                ctx.addDiagnostic('project sync failed', id, error && error.message);
                return null;
            });
        });
    });

    ctx.runtime.projectsFlushPromise = chain.then(function () {
        return { retried: ids.length, synced: synced };
    }).finally(function () {
        ctx.runtime.projectsFlushPromise = null;
    });
    return ctx.runtime.projectsFlushPromise;
}

function applyProjectCatalog(ctx, merged) {
    const library = sanitizeProjectLibrary(merged.projects);
    ctx.setProjectLibrary(library);
    ctx.saveProjectLibrary();
    if (typeof ctx.reconcileProjectIds === 'function') {
        ctx.reconcileProjectIds(merged.idMap);
    }

    const active = sanitizeProject(ctx.runtime.project || {});
    if (active.id) {
        const canonical = library.find(function (entry) {
            return entry.id === active.id;
        });
        if (!canonical || canonical.status === 'archived') {
            ctx.runtime.project = sanitizeProject({});
            ctx.runtime.projectFilterEnabled = false;
        } else {
            ctx.runtime.project = sanitizeProject(canonical);
        }
        if (typeof ctx.syncProjectDraftFromActive === 'function') ctx.syncProjectDraftFromActive();
        ctx.saveProject();
        ctx.saveUiState();
    }
    if (typeof ctx.renderSoon === 'function') ctx.renderSoon();
}

export function syncProjectsFromSheets(ctx) {
    if (!canSyncToSheets(ctx.getSettings())) return Promise.resolve(null);
    if (ctx.runtime.projectsSyncPromise) return ctx.runtime.projectsSyncPromise;

    ctx.runtime.projectsSyncPromise = sendSheetsRequest(ctx, 'listProjects', null).then(function (data) {
        if (!data || data.ok !== true || !Array.isArray(data.projects)) {
            throw new Error('invalid projects response');
        }
        const remote = data.projects.map(convertRemoteRowToProject).filter(Boolean);
        const merged = mergeProjectCatalogs(
            ctx.getProjectLibrary(),
            remote,
            loadProjectSyncState()
        );
        saveProjectSyncState(merged.state);
        applyProjectCatalog(ctx, merged);
        return flushPendingProjectSyncs(ctx).then(function (result) {
            ctx.addDiagnostic('projects pull ok', remote.length);
            return {
                pulled: remote.length,
                pushed: result.synced,
                mergedIds: Object.keys(merged.idMap).length
            };
        });
    }).catch(function (error) {
        ctx.addDiagnostic('projects pull failed', error && error.message);
        throw error;
    }).finally(function () {
        ctx.runtime.projectsSyncPromise = null;
    });
    return ctx.runtime.projectsSyncPromise;
}

export function pullEventsFromSheets(ctx) {
    const settings = ctx.getSettings();
    if (!canSyncToSheets(settings)) return Promise.resolve(null);

    return postJsonToSheets(settings, { action: 'listEvents', payload: null }).then(function (response) {
        const parsed = parseSheetsResponse(response);
        const data = parsed.data;
        if (!data || data.ok !== true || !Array.isArray(data.events)) {
            const message = getSheetsErrorMessage(parsed);
            updateSheetsStatus(ctx, { sheetsLastError: message });
            throw new Error(message);
        }

        const knownProjectIds = {};
        ctx.getProjectLibrary().forEach(function (project) {
            if (project && project.id) knownProjectIds[project.id] = true;
        });
        const remoteEvents = data.events
            .map(function (row) {
                return convertRemoteRowToEvent(row, knownProjectIds);
            })
            .filter(function (event) {
                return event && event.id;
            });
        const remoteIds = {};
        remoteEvents.forEach(function (event) {
            remoteIds[event.id] = true;
        });

        const localOnly = ctx.getHistory().filter(function (event) {
            if (!event || !event.id) return false;
            if (remoteIds[event.id]) return false;
            return getSyncState(event.id) !== 'synced';
        });

        const merged = mergeEventHistories(remoteEvents, localOnly, MAX_EVENTS);
        ctx.setHistory(sanitizeEvents(merged));
        ctx.saveHistory();

        remoteEvents.forEach(function (event) {
            markSyncState(event.id, 'synced');
        });

        updateSheetsStatus(ctx, {
            sheetsLastSyncAt: Date.now(),
            sheetsLastError: ''
        });
        ctx.addDiagnostic('sheets pull ok', remoteEvents.length);
        if (typeof ctx.renderSoon === 'function') ctx.renderSoon();
        return { pulled: remoteEvents.length };
    }).catch(function (error) {
        const message = error && error.message ? error.message : 'сетевая ошибка';
        updateSheetsStatus(ctx, { sheetsLastError: message });
        ctx.addDiagnostic('sheets pull failed', message);
        throw error;
    });
}

export function startSheetsAutoPull(ctx) {
    if (ctx.runtime.sheetsPullTimer) {
        window.clearInterval(ctx.runtime.sheetsPullTimer);
        ctx.runtime.sheetsPullTimer = null;
    }

    function runPull() {
        if (!canSyncToSheets(ctx.getSettings())) return;
        Promise.all([
            pullEventsFromSheets(ctx),
            syncProjectsFromSheets(ctx)
        ]).catch(function () {});
    }

    runPull();
    ctx.runtime.sheetsPullTimer = window.setInterval(runPull, SHEETS_PULL_INTERVAL_MS);
    return ctx.runtime.sheetsPullTimer;
}

export function createSheets(ctx) {
    return {
        syncEventToSheets: function (event) {
            return syncEventToSheets(ctx, event);
        },
        scheduleEventSyncToSheets: function (event, delayMs) {
            return scheduleEventSyncToSheets(ctx, event, delayMs);
        },
        cancelEventSyncToSheets: function (eventId) {
            return cancelEventSyncToSheets(ctx, eventId);
        },
        resumeEventSyncAfterUndo: function (event, delayMs) {
            return resumeEventSyncAfterUndo(ctx, event, delayMs);
        },
        updateEventProjectInSheets: function (event) {
            return updateEventProjectInSheets(ctx, event);
        },
        deleteEventFromSheets: function (event) {
            return deleteEventFromSheets(ctx, event);
        },
        retryFailedSyncs: function () {
            return retryFailedSyncs(ctx);
        },
        retryProjectSyncs: function () {
            return flushPendingProjectSyncs(ctx);
        },
        testSheetsConnection: function () {
            return testSheetsConnection(ctx);
        },
        pullEventsFromSheets: function () {
            return pullEventsFromSheets(ctx);
        },
        syncProjectsFromSheets: function () {
            return syncProjectsFromSheets(ctx);
        },
        refreshSheetsData: function () {
            return Promise.all([
                pullEventsFromSheets(ctx),
                syncProjectsFromSheets(ctx)
            ]);
        },
        queueProjectUpsert: function (project) {
            return queueProjectUpsert(ctx, project);
        },
        queueProjectArchive: function (project) {
            return queueProjectArchive(ctx, project);
        },
        startSheetsAutoPull: function () {
            return startSheetsAutoPull(ctx);
        },
        buildSheetsPayload: function (event) {
            return buildSheetsPayload(event, ctx.getSettings());
        },
        canSyncToSheets: function () {
            return canSyncToSheets(ctx.getSettings());
        }
    };
}
