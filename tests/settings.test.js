import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, sanitizeSettings } from '../src/core/settings.js';

test('sanitizeSettings returns defaults for empty input', function () {
    assert.deepEqual(sanitizeSettings(null), DEFAULT_SETTINGS);
    assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS);
});

test('sanitizeSettings clamps idle opacity', function () {
    assert.equal(sanitizeSettings({ idleOpacity: 0.05 }).idleOpacity, 0.1);
    assert.equal(sanitizeSettings({ idleOpacity: 0.95 }).idleOpacity, 0.8);
    assert.equal(sanitizeSettings({ idleOpacity: 0.35 }).idleOpacity, 0.35);
});

test('sanitizeSettings validates whitelist values', function () {
    assert.equal(sanitizeSettings({ summaryEventsCount: 99 }).summaryEventsCount, 3);
    assert.equal(sanitizeSettings({ summaryEventsCount: 10 }).summaryEventsCount, 10);
    assert.equal(sanitizeSettings({ historyDisplayLimit: 200 }).historyDisplayLimit, 50);
    assert.equal(sanitizeSettings({ historyDisplayLimit: 100 }).historyDisplayLimit, 100);
    assert.equal(sanitizeSettings({ panelWidth: 400 }).panelWidth, 286);
    assert.equal(sanitizeSettings({ panelWidth: 320 }).panelWidth, 320);
});

test('sanitizeSettings preserves rememberPanelPosition boolean', function () {
    assert.equal(sanitizeSettings({ rememberPanelPosition: true }).rememberPanelPosition, true);
    assert.equal(sanitizeSettings({ rememberPanelPosition: 'yes' }).rememberPanelPosition, false);
});

test('sanitizeSettings enables sheets sync by default', function () {
    assert.equal(sanitizeSettings({}).sheetsEnabled, true);
    assert.equal(sanitizeSettings({ sheetsEnabled: false }).sheetsEnabled, false);
    assert.equal(sanitizeSettings({}).sheetsSecretToken, 'token');
});
