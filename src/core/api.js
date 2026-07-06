import { VERSION, DEBUG_KEY } from './constants.js';
import { getPageWindow, writeJson } from './storage.js';
import { createSession, localDateKey } from './events.js';
import { sanitizeProject } from './project-model.js';
import { deepClone, redactUrl, maybeRedactDebugString } from '../lib/utils.js';

export function createApi(ctx) {
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

    function createDebugReport() {
        return {
            version: VERSION,
            service: ctx.getActiveAdapter().id,
            serviceName: ctx.getActiveAdapter().name,
            page: redactUrl(window.location.href),
            capturedAt: new Date().toISOString(),
            balance: ctx.runtime.balance,
            balanceSource: ctx.runtime.balanceSource,
            balancePath: ctx.runtime.balancePath,
            lastBalanceAt: ctx.runtime.lastBalanceAt,
            sessionTotal: ctx.getSession().total || 0,
            todayTotal: ctx.getTodayTotal(),
            project: ctx.runtime.project,
            history: ctx.getHistory().slice(0, 10),
            pending: ctx.runtime.pending.slice(-10).map(function (pending) {
                return Object.assign({}, pending);
            }),
            diagnostics: summarizeDiagnostics(ctx.runtime.diagnostics)
        };
    }

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
            diagnostics: ctx.runtime.diagnostics.slice(-80),
            debug: ctx.runtime.debug
        });
    }

    function resetSession() {
        ctx.setSession(createSession());
        ctx.saveSession();
        ctx.renderSoon();
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
                ctx.addDiagnostic('debug report copied');
                return report;
            });
        }
        return report;
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

    function setDebug(enabled) {
        ctx.runtime.debug = Boolean(enabled);
        writeJson(DEBUG_KEY, ctx.runtime.debug);
        ctx.renderSoon();
        ctx.addDiagnostic('debug', ctx.runtime.debug ? 'enabled' : 'disabled');
        if (ctx.runtime.debug) {
            console.info('[AI Token Tracker] Debug is collecting a compact report. Use window.AITokenTracker.copyDebugReport() or the Copy report button.');
        }
        return ctx.runtime.debug;
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

    function exposeApi() {
        const api = {
            version: VERSION,
            getState,
            resetSession,
            exportJSON,
            setDebug,
            clearHistory,
            forgetBalance,
            resetAll,
            setProject: ctx.setProject,
            clearProject: ctx.clearProject,
            listProjects: ctx.listProjects,
            addProject: ctx.addProject,
            updateProject: ctx.updateProject,
            deleteProject: ctx.deleteProject,
            selectProject: ctx.selectProject,
            getDebugReport,
            copyDebugReport
        };
        const pageWindow = getPageWindow();
        pageWindow.AITokenTracker = api;
        pageWindow.KlingTokenTracker = api;
    }

    return {
        exposeApi,
        getState,
        resetSession,
        exportJSON,
        getDebugReport,
        copyDebugReport,
        createDebugReport,
        clearHistory,
        forgetBalance,
        resetAll,
        setDebug,
        downloadExport
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
