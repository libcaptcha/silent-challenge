import {
    hmacSha256Hex, balloon, DELTA,
    countLeadingZeroBitsBytes,
} from './crypto.js';

const CHALLENGE_TTL_MS = 120_000;
const TOKEN_TTL_MS = 3_600_000;
const MIN_SOLVE_MS = 50;
const DEFAULT_SPACE_COST = 512;
const DEFAULT_TIME_COST = 1;
const DEFAULT_DIFFICULTY = 10;

export function createChallenge(secret, options = {}) {
    const spaceCost = options.spaceCost ?? DEFAULT_SPACE_COST;
    const timeCost = options.timeCost ?? DEFAULT_TIME_COST;
    const difficulty = options.difficulty ?? DEFAULT_DIFFICULTY;
    const delta = options.delta ?? DELTA;

    const id = crypto.randomUUID();
    const salt = randomHex(32);
    const prefix = hmacSha256Hex(secret, `${id}:${salt}`);

    return {
        id,
        challenge: {
            challengeId: id,
            prefix,
            difficulty,
            spaceCost,
            timeCost,
            delta,
        },
        record: {
            prefix,
            difficulty,
            spaceCost,
            timeCost,
            delta,
            createdAt: Date.now(),
            expiresAt: Date.now() + CHALLENGE_TTL_MS,
        },
    };
}

export function verifyChallenge(record, nonce) {
    if (Date.now() > record.expiresAt) {
        return { valid: false, error: 'Challenge expired' };
    }
    if (Date.now() - record.createdAt < MIN_SOLVE_MS) {
        return { valid: false, error: 'Too fast' };
    }
    if (typeof nonce !== 'number' || !Number.isInteger(nonce) || nonce < 0) {
        return { valid: false, error: 'Invalid nonce' };
    }

    const hash = balloon(
        record.prefix + nonce.toString(),
        record.spaceCost,
        record.timeCost,
        record.delta
    );

    if (countLeadingZeroBitsBytes(hash) < record.difficulty) {
        return { valid: false, error: 'Insufficient proof of work' };
    }

    return { valid: true, hash: bytesToHex(hash) };
}

export function signToken(payload, secret) {
    const raw = JSON.stringify(payload);
    const encoded = bufferToBase64url(new TextEncoder().encode(raw));
    const signature = hmacBase64url(secret, raw);
    return `${encoded}.${signature}`;
}

export function verifyToken(token, secret) {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [encoded, signature] = parts;
    const raw = base64urlToString(encoded);
    const expected = hmacBase64url(secret, raw);

    if (!timingSafeEqual(signature, expected)) return null;

    const payload = JSON.parse(raw);
    if (payload.iat && Date.now() - payload.iat > TOKEN_TTL_MS) {
        return null;
    }
    return payload;
}

function hmacBase64url(secret, data) {
    const bytes = hmacSha256Hex(secret, data);
    return hexToBase64url(bytes);
}

function bytesToHex(bytes) {
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += (bytes[i] >>> 0).toString(16).padStart(2, '0');
    }
    return hex;
}

function randomHex(length) {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    let hex = '';
    for (let i = 0; i < length; i++) {
        hex += (bytes[i] >>> 0).toString(16).padStart(2, '0');
    }
    return hex;
}

function hexToBytes(hex) {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
    }
    return bytes;
}

function bufferToBase64url(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function hexToBase64url(hex) {
    return bufferToBase64url(hexToBytes(hex));
}

function base64urlToString(encoded) {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
}

export {
    CHALLENGE_TTL_MS,
    TOKEN_TTL_MS,
    DEFAULT_SPACE_COST,
    DEFAULT_TIME_COST,
    DEFAULT_DIFFICULTY,
    DELTA,
};
