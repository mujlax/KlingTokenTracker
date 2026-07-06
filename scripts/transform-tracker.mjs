import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
let body = readFileSync(join(root, 'src/core/_monolith-body.js'), 'utf8');

// Remove duplicate constants block (lines 1-18)
body = body.replace(/^const VERSION[\s\S]*?const MIN_UI_SCORE = 14;\n\n/, '');

// Remove top-level boot sequence - moved to createTracker return
body = body.replace(/^const initialUiState[\s\S]*?bootWhenBodyExists\(\);\n\n/, '');

// Remove inline adapter definitions
body = body.replace(/function createKlingAdapter\(\) \{[\s\S]*?\n\}\n\n/, '');
body = body.replace(/function getActiveAdapter\(\) \{[\s\S]*?\n\}\n\n/, '');

// Branding updates
body = body.replace(/Kling Token Tracker/g, 'AI Token Tracker');
body = body.replace(
    "'    <div class=\"badge\" data-field=\"source\">none</div>',",
    "'    <div class=\"badge\" data-field=\"serviceName\">none</div>',"
);

// networkEnabled gate in handlePayload
body = body.replace(
    'function handlePayload(payload, context) {\n        const taskId = extractTaskId(payload);',
    `function handlePayload(payload, context) {
        const activeAdapter = getActiveAdapter();
        if (!activeAdapter.networkEnabled) return;
        const taskId = extractTaskId(payload);`
);

// Fix handlePayload to use local activeAdapter (remove duplicate if extractBalance line uses activeAdapter - it already does)

// scanUiBalance gate
body = body.replace(
    'function scanUiBalance() {\n        runtime.uiScanTimer = null;\n        if (!document.body) return;',
    `function scanUiBalance() {
        runtime.uiScanTimer = null;
        if (!document.body) return;
        const activeAdapter = getActiveAdapter();
        if (!activeAdapter.networkEnabled) return;`
);

// recordUiGenerateClick - use parsed.estimated; skip when no amount
body = body.replace(
    `function recordUiGenerateClick(parsed, clickable) {
    const amount = parsed && parsed.amount;
    if (!isFiniteCredit(amount) || amount <= 0) {
        addDiagnostic('ui generate click without cost', parsed && parsed.detail);
        return null;
    }`,
    `function recordUiGenerateClick(parsed, clickable) {
    const amount = parsed && parsed.amount;
    if (!isFiniteCredit(amount) || amount <= 0) {
        addDiagnostic('ui generate click without cost', parsed && parsed.detail);
        return null;
    }`
);

body = body.replace(
    "estimated: true\n        }, now);",
    "estimated: parsed.estimated !== false\n        }, now);"
);

// exposeApi - AITokenTracker + alias
body = body.replace(
    `function exposeApi() {
    window.KlingTokenTracker = {`,
    `function exposeApi() {
    const api = {`
);
body = body.replace(
    /        copyDebugReport\n    \};\n\}/,
    `        copyDebugReport
    };
    window.AITokenTracker = api;
    window.KlingTokenTracker = api;
}`
);

// setDebug console message
body = body.replace(
    'window.KlingTokenTracker.copyDebugReport()',
    'window.AITokenTracker.copyDebugReport()'
);

// renderPanel badge - show service name
body = body.replace(
    "setText(root, 'source', source);",
    `setText(root, 'serviceName', activeAdapter.name || 'none');
        setText(root, 'source', source);`
);

const header = `import {
    VERSION,
    UI_CLICK_DEDUP_MS,
    STORAGE_PREFIX,
    HISTORY_KEY,
    SESSION_KEY,
    META_KEY,
    DEBUG_KEY,
    PANEL_KEY,
    UI_KEY,
    PROJECT_KEY,
    PROJECTS_LIBRARY_KEY,
    MAX_PROJECTS,
    MAX_EVENTS,
    DUPLICATE_WINDOW_MS,
    UI_SCAN_DEBOUNCE_MS,
    UI_SCAN_INTERVAL_MS,
    MIN_BALANCE_SCORE,
    MIN_UI_SCORE
} from './constants.js';
import { initAdapters, getActiveAdapter } from '../adapters/registry.js';

export function createTracker() {
`;

const footer = `
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
        projectEditorOpen: false
    };

    let history = sanitizeEvents(readJson(HISTORY_KEY, []));
    let session = sanitizeSession(readJson(SESSION_KEY, null)) || createSession();
    let meta = sanitizeMeta(readJson(META_KEY, {}));
    let projectLibrary = sanitizeProjectLibrary(readJson(PROJECTS_LIBRARY_KEY, []));

    runtime.debug = readJson(DEBUG_KEY, false) === true;
    runtime.balance = meta.balance;
    runtime.balanceSource = meta.balanceSource || 'none';
    runtime.balancePath = meta.balancePath || '';
    runtime.lastBalanceAt = meta.lastBalanceAt || null;

    initAdapters({
        addDiagnostic: addDiagnostic,
        getPanelHost: function () { return runtime.panelHost; },
        extractBalanceFromPayload: extractBalanceFromPayload,
        looksRelevantForDebug: looksRelevantForDebug
    });

    migrateProjectLibrary();
    exposeApi();
    patchFetch();
    patchXMLHttpRequest();
    bootWhenBodyExists();

    return {
        version: VERSION,
        getState,
        runtime
    };
}
`;

writeFileSync(join(root, 'src/core/tracker.js'), header + body + footer, 'utf8');
console.log('Wrote src/core/tracker.js');
