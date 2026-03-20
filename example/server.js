import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { silentMiddleware } from '../src/server.js';
import { createKeyRing } from '../src/vm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const PORT = process.env.PORT || 3000;
const vmDir = join(root, 'vm');
const manifestPath = join(vmDir, 'build', 'manifest.json');

const keyRing = createKeyRing({
    manifestPath,
    buildDir: vmDir,
    buildCommand: 'node scripts/build.cjs',
    compileCommand: 'node scripts/compile.cjs web/attestation.js' + ' --out web/attestation.vmbc',
    onRotate: (manifest) => {
        console.log(`[vm] rotated keys: ${manifest.buildId || 'generated'}`);
    },
});

console.log(`VM keys: ${keyRing.size} set(s)`);

const app = express();

const silent = silentMiddleware({
    secret: process.env.SILENT_SECRET,
    debug: !!process.env.DEBUG,
    keyRing,
    vmbcUrl: keyRing.built ? '/vmbc' : null,
    vmbcPath: keyRing.built ? join(vmDir, 'web', 'attestation.vmbc') : null,
    pow: {
        difficulty: parseInt(process.env.POW_DIFFICULTY || '10', 10),
        spaceCost: parseInt(process.env.POW_SPACE_COST || '512', 10),
    },
    thresholds: {
        combined: parseFloat(process.env.THRESHOLD || '0.5'),
    },
});

app.use(express.json({ limit: '64kb' }));
app.use(express.static(join(__dirname, 'public')));
app.use('/src', express.static(join(root, 'src')));
app.use('/vm/web', express.static(join(root, 'vm', 'web')));

silent.mountRoutes(app);

app.get('/protected', silent.requireToken, (_request, response) => {
    const payload = _request.silentPayload;
    response.json({
        message: 'Access granted',
        score: payload.score,
        motionScore: payload.motionScore,
        navigatorScore: payload.navigatorScore,
        vmValid: payload.vmValid,
        issued: new Date(payload.iat).toISOString(),
    });
});

app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`);
});
