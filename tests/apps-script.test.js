import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function createAppsScriptContext(rows) {
    const sheet = {
        rows: rows,
        getLastRow: function () { return this.rows.length; },
        getRange: function (row, column, numRows, numColumns) {
            const self = this;
            return {
                getValues: function () {
                    return self.rows.slice(row - 1, row - 1 + numRows).map(function (source) {
                        return source.slice(column - 1, column - 1 + numColumns);
                    });
                },
                setValues: function (values) {
                    values.forEach(function (source, rowIndex) {
                        source.forEach(function (value, columnIndex) {
                            self.rows[row - 1 + rowIndex][column - 1 + columnIndex] = value;
                        });
                    });
                },
                sort: function () {}
            };
        },
        setFrozenRows: function () {}
    };
    const context = {
        SpreadsheetApp: {
            openById: function () {
                return { getSheetByName: function () { return sheet; } };
            }
        },
        LockService: {
            getScriptLock: function () {
                return { waitLock: function () {}, releaseLock: function () {} };
            }
        },
        ContentService: {
            MimeType: { JSON: 'json' },
            createTextOutput: function (text) {
                return {
                    text: text,
                    setMimeType: function () { return this; }
                };
            }
        }
    };
    vm.createContext(context);
    vm.runInContext(readFileSync(new URL('../google-apps-script/Code.gs', import.meta.url), 'utf8'), context);
    return { context: context, sheet: sheet };
}

test('Apps Script updateEventProject changes only project columns', function () {
    const fixture = createAppsScriptContext([
        ['syncedAt', 'eventId', 'amount', 'service', 'projectId', 'projectName', 'user', 'trackerVersion'],
        ['2026-07-20T10:00:00.000Z', 'event:1', 15, 'kling', 'old', 'Old', 'Denis', '0.9.1']
    ]);
    const response = fixture.context.updateEventProject({
        eventId: 'event:1',
        projectId: 'new',
        projectName: 'New project'
    });
    const data = JSON.parse(response.text);
    assert.equal(data.updated, true);
    assert.deepEqual(fixture.sheet.rows[1], [
        '2026-07-20T10:00:00.000Z', 'event:1', 15, 'kling', 'new', 'New project', 'Denis', '0.9.1'
    ]);
});

test('Apps Script updateEventProject reports a missing event without adding a row', function () {
    const fixture = createAppsScriptContext([
        ['syncedAt', 'eventId', 'amount', 'service', 'projectId', 'projectName', 'user', 'trackerVersion']
    ]);
    const response = fixture.context.updateEventProject({
        eventId: 'missing',
        projectId: 'new',
        projectName: 'New project'
    });
    assert.equal(JSON.parse(response.text).updated, false);
    assert.equal(fixture.sheet.rows.length, 1);
});
