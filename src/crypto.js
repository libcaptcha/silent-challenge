const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
    0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
    0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
    0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
    0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
    0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const IV = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);

const HEX = Array.from(
    { length: 256 },
    (_, i) => i.toString(16).padStart(2, '0'),
);

const W = new Int32Array(64);
const HMAC_BLOCK = 64;
const DELTA = 3;

function compress(state, block, offset) {
    for (let i = 0; i < 16; i++) {
        W[i] =
            (block[offset] << 24) |
            (block[offset + 1] << 16) |
            (block[offset + 2] << 8) |
            block[offset + 3];
        offset += 4;
    }
    for (let i = 16; i < 64; i++) {
        const w15 = W[i - 15];
        const w2 = W[i - 2];
        const s0 =
            ((w15 >>> 7) | (w15 << 25)) ^
            ((w15 >>> 18) | (w15 << 14)) ^
            (w15 >>> 3);
        const s1 =
            ((w2 >>> 17) | (w2 << 15)) ^
            ((w2 >>> 19) | (w2 << 13)) ^
            (w2 >>> 10);
        W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let a = state[0], b = state[1];
    let c = state[2], d = state[3];
    let e = state[4], f = state[5];
    let g = state[6], h = state[7];
    for (let i = 0; i < 64; i++) {
        const S1 =
            ((e >>> 6) | (e << 26)) ^
            ((e >>> 11) | (e << 21)) ^
            ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + K[i] + W[i]) | 0;
        const S0 =
            ((a >>> 2) | (a << 30)) ^
            ((a >>> 13) | (a << 19)) ^
            ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h = g; g = f; f = e;
        e = (d + temp1) | 0;
        d = c; c = b; b = a;
        a = (temp1 + temp2) | 0;
    }
    state[0] = (state[0] + a) | 0;
    state[1] = (state[1] + b) | 0;
    state[2] = (state[2] + c) | 0;
    state[3] = (state[3] + d) | 0;
    state[4] = (state[4] + e) | 0;
    state[5] = (state[5] + f) | 0;
    state[6] = (state[6] + g) | 0;
    state[7] = (state[7] + h) | 0;
}

function padMessage(data, length) {
    const bitLength = length * 8;
    const padded = (length + 9 + 63) & ~63;
    const buffer = new Uint8Array(padded);
    buffer.set(
        data instanceof Uint8Array
            ? data.subarray(0, length)
            : data.slice(0, length),
    );
    buffer[length] = 0x80;
    const view = new DataView(buffer.buffer);
    view.setUint32(padded - 4, bitLength, false);
    if (bitLength > 0xffffffff) {
        view.setUint32(
            padded - 8,
            (bitLength / 0x100000000) | 0,
            false,
        );
    }
    return buffer;
}

function toBytes(input) {
    if (input instanceof Uint8Array) return input;
    if (typeof input === 'string') {
        return new TextEncoder().encode(input);
    }
    if (ArrayBuffer.isView(input)) {
        return new Uint8Array(
            input.buffer,
            input.byteOffset,
            input.byteLength,
        );
    }
    throw new TypeError(
        'Expected string, Uint8Array, or TypedArray',
    );
}

function sha256(input) {
    const data = toBytes(input);
    const padded = padMessage(data, data.length);
    const state = new Uint32Array(IV);
    for (let off = 0; off < padded.length; off += 64) {
        compress(state, padded, off);
    }
    return state;
}

function sha256Hex(input) {
    const state = sha256(input);
    let hex = '';
    for (let i = 0; i < 8; i++) {
        const word = state[i] >>> 0;
        hex +=
            HEX[(word >>> 24) & 0xff] +
            HEX[(word >>> 16) & 0xff] +
            HEX[(word >>> 8) & 0xff] +
            HEX[word & 0xff];
    }
    return hex;
}

function sha256Bytes(input) {
    const state = sha256(input);
    const output = new Uint8Array(32);
    for (let i = 0; i < 8; i++) {
        const word = state[i];
        output[i * 4] = (word >>> 24) & 0xff;
        output[i * 4 + 1] = (word >>> 16) & 0xff;
        output[i * 4 + 2] = (word >>> 8) & 0xff;
        output[i * 4 + 3] = word & 0xff;
    }
    return output;
}

function sha256Raw(data, length) {
    const padded = padMessage(data, length);
    const state = new Uint32Array(IV);
    for (let off = 0; off < padded.length; off += 64) {
        compress(state, padded, off);
    }
    return state;
}

function digestToBytes(state, target, offset) {
    for (let i = 0; i < 8; i++) {
        const word = state[i];
        target[offset++] = (word >>> 24) & 0xff;
        target[offset++] = (word >>> 16) & 0xff;
        target[offset++] = (word >>> 8) & 0xff;
        target[offset++] = word & 0xff;
    }
}

function countLeadingZeroBits(state) {
    for (let i = 0; i < 8; i++) {
        const word = state[i] >>> 0;
        if (word === 0) continue;
        return i * 32 + Math.clz32(word);
    }
    return 256;
}

function countLeadingZeroBitsBytes(bytes) {
    for (let i = 0; i < bytes.length; i++) {
        if (bytes[i] === 0) continue;
        return i * 8 + Math.clz32(bytes[i]) - 24;
    }
    return bytes.length * 8;
}

function writeLE32(buffer, offset, value) {
    buffer[offset] = value & 0xff;
    buffer[offset + 1] = (value >>> 8) & 0xff;
    buffer[offset + 2] = (value >>> 16) & 0xff;
    buffer[offset + 3] = (value >>> 24) & 0xff;
}

function deriveHmacKey(key, padding) {
    const keyBytes = toBytes(key);
    const padded = new Uint8Array(HMAC_BLOCK);
    if (keyBytes.length > HMAC_BLOCK) {
        padded.set(sha256Bytes(keyBytes));
    } else {
        padded.set(keyBytes);
    }
    const result = new Uint8Array(HMAC_BLOCK);
    for (let i = 0; i < HMAC_BLOCK; i++) {
        result[i] = padded[i] ^ padding;
    }
    return result;
}

function hmacSha256(key, message) {
    const innerKey = deriveHmacKey(key, 0x36);
    const outerKey = deriveHmacKey(key, 0x5c);
    const messageBytes = toBytes(message);
    const inner = new Uint8Array(
        HMAC_BLOCK + messageBytes.length,
    );
    inner.set(innerKey);
    inner.set(messageBytes, HMAC_BLOCK);
    const innerHash = sha256Bytes(inner);
    const outer = new Uint8Array(HMAC_BLOCK + 32);
    outer.set(outerKey);
    outer.set(innerHash, HMAC_BLOCK);
    return sha256Bytes(outer);
}

function hmacSha256Hex(key, message) {
    const bytes = hmacSha256(key, message);
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

function hashWithCounter(counter, scratch, length) {
    writeLE32(scratch, 0, counter);
    return sha256Raw(scratch, length);
}

function bBlock(buffer, index) {
    return buffer.subarray(index * 32, (index + 1) * 32);
}

function balloon(
    input, spaceCost, timeCost, delta = DELTA,
) {
    const inputBytes = toBytes(input);
    const buffer = new Uint8Array(spaceCost * 32);
    const scratch = new Uint8Array(
        Math.max(4 + inputBytes.length, 68),
    );
    let counter = 0;
    scratch.set(inputBytes, 4);
    let state = hashWithCounter(
        counter++, scratch, 4 + inputBytes.length,
    );
    digestToBytes(state, buffer, 0);
    for (let i = 1; i < spaceCost; i++) {
        scratch.set(bBlock(buffer, i - 1), 4);
        state = hashWithCounter(
            counter++, scratch, 36,
        );
        digestToBytes(state, buffer, i * 32);
    }
    const paramScratch = new Uint8Array(16);
    for (let t = 0; t < timeCost; t++) {
        for (let i = 0; i < spaceCost; i++) {
            const previous = (i || spaceCost) - 1;
            scratch.set(bBlock(buffer, previous), 4);
            scratch.set(bBlock(buffer, i), 36);
            state = hashWithCounter(
                counter++, scratch, 68,
            );
            digestToBytes(state, buffer, i * 32);
            for (let j = 0; j < delta; j++) {
                writeLE32(paramScratch, 0, counter++);
                writeLE32(paramScratch, 4, t);
                writeLE32(paramScratch, 8, i);
                writeLE32(paramScratch, 12, j);
                const idx = sha256Raw(paramScratch, 16);
                const other =
                    (idx[0] >>> 0) % spaceCost;
                scratch.set(bBlock(buffer, i), 4);
                scratch.set(
                    bBlock(buffer, other), 36,
                );
                state = hashWithCounter(
                    counter++, scratch, 68,
                );
                digestToBytes(
                    state, buffer, i * 32,
                );
            }
        }
    }
    return bBlock(buffer, spaceCost - 1).slice();
}

function balloonHex(
    input, spaceCost, timeCost, delta = DELTA,
) {
    const bytes = balloon(
        input, spaceCost, timeCost, delta,
    );
    let hex = '';
    for (let i = 0; i < bytes.length; i++) {
        hex += bytes[i].toString(16).padStart(2, '0');
    }
    return hex;
}

function balloonRaw(
    inputBuffer, inputLength, spaceCost,
    timeCost, delta, outputBuffer, outputOffset,
) {
    const buffer = new Uint8Array(spaceCost * 32);
    const scratch = new Uint8Array(
        Math.max(4 + inputLength, 68),
    );
    let counter = 0;
    for (let i = 0; i < inputLength; i++) {
        scratch[4 + i] = inputBuffer[i];
    }
    let state = hashWithCounter(
        counter++, scratch, 4 + inputLength,
    );
    digestToBytes(state, buffer, 0);
    for (let i = 1; i < spaceCost; i++) {
        scratch.set(bBlock(buffer, i - 1), 4);
        state = hashWithCounter(
            counter++, scratch, 36,
        );
        digestToBytes(state, buffer, i * 32);
    }
    const paramScratch = new Uint8Array(16);
    for (let t = 0; t < timeCost; t++) {
        for (let i = 0; i < spaceCost; i++) {
            const previous = (i || spaceCost) - 1;
            scratch.set(bBlock(buffer, previous), 4);
            scratch.set(bBlock(buffer, i), 36);
            state = hashWithCounter(
                counter++, scratch, 68,
            );
            digestToBytes(state, buffer, i * 32);
            for (let j = 0; j < delta; j++) {
                writeLE32(paramScratch, 0, counter++);
                writeLE32(paramScratch, 4, t);
                writeLE32(paramScratch, 8, i);
                writeLE32(paramScratch, 12, j);
                const idx = sha256Raw(paramScratch, 16);
                const other =
                    (idx[0] >>> 0) % spaceCost;
                scratch.set(bBlock(buffer, i), 4);
                scratch.set(
                    bBlock(buffer, other), 36,
                );
                state = hashWithCounter(
                    counter++, scratch, 68,
                );
                digestToBytes(
                    state, buffer, i * 32,
                );
            }
        }
    }
    const result = bBlock(buffer, spaceCost - 1);
    if (outputBuffer) {
        outputBuffer.set(result, outputOffset || 0);
    }
    return state;
}

export {
    sha256,
    sha256Hex,
    sha256Bytes,
    sha256Raw,
    digestToBytes,
    countLeadingZeroBits,
    countLeadingZeroBitsBytes,
    writeLE32,
    toBytes,
    hmacSha256,
    hmacSha256Hex,
    balloon,
    balloonHex,
    balloonRaw,
    DELTA,
};
