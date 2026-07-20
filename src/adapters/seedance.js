import {
    buildCalculatedSpendDetail,
    findFormLikeContainer,
    getDirectClickableText,
    getElementRectSummary
} from './shared.js';
import { isFiniteCredit, normalizeCredit, parseLooseNumber } from '../lib/credits.js';
import { compactText } from '../lib/utils.js';

export const SEEDANCE_RATES = {
    '480P': { Pro: 143, Fast: 100, Mini: 72 },
    '720P': { Pro: 240, Fast: 168, Mini: 120 },
    '1080P': { Pro: 600, Fast: 420, Mini: 300 },
    '4K': { Pro: 1200, Fast: 840, Mini: 600 }
};

const SEEDANCE_LABELS = ['Aspect Ratio', 'Duration', 'Mode', 'Resolution'];

function normalizeResolution(value) {
    const text = compactText(value).toUpperCase();
    if (/^4\s*K$/.test(text)) return '4K';
    const match = text.match(/\b(480P|720P|1080P|4K)\b/i);
    return match ? match[1].toUpperCase() : '';
}

function normalizeMode(value) {
    const match = compactText(value).match(/\b(Pro|Fast|Mini)\b/i);
    if (!match) return '';
    return match[1].slice(0, 1).toUpperCase() + match[1].slice(1).toLowerCase();
}

function normalizeDuration(value) {
    const match = compactText(value).match(/(\d+(?:[.,]\d+)?)\s*s\b/i);
    if (!match) return { label: '', seconds: NaN };
    const seconds = parseLooseNumber(match[1]);
    return {
        label: isFiniteCredit(seconds) ? normalizeCredit(seconds) + 's' : '',
        seconds
    };
}

function normalizeAspectRatio(value) {
    const match = compactText(value).match(/\b(\d{1,2}:\d{1,2})\b/);
    return match ? match[1] : '';
}

function extractPrompt(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return '';
    const fields = container.querySelectorAll('textarea, [contenteditable="true"], input[type="text"], input:not([type])');
    for (let i = 0; i < fields.length; i += 1) {
        const field = fields[i];
        const text = compactText(field.value || field.textContent || '');
        if (text && !/^generate$/i.test(text)) return text.slice(0, 200);
    }
    return '';
}

function getElementText(element) {
    if (!element) return '';
    return compactText([
        element.innerText || '',
        element.textContent || '',
        element.value || '',
        element.getAttribute ? element.getAttribute('aria-label') || '' : '',
        element.getAttribute ? element.getAttribute('title') || '' : ''
    ].join(' '));
}

function isUsefulSelectValue(text, label) {
    const normalized = compactText(text);
    if (!normalized || normalized.length > 40) return false;
    if (label && normalized.toLowerCase() === String(label).toLowerCase()) return false;
    if (/upload|generate|prompt|collection|guide/i.test(normalized)) return false;
    return true;
}

function readSeedanceComboboxValues(container) {
    if (!container || typeof container.querySelectorAll !== 'function') return null;

    const controls = Array.from(container.querySelectorAll('button[role="combobox"], [role="combobox"], select')).filter(function (element) {
        return isUsefulSelectValue(getElementText(element), '');
    });

    if (controls.length < SEEDANCE_LABELS.length) return null;

    const selected = controls.slice(-SEEDANCE_LABELS.length);
    return {
        aspectRatio: getElementText(selected[0]),
        duration: getElementText(selected[1]),
        mode: getElementText(selected[2]),
        resolution: getElementText(selected[3])
    };
}

export function calculateSeedanceCost(settings) {
    const resolution = normalizeResolution(settings && settings.resolution);
    const mode = normalizeMode(settings && settings.mode);
    const duration = normalizeDuration(settings && settings.duration);
    const rate = resolution && mode && SEEDANCE_RATES[resolution] && SEEDANCE_RATES[resolution][mode];

    if (!isFiniteCredit(duration.seconds) || duration.seconds <= 0 || !isFiniteCredit(rate) || rate <= 0) {
        return NaN;
    }

    return normalizeCredit(duration.seconds * rate);
}

export function parseSeedanceSettingsFromText(text) {
    const values = {};
    SEEDANCE_LABELS.forEach(function (label, index) {
        values[label] = '';
        const nextLabels = SEEDANCE_LABELS.slice(index + 1).map(function (item) {
            return String(item).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        });
        const endPattern = nextLabels.length ? '(?=\\s+(?:' + nextLabels.join('|') + ')\\b|$)' : '(?=$)';
        const match = compactText(text).match(new RegExp('\\b' + label + '\\b\\s+(.+?)' + endPattern, 'i'));
        if (match) values[label] = compactText(match[1]);
    });

    return normalizeSeedanceSettings({
        aspectRatio: values['Aspect Ratio'],
        duration: values.Duration,
        mode: values.Mode,
        resolution: values.Resolution
    });
}

export function normalizeSeedanceSettings(input) {
    const duration = normalizeDuration(input && input.duration);
    return {
        aspectRatio: normalizeAspectRatio(input && input.aspectRatio),
        duration: duration.label,
        durationSeconds: duration.seconds,
        mode: normalizeMode(input && input.mode),
        resolution: normalizeResolution(input && input.resolution),
        prompt: compactText((input && input.prompt) || '').slice(0, 200)
    };
}

export function getSeedanceSettings(container) {
    const comboValues = readSeedanceComboboxValues(container);
    if (comboValues) {
        return normalizeSeedanceSettings({
            aspectRatio: comboValues.aspectRatio,
            duration: comboValues.duration,
            mode: comboValues.mode,
            resolution: comboValues.resolution,
            prompt: extractPrompt(container)
        });
    }

    const values = parseSeedanceSettingsFromText((container && (container.innerText || container.textContent)) || '');
    return normalizeSeedanceSettings({
        aspectRatio: values.aspectRatio,
        duration: values.duration,
        mode: values.mode,
        resolution: values.resolution,
        prompt: extractPrompt(container)
    });
}

export function createSeedanceAdapter(h) {
    return {
        id: 'seedance',
        name: 'Seedance',
        networkEnabled: false,
        uiBalanceEnabled: false,
        matchesLocation: function (url) {
            return /^https?:\/\/(?:[\w-]+\.)*sjinn\.ai\/tools\/seedance20-video(?:[/?#]|$)/i.test(String(url || ''));
        },
        parseGenerateClick: function (clickable, event) {
            const directText = getDirectClickableText(clickable);
            if (!/^generate$/i.test(directText)) return null;

            const container = findFormLikeContainer(clickable, SEEDANCE_LABELS, h.getPanelHost(), 10);
            if (!container) {
                h.addDiagnostic('ignored seedance generate without form context', directText, getElementRectSummary(clickable));
                return null;
            }

            if (event && clickable && typeof clickable.getBoundingClientRect === 'function') {
                const rect = clickable.getBoundingClientRect();
                if (rect && Number.isFinite(rect.left) && Number.isFinite(event.clientX)) {
                    const inside =
                        event.clientX >= rect.left &&
                        event.clientX <= rect.right &&
                        event.clientY >= rect.top &&
                        event.clientY <= rect.bottom;
                    if (!inside) return null;
                }
            }

            const settings = getSeedanceSettings(container);
            const amount = calculateSeedanceCost(settings);
            if (!isFiniteCredit(amount) || amount <= 0) {
                h.addDiagnostic('seedance generate click without calculable cost', settings);
                return null;
            }

            return {
                amount,
                detail: buildCalculatedSpendDetail('Seedance Generate', settings, amount),
                metadata: {
                    resolution: settings.resolution,
                    duration: settings.duration,
                    mode: settings.mode,
                    aspectRatio: settings.aspectRatio,
                    model: 'Seedance 2.0',
                    prompt: settings.prompt
                },
                estimated: true
            };
        },
        extractBalance: function () {
            return null;
        },
        isRelevantDebugUrl: function () {
            return false;
        }
    };
}
