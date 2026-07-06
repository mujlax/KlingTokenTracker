import { eventMatchesProject } from '../core/projects.js';
import { getTodayTotal as sumTodayForService } from '../core/events.js';
import { sanitizeProject } from '../core/project-model.js';
import { needsSheetsNickname } from '../core/settings.js';
import { compactText, escapeHtml, escapeRegExp } from '../lib/utils.js';
import { isFiniteCredit, normalizeCredit } from '../lib/credits.js';

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
        left.textContent = formatTime(event.ts) + '  -' + formatCredit(event.amount) + (event.estimated ? ' est.' : '');
        const right = document.createElement('div');
        right.textContent = event.serviceName || event.service || ctx.getActiveAdapter().name;
        top.appendChild(left);
        top.appendChild(right);

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
            empty.textContent = 'No project spend by platform yet';
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
                    headerText.innerHTML = 'Showing project only · <strong>' + projectCount + ' events</strong> · -' + formatCredit(projectTotal);
                } else {
                    headerText.innerHTML = 'All history · Project: <strong>' + escapeHtml(activeProject.name) + '</strong> · -' + formatCredit(projectTotal);
                }
            } else {
                headerText.textContent = 'All history';
            }
            historyHeader.appendChild(headerText);

            const stats = document.createElement('span');
            stats.className = 'histStats';
            const sessionStat = document.createElement('span');
            sessionStat.className = 'histStat';
            sessionStat.textContent = 'Session: ' + formatCredit(ctx.getSession().total || 0);
            const todayStat = document.createElement('span');
            todayStat.className = 'histStat';
            todayStat.textContent = 'Today: ' + formatCredit(getTodayTotal());
            stats.appendChild(sessionStat);
            stats.appendChild(todayStat);
            if (hasProject && filterOn) {
                const showAll = document.createElement('button');
                showAll.type = 'button';
                showAll.className = 'histShowAll';
                showAll.textContent = 'Show all';
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
                ? 'No spend events for this project yet'
                : 'No history yet';
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
        const activeProject = ctx.runtime.project || sanitizeProject({});
        const activeId = activeProject.id && ctx.findProjectById(activeProject.id) ? activeProject.id : '';
        const compact = ctx.shouldCompactProject();
        const hasProject = ctx.hasActiveProject();
        const filterOn = ctx.isProjectFilterActive();
        const projectLibrary = ctx.getProjectLibrary();

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
                ? '-' + formatCredit(ctx.getProjectAllTimeTotal(activeProject)) + ' total'
                : '';
        }

        if (select && active !== select) {
            select.textContent = '';
            const emptyOption = document.createElement('option');
            emptyOption.value = '';
            emptyOption.textContent = '— No active project —';
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
                hint.textContent = 'Active: ' + activeProject.name;
            } else if (projectLibrary.length) {
                hint.textContent = 'Select a saved project or save a new one.';
            } else {
                hint.textContent = 'Create your first project and save it to the list.';
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
                sheetsMeta.textContent = 'error';
            } else if (needsSheetsNickname(settings)) {
                sheetsMeta.textContent = 'need name';
            } else if (settings.sheetsEnabled) {
                sheetsMeta.textContent = settings.sheetsNickname || 'on';
            } else {
                sheetsMeta.textContent = 'off';
            }
        }

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
                sheetsStatus.textContent = 'Sync off';
            } else if (!String(settings.sheetsSecretToken || '').trim()) {
                sheetsStatus.textContent = 'Enter token → Test';
            } else if (!String(settings.sheetsNickname || '').trim()) {
                sheetsStatus.textContent = 'Enter nickname';
            } else {
                sheetsStatus.textContent = 'Ready';
            }
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
        setText(root, 'source', source);
        setText(root, 'balance', ctx.runtime.balance == null ? '-' : formatCredit(ctx.runtime.balance));
        renderProjectFields(root);
        renderProjectSummary(root, activeProject, hasProject, filterOn);
        renderTabs(root);
        renderSettingsTab(root);

        const nicknameWarn = root.querySelector('[data-field="sheetsNicknameWarn"]');
        if (nicknameWarn) {
            nicknameWarn.hidden = !needsSheetsNickname(ctx.getSettings());
        }

        const debugButton = root.querySelector('[data-action="debug"]');
        if (debugButton) {
            debugButton.classList.toggle('active', ctx.runtime.debug);
            debugButton.setAttribute('data-tooltip', ctx.runtime.debug ? 'Collecting debug report' : 'Collect debug report');
            debugButton.setAttribute('aria-label', ctx.runtime.debug ? 'Collecting debug report' : 'Collect debug report');
        }

        const eventsEl = root.querySelector('[data-field="events"]');
        if (!eventsEl) return;
        eventsEl.textContent = '';
        if (!recentEvents.length) {
            const empty = document.createElement('div');
            empty.className = 'empty';
            empty.textContent = filterOn
                ? 'No spend events for this project yet'
                : 'No spend events yet';
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
            label.textContent = formatTime(event.ts) + '  -' + formatCredit(event.amount) + (event.estimated ? ' est.' : '');

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
