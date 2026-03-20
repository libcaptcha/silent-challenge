#!/usr/bin/env node
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const BUILD = path.join(ROOT, 'build');
const DEFAULT_OUT = path.join(ROOT, 'web');

let outDir = DEFAULT_OUT;
for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--out-dir' && process.argv[i + 1])
        outDir = path.resolve(process.argv[++i]);
}

function randBytes(n) {
    return crypto.randomBytes(n);
}

function randU32() {
    return crypto.randomBytes(4).readUInt32LE(0);
}

function randRange(min, max) {
    return min + (randU32() % (max - min + 1));
}

function randId(len = 8) {
    const alpha = 'abcdefghijklmnopqrstuvwxyz';
    const prefixes = ['_', '__', 'm_', 's_', 'g_', 'p_', 'k_', '_internal_', '_impl_', '__sys_'];
    let s = prefixes[randU32() % prefixes.length];
    for (let i = 0; i < len; i++) s += alpha[randU32() % alpha.length];
    return s;
}

function randTypeName(len = 8) {
    const alpha = 'abcdefghijklmnopqrstuvwxyz';
    let s = 'T_';
    for (let i = 0; i < len; i++) s += alpha[randU32() % alpha.length];
    return s;
}

function randMacroName(len = 10) {
    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let s = '_';
    for (let i = 0; i < len; i++) s += alpha[randU32() % alpha.length];
    s += '_';
    return s;
}

function hexArr(buf) {
    return Array.from(buf).map((b) => `0x${b.toString(16).padStart(2, '0')}`);
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randU32() % (i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

const keyDecrypt = randBytes(32);
const keyEncrypt = randBytes(32);
const keySign = randBytes(32);
const keyTrap = randBytes(32);
const keyDecoy1 = randBytes(32);
const keyDecoy2 = randBytes(32);
const keyDecoy3 = randBytes(32);

const DECOY_COUNT = randRange(4, 8);
const DECOY_SIZES = Array.from({ length: DECOY_COUNT }, () => randRange(384, 1024));

function embedKey(key, decoySz) {
    const arr = randBytes(decoySz);
    const offset = randRange(48, decoySz - 80);
    key.copy(arr, offset);
    return { arr, offset };
}

const allKeys = [
    { key: keyDecrypt, macro: 'VM_KEY_DECRYPT' },
    { key: keyEncrypt, macro: 'VM_KEY_ENCRYPT' },
    { key: keySign, macro: 'VM_KEY_SIGN' },
    { key: keyTrap, macro: 'VM_KEY_TRAP' },
    { key: keyDecoy1, macro: null },
    { key: keyDecoy2, macro: null },
    { key: keyDecoy3, macro: null },
];

const keyLayouts = allKeys.map((entry, index) => {
    const sz = DECOY_SIZES[index % DECOY_SIZES.length];
    return { ...entry, layout: embedKey(entry.key, sz) };
});

shuffle(keyLayouts);

function genKeysHeader() {
    const guard = randMacroName(12);
    const lines = [`#ifndef ${guard}`, `#define ${guard}`, '#include <stdint.h>', ''];

    const guardVar = randId(14);
    lines.push(`static volatile uint32_t ${guardVar} = ` + `0x${randU32().toString(16)};`);
    lines.push('');

    for (const entry of keyLayouts) {
        const varName = randId(14);
        const ha = hexArr(entry.layout.arr);
        const attrList = shuffle(['__attribute__((used))', '__attribute__((aligned(16)))']);
        lines.push(`static const uint8_t ${attrList.join(' ')} ` + `${varName}[] = {`);
        const chunkSize = randRange(8, 16);
        for (let i = 0; i < ha.length; i += chunkSize) {
            lines.push(`    ${ha.slice(i, i + chunkSize).join(',')},`);
        }
        lines.push('};');

        if (entry.macro) {
            const indirection = randId(12);
            lines.push(`#define ${indirection} ` + `(&${varName}[${entry.layout.offset}])`);
            lines.push(`#define ${entry.macro} (${indirection})`);
        } else {
            const fakeMacro = randMacroName(12);
            lines.push(`#define ${fakeMacro} ` + `(&${varName}[${entry.layout.offset}])`);
        }
        lines.push('');
    }

    for (let i = 0; i < randRange(3, 6); i++) {
        const trapName = randId(14);
        const trapSize = randRange(64, 256);
        const trapArr = randBytes(trapSize);
        lines.push(`static const uint8_t ` + `__attribute__((used)) ` + `${trapName}[] = {`);
        const ha = hexArr(trapArr);
        for (let j = 0; j < ha.length; j += 12) {
            lines.push(`    ${ha.slice(j, j + 12).join(',')},`);
        }
        lines.push('};');
        lines.push('');
    }

    lines.push('#endif');
    return lines.join('\n');
}

function genDeadCode() {
    const fnCount = randRange(20, 40);
    const structCount = randRange(4, 8);
    const globalCount = randRange(6, 12);
    const lines = ['#include <stdint.h>', '#include <string.h>', ''];

    for (let i = 0; i < structCount; i++) {
        const sname = randTypeName(10);
        const fieldCount = randRange(3, 8);
        lines.push(`typedef struct {`);
        for (let f = 0; f < fieldCount; f++) {
            const fname = randId(8);
            const types = [
                'uint32_t',
                'uint64_t',
                'int32_t',
                'uint8_t',
                'uint16_t',
                'volatile uint32_t',
            ];
            const t = types[randU32() % types.length];
            if (randU32() % 4 === 0) {
                const arrSz = randRange(4, 32);
                lines.push(`    ${t} ${fname}[${arrSz}];`);
            } else {
                lines.push(`    ${t} ${fname};`);
            }
        }
        lines.push(`} ${sname};`);
        lines.push('');
    }

    for (let i = 0; i < globalCount; i++) {
        const gname = randId(12);
        const gtype = ['volatile uint32_t', 'volatile uint64_t', 'static volatile uint32_t'][
            randU32() % 3
        ];
        lines.push(`${gtype} ${gname} = 0x${randU32().toString(16)};`);
    }
    lines.push('');

    const helpers = [];
    for (let i = 0; i < randRange(4, 8); i++) {
        const hname = randId(14);
        const paramCount = randRange(2, 5);
        helpers.push({ name: hname, arity: paramCount });
        const params = [];
        for (let p = 0; p < paramCount; p++) {
            params.push(`uint32_t ${randId(6)}`);
        }
        lines.push(
            `static uint32_t __attribute__((noinline)) ` + `${hname}(${params.join(', ')}) {`
        );
        genRealisticBody(lines, randRange(4, 10));
        lines.push('}');
        lines.push('');
    }

    for (let f = 0; f < fnCount; f++) {
        const fname = randId(14);
        const paramCount = randRange(2, 6);
        const params = [];
        const paramNames = [];
        for (let p = 0; p < paramCount; p++) {
            const pname = randId(6);
            paramNames.push(pname);
            params.push(`uint32_t ${pname}`);
        }

        const returnTypes = ['uint32_t', 'uint64_t', 'int32_t', 'void'];
        const retType = returnTypes[randU32() % returnTypes.length];

        const attrs = shuffle(['__attribute__((used))', '__attribute__((noinline))']).join(' ');

        lines.push(`static ${retType} ${attrs} ` + `${fname}(${params.join(', ')}) {`);

        genObfuscatedBody(lines, paramNames, helpers, retType);

        lines.push('}');
        lines.push('');
    }

    return lines.join('\n');
}

function genRealisticBody(lines, stmtCount) {
    const locals = [];
    for (let i = 0; i < randRange(2, 4); i++) {
        const lname = randId(6);
        locals.push(lname);
        lines.push(`    uint32_t ${lname} = ` + `0x${randU32().toString(16)};`);
    }

    for (let s = 0; s < stmtCount; s++) {
        const target = locals[randU32() % locals.length];
        const source = locals[randU32() % locals.length];
        genRandomStatement(lines, target, source);
    }

    const retLocal = locals[randU32() % locals.length];
    lines.push(`    return ${retLocal};`);
}

function genObfuscatedBody(lines, paramNames, helpers, retType) {
    const locals = [];
    for (let i = 0; i < randRange(3, 7); i++) {
        const lname = randId(8);
        locals.push(lname);
        const initSource =
            randU32() % 2 === 0 && paramNames.length
                ? paramNames[randU32() % paramNames.length]
                : `0x${randU32().toString(16)}`;
        lines.push(`    uint32_t ${lname} = ` + `(uint32_t)(${initSource});`);
    }

    const allVars = [...locals, ...paramNames.filter(() => randU32() % 2 === 0)];

    const stmtCount = randRange(8, 25);
    for (let s = 0; s < stmtCount; s++) {
        const choice = randU32() % 100;

        if (choice < 15 && allVars.length >= 2) {
            genIfElseBlock(lines, allVars);
        } else if (choice < 25 && allVars.length >= 2) {
            genForLoop(lines, allVars);
        } else if (choice < 35 && allVars.length >= 2) {
            genSwitchBlock(lines, allVars);
        } else if (choice < 45 && helpers.length > 0) {
            const target = allVars[randU32() % allVars.length];
            const h = helpers[randU32() % helpers.length];
            const args = [];
            for (let a = 0; a < h.arity; a++) {
                args.push(allVars[randU32() % allVars.length]);
            }
            lines.push(`    ${target} ^= ${h.name}` + `(${args.join(', ')});`);
        } else if (allVars.length >= 2) {
            const target = allVars[randU32() % allVars.length];
            const source = allVars[randU32() % allVars.length];
            genRandomStatement(lines, target, source);
        }
    }

    if (retType === 'void') return;

    const retVar = locals.length ? locals[randU32() % locals.length] : '0';
    if (retType === 'uint64_t') {
        lines.push(
            `    return (uint64_t)${retVar} ` +
                `| ((uint64_t)0x${randU32().toString(16)}` +
                ` << 32);`
        );
    } else {
        lines.push(`    return (${retType})${retVar};`);
    }
}

function genRandomStatement(lines, target, source) {
    const ops = [
        () => {
            const shift = randRange(1, 15);
            return `${target} ^= ${source} >> ${shift};`;
        },
        () => {
            const mul = randU32();
            return `${target} += ${source} ` + `* 0x${mul.toString(16)};`;
        },
        () => {
            const s = randRange(1, 15);
            return `${target} = (${target} << ${s}) ` + `| (${target} >> ${32 - s});`;
        },
        () => `${target} -= ~${source};`,
        () => {
            const c = randU32();
            return `${target} = ${target} ` + `* 0x${c.toString(16)} + ${source};`;
        },
        () => `${target} ^= (${source} & 0xff) ` + `<< ${randRange(0, 24)};`,
        () => `${target} += ((${source} >> 16) ` + `^ (${source} << 16));`,
        () => {
            const mask = randU32();
            return `${target} &= ${source} ` + `| 0x${mask.toString(16)};`;
        },
        () => `${target} = (~${target}) ` + `^ (${source} + 1);`,
        () => {
            const c = randU32();
            return `${target} = (${target} ` + `+ 0x${c.toString(16)}) ` + `^ ${source};`;
        },
    ];
    const op = ops[randU32() % ops.length];
    lines.push(`    ${op()}`);
}

function genIfElseBlock(lines, vars) {
    const cond = vars[randU32() % vars.length];
    const mask = randU32();
    lines.push(
        `    if ((${cond} & 0x${mask.toString(16)}) ` + `> 0x${(randU32() % mask).toString(16)}) {`
    );
    const target = vars[randU32() % vars.length];
    const source = vars[randU32() % vars.length];
    for (let i = 0; i < randRange(2, 5); i++) {
        genRandomStatement(lines, target, source);
    }
    if (randU32() % 2 === 0) {
        lines.push('    } else {');
        for (let i = 0; i < randRange(2, 4); i++) {
            genRandomStatement(lines, source, target);
        }
    }
    lines.push('    }');
}

function genForLoop(lines, vars) {
    const iterName = randId(6);
    const bound = randRange(2, 8);
    const target = vars[randU32() % vars.length];
    const source = vars[randU32() % vars.length];
    lines.push(`    for (int ${iterName} = 0; ` + `${iterName} < ${bound}; ${iterName}++) {`);
    for (let i = 0; i < randRange(2, 4); i++) {
        genRandomStatement(lines, target, source);
    }
    lines.push('    }');
}

function genSwitchBlock(lines, vars) {
    const switchVar = vars[randU32() % vars.length];
    const caseCount = randRange(3, 8);
    lines.push(`    switch (${switchVar} & 0xf) {`);
    for (let c = 0; c < caseCount; c++) {
        lines.push(`    case ${c}:`);
        const target = vars[randU32() % vars.length];
        const source = vars[randU32() % vars.length];
        for (let i = 0; i < randRange(1, 3); i++) {
            genRandomStatement(lines, target, source);
        }
        lines.push('        break;');
    }
    lines.push('    default:');
    const dt = vars[randU32() % vars.length];
    const ds = vars[randU32() % vars.length];
    genRandomStatement(lines, dt, ds);
    lines.push('        break;');
    lines.push('    }');
}

function genAntiDebugHeader() {
    const guard = randMacroName(14);
    const lines = [`#ifndef ${guard}`, `#define ${guard}`, '#include <stdint.h>', ''];

    const originalNames = {
        antidbg_init: randId(14),
        antidbg_on_exec: randId(14),
        antidbg_check: randId(14),
        antidbg_state: randId(14),
    };

    for (const [orig, alias] of Object.entries(originalNames)) {
        lines.push(`#define ${orig} ${alias}`);
    }

    for (let i = 0; i < randRange(3, 6); i++) {
        const decoyMacro = randMacroName(12);
        const decoyVal = randRange(16, 255);
        lines.push(`#define ${decoyMacro} ` + `0x${decoyVal.toString(16).padStart(2, '0')}`);
    }

    const fnv1aAlias = randId(12);
    const nowMsAlias = randId(12);
    lines.push('');
    lines.push(`#define fnv1a ${fnv1aAlias}`);
    lines.push(`#define now_ms ${nowMsAlias}`);

    const stateVars = {
        g_call_seq: randId(14),
        g_exec_count: randId(14),
        g_last_ts: randId(14),
        g_integrity: randId(14),
    };

    lines.push('');
    for (const [orig, alias] of Object.entries(stateVars)) {
        lines.push(`#define ${orig} ${alias}`);
    }

    for (let i = 0; i < randRange(3, 6); i++) {
        const fakeMacro = randMacroName(12);
        const fakeVal = `0x${randU32().toString(16)}`;
        lines.push(`#define ${fakeMacro} ${fakeVal}`);
    }

    lines.push('');
    lines.push('#endif');

    return { header: lines.join('\n'), originalNames };
}

function genCryptoRenameHeader() {
    const guard = randMacroName(14);
    const lines = [`#ifndef ${guard}`, `#define ${guard}`, ''];

    const cryptoNames = {
        chacha20: randId(14),
        sha256: randId(14),
        hmac_sha256: randId(14),
        ct_compare: randId(14),
        chacha20_block: randId(14),
        rotl32: randId(12),
        load32_le: randId(12),
        store32_le: randId(12),
        load32_be: randId(12),
        store32_be: randId(12),
        sha256_transform: randId(14),
    };

    for (const [orig, alias] of Object.entries(cryptoNames)) {
        lines.push(`#define ${orig} ${alias}`);
    }

    lines.push('');
    lines.push('#endif');

    return { header: lines.join('\n'), cryptoNames };
}

function genBridgeRenameHeader() {
    const guard = randMacroName(14);
    const lines = [`#ifndef ${guard}`, `#define ${guard}`, ''];

    const bridgeNames = {
        js_vm_ts: randId(14),
        js_vm_integrity: randId(14),
        js_vm_check: randId(14),
        js_console_log: randId(14),
        register_intrinsics: randId(14),
        g_rt: randId(12),
        g_ctx: randId(12),
    };

    for (const [orig, alias] of Object.entries(bridgeNames)) {
        lines.push(`#define ${orig} ${alias}`);
    }

    lines.push('');
    lines.push('#endif');

    return { header: lines.join('\n'), bridgeNames };
}

function genControlFlowFlatteningHeader() {
    const guard = randMacroName(14);
    const lines = [`#ifndef ${guard}`, `#define ${guard}`, '#include <stdint.h>', ''];

    const stateVar = randId(14);
    const dispatchMacro = randMacroName(12);
    const blockLabels = [];
    for (let i = 0; i < randRange(8, 16); i++) {
        blockLabels.push(randMacroName(10));
    }

    lines.push(
        `#define ${dispatchMacro}(s) ` +
            `do { volatile uint32_t ${stateVar} = (s); ` +
            `switch(${stateVar}) {`
    );

    for (let i = 0; i < blockLabels.length; i++) {
        lines.push(`#define ${blockLabels[i]} ` + `case 0x${randU32().toString(16)}:`);
    }

    lines.push(`#define CF_END } } while(0)`);

    lines.push('');

    const opaqueTrue = randMacroName(10);
    const opaqueFalse = randMacroName(10);
    const opaqueVal = randU32();
    lines.push(`static volatile uint32_t ` + `${randId(12)} = 0x${opaqueVal.toString(16)};`);
    lines.push(`#define ${opaqueTrue} ` + `(${randId(12)} == ` + `0x${opaqueVal.toString(16)})`);
    lines.push(`#define ${opaqueFalse} ` + `(${randId(12)} != ` + `0x${opaqueVal.toString(16)})`);

    for (let i = 0; i < randRange(4, 8); i++) {
        const predName = randMacroName(10);
        const predVal = randU32();
        lines.push(
            `#define ${predName} ` +
                `((volatile uint32_t)` +
                `0x${predVal.toString(16)} ` +
                `${randU32() % 2 ? '>' : '<'} ` +
                `0x${randU32().toString(16)})`
        );
    }

    lines.push('');
    lines.push('#endif');
    return lines.join('\n');
}

function genFakeStringTable() {
    const lines = ['#include <stdint.h>', ''];

    const strings = [
        'initialization complete',
        'runtime error detected',
        'memory allocation failed',
        'invalid state transition',
        'context verification passed',
        'bytecode validation error',
        'integrity check successful',
        'session token expired',
        'decryption key mismatch',
        'signature verification failed',
        'buffer overflow detected',
        'stack corruption found',
        'heap integrity violated',
        'watchdog timer expired',
        'secure channel established',
    ];

    shuffle(strings);

    const tableName = randId(14);
    lines.push(`static const char* __attribute__((used)) ` + `${tableName}[] = {`);
    for (const s of strings.slice(0, randRange(6, 12))) {
        const encoded = Array.from(Buffer.from(s, 'utf-8'))
            .map((b) => `\\x${b.toString(16).padStart(2, '0')}`)
            .join('');
        lines.push(`    "${encoded}",`);
    }
    lines.push('};');
    lines.push('');

    for (let i = 0; i < randRange(3, 6); i++) {
        const funcName = randId(14);
        const paramName = randId(8);
        lines.push(
            `static const char* ` +
                `__attribute__((used)) ` +
                `${funcName}(uint32_t ${paramName}) {`
        );
        lines.push(`    return ${tableName}` + `[${paramName} % ${strings.length}];`);
        lines.push('}');
        lines.push('');
    }

    return lines.join('\n');
}

function genFakeStateEngine() {
    const lines = ['#include <stdint.h>', ''];

    const stateCount = randRange(6, 12);
    const engineName = randId(14);
    const stateVar = randId(12);
    const counterVar = randId(12);

    lines.push(`static volatile uint32_t ${stateVar} = ` + `0x${randU32().toString(16)};`);
    lines.push(`static volatile uint32_t ${counterVar} = 0;`);
    lines.push('');

    lines.push(
        `static uint32_t __attribute__((used)) ` +
            `${engineName}(` +
            `uint32_t ${randId(6)}, ` +
            `uint32_t ${randId(6)}) {`
    );

    lines.push(`    switch (${stateVar} & 0xf) {`);
    for (let s = 0; s < stateCount; s++) {
        const nextState = randU32();
        lines.push(`    case ${s}:`);
        lines.push(`        ${stateVar} = ` + `0x${nextState.toString(16)};`);
        lines.push(`        ${counterVar} += ` + `0x${randU32().toString(16)};`);
        lines.push('        break;');
    }
    lines.push('    default:');
    lines.push(`        ${stateVar} ^= ` + `0x${randU32().toString(16)};`);
    lines.push('        break;');
    lines.push('    }');
    lines.push(`    return ${stateVar} ^ ${counterVar};`);
    lines.push('}');

    return lines.join('\n');
}

const BASE_EXPORTS = ['vm_init', 'vm_destroy', 'vm_exec_bytecode', 'vm_free'];

function genExportMap() {
    const map = {};
    for (const name of BASE_EXPORTS) {
        map[name] = randId(12);
    }
    return map;
}

const exportMap = genExportMap();

function genExportsHeader() {
    const guard = randMacroName(14);
    const lines = [`#ifndef ${guard}`, `#define ${guard}`, ''];

    for (const [orig, alias] of Object.entries(exportMap)) {
        lines.push(`#define ${orig} ${alias}`);
    }

    lines.push('');
    lines.push('#endif');
    return lines.join('\n');
}

function genLoader() {
    const e = exportMap;
    const v = {
        magic: randId(8),
        nonceLen: randId(8),
        macLen: randId(8),
        mod: randId(8),
    };

    return `import QJSModule from './vm.js';

const ${v.magic} = 0x564d5250;
const ${v.nonceLen} = 12;
const ${v.macLen} = 32;

let ${v.mod} = null;

export async function initModule(wasmUrl) {
    const mod = await QJSModule({
        locateFile: () => wasmUrl,
    });
    ${v.mod} = mod;
    return mod;
}

export function vmInit() {
    return ${v.mod}._${e.vm_init}();
}

export function vmDestroy() {
    ${v.mod}._${e.vm_destroy}();
}

export function vmExec(bundleBytes) {
    const len = bundleBytes.length;
    const inPtr = ${v.mod}._malloc(len);
    ${v.mod}.HEAPU8.set(bundleBytes, inPtr);

    const outLenPtr = ${v.mod}._malloc(4);

    const outPtr = ${v.mod}._${e.vm_exec_bytecode}(
        inPtr, len, outLenPtr
    );

    ${v.mod}._free(inPtr);

    if (!outPtr) {
        ${v.mod}._free(outLenPtr);
        return null;
    }

    const outLen = ${v.mod}.HEAPU8[outLenPtr]
        | (${v.mod}.HEAPU8[outLenPtr + 1] << 8)
        | (${v.mod}.HEAPU8[outLenPtr + 2] << 16)
        | (${v.mod}.HEAPU8[outLenPtr + 3] << 24);
    ${v.mod}._free(outLenPtr);

    const resp = new Uint8Array(outLen);
    resp.set(
        ${v.mod}.HEAPU8.subarray(
            outPtr, outPtr + outLen
        )
    );

    ${v.mod}._${e.vm_free}(outPtr);
    return resp;
}

export function parseResponse(resp) {
    if (
        !resp
        || resp.length < 8 + ${v.nonceLen}
            + ${v.macLen}
    )
        return null;

    const magic = resp[0]
        | (resp[1] << 8)
        | (resp[2] << 16)
        | (resp[3] << 24);
    if (magic !== ${v.magic}) return null;

    const totalLen = resp[4]
        | (resp[5] << 8)
        | (resp[6] << 16)
        | (resp[7] << 24);

    const nonce = resp.subarray(
        8, 8 + ${v.nonceLen}
    );
    const ctLen = totalLen - 8
        - ${v.nonceLen} - ${v.macLen};
    const ct = resp.subarray(
        8 + ${v.nonceLen},
        8 + ${v.nonceLen} + ctLen
    );
    const mac = resp.subarray(
        8 + ${v.nonceLen} + ctLen,
        8 + ${v.nonceLen} + ctLen
            + ${v.macLen}
    );

    return { nonce, ciphertext: ct, mac };
}
`;
}

function genManifest() {
    return {
        buildId: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        keys: {
            decrypt: keyDecrypt.toString('hex'),
            encrypt: keyEncrypt.toString('hex'),
            sign: keySign.toString('hex'),
        },
        exports: exportMap,
    };
}

function main() {
    console.log('[build] Polymorphic WASM build starting...');

    fs.mkdirSync(BUILD, { recursive: true });
    fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(path.join(BUILD, 'vm_keys.h'), genKeysHeader());
    console.log('[build] Generated vm_keys.h');

    fs.writeFileSync(path.join(BUILD, 'vm_exports.h'), genExportsHeader());
    console.log('[build] Generated vm_exports.h');

    const { header: antidbgHdr } = genAntiDebugHeader();
    fs.writeFileSync(path.join(BUILD, 'vm_antidbg_rename.h'), antidbgHdr);
    console.log('[build] Generated antidbg renames');

    const { header: cryptoHdr } = genCryptoRenameHeader();
    fs.writeFileSync(path.join(BUILD, 'vm_crypto_rename.h'), cryptoHdr);
    console.log('[build] Generated crypto renames');

    const { header: bridgeHdr } = genBridgeRenameHeader();
    fs.writeFileSync(path.join(BUILD, 'vm_bridge_rename.h'), bridgeHdr);
    console.log('[build] Generated bridge renames');

    fs.writeFileSync(path.join(BUILD, 'vm_cflow.h'), genControlFlowFlatteningHeader());
    console.log('[build] Generated control flow header');

    const deadPath = path.join(BUILD, 'vm_deadcode.c');
    fs.writeFileSync(deadPath, genDeadCode());
    console.log('[build] Generated dead code');

    const stringsPath = path.join(BUILD, 'vm_fake_strings.c');
    fs.writeFileSync(stringsPath, genFakeStringTable());
    console.log('[build] Generated fake string table');

    const statePath = path.join(BUILD, 'vm_fake_state.c');
    fs.writeFileSync(statePath, genFakeStateEngine());
    console.log('[build] Generated fake state engine');

    const loaderPath = path.join(outDir, 'loader.js');
    fs.writeFileSync(loaderPath, genLoader());
    console.log('[build] Generated loader.js');

    const allExports = [...Object.values(exportMap).map((n) => `_${n}`), '_malloc', '_free'];
    const exportedFns = JSON.stringify(allExports);
    const exportedRt = '["UTF8ToString","HEAPU8"]';

    const qjsDir = path.join(ROOT, 'vendor', 'quickjs');
    const qjsSrcs = ['quickjs.c', 'cutils.c', 'libunicode.c', 'libregexp.c', 'dtoa.c']
        .map((f) => path.join(qjsDir, f))
        .join(' ');

    const ourSrcs = [
        path.join(SRC, 'vm_bridge.c'),
        path.join(SRC, 'vm_crypto.c'),
        path.join(SRC, 'vm_antidbg.c'),
        deadPath,
        stringsPath,
        statePath,
    ].join(' ');

    const renameIncludes = [
        `-include ${path.join(BUILD, 'vm_antidbg_rename.h')}`,
        `-include ${path.join(BUILD, 'vm_crypto_rename.h')}`,
        `-include ${path.join(BUILD, 'vm_bridge_rename.h')}`,
        `-include ${path.join(BUILD, 'vm_cflow.h')}`,
    ].join(' ');

    const emccFlags = [
        '-O3',
        '-flto',
        `-DCONFIG_VERSION=\\"${new Date().toISOString().slice(0, 10)}\\"`,
        '-DEMSCRIPTEN',
        '-D_GNU_SOURCE',
        '-DNO_POPEN',
        `-DBUILD_SEED=${randU32()}`,
        `-DBUILD_ENTROPY_A=0x${randU32().toString(16)}`,
        `-DBUILD_ENTROPY_B=0x${randU32().toString(16)}`,
        `-DBUILD_ENTROPY_C=0x${randU32().toString(16)}`,
        '-s WASM=1',
        '-s MODULARIZE=1',
        '-s EXPORT_ES6=1',
        '-s EXPORT_NAME="QJSModule"',
        '-s ALLOW_MEMORY_GROWTH=0',
        '-s INITIAL_MEMORY=16777216',
        '-s STACK_SIZE=524288',
        '-s NO_EXIT_RUNTIME=1',
        '-s NO_FILESYSTEM=1',
        '-s ENVIRONMENT=web',
        `-s EXPORTED_FUNCTIONS='${exportedFns}'`,
        `-s EXPORTED_RUNTIME_METHODS='${exportedRt}'`,
        '--closure 1',
    ].join(' ');

    const includes = `-I${qjsDir} -I${BUILD} ${renameIncludes}`;
    const output = path.join(outDir, 'vm.js');

    const emcc = process.env.EMCC
        || '/opt/emsdk/upstream/emscripten/emcc';
    const cmd = `${emcc} ${emccFlags} ${includes} `
        + `${qjsSrcs} ${ourSrcs} -o ${output}`;

    console.log('[build] Compiling WASM...');
    try {
        execSync(cmd, {
            cwd: ROOT,
            stdio: 'inherit',
            timeout: 300000,
        });
    } catch (e) {
        console.error('[build] Compilation failed');
        process.exit(1);
    }

    const manifest = genManifest();
    fs.writeFileSync(path.join(BUILD, 'manifest.json'), JSON.stringify(manifest, null, 2));
    console.log('[build] Manifest written');
    console.log('[build] Done. Build ID:', manifest.buildId);
    console.log('[build] Output:', outDir);
}

main();
