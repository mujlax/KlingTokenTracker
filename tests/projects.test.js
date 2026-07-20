import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProjects } from '../src/core/projects.js';

function createContext(library, active, history) {
    let projects = library;
    let events = history || [];
    return {
        runtime: {
            project: active || { id: '', name: '', url: '' },
            projectDraft: { name: '', url: '' },
            projectFilterEnabled: false
        },
        getProjectLibrary: function () { return projects; },
        setProjectLibrary: function (value) { projects = value; },
        getHistory: function () { return events; },
        setHistory: function (value) { events = value; },
        getSettings: function () { return { sheetsNickname: 'Denis' }; },
        saveProjectLibrary: function () {},
        saveProject: function () {},
        saveHistory: function () {},
        saveUiState: function () {},
        renderSoon: function () {},
        queueProjectArchive: function (project) { this.archived = project.id; },
        getState: function () { return {}; }
    };
}

test('archived projects are hidden and cannot remain active', function () {
    const ctx = createContext([
        { id: 'active', name: 'Active', status: 'active', updatedAt: 2 },
        { id: 'archived', name: 'Archived', status: 'archived', updatedAt: 1 }
    ], { id: 'archived', name: 'Archived', url: '' });
    const projects = createProjects(ctx);
    assert.deepEqual(projects.listProjects().map(function (entry) { return entry.id; }), ['active']);
    assert.equal(projects.hasActiveProject(), false);
});

test('deleteProject archives the catalog entry without changing spend history', function () {
    const history = [{ id: 'event:1', project: { id: 'active', name: 'Active', url: '' } }];
    const ctx = createContext([
        { id: 'active', name: 'Active', status: 'active', updatedAt: 2 }
    ], { id: 'active', name: 'Active', url: '' }, history);
    const projects = createProjects(ctx);
    assert.equal(projects.deleteProject('active'), true);
    assert.equal(ctx.getProjectLibrary()[0].status, 'archived');
    assert.equal(ctx.archived, 'active');
    assert.equal(ctx.getHistory(), history);
    assert.equal(projects.hasActiveProject(), false);
});
