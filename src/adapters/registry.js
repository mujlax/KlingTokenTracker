import { ADAPTER_FACTORIES } from './index.js';

export let ADAPTERS = [];

export function initAdapters(helpers) {
    ADAPTERS = ADAPTER_FACTORIES.map(function (createAdapter) {
        return createAdapter(helpers);
    });
    return ADAPTERS;
}

export function getActiveAdapter() {
    for (let i = 0; i < ADAPTERS.length; i += 1) {
        if (ADAPTERS[i].matchesLocation(window.location.href)) return ADAPTERS[i];
    }
    return ADAPTERS[0] || null;
}
