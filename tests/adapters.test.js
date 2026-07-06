import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHiggsfieldCost, buildHiggsfieldDetail } from '../src/adapters/shared.js';

test('extractHiggsfieldCost parses Generate sparkle price', function () {
    assert.equal(extractHiggsfieldCost('Generate ✦ 16'), 16);
    assert.equal(extractHiggsfieldCost('Generate ✦ 30'), 30);
    assert.equal(extractHiggsfieldCost('Generate6.25'), 6.25);
    assert.equal(extractHiggsfieldCost('Generate 6.25'), 6.25);
});

test('buildHiggsfieldDetail keeps only button text', function () {
    assert.equal(buildHiggsfieldDetail('Generate6.25', 6.25), 'Generate6.25');
    assert.equal(buildHiggsfieldDetail('', 6.25), 'Generate 6.25');
});
