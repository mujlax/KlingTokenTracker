import { PANEL_KEY, UI_KEY } from '../core/constants.js';
import { readJson, writeJson } from '../core/storage.js';
import { iconSvg } from './icons.js';
import { clamp } from '../lib/utils.js';
import { applyPanelSettings, applySheetsFieldsFromForm, needsSheetsNickname } from '../core/settings.js';

function sanitizePanel(value, rememberPosition) {
    const result = {
        collapsed: value && value.collapsed === true
    };
    if (rememberPosition) {
        const right = Number(value && value.right);
        const bottom = Number(value && value.bottom);
        if (Number.isFinite(right) && right >= 8) result.right = right;
        if (Number.isFinite(bottom) && bottom >= 8) result.bottom = bottom;
    }
    return result;
}

export function createPanelModule(ctx) {
    function getPanelMount() {
        return document.documentElement || document.body || null;
    }

    function createPanel() {
        const mount = getPanelMount();
        if (!mount) return;
        if (ctx.runtime.panelHost) {
            if (!ctx.runtime.panelHost.isConnected) {
                mount.appendChild(ctx.runtime.panelHost);
            }
            return;
        }

        const savedPanel = sanitizePanel(
            readJson(PANEL_KEY, {}),
            ctx.runtime.settings && ctx.runtime.settings.rememberPanelPosition === true
        );
        ctx.runtime.panelCollapsed = savedPanel.collapsed === true;
        const host = document.createElement('div');
        host.setAttribute('data-ktt-root', '1');
        Object.assign(host.style, {
            position: 'fixed',
            right: (savedPanel.right != null ? savedPanel.right : 16) + 'px',
            bottom: (savedPanel.bottom != null ? savedPanel.bottom : 16) + 'px',
            zIndex: '2147483647',
            font: '13px/1.35 Arial, sans-serif'
        });
        host.style.setProperty('--ktt-idle-opacity', String((ctx.runtime.settings && ctx.runtime.settings.idleOpacity) || 0.2));

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = [
            '<style>',
            ':host{display:block;--ktt-idle-opacity:.2;opacity:var(--ktt-idle-opacity);transition:opacity .2s ease}',
            ':host(:hover){opacity:1}',
            '.panel{width:286px;color:#f6f7f8;background:rgba(18,20,24,.92);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(0,0,0,.26);border-radius:8px;overflow:hidden;font:13px/1.35 Arial,sans-serif;backdrop-filter:blur(8px)}',
            '.panel.collapsed .panelContent{display:none}',
            '.header{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:rgba(255,255,255,.06);user-select:none}',
            '.headerDrag{display:flex;align-items:center;gap:8px;min-width:0;flex:1;cursor:move}',
            '.headerBtn{width:28px;height:28px;flex-shrink:0;cursor:pointer}',
            '.headerBtn svg{width:15px;height:15px}',
            '.title{font-weight:700;letter-spacing:0}',
            '.badge{font-size:11px;border-radius:999px;padding:2px 7px;background:#2d6cdf;color:#fff;text-transform:uppercase}',
            '.body{padding:10px 12px 12px}',
            '.tabs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;padding:8px 10px 0}',
            '.tab{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#bfc6d1;border-radius:6px;padding:6px 8px;font:12px Arial,sans-serif;cursor:pointer}',
            '.tab.active{background:#2d6cdf;border-color:#2d6cdf;color:#fff}',
            '.tabPanel{display:none}',
            '.tabPanel.active{display:block}',
            '.grid{display:grid;grid-template-columns:1fr auto;gap:6px 12px;align-items:baseline}',
            '.label{color:#aeb6c2}',
            '.value{font-weight:700;text-align:right;color:#fff}',
            '.muted{color:#aeb6c2}',
            '.events{margin-top:10px;border-top:1px solid rgba(255,255,255,.12);padding-top:8px;display:flex;flex-direction:column;gap:5px;max-height:138px;overflow:auto}',
            '.event{display:grid;grid-template-columns:auto 1fr auto;gap:6px;align-items:center;color:#d8dde6;font-size:12px}',
            '.history{margin-top:10px;display:flex;flex-direction:column;gap:8px;max-height:320px;overflow:auto}',
            '.histItem{border:1px solid rgba(255,255,255,.12);border-radius:6px;padding:8px;background:rgba(255,255,255,.04)}',
            '.histTop{display:flex;justify-content:space-between;gap:8px;color:#fff;font-weight:700;font-size:12px}',
            '.histMeta{margin-top:5px;color:#bfc6d1;font-size:11px;display:flex;flex-wrap:wrap;gap:5px}',
            '.pill{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 6px;background:rgba(255,255,255,.05)}',
            '.raw{margin-top:5px;color:#8f98a6;font-size:11px;word-break:break-word}',
            '.projectBox{margin:0;padding:8px 10px 6px;border-bottom:1px solid rgba(255,255,255,.12);display:grid;gap:6px}',
            '.projectCompactRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;align-items:center}',
            '.projectCompactTools{display:flex;gap:2px;align-items:center;flex-shrink:0}',
            '.projectCompactRow .select.field{padding:5px 22px 5px 8px;font-size:11px;min-height:28px}',
            '.projectCompactTools .miniBtn{width:24px;height:24px;flex-shrink:0}',
            '.projectEditor{display:grid;gap:6px}',
            '.projectBox.compact .projectEditor{display:none}',
            '.projectFields{display:grid;gap:6px}',
            '.projectActionsRow{display:grid;grid-template-columns:1fr auto;gap:6px}',
            '.projectActionsRow button{font-weight:600}',
            '.projectHint{color:#8f98a6;font-size:11px;line-height:1.35}',
            '.projectFilterRow{display:none;grid-template-columns:1fr auto;gap:6px;align-items:center;font-size:11px;color:#bfc6d1}',
            '.projectFilterRow.visible{display:grid}',
            '.projectBox.filterOn{border-bottom-color:#2d6cdf}',
            '.projectFilter{display:inline-flex;align-items:center;gap:5px;cursor:pointer;user-select:none}',
            '.projectFilter input{width:13px;height:13px;margin:0;cursor:pointer}',
            '.projectMiniStat{color:#8eb6ff;font-weight:700;white-space:nowrap;font-size:11px}',
            '.projectGrid{margin-top:8px;border-top:1px solid rgba(255,255,255,.12);padding-top:8px}',
            '.projectGrid .label{color:#8eb6ff}',
            '.projectBreakdown{grid-column:1/-1;display:grid;gap:4px;margin-top:2px}',
            '.projectBreakdownRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;color:#d8dde6;font-size:12px}',
            '.projectBreakdownName{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.projectBreakdownValue{font-weight:700;color:#fff;text-align:right}',
            '.projectBreakdownEmpty{color:#8f98a6;font-size:11px}',
            '.histHeader{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:11px;color:#bfc6d1;margin-bottom:6px}',
            '.histHeader strong{color:#fff}',
            '.histHeaderText{min-width:0}',
            '.histStats{display:flex;align-items:center;justify-content:flex-end;gap:5px;flex-wrap:wrap;flex-shrink:0}',
            '.histStat{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 6px;background:rgba(255,255,255,.05);white-space:nowrap}',
            '.histShowAll{appearance:none;border:none;background:none;color:#8eb6ff;padding:0;font:11px Arial,sans-serif;cursor:pointer;text-decoration:underline}',
            '.histItem--matched{border-color:rgba(45,108,223,.45);background:rgba(45,108,223,.08)}',
            '.select.field{cursor:pointer;padding-right:24px}',
            '.field{width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#fff;border-radius:6px;padding:7px 8px;font:12px Arial,sans-serif;outline:none}',
            '.field:focus{border-color:#2d6cdf;background:rgba(255,255,255,.09)}',
            '.miniBtn{width:26px;height:26px}',
            '.miniBtn svg{width:14px;height:14px}',
            '.dot{width:7px;height:7px;border-radius:50%;background:#28b67a}',
            '.source{color:#aeb6c2;text-transform:uppercase;font-size:10px}',
            '.actions{display:flex;gap:8px;margin-top:10px;align-items:center;justify-content:space-between}',
            'button{appearance:none;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.08);color:#fff;border-radius:6px;padding:6px 8px;font:12px Arial,sans-serif;cursor:pointer;min-width:0}',
            'button:hover{background:rgba(255,255,255,.14)}',
            'button.active{background:#2d6cdf;border-color:#2d6cdf}',
            '.iconBtn{position:relative;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;padding:0;border-radius:7px}',
            '.iconBtn svg{width:17px;height:17px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round;pointer-events:none}',
            '.iconBtn[data-tooltip]::after{content:attr(data-tooltip);position:absolute;left:50%;bottom:calc(100% + 8px);transform:translateX(-50%);padding:5px 7px;border-radius:5px;background:rgba(8,10,14,.96);border:1px solid rgba(255,255,255,.14);color:#fff;font-size:11px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity .12s, transform .12s;box-shadow:0 4px 14px rgba(0,0,0,.28);z-index:2}',
            '.iconBtn[data-tooltip]::before{content:"";position:absolute;left:50%;bottom:calc(100% + 3px);transform:translateX(-50%);border:5px solid transparent;border-top-color:rgba(8,10,14,.96);opacity:0;pointer-events:none;transition:opacity .12s;z-index:2}',
            '.iconBtn[data-tooltip]:hover::after{opacity:1;transform:translateX(-50%) translateY(-2px)}',
            '.iconBtn[data-tooltip]:hover::before{opacity:1}',
            '.empty{color:#aeb6c2;font-size:12px}',
            '.settingsForm{display:grid;gap:4px}',
            '.acc{border:1px solid rgba(255,255,255,.1);border-radius:6px;overflow:hidden;background:rgba(255,255,255,.02)}',
            '.accHead{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:center;padding:5px 8px;background:rgba(255,255,255,.05);border:none;color:#e8ecf2;font:11px/1.2 Arial,sans-serif;cursor:pointer;text-align:left}',
            '.accTitle{font-weight:700}',
            '.accMeta{color:#8f98a6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}',
            '.accChevron{width:12px;height:12px;opacity:.75;transition:transform .15s ease;display:inline-flex}',
            '.accChevron svg{width:12px;height:12px;stroke:currentColor}',
            '.acc.open .accChevron{transform:rotate(180deg)}',
            '.accBody{display:none;padding:6px 8px 7px;gap:5px}',
            '.acc.open .accBody{display:grid}',
            '.settingsCompactRow{display:grid;grid-template-columns:72px minmax(0,1fr);gap:4px 6px;align-items:center}',
            '.settingsLabel{color:#aeb6c2;font-size:10px}',
            '.settingsInline{display:flex;align-items:center;gap:6px;min-width:0}',
            '.settingsValue{color:#fff;font-weight:700;font-size:10px;min-width:28px;text-align:right}',
            '.settingsCompactRow .field{padding:4px 6px;font-size:11px;min-height:24px}',
            '.settingsCompactRow input[type="range"]{padding:0;min-height:0;height:18px}',
            '.settingsCheck{display:inline-flex;align-items:center;gap:5px;color:#d8dde6;font-size:10px;cursor:pointer;user-select:none;grid-column:1/-1}',
            '.settingsCheck input{width:12px;height:12px;margin:0;cursor:pointer}',
            '.settingsStatus{color:#9aa3b2;font-size:10px;line-height:1.3;word-break:break-word;grid-column:1/-1}',
            '.settingsActions{display:grid;grid-template-columns:1fr 1fr;gap:4px;grid-column:1/-1}',
            '.settingsActions button,.settingsReset{padding:4px 6px;font-size:10px}',
            '.settingsReset{margin-top:2px}',
            '.sheetsNicknameWarn{padding:5px 10px;background:rgba(242,184,75,.14);border-bottom:1px solid rgba(242,184,75,.28);color:#f2d49b;font-size:10px;line-height:1.35;cursor:pointer}',
            '.sheetsNicknameWarn[hidden]{display:none}',
            '.tabPanel[data-panel="settings"]{max-height:260px;overflow:auto;padding-top:2px}',
            '</style>',
            '<div class="panel' + (ctx.runtime.panelCollapsed ? ' collapsed' : '') + '">',
            '  <div class="header">',
            '    <div class="headerDrag" data-drag-handle>',
            '      <div class="title">AI Token Tracker</div>',
            '      <div class="badge" data-field="serviceName">none</div>',
            '    </div>',
            '    <button type="button" class="iconBtn headerBtn" data-action="toggleCollapse" data-tooltip="Collapse panel" aria-label="Collapse panel">' + iconSvg(ctx.runtime.panelCollapsed ? 'chevron-up' : 'chevron-down') + '</button>',
            '  </div>',
            '  <div class="panelContent">',
            '  <div class="projectBox compact" data-field="projectBox">',
            '    <div class="projectCompactRow">',
            '      <select class="field select" data-field="projectSelect" aria-label="Select project"></select>',
            '      <div class="projectCompactTools">',
            '        <button type="button" class="iconBtn miniBtn" data-action="editProject" data-tooltip="Edit project" aria-label="Edit project">' + iconSvg('pencil') + '</button>',
            '        <button type="button" class="iconBtn miniBtn" data-action="newProject" data-tooltip="New project" aria-label="New project">' + iconSvg('plus') + '</button>',
            '        <button type="button" class="iconBtn miniBtn" data-action="deleteProject" data-tooltip="Delete project" aria-label="Delete project">' + iconSvg('trash-2') + '</button>',
            '        <button type="button" class="iconBtn miniBtn" data-action="clearProject" data-tooltip="Clear active project" aria-label="Clear active project">' + iconSvg('x') + '</button>',
            '      </div>',
            '    </div>',
            '    <div class="projectFilterRow" data-field="projectFilterRow">',
            '      <label class="projectFilter">',
            '        <input type="checkbox" data-field="projectFilterToggle">',
            '        <span>Only this project</span>',
            '      </label>',
            '      <span class="projectMiniStat" data-field="projectMiniStat"></span>',
            '    </div>',
            '    <div class="projectEditor" data-field="projectEditor">',
            '      <div class="projectFields">',
            '        <input class="field" data-field="projectName" type="text" placeholder="Task name">',
            '        <input class="field" data-field="projectUrl" type="url" placeholder="Task URL">',
            '      </div>',
            '      <div class="projectActionsRow">',
            '        <button type="button" data-action="saveProject">Save to list</button>',
            '        <button type="button" data-action="cancelProjectEdit">Cancel</button>',
            '      </div>',
            '      <div class="projectHint" data-field="projectHint">Select a saved project or create a new one.</div>',
            '    </div>',
            '  </div>',
            '  <div class="sheetsNicknameWarn" data-field="sheetsNicknameWarn" hidden>Добавьте nickname в Settings → Google Sheets</div>',
            '  <div class="tabs">',
            '    <button type="button" class="tab" data-tab="summary">Summary</button>',
            '    <button type="button" class="tab" data-tab="history">History</button>',
            '    <button type="button" class="tab" data-tab="settings">Settings</button>',
            '  </div>',
            '  <div class="body">',
            '   <div class="tabPanel" data-panel="summary">',
            '    <div class="grid">',
            '      <div class="label">Balance</div><div class="value" data-field="balance">-</div>',
            '    </div>',
            '    <div class="projectGrid grid" data-field="projectGrid" hidden>',
            '      <div class="label">Project total</div><div class="value" data-field="projectTotal">0</div>',
            '      <div class="projectBreakdown" data-field="projectBreakdown"></div>',
            '    </div>',
            '    <div class="events" data-field="events"></div>',
            '   </div>',
            '   <div class="tabPanel" data-panel="history">',
            '    <div class="histHeader" data-field="historyHeader"></div>',
            '    <div class="history" data-field="history"></div>',
            '   </div>',
            '   <div class="tabPanel" data-panel="settings">',
            '    <div class="settingsForm">',
            '      <div class="acc open" data-acc="panel">',
            '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
            '          <span class="accTitle">Panel</span>',
            '          <span class="accMeta" data-field="settingAccMetaPanel">20% · 286px</span>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="accBody">',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Opacity</span>',
            '            <div class="settingsInline">',
            '              <input class="field" data-field="settingIdleOpacity" type="range" min="10" max="80" step="5">',
            '              <span class="settingsValue" data-field="settingIdleOpacityValue">20%</span>',
            '            </div>',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Width</span>',
            '            <select class="field select" data-field="settingPanelWidth">',
            '              <option value="260">260 px</option>',
            '              <option value="286">286 px</option>',
            '              <option value="320">320 px</option>',
            '            </select>',
            '          </div>',
            '          <label class="settingsCheck">',
            '            <input type="checkbox" data-field="settingRememberPosition">',
            '            <span>Remember position</span>',
            '          </label>',
            '        </div>',
            '      </div>',
            '      <div class="acc" data-acc="display">',
            '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
            '          <span class="accTitle">Display</span>',
            '          <span class="accMeta" data-field="settingAccMetaDisplay">3 · 50</span>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="accBody">',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Summary</span>',
            '            <select class="field select" data-field="settingSummaryEvents">',
            '              <option value="1">1</option>',
            '              <option value="3">3</option>',
            '              <option value="5">5</option>',
            '              <option value="10">10</option>',
            '            </select>',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">History</span>',
            '            <select class="field select" data-field="settingHistoryLimit">',
            '              <option value="25">25</option>',
            '              <option value="50">50</option>',
            '              <option value="100">100</option>',
            '            </select>',
            '          </div>',
            '        </div>',
            '      </div>',
            '      <div class="acc' + (needsSheetsNickname(ctx.runtime.settings) ? ' open' : '') + '" data-acc="sheets">',
            '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
            '          <span class="accTitle">Google Sheets</span>',
            '          <span class="accMeta" data-field="settingAccMetaSheets">off</span>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="accBody">',
            '          <label class="settingsCheck">',
            '            <input type="checkbox" data-field="settingSheetsEnabled">',
            '            <span>Sync spends</span>',
            '          </label>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Nickname</span>',
            '            <input class="field" data-field="settingSheetsNickname" type="text" placeholder="Team name">',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Token</span>',
            '            <input class="field" data-field="settingSheetsSecretToken" type="password" placeholder="Secret">',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">URL</span>',
            '            <input class="field" data-field="settingSheetsWebAppUrl" type="url" placeholder=".../exec">',
            '          </div>',
            '          <div class="settingsStatus" data-field="settingSheetsStatus">Sheets sync is off.</div>',
            '          <div class="settingsActions">',
            '            <button type="button" data-action="testSheetsConnection">Test</button>',
            '            <button type="button" data-action="retrySheetsSync">Retry</button>',
            '          </div>',
            '        </div>',
            '      </div>',
            '      <button type="button" class="settingsReset" data-action="resetSettings">Reset defaults</button>',
            '    </div>',
            '   </div>',
            '    <div class="actions">',
            '      <button type="button" class="iconBtn" data-action="resetAll" data-tooltip="Reset all" aria-label="Reset all">' + iconSvg('trash-2') + '</button>',
            '      <button type="button" class="iconBtn" data-action="copyReport" data-tooltip="Copy report" aria-label="Copy report">' + iconSvg('clipboard-copy') + '</button>',
            '      <button type="button" class="iconBtn" data-action="reset" data-tooltip="Reset session" aria-label="Reset session">' + iconSvg('rotate-ccw') + '</button>',
            '      <button type="button" class="iconBtn" data-action="export" data-tooltip="Export JSON" aria-label="Export JSON">' + iconSvg('download') + '</button>',
            '      <button type="button" class="iconBtn" data-action="debug" data-tooltip="Collect debug report" aria-label="Collect debug report">' + iconSvg('bug') + '</button>',
            '    </div>',
            '  </div>',
            '  </div>',
            '</div>'
        ].join('');

        shadow.querySelector('[data-action="reset"]').addEventListener('click', function () {
            ctx.resetSession();
        });
        shadow.querySelector('[data-action="resetAll"]').addEventListener('click', function () {
            ctx.resetAll();
        });
        shadow.querySelector('[data-action="copyReport"]').addEventListener('click', function () {
            ctx.copyDebugReport();
        });
        shadow.querySelector('[data-action="export"]').addEventListener('click', function () {
            ctx.downloadExport();
        });
        shadow.querySelector('[data-action="debug"]').addEventListener('click', function () {
            ctx.setDebug(!ctx.runtime.debug);
        });
        shadow.querySelector('[data-action="clearProject"]').addEventListener('click', function () {
            ctx.clearProject();
        });
        shadow.querySelector('[data-action="editProject"]').addEventListener('click', function () {
            ctx.openProjectEditor();
        });
        shadow.querySelector('[data-action="cancelProjectEdit"]').addEventListener('click', function () {
            ctx.syncProjectDraftFromActive();
            ctx.closeProjectEditor();
        });
        shadow.querySelector('[data-action="newProject"]').addEventListener('click', function () {
            ctx.beginNewProjectForm(shadow);
        });
        shadow.querySelector('[data-action="deleteProject"]').addEventListener('click', function () {
            ctx.deleteSelectedProject(shadow);
        });
        shadow.querySelector('[data-action="saveProject"]').addEventListener('click', function () {
            ctx.saveProjectFromForm(shadow);
        });
        shadow.querySelector('[data-field="projectSelect"]').addEventListener('change', function (event) {
            const id = event.currentTarget.value;
            if (!id) {
                ctx.clearProject();
                return;
            }
            ctx.selectProject(id);
        });
        shadow.querySelector('[data-field="projectName"]').addEventListener('input', function (event) {
            ctx.syncProjectDraftFromInputs(event.currentTarget.getRootNode());
        });
        shadow.querySelector('[data-field="projectUrl"]').addEventListener('input', function (event) {
            ctx.syncProjectDraftFromInputs(event.currentTarget.getRootNode());
        });
        shadow.querySelector('[data-field="projectFilterToggle"]').addEventListener('change', function (event) {
            ctx.setProjectFilterEnabled(event.currentTarget.checked);
        });
        shadow.querySelector('[data-action="toggleCollapse"]').addEventListener('click', function (event) {
            event.stopPropagation();
            setPanelCollapsed(!ctx.runtime.panelCollapsed);
        });
        Array.from(shadow.querySelectorAll('[data-tab]')).forEach(function (button) {
            button.addEventListener('click', function () {
                ctx.setActiveTab(button.getAttribute('data-tab'));
            });
        });
        Array.from(shadow.querySelectorAll('[data-action="toggleSettingsAcc"]')).forEach(function (button) {
            button.addEventListener('click', function () {
                const acc = button.closest('[data-acc]');
                if (acc) acc.classList.toggle('open');
            });
        });
        const nicknameWarn = shadow.querySelector('[data-field="sheetsNicknameWarn"]');
        if (nicknameWarn) {
            nicknameWarn.addEventListener('click', function () {
                ctx.setActiveTab('settings');
                const sheetsAcc = shadow.querySelector('[data-acc="sheets"]');
                if (sheetsAcc) sheetsAcc.classList.add('open');
            });
        }
        shadow.querySelector('[data-field="settingIdleOpacity"]').addEventListener('input', function (event) {
            const percent = Number(event.currentTarget.value);
            ctx.updateSetting('idleOpacity', percent / 100);
        });
        shadow.querySelector('[data-field="settingSummaryEvents"]').addEventListener('change', function (event) {
            ctx.updateSetting('summaryEventsCount', Number(event.currentTarget.value));
        });
        shadow.querySelector('[data-field="settingHistoryLimit"]').addEventListener('change', function (event) {
            ctx.updateSetting('historyDisplayLimit', Number(event.currentTarget.value));
        });
        shadow.querySelector('[data-field="settingPanelWidth"]').addEventListener('change', function (event) {
            ctx.updateSetting('panelWidth', Number(event.currentTarget.value));
        });
        shadow.querySelector('[data-field="settingRememberPosition"]').addEventListener('change', function (event) {
            ctx.updateSetting('rememberPanelPosition', event.currentTarget.checked === true);
        });
        shadow.querySelector('[data-field="settingSheetsEnabled"]').addEventListener('change', function (event) {
            ctx.updateSetting('sheetsEnabled', event.currentTarget.checked === true);
        });
        shadow.querySelector('[data-field="settingSheetsNickname"]').addEventListener('change', function (event) {
            ctx.updateSetting('sheetsNickname', event.currentTarget.value);
        });
        shadow.querySelector('[data-field="settingSheetsWebAppUrl"]').addEventListener('change', function (event) {
            ctx.updateSetting('sheetsWebAppUrl', event.currentTarget.value);
        });
        shadow.querySelector('[data-field="settingSheetsSecretToken"]').addEventListener('change', function (event) {
            ctx.updateSetting('sheetsSecretToken', event.currentTarget.value);
        });
        shadow.querySelector('[data-action="testSheetsConnection"]').addEventListener('click', function () {
            applySheetsFieldsFromForm(ctx, shadow);
            const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
            const testButton = shadow.querySelector('[data-action="testSheetsConnection"]');
            if (statusEl) statusEl.textContent = 'Testing connection...';
            if (testButton) testButton.disabled = true;

            const runTest = typeof ctx.testSheetsConnection === 'function'
                ? ctx.testSheetsConnection()
                : Promise.reject(new Error('sheets module not ready'));

            runTest.then(function () {
                if (statusEl) statusEl.textContent = 'Connection OK';
            }).catch(function () {
                // sheetsLastError updated in sendSheetsRequest
            }).finally(function () {
                if (testButton) testButton.disabled = false;
                ctx.renderSoon();
            });
        });
        shadow.querySelector('[data-action="retrySheetsSync"]').addEventListener('click', function () {
            applySheetsFieldsFromForm(ctx, shadow);
            ctx.retryFailedSyncs().then(function () {
                ctx.renderSoon();
            });
        });
        shadow.querySelector('[data-action="resetSettings"]').addEventListener('click', function () {
            ctx.resetSettings();
        });
        installPanelDrag(host, shadow.querySelector('[data-drag-handle]'));

        mount.appendChild(host);
        ctx.runtime.panelHost = host;
        ctx.runtime.shadowRoot = shadow;
        applyPanelSettings(ctx);
    }

    function setPanelCollapsed(collapsed) {
        ctx.runtime.panelCollapsed = collapsed === true;
        if (!ctx.runtime.shadowRoot) return;
        const panel = ctx.runtime.shadowRoot.querySelector('.panel');
        const button = ctx.runtime.shadowRoot.querySelector('[data-action="toggleCollapse"]');
        if (panel) panel.classList.toggle('collapsed', ctx.runtime.panelCollapsed);
        if (button) {
            button.innerHTML = iconSvg(ctx.runtime.panelCollapsed ? 'chevron-up' : 'chevron-down');
            const label = ctx.runtime.panelCollapsed ? 'Expand panel' : 'Collapse panel';
            button.setAttribute('data-tooltip', label);
            button.setAttribute('aria-label', label);
        }
        savePanelGeometry();
    }

    function savePanelGeometry(host) {
        const panelHost = host || ctx.runtime.panelHost;
        const payload = {
            collapsed: ctx.runtime.panelCollapsed === true
        };
        if (ctx.runtime.settings && ctx.runtime.settings.rememberPanelPosition === true && panelHost) {
            const right = parseFloat(panelHost.style.right);
            const bottom = parseFloat(panelHost.style.bottom);
            if (Number.isFinite(right)) payload.right = right;
            if (Number.isFinite(bottom)) payload.bottom = bottom;
        }
        writeJson(PANEL_KEY, payload);
    }

    function installPanelDrag(host, handle) {
        if (!host || !handle) return;
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let startRight = 0;
        let startBottom = 0;

        handle.addEventListener('pointerdown', function (event) {
            dragging = true;
            startX = event.clientX;
            startY = event.clientY;
            const rect = host.getBoundingClientRect();
            startRight = Math.max(8, window.innerWidth - rect.right);
            startBottom = Math.max(8, window.innerHeight - rect.bottom);
            handle.setPointerCapture(event.pointerId);
        });

        handle.addEventListener('pointermove', function (event) {
            if (!dragging) return;
            const nextRight = clamp(startRight - (event.clientX - startX), 8, Math.max(8, window.innerWidth - 80));
            const nextBottom = clamp(startBottom - (event.clientY - startY), 8, Math.max(8, window.innerHeight - 60));
            host.style.right = nextRight + 'px';
            host.style.bottom = nextBottom + 'px';
        });

        handle.addEventListener('pointerup', function (event) {
            if (!dragging) return;
            dragging = false;
            try {
                handle.releasePointerCapture(event.pointerId);
            } catch (_) {}
            savePanelGeometry(host);
        });
    }

    function ensurePanelAttached() {
        const mount = getPanelMount();
        if (!mount) return;
        if (!ctx.runtime.panelHost) {
            createPanel();
            return;
        }
        if (!ctx.runtime.panelHost.isConnected) {
            mount.appendChild(ctx.runtime.panelHost);
            ctx.addDiagnostic('re-attached panel after dom removal');
            ctx.renderSoon();
        }
    }

    function installPanelPersistence() {
        if (ctx.runtime.panelPersistenceInstalled) return;
        ctx.runtime.panelPersistenceInstalled = true;

        ensurePanelAttached();

        if (typeof MutationObserver === 'function' && document.body) {
            ctx.runtime.panelPersistenceObserver = new MutationObserver(function () {
                if (ctx.runtime.panelReattachTimer) return;
                ctx.runtime.panelReattachTimer = window.setTimeout(function () {
                    ctx.runtime.panelReattachTimer = null;
                    ensurePanelAttached();
                }, 50);
            });
            ctx.runtime.panelPersistenceObserver.observe(document.body, {
                childList: true,
                subtree: false
            });
        }

        ctx.runtime.panelEnsureInterval = window.setInterval(ensurePanelAttached, 2000);
    }

    function initDomFeatures() {
        installPanelPersistence();
        ctx.installClickTracker();
        ctx.installUiObserver();
        ctx.scheduleUiScan(500);
        if (typeof ctx.notifyMissingSheetsNickname === 'function') {
            ctx.notifyMissingSheetsNickname();
        }
        ctx.renderSoon();
    }

    function bootWhenBodyExists() {
        if (document.body) {
            initDomFeatures();
            return;
        }
        const timer = window.setInterval(function () {
            if (!document.body) return;
            window.clearInterval(timer);
            initDomFeatures();
        }, 50);
    }

    return {
        getPanelMount,
        createPanel,
        setPanelCollapsed,
        savePanelGeometry,
        installPanelDrag,
        ensurePanelAttached,
        installPanelPersistence,
        initDomFeatures,
        bootWhenBodyExists
    };
}

export function sanitizeUiState(value) {
    const tab = value && value.activeTab;
    const activeTab = tab === 'history' || tab === 'settings' ? tab : 'summary';
    return {
        activeTab: activeTab,
        projectFilterEnabled: value && value.projectFilterEnabled === true
    };
}

export function saveUiState(ctx) {
    writeJson(UI_KEY, {
        activeTab: ctx.runtime.activeTab,
        projectFilterEnabled: ctx.runtime.projectFilterEnabled === true
    });
}
