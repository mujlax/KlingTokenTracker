import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildProjectKey,
    buildProjectPayload,
    buildEventProjectPayload,
    buildSheetsPayload,
    canSyncToSheets,
    clearSyncState,
    convertRemoteRowToEvent,
    convertRemoteRowToProject,
    getSheetsErrorMessage,
    getSyncState,
    flushPendingProjectSyncs,
    loadProjectSyncState,
    markSyncState,
    mergeProjectCatalogs,
    saveProjectSyncState,
    sanitizeSheetsWebAppUrl
} from '../src/core/sheets.js';
import { sanitizeSettings, DEFAULT_SETTINGS } from '../src/core/settings.js';

test('buildProjectKey normalizes project name', function () {
    assert.equal(buildProjectKey('  Bononews  '), 'bononews');
    assert.equal(buildProjectKey(''), '');
});

test('buildSheetsPayload includes compact team fields', function () {
    const payload = buildSheetsPayload({
        id: 'delta:1:100:93.75:6.25',
        ts: Date.parse('2026-07-03T10:06:00.000Z'),
        localDate: '2026-07-03',
        amount: 6.25,
        service: 'higgsfield',
        serviceName: 'Higgsfield',
        source: 'ui',
        estimated: false,
        project: { id: 'project_abc', name: 'bononews' }
    }, {
        sheetsNickname: 'Denis'
    });

    assert.equal(payload.eventId, 'delta:1:100:93.75:6.25');
    assert.equal(payload.amount, 6.25);
    assert.equal(payload.service, 'higgsfield');
    assert.equal(payload.projectId, 'project_abc');
    assert.equal(payload.projectName, 'bononews');
    assert.equal(payload.user, 'Denis');
    assert.ok(payload.trackerVersion);
});

test('buildSheetsPayload drops removed columns', function () {
    const payload = buildSheetsPayload({
        id: 'delta:1:100:93.75:6.25',
        ts: Date.now(),
        localDate: '2026-07-03',
        amount: 6.25,
        service: 'higgsfield',
        serviceName: 'Higgsfield',
        source: 'ui',
        estimated: true,
        project: { id: 'project_abc', name: 'bononews' }
    }, {
        sheetsNickname: 'Denis'
    });

    assert.equal('ts' in payload, false);
    assert.equal('localDate' in payload, false);
    assert.equal('serviceName' in payload, false);
    assert.equal('projectKey' in payload, false);
    assert.equal('source' in payload, false);
    assert.equal('estimated' in payload, false);
});

test('buildEventProjectPayload updates only an event project assignment', function () {
    assert.deepEqual(buildEventProjectPayload({
        id: 'event:1',
        project: { id: 'project:2', name: 'Launch', url: 'https://example.com' }
    }), {
        eventId: 'event:1',
        projectId: 'project:2',
        projectName: 'Launch'
    });
    assert.deepEqual(buildEventProjectPayload({ id: 'event:2', project: {} }), {
        eventId: 'event:2',
        projectId: '',
        projectName: ''
    });
});

test('convertRemoteRowToEvent reconstructs a local event shape', function () {
    const event = convertRemoteRowToEvent({
        syncedAt: '2026-07-03T10:06:00.000Z',
        eventId: 'delta:1:100:93.75:6.25',
        amount: 6.25,
        service: 'higgsfield',
        projectId: 'project_abc',
        projectName: 'bononews',
        user: 'Alice',
        trackerVersion: '0.8.8'
    });

    assert.equal(event.id, 'delta:1:100:93.75:6.25');
    assert.equal(event.amount, 6.25);
    assert.equal(event.service, 'higgsfield');
    assert.equal(event.serviceName, 'Higgsfield');
    assert.equal(event.source, 'remote');
    assert.equal(event.remote, true);
    assert.equal(event.user, 'Alice');
    assert.equal(event.estimated, false);
    assert.equal(event.project.id, '');
    assert.equal(event.project.name, 'bononews');
    assert.equal(event.ts, Date.parse('2026-07-03T10:06:00.000Z'));
});

test('convertRemoteRowToEvent returns null without eventId', function () {
    assert.equal(convertRemoteRowToEvent({ amount: 5 }), null);
    assert.equal(convertRemoteRowToEvent(null), null);
});

test('convertRemoteRowToEvent keeps a project id only when it belongs to the shared catalog', function () {
    const row = {
        syncedAt: '2026-07-17T10:00:00.000Z',
        eventId: 'event:1',
        amount: 2,
        service: 'kling',
        projectId: 'project_shared',
        projectName: 'Launch'
    };
    assert.equal(convertRemoteRowToEvent(row).project.id, '');
    assert.equal(convertRemoteRowToEvent(row, { project_shared: true }).project.id, 'project_shared');
});

test('buildProjectPayload contains shared catalog fields', function () {
    const payload = buildProjectPayload({
        id: 'project_abc',
        name: 'Launch',
        url: 'https://example.com/work',
        status: 'active',
        createdAt: Date.parse('2026-07-17T10:00:00.000Z'),
        updatedAt: Date.parse('2026-07-17T11:00:00.000Z')
    }, { sheetsNickname: 'Denis' });
    assert.deepEqual(Object.keys(payload), [
        'projectId', 'name', 'url', 'status', 'createdAt', 'updatedBy', 'trackerVersion'
    ]);
    assert.equal(payload.projectId, 'project_abc');
    assert.equal(payload.updatedBy, 'Denis');
});

test('convertRemoteRowToProject preserves canonical server fields', function () {
    const project = convertRemoteRowToProject({
        projectId: 'project_shared',
        name: 'Launch',
        url: 'https://example.com',
        status: 'archived',
        createdAt: '2026-07-17T10:00:00.000Z',
        updatedAt: '2026-07-17T11:00:00.000Z',
        updatedBy: 'Alice'
    });
    assert.equal(project.id, 'project_shared');
    assert.equal(project.status, 'archived');
    assert.equal(project.updatedBy, 'Alice');
    assert.equal(project.updatedAt, Date.parse('2026-07-17T11:00:00.000Z'));
});

test('mergeProjectCatalogs adopts remote id for an exact initial match', function () {
    const merged = mergeProjectCatalogs([
        { id: 'local', name: 'Launch', url: 'https://example.com', updatedAt: 1 }
    ], [
        { id: 'remote', name: 'launch', url: 'http://www.example.com/', updatedAt: 2, updatedBy: 'Alice' }
    ], { initialized: false, pending: {} });
    assert.equal(merged.projects.length, 1);
    assert.equal(merged.projects[0].id, 'remote');
    assert.equal(merged.idMap.local, 'remote');
    assert.deepEqual(merged.state.pending, {});
});

test('mergeProjectCatalogs queues unmatched local projects on first sync', function () {
    const merged = mergeProjectCatalogs([
        { id: 'local', name: 'Local only', url: '', updatedAt: 1 }
    ], [], { initialized: false, pending: {} });
    assert.equal(merged.projects[0].id, 'local');
    assert.equal(merged.state.pending.local, 'upsert');
});

test('mergeProjectCatalogs keeps pending local edits over remote data', function () {
    const merged = mergeProjectCatalogs([
        { id: 'shared', name: 'Local edit', url: '', updatedAt: 3 }
    ], [
        { id: 'shared', name: 'Remote old', url: '', updatedAt: 2 }
    ], { initialized: true, pending: { shared: 'upsert' } });
    assert.equal(merged.projects[0].name, 'Local edit');
});

test('mergeProjectCatalogs applies a remote archive when no local operation is pending', function () {
    const merged = mergeProjectCatalogs([
        { id: 'shared', name: 'Launch', status: 'active', updatedAt: 1 }
    ], [
        { id: 'shared', name: 'Launch', status: 'archived', updatedAt: 2, updatedBy: 'Alice' }
    ], { initialized: true, pending: {} });
    assert.equal(merged.projects[0].status, 'archived');
    assert.equal(merged.projects[0].updatedBy, 'Alice');
});

test('pending project operations survive failure and clear after retry', async function () {
    const originalWindow = global.window;
    const originalRequest = global.GM_xmlhttpRequest;
    const store = new Map();
    const project = {
        id: 'project_retry',
        name: 'Retry me',
        url: '',
        status: 'active',
        createdAt: Date.parse('2026-07-17T10:00:00.000Z'),
        updatedAt: Date.parse('2026-07-17T10:00:00.000Z')
    };
    global.window = {
        localStorage: {
            getItem: function (key) { return store.has(key) ? store.get(key) : null; },
            setItem: function (key, value) { store.set(key, value); }
        }
    };
    const ctx = {
        runtime: { settings: {} },
        getSettings: function () {
            return {
                sheetsEnabled: true,
                sheetsWebAppUrl: 'https://script.google.com/macros/s/abc/exec',
                sheetsSecretToken: 'secret',
                sheetsNickname: 'Denis'
            };
        },
        findProjectRecordById: function () { return project; },
        replaceProjectEntry: function (value) { this.replaced = value; },
        addDiagnostic: function () {},
        renderSoon: function () {}
    };
    try {
        saveProjectSyncState({ initialized: true, pending: { project_retry: 'upsert' } });
        global.GM_xmlhttpRequest = function (options) {
            options.onload({ status: 200, responseText: JSON.stringify({ ok: false, error: 'offline' }) });
        };
        const failed = await flushPendingProjectSyncs(ctx);
        assert.equal(failed.synced, 0);
        assert.equal(loadProjectSyncState().pending.project_retry, 'upsert');

        global.GM_xmlhttpRequest = function (options) {
            options.onload({
                status: 200,
                responseText: JSON.stringify({
                    ok: true,
                    project: {
                        projectId: 'project_retry',
                        name: 'Retry me',
                        url: '',
                        status: 'active',
                        createdAt: '2026-07-17T10:00:00.000Z',
                        updatedAt: '2026-07-17T10:05:00.000Z',
                        updatedBy: 'Denis'
                    }
                })
            });
        };
        const retried = await flushPendingProjectSyncs(ctx);
        assert.equal(retried.synced, 1);
        assert.equal(loadProjectSyncState().pending.project_retry, undefined);
        assert.equal(ctx.replaced.updatedBy, 'Denis');
    } finally {
        global.window = originalWindow;
        if (originalRequest === undefined) delete global.GM_xmlhttpRequest;
        else global.GM_xmlhttpRequest = originalRequest;
    }
});

test('canSyncToSheets requires enabled url token nickname', function () {
    assert.equal(canSyncToSheets(DEFAULT_SETTINGS), false);
    assert.equal(canSyncToSheets({
        sheetsEnabled: true,
        sheetsWebAppUrl: 'https://script.google.com/macros/s/abc/exec',
        sheetsSecretToken: 'secret',
        sheetsNickname: 'Denis'
    }), true);
    assert.equal(canSyncToSheets({
        sheetsEnabled: true,
        sheetsWebAppUrl: 'https://script.google.com/macros/s/abc/exec',
        sheetsSecretToken: 'secret',
        sheetsNickname: ''
    }), false);
});

test('sanitizeSettings trims sheets fields', function () {
    const settings = sanitizeSettings({
        sheetsEnabled: true,
        sheetsWebAppUrl: '  https://script.google.com/macros/s/abc/exec  ',
        sheetsSecretToken: '  token  ',
        sheetsNickname: '  Denis  '
    });
    assert.equal(settings.sheetsEnabled, true);
    assert.equal(settings.sheetsWebAppUrl, 'https://script.google.com/macros/s/abc/exec');
    assert.equal(settings.sheetsSecretToken, 'token');
    assert.equal(settings.sheetsNickname, 'Denis');
});

test('DEFAULT_SETTINGS includes team sheets web app url', function () {
    assert.ok(DEFAULT_SETTINGS.sheetsWebAppUrl.includes('script.google.com/macros/s/'));
});

test('sanitizeSheetsWebAppUrl keeps google script exec urls', function () {
    const url = 'https://script.google.com/macros/s/abc123/exec';
    assert.equal(sanitizeSheetsWebAppUrl(url), url);
    assert.equal(sanitizeSheetsWebAppUrl('https://script.googleusercontent.com/macros/echo?x=1'), '');
});

test('getSheetsErrorMessage explains html 404 responses', function () {
    const message = getSheetsErrorMessage({
        status: 404,
        body: '<html><title>Страница не найдена</title></html>',
        data: null
    });
    assert.match(message, /404/);
});

test('sync state can be marked and cleared', function () {
    const originalWindow = global.window;
    const store = new Map();
    global.window = {
        localStorage: {
            getItem: function (key) {
                return store.has(key) ? store.get(key) : null;
            },
            setItem: function (key, value) {
                store.set(key, value);
            }
        }
    };
    try {
        markSyncState('event:test', 'pending');
        assert.equal(getSyncState('event:test'), 'pending');
        clearSyncState('event:test');
        assert.equal(getSyncState('event:test'), null);
    } finally {
        global.window = originalWindow;
    }
});
