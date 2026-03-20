import { createHmac, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const MAGIC_RESP = 0x564d5250;
const NONCE_LEN = 12;
const MAC_LEN = 32;
const HEADER_LEN = 8;
const ROTATION_MS = 600_000;
const MAX_KEY_SETS = 3;

export function loadManifest(manifestPath) {
    if (!existsSync(manifestPath)) return null;
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
}

export function createKeyRing(options = {}) {
    const maxSets = options.maxKeySets || MAX_KEY_SETS;
    const rotationMs = options.rotationMs || ROTATION_MS;
    const buildDir = options.buildDir || null;
    const buildCommand = options.buildCommand || 'node scripts/build.js';
    const compileCommand = options.compileCommand || null;
    const onRotate = options.onRotate || null;
    const ring = [];
    let built = false;

    if (options.keys) {
        ring.push(options.keys);
    } else if (options.manifestPath) {
        const manifest = loadManifest(options.manifestPath);
        if (manifest?.keys) {
            ring.push(manifest.keys);
            built = true;
        }
    }

    if (ring.length === 0) rebuild();

    function pushKeys(keys) {
        ring.push(keys);
        while (ring.length > maxSets) ring.shift();
    }

    function rebuild() {
        if (!buildDir) return generateKeys();
        try {
            execSync(buildCommand, {
                cwd: buildDir,
                stdio: 'pipe',
            });
            if (compileCommand) {
                execSync(compileCommand, {
                    cwd: buildDir,
                    stdio: 'pipe',
                });
            }
            const path = resolve(buildDir, 'build/manifest.json');
            const manifest = loadManifest(path);
            if (!manifest?.keys) return generateKeys();
            built = true;
            pushKeys(manifest.keys);
            onRotate?.(manifest);
            return manifest.keys;
        } catch {
            return generateKeys();
        }
    }

    function generateKeys() {
        const keys = {
            decrypt: randomBytes(32).toString('hex'),
            encrypt: randomBytes(32).toString('hex'),
            sign: randomBytes(32).toString('hex'),
        };
        pushKeys(keys);
        onRotate?.({ keys });
        return keys;
    }

    const timer = setInterval(rebuild, rotationMs);
    timer.unref?.();

    function verify(response) {
        if (!response) {
            return {
                valid: false,
                error: 'No response',
            };
        }
        const bytes = toResponseBytes(response);
        const parsed = parseResponse(bytes);
        if (!parsed) {
            return {
                valid: false,
                error: 'Malformed response',
            };
        }
        for (let i = ring.length - 1; i >= 0; i--) {
            const result = tryVerify(parsed, ring[i]);
            if (result.valid) return result;
        }
        return {
            valid: false,
            error: 'No matching key',
        };
    }

    function current() {
        if (ring.length === 0) return null;
        return ring[ring.length - 1];
    }

    return {
        rebuild,
        verify,
        current,
        get size() {
            return ring.length;
        },
        get built() {
            return built;
        },
        destroy: () => clearInterval(timer),
    };
}

export function verifyVmResponse(response, manifest) {
    if (!manifest) {
        return { valid: false, error: 'No manifest' };
    }
    if (!response) {
        return { valid: false, error: 'No response' };
    }
    const bytes = toResponseBytes(response);
    const parsed = parseResponse(bytes);
    if (!parsed) {
        return {
            valid: false,
            error: 'Malformed response',
        };
    }
    return tryVerify(parsed, manifest.keys);
}

function tryVerify(parsed, keys) {
    const signKey = Buffer.from(keys.sign, 'hex');
    if (!verifyMac(parsed.signed, parsed.mac, signKey)) {
        return {
            valid: false,
            error: 'Invalid signature',
        };
    }
    const encryptKey = Buffer.from(keys.encrypt, 'hex');
    const plaintext = decryptPayload(parsed.ciphertext, encryptKey, parsed.nonce);
    try {
        return {
            valid: true,
            data: JSON.parse(plaintext),
        };
    } catch {
        return {
            valid: false,
            error: 'Invalid payload',
        };
    }
}

function toResponseBytes(input) {
    if (input instanceof Uint8Array) {
        return Buffer.from(input);
    }
    if (Buffer.isBuffer(input)) return input;
    if (typeof input === 'string') {
        return Buffer.from(input, 'base64');
    }
    return null;
}

function parseResponse(bytes) {
    const minLen = HEADER_LEN + NONCE_LEN + MAC_LEN + 1;
    if (!bytes || bytes.length < minLen) return null;
    const magic = bytes.readUInt32LE(0);
    if (magic !== MAGIC_RESP) return null;
    const totalLen = bytes.readUInt32LE(4);
    if (totalLen > bytes.length) return null;
    const nonce = bytes.subarray(HEADER_LEN, HEADER_LEN + NONCE_LEN);
    const ctLen = totalLen - HEADER_LEN - NONCE_LEN - MAC_LEN;
    if (ctLen < 1) return null;
    const ctStart = HEADER_LEN + NONCE_LEN;
    const ciphertext = bytes.subarray(ctStart, ctStart + ctLen);
    const mac = bytes.subarray(ctStart + ctLen, ctStart + ctLen + MAC_LEN);
    const signed = bytes.subarray(HEADER_LEN, ctStart + ctLen);
    return { nonce, ciphertext, mac, signed };
}

function verifyMac(data, mac, key) {
    const expected = createHmac('sha256', key).update(data).digest();
    return timingSafeEqual(expected, mac);
}

function decryptPayload(ciphertext, key, nonce) {
    const counter = Buffer.alloc(4);
    counter.writeUInt32LE(1, 0);
    const iv = Buffer.concat([counter, nonce]);
    const decipher = createDecipheriv('chacha20', key, iv);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

export function createChallengeBundle(basePath, token) {
    const base = readFileSync(basePath);
    const tokenBytes = Buffer.from(token, 'hex');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(tokenBytes.length, 0);
    return Buffer.concat([base, lenBuf, tokenBytes]);
}

function timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a[i] ^ b[i];
    }
    return result === 0;
}
