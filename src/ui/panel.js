import { PANEL_KEY, UI_KEY } from '../core/constants.js';
import { readJson, writeJson } from '../core/storage.js';
import { iconSvg } from './icons.js';
import { PANEL_STYLES } from './panel-styles.js';
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

function installPanelListeners(ctx, shadow, setPanelCollapsed) {
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

    shadow.addEventListener('click', function (event) {
        const actionEl = event.target.closest('[data-action]');
        if (!actionEl) return;
        const action = actionEl.getAttribute('data-action');

        switch (action) {
            case 'reset':
                ctx.resetSession();
                break;
            case 'resetAll':
                ctx.resetAll();
                break;
            case 'undoSpend':
                ctx.undoLastSpend();
                break;
            case 'openUndoProjectPicker':
                event.stopPropagation();
                if (ctx.openUndoProjectPicker()) {
                    window.setTimeout(function () {
                        const input = shadow.querySelector('[data-field="undoProjectSearch"]');
                        if (input) input.focus();
                    }, 0);
                }
                break;
            case 'applyUndoProject': {
                const select = shadow.querySelector('[data-field="undoProjectSelect"]');
                ctx.applyUndoProject(select ? select.value : '');
                break;
            }
            case 'cancelUndoProject':
                ctx.resumeUndoProjectPicker();
                break;
            case 'openUndoProjectCreator':
                if (ctx.openUndoProjectCreator()) {
                    window.setTimeout(function () {
                        const input = shadow.querySelector('[data-field="undoProjectCreateName"]');
                        if (input) {
                            input.focus();
                            input.select();
                        }
                    }, 0);
                }
                break;
            case 'backUndoProjectPicker':
                ctx.closeUndoProjectCreator();
                break;
            case 'cancelUndoProjectCreate':
                ctx.resumeUndoProjectPicker();
                break;
            case 'createUndoProject':
                createProjectFromUndoInputs();
                break;
            case 'closeUndoToast':
                ctx.hideUndoSpend();
                break;
            case 'showVersions':
                event.preventDefault();
                event.stopPropagation();
                ctx.setActiveTab('settings');
                window.setTimeout(function () {
                    const versionsAcc = shadow.querySelector('[data-acc="versions"]');
                    if (versionsAcc) versionsAcc.classList.add('open');
                }, 60);
                break;
            case 'clearProject':
                ctx.clearProject();
                break;
            case 'toggleProjectSearch': {
                const opened = ctx.toggleProjectSearch();
                if (opened) {
                    window.setTimeout(function () {
                        const input = shadow.querySelector('[data-field="projectSearchInput"]');
                        if (input) input.focus();
                    }, 0);
                }
                break;
            }
            case 'closeProjectSearch':
                ctx.closeProjectSearch();
                ctx.renderSoon();
                break;
            case 'editProject':
                ctx.openProjectEditor();
                break;
            case 'cancelProjectEdit':
                ctx.syncProjectDraftFromActive();
                ctx.closeProjectEditor();
                break;
            case 'newProject':
                ctx.beginNewProjectForm(shadow);
                break;
            case 'deleteProject':
                ctx.deleteSelectedProject(shadow);
                break;
            case 'saveProject':
            case 'createProjectAnyway':
                ctx.saveProjectFromForm(shadow);
                break;
            case 'toggleCollapse':
                event.stopPropagation();
                setPanelCollapsed(!ctx.runtime.panelCollapsed);
                break;
            case 'toggleSettingsAcc': {
                const acc = actionEl.closest('[data-acc]');
                if (acc) {
                    const open = acc.classList.toggle('open');
                    const toggle = acc.querySelector('.histAccToggle, .accHead');
                    if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
                }
                break;
            }
            case 'toggleProjectFilter':
                event.stopPropagation();
                ctx.setProjectFilterEnabled(!ctx.isProjectFilterActive());
                break;
            case 'testSheetsConnection':
                applySheetsFieldsFromForm(ctx, shadow);
                {
                    const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
                    const testButton = shadow.querySelector('[data-action="testSheetsConnection"]');
                    if (statusEl) statusEl.textContent = 'Проверка соединения…';
                    if (testButton) testButton.disabled = true;
                    const runTest = typeof ctx.testSheetsConnection === 'function'
                        ? ctx.testSheetsConnection()
                        : Promise.reject(new Error('sheets module not ready'));
                    runTest.then(function () {
                        if (statusEl) statusEl.textContent = 'Соединение OK';
                    }).catch(function () {}).finally(function () {
                        if (testButton) testButton.disabled = false;
                        ctx.renderSoon();
                    });
                }
                break;
            case 'retrySheetsSync':
                applySheetsFieldsFromForm(ctx, shadow);
                Promise.all([ctx.retryFailedSyncs(), ctx.retryProjectSyncs()]).then(function () {
                    ctx.renderSoon();
                });
                break;
            case 'refreshSheetsData':
                applySheetsFieldsFromForm(ctx, shadow);
                {
                    const statusEl = shadow.querySelector('[data-field="settingSheetsStatus"]');
                    const refreshButton = shadow.querySelector('[data-action="refreshSheetsData"]');
                    if (statusEl) statusEl.textContent = 'Обновление данных…';
                    if (refreshButton) refreshButton.disabled = true;
                    Promise.resolve(ctx.refreshSheetsData()).catch(function () {}).then(function () {
                        if (refreshButton) refreshButton.disabled = false;
                        ctx.renderSoon();
                    });
                }
                break;
            case 'resetSettings':
                ctx.resetSettings();
                break;
            default:
                break;
        }
    });

    shadow.querySelector('[data-field="undoProjectSearch"]').addEventListener('input', function (event) {
        const select = shadow.querySelector('[data-field="undoProjectSelect"]');
        ctx.setUndoProjectSearchQuery(event.currentTarget.value, select ? select.value : '');
    });
    shadow.querySelector('[data-field="undoProjectSelect"]').addEventListener('change', function (event) {
        ctx.setUndoPendingProject(event.currentTarget.value);
    });
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
    Array.from(shadow.querySelectorAll('[data-tab]')).forEach(function (button) {
        button.addEventListener('click', function () {
            ctx.setActiveTab(button.getAttribute('data-tab'));
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
}

export function createPanelModule(ctx) {
    function getPanelMount() {
        return document.documentElement || document.body || null;
    }

    function createPanel() {
        const mount = getPanelMount();
        if (!mount) return;
        if (ctx.runtime.panelHost) {
            const existingShadow = ctx.runtime.panelHost.shadowRoot;
            const needsRecreate = existingShadow && (
                !existingShadow.querySelector('.summaryChips')
                || existingShadow.querySelector('.statChip')
                || existingShadow.querySelector('.summaryStats')
                || existingShadow.querySelector('.summaryTop')
                || existingShadow.querySelector('[data-field="source"]')
            );
            if (needsRecreate) {
                ctx.runtime.panelHost.remove();
                ctx.runtime.panelHost = null;
                ctx.runtime.shadowRoot = null;
            } else {
                if (!ctx.runtime.panelHost.isConnected) {
                    mount.appendChild(ctx.runtime.panelHost);
                }
                if (existingShadow) {
                    const styleEl = existingShadow.querySelector('style');
                    if (styleEl) styleEl.textContent = PANEL_STYLES;
                }
                return;
            }
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
            font: '13px/1.4 "Google Sans",Roboto,Arial,sans-serif'
        });
        host.style.setProperty('--ktt-idle-opacity', String((ctx.runtime.settings && ctx.runtime.settings.idleOpacity) || 0.2));

        const shadow = host.attachShadow({ mode: 'open' });
        shadow.innerHTML = [
            '<style>',
            PANEL_STYLES,
            '</style>',
            '<div class="panel' + (ctx.runtime.panelCollapsed ? ' collapsed' : '') + '">',
            '  <div class="panelAura" aria-hidden="true"></div>',
            '  <div class="header" data-drag-handle>',
            '    <div class="headerDefault" data-field="headerDefault">',
            '      <div class="headerDrag">',
            '        <span class="brandMark" aria-hidden="true">✦</span>',
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
            '    <div class="projectStrip">',
            '      <select class="field select" data-field="projectSelect" aria-label="Выбрать проект"></select>',
            '      <div class="projectActionRail" role="toolbar" aria-label="Действия с проектом">',
            '        <button type="button" class="iconBtn projectActionBtn" data-action="toggleProjectSearch" data-tooltip="Поиск проектов" aria-label="Поиск проектов">' + iconSvg('search') + '</button>',
            '        <button type="button" class="iconBtn projectActionBtn" data-action="editProject" data-tooltip="Редактировать проект" aria-label="Редактировать проект">' + iconSvg('pencil') + '</button>',
            '        <span class="projectActionSep" aria-hidden="true"></span>',
            '        <button type="button" class="iconBtn projectActionBtn projectActionBtn--accent" data-action="newProject" data-tooltip="Новый проект" aria-label="Новый проект">' + iconSvg('plus') + '</button>',
            '        <span class="projectActionSep" aria-hidden="true"></span>',
            '        <button type="button" class="iconBtn projectActionBtn projectActionBtn--danger" data-action="deleteProject" data-tooltip="Удалить проект" aria-label="Удалить проект">' + iconSvg('trash-2') + '</button>',
            '        <button type="button" class="iconBtn projectActionBtn" data-action="clearProject" data-tooltip="Сбросить проект" aria-label="Сбросить проект">' + iconSvg('x') + '</button>',
            '      </div>',
            '    </div>',
            '    <div class="projectSearchPanel" data-field="projectSearchPanel" hidden>',
            '      <div class="projectSearchInputRow">',
            '        <input class="field" data-field="projectSearchInput" type="search" placeholder="Поиск по названию">',
            '        <button type="button" class="iconBtn projectSearchClose" data-action="closeProjectSearch" data-tooltip="Закрыть поиск" aria-label="Закрыть поиск">' + iconSvg('x') + '</button>',
            '      </div>',
            '      <div class="projectSearchResults" data-field="projectSearchResults"></div>',
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
            '    <div class="tabsTrack">',
            '      <button type="button" class="tab" data-tab="summary">Сводка</button>',
            '      <button type="button" class="tab" data-tab="history">История</button>',
            '      <button type="button" class="tab" data-tab="settings">Настройки</button>',
            '    </div>',
            '  </div>',
            '  <div class="body">',
            '   <div class="tabPanel" data-panel="summary">',
            '    <div class="summaryCard" data-field="projectGrid" hidden>',
            '      <div class="summaryCardGlow" aria-hidden="true"></div>',
            '      <div class="summaryChips" data-field="projectBreakdown"></div>',
            '    </div>',
            '    <div class="sectionHead"><span class="sectionTitle">Последние</span></div>',
            '    <div class="events" data-field="events"></div>',
            '   </div>',
            '   <div class="tabPanel" data-panel="history">',
            '    <div class="acc historyAcc open" data-acc="history">',
            '      <div class="histAccBar">',
            '        <button type="button" class="accHead histAccToggle" data-action="toggleSettingsAcc" aria-expanded="true">',
            '          <div class="histHeader" data-field="historyHeader"></div>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="histAccFilter" data-field="historyFilter"></div>',
            '      </div>',
            '      <div class="accBody histAccBody">',
            '        <div class="history" data-field="history"></div>',
            '      </div>',
            '    </div>',
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
            '          <label class="m3Check settingsCheck">',
            '            <input type="checkbox" data-field="settingRememberPosition">',
            '            <span class="m3CheckBox" aria-hidden="true"></span>',
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
            '          <label class="m3Check settingsCheck">',
            '            <input type="checkbox" data-field="settingSheetsEnabled">',
            '            <span class="m3CheckBox" aria-hidden="true"></span>',
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
            '      <div class="acc" data-acc="data">',
            '        <button type="button" class="accHead" data-action="toggleSettingsAcc">',
            '          <span class="accTitle">Данные</span>',
            '          <span class="accMeta">2</span>',
            '          <span class="accChevron">' + iconSvg('chevron-down') + '</span>',
            '        </button>',
            '        <div class="accBody">',
            '          <div class="settingsActions settingsActions--pair">',
            '            <button type="button" data-action="reset">Сбросить сессию</button>',
            '            <button type="button" data-action="resetAll">Сбросить всё</button>',
            '          </div>',
            '        </div>',
            '      </div>',
            '      <button type="button" class="settingsReset" data-action="resetSettings">Сбросить настройки</button>',
            '    </div>',
            '   </div>',
            '  </div>',
            '</div>'
        ].join('');

        installPanelListeners(ctx, shadow, setPanelCollapsed);
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
