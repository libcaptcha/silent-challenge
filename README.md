# silent-challenge

Passive captcha combining motion attestation, navigator attestation,
and SHA-256 balloon proof-of-work. Attestation scripts are compiled
to encrypted bytecode and executed inside a polymorphic QuickJS WASM
sandbox that automatically encrypts and signs responses.

## How It Works

The attestation code does **not** run directly in the browser.
It is compiled to QuickJS bytecode, encrypted with ChaCha20, and
delivered as a `.vmbc` bundle. The WASM binary is regenerated every
10 minutes with fresh keys, dead code, and renamed symbols — making
static analysis and replay attacks impractical.

```
┌─────────────────────────────────────────────────────────┐
│ Server (every 10 min)                                   │
│                                                         │
│  1. node scripts/build.js    → vm.wasm + manifest.json  │
│  2. node scripts/compile.js  → attestation.vmbc         │
│     (source: attestation expression → encrypted bundle) │
└──────────────────────┬──────────────────────────────────┘
                       │
          POST /challenge → { challengeId, nonce, pow, vmbc }
                       │
┌──────────────────────▼──────────────────────────────────┐
│ Browser (parallel)                                      │
│                                                         │
│  ┌─ WASM VM ──────────────────────────────────┐         │
│  │  vm_init()                                 │         │
│  │  vm_exec_bytecode(attestation.vmbc)        │         │
│  │    ChaCha20 decrypt → QuickJS eval         │         │
│  │    → collects motion + navigator signals   │         │
│  │    ChaCha20 encrypt + HMAC-SHA256 sign     │         │
│  │    → encrypted + signed response           │         │
│  └────────────────────────────────────────────┘         │
│                                                         │
│  ┌─ Web Workers ──────────────────────────────┐         │
│  │  sha256-balloon PoW mining                 │         │
│  └────────────────────────────────────────────┘         │
└──────────────────────┬──────────────────────────────────┘
                       │
          POST /challenge/:id/verify → { vmResponse, nonce }
                       │
┌──────────────────────▼──────────────────────────────────┐
│ Server                                                  │
│                                                         │
│  1. Verify HMAC signature (KEY_SIGN from manifest)      │
│  2. Decrypt attestation result (KEY_ENCRYPT)            │
│  3. Verify PoW (balloon hash ≥ difficulty)              │
│  4. Analyze motion data (behavioral biometrics)         │
│  5. Validate navigator signals (24 categories)          │
│  6. Compute weighted score → issue signed token         │
└─────────────────────────────────────────────────────────┘
```

## Bytecode Format

The attestation source is a JavaScript expression compiled with
`node scripts/compile.js`. The VM evaluates it and returns the
result as the response payload:

```js
JSON.stringify({
  m: __motion_data__,
  s: __navigator_signals__,
  ts: __vm_ts(),
  integrity: __vm_integrity()
});
```

This follows the same pattern as any QuickJS bytecode source:

```js
'Hello from compiled bytecode!';
```

The compile step converts JS → QuickJS bytecode → encrypted `.vmbc`:

```
┌──────────┬──────────────┬──────────┬────────────┐
│ 4B magic │ 4B bc_len LE │ 12B nonce│ ciphertext │
│ "VMBC"   │              │          │            │
└──────────┴──────────────┴──────────┴────────────┘
```

The VM wraps the execution result in an encrypted signed response:

```
┌──────────┬──────────────┬───────────┬────────────┬──────────┐
│ 4B magic │ 4B total_len │ 12B nonce │ ciphertext │ 32B HMAC │
│ "VMRP"   │ LE           │           │            │          │
└──────────┴──────────────┴───────────┴────────────┴──────────┘
```

The server holds `manifest.json` with the matching keys to verify
the HMAC and decrypt the ciphertext.

## WASM Regeneration

Every 10 minutes the server rebuilds the WASM binary. Each build:

- Generates fresh 32-byte ChaCha20/HMAC keys
- Injects 20-40 dead code functions with realistic bodies
- Renames all exported and internal symbols
- Shuffles key material across randomized decoy arrays
- Applies control flow flattening and opaque predicates
- Recompiles the attestation source against the new keys

This means every client receives a structurally unique binary.
Reverse engineering one build does not help with the next.

## Vendors

| Package                | Role                              | Usage       |
| ---------------------- | --------------------------------- | ----------- |
| `motion-attestation`   | Behavioral biometrics collection  | dependency  |
| `navigator-attestation`| Browser environment fingerprinting| dependency  |
| `sha256-balloon`       | Memory-hard proof-of-work         | dependency  |
| `quickjs-wasm`         | Polymorphic WASM sandbox          | reference   |

## Install

```bash
npm install silent-challenge
```

The three attestation/PoW packages are runtime dependencies.
The `quickjs-wasm` package is a build-time reference for
compiling and serving the WASM sandbox.

## Server

```js
import express from 'express';
import { silentMiddleware } from 'silent-challenge/server';

const app = express();
const silent = silentMiddleware({
    secret: process.env.SILENT_SECRET,
    pow: { difficulty: 10, spaceCost: 512 },
    thresholds: { combined: 0.5, motion: 0.3, navigator: 0.3 },
    debug: false,
});

app.use(express.json({ limit: '64kb' }));
silent.mountRoutes(app);

app.get('/protected', silent.requireToken, (req, res) => {
    res.json({
        message: 'Access granted',
        score: req.silentPayload.score,
    });
});

app.listen(3000);
```

### Routes

| Method | Path                         | Description           |
| ------ | ---------------------------- | --------------------- |
| POST   | `/challenge`                 | Issue challenge + PoW |
| POST   | `/challenge/:challengeId/verify` | Submit solution   |

### Options

```js
silentMiddleware({
    secret: string,          // HMAC secret (auto-generated)
    debug: boolean,          // include full analysis detail
    weights: {
        motion: 0.40,        // behavioral biometrics weight
        navigator: 0.35,     // environment attestation weight
        pow: 0.25,           // proof-of-work weight
    },
    pow: {
        difficulty: 10,      // leading zero bits required
        spaceCost: 512,      // balloon memory blocks (× 32B)
        timeCost: 1,         // balloon mixing rounds
    },
    thresholds: {
        combined: 0.50,      // minimum weighted score
        motion: 0.30,        // minimum motion score
        navigator: 0.30,     // minimum navigator score
    },
})
```

## Browser Client

```js
import { createClient } from 'silent-challenge/client';

const client = createClient({
    baseUrl: '',
    workerUrl: './worker.js',
    onProgress: ({ hashes, hashRate }) => {
        console.log(`${hashes} hashes @ ${hashRate} H/s`);
    },
});

// Start passive collection
const collector = client.attach(document, window);
collector.bind(document.getElementById('submit'), 'submit');

// When ready (e.g. form submit)
const result = await client.verify();
// result.cleared, result.token, result.score
```

The client runs three tasks in parallel:

1. **Motion collection** — mouse, clicks, keystrokes, scroll,
   touch, sensors, event order (via `motion-attestation`)
2. **Navigator signals** — 24 categories: automation markers,
   headless detection, VM indicators, canvas/WebGL fingerprints,
   prototype tampering (via `navigator-attestation`)
3. **PoW mining** — multi-worker balloon hashing
   (via `sha256-balloon`)

## Scoring

The combined score is a weighted sum:

```
score = motion × 0.40 + navigator × 0.35 + pow × 0.25
```

PoW score is binary (1.0 if valid, 0.0 if not). Motion and
navigator scores range from 0.0 to 1.0 based on anomaly
penalties. A token is issued only when all three individual
thresholds and the combined threshold are met.

## Example

```bash
npm start
# → http://localhost:3000
```

Interactive demo with step indicators, live stats, and
score visualization.

## Test

```bash
npm test
```

## Project Structure

```
src/
  index.js           Barrel exports
  index.d.ts         TypeScript definitions
  challenge.js       Challenge issuance + combined verification
  server.js          Express middleware (mountRoutes, requireToken)
  client.js          Browser orchestrator (collect + solve + submit)
```

## License

[MIT](LICENSE)
