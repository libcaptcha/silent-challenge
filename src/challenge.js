import {
    analyze, classifyScore as classifyMotion,
} from './motion.js';
import { validateSignals } from './navigator.js';
import {
    createChallenge as createPowChallenge,
    verifyChallenge as verifyPowChallenge,
    signToken,
    verifyToken,
} from './pow.js';
import {
    loadManifest, verifyVmResponse,
} from './vm.js';

const CHALLENGE_TTL_MS = 120_000;
const TOKEN_TTL_MS = 3_600_000;
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_CHALLENGES = 10_000;

const DEFAULT_WEIGHTS = {
    motion: 0.30,
    navigator: 0.25,
    pow: 0.15,
    vm: 0.30,
};

const DEFAULT_POW = {
    difficulty: 10,
    spaceCost: 512,
    timeCost: 1,
};

const DEFAULT_THRESHOLDS = {
    combined: 0.50,
    motion: 0.30,
    navigator: 0.30,
};

export function createChallengeManager(options = {}) {
    const secret = options.secret || randomHex(32);
    const weights = {
        ...DEFAULT_WEIGHTS, ...options.weights,
    };
    const powConfig = {
        ...DEFAULT_POW, ...options.pow,
    };
    const thresholds = {
        ...DEFAULT_THRESHOLDS, ...options.thresholds,
    };
    const debug = options.debug || false;
    const keyRing = options.keyRing || null;
    const manifest = keyRing
        ? null
        : options.manifestPath
            ? loadManifest(options.manifestPath)
            : options.manifest || null;
    const vmbcUrl = options.vmbcUrl || null;
    const challenges = new Map();

    const cleanup = setInterval(
        () => pruneExpired(challenges),
        CLEANUP_INTERVAL_MS,
    );
    cleanup.unref?.();

    return {
        issue: () => issue(
            secret, powConfig, challenges, vmbcUrl,
        ),
        verify: (id, payload, headers) =>
            verifyCombined(
                id, payload, headers, secret,
                keyRing, manifest,
                challenges, weights, thresholds,
                debug,
            ),
        getVmToken: (id) =>
            challenges.get(id)?.vmToken || null,
        validateToken: (token) =>
            verifyToken(token, secret),
        secret,
        keyRing,
        manifest,
        destroy: () => {
            clearInterval(cleanup);
            keyRing?.destroy();
        },
    };
}

function issue(
    secret, powConfig, challenges, vmbcUrl,
) {
    enforceMaxChallenges(challenges);

    const { id, challenge, record } =
        createPowChallenge(secret, powConfig);

    const nonce = randomHex(16);
    const vmToken = vmbcUrl ? randomHex(16) : null;

    challenges.set(id, {
        ...record,
        nonce,
        vmToken,
        createdAt: Date.now(),
        expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });

    const response = {
        challengeId: id,
        nonce,
        pow: challenge,
        ttl: CHALLENGE_TTL_MS,
    };

    if (vmbcUrl) {
        response.vmbc =
            `/challenge/${id}/vmbc`;
    }
    return response;
}

function verifyCombined(
    challengeId, payload, headers, secret,
    keyRing, manifest,
    challenges, weights, thresholds, debug,
) {
    const record = challenges.get(challengeId);
    if (!record) return failure('Unknown challenge');

    challenges.delete(challengeId);

    if (Date.now() > record.expiresAt) {
        return failure('Challenge expired');
    }

    const powResult = verifyPowChallenge(
        record, payload.nonce,
    );
    if (!powResult.valid) {
        return failure(powResult.error);
    }

    const motionResult = analyzeMotion(
        payload.motion,
    );
    const navigatorResult = analyzeNavigator(
        payload.signals, headers,
    );
    const vmResult = verifyVm(
        payload.vmResponse, keyRing, manifest,
        record.vmToken,
    );

    const scores = {
        pow: 1.0,
        motion: motionResult.score,
        navigator: navigatorResult.score,
        vm: vmResult.valid ? 1.0 : 0.0,
    };

    const combined = computeCombinedScore(
        scores, weights,
    );
    const flags = collectFlags(
        motionResult, navigatorResult, vmResult,
    );
    const cleared = isClearedByThresholds(
        combined, scores, thresholds,
    );

    const response = buildResponse(
        cleared, combined, flags,
        challengeId, secret, scores,
    );

    if (!debug) return response;

    return {
        ...response,
        detail: {
            motion: motionResult,
            navigator: navigatorResult,
            pow: powResult,
            vm: vmResult,
        },
    };
}

function analyzeMotion(motionData) {
    if (!motionData) {
        return {
            score: 0, reasons: ['No motion data'],
        };
    }
    const result = analyze(motionData);
    return {
        score: result.score,
        verdict: classifyMotion(result.score),
        reasons: result.reasons,
        categories: result.categories,
    };
}

function analyzeNavigator(signals, headers) {
    if (!signals) {
        return {
            score: 0,
            flags: ['No navigator signals'],
        };
    }
    return validateSignals(signals, headers);
}

function verifyVm(
    vmResponse, keyRing, manifest, vmToken,
) {
    if (!vmResponse) {
        return {
            valid: false, error: 'No VM response',
        };
    }
    let result;
    if (keyRing) {
        result = keyRing.verify(vmResponse);
    } else if (manifest) {
        result = verifyVmResponse(
            vmResponse, manifest,
        );
    } else {
        return {
            valid: false, error: 'No VM manifest',
        };
    }
    if (!result.valid) return result;
    if (vmToken && result.data?.token !== vmToken) {
        return {
            valid: false,
            error: 'VM token mismatch',
        };
    }
    return result;
}

function computeCombinedScore(scores, weights) {
    return (
        scores.motion * weights.motion +
        scores.navigator * weights.navigator +
        scores.pow * weights.pow +
        scores.vm * weights.vm
    );
}

function collectFlags(
    motionResult, navigatorResult, vmResult,
) {
    const flags = [];
    for (const r of motionResult.reasons || []) {
        flags.push(`motion: ${r}`);
    }
    for (const f of navigatorResult.flags || []) {
        flags.push(`navigator: ${f}`);
    }
    if (!vmResult.valid) {
        flags.push(`vm: ${vmResult.error}`);
    }
    return flags;
}

function isClearedByThresholds(
    combined, scores, thresholds,
) {
    if (combined < thresholds.combined) return false;
    if (scores.motion < thresholds.motion) {
        return false;
    }
    if (scores.navigator < thresholds.navigator) {
        return false;
    }
    return true;
}

function buildResponse(
    cleared, score, flags,
    challengeId, secret, scores,
) {
    if (!cleared) return { cleared, score, flags };

    const token = signToken({
        sub: challengeId,
        score,
        motionScore: scores.motion,
        navigatorScore: scores.navigator,
        vmValid: scores.vm === 1.0,
        iat: Date.now(),
    }, secret);

    return {
        cleared,
        score,
        flags,
        token,
        expiresAt: Date.now() + TOKEN_TTL_MS,
    };
}

function failure(error) {
    return {
        cleared: false, score: 0, flags: [], error,
    };
}

function enforceMaxChallenges(challenges) {
    if (challenges.size < MAX_CHALLENGES) return;

    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, record] of challenges) {
        if (record.createdAt < oldestTime) {
            oldestTime = record.createdAt;
            oldestKey = key;
        }
    }
    if (oldestKey) challenges.delete(oldestKey);
}

function pruneExpired(challenges) {
    const now = Date.now();
    for (const [id, record] of challenges) {
        if (now > record.expiresAt) {
            challenges.delete(id);
        }
    }
}

function randomHex(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i]
            .toString(16)
            .padStart(2, '0');
    }
    return hex;
}

export {
    CHALLENGE_TTL_MS,
    TOKEN_TTL_MS,
    DEFAULT_WEIGHTS,
    DEFAULT_POW,
    DEFAULT_THRESHOLDS,
};
