import { compactText } from '../lib/utils.js';

const HIGGSFIELD_IGNORE_RE = /your browser does not support|enhance\s*off|does not support the video/i;

export function parseKlingMetadata(text) {
    const normalized = compactText(text);
    const metadata = {};
    const resolution = normalized.match(/\b(720p|1080p|2k|4k)\b/i);
    if (resolution) metadata.resolution = resolution[1];
    const duration = normalized.match(/\b(\d+)\s*s\b/i);
    if (duration) metadata.duration = duration[1] + 's';
    const aspectRatio = normalized.match(/\b(\d{1,2}:\d{1,2})\b/);
    if (aspectRatio) metadata.aspectRatio = aspectRatio[1];
    const outputs = normalized.match(/(?:^|[^\d:])([1-4])\s+(?:Native Audio|Audio|HD|Generate|\d+\s*Generate)/i);
    if (outputs) metadata.outputs = Number(outputs[1]);
    if (/Native Audio/i.test(normalized)) metadata.audio = 'Native Audio';
    else if (/\bAudio\b/i.test(normalized)) metadata.audio = 'Audio';
    const mode = normalized.match(/\b(Standard|Professional|Pro|Master|High Quality|Quality)\b/i);
    if (mode) metadata.mode = mode[1];
    const model = normalized.match(/\b(?:Model|Kling)\s*([A-Za-z0-9._-]+)/i);
    if (model) metadata.model = model[1];
    return metadata;
}

export function parseHiggsfieldMetadata(clickable, panelHost) {
    const metadata = {};
    if (!clickable || typeof document === 'undefined') return metadata;

    function isIgnoredElement(element) {
        if (!element) return true;
        if (panelHost && panelHost.contains(element) && element !== clickable) return true;
        const tag = String(element.tagName || '').toLowerCase();
        return tag === 'script' || tag === 'style' || tag === 'noscript' || tag === 'video';
    }

    function considerPrompt(value) {
        const text = compactText(value || '');
        if (text.length < 2 || text.length > 500) return;
        if (HIGGSFIELD_IGNORE_RE.test(text)) return;
        if (/^generate/i.test(text)) return;
        if (!metadata.prompt || text.length > metadata.prompt.length) {
            metadata.prompt = text.slice(0, 200);
        }
    }

    function considerPillText(text) {
        const normalized = compactText(text || '');
        if (!normalized || normalized.length > 28) return;
        if (/^\d+s$/i.test(normalized)) metadata.duration = normalized.toLowerCase();
        else if (/^(720p|1080p|2k|4k)$/i.test(normalized)) metadata.resolution = normalized.toLowerCase();
        else if (normalized === 'Auto') metadata.aspectRatio = 'Auto';
        else if (/^\d{1,2}:\d{1,2}$/.test(normalized)) metadata.aspectRatio = normalized;
        else if (/^(On|Off)$/i.test(normalized) && !metadata.audio) metadata.audio = normalized;
    }

    function scanContainer(container) {
        if (!container || isIgnoredElement(container)) return;

        container.querySelectorAll('textarea, [contenteditable="true"]').forEach(function (field) {
            if (isIgnoredElement(field)) return;
            considerPrompt(field.value || field.textContent || '');
        });

        container.querySelectorAll('input[type="text"], input:not([type])').forEach(function (field) {
            if (isIgnoredElement(field)) return;
            considerPrompt(field.value || '');
        });

        container.querySelectorAll('button, [role="button"]').forEach(function (button) {
            if (button === clickable || isIgnoredElement(button)) return;
            considerPillText(button.textContent || '');
        });
    }

    let element = clickable;
    for (let depth = 0; element && depth < 7; depth += 1) {
        scanContainer(element);
        element = element.parentElement;
    }

    let scope = clickable.parentElement;
    for (let depth = 0; scope && depth < 8; depth += 1) {
        if (panelHost && panelHost.contains(scope)) break;

        if (typeof scope.querySelectorAll === 'function') {
            scope.querySelectorAll('span, div, p, label, li').forEach(function (node) {
                if (isIgnoredElement(node)) return;
                const text = compactText(node.textContent || '');
                if (!text || text.length > 80) return;
                if (/^model\b/i.test(text)) return;
                const modelInline = text.match(/^(?:Model\s*)?(Kling\s*[\d.]+\s*(?:Mix|Omni)?|Google\s+Veo[\w.\s-]*|Veo\s*[\d.]+\s*\w*)/i);
                if (modelInline) metadata.model = compactText(modelInline[1] || modelInline[0]).slice(0, 80);
            });
        }

        const scopeText = compactText(scope.innerText || scope.textContent || '');
        if (scopeText.length <= 400) {
            const modeMatch = scopeText.match(/\b(GENERAL|CINEMA|STANDARD)\b/);
            if (modeMatch) metadata.mode = modeMatch[1];
            const modelMatch = scopeText.match(/\b(Kling\s*[\d.]+\s*(?:Mix|Omni)?|Google\s+Veo[\w.\s-]*|Veo\s*[\d.]+\s*(?:Lite|Pro)?[\w]*)\b/i);
            if (modelMatch) metadata.model = compactText(modelMatch[1]).slice(0, 80);
        }

        scope = scope.parentElement;
    }

    return metadata;
}
