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

    function createHistoryItem(event, context) {
        context = context || {};
        const item = document.createElement('div');
        item.className = 'histItem';
        if (context.hasProject && !context.filterOn && eventMatchesProject(event, context.activeProject)) {
            item.className += ' histItem--matched';
        }

        const top = document.createElement('div');
        top.className = 'histTop';
        const left = document.createElement('div');
        left.className = 'histSpendMain';
        const time = document.createElement('span');
        time.className = 'histTime';
        time.textContent = formatTime(event.ts);
        const amount = document.createElement('span');
        amount.className = 'histAmount';
        amount.textContent = '-' + formatCredit(event.amount) + (event.estimated ? ' est.' : '');
        left.appendChild(time);
        left.appendChild(amount);
        const right = document.createElement('div');
        right.className = 'histSpendService';
        right.textContent = event.serviceName || event.service || ctx.getActiveAdapter().name;
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
        top.appendChild(left);
        top.appendChild(right);
        top.appendChild(deleteButton);

        const meta = document.createElement('div');
        meta.className = 'histMeta';
        getHistoryPills(event, { hideProjectPill: context.filterOn === true }).forEach(function (text) {
            const pill = document.createElement('span');
            pill.className = 'pill';
            pill.textContent = text;
            meta.appendChild(pill);
        });

        const detailText = event.metadata && event.metadata.prompt
            ? compactText(event.metadata.prompt).slice(0, 180)
            : (hasDisplayMetadata(event)
                ? ''
                : cleanUiDetailText(event.detail, event));
        const showProjectLink = event.project && event.project.url;
        const showDetail = !!detailText;

        item.appendChild(top);
        item.appendChild(meta);

        if (showProjectLink || showDetail) {
            const raw = document.createElement('div');
            raw.className = 'raw';
            if (showProjectLink) {
                const link = document.createElement('a');
                link.href = event.project.url;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                link.textContent = event.project.name || event.project.url;
                link.style.color = '#8eb6ff';
                link.style.textDecoration = 'none';
                raw.appendChild(link);
                if (showDetail) raw.appendChild(document.createTextNode(' · ' + detailText));
            } else {
                raw.textContent = detailText;
            }
            item.appendChild(raw);
        }

        return item;
    }

    function renderProjectSummary(root, activeProject, hasProject, filterOn) {
        const projectGrid = root.querySelector('[data-field="projectGrid"]');
        const breakdownEl = root.querySelector('[data-field="projectBreakdown"]');
        if (!projectGrid) return;

        projectGrid.hidden = !hasProject;
        if (!hasProject) return;

        const projectTotal = ctx.getProjectAllTimeTotal(activeProject);
        setText(root, 'projectTotal', '-' + formatCredit(projectTotal));

        if (!breakdownEl) return;
        breakdownEl.textContent = '';
        const totals = ctx.getProjectTotalsByService(activeProject);
        if (!totals.length) {
            const empty = document.createElement('div');
            empty.className = 'projectBreakdownEmpty';
            empty.textContent = 'Пока нет трат по платформам';
            breakdownEl.appendChild(empty);
            return;
        }
        totals.forEach(function (item) {
            const row = document.createElement('div');
            row.className = 'projectBreakdownRow';

            const name = document.createElement('div');
            name.className = 'projectBreakdownName';
            name.textContent = item.serviceName || item.service;

            const value = document.createElement('div');
            value.className = 'projectBreakdownValue';
            value.textContent = '-' + formatCredit(item.total);

            row.appendChild(name);
            row.appendChild(value);
            breakdownEl.appendChild(row);
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
        if (!historyEl) return;

        if (historyHeader) {
            historyHeader.textContent = '';
            const headerText = document.createElement('span');
            headerText.className = 'histHeaderText';
            if (hasProject) {
                const projectTotal = ctx.getProjectAllTimeTotal(activeProject);
                const projectCount = ctx.getProjectEventCount(activeProject);
                if (filterOn) {
                    headerText.innerHTML = 'Только проект · <strong>' + projectCount + ' событий</strong> · -' + formatCredit(projectTotal);
                } else {
                    headerText.innerHTML = 'Вся история · Проект: <strong>' + escapeHtml(activeProject.name) + '</strong> · -' + formatCredit(projectTotal);
                }
            } else {
                headerText.textContent = 'Вся история';
            }
            historyHeader.appendChild(headerText);

            const stats = document.createElement('span');
            stats.className = 'histStats';
            const sessionStat = document.createElement('span');
            sessionStat.className = 'histStat';
            sessionStat.textContent = 'Сессия: ' + formatCredit(ctx.getSession().total || 0);
            const todayStat = document.createElement('span');
            todayStat.className = 'histStat';
            todayStat.textContent = 'Сегодня: ' + formatCredit(getTodayTotal());
            stats.appendChild(sessionStat);
            stats.appendChild(todayStat);
            if (hasProject && filterOn) {
                const showAll = document.createElement('button');
                showAll.type = 'button';
                showAll.className = 'histShowAll';
                showAll.textContent = 'Показать всё';
                showAll.addEventListener('click', function () {
                    ctx.setProjectFilterEnabled(false);
                });
                stats.appendChild(showAll);
            }
            historyHeader.appendChild(stats);
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
        const filterRow = root.querySelector('[data-field="projectFilterRow"]');
        const filterToggle = root.querySelector('[data-field="projectFilterToggle"]');
        const miniStat = root.querySelector('[data-field="projectMiniStat"]');
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
        const filterOn = ctx.isProjectFilterActive();
        const projectLibrary = ctx.listProjects();

        if (projectBox) {
            projectBox.classList.toggle('compact', compact);
            projectBox.classList.toggle('filterOn', filterOn);
        }

        if (filterRow) {
            filterRow.classList.toggle('visible', hasProject);
        }
        if (filterToggle && document.activeElement !== filterToggle) {
            filterToggle.checked = filterOn;
            filterToggle.disabled = !hasProject;
        }
        if (miniStat) {
            miniStat.textContent = hasProject
                ? '-' + formatCredit(ctx.getProjectAllTimeTotal(activeProject)) + ' всего'
                : '';
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
        if (searchButton) searchButton.style.background = searchOpen ? 'rgba(45,108,223,.35)' : '';
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
            deleteButton.style.opacity = selectedId ? '1' : '0.45';
            deleteButton.style.pointerEvents = selectedId ? 'auto' : 'none';
        }
        if (editButton) {
            editButton.disabled = !selectedId;
            editButton.style.opacity = selectedId ? '1' : '0.45';
            editButton.style.pointerEvents = selectedId ? 'auto' : 'none';
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
        if (undoSearch && root.activeElement !== undoSearch) {
            undoSearch.value = String(undo.projectSearchQuery || '');
        }
        if (projectSelect && visual.paused && root.activeElement !== projectSelect) {
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
        const source = getDisplaySource();
        const activeProject = ctx.getActiveProject();
        const hasProject = ctx.hasActiveProject();
        const filterOn = ctx.isProjectFilterActive();
        const recentEvents = filterOn ? ctx.getFilteredHistory(activeProject) : history;

        setText(root, 'serviceName', ctx.getActiveAdapter().name || 'none');
        setText(root, 'versionBadge', 'v' + VERSION);
        setText(root, 'source', source);
        setText(root, 'balance', ctx.runtime.balance == null ? '-' : formatCredit(ctx.runtime.balance));
        renderProjectFields(root);
        renderProjectSummary(root, activeProject, hasProject, filterOn);
        renderTabs(root);
        renderSettingsTab(root);
        renderUndoToast(root);

        const nicknameWarn = root.querySelector('[data-field="sheetsNicknameWarn"]');
        if (nicknameWarn) {
            nicknameWarn.hidden = !needsSheetsNickname(ctx.getSettings());
        }

        const debugButton = root.querySelector('[data-action="debug"]');
        if (debugButton) {
            debugButton.classList.toggle('active', ctx.runtime.debug);
            debugButton.setAttribute('data-tooltip', ctx.runtime.debug ? 'Сбор отчёта отладки…' : 'Собрать отчёт отладки');
            debugButton.setAttribute('aria-label', ctx.runtime.debug ? 'Сбор отчёта отладки…' : 'Собрать отчёт отладки');
        }

        const eventsEl = root.querySelector('[data-field="events"]');
        if (!eventsEl) return;
        eventsEl.textContent = '';
        if (!recentEvents.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = filterOn
                ? 'Нет трат по этому проекту'
                : 'Пока нет трат';
            eventsEl.appendChild(empty);
            renderHistory(root, activeProject, hasProject, filterOn);
            return;
        }

        recentEvents.slice(0, ctx.getSettings().summaryEventsCount).forEach(function (event) {
            const row = document.createElement('div');
            row.className = 'event';

            const dot = document.createElement('div');
            dot.className = 'dot';
            if (event.source === 'ui') dot.style.background = '#f2b84b';
            if (event.source === 'mixed') dot.style.background = '#28b67a';
            if (event.source === 'network') dot.style.background = '#2d6cdf';

            const label = document.createElement('div');
            label.className = 'histSpendMain';
            const time = document.createElement('span');
            time.className = 'histTime';
            time.textContent = formatTime(event.ts);
            const amount = document.createElement('span');
            amount.className = 'histAmount';
            amount.textContent = '-' + formatCredit(event.amount) + (event.estimated ? ' est.' : '');
            label.appendChild(time);
            label.appendChild(amount);

            const src = document.createElement('div');
            src.className = 'source';
            src.textContent = (event.serviceName || event.service || ctx.getActiveAdapter().name) + ' · ' + (event.source || 'unknown');

            row.appendChild(dot);
            row.appendChild(label);
            row.appendChild(src);
            eventsEl.appendChild(row);
        });

        renderHistory(root, activeProject, hasProject, filterOn);
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
