import { createCollector } from './motion.js';
import { collectSignals } from './navigator.js';

export function createClient(options = {}) {
    const baseUrl = options.baseUrl || '';
    const workerUrl = options.workerUrl || './worker.js';
    const vmUrl = options.vmUrl || '/vm/web';
    const onProgress = options.onProgress || null;
    const collectorOptions = options.collector || {};

    let collector = null;

    function attach(document, window) {
        collector = createCollector(collectorOptions);
        collector.attach(document, window);
        return collector;
    }

    function detach(document, window) {
        if (!collector) return;
        collector.detach(document, window);
    }

    function bind(element, label) {
        if (!collector) return;
        collector.bind(element, label);
    }

    function isReady() {
        return collector?.isReady() || false;
    }

    function stats() {
        if (!collector) return null;
        return collector.stats();
    }

    async function verify() {
        const challenge = await requestChallenge(baseUrl);

        const [powResult, vmResponse, signals] = await Promise.all([
            solvePow(challenge.pow, workerUrl, onProgress),
            executeVm(vmUrl, challenge.vmbc),
            collectNavigatorSignals(),
        ]);

        const motionData = extractMotionData(collector);
        detach();

        return submitVerification(baseUrl, challenge, powResult, motionData, signals, vmResponse);
    }

    return { attach, detach, bind, isReady, stats, verify };
}

async function requestChallenge(baseUrl) {
    const response = await fetch(`${baseUrl}/challenge`, { method: 'POST' });
    if (!response.ok) {
        throw new Error('Challenge request failed');
    }
    return response.json();
}

function extractMotionData(collector) {
    if (!collector) return null;
    return collector.getData();
}

async function collectNavigatorSignals() {
    try {
        return collectSignals();
    } catch {
        return null;
    }
}

async function executeVm(vmUrl, vmbcPath) {
    try {
        const loader = await import(`${vmUrl}/loader.js`);
        await loader.initModule(`${vmUrl}/vm.wasm`);
        loader.vmInit();

        const bundleUrl = vmbcPath || `${vmUrl}/attestation.vmbc`;
        const resp = await fetch(bundleUrl);
        const bundle = new Uint8Array(await resp.arrayBuffer());

        const result = loader.vmExec(bundle);
        loader.vmDestroy();

        if (!result) return null;
        return uint8ToBase64(result);
    } catch {
        return null;
    }
}

function uint8ToBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

async function submitVerification(baseUrl, challenge, powResult, motionData, signals, vmResponse) {
    const body = {
        nonce: powResult.nonce,
        motion: motionData,
        signals,
        vmResponse,
    };

    const response = await fetch(`${baseUrl}/challenge/${challenge.challengeId}/verify`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Verification failed');
    }

    const result = await response.json();
    return {
        ...result,
        powElapsed: powResult.elapsed,
        powHashes: powResult.totalHashes,
        powHashRate: powResult.hashRate,
    };
}

function solvePow(challenge, workerUrl, onProgress) {
    const workerCount = navigator.hardwareConcurrency || 4;

    return new Promise((resolve, reject) => {
        const workers = [];
        let totalHashes = 0;
        let resolved = false;
        const startTime = performance.now();

        function cleanup() {
            workers.forEach((w) => w.terminate());
        }

        for (let i = 0; i < workerCount; i++) {
            const worker = new Worker(workerUrl, { type: 'module' });
            workers.push(worker);

            worker.onmessage = ({ data }) => {
                if (resolved) return;

                if (data.type === 'solution') {
                    resolved = true;
                    cleanup();
                    totalHashes += data.hashes;
                    const elapsed = performance.now() - startTime;
                    resolve({
                        nonce: data.nonce,
                        totalHashes,
                        elapsed: Math.round(elapsed),
                        hashRate: Math.round(totalHashes / (elapsed / 1000)),
                    });
                    return;
                }

                totalHashes += data.hashes;
                if (!onProgress) return;
                const elapsed = performance.now() - startTime;
                onProgress({
                    hashes: totalHashes,
                    hashRate: Math.round(totalHashes / (elapsed / 1000)),
                    workers: workerCount,
                });
            };

            worker.onerror = (error) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                reject(new Error(error.message));
            };

            worker.postMessage({
                prefix: challenge.prefix,
                difficulty: challenge.difficulty,
                spaceCost: challenge.spaceCost,
                timeCost: challenge.timeCost,
                delta: challenge.delta,
                workerId: i,
                workerCount,
            });
        }
    });
}
