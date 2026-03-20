import QJSModule from './vm.js';

const m_hrajclld = 0x564d5250;
const m_qqxeckrn = 12;
const g_blhsahfr = 32;

let __zuydikqo = null;

export async function initModule(wasmUrl) {
    const mod = await QJSModule({
        locateFile: () => wasmUrl,
    });
    __zuydikqo = mod;
    return mod;
}

export function vmInit() {
    return __zuydikqo.__internal_lsjqcludyilw();
}

export function vmDestroy() {
    __zuydikqo.__wbcoxmpdjfzt();
}

export function vmExec(bundleBytes) {
    const len = bundleBytes.length;
    const inPtr = __zuydikqo._malloc(len);
    __zuydikqo.HEAPU8.set(bundleBytes, inPtr);

    const outLenPtr = __zuydikqo._malloc(4);

    const outPtr = __zuydikqo._g_ypidheeeluui(
        inPtr, len, outLenPtr
    );

    __zuydikqo._free(inPtr);

    if (!outPtr) {
        __zuydikqo._free(outLenPtr);
        return null;
    }

    const outLen = __zuydikqo.HEAPU8[outLenPtr]
        | (__zuydikqo.HEAPU8[outLenPtr + 1] << 8)
        | (__zuydikqo.HEAPU8[outLenPtr + 2] << 16)
        | (__zuydikqo.HEAPU8[outLenPtr + 3] << 24);
    __zuydikqo._free(outLenPtr);

    const resp = new Uint8Array(outLen);
    resp.set(
        __zuydikqo.HEAPU8.subarray(
            outPtr, outPtr + outLen
        )
    );

    __zuydikqo._g_rpoppnpgwiqz(outPtr);
    return resp;
}

export function parseResponse(resp) {
    if (
        !resp
        || resp.length < 8 + m_qqxeckrn
            + g_blhsahfr
    )
        return null;

    const magic = resp[0]
        | (resp[1] << 8)
        | (resp[2] << 16)
        | (resp[3] << 24);
    if (magic !== m_hrajclld) return null;

    const totalLen = resp[4]
        | (resp[5] << 8)
        | (resp[6] << 16)
        | (resp[7] << 24);

    const nonce = resp.subarray(
        8, 8 + m_qqxeckrn
    );
    const ctLen = totalLen - 8
        - m_qqxeckrn - g_blhsahfr;
    const ct = resp.subarray(
        8 + m_qqxeckrn,
        8 + m_qqxeckrn + ctLen
    );
    const mac = resp.subarray(
        8 + m_qqxeckrn + ctLen,
        8 + m_qqxeckrn + ctLen
            + g_blhsahfr
    );

    return { nonce, ciphertext: ct, mac };
}
