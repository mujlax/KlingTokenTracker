import { MAX_PROJECTS } from './constants.js';
import { createId } from '../lib/ids.js';

export function sanitizeMetadata(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const allowed = ['resolution', 'duration', 'outputs', 'audio', 'mode', 'aspectRatio', 'model', 'prompt'];
    const result = {};
    allowed.forEach(function (key) {
        if (value[key] == null || value[key] === '') return;
        const maxLen = key === 'prompt' ? 200 : 80;
        result[key] = typeof value[key] === 'number' ? value[key] : String(value[key]).slice(0, maxLen);
    });
    return result;
}

export function sanitizeProjectUrl(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw.slice(0, 500);
    if (/^\/\//.test(raw)) return ('https:' + raw).slice(0, 500);
    return raw.slice(0, 500);
}

export function sanitizeProject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { id: '', name: '', url: '' };
    return {
        id: String(value.id || '').trim().slice(0, 80),
        name: String(value.name || '').trim().slice(0, 160),
        url: sanitizeProjectUrl(value.url || '')
    };
}

export function sanitizeProjectEntry(value) {
    const project = sanitizeProject(value || {});
    const status = value && value.status === 'archived' ? 'archived' : 'active';
    return {
        id: project.id || createId('project'),
        name: project.name,
        url: project.url,
        status: status,
        createdAt: Number(value && value.createdAt || Date.now()),
        updatedAt: Number(value && value.updatedAt || Date.now()),
        updatedBy: String(value && value.updatedBy || '').trim().slice(0, 80)
    };
}

export function sanitizeProjectLibrary(value) {
    if (!Array.isArray(value)) return [];
    const seen = {};
    return value.map(function (entry) {
        return sanitizeProjectEntry(entry);
    }).filter(function (entry) {
        if (!entry.name) return false;
        if (seen[entry.id]) return false;
        seen[entry.id] = true;
        return true;
    }).sort(function (a, b) {
        return b.updatedAt - a.updatedAt;
    }).slice(0, MAX_PROJECTS);
}
