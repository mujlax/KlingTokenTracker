export function isFiniteCredit(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1000000000;
}

export function normalizeCredit(value) {
    return Math.round(Number(value) * 1000000) / 1000000;
}

export function nearlyEqual(a, b) {
    return Math.abs(Number(a) - Number(b)) < 0.000001;
}

export function parseLooseNumber(value) {
    if (value == null || value === '') return NaN;
    const normalized = String(value).replace(/\s+/g, '').replace(',', '.');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : NaN;
}

export function normalizeJsonNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') return parseLooseNumber(value);
    return NaN;
}
