import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHiggsfieldCost, buildHiggsfieldDetail } from '../src/adapters/shared.js';
import {
    calculateSeedanceCost,
    createSeedanceAdapter,
    parseSeedanceSettingsFromText
} from '../src/adapters/seedance.js';
import { initAdapters, getActiveAdapter } from '../src/adapters/registry.js';
import { createHiggsfieldAdapter } from '../src/adapters/higgsfield.js';

test('extractHiggsfieldCost parses Generate sparkle price', function () {
    assert.equal(extractHiggsfieldCost('Generate ✦ 16'), 16);
    assert.equal(extractHiggsfieldCost('Generate ✦ 30'), 30);
    assert.equal(extractHiggsfieldCost('Generate6.25'), 6.25);
    assert.equal(extractHiggsfieldCost('Generate 6.25'), 6.25);
});

test('buildHiggsfieldDetail keeps only button text', function () {
    assert.equal(buildHiggsfieldDetail('Generate6.25', 6.25), 'Generate6.25');
    assert.equal(buildHiggsfieldDetail('', 6.25), 'Generate 6.25');
});

test('Higgsfield uses the discounted price in separated button text', function () {
    assert.equal(extractHiggsfieldCost('Generate ✦ 24 12'), 12);
    assert.equal(extractHiggsfieldCost('Generate 24 12'), 12);
    assert.equal(extractHiggsfieldCost('Generate ✦ 12.5 6.25'), 6.25);
    assert.equal(extractHiggsfieldCost('Generate ✦ 24 12 Generate ✦ 24 12'), 12);
});

function higgsfieldButton(oldPriceStyle = {}, oldPriceTag = 'SPAN') {
    const ownerDocument = { defaultView: { getComputedStyle: node => node.style || {} } };
    const text = value => ({ nodeType: 3, textContent: value });
    const element = (tagName, children, style = {}) => ({
        nodeType: 1, tagName, childNodes: children, style, ownerDocument,
        get textContent() { return children.map(child => child.textContent).join(''); }
    });
    const button = element('BUTTON', [text('Generate'),
        element('SVG', [text('icon')]),
        element(oldPriceTag, [text('24')], oldPriceStyle),
        element('SPAN', [text('12')])]);
    button.getAttribute = name => name === 'aria-label' ? 'Generate 24' : '';
    button.parentElement = null;
    return button;
}

test('Higgsfield separates adjacent DOM prices instead of recording 2412', function () {
    const button = higgsfieldButton();
    assert.equal(button.textContent, 'Generateicon2412');
    const adapter = createHiggsfieldAdapter({
        getPanelHost: () => null,
        addDiagnostic: () => {}
    });
    const parsed = adapter.parseGenerateClick(button, null);
    assert.equal(parsed.amount, 12);
    assert.equal(parsed.estimated, false);
});

test('Higgsfield excludes crossed-out and hidden DOM prices', function () {
    for (const [style, tag] of [
        [{ textDecorationLine: 'line-through' }, 'SPAN'],
        [{ display: 'none' }, 'SPAN'],
        [{ visibility: 'hidden' }, 'SPAN'],
        [{}, 'S'],
        [{}, 'DEL']
    ]) {
        const button = higgsfieldButton(style, tag);
        // Also cover an old price rendered after the current price.
        button.childNodes.reverse();
        assert.equal(extractHiggsfieldCost(button.textContent, button), 12);
    }
});

test('Higgsfield keeps regular, fractional and free DOM prices', function () {
    for (const value of ['16', '6.25', '6,25', '0']) {
        const button = higgsfieldButton();
        button.childNodes.splice(2, 1);
        button.childNodes[2].childNodes[0].textContent = value;
        assert.equal(extractHiggsfieldCost(button.textContent, button), Number(value.replace(',', '.')));
    }
});

test('Higgsfield does not record a crossed-out price when the current price is absent', function () {
    const button = higgsfieldButton({ textDecorationLine: 'line-through' });
    button.childNodes.pop();
    assert.ok(Number.isNaN(extractHiggsfieldCost(button.textContent, button)));
});

test('calculateSeedanceCost calculates 720P Pro 4s', function () {
    assert.equal(calculateSeedanceCost({
        resolution: '720P',
        mode: 'Pro',
        duration: '4s'
    }), 960);
});

test('calculateSeedanceCost calculates 1080P Fast 10s', function () {
    assert.equal(calculateSeedanceCost({
        resolution: '1080P',
        mode: 'Fast',
        duration: '10s'
    }), 4200);
});

test('parseSeedanceSettingsFromText supports 4K comma-rate pricing context', function () {
    const settings = parseSeedanceSettingsFromText('Aspect Ratio 16:9 Duration 5s Mode Pro Resolution 4K 4K: Pro 1,200 credits/s');
    assert.equal(settings.resolution, '4K');
    assert.equal(settings.mode, 'Pro');
    assert.equal(settings.duration, '5s');
    assert.equal(calculateSeedanceCost(settings), 6000);
});

test('createSeedanceAdapter returns null outside Seedance Generate', function () {
    const adapter = createSeedanceAdapter({
        getPanelHost: function () { return null; },
        addDiagnostic: function () {}
    });
    const clickable = {
        textContent: 'Start Create',
        getAttribute: function () { return ''; },
        parentElement: null
    };

    assert.equal(adapter.parseGenerateClick(clickable, null), null);
});

test('createSeedanceAdapter returns null without calculable settings', function () {
    const adapter = createSeedanceAdapter({
        getPanelHost: function () { return null; },
        addDiagnostic: function () {}
    });
    const container = {
        innerText: 'Aspect Ratio 16:9 Duration Mode Pro Resolution 720P Generate',
        textContent: 'Aspect Ratio 16:9 Duration Mode Pro Resolution 720P Generate',
        parentElement: null,
        querySelectorAll: function () { return []; }
    };
    const clickable = {
        textContent: 'Generate',
        getAttribute: function () { return ''; },
        parentElement: container
    };

    assert.equal(adapter.parseGenerateClick(clickable, null), null);
});

test('createSeedanceAdapter parses default Seedance settings from form context', function () {
    const adapter = createSeedanceAdapter({
        getPanelHost: function () { return null; },
        addDiagnostic: function () {}
    });
    const container = {
        innerText: 'prompt Describe the video. Aspect Ratio 16:9 Duration 4s Mode Pro Resolution 720P 480P: Pro 143 credits/s Generate',
        textContent: 'prompt Describe the video. Aspect Ratio 16:9 Duration 4s Mode Pro Resolution 720P 480P: Pro 143 credits/s Generate',
        parentElement: null,
        querySelectorAll: function () {
            return [{
                value: 'A test prompt',
                textContent: ''
            }];
        }
    };
    const clickable = {
        textContent: 'Generate',
        getAttribute: function () { return ''; },
        parentElement: container
    };

    const parsed = adapter.parseGenerateClick(clickable, null);
    assert.equal(parsed.amount, 960);
    assert.equal(parsed.estimated, true);
    assert.equal(parsed.metadata.resolution, '720P');
    assert.equal(parsed.metadata.mode, 'Pro');
    assert.equal(parsed.metadata.duration, '4s');
    assert.equal(parsed.metadata.aspectRatio, '16:9');
    assert.equal(parsed.metadata.prompt, 'A test prompt');
});

test('createSeedanceAdapter reads selected Seedance combobox values before pricing text', function () {
    const adapter = createSeedanceAdapter({
        getPanelHost: function () { return null; },
        addDiagnostic: function () {}
    });
    function combo(text) {
        return {
            innerText: text,
            textContent: text,
            value: '',
            getAttribute: function (name) {
                return name === 'role' ? 'combobox' : '';
            }
        };
    }
    const controls = [
        combo('16:9'),
        combo('4s'),
        combo('Mini'),
        combo('4K')
    ];
    const container = {
        innerText: 'Aspect Ratio 16:9 Duration 4s Mode Mini Resolution 4K 480P: Pro 143 credits/s, Fast 100 credits/s, Mini 72 credits/s. 720P: Pro 240 credits/s, Fast 168 credits/s, Mini 120 credits/s. Generate',
        textContent: 'Aspect Ratio 16:9 Duration 4s Mode Mini Resolution 4K 480P: Pro 143 credits/s, Fast 100 credits/s, Mini 72 credits/s. 720P: Pro 240 credits/s, Fast 168 credits/s, Mini 120 credits/s. Generate',
        parentElement: null,
        querySelectorAll: function (selector) {
            if (/combobox|select/.test(selector)) return controls;
            return [];
        }
    };
    const clickable = {
        textContent: 'Generate',
        getAttribute: function () { return ''; },
        parentElement: container
    };

    const parsed = adapter.parseGenerateClick(clickable, null);
    assert.equal(parsed.amount, 2400);
    assert.equal(parsed.metadata.resolution, '4K');
    assert.equal(parsed.metadata.mode, 'Mini');
});

test('registry selects Seedance only for Seedance tool URL', function () {
    const originalWindow = global.window;
    initAdapters({
        getPanelHost: function () { return null; },
        addDiagnostic: function () {},
        extractBalanceFromPayload: function () { return null; }
    });

    global.window = { location: { href: 'https://sjinn.ai/tools/seedance20-video' } };
    assert.equal(getActiveAdapter().id, 'seedance');

    global.window = { location: { href: 'https://sjinn.ai/tools/other' } };
    assert.notEqual(getActiveAdapter().id, 'seedance');

    global.window = originalWindow;
});
