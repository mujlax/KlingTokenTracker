import { VERSION } from './constants.js';
import { getPageWindow } from './storage.js';
import { createSession } from './events.js';
import { sanitizeProject } from './project-model.js';
import { deepClone, maybeRedactDebugString } from '../lib/utils.js';

export function createApi(ctx) {
    function getState() {
        return deepClone({
            version: VERSION,
            service: ctx.getActiveAdapter().id,
            serviceName: ctx.getActiveAdapter().name,
            balance: ctx.runtime.balance,
            balanceSource: ctx.runtime.balanceSource,
            balancePath: ctx.runtime.balancePath,
            lastBalanceAt: ctx.runtime.lastBalanceAt,
            session: ctx.getSession(),
            project: ctx.runtime.project,
            projects: ctx.listProjects(),
            projectFilterEnabled: ctx.runtime.projectFilterEnabled === true,
            projectAllTimeTotal: ctx.hasActiveProject() ? ctx.getProjectAllTimeTotal(ctx.getActiveProject()) : 0,
            history: ctx.getHistory(),
            pending: ctx.runtime.pending.map(function (item) {
                return Object.assign({}, item);
            }),
            diagnostics: ctx.runtime.diagnostics.slice(-80)
        });
    }

    function resetSession() {
        ctx.setSession(createSession());
        ctx.saveSession();
        ctx.renderSoon();
        return getState();
    }

    function clearHistory() {
        ctx.setHistory([]);
        ctx.setSession(createSession());
        ctx.saveHistory();
        ctx.saveSession();
        ctx.renderSoon();
        return getState();
    }

    function forgetBalance() {
        ctx.runtime.balance = null;
        ctx.runtime.balanceSource = 'none';
        ctx.runtime.balancePath = '';
        ctx.runtime.lastBalanceAt = null;
        ctx.setMeta({
            balance: null,
            balanceSource: 'none',
            balancePath: '',
            lastBalanceAt: null
        });
        ctx.saveMeta();
        ctx.renderSoon();
        return getState();
    }

    function resetAll() {
        ctx.setHistory([]);
        ctx.setSession(createSession());
        ctx.runtime.pending = [];
        ctx.runtime.diagnostics = [];
        ctx.runtime.sourceSeen = { network: false, ui: false };
        ctx.runtime.project = sanitizeProject({});
        ctx.setProjectLibrary([]);
        ctx.runtime.projectDraft = { name: '', url: '' };
        ctx.runtime.projectEditorOpen = false;
        ctx.runtime.projectSearchOpen = false;
        ctx.runtime.projectSearchQuery = '';
        ctx.runtime.projectFilterEnabled = false;
        ctx.runtime.balance = null;
        ctx.runtime.balanceSource = 'none';
        ctx.runtime.balancePath = '';
        ctx.runtime.lastBalanceAt = null;
        ctx.setMeta({
            balance: null,
            balanceSource: 'none',
            balancePath: '',
            lastBalanceAt: null
        });
        ctx.saveHistory();
        ctx.saveSession();
        ctx.saveMeta();
        ctx.saveProjectLibrary();
        ctx.saveProject();
        ctx.saveUiState();
        ctx.renderSoon();
        return getState();
    }

    function exposeApi() {
        const api = {
            version: VERSION,
            getState,
            resetSession,
            clearHistory,
            forgetBalance,
            resetAll,
            deleteSpendEvent: ctx.deleteSpendEvent,
            undoLastSpend: ctx.undoLastSpend,
            setProject: ctx.setProject,
            clearProject: ctx.clearProject,
            listProjects: ctx.listProjects,
            addProject: ctx.addProject,
            updateProject: ctx.updateProject,
            deleteProject: ctx.deleteProject,
            selectProject: ctx.selectProject,
            syncProjectsFromSheets: ctx.syncProjectsFromSheets
        };
        const pageWindow = getPageWindow();
        pageWindow.AITokenTracker = api;
        pageWindow.KlingTokenTracker = api;
    }

    return {
        exposeApi,
        getState,
        resetSession,
        clearHistory,
        forgetBalance,
        resetAll,
        deleteSpendEvent: ctx.deleteSpendEvent,
        undoLastSpend: ctx.undoLastSpend
    };
}

export function formatDebugArg(value) {
    if (value == null) return value;
    if (typeof value === 'string') return maybeRedactDebugString(value);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (_) {
        return String(value);
    }
}
