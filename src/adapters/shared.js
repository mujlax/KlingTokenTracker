import { compactText } from '../lib/utils.js';
import { isFiniteCredit, parseLooseNumber, normalizeCredit } from '../lib/credits.js';

export function getDirectClickableText(clickable) {
    return compactText([
        clickable.textContent || '',
        clickable.getAttribute('aria-label') || '',
        clickable.getAttribute('title') || ''
    ].join(' ')).slice(0, 160);
}

export function getElementRectSummary(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') return '';
    const rect = element.getBoundingClientRect();
    if (!rect) return '';
    return [
        'w=' + Math.round(rect.width || 0),
        'h=' + Math.round(rect.height || 0),
        'x=' + Math.round(rect.left || 0),
        'y=' + Math.round(rect.top || 0)
    ].join(' ');
}

export function isUiGenerationText(text) {
    const normalized = String(text || '').toLowerCase();
    if (!normalized) return false;
    if (/generate|create|submit|start|try|render/.test(normalized) && /video|generation|generate|create|submit|render/.test(normalized)) {
        return true;
    }
    if (/生成|創建|创建/.test(normalized)) return true;
    return false;
}

export function hasGenerateCostInDirectText(text) {
    const normalized = compactText(text);
    if (!normalized) return false;
    return /(?:^|[^\d:])\d+(?:[.,]\d+)?\s*(?:generate|生成|創建|创建)\b/i.test(normalized);
}

export function extractCostFromUiText(text) {
    const normalized = compactText(text);
    if (!normalized) return NaN;
    const generateMatches = Array.from(normalized.matchAll(/(?:^|[^\d:])(\d+(?:[.,]\d+)?)\s*(?:generate|生成|創建|创建)\b/gi));
    if (generateMatches.length) return parseLooseNumber(generateMatches[generateMatches.length - 1][1]);

    const hdMatches = Array.from(normalized.matchAll(/hd\s*(\d+(?:[.,]\d+)?)/gi));
    if (hdMatches.length) return parseLooseNumber(hdMatches[hdMatches.length - 1][1]);

    const numbers = normalized.match(/\d+(?:[.,]\d+)?/g) || [];
    if (!numbers.length) return NaN;
    return parseLooseNumber(numbers[numbers.length - 1]);
}

export function extractHiggsfieldCost(text) {
    const normalized = compactText(text);
    if (!normalized) return NaN;

    const primary = normalized.match(/generate\s*[✦✧⋆*]\s*(\d+(?:[.,]\d+)?)/i);
    if (primary) return parseLooseNumber(primary[1]);

    const glued = normalized.match(/generate\s*(\d+(?:[.,]\d+)?)/i);
    if (glued) return parseLooseNumber(glued[1]);

    const sparkle = normalized.match(/[✦✧⋆*]\s*(\d+(?:[.,]\d+)?)/);
    if (sparkle) return parseLooseNumber(sparkle[1]);

    if (!/generate/i.test(normalized)) return NaN;

    const numbers = normalized.match(/\d+(?:[.,]\d+)?/g) || [];
    if (!numbers.length) return NaN;
    return parseLooseNumber(numbers[numbers.length - 1]);
}

export function extractHiggsfieldBalance(root, panelHost) {
    if (!root) return null;

    const pageText = compactText(root.innerText || root.textContent || '');
    const pageMatch = pageText.match(/\bCredits\b[\s\S]{0,100}?(\d[\d,.]*)\s*left\b/i);
    if (pageMatch) {
        const value = parseLooseNumber(pageMatch[1]);
        if (isFiniteCredit(value) && value > 0) {
            return {
                value: normalizeCredit(value),
                score: 24,
                context: 'Credits ' + pageMatch[1] + ' left'
            };
        }
    }

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    let count = 0;
    while ((node = walker.nextNode()) && count < 2500) {
        count += 1;
        const parent = node.parentElement;
        if (!parent || (panelHost && panelHost.contains(parent))) continue;

        const text = compactText(node.nodeValue || '');
        const leftMatch = text.match(/(\d[\d,.]*)\s*left\b/i);
        if (!leftMatch) continue;

        let element = parent;
        for (let depth = 0; element && depth < 8; depth += 1) {
            if (panelHost && panelHost.contains(element)) break;
            const ctx = compactText(element.textContent || '');
            if (/\bcredits\b/i.test(ctx) && ctx.length <= 320) {
                const value = parseLooseNumber(leftMatch[1]);
                if (isFiniteCredit(value) && value > 0) {
                    return {
                        value: normalizeCredit(value),
                        score: 22,
                        context: ctx.slice(0, 180)
                    };
                }
            }
            element = element.parentElement;
        }
    }

    return null;
}

export function isLikelyKlingGenerateButton(clickable, event) {
    if (!clickable || typeof clickable.getBoundingClientRect !== 'function') return true;
    const rect = clickable.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return true;

    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
        if (!inside) return false;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (rect.width > 360) return false;
    if (viewportWidth && rect.width > viewportWidth * 0.35) return false;
    if (rect.height > 96) return false;
    if (viewportHeight && rect.height > viewportHeight * 0.16) return false;
    if (rect.width < 80 || rect.height < 28) return false;

    return true;
}

export function isLikelyHiggsfieldGenerateButton(clickable, event) {
    if (!clickable || typeof clickable.getBoundingClientRect !== 'function') return true;
    const rect = clickable.getBoundingClientRect();
    if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return true;

    if (event && Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        const inside =
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
        if (!inside) return false;
    }

    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    if (viewportWidth && rect.width > viewportWidth * 0.95) return false;
    if (rect.height > 64) return false;
    if (viewportHeight && rect.height > viewportHeight * 0.12) return false;
    if (rect.width < 60 || rect.height < 24) return false;

    return true;
}

export function getGenerateClickText(clickable, panelHost, extractCost) {
    const candidates = [];

    function consider(element, maxLen) {
        if (!element) return;
        const text = compactText([
            element.textContent || '',
            (element.getAttribute && element.getAttribute('aria-label')) || '',
            (element.getAttribute && element.getAttribute('title')) || ''
        ].join(' '));
        if (!text || text.length > maxLen) return;
        if (element !== clickable && !/generate|生成|創建|创建/i.test(text)) return;
        if (candidates.indexOf(text) >= 0) return;
        candidates.push(text);
    }

    consider(clickable, 140);

    let parent = clickable.parentElement;
    for (let depth = 0; parent && depth < 2; depth += 1) {
        if (panelHost && panelHost.contains(parent)) break;
        consider(parent, 200);
        parent = parent.parentElement;
    }

    if (!candidates.length) return compactText(clickable.textContent || '').slice(0, 260);

    candidates.sort(function (a, b) {
        return a.length - b.length;
    });

    for (let i = 0; i < candidates.length; i += 1) {
        const amount = extractCost(candidates[i]);
        if (isFiniteCredit(amount)) return candidates[i].slice(0, 260);
    }

    return candidates[0].slice(0, 260);
}

export function buildHiggsfieldDetail(directText, amount) {
    const normalized = compactText(directText);
    if (normalized && /generate/i.test(normalized)) return normalized.slice(0, 100);
    if (typeof amount === 'number' && Number.isFinite(amount)) {
        return ('Generate ' + amount).slice(0, 100);
    }
    return normalized ? normalized.slice(0, 100) : '';
}

export function collectDomContextText(clickable, panelHost, maxDepth) {
    const parts = [];
    const seen = new Set();
    let element = clickable;

    for (let depth = 0; element && depth < maxDepth; depth += 1) {
        if (panelHost && panelHost.contains(element) && element !== clickable) break;
        const text = compactText(element.textContent || '');
        if (text && text.length <= 1200 && !seen.has(text)) {
            seen.add(text);
            parts.push(text);
        }
        element = element.parentElement;
    }

    return parts.join(' ');
}
