import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    eventMatchesProject,
    findDuplicateSpend,
    getProjectTotalsByService,
    removeEventFromSession,
    replaceEventProject,
    sanitizeEvents
} from '../src/core/events.js';

const baseInput = {
    amount: 15,
    before: 1000,
    after: 1000,
    source: 'ui',
    estimated: true
};

test('replaceEventProject updates only the requested spend', function () {
    const history = [
        { id: 'event:1', project: { id: 'old', name: 'Old', url: '' }, updatedAt: 1 },
        { id: 'event:2', project: { id: 'other', name: 'Other', url: '' }, updatedAt: 2 }
    ];
    const result = replaceEventProject(history, 'event:1', {
        id: 'new',
        name: 'New project',
        url: 'https://example.com'
    }, 100);
    assert.equal(result.event.project.id, 'new');
    assert.equal(result.event.project.name, 'New project');
    assert.equal(result.event.updatedAt, 100);
    assert.equal(result.history[1], history[1]);
    assert.equal(history[0].project.id, 'old');
});

test('replaceEventProject supports removing the project assignment', function () {
    const result = replaceEventProject([
        { id: 'event:1', project: { id: 'old', name: 'Old', url: '' } }
    ], 'event:1', {}, 100);
    assert.deepEqual(result.event.project, { id: '', name: '', url: '' });
});

test('findDuplicateSpend does not merge identical stale UI spends after 15s', function () {
    const history = [{
        id: 'e1',
        ts: 1000,
        amount: 15,
        before: 1000,
        after: 1000,
        source: 'ui',
        estimated: true
    }];
    const duplicate = findDuplicateSpend(history, baseInput, 1000 + 15000);
    assert.equal(duplicate, null);
});

test('findDuplicateSpend merges identical spends within SPEND_MERGE_MS', function () {
    const history = [{
        id: 'e1',
        ts: 1000,
        amount: 15,
        before: 1000,
        after: 1000,
        source: 'ui',
        estimated: true
    }];
    const duplicate = findDuplicateSpend(history, baseInput, 1000 + 5000);
    assert.equal(duplicate.id, 'e1');
});

test('getProjectTotalsByService groups matching project spends by service', function () {
    const project = { id: 'p1', name: 'Launch', url: '' };
    const history = [
        {
            id: 'e1',
            amount: 15,
            service: 'kling',
            serviceName: 'Kling',
            project: project
        },
        {
            id: 'e2',
            amount: 7,
            service: 'higgsfield',
            serviceName: 'Higgsfield',
            project: project
        },
        {
            id: 'e3',
            amount: 5,
            service: 'kling',
            serviceName: 'Kling',
            project: project
        },
        {
            id: 'e4',
            amount: 99,
            service: 'kling',
            serviceName: 'Kling',
            project: { id: 'p2', name: 'Other', url: '' }
        }
    ];

    assert.deepEqual(getProjectTotalsByService(history, project), [
        { service: 'kling', serviceName: 'Kling', total: 20, count: 2 },
        { service: 'higgsfield', serviceName: 'Higgsfield', total: 7, count: 1 }
    ]);
});

test('getProjectTotalsByService uses first non-empty serviceName', function () {
    const project = { id: 'p1', name: 'Launch', url: '' };
    const history = [
        {
            id: 'e1',
            amount: 3,
            service: 'kling',
            serviceName: 'Kling',
            project: project
        },
        {
            id: 'e2',
            amount: 4,
            service: 'kling',
            serviceName: 'Kling AI',
            project: project
        }
    ];

    assert.deepEqual(getProjectTotalsByService(history, project), [
        { service: 'kling', serviceName: 'Kling', total: 7, count: 2 }
    ]);
});

test('getProjectTotalsByService returns empty array for empty history', function () {
    assert.deepEqual(getProjectTotalsByService([], { id: 'p1', name: 'Launch', url: '' }), []);
});

test('eventMatchesProject matches by normalized name across users', function () {
    const localProject = { id: 'p_local', name: 'Bononews', url: '' };
    const remoteEvent = { project: { id: '', name: '  bononews  ', url: '' } };
    assert.equal(eventMatchesProject(remoteEvent, localProject), true);

    const otherEvent = { project: { id: '', name: 'Something else', url: '' } };
    assert.equal(eventMatchesProject(otherEvent, localProject), false);
});

test('sanitizeEvents preserves user and remote flags', function () {
    const events = sanitizeEvents([
        { id: 'e1', amount: 5, user: 'Alice', remote: true },
        { id: 'e2', amount: 3 }
    ]);
    const byId = {};
    events.forEach(function (event) {
        byId[event.id] = event;
    });
    assert.equal(byId.e1.user, 'Alice');
    assert.equal(byId.e1.remote, true);
    assert.equal(byId.e2.user, '');
    assert.equal(byId.e2.remote, false);
});

test('removeEventFromSession removes id and subtracts amount', function () {
    const session = {
        id: 's1',
        startedAt: 100,
        total: 25,
        eventIds: ['e1', 'e2']
    };
    const next = removeEventFromSession(session, { id: 'e1', amount: 10 });
    assert.deepEqual(next.eventIds, ['e2']);
    assert.equal(next.total, 15);
});
