import { SETTINGS_KEY, DEFAULT_SHEETS_WEB_APP_URL, DEFAULT_SHEETS_SECRET_TOKEN } from './constants.js';
import { readJson, writeJson } from './storage.js';
import { clamp } from '../lib/utils.js';

export function readSheetsFieldsFromForm(root) {
    if (!root || typeof root.querySelector !== 'function') return {};
    const enabled = root.querySelector('[data-field="settingSheetsEnabled"]');
    const nickname = root.querySelector('[data-field="settingSheetsNickname"]');
    const url = root.querySelector('[data-field="settingSheetsWebAppUrl"]');
    const token = root.querySelector('[data-field="settingSheetsSecretToken"]');
    const patch = {};
    if (enabled) patch.sheetsEnabled = enabled.checked === true;
    if (nickname) patch.sheetsNickname = nickname.value;
    if (url) patch.sheetsWebAppUrl = url.value;
    if (token) patch.sheetsSecretToken = token.value;
    return patch;
}

export function applySheetsFieldsFromForm(ctx, root) {
    const patch = readSheetsFieldsFromForm(root);
    if (!Object.keys(patch).length) return;
    ctx.runtime.settings = sanitizeSettings(Object.assign({}, ctx.runtime.settings, patch));
    writeJson(SETTINGS_KEY, ctx.runtime.settings);
}

export const DEFAULT_SETTINGS = {
    idleOpacity: 0.2,
    summaryEventsCount: 3,
    historyDisplayLimit: 50,
    rememberPanelPosition: false,
    panelWidth: 286,
    sheetsEnabled: true,
    sheetsWebAppUrl: DEFAULT_SHEETS_WEB_APP_URL,
    sheetsSecretToken: DEFAULT_SHEETS_SECRET_TOKEN,
    sheetsNickname: '',
    sheetsLastSyncAt: null,
    sheetsLastError: ''
};

const SUMMARY_COUNTS = [1, 3, 5, 10];
const HISTORY_LIMITS = [25, 50, 100];
const PANEL_WIDTHS = [260, 286, 320];

function pickWhitelist(value, allowed, fallback) {
    const num = Number(value);
    return allowed.indexOf(num) >= 0 ? num : fallback;
}

export function sanitizeSettings(value) {
    const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const idleOpacity = clamp(Number(input.idleOpacity), 0.1, 0.8);
    return {
        idleOpacity: Number.isFinite(idleOpacity) ? idleOpacity : DEFAULT_SETTINGS.idleOpacity,
        summaryEventsCount: pickWhitelist(input.summaryEventsCount, SUMMARY_COUNTS, DEFAULT_SETTINGS.summaryEventsCount),
        historyDisplayLimit: pickWhitelist(input.historyDisplayLimit, HISTORY_LIMITS, DEFAULT_SETTINGS.historyDisplayLimit),
        rememberPanelPosition: input.rememberPanelPosition === true,
        panelWidth: pickWhitelist(input.panelWidth, PANEL_WIDTHS, DEFAULT_SETTINGS.panelWidth),
        sheetsEnabled: input.sheetsEnabled === false ? false : true,
        sheetsWebAppUrl: String(input.sheetsWebAppUrl || '').trim().slice(0, 500) || DEFAULT_SHEETS_WEB_APP_URL,
        sheetsSecretToken: String(input.sheetsSecretToken || '').trim().slice(0, 200) || DEFAULT_SHEETS_SECRET_TOKEN,
        sheetsNickname: String(input.sheetsNickname || '').trim().slice(0, 80),
        sheetsLastSyncAt: input.sheetsLastSyncAt == null || input.sheetsLastSyncAt === ''
            ? null
            : Number(input.sheetsLastSyncAt) || null,
        sheetsLastError: String(input.sheetsLastError || '').slice(0, 200)
    };
}

export function saveSettings(ctx) {
    writeJson(SETTINGS_KEY, ctx.runtime.settings);
}

export function applyPanelSettings(ctx) {
    const host = ctx.runtime.panelHost;
    const shadowRoot = ctx.runtime.shadowRoot;
    if (!host || !shadowRoot) return;

    const settings = ctx.runtime.settings || DEFAULT_SETTINGS;
    host.style.setProperty('--ktt-idle-opacity', String(settings.idleOpacity));

    const panel = shadowRoot.querySelector('.panel');
    if (panel) {
        panel.style.width = settings.panelWidth + 'px';
    }
}

export function needsSheetsNickname(settings) {
    const value = settings || {};
    return value.sheetsEnabled !== false && !String(value.sheetsNickname || '').trim();
}

export function loadSettings() {
    const raw = readJson(SETTINGS_KEY, {});
    const settings = sanitizeSettings(raw);
    if (!String(raw.sheetsWebAppUrl || '').trim()) {
        settings.sheetsWebAppUrl = DEFAULT_SHEETS_WEB_APP_URL;
    }
    if (!String(raw.sheetsSecretToken || '').trim()) {
        settings.sheetsSecretToken = DEFAULT_SHEETS_SECRET_TOKEN;
    }
    if (raw.sheetsEnabled !== false) {
        settings.sheetsEnabled = true;
    }
    return settings;
}
