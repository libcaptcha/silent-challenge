export interface InteractionData {
    m: number[][];
    c: number[][];
    k: number[][];
    s: number[][];
    tc: number[][];
    ac: number[][];
    gy: number[][];
    or: number[][];
    ev: number[][];
    bc: number[][];
    bl: string[];
    ttfi: number;
    dur: number;
    meta: Record<string, unknown>;
}

export interface AnalysisResult {
    score: number;
    penalty: number;
    reasons: string[];
    categories: Record<string, {
        penalty: number;
        maxPenalty: number;
        reasons: string[];
    }>;
}

export interface ValidationResult {
    score: number;
    flags: string[];
    verdict: string;
    categoryScores: Record<string, {
        score: number;
        flags: string[];
    }>;
}

export interface Weights {
    motion?: number;
    navigator?: number;
    pow?: number;
    vm?: number;
}

export interface PowConfig {
    difficulty?: number;
    spaceCost?: number;
    timeCost?: number;
}

export interface Thresholds {
    combined?: number;
    motion?: number;
    navigator?: number;
}

export interface KeyRingOptions {
    manifestPath?: string;
    keys?: {
        decrypt: string;
        encrypt: string;
        sign: string;
    };
    maxKeySets?: number;
    rotationMs?: number;
    buildDir?: string;
    buildCommand?: string;
    compileCommand?: string;
    onRotate?: (manifest: unknown) => void;
}

export interface KeyRing {
    rebuild(): unknown;
    verify(response: unknown): VmResult;
    current(): {
        decrypt: string;
        encrypt: string;
        sign: string;
    } | null;
    readonly size: number;
    destroy(): void;
}

export interface VmResult {
    valid: boolean;
    data?: unknown;
    error?: string;
}

export interface ChallengeManagerOptions {
    secret?: string;
    weights?: Weights;
    pow?: PowConfig;
    thresholds?: Thresholds;
    debug?: boolean;
    keyRing?: KeyRing;
    manifest?: unknown;
    manifestPath?: string;
    vmbcUrl?: string;
    vmbcPath?: string;
}

export interface ChallengeResponse {
    challengeId: string;
    nonce: string;
    pow: {
        challengeId: string;
        prefix: string;
        difficulty: number;
        spaceCost: number;
        timeCost: number;
        delta: number;
    };
    ttl: number;
    vmbc?: string;
}

export interface VerifyPayload {
    nonce: number;
    motion?: InteractionData;
    signals?: Record<string, unknown>;
    vmResponse?: unknown;
}

export interface VerifyResponse {
    cleared: boolean;
    score: number;
    flags: string[];
    token?: string;
    expiresAt?: number;
    error?: string;
    detail?: {
        motion: AnalysisResult & {
            verdict: string;
        };
        navigator: ValidationResult;
        pow: { valid: boolean; hash?: string };
        vm: VmResult;
    };
}

export interface TokenPayload {
    sub: string;
    score: number;
    motionScore: number;
    navigatorScore: number;
    vmValid: boolean;
    iat: number;
}

export interface ChallengeManager {
    issue(): ChallengeResponse;
    verify(
        challengeId: string,
        payload: VerifyPayload,
        headers?: Record<string, string>,
    ): VerifyResponse;
    getVmToken(
        challengeId: string,
    ): string | null;
    validateToken(
        token: string,
    ): TokenPayload | null;
    secret: string;
    keyRing: KeyRing | null;
    manifest: unknown;
    destroy(): void;
}

export declare function createChallengeManager(
    options?: ChallengeManagerOptions,
): ChallengeManager;

export declare const CHALLENGE_TTL_MS: number;
export declare const TOKEN_TTL_MS: number;
export declare const DEFAULT_WEIGHTS: Required<Weights>;
export declare const DEFAULT_POW: Required<PowConfig>;
export declare const DEFAULT_THRESHOLDS: Required<Thresholds>;

export interface SilentMiddleware {
    handleChallenge(
        request: import("express").Request,
        response: import("express").Response,
    ): void;
    handleVmbc(
        request: import("express").Request,
        response: import("express").Response,
    ): void;
    handleVerify(
        request: import("express").Request,
        response: import("express").Response,
    ): void;
    requireToken(
        request: import("express").Request,
        response: import("express").Response,
        next: import("express").NextFunction,
    ): void;
    mountRoutes(
        router: import("express").Router,
    ): import("express").Router;
    manager: ChallengeManager;
}

export declare function silentMiddleware(
    options?: ChallengeManagerOptions,
): SilentMiddleware;

export interface ClientOptions {
    baseUrl?: string;
    workerUrl?: string;
    vmUrl?: string;
    onProgress?: (progress: {
        hashes: number;
        hashRate: number;
        workers: number;
    }) => void;
    collector?: {
        limits?: Record<string, number>;
        minTime?: number;
    };
}

export interface ClientResult extends VerifyResponse {
    powElapsed: number;
    powHashes: number;
    powHashRate: number;
}

export interface SilentClient {
    attach(
        document?: Document,
        window?: Window,
    ): unknown;
    detach(
        document?: Document,
        window?: Window,
    ): void;
    bind(element: Element, label?: string): void;
    isReady(): boolean;
    stats(): Record<string, number> | null;
    verify(): Promise<ClientResult>;
}

export declare function createClient(
    options?: ClientOptions,
): SilentClient;

export declare function createKeyRing(
    options?: KeyRingOptions,
): KeyRing;

export declare function loadManifest(
    path: string,
): unknown;

export declare function verifyVmResponse(
    response: unknown,
    manifest: unknown,
): VmResult;

export declare function createChallengeBundle(
    basePath: string,
    token: string,
): Buffer;

export declare function createCollector(
    options?: {
        limits?: Record<string, number>;
        minTime?: number;
    },
): unknown;

export declare function serializeInteractions(
    data: InteractionData,
): string;

export declare function deserializeInteractions(
    json: string,
): InteractionData;

export declare function analyze(
    data: InteractionData,
): AnalysisResult;

export declare function classifyMotionScore(
    score: number,
): string;

export declare function collectSignals(
    categories?: string[],
): Record<string, unknown>;

export declare function serializeSignals(
    signals: Record<string, unknown>,
): string;

export declare function deserializeSignals(
    json: string,
): Record<string, unknown>;

export declare function validateSignals(
    signals: Record<string, unknown>,
    headers?: Record<string, string>,
): ValidationResult;

export declare function classifyNavigatorScore(
    score: number,
): string;

export declare function computeCategoryScores(
    signals: Record<string, unknown>,
    headers?: Record<string, string>,
): Record<string, {
    score: number;
    flags: string[];
}>;

export declare function getFingerprint(
    options?: {
        include?: string[];
        exclude?: string[];
        stabilize?: boolean;
    },
): {
    id: string;
    components: Record<string, unknown>;
    browser: string;
};

export declare function getFingerprintAsync(
    options?: {
        include?: string[];
        exclude?: string[];
        stabilize?: boolean;
    },
): Promise<{
    id: string;
    components: Record<string, unknown>;
    browser: string;
}>;

export declare function sha256(
    input: string | Uint8Array,
): Uint32Array;

export declare function sha256Hex(
    input: string | Uint8Array,
): string;

export declare function sha256Bytes(
    input: string | Uint8Array,
): Uint8Array;

export declare function hmacSha256(
    key: string | Uint8Array,
    message: string | Uint8Array,
): Uint8Array;

export declare function hmacSha256Hex(
    key: string | Uint8Array,
    message: string | Uint8Array,
): string;

export declare function balloon(
    input: string | Uint8Array,
    spaceCost: number,
    timeCost: number,
    delta?: number,
): Uint8Array;

export declare function balloonHex(
    input: string | Uint8Array,
    spaceCost: number,
    timeCost: number,
    delta?: number,
): string;

export declare function createChallenge(
    secret: string,
    options?: PowConfig,
): {
    id: string;
    challenge: ChallengeResponse["pow"];
    record: unknown;
};

export declare function verifyChallenge(
    record: unknown,
    nonce: number,
): { valid: boolean; hash?: string; error?: string };

export declare function signToken(
    payload: unknown,
    secret: string,
): string;

export declare function verifyToken(
    token: string,
    secret: string,
): unknown;
