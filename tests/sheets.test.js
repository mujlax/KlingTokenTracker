import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildProjectKey,
    buildSheetsPayload,
    canSyncToSheets,
    getSheetsErrorMessage,
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
    assert.equal(payload.projectId, 'project_abc');
    assert.equal(payload.projectName, 'bononews');
    assert.equal(payload.projectKey, 'bononews');
    assert.equal(payload.user, 'Denis');
    assert.equal(payload.estimated, false);
    assert.ok(payload.trackerVersion);
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
