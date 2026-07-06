import { createKlingAdapter } from './kling.js';
import { createHiggsfieldAdapter } from './higgsfield.js';

export let ADAPTERS = [];

export function initAdapters(helpers) {
    ADAPTERS = [
        createKlingAdapter(helpers),
        createHiggsfieldAdapter(helpers)
    ];
    return ADAPTERS;
}

export function getActiveAdapter() {
    for (let i = 0; i < ADAPTERS.length; i += 1) {
        if (ADAPTERS[i].matchesLocation(window.location.href)) return ADAPTERS[i];
    }
    return ADAPTERS[0] || null;
}
