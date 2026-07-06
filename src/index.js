import { createTracker } from './core/tracker.js';
import { getPageWindow } from './core/storage.js';
import { VERSION } from './core/constants.js';

export function boot() {
    const pageWindow = getPageWindow();
    if (pageWindow.__AI_TOKEN_TRACKER_INSTALLED__ || pageWindow.__KLING_TOKEN_TRACKER_INSTALLED__) return;
    pageWindow.__AI_TOKEN_TRACKER_INSTALLED__ = true;
    pageWindow.__KLING_TOKEN_TRACKER_INSTALLED__ = true;
    try {
        createTracker();
        console.info('[AI Token Tracker]', VERSION, 'started on', location.href);
    } catch (error) {
        console.error('[AI Token Tracker] boot failed:', error);
        pageWindow.__AI_TOKEN_TRACKER_INSTALLED__ = false;
        pageWindow.__KLING_TOKEN_TRACKER_INSTALLED__ = false;
    }
}

boot();
