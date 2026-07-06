import {
    VERSION,
    HISTORY_KEY,
    SESSION_KEY,
    META_KEY,
    DEBUG_KEY,
    UI_KEY,
    PROJECT_KEY,
    PROJECTS_LIBRARY_KEY
} from './constants.js';
import { initAdapters, getActiveAdapter } from '../adapters/registry.js';
import { extractBalanceFromPayload } from '../lib/balance-parse.js';
import { readJson, writeJson, loadSharedHistory } from './storage.js';
import {
    findDuplicateSpend,
    sanitizeEvents,
    sanitizeSession,
    createSession,
    addEventToSession,
    createEventId,
    mergeSources,
    localDateKey
} from './events.js';
import { sanitizeMetadata, sanitizeProject, sanitizeProjectLibrary } from './project-model.js';
import { redactUrl } from '../lib/utils.js';
import { isFiniteCredit, normalizeCredit } from '../lib/credits.js';
import { createProjects } from './projects.js';
import { createBalance } from './balance.js';
import { createNetwork } from './network.js';
import { createApi, formatDebugArg } from './api.js';
import { createPanelModule, sanitizeUiState, saveUiState as persistUiState } from '../ui/panel.js';
import { createRender } from '../ui/render.js';
import {
    DEFAULT_SETTINGS,
    loadSettings,
    saveSettings,
    sanitizeSettings,
    applyPanelSettings,
    needsSheetsNickname
} from './settings.js';
import { createSheets } from './sheets.js';

function sanitizeMeta(value) {
    const balance = isFiniteCredit(Number(value && value.balance)) ? normalizeCredit(Number(value.balance)) : null;
    return {
        balance,
        balanceSource: value && value.balanceSource ? String(value.balanceSource) : 'none',
        balancePath: value && value.balancePath ? String(value.balancePath) : '',
        lastBalanceAt: value && value.lastBalanceAt ? Number(value.lastBalanceAt) : null
    };
}

export function createTracker() {
    const initialUiState = sanitizeUiState(readJson(UI_KEY, {}));

    const runtime = {
        balance: null,
        balanceSource: 'none',
        balancePath: '',
        lastBalanceAt: null,
        pending: [],
        sourceSeen: { network: false, ui: false },
        panelHost: null,
        shadowRoot: null,
        panelCollapsed: false,
        panelPersistenceInstalled: false,
        panelPersistenceObserver: null,
        panelReattachTimer: null,
        panelEnsureInterval: null,
        uiObserver: null,
        uiScanTimer: null,
        uiInterval: null,
        renderTimer: null,
        debug: false,
        diagnostics: [],
        lastUiSpend: null,
        activeTab: initialUiState.activeTab,
        projectFilterEnabled: initialUiState.projectFilterEnabled,
        project: sanitizeProject(readJson(PROJECT_KEY, {})),
        projectDraft: { name: '', url: '' },
        projectEditorOpen: false,
        settings: loadSettings(),
        sheetsNicknameNotified: false
    };

    let history = sanitizeEvents(loadSharedHistory([]));
    let session = sanitizeSession(readJson(SESSION_KEY, null)) || createSession();
    let meta = sanitizeMeta(readJson(META_KEY, {}));
    let projectLibrary = sanitizeProjectLibrary(readJson(PROJECTS_LIBRARY_KEY, []));

    runtime.debug = readJson(DEBUG_KEY, false) === true;
    runtime.balance = meta.balance;
    runtime.balanceSource = meta.balanceSource || 'none';
    runtime.balancePath = meta.balancePath || '';
    runtime.lastBalanceAt = meta.lastBalanceAt || null;

    const ctx = {
        runtime,
        getHistory: () => history,
        setHistory: (v) => { history = v; },
        getSession: () => session,
        setSession: (v) => { session = v; },
        getMeta: () => meta,
        setMeta: (v) => { meta = v; },
        getProjectLibrary: () => projectLibrary,
        setProjectLibrary: (v) => { projectLibrary = v; },
        getActiveAdapter,
        localDateKey
    };

    ctx.saveHistory = function () {
        writeJson(HISTORY_KEY, history);
    };

    ctx.saveSession = function () {
        writeJson(SESSION_KEY, session);
    };

    ctx.saveMeta = function () {
        writeJson(META_KEY, meta);
    };

    ctx.saveProject = function () {
        writeJson(PROJECT_KEY, runtime.project);
    };

    ctx.saveProjectLibrary = function () {
        writeJson(PROJECTS_LIBRARY_KEY, projectLibrary);
    };

    ctx.saveUiState = function () {
        persistUiState(ctx);
    };

    ctx.getSettings = function () {
        return runtime.settings;
    };

    ctx.updateSetting = function (key, value) {
        const next = sanitizeSettings(Object.assign({}, runtime.settings, { [key]: value }));
        runtime.settings = next;
        saveSettings(ctx);
        applyPanelSettings(ctx);
        ctx.renderSoon();
    };

    ctx.resetSettings = function () {
        if (typeof window !== 'undefined' && !window.confirm('Reset all settings to defaults?')) return;
        runtime.settings = sanitizeSettings(DEFAULT_SETTINGS);
        saveSettings(ctx);
        applyPanelSettings(ctx);
        ctx.renderSoon();
    };

    ctx.notifyMissingSheetsNickname = function () {
        if (runtime.sheetsNicknameNotified) return;
        if (!needsSheetsNickname(runtime.settings)) return;
        runtime.sheetsNicknameNotified = true;
        ctx.addDiagnostic('sheets nickname required — open Settings → Google Sheets');
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
            window.alert('AI Token Tracker: укажите nickname в Settings → Google Sheets, чтобы синк работал с вашим именем.');
        }
        ctx.renderSoon();
    };

    ctx.addDiagnostic = function () {
        const args = Array.prototype.slice.call(arguments);
        runtime.diagnostics.push({
            ts: Date.now(),
            args: args.map(formatDebugArg)
        });
        runtime.diagnostics = runtime.diagnostics.slice(-120);
    };

    ctx.recordSpend = function (input, now) {
        if (!input || !isFiniteCredit(input.amount) || input.amount <= 0) return null;

        const duplicate = findDuplicateSpend(history, input, now);
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
            ctx.saveHistory();
            ctx.renderSoon();
            ctx.addDiagnostic('merged duplicate spend', duplicate);
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
            service: input.service || getActiveAdapter().id,
            serviceName: input.serviceName || getActiveAdapter().name,
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
        session = addEventToSession(session, event);
        ctx.saveHistory();
        ctx.saveSession();
        ctx.addDiagnostic('recorded spend', event);
        if (runtime.settings.sheetsEnabled) {
            ctx.syncEventToSheets(event);
            ctx.retryFailedSyncs();
        }
        return event;
    };

    Object.assign(ctx, createProjects(ctx));

    const render = createRender(ctx);
    Object.assign(ctx, render);

    Object.assign(ctx, createSheets(ctx));

    const balance = createBalance(ctx);
    Object.assign(ctx, balance);

    const api = createApi(ctx);
    Object.assign(ctx, api);

    const network = createNetwork(ctx);
    const panel = createPanelModule(ctx);
    ctx.bootWhenBodyExists = panel.bootWhenBodyExists;

    initAdapters({
        addDiagnostic: ctx.addDiagnostic,
        getPanelHost: function () { return runtime.panelHost; },
        extractBalanceFromPayload,
        looksRelevantForDebug: network.looksRelevantForDebug
    });

    ctx.migrateProjectLibrary();
    ctx.exposeApi();
    network.patchFetch();
    network.patchXMLHttpRequest();
    panel.bootWhenBodyExists();

    return {
        version: VERSION,
        getState: ctx.getState,
        runtime
    };
}
