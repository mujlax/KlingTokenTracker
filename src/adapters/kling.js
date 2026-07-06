import {
    getDirectClickableText,
    getElementRectSummary,
    isUiGenerationText,
    hasGenerateCostInDirectText,
    extractCostFromUiText,
    isLikelyKlingGenerateButton,
    getGenerateClickText
} from './shared.js';
import { parseKlingMetadata } from './metadata.js';
import { isFiniteCredit } from '../lib/credits.js';
import { extractKlingPointAndTicketBalance } from '../lib/balance-parse.js';

export function createKlingAdapter(h) {
    return {
        id: 'kling',
        name: 'Kling',
        networkEnabled: true,
        matchesLocation: function (url) {
            return /^https?:\/\/(?:[\w-]+\.)*kling\.ai(?:[:/]|$)/i.test(String(url || ''));
        },
        parseGenerateClick: function (clickable, event) {
            const directText = getDirectClickableText(clickable);
            if (!isUiGenerationText(directText)) return null;
            if (!hasGenerateCostInDirectText(directText)) {
                h.addDiagnostic('ignored generate-like click without direct cost', directText);
                return null;
            }
            if (!isLikelyKlingGenerateButton(clickable, event)) {
                h.addDiagnostic('ignored generate-like click outside generate button bounds', directText, getElementRectSummary(clickable));
                return null;
            }

            const detail = getGenerateClickText(clickable, h.getPanelHost(), extractCostFromUiText);
            const amount = extractCostFromUiText(detail);
            if (!isFiniteCredit(amount) || amount <= 0) {
                h.addDiagnostic('ui generate click without cost', detail);
                return null;
            }

            return {
                amount,
                detail,
                metadata: parseKlingMetadata(detail),
                estimated: true
            };
        },
        extractBalance: function (payload, url) {
            if (/\/api\/account\/pointandticket/i.test(String(url || ''))) {
                const structured = extractKlingPointAndTicketBalance(payload);
                if (structured) return structured;
            }
            return h.extractBalanceFromPayload(payload, url);
        },
        isRelevantDebugUrl: function (url, payload) {
            return h.looksRelevantForDebug(url, payload);
        },
        isGenerateButton: isLikelyKlingGenerateButton
    };
}
