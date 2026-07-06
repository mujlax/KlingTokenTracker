import { MIN_BALANCE_SCORE } from '../core/constants.js';
import { walkJson } from './utils.js';
import { normalizeJsonNumber, isFiniteCredit, normalizeCredit } from './credits.js';

export function scoreBalancePath(pathText, url) {
    const path = String(pathText || '').toLowerCase();
    const urlText = String(url || '').toLowerCase();
    let score = 0;

    if (/\/api\/notify\/expiredpoint/.test(urlText)) return -100;
    if (/\/api\/task\/price|\/api\/task\/calculate-price/.test(urlText)) return -100;
    if (/remainpoints|remain_points/.test(path) && !/\/api\/account\/pointandticket/.test(urlText)) return -100;
    if (/quota/.test(path) && !/\/api\/account\//.test(urlText)) return -100;

    if (/\/api\/account\/pointandticket/.test(urlText) && /^data\.total$/.test(path)) score += 25;
    if (/\/api\/account\/pointandticket/.test(urlText) && /^data\.points\.\d+\.balance$/.test(path)) score -= 6;
    if (/\/api\/account\//.test(urlText) && /balance|point|credit|ticket/.test(path)) score += 12;

    if (/balance/.test(path)) score += 12;
    if (/remain|remaining|available|left/.test(path)) score += 10;
    if (/wallet|account|quota/.test(path)) score += 7;
    if (/credit|credits|token|tokens/.test(path)) score += 6;
    if (/coin|coins/.test(path)) score += 4;

    if (/wallet|account|balance|credit|quota|asset|pointandticket/.test(urlText)) score += 3;
    if (/\/api\/user\/|\/api\/elements|\/api\/product|\/api\/libraries|\/api\/lora|\/api\/task\//.test(urlText)) score -= 8;
    if (/generate|generation|submit|create|task/.test(urlText)) score -= 4;

    if (/cost|consume|consumed|spend|spent|used|usage|price|deduct|fee|charge/.test(path)) score -= 8;
    if (/count|num|number|duration|second|width|height|fps|size|limit|max|min|id$/.test(path)) score -= 5;
    if (/expire|expiry|deadline|timestamp|time|date/.test(path)) score -= 6;

    return score;
}

export function extractKlingPointAndTicketBalance(payload) {
    const data = payload && payload.data;
    if (!data || typeof data !== 'object') return null;

    const total = normalizeJsonNumber(data.total);
    if (isFiniteCredit(total)) {
        return {
            value: normalizeCredit(total),
            path: 'data.total',
            score: 30
        };
    }

    if (Array.isArray(data.points) && data.points.length) {
        let sum = 0;
        let hasAny = false;
        data.points.forEach(function (point) {
            const balance = normalizeJsonNumber(point && point.balance);
            if (!isFiniteCredit(balance)) return;
            sum += balance;
            hasAny = true;
        });
        if (hasAny) {
            return {
                value: normalizeCredit(sum),
                path: 'data.points[].balance(sum)',
                score: 28
            };
        }
    }

    const remain = normalizeJsonNumber(
        data.remainPoints != null ? data.remainPoints : data.remain_points
    );
    if (isFiniteCredit(remain)) {
        return {
            value: normalizeCredit(remain),
            path: data.remainPoints != null ? 'data.remainPoints' : 'data.remain_points',
            score: 26
        };
    }

    return null;
}

export function extractBalanceFromPayload(payload, url) {
    const urlText = String(url || '');
    if (/\/api\/account\/pointandticket/i.test(urlText)) {
        const klingBalance = extractKlingPointAndTicketBalance(payload);
        if (klingBalance) return klingBalance;
    }

    const candidates = [];
    walkJson(payload, [], function (value, path) {
        const number = normalizeJsonNumber(value);
        if (!isFiniteCredit(number)) return;
        const pathText = path.join('.').toLowerCase();
        const score = scoreBalancePath(pathText, url);
        if (score >= MIN_BALANCE_SCORE) {
            candidates.push({
                value: normalizeCredit(number),
                path: path.join('.'),
                score
            });
        }
    });

    if (!candidates.length) return null;
    candidates.sort(function (a, b) {
        if (b.score !== a.score) return b.score - a.score;
        return String(a.path).length - String(b.path).length;
    });
    return candidates[0];
}

export function extractTaskId(payload) {
    let found = null;
    walkJson(payload, [], function (value, path) {
        if (found != null) return;
        if (typeof value !== 'string' && typeof value !== 'number') return;
        const pathText = path.join('.').toLowerCase();
        if (!/(task|job|generation|video).*(id)|(^|\.)(taskid|task_id|jobid|job_id)$/.test(pathText)) return;
        const text = String(value);
        if (text.length < 3 || text.length > 120) return;
        found = text;
    });
    return found;
}
