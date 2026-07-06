import {
    getDirectClickableText,
    getElementRectSummary,
    extractHiggsfieldCost,
    extractHiggsfieldBalance,
    isLikelyHiggsfieldGenerateButton,
    buildHiggsfieldDetail
} from './shared.js';
import { parseHiggsfieldMetadata } from './metadata.js';
import { isFiniteCredit } from '../lib/credits.js';
import { compactText } from '../lib/utils.js';

export function createHiggsfieldAdapter(h) {
    return {
        id: 'higgsfield',
        name: 'Higgsfield',
        networkEnabled: false,
        uiBalanceEnabled: true,
        matchesLocation: function (url) {
            return /^https?:\/\/(?:[\w-]+\.)*higgsfield\.ai(?:[:/]|$)/i.test(String(url || ''));
        },
        parseGenerateClick: function (clickable, event) {
            const directText = getDirectClickableText(clickable);
            if (!/generate/i.test(directText)) return null;

            if (!isLikelyHiggsfieldGenerateButton(clickable, event)) {
                h.addDiagnostic('ignored higgsfield generate click outside button bounds', directText, getElementRectSummary(clickable));
                return null;
            }

            const amount = extractHiggsfieldCost(directText);
            const metadata = parseHiggsfieldMetadata(clickable, h.getPanelHost());
            const detail = buildHiggsfieldDetail(directText, amount);

            if (!isFiniteCredit(amount) || amount <= 0) {
                h.addDiagnostic('higgsfield generate click without ui cost', directText);
                return {
                    amount: null,
                    detail,
                    metadata,
                    estimated: true
                };
            }

            return {
                amount,
                detail,
                metadata,
                estimated: false
            };
        },
        extractBalance: function () {
            return null;
        },
        extractUiBalance: function (root, panelHost) {
            return extractHiggsfieldBalance(root, panelHost);
        },
        isRelevantDebugUrl: function () {
            return false;
        },
        isGenerateButton: isLikelyHiggsfieldGenerateButton,
        extractCostFromUiText: extractHiggsfieldCost
    };
}
