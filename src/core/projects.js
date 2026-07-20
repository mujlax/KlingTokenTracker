import { PROJECT_KEY } from './constants.js';
import { readJson } from './storage.js';
import {
    sanitizeProject,
    sanitizeProjectEntry,
    sanitizeProjectLibrary
} from './project-model.js';
import {
    findProjectSuggestions,
    searchProjectsByName,
    sortProjectsByCreatedAt
} from './project-search.js';
import {
    eventMatchesProject,
    getFilteredHistory as filterHistoryByProject,
    getProjectAllTimeTotal as sumProjectHistory,
    getProjectTotalsByService as sumProjectTotalsByService,
    createId
} from './events.js';
import { deepClone } from '../lib/utils.js';

export function createProjects(ctx) {
    function findProjectRecordById(id) {
        const needle = String(id || '').trim();
        if (!needle) return null;
        const library = ctx.getProjectLibrary();
        for (let i = 0; i < library.length; i += 1) {
            if (library[i].id === needle) return library[i];
        }
        return null;
    }

    function findProjectById(id) {
        const entry = findProjectRecordById(id);
        return entry && entry.status !== 'archived' ? entry : null;
    }

    function createProjectEntry(name, url) {
        const now = Date.now();
        return sanitizeProjectEntry({
            id: createId('project'),
            name: name,
            url: url,
            status: 'active',
            createdAt: now,
            updatedAt: now,
            updatedBy: String(ctx.getSettings && ctx.getSettings().sheetsNickname || '')
        });
    }

    function listProjects() {
        return ctx.getProjectLibrary().filter(function (entry) {
            return entry.status !== 'archived';
        }).map(function (entry) {
            return deepClone(entry);
        });
    }

    function getProjectSuggestions(name, url, excludeId) {
        return findProjectSuggestions(ctx.getProjectLibrary(), {
            name: name,
            url: url
        }, {
            limit: 5,
            excludeId: excludeId
        });
    }

    function getProjectsByCreatedAt() {
        return sortProjectsByCreatedAt(ctx.getProjectLibrary()).map(function (entry) {
            return deepClone(entry);
        });
    }

    function searchProjects(name, limit) {
        return searchProjectsByName(ctx.getProjectLibrary(), name, { limit: limit }).map(function (entry) {
            return deepClone(entry);
        });
    }

    function closeProjectSearch() {
        ctx.runtime.projectSearchOpen = false;
        ctx.runtime.projectSearchQuery = '';
    }

    function toggleProjectSearch() {
        ctx.runtime.projectSearchOpen = !ctx.runtime.projectSearchOpen;
        ctx.runtime.projectSearchQuery = '';
        ctx.renderSoon();
        return ctx.runtime.projectSearchOpen;
    }

    function setProjectSearchQuery(value) {
        ctx.runtime.projectSearchQuery = String(value || '');
        ctx.renderSoon();
    }

    function selectProjectSearchResult(id) {
        closeProjectSearch();
        return selectProject(id);
    }

    function formatProjectOptionLabel(entry) {
        const name = entry.name || 'Без названия';
        if (!entry.url) return name;
        try {
            const parsed = new URL(entry.url);
            return name + ' · ' + parsed.hostname.replace(/^www\./i, '');
        } catch (_) {
            return name;
        }
    }

    function getActiveProject() {
        const project = sanitizeProject(ctx.runtime.project || {});
        if (project.id) return findProjectById(project.id) ? project : sanitizeProject({});
        if (project.name) return project;
        return sanitizeProject({});
    }

    function hasActiveProject() {
        const project = getActiveProject();
        return !!(project.id || project.name);
    }

    function isProjectFilterActive() {
        return hasActiveProject() && ctx.runtime.projectFilterEnabled === true;
    }

    function getFilteredHistory(project) {
        const needle = project || getActiveProject();
        if (!needle || !needle.name) return ctx.getHistory().slice();
        return filterHistoryByProject(ctx.getHistory(), needle);
    }

    function getProjectAllTimeTotal(project) {
        return sumProjectHistory(ctx.getHistory(), project || getActiveProject());
    }

    function getProjectTotalsByService(project) {
        return sumProjectTotalsByService(ctx.getHistory(), project || getActiveProject());
    }

    function getProjectLastSpend(project) {
        const filtered = getFilteredHistory(project);
        return filtered.length ? filtered[0] : null;
    }

    function getProjectEventCount(project) {
        return getFilteredHistory(project).length;
    }

    function backfillHistoryProjectIds() {
        const library = ctx.getProjectLibrary();
        const history = ctx.getHistory();
        if (!library.length || !history.length) return;
        let changed = false;
        const next = history.map(function (event) {
            const project = sanitizeProject(event.project || {});
            if (project.id || !project.name) return event;
            const match = library.find(function (entry) {
                return entry.name === project.name && (!project.url || !entry.url || entry.url === project.url);
            });
            if (!match) return event;
            changed = true;
            return Object.assign({}, event, {
                project: sanitizeProject({
                    id: match.id,
                    name: project.name,
                    url: project.url || match.url
                })
            });
        });
        if (changed) {
            ctx.setHistory(next);
            ctx.saveHistory();
        }
    }

    function syncProjectDraftFromActive() {
        ctx.runtime.projectDraft = {
            name: ctx.runtime.project.name || '',
            url: ctx.runtime.project.url || ''
        };
    }

    function syncProjectDraftFromInputs(root) {
        const nameInput = root.querySelector('[data-field="projectName"]');
        const urlInput = root.querySelector('[data-field="projectUrl"]');
        ctx.runtime.projectDraft = {
            name: nameInput ? nameInput.value : '',
            url: urlInput ? urlInput.value : ''
        };
        ctx.renderSoon();
    }

    function shouldCompactProject() {
        return !ctx.runtime.projectEditorOpen;
    }

    function migrateProjectLibrary() {
        let library = sanitizeProjectLibrary(ctx.getProjectLibrary());
        ctx.setProjectLibrary(library);
        const active = sanitizeProject(readJson(PROJECT_KEY, {}));
        if (!library.length && active.name) {
            const entry = createProjectEntry(active.name, active.url);
            library = [entry];
            ctx.setProjectLibrary(library);
            active.id = entry.id;
            ctx.saveProjectLibrary();
        } else if (active.id && !findProjectById(active.id)) {
            const stored = findProjectRecordById(active.id);
            if (stored && stored.status === 'archived') {
                active.id = '';
                active.name = '';
                active.url = '';
            } else if (active.name) {
                const match = library.find(function (entry) {
                    return entry.status !== 'archived' && entry.name === active.name && entry.url === active.url;
                });
                active.id = match ? match.id : '';
            }
        }
        ctx.runtime.project = active;
        syncProjectDraftFromActive();
        ctx.runtime.projectEditorOpen = !active.id && !listProjects().length;
        backfillHistoryProjectIds();
        ctx.saveProject();
    }

    function setProject(project) {
        const sanitized = sanitizeProject(project || {});
        if (sanitized.id && !findProjectById(sanitized.id)) {
            sanitized.id = '';
        }
        ctx.runtime.project = sanitized;
        syncProjectDraftFromActive();
        ctx.saveProject();
        ctx.renderSoon();
        return ctx.getState();
    }

    function clearProject() {
        closeProjectSearch();
        ctx.runtime.project = sanitizeProject({});
        ctx.runtime.projectEditorOpen = false;
        ctx.runtime.projectFilterEnabled = false;
        ctx.saveProject();
        ctx.saveUiState();
        ctx.renderSoon();
        return ctx.getState();
    }

    function setProjectFilterEnabled(enabled) {
        ctx.runtime.projectFilterEnabled = Boolean(enabled) && hasActiveProject();
        ctx.saveUiState();
        ctx.renderSoon();
    }

    function addProject(name, url) {
        const sanitized = sanitizeProject({ name: name, url: url });
        if (!sanitized.name) return null;
        const entry = createProjectEntry(sanitized.name, sanitized.url);
        const library = ctx.getProjectLibrary().slice();
        library.unshift(entry);
        ctx.setProjectLibrary(sanitizeProjectLibrary(library));
        ctx.saveProjectLibrary();
        if (typeof ctx.queueProjectUpsert === 'function') ctx.queueProjectUpsert(entry);
        ctx.renderSoon();
        return deepClone(entry);
    }

    function updateProject(id, name, url) {
        const entry = findProjectById(id);
        if (!entry) return null;
        const sanitized = sanitizeProject({ name: name, url: url });
        if (!sanitized.name) return null;
        entry.name = sanitized.name;
        entry.url = sanitized.url;
        entry.status = 'active';
        entry.updatedAt = Date.now();
        entry.updatedBy = String(ctx.getSettings && ctx.getSettings().sheetsNickname || '').trim();
        ctx.setProjectLibrary(sanitizeProjectLibrary(ctx.getProjectLibrary()));
        ctx.saveProjectLibrary();
        if (typeof ctx.queueProjectUpsert === 'function') ctx.queueProjectUpsert(entry);
        if (ctx.runtime.project && ctx.runtime.project.id === entry.id) {
            ctx.runtime.project = sanitizeProject({
                id: entry.id,
                name: entry.name,
                url: entry.url
            });
            syncProjectDraftFromActive();
            ctx.saveProject();
        }
        ctx.renderSoon();
        return deepClone(entry);
    }

    function deleteProject(id) {
        const needle = String(id || '').trim();
        if (!needle) return false;
        const entry = findProjectById(needle);
        if (!entry) return false;
        entry.status = 'archived';
        entry.updatedAt = Date.now();
        entry.updatedBy = String(ctx.getSettings && ctx.getSettings().sheetsNickname || '').trim();
        ctx.setProjectLibrary(sanitizeProjectLibrary(ctx.getProjectLibrary()));
        ctx.saveProjectLibrary();
        if (typeof ctx.queueProjectArchive === 'function') ctx.queueProjectArchive(entry);
        if (ctx.runtime.project && ctx.runtime.project.id === needle) {
            ctx.runtime.project = sanitizeProject({});
            syncProjectDraftFromActive();
            ctx.saveProject();
        }
        ctx.renderSoon();
        return true;
    }

    function selectProject(id) {
        const entry = findProjectById(id);
        if (!entry) {
            return clearProject();
        }
        ctx.runtime.project = sanitizeProject({
            id: entry.id,
            name: entry.name,
            url: entry.url
        });
        closeProjectSearch();
        syncProjectDraftFromActive();
        ctx.runtime.projectEditorOpen = false;
        ctx.saveProject();
        ctx.renderSoon();
        return ctx.getState();
    }

    function openProjectEditor() {
        closeProjectSearch();
        syncProjectDraftFromActive();
        ctx.runtime.projectEditorOpen = true;
        ctx.renderSoon();
    }

    function closeProjectEditor() {
        ctx.runtime.projectEditorOpen = false;
        ctx.renderSoon();
    }

    function saveProjectFromForm(root) {
        syncProjectDraftFromInputs(root);
        const selectedId = ctx.runtime.project && ctx.runtime.project.id ? ctx.runtime.project.id : '';
        const select = root.querySelector('[data-field="projectSelect"]');
        const selectId = select ? select.value : '';
        const editingId = selectId || selectedId;
        let entry = null;

        if (editingId && findProjectById(editingId)) {
            entry = updateProject(
                editingId,
                ctx.runtime.projectDraft.name,
                ctx.runtime.projectDraft.url
            );
        } else {
            entry = addProject(ctx.runtime.projectDraft.name, ctx.runtime.projectDraft.url);
        }
        if (!entry) return null;

        ctx.runtime.project = sanitizeProject({
            id: entry.id,
            name: entry.name,
            url: entry.url
        });
        syncProjectDraftFromActive();
        ctx.runtime.projectEditorOpen = false;
        ctx.saveProject();
        ctx.renderSoon();
        return entry;
    }

    function beginNewProjectForm(root) {
        closeProjectSearch();
        ctx.runtime.project = sanitizeProject({});
        ctx.runtime.projectDraft = { name: '', url: '' };
        ctx.runtime.projectEditorOpen = true;
        ctx.saveProject();
        const select = root.querySelector('[data-field="projectSelect"]');
        const nameInput = root.querySelector('[data-field="projectName"]');
        const urlInput = root.querySelector('[data-field="projectUrl"]');
        if (select) select.value = '';
        if (nameInput) nameInput.value = '';
        if (urlInput) urlInput.value = '';
        if (nameInput) nameInput.focus();
        ctx.renderSoon();
        if (typeof ctx.syncProjectsFromSheets === 'function') {
            ctx.syncProjectsFromSheets().catch(function () {});
        }
    }

    function deleteSelectedProject(root) {
        const select = root.querySelector('[data-field="projectSelect"]');
        const selectedId = select ? select.value : '';
        if (!selectedId || !deleteProject(selectedId)) return false;
        beginNewProjectForm(root);
        return true;
    }

    function reconcileProjectIds(idMap) {
        const mapping = idMap && typeof idMap === 'object' ? idMap : {};
        if (!Object.keys(mapping).length) return;
        let historyChanged = false;
        const nextHistory = ctx.getHistory().map(function (event) {
            const project = sanitizeProject(event && event.project || {});
            const nextId = mapping[project.id];
            if (!nextId) return event;
            historyChanged = true;
            return Object.assign({}, event, {
                project: sanitizeProject({ id: nextId, name: project.name, url: project.url })
            });
        });
        if (historyChanged) {
            ctx.setHistory(nextHistory);
            ctx.saveHistory();
        }
        const active = sanitizeProject(ctx.runtime.project || {});
        if (mapping[active.id]) {
            active.id = mapping[active.id];
            ctx.runtime.project = active;
            ctx.saveProject();
        }
    }

    function replaceProjectEntry(value) {
        const entry = sanitizeProjectEntry(value || {});
        const library = ctx.getProjectLibrary().filter(function (item) {
            return item.id !== entry.id;
        });
        library.push(entry);
        ctx.setProjectLibrary(sanitizeProjectLibrary(library));
        ctx.saveProjectLibrary();

        if (ctx.runtime.project && ctx.runtime.project.id === entry.id) {
            if (entry.status === 'archived') {
                ctx.runtime.project = sanitizeProject({});
                ctx.runtime.projectFilterEnabled = false;
            } else {
                ctx.runtime.project = sanitizeProject(entry);
            }
            syncProjectDraftFromActive();
            ctx.saveProject();
            ctx.saveUiState();
        }
        ctx.renderSoon();
        return deepClone(entry);
    }

    return {
        findProjectRecordById,
        findProjectById,
        createProjectEntry,
        listProjects,
        getProjectSuggestions,
        getProjectsByCreatedAt,
        searchProjects,
        toggleProjectSearch,
        closeProjectSearch,
        setProjectSearchQuery,
        selectProjectSearchResult,
        formatProjectOptionLabel,
        getActiveProject,
        hasActiveProject,
        isProjectFilterActive,
        getFilteredHistory,
        getProjectAllTimeTotal,
        getProjectTotalsByService,
        getProjectLastSpend,
        getProjectEventCount,
        backfillHistoryProjectIds,
        syncProjectDraftFromActive,
        syncProjectDraftFromInputs,
        shouldCompactProject,
        migrateProjectLibrary,
        setProject,
        clearProject,
        setProjectFilterEnabled,
        addProject,
        updateProject,
        deleteProject,
        selectProject,
        openProjectEditor,
        closeProjectEditor,
        saveProjectFromForm,
        beginNewProjectForm,
        deleteSelectedProject,
        reconcileProjectIds,
        replaceProjectEntry
    };
}

export { eventMatchesProject };
