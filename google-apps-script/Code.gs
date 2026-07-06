/**
 * AI Token Tracker — Google Sheets receiver.
 * Set SECRET_TOKEN and SPREADSHEET_ID, then deploy as Web App.
 */
var SECRET_TOKEN = 'token';
var SPREADSHEET_ID = 'CHANGE_ME';

var EVENTS_SHEET = 'Events';
var EVENT_HEADERS = [
  'syncedAt',
  'eventId',
  'ts',
  'localDate',
  'amount',
  'service',
  'serviceName',
  'projectId',
  'projectName',
  'projectKey',
  'user',
  'source',
  'estimated',
  'trackerVersion'
];

function doPost(e) {
  try {
    var body = parseRequestBody(e);
    if (!body.token || body.token !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }

    var action = body.action;
    if (action === 'ping') {
      return jsonResponse({ ok: true, action: 'ping' }, 200);
    }
    if (action === 'appendEvent') {
      return appendEvent(body.payload || {});
    }
    return jsonResponse({ ok: false, error: 'unknown action' }, 400);
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err && err.message ? err.message : err) }, 500);
  }
}

function doGet(e) {
  var params = e && e.parameter ? e.parameter : {};
  var action = params.action || '';

  if (action === 'ping') {
    if (!params.token || params.token !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }
    return jsonResponse({ ok: true, action: 'ping' }, 200);
  }

  if (action === 'listEvents' || action === 'listProjects') {
    return jsonResponse({ ok: false, error: 'not implemented' }, 501);
  }

  return jsonResponse({ ok: false, error: 'unknown action' }, 400);
}

function parseRequestBody(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('empty body');
  }
  var contents = String(e.postData.contents).trim();
  if (!contents) {
    throw new Error('empty body');
  }
  return JSON.parse(contents);
}

function getEventsSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(EVENTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(EVENTS_SHEET);
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, EVENT_HEADERS.length).setValues([EVENT_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function hasEventId(sheet, eventId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var startRow = Math.max(2, lastRow - 3000);
  var numRows = lastRow - startRow + 1;
  var values = sheet.getRange(startRow, 2, numRows, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(eventId)) return true;
  }
  return false;
}

function appendEvent(payload) {
  if (!payload || !payload.eventId) {
    return jsonResponse({ ok: false, error: 'missing eventId' }, 400);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getEventsSheet();
    if (hasEventId(sheet, payload.eventId)) {
      return jsonResponse({ ok: false, error: 'duplicate', eventId: payload.eventId }, 409);
    }

    var syncedAt = new Date().toISOString();
    var row = [
      syncedAt,
      String(payload.eventId || ''),
      String(payload.ts || ''),
      String(payload.localDate || ''),
      Number(payload.amount || 0),
      String(payload.service || ''),
      String(payload.serviceName || ''),
      String(payload.projectId || ''),
      String(payload.projectName || ''),
      String(payload.projectKey || ''),
      String(payload.user || ''),
      String(payload.source || ''),
      payload.estimated === true,
      String(payload.trackerVersion || '')
    ];
    sheet.appendRow(row);
    return jsonResponse({ ok: true, eventId: payload.eventId }, 200);
  } finally {
    lock.releaseLock();
  }
}

function jsonResponse(obj, statusCode) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  if (statusCode) {
    // Apps Script Web Apps don't support custom HTTP status codes directly;
    // clients should inspect JSON body. Include status hint for debugging.
    obj = Object.assign({}, obj, { status: statusCode });
    output = ContentService.createTextOutput(JSON.stringify(obj));
    output.setMimeType(ContentService.MimeType.JSON);
  }
  return output;
}
