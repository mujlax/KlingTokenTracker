import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getUndoVisualState } from '../src/ui/render.js';

test('undo visual state flashes initially and drains over ten seconds', function () {
    const startedAt = 1000;
    const undo = { startedAt: startedAt, expiresAt: startedAt + 10000 };
    assert.deepEqual(getUndoVisualState(undo, startedAt), {
        visible: true,
        seconds: 10,
        progress: 1,
        fresh: true,
        paused: false
    });
    assert.equal(getUndoVisualState(undo, startedAt + 2000).fresh, true);
    assert.equal(getUndoVisualState(undo, startedAt + 2500).fresh, false);
    assert.equal(getUndoVisualState(undo, startedAt + 5000).progress, 0.5);
    assert.equal(getUndoVisualState(undo, startedAt + 10000).visible, false);
    assert.equal(getUndoVisualState(undo, startedAt + 10000).progress, 0);
});

test('undo visual state remains frozen while the project picker is open', function () {
    const undo = {
        startedAt: 1000,
        expiresAt: 11000,
        pickerOpen: true,
        pausedAt: 4000,
        remainingMs: 7000
    };
    const first = getUndoVisualState(undo, 5000);
    const later = getUndoVisualState(undo, 500000);
    assert.equal(first.seconds, 7);
    assert.equal(first.progress, 0.7);
    assert.equal(first.fresh, false);
    assert.equal(first.paused, true);
    assert.deepEqual(later, first);
});
