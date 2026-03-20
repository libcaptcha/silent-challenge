import {
    sha256Raw, digestToBytes, writeLE32,
    countLeadingZeroBitsBytes,
} from './crypto.js';

const REPORT_INTERVAL = 5;

function block(buffer, index) {
    return buffer.subarray(index * 32, (index + 1) * 32);
}

function hashWithCounter(counter, scratch, length) {
    writeLE32(scratch, 0, counter);
    const state = sha256Raw(scratch, length);
    return state;
}

function mine(prefix, difficulty, spaceCost, timeCost, delta, workerId, workerCount) {
    const prefixBytes = new TextEncoder().encode(prefix);
    const inputBuffer = new Uint8Array(prefixBytes.length + 20);
    inputBuffer.set(prefixBytes);
    const balloonBuf = new Uint8Array(spaceCost * 32);
    const scratch = new Uint8Array(Math.max(4 + prefixBytes.length + 20, 68));
    const paramScratch = new Uint8Array(16);
    const resultBytes = new Uint8Array(32);

    let nonce = workerId;
    let unreported = 0;

    while (true) {
        const nonceStr = nonce.toString();
        for (let i = 0; i < nonceStr.length; i++) {
            inputBuffer[prefixBytes.length + i] = nonceStr.charCodeAt(i);
        }
        const inputLength = prefixBytes.length + nonceStr.length;

        balloonInPlace(
            inputBuffer,
            inputLength,
            spaceCost,
            timeCost,
            delta,
            balloonBuf,
            scratch,
            paramScratch,
            resultBytes
        );

        if (countLeadingZeroBitsBytes(resultBytes) >= difficulty) {
            self.postMessage({
                type: 'solution',
                nonce,
                hashes: unreported,
            });
            return;
        }

        nonce += workerCount;
        unreported++;

        if (unreported >= REPORT_INTERVAL) {
            self.postMessage({
                type: 'progress',
                hashes: unreported,
            });
            unreported = 0;
        }
    }
}

function balloonInPlace(
    input,
    inputLength,
    spaceCost,
    timeCost,
    delta,
    buffer,
    scratch,
    paramScratch,
    resultBytes
) {
    let counter = 0;

    for (let i = 0; i < inputLength; i++) {
        scratch[4 + i] = input[i];
    }
    let state = hashWithCounter(counter++, scratch, 4 + inputLength);
    digestToBytes(state, buffer, 0);

    for (let i = 1; i < spaceCost; i++) {
        scratch.set(block(buffer, i - 1), 4);
        state = hashWithCounter(counter++, scratch, 36);
        digestToBytes(state, buffer, i * 32);
    }

    for (let t = 0; t < timeCost; t++) {
        for (let i = 0; i < spaceCost; i++) {
            const previous = (i || spaceCost) - 1;
            scratch.set(block(buffer, previous), 4);
            scratch.set(block(buffer, i), 36);
            state = hashWithCounter(counter++, scratch, 68);
            digestToBytes(state, buffer, i * 32);

            for (let j = 0; j < delta; j++) {
                writeLE32(paramScratch, 0, counter++);
                writeLE32(paramScratch, 4, t);
                writeLE32(paramScratch, 8, i);
                writeLE32(paramScratch, 12, j);
                const indexState = sha256Raw(paramScratch, 16);
                const other = (indexState[0] >>> 0) % spaceCost;

                scratch.set(block(buffer, i), 4);
                scratch.set(block(buffer, other), 36);
                state = hashWithCounter(counter++, scratch, 68);
                digestToBytes(state, buffer, i * 32);
            }
        }
    }

    const last = block(buffer, spaceCost - 1);
    resultBytes.set(last);
}

self.onmessage = ({ data }) => {
    mine(
        data.prefix,
        data.difficulty,
        data.spaceCost,
        data.timeCost,
        data.delta,
        data.workerId,
        data.workerCount
    );
};
