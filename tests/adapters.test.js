import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractHiggsfieldCost, buildHiggsfieldDetail } from '../src/adapters/shared.js';
import {
    calculateSeedanceCost,
    createSeedanceAdapter,
    parseSeedanceSettingsFromText
} from '../src/adapters/seedance.js';
import { initAdapters, getActiveAdapter } from '../src/adapters/registry.js';

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
        extractBalanceFromPayload: function () { return null; },
        looksRelevantForDebug: function () { return false; }
    });

    global.window = { location: { href: 'https://sjinn.ai/tools/seedance20-video' } };
    assert.equal(getActiveAdapter().id, 'seedance');

    global.window = { location: { href: 'https://sjinn.ai/tools/other' } };
    assert.notEqual(getActiveAdapter().id, 'seedance');

    global.window = originalWindow;
});
