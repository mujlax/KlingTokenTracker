import {
    DUPLICATE_WINDOW_MS,
    UI_CLICK_DEDUP_MS,
    SPEND_MERGE_MS,
    MAX_EVENTS
} from './constants.js';
import { isFiniteCredit, normalizeCredit, nearlyEqual } from '../lib/credits.js';
import { redactUrl } from '../lib/utils.js';
import { createId } from '../lib/ids.js';
import { sanitizeMetadata, sanitizeProject } from './project-model.js';

export { createId } from '../lib/ids.js';

export function localDateKey(ts) {
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return year + '-' + month + '-' + day;
}

export function createEventId(input, ts) {
    return [
        'delta',
        Math.floor(ts / 1000),
        normalizeCredit(input.before),
        normalizeCredit(input.after),
        normalizeCredit(input.amount)
    ].join(':');
}

export function mergeSources(a, b) {
    const first = a || '';
    const second = b || '';
    if (!first) return second || 'unknown';
    if (!second || first === second) return first;
    if (first === 'estimated' && second === 'network') return 'network';
    if (first === 'network' && second === 'estimated') return 'network';
    if (first === 'estimated' && second === 'ui') return 'ui';
    if (first === 'ui' && second === 'estimated') return 'ui';
    if (first === 'mixed' || second === 'mixed') return 'mixed';
    if ((first === 'network' && second === 'ui') || (first === 'ui' && second === 'network')) return 'mixed';
    return first;
}

export function findDuplicateSpend(history, input, now) {
    for (let i = 0; i < history.length; i += 1) {
        const event = history[i];
        if (!event || now - event.ts > DUPLICATE_WINDOW_MS) continue;
        if (input.taskId && event.taskId && input.taskId === event.taskId) return event;
        if (
            input.source === 'ui' &&
            event.source === 'ui' &&
            event.estimated === true &&
            input.estimated === true &&
            now - event.ts <= UI_CLICK_DEDUP_MS &&
            nearlyEqual(event.amount, input.amount)
        ) {
            return event;
        }
        if (
            nearlyEqual(event.amount, input.amount) &&
            nearlyEqual(event.before, input.before) &&
            nearlyEqual(event.after, input.after) &&
            now - event.ts <= SPEND_MERGE_MS
        ) {
            return event;
        }
    }
    return null;
}

export function resolveUiSpendBalance(amount, now, state) {
    const balance = state.balance;
    const lastUiSpend = state.lastUiSpend;
    let before = balance;

    if (
        lastUiSpend &&
        isFiniteCredit(lastUiSpend.expectedAfter) &&
        now - lastUiSpend.ts < DUPLICATE_WINDOW_MS
    ) {
        const balanceStale =
            balance == null ||
            (isFiniteCredit(lastUiSpend.beforeAtClick) &&
                nearlyEqual(balance, lastUiSpend.beforeAtClick));
        if (balanceStale) {
            before = lastUiSpend.expectedAfter;
        }
    }

    if (!isFiniteCredit(before) || before <= 0) {
        return {
            before: isFiniteCredit(before) ? normalizeCredit(before) : null,
            after: isFiniteCredit(before) ? normalizeCredit(before) : null
        };
    }

    return {
        before: normalizeCredit(before),
        after: normalizeCredit(before - amount)
    };
}

export function createSession() {
    return {
        id: createId('session'),
        startedAt: Date.now(),
        total: 0,
        eventIds: []
    };
}

export function sanitizeSession(value) {
    if (!value || typeof value !== 'object') return null;
    return {
        id: String(value.id || createId('session')),
        startedAt: Number(value.startedAt || Date.now()),
        total: normalizeCredit(Number(value.total || 0)),
        eventIds: Array.isArray(value.eventIds) ? value.eventIds.map(String).slice(0, MAX_EVENTS) : []
    };
}

export function sanitizeEvents(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(function (event) {
        return event && typeof event === 'object' && isFiniteCredit(Number(event.amount));
    }).map(function (event) {
        return {
            id: String(event.id || createId('event')),
            ts: Number(event.ts || Date.now()),
            localDate: String(event.localDate || localDateKey(event.ts || Date.now())),
            amount: normalizeCredit(Number(event.amount || 0)),
            before: normalizeCredit(Number(event.before || 0)),
            after: normalizeCredit(Number(event.after || 0)),
            source: String(event.source || 'unknown'),
            service: String(event.service || 'kling'),
            serviceName: String(event.serviceName || (event.service === 'kling' || !event.service ? 'Kling' : event.service)),
            taskId: event.taskId == null ? null : String(event.taskId),
            url: redactUrl(event.url || ''),
            method: String(event.method || ''),
            path: String(event.path || ''),
            score: event.score == null ? null : Number(event.score),
            pendingId: event.pendingId == null ? null : String(event.pendingId),
            detail: String(event.detail || ''),
            metadata: sanitizeMetadata(event.metadata || {}),
            project: sanitizeProject(event.project || {}),
            estimated: event.estimated === true,
            updatedAt: event.updatedAt ? Number(event.updatedAt) : undefined
        };
    }).sort(function (a, b) {
        return b.ts - a.ts;
    }).slice(0, MAX_EVENTS);
}

export function addEventToSession(session, event) {
    if (!session || !Array.isArray(session.eventIds)) session = createSession();
    if (session.eventIds.indexOf(event.id) >= 0) return session;
    session.eventIds.push(event.id);
    session.total = normalizeCredit(Number(session.total || 0) + Number(event.amount || 0));
    return session;
}

export function eventMatchesService(event, serviceId) {
    return String((event && event.service) || 'kling') === serviceId;
}

export function eventMatchesProject(event, project) {
    if (!project || !project.name) return false;
    const eventProject = sanitizeProject((event && event.project) || {});
    if (!eventProject.name) return false;
    if (project.id && eventProject.id) return eventProject.id === project.id;
    if (eventProject.name !== project.name) return false;
    if (project.url && eventProject.url && project.url !== eventProject.url) return false;
    return true;
}

export function getFilteredHistory(history, project) {
    if (!project || !project.name) return history.slice();
    return history.filter(function (event) {
        return eventMatchesProject(event, project);
    });
}

export function getProjectAllTimeTotal(history, project) {
    return normalizeCredit(getFilteredHistory(history, project).reduce(function (sum, event) {
        return sum + Number(event.amount || 0);
    }, 0));
}

export function getProjectTotalsByService(history, project) {
    const grouped = {};
    getFilteredHistory(history, project).forEach(function (event) {
        const service = String((event && event.service) || 'kling');
        if (!grouped[service]) {
            grouped[service] = {
                service: service,
                serviceName: String((event && event.serviceName) || service),
                total: 0,
                count: 0
            };
        } else if (event && event.serviceName && grouped[service].serviceName === service) {
            grouped[service].serviceName = String(event.serviceName);
        }
        grouped[service].total += Number((event && event.amount) || 0);
        grouped[service].count += 1;
    });

    return Object.keys(grouped).map(function (service) {
        return {
            service: grouped[service].service,
            serviceName: grouped[service].serviceName,
            total: normalizeCredit(grouped[service].total),
            count: grouped[service].count
        };
    }).sort(function (a, b) {
        if (b.total !== a.total) return b.total - a.total;
        return a.serviceName.localeCompare(b.serviceName);
    });
}

export function getTodayTotal(history, serviceId) {
    const today = localDateKey(Date.now());
    return normalizeCredit(history.reduce(function (sum, event) {
        if (event.localDate !== today) return sum;
        if (!eventMatchesService(event, serviceId)) return sum;
        return sum + Number(event.amount || 0);
    }, 0));
}
