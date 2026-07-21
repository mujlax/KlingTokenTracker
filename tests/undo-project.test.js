import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAndAssignUndoProject } from '../src/core/app.js';

test('creating a project from Undo adds and immediately assigns it', function () {
    const calls = [];
    const undo = { pickerOpen: true, projectCreateOpen: true };
    const ctx = {
        addProject: function (name, url) {
            calls.push(['add', name, url]);
            return { id: 'project:new', name: name, url: url };
        },
        applyUndoProject: function (id) {
            calls.push(['apply', id]);
            return { id: 'event:1', project: { id: id } };
        },
        addDiagnostic: function () {}
    };

    const event = createAndAssignUndoProject(ctx, undo, 'Новый проект', 'https://example.com');

    assert.equal(event.project.id, 'project:new');
    assert.deepEqual(calls, [
        ['add', 'Новый проект', 'https://example.com'],
        ['apply', 'project:new']
    ]);
    assert.equal(undo.projectCreateName, 'Новый проект');
    assert.equal(undo.projectCreateUrl, 'https://example.com');
});

test('creating a project from Undo requires the paused creation form', function () {
    let called = false;
    const ctx = {
        addProject: function () {
            called = true;
            return { id: 'project:new' };
        }
    };

    assert.equal(createAndAssignUndoProject(ctx, { pickerOpen: true }, 'Project', ''), null);
    assert.equal(called, false);
});
