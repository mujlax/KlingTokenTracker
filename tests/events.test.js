import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateSpend, getProjectTotalsByService } from '../src/core/events.js';

const baseInput = {
    amount: 15,
    before: 1000,
    after: 1000,
    source: 'ui',
    estimated: true
};

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
