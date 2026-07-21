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
            ':host{display:block;position:relative;--ktt-idle-opacity:.2}',
            ':host(:hover) .panel,.panel.undo-active{opacity:1}',
            '.panel{position:relative;width:286px;color:#f6f7f8;background:rgba(18,20,24,.92);border:1px solid rgba(255,255,255,.14);box-shadow:0 10px 30px rgba(0,0,0,.26);border-radius:8px;overflow:hidden;font:13px/1.35 Arial,sans-serif;backdrop-filter:blur(8px);opacity:var(--ktt-idle-opacity);transition:opacity .2s ease}',
            '.panel.collapsed .panelContent{display:none}',
            '.panelContent{position:relative}',
            '.header{position:relative;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:10px 12px;background:rgba(255,255,255,.06);user-select:none;min-height:28px;cursor:move}',
            '.headerDefault{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;flex:1}',
            '.panel.undo-active .header{background:rgba(45,108,223,.14)}',
            '@keyframes undoFlash{0%,100%{background:rgba(45,108,223,.14);box-shadow:inset 0 0 0 0 rgba(110,164,255,0)}50%{background:rgba(45,108,223,.48);box-shadow:inset 0 0 18px rgba(110,164,255,.3)}}',
            '.panel.undo-fresh .header{animation:undoFlash .5s ease-in-out 4}',
            '.panel.undo-active .headerDefault{display:none}',
            '.headerDrag{display:flex;align-items:center;gap:8px;min-width:0;flex:1;cursor:move}',
            '.headerControls{display:flex;align-items:center;gap:6px;flex-shrink:0}',
            '.headerBtn{width:28px;height:28px;flex-shrink:0;cursor:pointer}',
            '.headerBtn svg{width:15px;height:15px}',
            '.title{font-weight:700;letter-spacing:0}',
            '.versionBtn{appearance:none;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.07);color:#d8dde6;border-radius:999px;padding:2px 7px;font:11px Arial,sans-serif;cursor:pointer;white-space:nowrap}',
            '.versionBtn:hover{background:rgba(255,255,255,.14);color:#fff}',
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
            '.histSpendMain{min-width:0;flex:1;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
            '.histTime{display:inline-flex;align-items:center;border:1px solid rgba(142,182,255,.28);background:rgba(45,108,223,.18);color:#d6e4ff;border-radius:999px;padding:1px 6px;font-size:11px;line-height:1.35;font-weight:700}',
            '.histAmount{color:#fff;font-weight:800}',
            '.histSpendService{color:#d8dde6;white-space:nowrap}',
            '.histDelete{width:24px;height:24px;flex-shrink:0;opacity:.72}',
            '.histDelete:hover{opacity:1}',
            '.histMeta{margin-top:5px;color:#bfc6d1;font-size:11px;display:flex;flex-wrap:wrap;gap:5px}',
            '.pill{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:1px 6px;background:rgba(255,255,255,.05)}',
            '.raw{margin-top:5px;color:#8f98a6;font-size:11px;word-break:break-word}',
            '.projectBox{margin:0;padding:8px 10px 6px;border-bottom:1px solid rgba(255,255,255,.12);display:grid;gap:6px}',
            '.projectCompactRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px;align-items:center}',
            '.projectCompactTools{display:flex;gap:2px;align-items:center;flex-shrink:0}',
            '.projectCompactRow .select.field{padding:5px 22px 5px 8px;font-size:11px;min-height:28px}',
            '.projectCompactTools .miniBtn{width:24px;height:24px;flex-shrink:0}',
            '.projectSearchPanel{display:grid;gap:5px}',
            '.projectSearchPanel[hidden]{display:none}',
            '.projectSearchInputRow{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:4px}',
            '.projectSearchInputRow .field{padding:5px 7px;font-size:11px;min-height:28px}',
            '.projectSearchClose{width:28px;height:28px}',
            '.projectSearchResults{display:grid;gap:3px;max-height:150px;overflow:auto}',
            '.projectSearchResult{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;align-items:center;padding:5px 7px;text-align:left;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.09);border-radius:6px}',
            '.projectSearchResult:hover{background:rgba(45,108,223,.13);border-color:rgba(45,108,223,.4)}',
            '.projectSearchResultName{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.projectSearchResultMeta{color:#8f98a6;font-size:9px;white-space:nowrap}',
            '.projectSearchEmpty{padding:4px 2px;color:#8f98a6;font-size:10px}',
            '.projectEditor{display:grid;gap:6px}',
            '.projectBox.compact .projectEditor{display:none}',
            '.projectFields{display:grid;gap:6px}',
            '.projectSuggestions{display:grid;gap:5px;padding:7px;border:1px solid rgba(242,184,75,.35);border-radius:7px;background:rgba(242,184,75,.08)}',
            '.projectSuggestions[hidden]{display:none}',
            '.projectSuggestionsTitle{font-size:10px;line-height:1.35;color:#f2d49b;font-weight:700}',
            '.projectSuggestionsList{display:grid;gap:4px}',
            '.projectSuggestion{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px;text-align:left;padding:6px 7px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px}',
            '.projectSuggestion.exact{border-color:rgba(242,184,75,.65);background:rgba(242,184,75,.12)}',
            '.projectSuggestionMain{min-width:0;display:grid;gap:2px}',
            '.projectSuggestionName{font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.projectSuggestionMeta{font-size:9px;color:#9da6b4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.projectSuggestionAction{font-size:9px;color:#8eb6ff;align-self:center}',
            '.projectCreateAnyway{font-size:10px;padding:5px 7px;background:transparent;border-color:rgba(255,255,255,.18)}',
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
            '.settingsActions{display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;grid-column:1/-1}',
            '.settingsActions button,.settingsReset{padding:4px 6px;font-size:10px}',
            '.settingsReset{margin-top:2px}',
            '.versionList{display:grid;gap:7px}',
            '.versionItem{display:grid;gap:3px;border-top:1px solid rgba(255,255,255,.08);padding-top:7px}',
            '.versionItem:first-child{border-top:none;padding-top:0}',
            '.versionTop{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#fff;font-weight:700;font-size:11px}',
            '.versionDate{color:#8f98a6;font-weight:400}',
            '.versionChanges{margin:0;padding-left:14px;color:#bfc6d1;font-size:10px;line-height:1.35}',
            '.undoToast{display:none;width:100%;grid-template-columns:auto minmax(0,1fr) auto auto;gap:6px;align-items:center}',
            '.panel.undo-active .undoToast{display:grid}',
            '.undoIcon{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:rgba(45,108,223,.32);color:#fff}',
            '.undoIcon svg{width:13px;height:13px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}',
            '.undoText{display:grid;gap:0;min-width:0;color:#d8dde6;font-size:10px;line-height:1.2}',
            '.undoText strong{color:#fff;font-size:11px;line-height:1.15}',
            '.undoProjectButton{appearance:none;border:0;background:transparent;color:#fff;padding:0;min-width:0;max-width:100%;font:700 11px/1.15 Arial,sans-serif;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer}',
            '.undoProjectButton:hover{color:#9fc0ff;text-decoration:underline}',
            '.undoMeta{color:#bfc6d1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
            '.undoAction{padding:4px 8px;font-size:11px;font-weight:700;border-radius:999px;background:#2d6cdf;border-color:#2d6cdf}',
            '.undoClose{width:22px;height:22px;border-radius:999px}',
            '.undoProgressTrack{display:none;position:absolute;left:0;right:0;bottom:0;height:3px;background:rgba(255,255,255,.12);overflow:hidden}',
            '.panel.undo-active .undoProgressTrack{display:block}',
            '.undoProgressBar{display:block;width:100%;height:100%;background:linear-gradient(90deg,#6ea4ff,#2d6cdf);transform-origin:left center;transition:transform .1s linear;box-shadow:0 0 7px rgba(110,164,255,.75)}',
            '.undoProjectPicker{display:none;width:100%}',
            '.panel.undo-picking .undoToast{display:none}',
            '.panel.undo-picking .undoProjectPicker{display:block}',
            '.undoProjectChoose{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:5px;align-items:center}',
            '.undoProjectCreate{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:5px;align-items:center}',
            '.undoProjectChoose[hidden],.undoProjectCreate[hidden]{display:none}',
            '.undoProjectPicker .field{min-height:26px;padding:4px 22px 4px 7px;font-size:10px}',
            '.undoProjectSearch{grid-column:1/-1;padding-right:7px!important}',
            '.undoProjectCreate .field{grid-column:1/-1;padding-right:7px}',
            '.undoCreateProject{grid-column:1/-1;padding:5px 7px;font-size:10px;background:rgba(45,108,223,.16);border-color:rgba(110,164,255,.45);color:#cfe0ff}',
            '.undoPickerAction{padding:4px 7px;font-size:10px;font-weight:700}',
            '.undoPickerCancel{padding:4px 7px;font-size:10px;background:rgba(255,255,255,.06)}',
            '.sheetsNicknameWarn{padding:5px 10px;background:rgba(242,184,75,.14);border-bottom:1px solid rgba(242,184,75,.28);color:#f2d49b;font-size:10px;line-height:1.35;cursor:pointer}',
            '.sheetsNicknameWarn[hidden]{display:none}',
            '.tabPanel[data-panel="settings"]{max-height:260px;overflow:auto;padding-top:2px}',
            '</style>',
            '<div class="panel' + (ctx.runtime.panelCollapsed ? ' collapsed' : '') + '">',
            '  <div class="header" data-drag-handle>',
            '    <div class="headerDefault" data-field="headerDefault">',
            '      <div class="headerDrag">',
            '        <div class="title">AITT</div>',
            '        <div class="badge" data-field="serviceName">none</div>',
            '      </div>',
            '      <div class="headerControls">',
            '        <button type="button" class="versionBtn" data-action="showVersions" data-field="versionBadge" aria-label="История версий">v-</button>',
            '        <button type="button" class="iconBtn headerBtn" data-action="toggleCollapse" data-tooltip="Свернуть панель" aria-label="Свернуть панель">' + iconSvg(ctx.runtime.panelCollapsed ? 'chevron-up' : 'chevron-down') + '</button>',
            '      </div>',
            '    </div>',
            '    <div class="undoToast" data-field="undoToast" aria-hidden="true">',
            '      <span class="undoIcon">' + iconSvg('rotate-ccw') + '</span>',
            '      <span class="undoText"><button type="button" class="undoProjectButton" data-action="openUndoProjectPicker" data-field="undoProjectName" aria-label="Сменить проект">Без проекта ▾</button><span class="undoMeta" data-field="undoMeta"></span></span>',
            '      <button type="button" class="undoAction" data-action="undoSpend">Отменить</button>',
            '      <button type="button" class="iconBtn undoClose" data-action="closeUndoToast" data-tooltip="Закрыть" aria-label="Закрыть отмену">' + iconSvg('x') + '</button>',
            '    </div>',
            '    <div class="undoProjectPicker" data-field="undoProjectPicker">',
            '      <div class="undoProjectChoose" data-field="undoProjectChoose">',
            '        <input class="field undoProjectSearch" data-field="undoProjectSearch" type="search" placeholder="Поиск проекта">',
            '        <select class="field select" data-field="undoProjectSelect" aria-label="Выбрать проект"></select>',
            '        <button type="button" class="undoPickerAction" data-action="applyUndoProject">Применить</button>',
            '        <button type="button" class="undoPickerCancel" data-action="cancelUndoProject">Отмена</button>',
            '        <button type="button" class="undoCreateProject" data-action="openUndoProjectCreator">+ Создать новый проект</button>',
            '      </div>',
            '      <div class="undoProjectCreate" data-field="undoProjectCreate" hidden>',
            '        <input class="field" data-field="undoProjectCreateName" type="text" placeholder="Название проекта">',
            '        <input class="field" data-field="undoProjectCreateUrl" type="url" placeholder="URL проекта (необязательно)">',
            '        <button type="button" class="undoPickerAction" data-action="createUndoProject">Создать</button>',
            '        <button type="button" class="undoPickerCancel" data-action="backUndoProjectPicker">Назад</button>',
            '        <button type="button" class="undoPickerCancel" data-action="cancelUndoProjectCreate">Отмена</button>',
            '      </div>',
            '    </div>',
            '    <span class="undoProgressTrack" aria-hidden="true"><span class="undoProgressBar" data-field="undoProgressBar"></span></span>',
            '  </div>',
            '  <div class="panelContent">',
            '  <div class="projectBox compact" data-field="projectBox">',
            '    <div class="projectCompactRow">',
            '      <select class="field select" data-field="projectSelect" aria-label="Выбрать проект"></select>',
            '      <div class="projectCompactTools">',
            '        <button type="button" class="iconBtn miniBtn" data-action="toggleProjectSearch" data-tooltip="Поиск проектов" aria-label="Поиск проектов">' + iconSvg('search') + '</button>',
            '        <button type="button" class="iconBtn miniBtn" data-action="editProject" data-tooltip="Редактировать проект" aria-label="Редактировать проект">' + iconSvg('pencil') + '</button>',
            '        <button type="button" class="iconBtn miniBtn" data-action="newProject" data-tooltip="Новый проект" aria-label="Новый проект">' + iconSvg('plus') + '</button>',
            '        <button type="button" class="iconBtn miniBtn" data-action="deleteProject" data-tooltip="Удалить проект" aria-label="Удалить проект">' + iconSvg('trash-2') + '</button>',
            '        <button type="button" class="iconBtn miniBtn" data-action="clearProject" data-tooltip="Сбросить проект" aria-label="Сбросить проект">' + iconSvg('x') + '</button>',
            '      </div>',
            '    </div>',
            '    <div class="projectSearchPanel" data-field="projectSearchPanel" hidden>',
            '      <div class="projectSearchInputRow">',
            '        <input class="field" data-field="projectSearchInput" type="search" placeholder="Поиск по названию">',
            '        <button type="button" class="iconBtn projectSearchClose" data-action="closeProjectSearch" data-tooltip="Закрыть поиск" aria-label="Закрыть поиск">' + iconSvg('x') + '</button>',
            '      </div>',
            '      <div class="projectSearchResults" data-field="projectSearchResults"></div>',
            '    </div>',
            '    <div class="projectFilterRow" data-field="projectFilterRow">',
            '      <label class="projectFilter">',
            '        <input type="checkbox" data-field="projectFilterToggle">',
            '        <span>Только этот проект</span>',
            '      </label>',
            '      <span class="projectMiniStat" data-field="projectMiniStat"></span>',
            '    </div>',
            '    <div class="projectEditor" data-field="projectEditor">',
            '      <div class="projectFields">',
            '        <input class="field" data-field="projectName" type="text" placeholder="Название задачи">',
            '        <input class="field" data-field="projectUrl" type="url" placeholder="URL задачи">',
            '      </div>',
            '      <div class="projectSuggestions" data-field="projectSuggestions" hidden>',
            '        <div class="projectSuggestionsTitle" data-field="projectSuggestionsTitle"></div>',
            '        <div class="projectSuggestionsList" data-field="projectSuggestionsList"></div>',
            '        <button type="button" class="projectCreateAnyway" data-action="createProjectAnyway">Всё равно создать новый</button>',
            '      </div>',
            '      <div class="projectActionsRow">',
            '        <button type="button" data-action="saveProject" data-field="saveProjectButton">Сохранить в список</button>',
            '        <button type="button" data-action="cancelProjectEdit">Отмена</button>',
            '      </div>',
            '      <div class="projectHint" data-field="projectHint">Выберите сохранённый проект или создайте новый.</div>',
            '    </div>',
            '  </div>',
            '  <div class="sheetsNicknameWarn" data-field="sheetsNicknameWarn" hidden>Добавьте имя в Настройки → Google Sheets</div>',
            '  <div class="tabs">',
            '    <button type="button" class="tab" data-tab="summary">Сводка</button>',
            '    <button type="button" class="tab" data-tab="history">История</button>',
            '    <button type="button" class="tab" data-tab="settings">Настройки</button>',
            '  </div>',
            '  <div class="body">',
            '   <div class="tabPanel" data-panel="summary">',
            '    <div class="grid">',
            '      <div class="label">Баланс</div><div class="value" data-field="balance">-</div>',
            '    </div>',
            '    <div class="projectGrid grid" data-field="projectGrid" hidden>',
            '      <div class="label">Итого по проекту</div><div class="value" data-field="projectTotal">0</div>',
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
            '          <span class="accTitle">Панель</span>',
            '          <span class="accMeta" data-field="settingAccMetaPanel">20% · 286px</span>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="accBody">',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Прозрачность</span>',
            '            <div class="settingsInline">',
            '              <input class="field" data-field="settingIdleOpacity" type="range" min="10" max="80" step="5">',
            '              <span class="settingsValue" data-field="settingIdleOpacityValue">20%</span>',
            '            </div>',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Ширина</span>',
            '            <select class="field select" data-field="settingPanelWidth">',
            '              <option value="260">260 px</option>',
            '              <option value="286">286 px</option>',
            '              <option value="320">320 px</option>',
            '            </select>',
            '          </div>',
            '          <label class="settingsCheck">',
            '            <input type="checkbox" data-field="settingRememberPosition">',
            '            <span>Запоминать позицию</span>',
            '          </label>',
            '        </div>',
            '      </div>',
            '      <div class="acc" data-acc="display">',
            '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
            '          <span class="accTitle">Отображение</span>',
            '          <span class="accMeta" data-field="settingAccMetaDisplay">3 · 50</span>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="accBody">',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Сводка</span>',
            '            <select class="field select" data-field="settingSummaryEvents">',
            '              <option value="1">1</option>',
            '              <option value="3">3</option>',
            '              <option value="5">5</option>',
            '              <option value="10">10</option>',
            '            </select>',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">История</span>',
            '            <select class="field select" data-field="settingHistoryLimit">',
            '              <option value="25">25</option>',
            '              <option value="50">50</option>',
            '              <option value="100">100</option>',
            '            </select>',
            '          </div>',
            '        </div>',
            '      </div>',
            '      <div class="acc" data-acc="versions">',
            '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
            '          <span class="accTitle">Версии</span>',
            '          <span class="accMeta" data-field="settingAccMetaVersions">v-</span>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="accBody">',
            '          <div class="versionList" data-field="versionHistory"></div>',
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
            '            <span>Синхронизация трат и проектов</span>',
            '          </label>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Имя</span>',
            '            <input class="field" data-field="settingSheetsNickname" type="text" placeholder="Имя в команде">',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">Токен</span>',
            '            <input class="field" data-field="settingSheetsSecretToken" type="password" placeholder="Секрет">',
            '          </div>',
            '          <div class="settingsCompactRow">',
            '            <span class="settingsLabel">URL</span>',
            '            <input class="field" data-field="settingSheetsWebAppUrl" type="url" placeholder=".../exec">',
            '          </div>',
            '          <div class="settingsStatus" data-field="settingSheetsStatus">Синхронизация с Sheets выключена.</div>',
            '          <div class="settingsActions">',
            '            <button type="button" data-action="testSheetsConnection">Проверить</button>',
            '            <button type="button" data-action="retrySheetsSync">Повторить</button>',
            '            <button type="button" data-action="refreshSheetsData">Обновить</button>',
            '          </div>',
            '        </div>',
            '      </div>',
            '      <button type="button" class="settingsReset" data-action="resetSettings">Сбросить настройки</button>',
            '    </div>',
            '   </div>',
            '    <div class="actions">',
            '      <button type="button" class="iconBtn" data-action="resetAll" data-tooltip="Сбросить всё" aria-label="Сбросить всё">' + iconSvg('trash-2') + '</button>',
            '      <button type="button" class="iconBtn" data-action="copyReport" data-tooltip="Копировать отчёт" aria-label="Копировать отчёт">' + iconSvg('clipboard-copy') + '</button>',
            '      <button type="button" class="iconBtn" data-action="reset" data-tooltip="Сбросить сессию" aria-label="Сбросить сессию">' + iconSvg('rotate-ccw') + '</button>',
            '      <button type="button" class="iconBtn" data-action="export" data-tooltip="Экспорт JSON" aria-label="Экспорт JSON">' + iconSvg('download') + '</button>',
            '      <button type="button" class="iconBtn" data-action="debug" data-tooltip="Собрать отчёт отладки" aria-label="Собрать отчёт отладки">' + iconSvg('bug') + '</button>',
            '    </div>',
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
        shadow.querySelector('[data-action="undoSpend"]').addEventListener('click', function () {
            ctx.undoLastSpend();
        });
        shadow.querySelector('[data-action="openUndoProjectPicker"]').addEventListener('click', function (event) {
            event.stopPropagation();
            if (ctx.openUndoProjectPicker()) {
                window.setTimeout(function () {
                    const input = shadow.querySelector('[data-field="undoProjectSearch"]');
                    if (input) input.focus();
                }, 0);
            }
        });
        shadow.querySelector('[data-action="applyUndoProject"]').addEventListener('click', function () {
            const select = shadow.querySelector('[data-field="undoProjectSelect"]');
            ctx.applyUndoProject(select ? select.value : '');
        });
        shadow.querySelector('[data-action="cancelUndoProject"]').addEventListener('click', function () {
            ctx.resumeUndoProjectPicker();
        });
        shadow.querySelector('[data-field="undoProjectSearch"]').addEventListener('input', function (event) {
            const select = shadow.querySelector('[data-field="undoProjectSelect"]');
            ctx.setUndoProjectSearchQuery(event.currentTarget.value, select ? select.value : '');
        });
        shadow.querySelector('[data-field="undoProjectSelect"]').addEventListener('change', function (event) {
            ctx.setUndoPendingProject(event.currentTarget.value);
        });
        shadow.querySelector('[data-action="openUndoProjectCreator"]').addEventListener('click', function () {
            if (ctx.openUndoProjectCreator()) {
                window.setTimeout(function () {
                    const input = shadow.querySelector('[data-field="undoProjectCreateName"]');
                    if (input) {
                        input.focus();
                        input.select();
                    }
                }, 0);
            }
        });
        shadow.querySelector('[data-action="backUndoProjectPicker"]').addEventListener('click', function () {
            ctx.closeUndoProjectCreator();
        });
        shadow.querySelector('[data-action="cancelUndoProjectCreate"]').addEventListener('click', function () {
            ctx.resumeUndoProjectPicker();
        });
        function createProjectFromUndoInputs() {
            const nameInput = shadow.querySelector('[data-field="undoProjectCreateName"]');
            const urlInput = shadow.querySelector('[data-field="undoProjectCreateUrl"]');
            const created = ctx.createProjectForUndo(
                nameInput ? nameInput.value : '',
                urlInput ? urlInput.value : ''
            );
            if (!created && nameInput) {
                nameInput.focus();
                nameInput.setCustomValidity('Укажите название проекта');
                nameInput.reportValidity();
            }
        }
        shadow.querySelector('[data-action="createUndoProject"]').addEventListener('click', createProjectFromUndoInputs);
        ['undoProjectCreateName', 'undoProjectCreateUrl'].forEach(function (field) {
            shadow.querySelector('[data-field="' + field + '"]').addEventListener('input', function () {
                const nameInput = shadow.querySelector('[data-field="undoProjectCreateName"]');
                const urlInput = shadow.querySelector('[data-field="undoProjectCreateUrl"]');
                if (nameInput) nameInput.setCustomValidity('');
                ctx.setUndoProjectCreateDraft(
                    nameInput ? nameInput.value : '',
                    urlInput ? urlInput.value : ''
                );
            });
            shadow.querySelector('[data-field="' + field + '"]').addEventListener('keydown', function (event) {
                if (event.key === 'Enter') {
                    event.preventDefault();
                    createProjectFromUndoInputs();
                }
                if (event.key === 'Escape') {
                    event.preventDefault();
                    ctx.closeUndoProjectCreator();
                }
            });
        });
        shadow.querySelector('[data-action="closeUndoToast"]').addEventListener('click', function () {
            ctx.hideUndoSpend();
        });
        shadow.querySelector('[data-action="showVersions"]').addEventListener('click', function (event) {
            event.preventDefault();
            event.stopPropagation();
            ctx.setActiveTab('settings');
            window.setTimeout(function () {
                const versionsAcc = shadow.querySelector('[data-acc="versions"]');
                if (versionsAcc) versionsAcc.classList.add('open');
            }, 60);
        });
        shadow.querySelector('[data-action="clearProject"]').addEventListener('click', function () {
            ctx.clearProject();
        });
        shadow.querySelector('[data-action="toggleProjectSearch"]').addEventListener('click', function () {
            const opened = ctx.toggleProjectSearch();
            if (opened) {
                window.setTimeout(function () {
                    const input = shadow.querySelector('[data-field="projectSearchInput"]');
                    if (input) input.focus();
                }, 0);
            }
        });
        shadow.querySelector('[data-action="closeProjectSearch"]').addEventListener('click', function () {
            ctx.closeProjectSearch();
            ctx.renderSoon();
        });
        shadow.querySelector('[data-field="projectSearchInput"]').addEventListener('input', function (event) {
            ctx.setProjectSearchQuery(event.currentTarget.value);
        });
        shadow.querySelector('[data-field="projectSearchInput"]').addEventListener('keydown', function (event) {
            if (event.key !== 'Escape') return;
            ctx.closeProjectSearch();
            ctx.renderSoon();
        });
        shadow.querySelector('[data-field="projectSearchResults"]').addEventListener('click', function (event) {
            const button = event.target.closest('[data-project-search-id]');
            if (!button) return;
            ctx.selectProjectSearchResult(button.getAttribute('data-project-search-id'));
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
        shadow.querySelector('[data-action="createProjectAnyway"]').addEventListener('click', function () {
            ctx.saveProjectFromForm(shadow);
        });
        shadow.querySelector('[data-field="projectSuggestionsList"]').addEventListener('click', function (event) {
            const button = event.target.closest('[data-project-id]');
            if (!button) return;
            ctx.selectProject(button.getAttribute('data-project-id'));
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
            if (statusEl) statusEl.textContent = 'Проверка соединения…';
            if (testButton) testButton.disabled = true;

            const runTest = typeof ctx.testSheetsConnection === 'function'
                ? ctx.testSheetsConnection()
                : Promise.reject(new Error('sheets module not ready'));

            runTest.then(function () {
                if (statusEl) statusEl.textContent = 'Соединение OK';
            }).catch(function () {
                // sheetsLastError updated in sendSheetsRequest
            }).finally(function () {
                if (testButton) testButton.disabled = false;
                ctx.renderSoon();
            });
        });
        shadow.querySelector('[data-action="retrySheetsSync"]').addEventListener('click', function () {
            applySheetsFieldsFromForm(ctx, shadow);
            Promise.all([ctx.retryFailedSyncs(), ctx.retryProjectSyncs()]).then(function () {
                ctx.renderSoon();
            });
        });
        shadow.querySelector('[data-action="refreshSheetsData"]').addEventListener('click', function () {
            applySheetsFieldsFromForm(ctx, shadow);
            const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
            const refreshButton = shadow.querySelector('[data-action="refreshSheetsData"]');
            if (statusEl) statusEl.textContent = 'Обновление данных…';
            if (refreshButton) refreshButton.disabled = true;
            Promise.resolve(ctx.refreshSheetsData()).catch(function () {}).then(function () {
                if (refreshButton) refreshButton.disabled = false;
                ctx.renderSoon();
            });
        });
        shadow.querySelector('[data-action="resetSettings"]').addEventListener('click', function () {
            ctx.resetSettings();
        });
        installPanelDrag(host, shadow.querySelector('.header'));

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
            const label = ctx.runtime.panelCollapsed ? 'Развернуть панель' : 'Свернуть панель';
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
            if (event.target && event.target.closest && event.target.closest('button, input, select, textarea, a, [role="button"]')) {
                return;
            }
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
