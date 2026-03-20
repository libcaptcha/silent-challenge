async function QJSModule(moduleArg = {}) {
    var moduleRtn;
    var d = moduleArg,
        h = import.meta.url,
        k = '',
        l;
    try {
        k = new URL('.', h).href;
    } catch {}
    l = async (a) => {
        a = await fetch(a, { credentials: 'same-origin' });
        if (a.ok) return a.arrayBuffer();
        throw Error(a.status + ' : ' + a.url);
    };
    var n = console.error.bind(console),
        p,
        q = !1,
        r,
        t,
        u,
        v,
        w,
        x,
        y,
        z,
        A = !1;
    function B(a) {
        d.onAbort?.(a);
        a = 'Aborted(' + a + ')';
        n(a);
        q = !0;
        a = new WebAssembly.RuntimeError(a + '. Build with -sASSERTIONS for more info.');
        u?.(a);
        throw a;
    }
    var C;
    async function D(a) {
        if (!p)
            try {
                var b = await l(a);
                return new Uint8Array(b);
            } catch {}
        if (a == C && p) a = new Uint8Array(p);
        else throw 'both async and sync fetching of the wasm failed';
        return a;
    }
    async function E(a, b) {
        try {
            var c = await D(a);
            return await WebAssembly.instantiate(c, b);
        } catch (e) {
            (n(`failed to asynchronously prepare wasm: ${e}`), B(e));
        }
    }
    async function F(a) {
        var b = C;
        if (!p)
            try {
                var c = fetch(b, { credentials: 'same-origin' });
                return await WebAssembly.instantiateStreaming(c, a);
            } catch (e) {
                (n(`wasm streaming compile failed: ${e}`),
                    n('falling back to ArrayBuffer instantiation'));
            }
        return E(b, a);
    }
    class G {
        name = 'ExitStatus';
        constructor(a) {
            this.message = `Program terminated with exit(${a})`;
            this.status = a;
        }
    }
    var H = (a) => {
            for (; 0 < a.length; ) a.shift()(d);
        },
        I = [],
        J = [],
        K = () => {
            var a = d.preRun.shift();
            J.push(a);
        },
        L = !0,
        M = globalThis.TextDecoder && new TextDecoder(),
        N = (a = 0, b, c) => {
            var e = v;
            var f = a;
            b = f + b;
            if (c) c = b;
            else {
                for (; e[f] && !(f >= b); ) ++f;
                c = f;
            }
            if (16 < c - a && e.buffer && M) return M.decode(e.subarray(a, c));
            for (f = ''; a < c; )
                if (((b = e[a++]), b & 128)) {
                    var g = e[a++] & 63;
                    if (192 == (b & 224)) f += String.fromCharCode(((b & 31) << 6) | g);
                    else {
                        var m = e[a++] & 63;
                        b =
                            224 == (b & 240)
                                ? ((b & 15) << 12) | (g << 6) | m
                                : ((b & 7) << 18) | (g << 12) | (m << 6) | (e[a++] & 63);
                        65536 > b
                            ? (f += String.fromCharCode(b))
                            : ((b -= 65536),
                              (f += String.fromCharCode(55296 | (b >> 10), 56320 | (b & 1023))));
                    }
                } else f += String.fromCharCode(b);
            return f;
        },
        O = 0,
        aa = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335],
        ba = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334],
        P = {},
        Q = (a) => {
            if (!(a instanceof G || 'unwind' == a)) throw a;
        },
        R = (a) => {
            r = a;
            L || 0 < O || (d.onExit?.(a), (q = !0));
            throw new G(a);
        },
        ca = (a) => {
            if (!q)
                try {
                    a();
                } catch (b) {
                    Q(b);
                } finally {
                    if (!(L || 0 < O))
                        try {
                            ((r = a = r), R(a));
                        } catch (b) {
                            Q(b);
                        }
                }
        },
        S = (a, b) => {
            for (var c = v, e = b + 17 - 1, f = 0; f < a.length; ++f) {
                var g = a.codePointAt(f);
                if (127 >= g) {
                    if (b >= e) break;
                    c[b++] = g;
                } else if (2047 >= g) {
                    if (b + 1 >= e) break;
                    c[b++] = 192 | (g >> 6);
                    c[b++] = 128 | (g & 63);
                } else if (65535 >= g) {
                    if (b + 2 >= e) break;
                    c[b++] = 224 | (g >> 12);
                    c[b++] = 128 | ((g >> 6) & 63);
                    c[b++] = 128 | (g & 63);
                } else {
                    if (b + 3 >= e) break;
                    c[b++] = 240 | (g >> 18);
                    c[b++] = 128 | ((g >> 12) & 63);
                    c[b++] = 128 | ((g >> 6) & 63);
                    c[b++] = 128 | (g & 63);
                    f++;
                }
            }
            c[b] = 0;
        },
        T = [],
        V = (a, b) => {
            T.length = 0;
            for (var c; (c = v[a++]); ) {
                var e = 105 != c;
                e &= 112 != c;
                b += e && b % 8 ? 4 : 0;
                T.push(
                    112 == c ? x[b >> 2] : 106 == c ? z[b >> 3] : 105 == c ? w[b >> 2] : y[b >> 3]
                );
                b += e ? 8 : 4;
            }
            return T;
        };
    d.noExitRuntime && (L = d.noExitRuntime);
    d.printErr && (n = d.printErr);
    d.wasmBinary && (p = d.wasmBinary);
    if (d.preInit)
        for ('function' == typeof d.preInit && (d.preInit = [d.preInit]); 0 < d.preInit.length; )
            d.preInit.shift()();
    d.UTF8ToString = (a, b, c) => (a ? N(a, b, c) : '');
    var W = {
            103980: () => Date.now(),
            104003: (a) => {
                console.log(a ? N(a) : '');
            },
            104038: () => Date.now(),
            104061: () => Date.now(),
        },
        X,
        Y,
        da = {
            a: (a, b, c, e) =>
                B(
                    `Assertion failed: ${a ? N(a) : ''}, at: ` +
                        [
                            b ? (b ? N(b) : '') : 'unknown filename',
                            c,
                            e ? (e ? N(e) : '') : 'unknown function',
                        ]
                ),
            i: () => B(''),
            c: () => {
                L = !1;
                O = 0;
            },
            f: function (a, b) {
                a = -9007199254740992 > a || 9007199254740992 < a ? NaN : Number(a);
                a = new Date(1e3 * a);
                w[b >> 2] = a.getSeconds();
                w[(b + 4) >> 2] = a.getMinutes();
                w[(b + 8) >> 2] = a.getHours();
                w[(b + 12) >> 2] = a.getDate();
                w[(b + 16) >> 2] = a.getMonth();
                w[(b + 20) >> 2] = a.getFullYear() - 1900;
                w[(b + 24) >> 2] = a.getDay();
                var c = a.getFullYear();
                w[(b + 28) >> 2] =
                    ((0 !== c % 4 || (0 === c % 100 && 0 !== c % 400) ? ba : aa)[a.getMonth()] +
                        a.getDate() -
                        1) |
                    0;
                w[(b + 36) >> 2] = -(60 * a.getTimezoneOffset());
                c = new Date(a.getFullYear(), 6, 1).getTimezoneOffset();
                var e = new Date(a.getFullYear(), 0, 1).getTimezoneOffset();
                w[(b + 32) >> 2] = (c != e && a.getTimezoneOffset() == Math.min(e, c)) | 0;
            },
            d: (a, b) => {
                P[a] && (clearTimeout(P[a].id), delete P[a]);
                if (!b) return 0;
                var c = setTimeout(() => {
                    delete P[a];
                    ca(() => X(a, performance.now()));
                }, b);
                P[a] = { id: c, u: b };
                return 0;
            },
            g: (a, b, c, e) => {
                var f = new Date().getFullYear(),
                    g = new Date(f, 0, 1).getTimezoneOffset();
                f = new Date(f, 6, 1).getTimezoneOffset();
                x[a >> 2] = 60 * Math.max(g, f);
                w[b >> 2] = Number(g != f);
                b = (m) => {
                    var U = Math.abs(m);
                    return `UTC${0 <= m ? '-' : '+'}${String(Math.floor(U / 60)).padStart(2, '0')}${String(U % 60).padStart(2, '0')}`;
                };
                a = b(g);
                b = b(f);
                f < g ? (S(a, c), S(b, e)) : (S(a, e), S(b, c));
            },
            b: (a, b, c) => {
                b = V(b, c);
                return W[a](...b);
            },
            j: (a, b, c) => {
                b = V(b, c);
                return W[a](...b);
            },
            h: () => Date.now(),
            e: () => {
                B('OOM');
            },
            k: R,
        },
        Z;
    Z = await (async function () {
        function a(c) {
            c = Z = c.exports;
            d._malloc = c.n;
            d._free = c.o;
            d.__internal_lsjqcludyilw = c.p;
            d.__wbcoxmpdjfzt = c.q;
            d._g_ypidheeeluui = c.r;
            d._g_rpoppnpgwiqz = c.s;
            X = c.t;
            Y = c.l;
            c = Y.buffer;
            new Int8Array(c);
            new Int16Array(c);
            d.HEAPU8 = v = new Uint8Array(c);
            new Uint16Array(c);
            w = new Int32Array(c);
            x = new Uint32Array(c);
            new Float32Array(c);
            y = new Float64Array(c);
            z = new BigInt64Array(c);
            new BigUint64Array(c);
            return Z;
        }
        var b = { a: da };
        if (d.instantiateWasm)
            return new Promise((c) => {
                d.instantiateWasm(b, (e, f) => {
                    c(a(e, f));
                });
            });
        C ??= d.locateFile
            ? d.locateFile
                ? d.locateFile('vm.wasm', k)
                : k + 'vm.wasm'
            : new URL('vm.wasm', import.meta.url).href;
        return a((await F(b)).instance);
    })();
    (function () {
        function a() {
            d.calledRun = !0;
            if (!q) {
                A = !0;
                Z.m();
                t?.(d);
                d.onRuntimeInitialized?.();
                if (d.postRun)
                    for (
                        'function' == typeof d.postRun && (d.postRun = [d.postRun]);
                        d.postRun.length;
                    ) {
                        var b = d.postRun.shift();
                        I.push(b);
                    }
                H(I);
            }
        }
        if (d.preRun)
            for ('function' == typeof d.preRun && (d.preRun = [d.preRun]); d.preRun.length; ) K();
        H(J);
        d.setStatus
            ? (d.setStatus('Running...'),
              setTimeout(() => {
                  setTimeout(() => d.setStatus(''), 1);
                  a();
              }, 1))
            : a();
    })();
    A
        ? (moduleRtn = d)
        : (moduleRtn = new Promise((a, b) => {
              t = a;
              u = b;
          }));
    return moduleRtn;
}
export default QJSModule;
