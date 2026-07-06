import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeEventHistories } from '../src/core/storage.js';

test('mergeEventHistories dedupes by id and keeps newer ts', function () {
    const a = [
        { id: 'e1', ts: 100, amount: 15, service: 'kling' },
        { id: 'e2', ts: 200, amount: 16, service: 'higgsfield' }
    ];
    const b = [
        { id: 'e1', ts: 50, amount: 15, service: 'kling' },
        { id: 'e3', ts: 300, amount: 10, service: 'kling' }
    ];
    const merged = mergeEventHistories(a, b, 200);
    assert.equal(merged.length, 3);
    assert.equal(merged[0].id, 'e3');
    assert.equal(merged.find(function (e) { return e.id === 'e1'; }).ts, 100);
});
