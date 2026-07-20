import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    extractBalanceFromPayload,
    extractKlingPointAndTicketBalance,
    scoreBalancePath
} from '../src/lib/balance-parse.js';

test('extractKlingPointAndTicketBalance prefers data.total over points[0].balance', function () {
    const payload = {
        data: {
            points: [
                { type: 'bonus', balance: 170000 },
                { type: 'plan', balance: 430000 }
            ],
            total: 600000
        }
    };

    const result = extractKlingPointAndTicketBalance(payload);
    assert.equal(result.value, 6000);
    assert.equal(result.path, 'data.total');
});

test('extractKlingPointAndTicketBalance sums points when total is missing', function () {
    const payload = {
        data: {
            points: [
                { balance: 170000 },
                { balance: 430000 }
            ]
        }
    };

    const result = extractKlingPointAndTicketBalance(payload);
    assert.equal(result.value, 6000);
    assert.equal(result.path, 'data.points[].balance(sum)');
});

test('extractKlingPointAndTicketBalance normalizes pointAndTicket minor units', function () {
    const payload = {
        data: {
            points: [
                { balance: 591200 },
                { balance: 100 },
                { balance: 0 }
            ],
            total: 591300
        }
    };

    const result = extractKlingPointAndTicketBalance(payload);
    assert.equal(result.value, 5913);
    assert.equal(result.path, 'data.total');
});

test('extractBalanceFromPayload uses total for pointAndTicket endpoint', function () {
    const payload = {
        data: {
            points: [{ balance: 170000 }],
            total: 99400
        }
    };

    const result = extractBalanceFromPayload(payload, '/api/account/pointAndTicket?scope=1');
    assert.equal(result.value, 994);
    assert.equal(result.path, 'data.total');
});

test('scoreBalancePath favors data.total over points.0.balance on pointAndTicket', function () {
    const url = '/api/account/pointAndTicket';
    assert.ok(scoreBalancePath('data.total', url) > scoreBalancePath('data.points.0.balance', url));
});
