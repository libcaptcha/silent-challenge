function safe(fn, fallback) {
    try {
        return fn();
    } catch {
        return fallback;
    }
}

function hasProp(object, prop) {
    try {
        return prop in object;
    } catch {
        return false;
    }
}

function isNative(fn) {
    try {
        return Function.prototype.toString
            .call(fn).includes('[native code]');
    } catch {
        return false;
    }
}

function getDescriptor(object, prop) {
    try {
        return Object.getOwnPropertyDescriptor(
            object, prop
        );
    } catch {
        return null;
    }
}

const SIGNAL_CATEGORIES = [
    'automation',
    'browser',
    'properties',
    'natives',
    'features',
    'navigator',
    'screen',
    'engine',
    'mediaQueries',
    'environment',
    'timing',
    'webgl',
    'canvas',
    'fonts',
    'headless',
    'vm',
    'consistency',
    'devtools',
    'cdp',
    'cssVersion',
    'voices',
    'performance',
    'prototype',
    'drawing',
];

function collectAutomation() {
    const w = globalThis.window || {};
    const n = globalThis.navigator || {};
    const d = globalThis.document || {};

    let globals = 0;
    try {
        if (n.webdriver) globals |= 1;
    } catch {}
    try {
        if (w.__nightmare) globals |= 1 << 1;
    } catch {}
    try {
        if (w._phantom || w.callPhantom)
            globals |= 1 << 2;
    } catch {}
    try {
        if (w.__selenium_unwrapped) globals |= 1 << 3;
    } catch {}
    try {
        if (w._Selenium_IDE_Recorder)
            globals |= 1 << 4;
    } catch {}
    try {
        if (w.domAutomation) globals |= 1 << 5;
    } catch {}
    try {
        if (w.domAutomationController)
            globals |= 1 << 6;
    } catch {}
    try {
        if (
            d.__webdriver_evaluate ||
            w.__webdriver_evaluate
        )
            globals |= 1 << 7;
    } catch {}
    try {
        if (w.__selenium_evaluate)
            globals |= 1 << 8;
    } catch {}
    try {
        if (w.__fxdriver_evaluate)
            globals |= 1 << 9;
    } catch {}
    try {
        if (w.__webdriver_unwrapped)
            globals |= 1 << 10;
    } catch {}
    try {
        if (w.__webdriver_script_fn)
            globals |= 1 << 11;
    } catch {}
    try {
        if (w.Cypress || w.__cypress)
            globals |= 1 << 12;
    } catch {}
    try {
        if (
            w.__playwright_evaluate ||
            w.__playwright_resume ||
            w.playwright
        )
            globals |= 1 << 13;
    } catch {}
    try {
        if (
            w.__playwright__binding__ ||
            w.__pwInitScripts
        )
            globals |= 1 << 14;
    } catch {}
    try {
        const ua = n.userAgent || '';
        if (ua.includes('HeadlessChrome'))
            globals |= 1 << 15;
    } catch {}
    try {
        const ua = (n.userAgent || '').toLowerCase();
        if (w._headless || ua.includes('headless'))
            globals |= 1 << 16;
    } catch {}
    try {
        if (w.Buffer && typeof w.Buffer === 'function')
            globals |= 1 << 17;
    } catch {}

    let enhanced = 0;
    try {
        const desc = getDescriptor(n, 'webdriver');
        if (desc) {
            enhanced |= 1;
            if (typeof desc.get === 'function')
                enhanced |= 1 << 1;
            if ('value' in desc)
                enhanced |= 1 << 2;
            if (desc.configurable)
                enhanced |= 1 << 3;
            if (desc.enumerable)
                enhanced |= 1 << 4;
        }
    } catch {}
    try {
        const cdcPattern =
            /^cdc_|^\$cdc_|_Array$|_Promise$|_Symbol$|_Object$|_Proxy$/;
        if (
            Object.keys(w).some(
                (k) => cdcPattern.test(k)
            )
        )
            enhanced |= 1 << 5;
    } catch {}
    try {
        if (
            w.__cdp_binding__ ||
            w.__chromeSendMessage
        )
            enhanced |= 1 << 6;
    } catch {}
    try {
        throw new Error('x');
    } catch (error) {
        try {
            const stack = error.stack || '';
            if (
                /selenium|webdriver|puppeteer|playwright|cypress/i
                    .test(stack)
            )
                enhanced |= 1 << 7;
        } catch {}
    }
    try {
        const proto = Object.getPrototypeOf(n);
        const desc = getDescriptor(
            proto, 'webdriver'
        );
        if (desc?.get && !isNative(desc.get))
            enhanced |= 1 << 9;
    } catch {}
    try {
        if (
            d.querySelector(
                '[selenium],[webdriver],[driver]'
            )
        )
            enhanced |= 1 << 10;
    } catch {}
    try {
        const fnToString =
            Function.prototype.toString.call(
                Function.prototype.toString
            );
        if (!fnToString.includes('[native code]'))
            enhanced |= 1 << 11;
    } catch {}
    try {
        const attr =
            d.documentElement?.getAttribute(
                'webdriver'
            );
        if (attr) enhanced |= 1 << 13;
    } catch {}
    try {
        if (
            Object.getOwnPropertyNames(n)
                .includes('webdriver')
        )
            enhanced |= 1 << 15;
    } catch {}

    let extra = 0;
    try {
        if (w.awesomium) extra |= 1;
    } catch {}
    try {
        if (w.RunPerfTest) extra |= 1 << 1;
    } catch {}
    try {
        if (w.CefSharp) extra |= 1 << 2;
    } catch {}
    try {
        if (w.emit && typeof w.emit === 'function')
            extra |= 1 << 3;
    } catch {}
    try {
        if (w.fmget_targets) extra |= 1 << 4;
    } catch {}
    try {
        if (w.geb) extra |= 1 << 5;
    } catch {}
    try {
        if (w.__phantomas) extra |= 1 << 6;
    } catch {}
    try {
        if (w.spawn) extra |= 1 << 7;
    } catch {}
    try {
        if (w.wdioElectron) extra |= 1 << 8;
    } catch {}
    try {
        if (w._selenium || w.calledSelenium)
            extra |= 1 << 9;
    } catch {}
    try {
        if (
            w._WEBDRIVER_ELEM_CACHE ||
            w.ChromeDriverw
        )
            extra |= 1 << 10;
    } catch {}
    try {
        if (
            d.__driver_evaluate ||
            d.__driver_unwrapped
        )
            extra |= 1 << 11;
    } catch {}
    try {
        if (
            d.__webdriver_script_func ||
            w.$chrome_asyncScriptInfo ||
            w.__$webdriverAsyncExecutor
        )
            extra |= 1 << 12;
    } catch {}
    try {
        if (
            w.process &&
            (w.process.type === 'renderer' ||
                w.process.versions?.electron)
        )
            extra |= 1 << 13;
    } catch {}
    try {
        if (
            w.external &&
            /Sequentum/i.test(String(w.external))
        )
            extra |= 1 << 14;
    } catch {}
    try {
        const pattern =
            /^([a-z]){3}_.*_(Array|Promise|Symbol)$/;
        if (
            Object.keys(w).some(
                (k) => pattern.test(k)
            )
        )
            extra |= 1 << 15;
    } catch {}
    try {
        if (
            /Headless|Electron|SlimerJS/i.test(
                n.appVersion || ''
            )
        )
            extra |= 1 << 16;
    } catch {}

    return { globals, enhanced, extra };
}

function collectBrowserAPIs() {
    const w = globalThis.window || {};
    const n = globalThis.navigator || {};
    const d = globalThis.document || {};
    const ua = safe(() => n.userAgent || '', '');

    let selenium = 0;
    try {
        if (
            Object.keys(w).some(
                (k) =>
                    k.startsWith('$cdc_') ||
                    k.startsWith('cdc_')
            )
        )
            selenium |= 1;
    } catch {}
    try {
        if (
            hasProp(w, '__selenium_unwrapped') ||
            hasProp(w, '__selenium_evaluate')
        )
            selenium |= 1 << 1;
    } catch {}
    try {
        if (n.plugins) {
            if (
                n.plugins.length === 0 &&
                !/mobile|android/i.test(ua)
            )
                selenium |= 1 << 2;
            if (
                Object.prototype.toString.call(
                    n.plugins
                ) !== '[object PluginArray]'
            )
                selenium |= 1 << 3;
            if (
                typeof n.plugins.refresh !==
                'function'
            )
                selenium |= 1 << 4;
        }
    } catch {}
    try {
        if (
            Object.prototype.toString.call(
                n.mimeTypes
            ) !== '[object MimeTypeArray]'
        )
            selenium |= 1 << 5;
    } catch {}
    try {
        if (
            n.permissions?.query &&
            !isNative(n.permissions.query)
        )
            selenium |= 1 << 6;
    } catch {}
    try {
        if (w.chrome) {
            const hasCsi =
                typeof w.chrome.csi === 'function';
            const hasLoadTimes =
                typeof w.chrome.loadTimes ===
                'function';
            if (
                w.chrome.runtime &&
                !hasCsi &&
                !hasLoadTimes
            )
                selenium |= 1 << 7;
        }
    } catch {}
    try {
        if (
            w.outerWidth === 0 ||
            w.outerHeight === 0
        )
            selenium |= 1 << 10;
    } catch {}
    try {
        if (
            !hasProp(w, 'speechSynthesis') &&
            /Chrome/.test(ua)
        )
            selenium |= 1 << 11;
    } catch {}
    try {
        const canvas = d.createElement('canvas');
        const gl =
            canvas.getContext('webgl') ||
            canvas.getContext('experimental-webgl');
        if (gl) {
            const dbg = gl.getExtension(
                'WEBGL_debug_renderer_info'
            );
            if (dbg) {
                const renderer =
                    gl.getParameter(
                        dbg.UNMASKED_RENDERER_WEBGL
                    ) || '';
                if (
                    /SwiftShader|llvmpipe|softpipe/i
                        .test(renderer)
                )
                    selenium |= 1 << 12;
            }
        }
    } catch {}

    let stealth = 0;
    try {
        if (
            Object.getOwnPropertyNames(n)
                .includes('webdriver')
        )
            stealth |= 1 << 1;
    } catch {}
    try {
        const stack = new Error().stack || '';
        if (
            /pptr:|__puppeteer_evaluation_script__/
                .test(stack)
        )
            stealth |= 1 << 2;
    } catch {}
    try {
        const timestamps = [];
        for (let i = 0; i < 10; i++)
            timestamps.push(performance.now());
        const diffs = [];
        for (let j = 1; j < timestamps.length; j++)
            diffs.push(
                timestamps[j] - timestamps[j - 1]
            );
        if (
            diffs.every((x) => x === diffs[0]) &&
            diffs[0] > 0
        )
            stealth |= 1 << 3;
    } catch {}
    try {
        if (
            !hasProp(w, 'PerformanceObserver') &&
            /Chrome/.test(ua)
        )
            stealth |= 1 << 4;
    } catch {}
    try {
        if (
            !n.mediaDevices &&
            /Chrome/.test(ua) &&
            !/Android/.test(ua)
        )
            stealth |= 1 << 6;
    } catch {}
    try {
        if (n.connection?.rtt === 0)
            stealth |= 1 << 7;
    } catch {}
    try {
        if (
            /Chrome/.test(ua) &&
            w.chrome &&
            !w.chrome.app
        )
            stealth |= 1 << 8;
    } catch {}
    try {
        if (
            Object.keys(d).some(
                (k) =>
                    k.includes('cdc') ||
                    k.includes('selenium')
            )
        )
            stealth |= 1 << 9;
    } catch {}
    try {
        const proto = Object.getPrototypeOf(n);
        const desc = getDescriptor(
            proto, 'webdriver'
        );
        if (desc?.get) {
            const src = desc.get.toString();
            if (
                src.length < 30 ||
                /return\s*(false|!1)/.test(src)
            )
                stealth |= 1 << 10;
        }
    } catch {}
    try {
        if (
            !w.clientInformation &&
            /Chrome/.test(ua)
        )
            stealth |= 1 << 12;
    } catch {}
    try {
        if (hasProp(n, 'deviceMemory')) {
            const valid = [
                0.25, 0.5, 1, 2, 4,
                8, 16, 32, 64,
            ];
            if (!valid.includes(n.deviceMemory))
                stealth |= 1 << 14;
        }
    } catch {}

    let advanced = 0;
    try {
        const proto = Object.getPrototypeOf(n);
        const desc = getDescriptor(
            proto, 'webdriver'
        );
        if (
            desc?.get &&
            desc.get.call(n) === undefined
        )
            advanced |= 1;
    } catch {}
    try {
        const mq =
            w.matchMedia?.('(pointer: fine)');
        if (
            mq &&
            !mq.matches &&
            !hasProp(w, 'ontouchstart')
        )
            advanced |= 1 << 2;
    } catch {}
    try {
        if (
            hasProp(w, 'Notification') &&
            !isNative(w.Notification)
        )
            advanced |= 1 << 3;
    } catch {}
    try {
        const entries =
            performance.getEntriesByType(
                'navigation'
            );
        if (entries.length > 0) {
            if (
                entries[0]
                    .domContentLoadedEventStart
                    === 0
            )
                advanced |= 1 << 4;
            if (
                entries[0].loadEventStart === 0 &&
                d.readyState === 'complete'
            )
                advanced |= 1 << 5;
        }
    } catch {}
    try {
        const cdcProps =
            Object.getOwnPropertyNames(w).filter(
                (p) =>
                    /cdc|_selenium|_webdriver|\$cdc|domAutomation/
                        .test(p)
            );
        if (cdcProps.length > 0)
            advanced |= 1 << 7;
    } catch {}
    try {
        if (
            !hasProp(w, 'SharedWorker') &&
            /Chrome/.test(ua)
        )
            advanced |= 1 << 10;
    } catch {}
    try {
        const chromeVersionPattern =
            /Chrome\/[89]\d|Chrome\/1[0-2]\d/;
        if (
            !hasProp(n, 'usb') &&
            chromeVersionPattern.test(ua)
        )
            advanced |= 1 << 12;
        if (
            !hasProp(n, 'serial') &&
            chromeVersionPattern.test(ua)
        )
            advanced |= 1 << 13;
        if (
            !hasProp(n, 'hid') &&
            chromeVersionPattern.test(ua)
        )
            advanced |= 1 << 14;
    } catch {}

    let apis = 0;
    try {
        apis |= hasProp(w, 'chrome') ? 1 : 0;
    } catch {}
    try {
        apis |=
            (hasProp(n, 'permissions') ? 1 : 0)
            << 1;
    } catch {}
    try {
        apis |=
            (n.languages && n.languages.length > 0
                ? 1 : 0) << 2;
    } catch {}
    try {
        apis |= (n.connection ? 1 : 0) << 3;
    } catch {}
    try {
        apis |=
            (hasProp(n, 'getBattery') ? 1 : 0)
            << 4;
    } catch {}
    try {
        apis |=
            (hasProp(n, 'bluetooth') ? 1 : 0)
            << 5;
    } catch {}
    try {
        apis |=
            (hasProp(n, 'usb') ? 1 : 0) << 6;
    } catch {}
    try {
        apis |=
            (hasProp(n, 'serial') ? 1 : 0) << 7;
    } catch {}

    return { apis, selenium, stealth, advanced };
}

function collectPropertyIntegrity() {
    const n = globalThis.navigator || {};
    let integrity = 0;
    let overrides = 0;
    let protoInconsistency = 0;

    try {
        integrity |=
            isNative(Object.defineProperty)
                ? 1 : 0;
    } catch {}
    try {
        integrity |=
            (isNative(
                Object.getOwnPropertyDescriptor
            ) ? 1 : 0) << 1;
    } catch {}
    try {
        if (typeof Reflect !== 'undefined')
            integrity |=
                (isNative(Reflect.get) ? 1 : 0)
                << 2;
    } catch {}
    try {
        integrity |=
            (n.toString() !==
                '[object Navigator]' ? 1 : 0)
            << 10;
    } catch {
        integrity |= 1 << 11;
    }
    try {
        integrity |=
            (n[Symbol.toStringTag] !== 'Navigator'
                ? 1 : 0) << 13;
    } catch {}
    try {
        const props = [
            'userAgent', 'platform',
            'languages', 'plugins', 'webdriver',
        ];
        const proto = Object.getPrototypeOf(n);
        for (const prop of props) {
            const desc = getDescriptor(
                proto, prop
            );
            if (
                desc?.get &&
                !isNative(desc.get)
            ) {
                integrity |= 1 << 14;
                break;
            }
        }
    } catch {}
    try {
        if (typeof Reflect !== 'undefined')
            integrity |=
                (!isNative(Reflect.get) ? 1 : 0)
                << 15;
    } catch {}

    try {
        const proto = Object.getPrototypeOf(n);
        if (proto.constructor.name !== 'Navigator')
            protoInconsistency++;
    } catch {}

    const checkProps = [
        'webdriver', 'plugins', 'languages',
        'platform', 'userAgent',
    ];
    for (const prop of checkProps) {
        try {
            const desc = getDescriptor(n, prop);
            if (desc) {
                if (
                    desc.get &&
                    !isNative(desc.get)
                )
                    overrides++;
                else if ('value' in desc)
                    overrides++;
            }
        } catch {}
    }

    return {
        integrity,
        overrides,
        protoInconsistency,
    };
}

function collectNativeFunctions() {
    const w = globalThis.window || {};
    let bitmap = 0;
    const targets = [
        [Function.prototype.toString, 0],
        [w.setTimeout, 1],
        [w.setInterval, 2],
        [Date.now, 3],
        [Math.random, 4],
        [Array.prototype.push, 5],
        [JSON.stringify, 6],
        [Object.keys, 7],
        [Promise.resolve, 8],
        [Array.from, 9],
    ];
    try {
        targets.push([Reflect.get, 10]);
    } catch {}
    try {
        targets.push([console.log, 11]);
    } catch {}

    for (const [fn, bit] of targets) {
        try {
            bitmap |=
                (isNative(fn) ? 1 : 0) << bit;
        } catch {}
    }
    return bitmap;
}

function collectFeatures() {
    const w = globalThis.window || {};
    let bits = 0;
    const features = [
        ['localStorage', 0],
        ['sessionStorage', 1],
        ['WebSocket', 2],
        ['WebGLRenderingContext', 3],
        ['WebGL2RenderingContext', 4],
        ['indexedDB', 6],
        ['Notification', 7],
        ['fetch', 8],
        ['Promise', 9],
        ['Intl', 10],
        ['SharedArrayBuffer', 11],
        ['SharedWorker', 12],
        ['BroadcastChannel', 13],
        ['PerformanceObserver', 14],
        ['IntersectionObserver', 15],
    ];
    for (const [name, bit] of features) {
        bits |=
            (hasProp(w, name) ? 1 : 0) << bit;
    }
    try {
        bits |=
            (typeof WebAssembly === 'object'
                ? 1 : 0) << 5;
    } catch {}
    return bits;
}

function collectNavigatorProps() {
    const n = globalThis.navigator || {};
    const result = {
        ua: safe(
            () => n.userAgent || '', ''
        ),
        platform: safe(
            () => n.platform || '', ''
        ),
        pluginCount: safe(
            () => n.plugins?.length ?? 0, 0
        ),
        languageCount: safe(
            () => n.languages?.length ?? 0, 0
        ),
        languages: safe(
            () =>
                n.languages
                    ? Array.from(n.languages)
                    : [],
            []
        ),
        cookieEnabled: safe(
            () => !!n.cookieEnabled, false
        ),
        doNotTrack: safe(
            () => n.doNotTrack || '', ''
        ),
        hardwareConcurrency: safe(
            () => n.hardwareConcurrency || 0, 0
        ),
        deviceMemory: safe(
            () => n.deviceMemory, undefined
        ),
        rtt: safe(
            () => n.connection?.rtt, undefined
        ),
        downlink: safe(
            () => n.connection?.downlink,
            undefined
        ),
        effectiveType: safe(
            () => n.connection?.effectiveType,
            undefined
        ),
        maxTouchPoints: safe(
            () => n.maxTouchPoints || 0, 0
        ),
        pdfViewerEnabled: safe(
            () => !!n.pdfViewerEnabled, false
        ),
        vendor: safe(
            () => n.vendor || '', ''
        ),
        productSub: safe(
            () => n.productSub || '', ''
        ),
        appVersion: safe(
            () => n.appVersion || '', ''
        ),
        uadBrands: safe(
            () =>
                n.userAgentData?.brands?.map(
                    (b) =>
                        `${b.brand}/${b.version}`
                ) ?? [],
            []
        ),
        uadMobile: safe(
            () => n.userAgentData?.mobile,
            undefined
        ),
        uadPlatform: safe(
            () => n.userAgentData?.platform,
            undefined
        ),
    };
    return result;
}

function collectScreenProps() {
    const s = globalThis.screen || {};
    const w = globalThis.window || {};
    return {
        width: safe(() => s.width || 0, 0),
        height: safe(() => s.height || 0, 0),
        availWidth: safe(
            () => s.availWidth || 0, 0
        ),
        availHeight: safe(
            () => s.availHeight || 0, 0
        ),
        colorDepth: safe(
            () => s.colorDepth || 0, 0
        ),
        pixelDepth: safe(
            () => s.pixelDepth || 0, 0
        ),
        devicePixelRatio: safe(
            () => w.devicePixelRatio || 0, 0
        ),
        orientation: safe(
            () => s.orientation?.type || '', ''
        ),
        isExtended: safe(
            () => s.isExtended, undefined
        ),
    };
}

function collectEngineFingerprint() {
    let evalLength = -1;
    try {
        evalLength = eval.toString().length;
    } catch {}

    let stackStyle = 'unknown';
    try {
        throw new Error('detect');
    } catch (error) {
        const stack = error.stack || '';
        if (stack.includes(' at '))
            stackStyle = 'v8';
        else if (stack.includes('@'))
            stackStyle = 'spidermonkey';
        else if (stack.includes('global code'))
            stackStyle = 'jsc';
    }

    const mathTan = safe(
        () => Math.tan(-1e308), 0
    );
    const mathAcosh = safe(
        () => Math.acosh(1e308), 0
    );
    const bindNative = safe(
        () =>
            isNative(Function.prototype.bind)
                ? 1 : 0,
        -1
    );
    const externalType = safe(
        () =>
            typeof globalThis.window?.external,
        undefined
    );

    return {
        evalLength,
        stackStyle,
        mathTan,
        mathAcosh,
        bindNative,
        externalType,
    };
}

function collectMediaQueries() {
    const mm = globalThis.window?.matchMedia;
    if (!mm) return null;

    function query(q) {
        try {
            return mm(q).matches;
        } catch {
            return false;
        }
    }

    return {
        hover: query('(hover: hover)'),
        anyHover: query('(any-hover: hover)'),
        pointerFine: query('(pointer: fine)'),
        pointerCoarse: query(
            '(pointer: coarse)'
        ),
        darkMode: query(
            '(prefers-color-scheme: dark)'
        ),
        reducedMotion: query(
            '(prefers-reduced-motion: reduce)'
        ),
        highContrast: query(
            '(prefers-contrast: more)'
        ),
        forcedColors: query(
            '(forced-colors: active)'
        ),
        colorGamutP3: query(
            '(color-gamut: p3)'
        ),
        colorGamutSrgb: query(
            '(color-gamut: srgb)'
        ),
        touch: safe(
            () =>
                'ontouchstart' in
                globalThis.window,
            false
        ),
    };
}

function collectEnvironment() {
    const w = globalThis.window || {};
    const n = globalThis.navigator || {};
    const d = globalThis.document || {};

    return {
        timezoneOffset: safe(
            () => new Date().getTimezoneOffset(),
            0
        ),
        timezoneName: safe(
            () =>
                Intl.DateTimeFormat()
                    .resolvedOptions().timeZone
                || '',
            ''
        ),
        touch:
            safe(
                () =>
                    'ontouchstart' in w ? 1 : 0,
                0
            ) |
            (safe(
                () =>
                    n.maxTouchPoints > 0
                        ? 1 : 0,
                0
            ) << 1),
        document:
            safe(
                () => (d.hidden ? 1 : 0), 0
            ) |
            (safe(
                () =>
                    d.hasFocus?.() ? 1 : 0,
                0
            ) << 1) |
            (safe(
                () =>
                    d.visibilityState ===
                    'visible'
                        ? 1 : 0,
                0
            ) << 2),
        online: safe(
            () => n.onLine, undefined
        ),
        batteryApi: safe(
            () =>
                typeof n.getBattery ===
                'function'
                    ? 1 : 0,
            0
        ),
    };
}

function collectTiming() {
    let perfNowIdentical = false;
    try {
        const timestamps = [];
        for (let i = 0; i < 10; i++)
            timestamps.push(performance.now());
        const diffs = [];
        for (let j = 1; j < timestamps.length; j++)
            diffs.push(
                timestamps[j] - timestamps[j - 1]
            );
        perfNowIdentical =
            diffs.length > 1 &&
            diffs.every((d) => d === diffs[0]) &&
            diffs[0] > 0;
    } catch {}
    return { perfNowIdentical };
}

function collectWebGL() {
    const d = globalThis.document;
    if (!d) return null;
    try {
        const canvas = d.createElement('canvas');
        const gl =
            canvas.getContext('webgl') ||
            canvas.getContext(
                'experimental-webgl'
            );
        if (!gl) return null;
        const result = {
            vendor: '',
            renderer: '',
            maxTextureSize: gl.getParameter(
                gl.MAX_TEXTURE_SIZE
            ),
            maxVertexAttribs: gl.getParameter(
                gl.MAX_VERTEX_ATTRIBS
            ),
            extensionCount:
                gl.getSupportedExtensions()
                    ?.length ?? 0,
        };
        const dbg = gl.getExtension(
            'WEBGL_debug_renderer_info'
        );
        if (dbg) {
            result.vendor =
                gl.getParameter(
                    dbg.UNMASKED_VENDOR_WEBGL
                ) || '';
            result.renderer =
                gl.getParameter(
                    dbg.UNMASKED_RENDERER_WEBGL
                ) || '';
        }
        return result;
    } catch {
        return null;
    }
}

function collectCanvas() {
    const d = globalThis.document;
    if (!d)
        return { hash: 'err', tampering: null };

    let hash = 'err';
    try {
        const canvas = d.createElement('canvas');
        canvas.width = 240;
        canvas.height = 60;
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = '#f60';
        ctx.fillRect(100, 1, 62, 20);
        ctx.fillStyle = '#069';
        ctx.font = '11pt Arial';
        ctx.fillText('vigilus,\ud83d\ude03', 2, 15);
        ctx.fillStyle = 'rgba(102,204,0,0.7)';
        ctx.font = '18pt Arial';
        ctx.fillText('vigilus,\ud83d\ude03', 4, 45);
        const dataUrl = canvas.toDataURL();
        let h = 0;
        for (let i = 0; i < dataUrl.length; i++) {
            h = ((h << 5) - h +
                dataUrl.charCodeAt(i)) | 0;
        }
        hash = h.toString(16);
    } catch {}

    let tampering = null;
    try {
        const canvas = d.createElement('canvas');
        canvas.width = 64;
        canvas.height = 16;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#f00';
        ctx.fillRect(0, 0, 64, 16);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px Arial';
        ctx.fillText('test', 2, 12);
        const d1 = canvas.toDataURL();

        ctx.fillStyle = '#f00';
        ctx.fillRect(0, 0, 64, 16);
        ctx.fillStyle = '#0f0';
        ctx.font = '12px Arial';
        ctx.fillText('test', 2, 12);
        const d2 = canvas.toDataURL();

        const imageData = ctx.getImageData(
            0, 0, 64, 16
        );
        let allZero = true;
        for (
            let i = 0;
            i < imageData.data.length;
            i += 4
        ) {
            if (
                imageData.data[i] ||
                imageData.data[i + 1] ||
                imageData.data[i + 2]
            ) {
                allZero = false;
                break;
            }
        }

        tampering = {
            random: d1 !== d2 ? 1 : 0,
            error: 0,
            inconsistent:
                d1.length > 100 && allZero
                    ? 1 : 0,
            dataLength: d1.length,
        };
    } catch {
        tampering = {
            random: 0,
            error: 1,
            inconsistent: 0,
            dataLength: 0,
        };
    }

    return { hash, tampering };
}

function collectFonts() {
    const d = globalThis.document;
    if (!d) return { widths: [], count: 0 };
    try {
        const canvas = d.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return { widths: [], count: 0 };

        const baseFont = '72px monospace';
        const testString = 'mmmmmmmmlli';
        ctx.font = baseFont;
        const baseWidth =
            ctx.measureText(testString).width;

        const fonts = [
            'Arial',
            'Verdana',
            'Times New Roman',
            'Courier New',
            'Georgia',
            'Palatino',
            'Garamond',
            'Comic Sans MS',
            'Impact',
            'Lucida Console',
            'Tahoma',
            'Trebuchet MS',
            'Helvetica',
            'Segoe UI',
            'Roboto',
            'Ubuntu',
            'Consolas',
            'Menlo',
            'Monaco',
            'Liberation Mono',
        ];

        const widths = [];
        let count = 0;
        for (const font of fonts) {
            ctx.font =
                `72px "${font}",monospace`;
            const width =
                ctx.measureText(testString)
                    .width;
            widths.push(
                Math.round(width * 100) / 100
            );
            if (width !== baseWidth) count++;
        }
        return { widths, count };
    } catch {
        return { widths: [], count: 0 };
    }
}

function collectHeadlessHeuristics() {
    const w = globalThis.window || {};
    const n = globalThis.navigator || {};
    const d = globalThis.document || {};
    const s = w.screen || {};
    const mm = w.matchMedia;

    const pdfOff = safe(
        () =>
            n.pdfViewerEnabled === false
                ? 1 : 0,
        0
    );
    const noTaskbar = safe(
        () =>
            s.height === s.availHeight &&
            s.width === s.availWidth
                ? 1 : 0,
        0
    );
    const viewportMatch = safe(
        () =>
            w.visualViewport
                ? w.visualViewport.width ===
                      s.width &&
                  w.visualViewport.height ===
                      s.height
                    ? 1
                    : 0
                : 0,
        0
    );
    const noShare = safe(
        () =>
            /Chrome/.test(
                n.userAgent || ''
            ) && !('share' in n)
                ? 1 : 0,
        0
    );

    let activeTextRed = 0;
    try {
        const div = d.createElement('div');
        div.style.display = 'none';
        div.style.color = 'ActiveText';
        d.body.appendChild(div);
        const color =
            getComputedStyle(div).color;
        d.body.removeChild(div);
        activeTextRed =
            color === 'rgb(255, 0, 0)'
                ? 1 : 0;
    } catch {}

    const uadBlank = safe(
        () =>
            n.userAgentData?.platform === ''
                ? 1 : 0,
        0
    );

    let chromeKeyPosition = 0;
    try {
        const keys = Object.keys(w);
        const idx = keys.indexOf('chrome');
        chromeKeyPosition =
            idx > keys.length - 50 &&
            idx !== -1
                ? 1 : 0;
    } catch {}

    let runtimeConstructable = 0;
    try {
        const fn =
            w.chrome?.runtime?.sendMessage;
        if (fn) {
            runtimeConstructable =
                'prototype' in fn ? 1 : 0;
        }
    } catch {}

    let iframeProxy = 0;
    try {
        const iframe =
            d.createElement('iframe');
        iframe.srcdoc = '';
        iframeProxy =
            iframe.contentWindow ? 1 : 0;
    } catch {}

    let pluginsNotArray = 0;
    try {
        pluginsNotArray =
            n.plugins instanceof PluginArray
                ? 0 : 1;
    } catch {}

    let mesa = 0;
    try {
        const canvas = d.createElement('canvas');
        const gl = canvas.getContext('webgl');
        if (gl) {
            const dbg = gl.getExtension(
                'WEBGL_debug_renderer_info'
            );
            if (dbg) {
                const vendor =
                    gl.getParameter(
                        dbg.UNMASKED_VENDOR_WEBGL
                    ) || '';
                const renderer =
                    gl.getParameter(
                        dbg.UNMASKED_RENDERER_WEBGL
                    ) || '';
                if (
                    vendor === 'Brian Paul' &&
                    /Mesa OffScreen/i.test(
                        renderer
                    )
                )
                    mesa = 1;
            }
        }
    } catch {}

    return {
        pdfOff,
        noTaskbar,
        viewportMatch,
        noShare,
        activeTextRed,
        uadBlank,
        chromeKeyPosition,
        runtimeConstructable,
        iframeProxy,
        pluginsNotArray,
        mesa,
    };
}

function collectVMIndicators() {
    const w = globalThis.window || {};
    const n = globalThis.navigator || {};
    const s = w.screen || {};
    const d = globalThis.document;

    let softwareGL = 0;
    try {
        if (d) {
            const canvas =
                d.createElement('canvas');
            const gl =
                canvas.getContext('webgl');
            if (gl) {
                const dbg = gl.getExtension(
                    'WEBGL_debug_renderer_info'
                );
                if (dbg) {
                    const renderer =
                        gl.getParameter(
                            dbg.UNMASKED_RENDERER_WEBGL
                        ) || '';
                    const vendor =
                        gl.getParameter(
                            dbg.UNMASKED_VENDOR_WEBGL
                        ) || '';
                    if (
                        /llvmpipe|softpipe|SwiftShader|SVGA3D|VirtualBox|VMware|Parallels|QEMU|Mesa DRI|Chromium|Microsoft Basic Render/i
                            .test(renderer) ||
                        /Brian Paul/i.test(
                            vendor
                        )
                    )
                        softwareGL = 1;
                }
            }
        }
    } catch {}

    let lowHardware = 0;
    try {
        if (
            n.hardwareConcurrency <= 2 &&
            (!n.deviceMemory ||
                n.deviceMemory <= 2)
        )
            lowHardware = 1;
    } catch {}

    let vmResolution = 0;
    try {
        const vmResolutions = [
            [800, 600],
            [1024, 768],
            [1280, 720],
            [1280, 800],
            [1280, 1024],
        ];
        for (const [rw, rh] of vmResolutions) {
            if (
                s.width === rw &&
                s.height === rh &&
                s.availHeight === s.height
            ) {
                vmResolution = 1;
                break;
            }
        }
    } catch {}

    let vmAudio = 0;
    try {
        const AudioCtx =
            w.AudioContext ||
            w.webkitAudioContext;
        if (AudioCtx) {
            const ctx = new AudioCtx();
            vmAudio =
                ctx.destination
                    .maxChannelCount === 0
                    ? 1 : 0;
            ctx.close();
        }
    } catch {}

    return {
        softwareGL,
        lowHardware,
        vmResolution,
        vmAudio,
    };
}

function collectConsistency() {
    const n = globalThis.navigator || {};
    const w = globalThis.window || {};
    const s = w.screen || {};
    const mm = w.matchMedia;
    const ua = safe(
        () => n.userAgent || '', ''
    );

    let clientHints = {
        hasUAData: false,
        mobileMismatch: false,
        platformMismatch: false,
    };
    try {
        if (n.userAgentData) {
            clientHints.hasUAData = true;
            clientHints.mobileMismatch =
                n.userAgentData.mobile !==
                (n.maxTouchPoints > 0 &&
                    /mobile|android/i.test(ua));
            if (n.userAgentData.platform) {
                const plat =
                    n.userAgentData.platform
                        .toLowerCase();
                const np =
                    n.platform.toLowerCase();
                clientHints.platformMismatch =
                    !(
                        (plat.includes('win') &&
                            np.includes(
                                'win'
                            )) ||
                        (plat.includes('mac') &&
                            np.includes(
                                'mac'
                            )) ||
                        (plat.includes(
                            'linux'
                        ) &&
                            np.includes(
                                'linux'
                            )) ||
                        (plat.includes(
                            'android'
                        ) &&
                            np.includes(
                                'linux'
                            )) ||
                        plat === np
                    );
            }
        }
    } catch {}

    let screenConsistency = {
        dimensionLie: 0,
        alwaysLight: 0,
    };
    try {
        if (mm) {
            const query =
                `(device-width:${s.width}px)` +
                ` and (device-height:` +
                `${s.height}px)`;
            screenConsistency.dimensionLie =
                !mm(query).matches ? 1 : 0;
        }
    } catch {}
    try {
        if (mm) {
            screenConsistency.alwaysLight =
                mm(
                    '(prefers-color-scheme:' +
                    ' light)'
                ).matches &&
                !mm(
                    '(prefers-color-scheme:' +
                    ' dark)'
                ).matches
                    ? 1
                    : 0;
        }
    } catch {}

    let locale = {
        languagePrefix: 0,
        localeLie: 0,
    };
    try {
        const lang = n.language;
        const langs = n.languages;
        locale.languagePrefix =
            langs &&
            langs.length > 0 &&
            !langs[0].startsWith(
                lang.split('-')[0]
            )
                ? 1 : 0;
    } catch {}
    try {
        const f1 = (1000).toLocaleString();
        const f2 =
            (1000).toLocaleString(n.language);
        locale.localeLie = f1 !== f2 ? 1 : 0;
    } catch {}

    return {
        clientHints,
        screen: screenConsistency,
        locale,
    };
}

function collectDevtools() {
    const w = globalThis.window || {};
    const widthDiff = safe(
        () => w.outerWidth - w.innerWidth, 0
    );
    const heightDiff = safe(
        () => w.outerHeight - w.innerHeight, 0
    );
    let sizeAnomaly = 0;
    if (widthDiff > 160 || heightDiff > 160)
        sizeAnomaly = 1;

    return {
        sizeAnomaly,
        widthDiff,
        heightDiff,
    };
}

function collectCDP() {
    let result = 0;
    try {
        const error = new Error();
        let triggered = false;
        Object.defineProperty(error, 'stack', {
            get() {
                triggered = true;
                return '';
            },
        });
        console.log(error);
        console.clear?.();
        if (triggered) result = 1;
    } catch {}
    return result;
}

function collectCSSVersion() {
    const w = globalThis.window || {};
    if (!w.CSS?.supports) return 0;
    const checks = [
        [115, 'scroll-timeline-axis:block'],
        [105, ':has(*)'],
        [100, 'text-emphasis-color:initial'],
        [95, 'accent-color:initial'],
        [89, 'border-end-end-radius:initial'],
        [88, 'aspect-ratio:initial'],
        [84, 'appearance:initial'],
        [81, 'color-scheme:initial'],
    ];
    for (const [version, rule] of checks) {
        try {
            if (w.CSS.supports(rule))
                return version;
        } catch {}
    }
    return 0;
}

function collectVoicesAndMedia() {
    const w = globalThis.window || {};
    const n = globalThis.navigator || {};

    let voiceCount = -1;
    try {
        if (w.speechSynthesis) {
            const voices =
                w.speechSynthesis.getVoices();
            voiceCount = voices?.length ?? 0;
        }
    } catch {}

    const mediaDevices = safe(
        () =>
            n.mediaDevices?.enumerateDevices
                ? 1 : 0,
        0
    );
    const webrtc = safe(
        () =>
            w.RTCPeerConnection ||
            w.webkitRTCPeerConnection
                ? 1 : 0,
        0
    );

    return { voiceCount, mediaDevices, webrtc };
}

function collectPerformance() {
    try {
        const mem =
            globalThis.performance?.memory;
        if (!mem) return {};
        return {
            jsHeapSizeLimit:
                mem.jsHeapSizeLimit,
            totalJSHeapSize:
                mem.totalJSHeapSize,
            usedJSHeapSize:
                mem.usedJSHeapSize,
        };
    } catch {
        return {};
    }
}

function collectPrototypeLies() {
    let lieCount = 0;

    function checkSetPrototype(fn) {
        try {
            Object.setPrototypeOf(fn, fn);
            return true;
        } catch (error) {
            return !/chain cycle|Cyclic __proto__/
                .test(error.message);
        }
    }

    const targets = [
        [
            'CanvasRenderingContext2D',
            'getImageData',
        ],
        [
            'CanvasRenderingContext2D',
            'measureText',
        ],
        [
            'HTMLCanvasElement',
            'toDataURL',
        ],
        [
            'HTMLCanvasElement',
            'getContext',
        ],
        [
            'Element',
            'getBoundingClientRect',
        ],
        ['Document', 'createElement'],
        [
            'Navigator',
            'hardwareConcurrency',
        ],
        ['Screen', 'width'],
        ['Screen', 'height'],
        ['Screen', 'colorDepth'],
        [
            'WebGLRenderingContext',
            'getParameter',
        ],
    ];

    const w = globalThis.window || {};
    for (const [className, propName]
        of targets) {
        try {
            const cls = w[className];
            if (!cls?.prototype) continue;
            const desc = getDescriptor(
                cls.prototype, propName
            );
            if (!desc) continue;
            const fn = desc.get || desc.value;
            if (!fn) continue;
            if (!isNative(fn)) lieCount++;
            else if (checkSetPrototype(fn))
                lieCount++;
        } catch {}
    }

    let mimeTypeProto = 0;
    try {
        const mt =
            globalThis.navigator?.mimeTypes;
        mimeTypeProto =
            Object.getPrototypeOf(mt) ===
            MimeTypeArray.prototype
                ? 0 : 1;
    } catch {}

    return { lieCount, mimeTypeProto };
}

function collectDrawing() {
    const d = globalThis.document;
    if (!d) {
        return {
            emojiWidth: 0,
            emojiHeight: 0,
            textWidth: 0,
            textAscent: 0,
            textDescent: 0,
        };
    }

    let emojiWidth = 0;
    let emojiHeight = 0;
    try {
        const span = d.createElement('span');
        span.textContent =
            '\u{1F600}\u{1F44D}\u{1F3FD}';
        span.style.cssText =
            'position:absolute;left:-9999px;' +
            'font:16px sans-serif';
        d.body.appendChild(span);
        const rect =
            span.getBoundingClientRect();
        emojiWidth = rect.width;
        emojiHeight = rect.height;
        d.body.removeChild(span);
    } catch {}

    let textWidth = 0;
    let textAscent = 0;
    let textDescent = 0;
    try {
        const canvas = d.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.font = '16px monospace';
            const metrics =
                ctx.measureText('Vigilus');
            textWidth = metrics.width;
            if (
                metrics
                    .actualBoundingBoxAscent
                !== undefined
            ) {
                textAscent =
                    metrics
                        .actualBoundingBoxAscent;
                textDescent =
                    metrics
                        .actualBoundingBoxDescent;
            }
        }
    } catch {}

    return {
        emojiWidth,
        emojiHeight,
        textWidth,
        textAscent,
        textDescent,
    };
}

const collectors = {
    automation: collectAutomation,
    browser: collectBrowserAPIs,
    properties: collectPropertyIntegrity,
    natives: collectNativeFunctions,
    features: collectFeatures,
    navigator: collectNavigatorProps,
    screen: collectScreenProps,
    engine: collectEngineFingerprint,
    mediaQueries: collectMediaQueries,
    environment: collectEnvironment,
    timing: collectTiming,
    webgl: collectWebGL,
    canvas: collectCanvas,
    fonts: collectFonts,
    headless: collectHeadlessHeuristics,
    vm: collectVMIndicators,
    consistency: collectConsistency,
    devtools: collectDevtools,
    cdp: collectCDP,
    cssVersion: collectCSSVersion,
    voices: collectVoicesAndMedia,
    performance: collectPerformance,
    prototype: collectPrototypeLies,
    drawing: collectDrawing,
};

function collectSignals(categories) {
    const selected =
        categories || SIGNAL_CATEGORIES;
    const signals = {};
    const startTime =
        typeof performance !== 'undefined'
            ? performance.now()
            : Date.now();

    for (const category of selected) {
        const collector = collectors[category];
        if (collector)
            signals[category] = collector();
    }

    const endTime =
        typeof performance !== 'undefined'
            ? performance.now()
            : Date.now();
    signals.meta = {
        collectedAt: Date.now(),
        elapsed: endTime - startTime,
    };
    return signals;
}

function serializeSignals(signals) {
    return JSON.stringify(signals);
}

function deserializeSignals(json) {
    return JSON.parse(json);
}

function countBits(n) {
    let count = 0;
    let value = n >>> 0;
    while (value) {
        count += value & 1;
        value >>>= 1;
    }
    return count;
}

function penalty(state, amount, reason) {
    state.score = Math.max(
        0, state.score - amount
    );
    state.flags.push(reason);
}

function checkAutomation(signals, state) {
    const { automation } = signals;
    if (!automation) return;

    const globalBits =
        countBits(automation.globals);
    if (globalBits > 0) {
        penalty(
            state,
            Math.min(0.5, globalBits * 0.15),
            `automation:${globalBits}` +
                ` globals detected`
        );
    }

    const enhancedBits =
        countBits(automation.enhanced);
    if (enhancedBits > 0) {
        penalty(
            state,
            Math.min(
                0.5, enhancedBits * 0.12
            ),
            `automation:${enhancedBits}` +
                ` enhanced signals`
        );
    }

    const extraBits =
        countBits(automation.extra);
    if (extraBits > 0) {
        penalty(
            state,
            Math.min(0.5, extraBits * 0.12),
            `automation:${extraBits}` +
                ` extra globals`
        );
    }
}

function checkBrowserAPIs(signals, state) {
    const { browser } = signals;
    if (!browser) return;
    const ua = signals.navigator?.ua || '';
    const isChrome = /Chrome/.test(ua);

    if (isChrome) {
        if (!(browser.apis & 1))
            penalty(
                state, 0.08,
                'browser:chrome missing'
            );
        if (!(browser.apis & 2))
            penalty(
                state, 0.05,
                'browser:permissions missing'
            );
    }
    if (!(browser.apis & 4))
        penalty(
            state, 0.1,
            'browser:no languages'
        );

    const seleniumBits =
        countBits(browser.selenium);
    if (seleniumBits > 0) {
        penalty(
            state,
            Math.min(
                0.5, seleniumBits * 0.08
            ),
            `browser:${seleniumBits}` +
                ` selenium artifacts`
        );
    }

    const stealthBits =
        countBits(browser.stealth & ~128);
    if (stealthBits > 0) {
        penalty(
            state,
            Math.min(
                0.5, stealthBits * 0.08
            ),
            `browser:${stealthBits}` +
                ` stealth signals`
        );
    }

    const advancedBits =
        countBits(browser.advanced);
    if (advancedBits >= 3) {
        penalty(
            state, 0.35,
            `browser:${advancedBits}` +
                ` advanced detection`
        );
    } else if (advancedBits > 0) {
        penalty(
            state,
            advancedBits * 0.08,
            `browser:${advancedBits}` +
                ` advanced detection`
        );
    }
}

function checkProperties(signals, state) {
    const { properties } = signals;
    if (!properties) return;

    const { integrity } = properties;
    if (!(integrity & 1))
        penalty(
            state, 0.1,
            'properties:defineProperty tampered'
        );
    if (!(integrity & 2))
        penalty(
            state, 0.1,
            'properties:getOwnPropDesc tampered'
        );
    if (!(integrity & 4))
        penalty(
            state, 0.08,
            'properties:Reflect.get tampered'
        );
    if (integrity & (1 << 10))
        penalty(
            state, 0.1,
            'properties:navigator.toString wrong'
        );
    if (integrity & (1 << 11))
        penalty(
            state, 0.15,
            'properties:navigator.toString' +
                ' throws'
        );
    if (integrity & (1 << 13))
        penalty(
            state, 0.1,
            'properties:toStringTag wrong'
        );
    if (integrity & (1 << 14))
        penalty(
            state, 0.15,
            'properties:proto getter not native'
        );
    if (integrity & (1 << 15))
        penalty(
            state, 0.1,
            'properties:Reflect.get tampered v2'
        );

    if (properties.overrides > 0) {
        penalty(
            state,
            Math.min(
                0.3, properties.overrides * 0.1
            ),
            `properties:${properties.overrides}` +
                ` overrides`
        );
    }

    if (properties.protoInconsistency > 0)
        penalty(
            state, 0.15,
            'properties:proto inconsistency'
        );
}

function checkNatives(signals, state) {
    if (signals.natives === undefined) return;
    const expected = 0xfff;
    const tampered =
        ~signals.natives & expected;
    const bits = countBits(tampered);
    if (bits > 0) {
        penalty(
            state,
            Math.min(0.4, bits * 0.08),
            `natives:${bits}` +
                ` tampered functions`
        );
    }
}

function checkFeatures(signals, state) {
    if (signals.features === undefined) return;
    const missing =
        ~signals.features & 0x7ff;
    const bits = countBits(missing);
    if (bits > 3)
        penalty(
            state, 0.15,
            `features:${bits} missing`
        );

    const hasAdvanced =
        (signals.features & 0x30) === 0x30;
    const missingBasic =
        !(signals.features & 1) ||
        !(signals.features & 4);
    if (hasAdvanced && missingBasic)
        penalty(
            state, 0.2,
            'features:inconsistent'
        );
}

function checkNavigator(signals, state) {
    const nav = signals.navigator;
    if (!nav) return;

    if (nav.hardwareConcurrency === 1)
        penalty(
            state, 0.08, 'navigator:1 core'
        );
    if (nav.hardwareConcurrency === 0)
        penalty(
            state, 0.15, 'navigator:0 cores'
        );
    if (
        nav.languageCount === 0 &&
        !/mobile|android/i.test(nav.ua)
    )
        penalty(
            state, 0.12,
            'navigator:no languages'
        );

    if (
        nav.deviceMemory !== undefined &&
        nav.deviceMemory !== null
    ) {
        const valid = [
            0.25, 0.5, 1, 2, 4,
            8, 16, 32, 64,
        ];
        if (!valid.includes(nav.deviceMemory))
            penalty(
                state, 0.1,
                'navigator:invalid deviceMemory'
            );
    }

    if (nav.rtt === 0)
        penalty(
            state, 0.05, 'navigator:rtt=0'
        );

    const ua = nav.ua;
    if (
        /Chrome/.test(ua) &&
        nav.productSub !== '20030107'
    )
        penalty(
            state, 0.08,
            'navigator:wrong productSub'
        );
    if (
        /Firefox/.test(ua) &&
        nav.productSub !== '20100101'
    )
        penalty(
            state, 0.08,
            'navigator:wrong productSub'
        );
    if (
        /Chrome/.test(ua) &&
        nav.vendor !== 'Google Inc.'
    )
        penalty(
            state, 0.08,
            'navigator:wrong vendor'
        );
}

function checkScreen(signals, state) {
    const scr = signals.screen;
    if (!scr) return;

    if (scr.width === 0 || scr.height === 0)
        penalty(
            state, 0.15,
            'screen:zero dimensions'
        );
    if (
        (scr.width === 800 &&
            scr.height === 600) ||
        (scr.width === 1024 &&
            scr.height === 768)
    )
        penalty(
            state, 0.1,
            'screen:VM-typical resolution'
        );
    if (
        scr.colorDepth > 0 &&
        scr.colorDepth < 24
    )
        penalty(
            state, 0.1,
            'screen:low colorDepth'
        );
    if (scr.devicePixelRatio === 0)
        penalty(
            state, 0.1, 'screen:zero DPR'
        );
}

function checkEngine(signals, state) {
    const eng = signals.engine;
    if (!eng) return;
    const ua = signals.navigator?.ua || '';

    if (
        /Chrome/.test(ua) &&
        eng.evalLength !== 33
    )
        penalty(
            state, 0.1,
            'engine:wrong eval length Chrome'
        );
    if (
        /Firefox/.test(ua) &&
        eng.evalLength !== 37
    )
        penalty(
            state, 0.1,
            'engine:wrong eval length Firefox'
        );
    if (
        eng.stackStyle === 'v8' &&
        /Firefox/.test(ua)
    )
        penalty(
            state, 0.15,
            'engine:V8 stack in Firefox UA'
        );
    if (
        eng.stackStyle === 'spidermonkey' &&
        /Chrome/.test(ua)
    )
        penalty(
            state, 0.15,
            'engine:SpiderMonkey stack' +
                ' in Chrome UA'
        );
    if (eng.mathTan === 0)
        penalty(
            state, 0.05,
            'engine:math fingerprint zero'
        );
}

function checkMediaQueries(signals, state) {
    const mq = signals.mediaQueries;
    if (!mq) return;
    const ua = signals.navigator?.ua || '';

    if (!mq.pointerFine && !mq.touch)
        penalty(
            state, 0.1,
            'mediaQueries:no pointer no touch'
        );
    if (
        !/mobile|android/i.test(ua) &&
        !mq.hover
    )
        penalty(
            state, 0.05,
            'mediaQueries:no hover on desktop'
        );
}

function checkEnvironment(signals, state) {
    const env = signals.environment;
    if (!env) return;

    if (
        env.timezoneOffset < -720 ||
        env.timezoneOffset > 840
    )
        penalty(
            state, 0.1,
            'environment:impossible timezone'
        );
    if (
        env.timezoneName === 'UTC' &&
        env.timezoneOffset !== 0
    )
        penalty(
            state, 0.1,
            'environment:UTC name' +
                ' non-zero offset'
        );
    if (env.timezoneName === '')
        penalty(
            state, 0.08,
            'environment:empty timezone name'
        );
    if (
        (env.touch & 1) !==
        ((env.touch >> 1) & 1)
    )
        penalty(
            state, 0.05,
            'environment:touch inconsistency'
        );
    if (env.document & 1 && env.document & 2)
        penalty(
            state, 0.08,
            'environment:hidden+focused'
        );
}

function checkTiming(signals, state) {
    if (!signals.timing) return;
    if (signals.timing.perfNowIdentical)
        penalty(
            state, 0.1,
            'timing:identical perf.now diffs'
        );
}

function checkWebGL(signals, state) {
    const gl = signals.webgl;
    if (!gl) return;

    if (
        gl.vendor === 'Google Inc.' &&
        /SwiftShader/.test(gl.renderer)
    )
        penalty(
            state, 0.2,
            'webgl:Google+SwiftShader'
        );
    if (gl.maxTextureSize === 0)
        penalty(
            state, 0.1,
            'webgl:zero maxTextureSize'
        );
    if (
        /SwiftShader|llvmpipe|softpipe/i
            .test(gl.renderer)
    )
        penalty(
            state, 0.2,
            'webgl:software renderer'
        );
}

function checkCanvas(signals, state) {
    const cv = signals.canvas;
    if (!cv) return;

    if (cv.hash === 'err')
        penalty(state, 0.1, 'canvas:error');
    if (cv.tampering) {
        if (cv.tampering.random)
            penalty(
                state, 0.25,
                'canvas:randomization'
            );
        if (cv.tampering.error)
            penalty(
                state, 0.05,
                'canvas:tampering error'
            );
        if (cv.tampering.inconsistent)
            penalty(
                state, 0.15,
                'canvas:data/pixel mismatch'
            );
    }
}

function checkFonts(signals, state) {
    if (!signals.fonts) return;
    if (
        signals.fonts.count === 0 &&
        signals.fonts.widths?.length > 0
    )
        penalty(
            state, 0.1,
            'fonts:zero detected'
        );
}

function checkHeadless(signals, state) {
    const h = signals.headless;
    if (!h) return;
    const ua = signals.navigator?.ua || '';
    const isChrome = /Chrome/.test(ua);
    const isLinux =
        /Linux/.test(ua) &&
        !/Android/.test(ua);

    if (isChrome && h.pdfOff)
        penalty(
            state, 0.1,
            'headless:pdf viewer disabled'
        );
    if (h.noTaskbar)
        penalty(
            state, 0.03,
            'headless:no taskbar'
        );
    if (h.viewportMatch)
        penalty(
            state, 0.04,
            'headless:viewport matches screen'
        );
    if (isChrome && !isLinux && h.noShare)
        penalty(
            state, 0.02,
            'headless:no Web Share API'
        );
    if (!isLinux && h.activeTextRed)
        penalty(
            state, 0.05,
            'headless:ActiveText red'
        );
    if (h.uadBlank)
        penalty(
            state, 0.12,
            'headless:blank UAData platform'
        );
    if (h.runtimeConstructable)
        penalty(
            state, 0.12,
            'headless:runtime constructable'
        );
    if (h.iframeProxy)
        penalty(
            state, 0.15,
            'headless:iframe proxy detected'
        );
    if (h.pluginsNotArray)
        penalty(
            state, 0.1,
            'headless:plugins not PluginArray'
        );
    if (h.mesa)
        penalty(
            state, 0.2,
            'headless:Mesa OffScreen renderer'
        );
}

function checkVM(signals, state) {
    const vmd = signals.vm;
    if (!vmd) return;

    if (vmd.softwareGL)
        penalty(
            state, 0.2,
            'vm:software/VM GL renderer'
        );
    if (vmd.lowHardware)
        penalty(
            state, 0.06,
            'vm:low hardware specs'
        );
    if (vmd.vmResolution)
        penalty(
            state, 0.08,
            'vm:VM-typical resolution'
        );
    if (vmd.vmAudio)
        penalty(
            state, 0.1,
            'vm:zero audio channels'
        );

    const vmHits =
        (vmd.softwareGL || 0) +
        (vmd.lowHardware || 0) +
        (vmd.vmResolution || 0) +
        (vmd.vmAudio || 0);
    if (vmHits >= 3)
        penalty(
            state, 0.15,
            'vm:multiple indicators'
        );
}

function checkConsistency(signals, state) {
    const ch =
        signals.consistency?.clientHints;
    const sc =
        signals.consistency?.screen;
    const lc =
        signals.consistency?.locale;
    const ua = signals.navigator?.ua || '';
    const isLinux =
        /Linux/.test(ua) &&
        !/Android/.test(ua);

    if (ch) {
        if (
            /Chrome/.test(ua) &&
            !ch.hasUAData
        )
            penalty(
                state, 0.08,
                'consistency:no UAData Chrome'
            );
        if (ch.mobileMismatch)
            penalty(
                state, 0.1,
                'consistency:mobile mismatch'
            );
        if (ch.platformMismatch)
            penalty(
                state, 0.1,
                'consistency:platform mismatch'
            );
    }

    if (sc) {
        if (sc.dimensionLie)
            penalty(
                state, 0.15,
                'consistency:screen' +
                    ' dimensions spoofed'
            );
        if (sc.alwaysLight)
            penalty(
                state, 0.04,
                'consistency:always' +
                    ' light scheme'
            );
    }

    if (lc) {
        if (lc.languagePrefix)
            penalty(
                state, 0.1,
                'consistency:language' +
                    ' prefix mismatch'
            );
        if (lc.localeLie && !isLinux)
            penalty(
                state, 0.02,
                'consistency:locale' +
                    ' formatting mismatch'
            );
    }
}

function checkDevtools(signals, state) {
    if (!signals.devtools) return;
    if (signals.devtools.sizeAnomaly)
        penalty(
            state, 0.05,
            'devtools:large size difference'
        );
}

function checkCDP(signals, state) {
    if (signals.cdp)
        penalty(
            state, 0.15,
            'cdp:console side-effect'
        );
}

function checkCSSVersion(signals, state) {
    if (
        !signals.cssVersion ||
        !signals.navigator
    )
        return;
    const ua = signals.navigator.ua || '';
    const match = ua.match(/Chrome\/(\d+)/);
    if (!match) return;

    const uaVersion = parseInt(match[1], 10);
    const cssVersion = signals.cssVersion;
    if (
        uaVersion < cssVersion ||
        (cssVersion < 115 &&
            uaVersion - cssVersion > 5)
    )
        penalty(
            state, 0.15,
            'cssVersion:UA version mismatch'
        );
}

function checkVoices(signals, state) {
    const vms = signals.voices;
    if (!vms) return;
    const ua = signals.navigator?.ua || '';

    if (
        /Chrome/.test(ua) &&
        !/Android/.test(ua)
    ) {
        if (vms.voiceCount === -1)
            penalty(
                state, 0.08,
                'voices:no speechSynthesis'
            );
        if (!vms.mediaDevices)
            penalty(
                state, 0.1,
                'voices:no mediaDevices'
            );
    }
    if (/Chrome/.test(ua) && !vms.webrtc)
        penalty(
            state, 0.05,
            'voices:no WebRTC Chrome'
        );
}

function checkPerformance(signals, state) {
    const perf = signals.performance;
    if (!perf) return;

    if (
        perf.jsHeapSizeLimit &&
        perf.totalJSHeapSize
    ) {
        if (
            perf.totalJSHeapSize >
            perf.jsHeapSizeLimit
        )
            penalty(
                state, 0.1,
                'performance:heap exceeds limit'
            );
    }
}

function checkPrototype(signals, state) {
    const pf = signals.prototype;
    if (!pf) return;

    if (pf.lieCount > 2) {
        penalty(
            state,
            Math.min(
                0.4, pf.lieCount * 0.06
            ),
            `prototype:${pf.lieCount}` +
                ` API lies`
        );
    } else if (pf.lieCount > 0) {
        penalty(
            state,
            pf.lieCount * 0.05,
            `prototype:${pf.lieCount}` +
                ` API lies`
        );
    }
    if (pf.mimeTypeProto)
        penalty(
            state, 0.1,
            'prototype:MimeType proto tampered'
        );
}

function checkDrawing(signals, state) {
    if (!signals.drawing) return;
    if (
        signals.drawing.emojiWidth === 0 &&
        signals.drawing.emojiHeight === 0
    )
        penalty(
            state, 0.08,
            'drawing:zero emoji dimensions'
        );
}

function checkCrossValidation(signals, state) {
    const nav = signals.navigator;
    const gl = signals.webgl;
    const eng = signals.engine;
    const scr = signals.screen;
    if (!nav) return;

    const ua = nav.ua || '';
    const isChromeUA =
        /Chrome/.test(ua) &&
        !/Edge/.test(ua);
    const isFirefoxUA = /Firefox/.test(ua);
    const isSafariUA =
        /Safari/.test(ua) && !isChromeUA;
    const isLinux =
        /Linux/.test(ua) &&
        !/Android/.test(ua);
    const isMac = /Mac/.test(ua);
    const renderer = gl?.renderer || '';

    if (
        isChromeUA &&
        /Gecko\/\d/.test(ua) &&
        !/like Gecko/.test(ua)
    )
        penalty(
            state, 0.2,
            'crossValidation:Chrome UA' +
                ' with Gecko engine'
        );

    if (
        isFirefoxUA &&
        /ANGLE/.test(renderer)
    )
        penalty(
            state, 0.15,
            'crossValidation:Firefox UA' +
                ' with ANGLE'
        );

    if (isSafariUA && isLinux)
        penalty(
            state, 0.2,
            'crossValidation:Safari UA' +
                ' on Linux'
        );

    if (
        isMac &&
        /NVIDIA|GeForce/i.test(renderer) &&
        /Mac OS X 1[1-9]|macOS 1[2-9]/
            .test(ua)
    )
        penalty(
            state, 0.1,
            'crossValidation:NVIDIA' +
                ' on modern macOS'
        );

    if (
        scr &&
        isMac &&
        scr.devicePixelRatio === 1 &&
        scr.width > 1920
    )
        penalty(
            state, 0.08,
            'crossValidation:Mac' +
                ' non-retina high-res'
        );

    if (eng) {
        if (
            isChromeUA &&
            eng.stackStyle === 'spidermonkey'
        )
            penalty(
                state, 0.2,
                'crossValidation:Chrome UA' +
                    ' SpiderMonkey'
            );
        if (
            isFirefoxUA &&
            eng.stackStyle === 'v8'
        )
            penalty(
                state, 0.2,
                'crossValidation:Firefox UA' +
                    ' V8 stack'
            );
    }
}

function checkHeaders(headers, state) {
    if (!headers) return;

    if (!headers['accept'])
        penalty(
            state, 0.05,
            'headers:no Accept'
        );
    if (!headers['accept-language'])
        penalty(
            state, 0.05,
            'headers:no Accept-Language'
        );
    if (!headers['accept-encoding'])
        penalty(
            state, 0.05,
            'headers:no Accept-Encoding'
        );

    const ua = headers['user-agent'] || '';
    if (
        /HeadlessChrome|PhantomJS|SlimerJS/i
            .test(ua)
    )
        penalty(
            state, 0.2,
            'headers:headless UA string'
        );
    if (ua && !/Mozilla\//.test(ua))
        penalty(
            state, 0.08,
            'headers:non-standard UA'
        );
}

const CHECKS = [
    checkAutomation,
    checkBrowserAPIs,
    checkProperties,
    checkNatives,
    checkFeatures,
    checkNavigator,
    checkScreen,
    checkEngine,
    checkMediaQueries,
    checkEnvironment,
    checkTiming,
    checkWebGL,
    checkCanvas,
    checkFonts,
    checkHeadless,
    checkVM,
    checkConsistency,
    checkDevtools,
    checkCDP,
    checkCSSVersion,
    checkVoices,
    checkPerformance,
    checkPrototype,
    checkDrawing,
    checkCrossValidation,
];

function validateSignals(signals, headers) {
    const state = { score: 1.0, flags: [] };

    for (const check of CHECKS) {
        check(signals, state);
    }

    if (headers)
        checkHeaders(headers, state);

    return {
        score: Math.round(
            state.score * 10000
        ) / 10000,
        flags: state.flags,
        verdict: classifyScore(state.score),
        categoryScores:
            computeCategoryScores(
                signals, headers
            ),
    };
}

function classifyScore(score) {
    if (score >= 0.85) return 'trusted';
    if (score >= 0.6) return 'suspicious';
    if (score >= 0.3)
        return 'likely_automated';
    return 'automated';
}

function computeCategoryScores(
    signals, headers
) {
    const categories = {};
    const categoryChecks = {
        automation: [checkAutomation],
        browser: [checkBrowserAPIs],
        properties: [checkProperties],
        natives: [checkNatives],
        features: [checkFeatures],
        navigator: [checkNavigator],
        screen: [checkScreen],
        engine: [checkEngine],
        mediaQueries: [checkMediaQueries],
        environment: [checkEnvironment],
        timing: [checkTiming],
        webgl: [checkWebGL],
        canvas: [checkCanvas],
        fonts: [checkFonts],
        headless: [checkHeadless],
        vm: [checkVM],
        consistency: [checkConsistency],
        devtools: [checkDevtools],
        cdp: [checkCDP],
        cssVersion: [checkCSSVersion],
        voices: [checkVoices],
        performance: [checkPerformance],
        prototype: [checkPrototype],
        drawing: [checkDrawing],
        crossValidation: [
            checkCrossValidation,
        ],
        headers: headers
            ? [
                  (s, st) =>
                      checkHeaders(
                          headers, st
                      ),
              ]
            : [],
    };

    for (const [name, checks]
        of Object.entries(categoryChecks)) {
        const state = {
            score: 1.0, flags: [],
        };
        for (const check of checks)
            check(signals, state);
        categories[name] = {
            score: Math.round(
                state.score * 10000
            ) / 10000,
            flags: state.flags,
        };
    }

    return categories;
}

export {
    SIGNAL_CATEGORIES,
    collectSignals,
    serializeSignals,
    deserializeSignals,
    collectors,
    validateSignals,
    classifyScore,
    computeCategoryScores,
    countBits,
};
