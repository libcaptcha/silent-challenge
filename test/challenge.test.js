import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createChallengeManager } from '../src/challenge.js';
import {
    balloon, countLeadingZeroBitsBytes,
} from '../src/crypto.js';

const SECRET = 'a'.repeat(64);
const LOW_POW = { difficulty: 1, spaceCost: 16, timeCost: 1 };

function makeManager(overrides = {}) {
    return createChallengeManager({
        secret: SECRET,
        pow: LOW_POW,
        thresholds: { combined: 0, motion: 0, navigator: 0 },
        ...overrides,
    });
}

function findNonce(prefix, spaceCost, timeCost, difficulty) {
    const delta = 3;
    for (let nonce = 0; nonce < 100_000; nonce++) {
        const hash = balloon(
            prefix + nonce.toString(),
            spaceCost, timeCost, delta,
        );
        if (countLeadingZeroBitsBytes(hash) >= difficulty) {
            return nonce;
        }
    }
    throw new Error('Could not find nonce');
}

function humanMotion() {
    const mouse = [];
    for (let i = 0; i < 50; i++) {
        mouse.push([
            100 + Math.sin(i * 0.3) * 50 + Math.random() * 2,
            200 + Math.cos(i * 0.2) * 30 + Math.random() * 2,
            i * 60,
        ]);
    }

    const clicks = [];
    for (let i = 0; i < 5; i++) {
        clicks.push([
            0.3 + Math.random() * 0.4,
            0.4 + Math.random() * 0.2,
            60 + Math.random() * 80,
            200, 40, 1000 + i * 2000,
        ]);
    }

    const keys = [];
    for (let i = 0; i < 20; i++) {
        keys.push([
            40 + Math.random() * 60,
            80 + Math.random() * 120,
        ]);
    }

    const scrolls = [];
    for (let i = 0; i < 10; i++) {
        scrolls.push([
            i * 100, -50 + Math.random() * 20, i * 500,
        ]);
    }

    const events = [];
    let time = 100;
    for (let i = 0; i < 30; i++) {
        events.push([i % 7, time]);
        time += 100 + Math.random() * 200;
    }

    return {
        m: mouse, c: clicks, k: keys, s: scrolls,
        tc: [], ac: [], gy: [], or: [],
        ev: events, bc: [], bl: [],
        ttfi: 500, dur: 10000, meta: {},
    };
}

async function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('createChallengeManager', () => {
    it('issues challenge with expected structure', () => {
        const manager = makeManager();
        const challenge = manager.issue();

        assert.ok(challenge.challengeId);
        assert.ok(challenge.nonce);
        assert.ok(challenge.pow);
        assert.ok(challenge.pow.prefix);
        assert.equal(challenge.pow.difficulty, 1);
        assert.equal(challenge.pow.spaceCost, 16);
        assert.equal(typeof challenge.ttl, 'number');
        assert.ok(challenge.ttl > 0);

        manager.destroy();
    });

    it('rejects unknown challenge id', () => {
        const manager = makeManager();
        const result = manager.verify('nonexistent', {
            nonce: 0,
        });

        assert.equal(result.cleared, false);
        assert.equal(result.error, 'Unknown challenge');

        manager.destroy();
    });

    it('consumes challenge on use', async () => {
        const manager = makeManager();
        const challenge = manager.issue();

        await wait(60);

        const nonce = findNonce(
            challenge.pow.prefix,
            challenge.pow.spaceCost,
            challenge.pow.timeCost,
            challenge.pow.difficulty,
        );

        manager.verify(challenge.challengeId, {
            nonce, motion: humanMotion(),
        });

        const second = manager.verify(
            challenge.challengeId, { nonce },
        );
        assert.equal(second.error, 'Unknown challenge');

        manager.destroy();
    });

    it('verifies valid submission', async () => {
        const manager = makeManager();
        const challenge = manager.issue();

        await wait(60);

        const nonce = findNonce(
            challenge.pow.prefix,
            challenge.pow.spaceCost,
            challenge.pow.timeCost,
            challenge.pow.difficulty,
        );

        const result = manager.verify(
            challenge.challengeId,
            { nonce, motion: humanMotion(), signals: null },
        );

        assert.equal(typeof result.score, 'number');
        assert.equal(typeof result.cleared, 'boolean');
        assert.ok(Array.isArray(result.flags));

        manager.destroy();
    });

    it('issues token on cleared result', async () => {
        const manager = makeManager();
        const challenge = manager.issue();

        await wait(60);

        const nonce = findNonce(
            challenge.pow.prefix,
            challenge.pow.spaceCost,
            challenge.pow.timeCost,
            challenge.pow.difficulty,
        );

        const result = manager.verify(
            challenge.challengeId,
            { nonce, motion: humanMotion() },
        );

        if (result.cleared) {
            assert.ok(result.token);
            assert.ok(result.expiresAt);

            const payload = manager.validateToken(result.token);
            assert.ok(payload);
            assert.equal(payload.sub, challenge.challengeId);
            assert.equal(typeof payload.score, 'number');
            assert.equal(
                typeof payload.motionScore, 'number',
            );
        }

        manager.destroy();
    });

    it('rejects invalid token', () => {
        const manager = makeManager();
        const payload = manager.validateToken('bad.token');
        assert.equal(payload, null);
        manager.destroy();
    });

    it('includes debug detail when enabled', async () => {
        const manager = makeManager({ debug: true });
        const challenge = manager.issue();

        await wait(60);

        const nonce = findNonce(
            challenge.pow.prefix,
            challenge.pow.spaceCost,
            challenge.pow.timeCost,
            challenge.pow.difficulty,
        );

        const result = manager.verify(
            challenge.challengeId,
            { nonce, motion: humanMotion() },
        );

        assert.ok(result.detail);
        assert.ok(result.detail.motion);
        assert.ok(result.detail.pow);
        assert.ok(result.detail.navigator);

        manager.destroy();
    });

    it('penalizes missing motion data', async () => {
        const manager = makeManager({
            thresholds: {
                combined: 0.9,
                motion: 0.9,
                navigator: 0,
            },
        });
        const challenge = manager.issue();

        await wait(60);

        const nonce = findNonce(
            challenge.pow.prefix,
            challenge.pow.spaceCost,
            challenge.pow.timeCost,
            challenge.pow.difficulty,
        );

        const result = manager.verify(
            challenge.challengeId,
            { nonce, motion: null },
        );

        assert.equal(result.cleared, false);
        manager.destroy();
    });

    it('exposes secret', () => {
        const manager = makeManager();
        assert.equal(manager.secret, SECRET);
        manager.destroy();
    });

    it('generates secret when not provided', () => {
        const manager = createChallengeManager({
            pow: LOW_POW,
        });
        assert.ok(manager.secret);
        assert.equal(manager.secret.length, 64);
        manager.destroy();
    });
});
