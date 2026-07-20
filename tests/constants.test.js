import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION, VERSION_HISTORY } from '../src/core/constants.js';

test('VERSION_HISTORY includes current version', function () {
    assert.ok(VERSION_HISTORY.some(function (entry) {
        return entry.version === VERSION;
    }));
});

test('VERSION_HISTORY newest entry matches VERSION', function () {
    assert.equal(VERSION_HISTORY[0].version, VERSION);
});
