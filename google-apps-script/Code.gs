/**
 * AI Token Tracker — Google Sheets receiver.
 * Set SECRET_TOKEN and SPREADSHEET_ID, then deploy as Web App.
 */
var SECRET_TOKEN = 'token';
var SPREADSHEET_ID = '1j7MlDBLgBEYtwoxSzrYc4NQ6FY9SSpP9_8l3hQxxcaI';

var EVENTS_SHEET = 'Events';
var EVENT_HEADERS = [
  'syncedAt',
  'eventId',
  'amount',
  'service',
  'projectId',
  'projectName',
  'user',
  'trackerVersion'
];

var PROJECTS_SHEET = 'Projects';
var PROJECT_HEADERS = [
  'projectId',
  'name',
  'url',
  'status',
  'createdAt',
  'updatedAt',
  'updatedBy'
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
    if (action === 'deleteEvent') {
      return deleteEvent(body.payload || {});
    }
    if (action === 'updateEventProject') {
      return updateEventProject(body.payload || {});
    }
    if (action === 'listEvents') {
      return listEvents();
    }
    if (action === 'listProjects') {
      return listProjects();
    }
    if (action === 'upsertProject') {
      return upsertProject(body.payload || {});
    }
    if (action === 'archiveProject') {
      return archiveProject(body.payload || {});
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

  if (action === 'listEvents') {
    if (!params.token || params.token !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }
    return listEvents();
  }

  if (action === 'listProjects') {
    if (!params.token || params.token !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
    }
    return listProjects();
  }

  return jsonResponse({ ok: false, error: 'unknown action' }, 400);
}

var MAX_LIST_ROWS = 5000;

function listEvents() {
  var sheet = getEventsSheet();
  sortEventsNewestFirst(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: true, events: [] }, 200);
  }

  var startRow = 2;
  var numRows = Math.min(lastRow - 1, MAX_LIST_ROWS);
  var values = sheet.getRange(startRow, 1, numRows, EVENT_HEADERS.length).getValues();
  var events = [];
  for (var i = 0; i < values.length; i++) {
    var rowObj = {};
    for (var c = 0; c < EVENT_HEADERS.length; c++) {
      rowObj[EVENT_HEADERS[c]] = values[i][c];
    }
    if (!rowObj.eventId) continue;
    events.push({
      syncedAt: toIso(rowObj.syncedAt),
      eventId: String(rowObj.eventId),
      amount: Number(rowObj.amount || 0),
      service: String(rowObj.service || ''),
      projectId: String(rowObj.projectId || ''),
      projectName: String(rowObj.projectName || ''),
      user: String(rowObj.user || ''),
      trackerVersion: String(rowObj.trackerVersion || '')
    });
  }
  return jsonResponse({ ok: true, events: events }, 200);
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

function getProjectsSheet() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(PROJECTS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(PROJECTS_SHEET);
    sheet.getRange(1, 1, 1, PROJECT_HEADERS.length).setValues([PROJECT_HEADERS]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, PROJECT_HEADERS.length).setValues([PROJECT_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function projectFromValues(values) {
  var rowObj = {};
  for (var i = 0; i < PROJECT_HEADERS.length; i++) {
    rowObj[PROJECT_HEADERS[i]] = values[i];
  }
  return {
    projectId: String(rowObj.projectId || ''),
    name: String(rowObj.name || ''),
    url: String(rowObj.url || ''),
    status: rowObj.status === 'archived' ? 'archived' : 'active',
    createdAt: toIso(rowObj.createdAt),
    updatedAt: toIso(rowObj.updatedAt),
    updatedBy: String(rowObj.updatedBy || '')
  };
}

function projectToRow(project) {
  return [
    String(project.projectId || ''),
    String(project.name || ''),
    String(project.url || ''),
    project.status === 'archived' ? 'archived' : 'active',
    String(project.createdAt || ''),
    String(project.updatedAt || ''),
    String(project.updatedBy || '')
  ];
}

function listProjects() {
  var sheet = getProjectsSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return jsonResponse({ ok: true, projects: [] }, 200);
  }
  var values = sheet.getRange(2, 1, lastRow - 1, PROJECT_HEADERS.length).getValues();
  var projects = [];
  for (var i = 0; i < values.length; i++) {
    var project = projectFromValues(values[i]);
    if (project.projectId && project.name) projects.push(project);
  }
  return jsonResponse({ ok: true, projects: projects }, 200);
}

function findProjectRow(sheet, projectId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(projectId)) return i + 2;
  }
  return 0;
}

function upsertProject(payload) {
  if (!payload || !payload.projectId || !String(payload.name || '').trim()) {
    return jsonResponse({ ok: false, error: 'missing projectId or name' }, 400);
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getProjectsSheet();
    var row = findProjectRow(sheet, payload.projectId);
    var now = new Date().toISOString();
    var createdAt = payload.createdAt || now;
    if (row) {
      var existing = projectFromValues(sheet.getRange(row, 1, 1, PROJECT_HEADERS.length).getValues()[0]);
      createdAt = existing.createdAt || createdAt;
    }
    var project = {
      projectId: String(payload.projectId),
      name: String(payload.name).trim().slice(0, 160),
      url: String(payload.url || '').trim().slice(0, 500),
      status: 'active',
      createdAt: String(createdAt),
      updatedAt: now,
      updatedBy: String(payload.updatedBy || '').trim().slice(0, 80)
    };
    if (row) {
      sheet.getRange(row, 1, 1, PROJECT_HEADERS.length).setValues([projectToRow(project)]);
    } else {
      sheet.appendRow(projectToRow(project));
    }
    return jsonResponse({ ok: true, project: project }, 200);
  } finally {
    lock.releaseLock();
  }
}

function archiveProject(payload) {
  if (!payload || !payload.projectId) {
    return jsonResponse({ ok: false, error: 'missing projectId' }, 400);
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getProjectsSheet();
    var row = findProjectRow(sheet, payload.projectId);
    var now = new Date().toISOString();
    var project;
    if (row) {
      project = projectFromValues(sheet.getRange(row, 1, 1, PROJECT_HEADERS.length).getValues()[0]);
    } else {
      if (!String(payload.name || '').trim()) {
        return jsonResponse({ ok: false, error: 'missing project name' }, 400);
      }
      project = {
        projectId: String(payload.projectId),
        name: String(payload.name).trim().slice(0, 160),
        url: String(payload.url || '').trim().slice(0, 500),
        createdAt: String(payload.createdAt || now)
      };
    }
    project.createdAt = project.createdAt || String(payload.createdAt || now);
    project.status = 'archived';
    project.updatedAt = now;
    project.updatedBy = String(payload.updatedBy || '').trim().slice(0, 80);
    if (row) {
      sheet.getRange(row, 1, 1, PROJECT_HEADERS.length).setValues([projectToRow(project)]);
    } else {
      sheet.appendRow(projectToRow(project));
    }
    return jsonResponse({ ok: true, project: project }, 200);
  } finally {
    lock.releaseLock();
  }
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

function sortEventsNewestFirst(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return;
  sheet.getRange(2, 1, lastRow - 1, EVENT_HEADERS.length).sort({
    column: 1,
    ascending: false
  });
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
      Number(payload.amount || 0),
      String(payload.service || ''),
      String(payload.projectId || ''),
      String(payload.projectName || ''),
      String(payload.user || ''),
      String(payload.trackerVersion || '')
    ];
    sheet.appendRow(row);
    sortEventsNewestFirst(sheet);
    return jsonResponse({ ok: true, eventId: payload.eventId }, 200);
  } finally {
    lock.releaseLock();
  }
}

function findEventRow(sheet, eventId) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]) === String(eventId)) return i + 2;
  }
  return 0;
}

function deleteEvent(payload) {
  if (!payload || !payload.eventId) {
    return jsonResponse({ ok: false, error: 'missing eventId' }, 400);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getEventsSheet();
    var row = findEventRow(sheet, payload.eventId);
    if (!row) {
      return jsonResponse({ ok: true, eventId: payload.eventId, deleted: false }, 200);
    }
    sheet.deleteRow(row);
    return jsonResponse({ ok: true, eventId: payload.eventId, deleted: true }, 200);
  } finally {
    lock.releaseLock();
  }
}

function updateEventProject(payload) {
  if (!payload || !payload.eventId) {
    return jsonResponse({ ok: false, error: 'missing eventId' }, 400);
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var sheet = getEventsSheet();
    var row = findEventRow(sheet, payload.eventId);
    if (!row) {
      return jsonResponse({ ok: true, eventId: payload.eventId, updated: false }, 200);
    }
    sheet.getRange(row, 5, 1, 2).setValues([[
      String(payload.projectId || ''),
      String(payload.projectName || '')
    ]]);
    sortEventsNewestFirst(sheet);
    return jsonResponse({ ok: true, eventId: payload.eventId, updated: true }, 200);
  } finally {
    lock.releaseLock();
  }
}

function toIso(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
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
