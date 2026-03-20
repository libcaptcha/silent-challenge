#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync, execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build');

let inputFile = null;
let outFile = null;
let keyHex = null;
let manifestPath = path.join(BUILD, 'manifest.json');

for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--out' && process.argv[i + 1]) outFile = process.argv[++i];
    else if (a === '--key' && process.argv[i + 1]) keyHex = process.argv[++i];
    else if (a === '--manifest' && process.argv[i + 1]) manifestPath = process.argv[++i];
    else if (!a.startsWith('-')) inputFile = a;
}

if (!inputFile) {
    console.error('Usage: compile.js <input.js> ' + '[--manifest path] [--out file] [--key hex]');
    process.exit(1);
}

function getKey() {
    if (keyHex) return Buffer.from(keyHex, 'hex');
    if (fs.existsSync(manifestPath)) {
        const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        return Buffer.from(m.keys.decrypt, 'hex');
    }
    console.error('[compile] No key: provide --key or --manifest');
    process.exit(1);
}

function findQjsc() {
    const qjsDir = path.join(ROOT, 'vendor', 'quickjs');
    const qjsc = path.join(qjsDir, 'qjsc');

    if (fs.existsSync(qjsc)) return qjsc;

    console.log('[compile] Building qjsc...');
    execSync('make qjsc', {
        cwd: qjsDir,
        stdio: 'inherit',
    });

    if (!fs.existsSync(qjsc)) {
        console.error('[compile] Failed to build qjsc');
        process.exit(1);
    }
    return qjsc;
}

function compileToBytecode(jsFile) {
    const qjsc = findQjsc();

    fs.mkdirSync(BUILD, { recursive: true });

    const cFile = path.join(BUILD, '_bc_tmp.c');
    execFileSync(qjsc, ['-e', '-o', cFile, jsFile], {
        stdio: 'inherit',
    });

    const cSrc = fs.readFileSync(cFile, 'utf8');
    const match = cSrc.match(/\{([\s\S]*?)\};/);
    if (!match) {
        console.error('[compile] Failed to parse qjsc output');
        process.exit(1);
    }

    const bytes = match[1]
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => Number(s));

    fs.unlinkSync(cFile);
    return Buffer.from(bytes);
}

function chacha20Encrypt(plaintext, key, nonce) {
    const counter = Buffer.alloc(4);
    counter.writeUInt32LE(1, 0);
    const iv = Buffer.concat([counter, nonce]);

    const cipher = crypto.createCipheriv('chacha20', key, iv);
    return Buffer.concat([cipher.update(plaintext), cipher.final()]);
}

function buildBundle(bytecode, key) {
    const nonce = crypto.randomBytes(12);
    const ct = chacha20Encrypt(bytecode, key, nonce);

    const magic = Buffer.alloc(4);
    magic.writeUInt32LE(0x564d4243, 0);

    const lenBuf = Buffer.alloc(4);
    lenBuf.writeUInt32LE(bytecode.length, 0);

    return Buffer.concat([magic, lenBuf, nonce, ct]);
}

function main() {
    const key = getKey();
    console.log('[compile] Key loaded (32 bytes)');

    const absInput = path.resolve(inputFile);
    console.log('[compile] Compiling:', absInput);

    const bytecode = compileToBytecode(absInput);
    console.log('[compile] Bytecode:', bytecode.length, 'bytes');

    const bundle = buildBundle(bytecode, key);

    if (!outFile) {
        outFile = path.join(BUILD, path.basename(inputFile, '.js') + '.vmbc');
    }

    fs.writeFileSync(outFile, bundle);
    console.log('[compile] Bundle written:', outFile, `(${bundle.length} bytes)`);
}

main();
