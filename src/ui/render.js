import { eventMatchesProject } from '../core/projects.js';
import { VERSION, VERSION_HISTORY, SPEND_UNDO_WINDOW_MS } from '../core/constants.js';
import { getTodayTotal as sumTodayForService } from '../core/events.js';
import { sanitizeProject } from '../core/project-model.js';
import { needsSheetsNickname } from '../core/settings.js';
import { compactText, escapeHtml, escapeRegExp } from '../lib/utils.js';
import { isFiniteCredit, normalizeCredit } from '../lib/credits.js';
import { iconSvg } from './icons.js';

function formatCredit(value) {
    if (!isFiniteCredit(Number(value))) return '-';
    const rounded = normalizeCredit(value);
    return rounded.toLocaleString(undefined, {
        maximumFractionDigits: 3
    });
}

function formatTime(ts) {
    try {
        return new Date(ts).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (_) {
        return '';
    }
}

export function getUndoVisualState(undo, now) {
    const current = Number(now || Date.now());
    const expiresAt = Number(undo && undo.expiresAt || 0);
    const startedAt = Number(undo && undo.startedAt || (expiresAt - SPEND_UNDO_WINDOW_MS));
    const paused = undo && undo.pickerOpen === true;
    const remainingMs = paused
        ? Math.max(0, Number(undo.remainingMs || 0))
        : Math.max(0, expiresAt - current);
    return {
        visible: remainingMs > 0,
        seconds: Math.max(0, Math.ceil(remainingMs / 1000)),
        progress: Math.max(0, Math.min(1, remainingMs / SPEND_UNDO_WINDOW_MS)),
        fresh: !paused && remainingMs > 0 && current - startedAt < 2200,
        paused: paused
    };
}

export function createRender(ctx) {
    function getDisplaySource() {
        if (ctx.runtime.sourceSeen.network && ctx.runtime.sourceSeen.ui) return 'mixed';
        if (ctx.runtime.sourceSeen.network) return 'network';
        if (ctx.runtime.sourceSeen.ui) return 'ui';
        return ctx.runtime.balanceSource || 'none';
    }

    function getTodayTotal() {
        return sumTodayForService(ctx.getHistory(), ctx.getActiveAdapter().id);
    }

    function hasDisplayMetadata(event) {
        const metadata = (event && event.metadata) || {};
        return ['resolution', 'duration', 'outputs', 'audio', 'mode', 'aspectRatio', 'model', 'prompt'].some(function (key) {
            return metadata[key] != null && metadata[key] !== '';
        });
    }

    function cleanUiDetailText(text, event) {
        let result = compactText(text);
        if (!result) return '';

        if (event && event.project && event.project.name) {
            const projectName = compactText(event.project.name);
            if (projectName) {
                result = result.replace(new RegExp('^' + escapeRegExp(projectName) + '\\s*·\\s*', 'i'), '');
                if (result.toLowerCase() === projectName.toLowerCase()) return '';
            }
        }

        result = result.replace(/\b(\d+\s*(?:generate|生成|創建|创建))(?:\s+\1\b)+/gi, '$1');

        const half = Math.floor(result.length / 2);
        if (half > 20) {
            const first = result.slice(0, half).trim();
            const second = result.slice(half).trim();
            if (first && first === second) result = first;
        }

        return result.slice(0, 180);
    }

    function getHistoryPills(event, options) {
        options = options || {};
        const metadata = event.metadata || {};
        const pills = [
            event.source || 'unknown'
        ];
        if (event.user) pills.push('by ' + event.user);
        if (event.estimated) pills.push('estimated');
        if (!options.hideProjectPill && event.project && event.project.name) {
            pills.push('project: ' + event.project.name);
        }
        ['resolution', 'duration', 'outputs', 'audio', 'mode', 'aspectRatio', 'model'].forEach(function (key) {
            if (metadata[key] == null || metadata[key] === '') return;
            pills.push(key + ': ' + metadata[key]);
        });
        return pills;
    }

    function setText(root, field, value) {
        const el = root.querySelector('[data-field="' + field + '"]');
        if (el) el.textContent = String(value);
    }

    function setActiveTab(tab) {
        ctx.runtime.activeTab = tab === 'history' || tab === 'settings' ? tab : 'summary';
        ctx.saveUiState();
        renderSoon();
    }

    function getHistorySourceClass(event) {
        const sourceType = event.source || 'default';
        if (sourceType === 'ui' || sourceType === 'mixed' || sourceType === 'network') {
            return ' histItem--' + sourceType;
        }
        return '';
    }

    function createHistoryItem(event, context) {
        context = context || {};
        const item = document.createElement('div');
        item.className = 'histItem' + getHistorySourceClass(event);
        if (context.hasProject && !context.filterOn && eventMatchesProject(event, context.activeProject)) {
            item.className += ' histItem--matched';
        }

        const body = document.createElement('div');
        body.className = 'histBody';

        const header = document.createElement('div');
        header.className = 'histHead';

        const main = document.createElement('div');
        main.className = 'histMain';

        const amount = document.createElement('div');
        amount.className = 'histAmount';
        amount.textContent = '−' + formatCredit(event.amount) + (event.estimated ? ' est.' : '');

        const sub = document.createElement('div');
        sub.className = 'histSub';

        const time = document.createElement('span');
        time.className = 'histTime';
        time.textContent = formatTime(event.ts);

        const service = document.createElement('span');
        service.className = 'histService';
        service.textContent = event.serviceName || event.service || ctx.getActiveAdapter().name;

        sub.appendChild(time);
        sub.appendChild(service);
        main.appendChild(amount);
        main.appendChild(sub);

        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'iconBtn miniBtn histDelete';
        deleteButton.setAttribute('aria-label', 'Удалить трату');
        deleteButton.setAttribute('data-tooltip', 'Удалить трату');
        deleteButton.innerHTML = iconSvg('trash-2');
        deleteButton.addEventListener('click', function (clickEvent) {
            clickEvent.preventDefault();
            clickEvent.stopPropagation();
            ctx.deleteSpendEvent(event.id);
        });

        header.appendChild(main);
        header.appendChild(deleteButton);
        body.appendChild(header);

        const pills = getHistoryPills(event, { hideProjectPill: context.filterOn === true });
        if (pills.length) {
            const meta = document.createElement('div');
            meta.className = 'histMeta';
            pills.forEach(function (text) {
                const pill = document.createElement('span');
                pill.className = 'pill';
                pill.textContent = text;
                meta.appendChild(pill);
            });
            body.appendChild(meta);
        }

        const detailText = event.metadata && event.metadata.prompt
            ? compactText(event.metadata.prompt).slice(0, 180)
            : (hasDisplayMetadata(event)
                ? ''
                : cleanUiDetailText(event.detail, event));
        const showProjectLink = event.project && event.project.url;
        const showDetail = !!detailText;

        if (showProjectLink || showDetail) {
            const raw = document.createElement('div');
            raw.className = 'raw';
            if (showProjectLink) {
                const link = document.createElement('a');
                link.href = event.project.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.className = 'rawLink';
                link.textContent = event.project.name || event.project.url;
                raw.appendChild(link);
                if (showDetail) raw.appendChild(document.createTextNode(' · ' + detailText));
            } else {
                raw.textContent = detailText;
            }
            body.appendChild(raw);
        }

        item.appendChild(body);
        return item;
    }

    function renderProjectSummary(root, activeProject, hasProject) {
        const projectGrid = root.querySelector('[data-field="projectGrid"]');
        const breakdownEl = root.querySelector('[data-field="projectBreakdown"]');
        if (!projectGrid) return;

        if (breakdownEl) breakdownEl.textContent = '';
        if (!hasProject) {
            projectGrid.hidden = true;
            return;
        }

        const totals = ctx.getProjectTotalsByService(activeProject);
        projectGrid.hidden = !totals.length;
        if (!breakdownEl || !totals.length) return;

        totals.forEach(function (item) {
            const chip = document.createElement('span');
            chip.className = 'serviceChip';
            chip.innerHTML = '<span class="serviceChipName">' + escapeHtml(item.serviceName || item.service) + '</span>'
                + '<span class="serviceChipValue">−' + formatCredit(item.total) + '</span>';
            breakdownEl.appendChild(chip);
        });
    }

    function renderTabs(root) {
        Array.from(root.querySelectorAll('[data-tab]')).forEach(function (button) {
            button.classList.toggle('active', button.getAttribute('data-tab') === ctx.runtime.activeTab);
        });
        Array.from(root.querySelectorAll('[data-panel]')).forEach(function (panel) {
            panel.classList.toggle('active', panel.getAttribute('data-panel') === ctx.runtime.activeTab);
        });
    }

    function renderHistory(root, activeProject, hasProject, filterOn) {
        const historyEl = root.querySelector('[data-field="history"]');
        const historyHeader = root.querySelector('[data-field="historyHeader"]');
        const historyFilter = root.querySelector('[data-field="historyFilter"]');
        const historyAcc = root.querySelector('[data-acc="history"]');
        if (!historyEl) return;

        if (historyAcc) {
            const toggle = historyAcc.querySelector('.histAccToggle');
            if (toggle) {
                toggle.setAttribute('aria-expanded', historyAcc.classList.contains('open') ? 'true' : 'false');
            }
        }

        if (historyHeader) {
            historyHeader.textContent = '';

            const top = document.createElement('div');
            top.className = 'histHeaderTop';

            const left = document.createElement('div');
            left.className = 'histHeaderLeft';

            if (hasProject) {
                const projectTotal = ctx.getProjectAllTimeTotal(activeProject);
                const projectCount = ctx.getProjectEventCount(activeProject);
                if (filterOn) {
                    const badge = document.createElement('span');
                    badge.className = 'histFilterBadge';
                    badge.textContent = 'Проект';
                    left.appendChild(badge);

                    const summary = document.createElement('span');
                    summary.className = 'histHeaderSummary';
                    summary.innerHTML = '<strong>−' + formatCredit(projectTotal) + '</strong>'
                        + ' · ' + projectCount + ' соб.';
                    left.appendChild(summary);
                } else {
                    const summary = document.createElement('span');
                    summary.className = 'histHeaderSummary';
                    summary.innerHTML = '<strong>' + escapeHtml(activeProject.name) + '</strong>'
                        + ' · −' + formatCredit(projectTotal);
                    left.appendChild(summary);
                }
            } else {
                const summary = document.createElement('span');
                summary.className = 'histHeaderSummary';
                summary.textContent = 'Вся история';
                left.appendChild(summary);
            }
            top.appendChild(left);
            historyHeader.appendChild(top);

            const meta = document.createElement('div');
            meta.className = 'histHeaderMeta';
            meta.textContent = formatCredit(ctx.getSession().total || 0)
                + ' · ' + formatCredit(getTodayTotal());
            historyHeader.appendChild(meta);
        }

        if (historyFilter) {
            historyFilter.textContent = '';
            if (hasProject) {
                const toggle = document.createElement('button');
                toggle.type = 'button';
                toggle.className = 'histShowAll' + (filterOn ? ' active' : '');
                toggle.setAttribute('data-action', 'toggleProjectFilter');
                toggle.textContent = filterOn ? 'Проект' : 'Все';
                historyFilter.appendChild(toggle);
            }
        }

        historyEl.textContent = '';
        const history = ctx.getHistory();
        const displayEvents = filterOn ? ctx.getFilteredHistory(activeProject) : history;

        if (!displayEvents.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = filterOn
                ? 'Нет трат по этому проекту'
                : 'История пуста';
            historyEl.appendChild(empty);
            return;
        }

        displayEvents.slice(0, ctx.getSettings().historyDisplayLimit).forEach(function (event) {
            historyEl.appendChild(createHistoryItem(event, {
                activeProject: activeProject,
                hasProject: hasProject,
                filterOn: filterOn
            }));
        });
    }

    function renderProjectFields(root) {
        const active = root.activeElement;
        const nameInput = root.querySelector('[data-field="projectName"]');
        const urlInput = root.querySelector('[data-field="projectUrl"]');
        const select = root.querySelector('[data-field="projectSelect"]');
        const hint = root.querySelector('[data-field="projectHint"]');
        const deleteButton = root.querySelector('[data-action="deleteProject"]');
        const editButton = root.querySelector('[data-action="editProject"]');
        const projectBox = root.querySelector('[data-field="projectBox"]');
        const suggestionsBox = root.querySelector('[data-field="projectSuggestions"]');
        const suggestionsTitle = root.querySelector('[data-field="projectSuggestionsTitle"]');
        const suggestionsList = root.querySelector('[data-field="projectSuggestionsList"]');
        const saveButton = root.querySelector('[data-field="saveProjectButton"]');
        const searchPanel = root.querySelector('[data-field="projectSearchPanel"]');
        const searchInput = root.querySelector('[data-field="projectSearchInput"]');
        const searchResults = root.querySelector('[data-field="projectSearchResults"]');
        const searchButton = root.querySelector('[data-action="toggleProjectSearch"]');
        const activeProject = ctx.runtime.project || sanitizeProject({});
        const activeId = activeProject.id && ctx.findProjectById(activeProject.id) ? activeProject.id : '';
        const compact = ctx.shouldCompactProject();
        const hasProject = ctx.hasActiveProject();
        const projectLibrary = ctx.listProjects();

        if (projectBox) {
            projectBox.classList.toggle('compact', compact);
            projectBox.classList.toggle('filterOn', false);
        }

        if (select && active !== select) {
            select.textContent = '';
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '— Нет активного проекта —';
            select.appendChild(emptyOption);
            projectLibrary.forEach(function (entry) {
                const option = document.createElement('option');
                option.value = entry.id;
                option.textContent = ctx.formatProjectOptionLabel(entry);
                select.appendChild(option);
            });
            select.value = activeId;
        }

        if (nameInput && active !== nameInput) nameInput.value = ctx.runtime.projectDraft.name || '';
        if (urlInput && active !== urlInput) urlInput.value = ctx.runtime.projectDraft.url || '';

        const searchOpen = ctx.runtime.projectSearchOpen === true;
        if (searchPanel) searchPanel.hidden = !searchOpen;
        if (searchButton) searchButton.classList.toggle('is-active', searchOpen);
        if (searchInput && active !== searchInput) {
            searchInput.value = ctx.runtime.projectSearchQuery || '';
        }
        if (searchResults) {
            searchResults.textContent = '';
            if (searchOpen) {
                const results = ctx.searchProjects(ctx.runtime.projectSearchQuery, 5);
                if (!results.length) {
                    const empty = document.createElement('div');
                    empty.className = 'projectSearchEmpty';
                    empty.textContent = 'Проекты не найдены';
                    searchResults.appendChild(empty);
                }
                results.forEach(function (entry) {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'projectSearchResult';
                    button.setAttribute('data-project-search-id', entry.id);
                    const name = document.createElement('span');
                    name.className = 'projectSearchResultName';
                    name.textContent = entry.name;
                    const meta = document.createElement('span');
                    meta.className = 'projectSearchResultMeta';
                    try {
                        meta.textContent = new Date(entry.createdAt).toLocaleDateString();
                    } catch (_) {
                        meta.textContent = '';
                    }
                    button.appendChild(name);
                    button.appendChild(meta);
                    searchResults.appendChild(button);
                });
            }
        }

        const suggestions = ctx.runtime.projectEditorOpen && !activeId
            ? ctx.getProjectSuggestions(
                ctx.runtime.projectDraft.name,
                ctx.runtime.projectDraft.url,
                ''
            )
            : [];
        if (suggestionsBox) suggestionsBox.hidden = suggestions.length === 0;
        if (saveButton) saveButton.hidden = suggestions.length > 0;
        if (suggestionsTitle) {
            suggestionsTitle.textContent = suggestions.some(function (entry) { return entry.matchExact; })
                ? 'Такой проект уже есть. Выберите его или подтвердите создание нового.'
                : 'Возможно, такой проект уже есть:';
        }
        if (suggestionsList) {
            suggestionsList.textContent = '';
            suggestions.forEach(function (entry) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'projectSuggestion' + (entry.matchExact ? ' exact' : '');
                button.setAttribute('data-project-id', entry.id);

                const main = document.createElement('span');
                main.className = 'projectSuggestionMain';
                const name = document.createElement('span');
                name.className = 'projectSuggestionName';
                name.textContent = entry.name;
                const meta = document.createElement('span');
                meta.className = 'projectSuggestionMeta';
                meta.textContent = [entry.url, entry.updatedBy ? 'by ' + entry.updatedBy : ''].filter(Boolean).join(' · ');
                const action = document.createElement('span');
                action.className = 'projectSuggestionAction';
                action.textContent = 'Выбрать';
                main.appendChild(name);
                main.appendChild(meta);
                button.appendChild(main);
                button.appendChild(action);
                suggestionsList.appendChild(button);
            });
        }

        const selectedId = select ? select.value : '';
        if (deleteButton) {
            deleteButton.disabled = !selectedId;
            deleteButton.classList.toggle('is-disabled', !selectedId);
        }
        if (editButton) {
            editButton.disabled = !selectedId;
            editButton.classList.toggle('is-disabled', !selectedId);
        }

        if (hint) {
            if (activeId && activeProject.name) {
                hint.textContent = 'Активный: ' + activeProject.name;
            } else if (projectLibrary.length) {
                hint.textContent = 'Выберите сохранённый проект или сохраните новый.';
            } else {
                hint.textContent = 'Создайте первый проект и сохраните его в список.';
            }
        }
    }

    function renderSettingsTab(root) {
        const settings = ctx.getSettings();
        const active = root.activeElement;
        const opacityInput = root.querySelector('[data-field="settingIdleOpacity"]');
        const opacityValue = root.querySelector('[data-field="settingIdleOpacityValue"]');
        const summarySelect = root.querySelector('[data-field="settingSummaryEvents"]');
        const historySelect = root.querySelector('[data-field="settingHistoryLimit"]');
        const widthSelect = root.querySelector('[data-field="settingPanelWidth"]');
        const rememberCheckbox = root.querySelector('[data-field="settingRememberPosition"]');

        const opacityPercent = Math.round(settings.idleOpacity * 100);
        if (opacityInput && active !== opacityInput) {
            opacityInput.value = String(opacityPercent);
        }
        if (opacityValue) {
            opacityValue.textContent = opacityPercent + '%';
        }
        if (summarySelect && active !== summarySelect) {
            summarySelect.value = String(settings.summaryEventsCount);
        }
        if (historySelect && active !== historySelect) {
            historySelect.value = String(settings.historyDisplayLimit);
        }
        if (widthSelect && active !== widthSelect) {
            widthSelect.value = String(settings.panelWidth);
        }
        if (rememberCheckbox && active !== rememberCheckbox) {
            rememberCheckbox.checked = settings.rememberPanelPosition === true;
        }

        const panelMeta = root.querySelector('[data-field="settingAccMetaPanel"]');
        if (panelMeta) {
            panelMeta.textContent = opacityPercent + '% · ' + settings.panelWidth + 'px';
        }
        const displayMeta = root.querySelector('[data-field="settingAccMetaDisplay"]');
        if (displayMeta) {
            displayMeta.textContent = settings.summaryEventsCount + ' · ' + settings.historyDisplayLimit;
        }
        const sheetsMeta = root.querySelector('[data-field="settingAccMetaSheets"]');
        if (sheetsMeta) {
            if (settings.sheetsLastError) {
                sheetsMeta.textContent = 'ошибка';
            } else if (needsSheetsNickname(settings)) {
                sheetsMeta.textContent = 'нужно имя';
            } else if (settings.sheetsEnabled) {
                sheetsMeta.textContent = settings.sheetsNickname || 'вкл';
            } else {
                sheetsMeta.textContent = 'выкл';
            }
        }
        const versionsMeta = root.querySelector('[data-field="settingAccMetaVersions"]');
        if (versionsMeta) {
            versionsMeta.textContent = 'v' + VERSION;
        }

        renderVersionHistory(root);

        const sheetsEnabled = root.querySelector('[data-field="settingSheetsEnabled"]');
        const sheetsNickname = root.querySelector('[data-field="settingSheetsNickname"]');
        const sheetsUrl = root.querySelector('[data-field="settingSheetsWebAppUrl"]');
        const sheetsToken = root.querySelector('[data-field="settingSheetsSecretToken"]');
        const sheetsStatus = root.querySelector('[data-field="settingSheetsStatus"]');

        if (sheetsEnabled && active !== sheetsEnabled) {
            sheetsEnabled.checked = settings.sheetsEnabled === true;
        }
        if (sheetsNickname && active !== sheetsNickname) {
            sheetsNickname.value = settings.sheetsNickname || '';
        }
        if (sheetsUrl && active !== sheetsUrl) {
            sheetsUrl.value = settings.sheetsWebAppUrl || '';
        }
        if (sheetsToken && active !== sheetsToken) {
            sheetsToken.value = settings.sheetsSecretToken || '';
        }
        if (sheetsStatus) {
            const testButton = root.querySelector('[data-action="testSheetsConnection"]');
            if (testButton && testButton.disabled) return;

            if (settings.sheetsLastError) {
                sheetsStatus.textContent = settings.sheetsLastError;
            } else if (settings.sheetsLastSyncAt) {
                sheetsStatus.textContent = 'OK · ' + formatTime(settings.sheetsLastSyncAt);
            } else if (!settings.sheetsEnabled) {
                sheetsStatus.textContent = 'Синхронизация выкл';
            } else if (!String(settings.sheetsSecretToken || '').trim()) {
                sheetsStatus.textContent = 'Введите токен → Проверить';
            } else if (!String(settings.sheetsNickname || '').trim()) {
                sheetsStatus.textContent = 'Введите имя';
            } else {
                sheetsStatus.textContent = 'Готово';
            }
        }
    }

    function renderVersionHistory(root) {
        const versionBadge = root.querySelector('[data-field="versionBadge"]');
        if (versionBadge) {
            versionBadge.textContent = 'v' + VERSION;
        }

        const list = root.querySelector('[data-field="versionHistory"]');
        if (!list || list.getAttribute('data-rendered-version') === VERSION) return;
        list.textContent = '';
        VERSION_HISTORY.forEach(function (entry) {
            const item = document.createElement('div');
            item.className = 'versionItem';

            const top = document.createElement('div');
            top.className = 'versionTop';
            const version = document.createElement('span');
            version.textContent = 'v' + entry.version;
            const date = document.createElement('span');
            date.className = 'versionDate';
            date.textContent = entry.date || '';
            top.appendChild(version);
            top.appendChild(date);

            const changes = document.createElement('ul');
            changes.className = 'versionChanges';
            (entry.changes || []).slice(0, 3).forEach(function (change) {
                const li = document.createElement('li');
                li.textContent = change;
                changes.appendChild(li);
            });

            item.appendChild(top);
            item.appendChild(changes);
            list.appendChild(item);
        });
        list.setAttribute('data-rendered-version', VERSION);
    }

    function renderUndoToast(root) {
        const toast = root.querySelector('[data-field="undoToast"]');
        const panel = root.querySelector('.panel');
        if (!toast || !panel) return;
        const undo = ctx.runtime.undoSpend;
        const now = Date.now();
        const visual = getUndoVisualState(undo, now);
        const visible = !!(undo && visual.visible);
        if (!visible) {
            ctx.runtime.undoSpend = null;
        }
        panel.classList.toggle('undo-active', visible);
        panel.classList.toggle('undo-fresh', visible && visual.fresh);
        panel.classList.toggle('undo-picking', visible && visual.paused);
        if (!visible) {
            toast.setAttribute('aria-hidden', 'true');
            return;
        }

        const projectName = root.querySelector('[data-field="undoProjectName"]');
        if (projectName) projectName.textContent = (undo.projectName || 'Без проекта') + ' ▾';
        const meta = root.querySelector('[data-field="undoMeta"]');
        if (meta) {
            meta.textContent = '-' + formatCredit(undo.amount) + ' · ' + (undo.serviceName || 'spend') + ' · ' + visual.seconds + 's';
        }
        const progressBar = root.querySelector('[data-field="undoProgressBar"]');
        if (progressBar) progressBar.style.transform = 'scaleX(' + visual.progress.toFixed(3) + ')';
        const projectSelect = root.querySelector('[data-field="undoProjectSelect"]');
        const undoSearch = root.querySelector('[data-field="undoProjectSearch"]');
        const projectChoose = root.querySelector('[data-field="undoProjectChoose"]');
        const projectCreate = root.querySelector('[data-field="undoProjectCreate"]');
        const createName = root.querySelector('[data-field="undoProjectCreateName"]');
        const createUrl = root.querySelector('[data-field="undoProjectCreateUrl"]');
        const createButton = root.querySelector('[data-action="openUndoProjectCreator"]');
        const creatingProject = visual.paused && undo.projectCreateOpen === true;
        if (projectChoose) projectChoose.hidden = creatingProject;
        if (projectCreate) projectCreate.hidden = !creatingProject;
        if (undoSearch && root.activeElement !== undoSearch) {
            undoSearch.value = String(undo.projectSearchQuery || '');
        }
        if (createName && root.activeElement !== createName) {
            createName.value = String(undo.projectCreateName || '');
        }
        if (createUrl && root.activeElement !== createUrl) {
            createUrl.value = String(undo.projectCreateUrl || '');
        }
        if (createButton) {
            const draftName = String(undo.projectSearchQuery || '').trim();
            createButton.textContent = draftName ? '+ Создать «' + draftName + '»' : '+ Создать новый проект';
        }
        if (projectSelect && visual.paused && !creatingProject && root.activeElement !== projectSelect) {
            projectSelect.textContent = '';
            const noProject = document.createElement('option');
            noProject.value = '';
            noProject.textContent = 'Без проекта';
            projectSelect.appendChild(noProject);
            const filteredProjects = ctx.searchProjects(undo.projectSearchQuery || '');
            const selectedId = String(undo.pendingProjectId || '');
            const selectedVisible = filteredProjects.some(function (project) {
                return project.id === selectedId;
            });
            if (selectedId && !selectedVisible) {
                const current = ctx.findProjectById(selectedId);
                if (current) {
                    const currentOption = document.createElement('option');
                    currentOption.value = current.id;
                    currentOption.textContent = 'Текущий: ' + ctx.formatProjectOptionLabel(current);
                    projectSelect.appendChild(currentOption);
                }
            }
            filteredProjects.forEach(function (project) {
                const option = document.createElement('option');
                option.value = project.id;
                option.textContent = ctx.formatProjectOptionLabel(project);
                projectSelect.appendChild(option);
            });
            projectSelect.value = selectedId;
        }
        toast.setAttribute('aria-hidden', 'false');

        if (!visual.paused && !ctx.runtime.undoRenderTimer) {
            ctx.runtime.undoRenderTimer = window.setTimeout(function () {
                ctx.runtime.undoRenderTimer = null;
                renderSoon();
            }, 100);
        }
    }

    function renderPanel() {
        if (!ctx.runtime.shadowRoot) return;
        const root = ctx.runtime.shadowRoot;
        const history = ctx.getHistory();
        const activeProject = ctx.getActiveProject();
        const hasProject = ctx.hasActiveProject();
        const summaryEvents = hasProject ? ctx.getFilteredHistory(activeProject) : history;

        setText(root, 'serviceName', ctx.getActiveAdapter().name || 'none');
        setText(root, 'versionBadge', 'v' + VERSION);
        renderProjectFields(root);
        renderProjectSummary(root, activeProject, hasProject);
        renderTabs(root);
        renderSettingsTab(root);
        renderUndoToast(root);

        const nicknameWarn = root.querySelector('[data-field="sheetsNicknameWarn"]');
        if (nicknameWarn) {
            nicknameWarn.hidden = !needsSheetsNickname(ctx.getSettings());
        }

        renderRecentEvents(root, summaryEvents, hasProject);
        renderHistory(root, activeProject, hasProject, ctx.isProjectFilterActive());
    }

    function createEventChip(event) {
        const sourceType = event.source || 'default';
        const sourceClass = sourceType === 'ui' || sourceType === 'mixed' || sourceType === 'network'
            ? ' eventCard--' + sourceType
            : '';
        const row = document.createElement('div');
        row.className = 'eventCard' + sourceClass;
        row.setAttribute('data-event-id', String(event.id || ''));

        const body = document.createElement('div');
        body.className = 'eventBody';

        const time = document.createElement('span');
        time.className = 'histTime eventTime';
        time.textContent = formatTime(event.ts);

        const amount = document.createElement('span');
        amount.className = 'histAmount eventAmount';
        amount.textContent = '−' + formatCredit(event.amount) + (event.estimated ? '~' : '');

        const service = document.createElement('span');
        service.className = 'eventService';
        service.textContent = event.serviceName || event.service || ctx.getActiveAdapter().name;

        const source = document.createElement('span');
        source.className = 'source eventSource';
        source.textContent = event.source || 'unknown';

        body.appendChild(time);
        body.appendChild(amount);
        body.appendChild(service);
        body.appendChild(source);
        row.appendChild(body);
        return row;
    }

    function renderRecentEvents(root, summaryEvents, hasProject) {
        const eventsEl = root.querySelector('[data-field="events"]');
        if (!eventsEl) return;

        const nextEvents = summaryEvents.slice(0, ctx.getSettings().summaryEventsCount);
        const nextIds = nextEvents.map(function (event) {
            return String(event && event.id || '');
        });
        const prevIds = Array.isArray(ctx.runtime.summaryEventIds)
            ? ctx.runtime.summaryEventIds.slice()
            : [];

        if (!nextEvents.length) {
            eventsEl.textContent = '';
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = hasProject
                ? 'Нет трат по этому проекту'
                : 'Пока нет трат';
            eventsEl.appendChild(empty);
            ctx.runtime.summaryEventIds = [];
            return;
        }

        const sameList = prevIds.join('|') === nextIds.join('|')
            && eventsEl.querySelectorAll('.eventCard').length === nextIds.length;
        if (sameList) return;

        const firstIsNew = !!nextIds[0] && nextIds[0] !== prevIds[0];
        const shiftedTail = nextIds.slice(1).join('|') === prevIds.slice(0, Math.max(0, nextIds.length - 1)).join('|');
        const canIncremental = firstIsNew && prevIds.length > 0 && shiftedTail
            && eventsEl.querySelectorAll('.eventCard').length > 0;

        if (canIncremental) {
            const oldCards = Array.from(eventsEl.querySelectorAll('.eventCard'));
            const prevRects = new Map();
            oldCards.forEach(function (card) {
                prevRects.set(card.getAttribute('data-event-id'), card.getBoundingClientRect());
            });

            const chip = createEventChip(nextEvents[0]);
            chip.classList.add('eventCard--enter');
            eventsEl.insertBefore(chip, eventsEl.firstChild);

            while (eventsEl.querySelectorAll('.eventCard').length > nextIds.length) {
                const last = eventsEl.lastElementChild;
                if (!last || !last.classList.contains('eventCard')) break;
                eventsEl.removeChild(last);
            }

            window.requestAnimationFrame(function () {
                oldCards.forEach(function (card) {
                    if (!card.isConnected) return;
                    const prev = prevRects.get(card.getAttribute('data-event-id'));
                    if (!prev) return;
                    const nextRect = card.getBoundingClientRect();
                    const dx = prev.left - nextRect.left;
                    if (Math.abs(dx) < 1) return;
                    card.style.transform = 'translateX(' + dx + 'px)';
                    card.style.transition = 'none';
                    window.requestAnimationFrame(function () {
                        card.style.transition = 'transform .34s cubic-bezier(.4,0,.2,1)';
                        card.style.transform = '';
                        const clear = function () {
                            card.style.transition = '';
                            card.removeEventListener('transitionend', clear);
                        };
                        card.addEventListener('transitionend', clear);
                    });
                });
                if (typeof eventsEl.scrollTo === 'function') {
                    eventsEl.scrollTo({ left: 0, behavior: 'smooth' });
                } else {
                    eventsEl.scrollLeft = 0;
                }
            });

            ctx.runtime.summaryEventIds = nextIds;
            return;
        }

        eventsEl.textContent = '';
        nextEvents.forEach(function (event, index) {
            const chip = createEventChip(event);
            if (firstIsNew && prevIds.length && index === 0) {
                chip.classList.add('eventCard--enter');
            }
            eventsEl.appendChild(chip);
        });
        ctx.runtime.summaryEventIds = nextIds;
        if (firstIsNew && prevIds.length) {
            eventsEl.scrollLeft = 0;
        }
    }

    function renderSoon() {
        if (ctx.runtime.renderTimer) return;
        ctx.runtime.renderTimer = window.setTimeout(function () {
            ctx.runtime.renderTimer = null;
            renderPanel();
        }, 50);
    }

    return {
        renderSoon,
        renderPanel,
        renderHistory,
        createHistoryItem,
        renderProjectFields,
        renderProjectSummary,
        renderTabs,
        renderSettingsTab,
        renderVersionHistory,
        renderUndoToast,
        setActiveTab,
        setText,
        getDisplaySource,
        getTodayTotal,
        hasDisplayMetadata,
        cleanUiDetailText,
        getHistoryPills,
        formatCredit,
        formatTime
    };
}
