function mean(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stddev(arr) {
    if (arr.length < 2) return 0;
    const m = mean(arr);
    return Math.sqrt(
        arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length
    );
}

function cv(arr) {
    const m = mean(arr);
    return m !== 0 ? stddev(arr) / Math.abs(m) : 0;
}

function shannonEntropy(values, numBins = 20) {
    if (values.length < 2) return 0;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const bins = new Array(numBins).fill(0);
    for (const v of values) {
        const bin = Math.min(
            Math.floor(((v - min) / range) * numBins),
            numBins - 1
        );
        bins[bin]++;
    }
    const total = values.length;
    let entropy = 0;
    for (const count of bins) {
        if (count > 0) {
            const p = count / total;
            entropy -= p * Math.log2(p);
        }
    }
    return entropy;
}

function dist(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function countDecimals(n) {
    if (Number.isInteger(n)) return 0;
    const s = String(n);
    const dot = s.indexOf('.');
    if (dot === -1) return 0;
    return s.length - dot - 1;
}

function autocorrelation(values, lag) {
    const n = values.length;
    const m = mean(values);
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
        den += (values[i] - m) ** 2;
        if (i + lag < n) {
            num +=
                (values[i] - m) * (values[i + lag] - m);
        }
    }
    return den > 0 ? num / den : 0;
}

function fractionNonInteger(arr) {
    if (!arr.length) return 0;
    const count =
        arr.filter((v) => !Number.isInteger(v)).length;
    return count / arr.length;
}

const MOTION_CATEGORIES = [
    'mouse',
    'clicks',
    'keystrokes',
    'scroll',
    'touch',
    'sensors',
    'eventOrder',
    'engagement',
];

const DEFAULT_LIMITS = {
    mouse: 500,
    clicks: 50,
    keys: 100,
    scroll: 200,
    touch: 300,
    sensors: 200,
    events: 500,
};

function createCollector(options = {}) {
    const limits = {
        ...DEFAULT_LIMITS,
        ...options.limits,
    };
    const minTime = options.minTime ?? 3000;

    const t0 = Date.now();
    let ttfi = 0;
    const data = {
        m: [],
        c: [],
        k: [],
        s: [],
        tc: [],
        ac: [],
        gy: [],
        or: [],
        ev: [],
        bc: [],
        bl: [],
        ttfi: 0,
        dur: 0,
        meta: {},
    };
    const boundElements = new Map();

    function rt() {
        return Date.now() - t0;
    }

    function fi() {
        if (!ttfi) {
            ttfi = rt();
            data.ttfi = ttfi;
        }
    }

    function pushEvent(code) {
        if (data.ev.length < limits.events) {
            data.ev.push([code, rt()]);
        }
    }

    function onMouseMove(e) {
        fi();
        if (data.m.length >= limits.mouse)
            data.m.shift();
        data.m.push([
            e.clientX + e.movementX * 0.01,
            e.clientY + e.movementY * 0.01,
            rt(),
        ]);
        pushEvent(0);
    }

    let downTime = 0;

    function onMouseDown() {
        fi();
        downTime = rt();
        pushEvent(1);
    }

    function onMouseUp() {
        pushEvent(2);
    }

    function onClick(e) {
        fi();
        const now = rt();
        pushEvent(3);
        if (data.c.length >= limits.clicks) return;

        const dwell = downTime ? now - downTime : 0;
        const rect = e.target
            ? e.target.getBoundingClientRect()
            : null;
        if (
            rect &&
            rect.width > 0 &&
            rect.height > 0
        ) {
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            data.c.push([
                e.clientX - cx,
                e.clientY - cy,
                dwell,
                rect.width,
                rect.height,
                now,
            ]);
        } else {
            data.c.push([0, 0, dwell, 0, 0, now]);
        }
        downTime = 0;

        for (const [element, index]
            of boundElements) {
            if (
                element === e.target ||
                element.contains(e.target)
            ) {
                const br =
                    element.getBoundingClientRect();
                const bx = br.left + br.width / 2;
                const by = br.top + br.height / 2;
                data.bc.push([
                    e.clientX - bx,
                    e.clientY - by,
                    dwell,
                    br.width,
                    br.height,
                    now,
                    index,
                ]);
                break;
            }
        }
    }

    const keyDownTimes = {};
    let lastKeyUp = 0;

    function onKeyDown(e) {
        fi();
        pushEvent(4);
        if (!keyDownTimes[e.code]) {
            keyDownTimes[e.code] = rt();
        }
    }

    function onKeyUp(e) {
        pushEvent(5);
        const now = rt();
        const downT = keyDownTimes[e.code];
        if (downT && data.k.length < limits.keys) {
            const dwell = now - downT;
            const flight = lastKeyUp
                ? downT - lastKeyUp
                : 0;
            data.k.push([dwell, flight]);
        }
        lastKeyUp = now;
        delete keyDownTimes[e.code];
    }

    function onScroll() {
        fi();
        const now = rt();
        pushEvent(6);
        if (data.s.length >= limits.scroll)
            data.s.shift();
        const prev = data.s.length
            ? data.s[data.s.length - 1][0]
            : 0;
        data.s.push([
            window.scrollY,
            window.scrollY - prev,
            now,
        ]);
    }

    function onTouch(e, code) {
        fi();
        pushEvent(code);
        for (
            let i = 0;
            i < e.changedTouches.length;
            i++
        ) {
            if (data.tc.length >= limits.touch) {
                data.tc.shift();
            }
            const t = e.changedTouches[i];
            data.tc.push([
                t.clientX,
                t.clientY,
                t.force || 0,
                t.radiusX || 0,
                t.radiusY || 0,
                rt(),
            ]);
        }
    }

    function onDeviceMotion(e) {
        data.meta.hasMotionSensors = true;
        const a = e.accelerationIncludingGravity;
        if (a && data.ac.length < limits.sensors) {
            data.ac.push([
                a.x || 0,
                a.y || 0,
                a.z || 0,
                rt(),
            ]);
        }
        const r = e.rotationRate;
        if (r && data.gy.length < limits.sensors) {
            data.gy.push([
                r.alpha || 0,
                r.beta || 0,
                r.gamma || 0,
                rt(),
            ]);
        }
    }

    function onDeviceOrientation(e) {
        if (data.or.length < limits.sensors) {
            data.or.push([
                e.alpha || 0,
                e.beta || 0,
                e.gamma || 0,
                rt(),
            ]);
        }
    }

    function attach(doc, win) {
        const d = doc || document;
        const w = win || window;

        const passive = { passive: true };
        d.addEventListener(
            'mousemove', onMouseMove, passive
        );
        d.addEventListener(
            'mousedown', onMouseDown, passive
        );
        d.addEventListener(
            'mouseup', onMouseUp, passive
        );
        d.addEventListener(
            'click', onClick, passive
        );
        d.addEventListener(
            'keydown', onKeyDown, passive
        );
        d.addEventListener(
            'keyup', onKeyUp, passive
        );
        w.addEventListener(
            'scroll', onScroll, passive
        );

        d.addEventListener(
            'touchstart',
            (e) => onTouch(e, 7),
            passive
        );
        d.addEventListener(
            'touchmove',
            (e) => onTouch(e, 8),
            passive
        );
        d.addEventListener(
            'touchend',
            (e) => onTouch(e, 9),
            passive
        );

        data.meta.hasTouchScreen =
            'ontouchstart' in w ||
            navigator.maxTouchPoints > 0;
        data.meta.hasMotionSensors = false;

        if (w.DeviceMotionEvent) {
            try {
                if (
                    typeof w.DeviceMotionEvent
                        .requestPermission ===
                    'function'
                ) {
                    data.meta
                        .sensorPermissionRequired =
                        true;
                }
            } catch {}
            w.addEventListener(
                'devicemotion',
                onDeviceMotion,
                passive
            );
        }

        if (w.DeviceOrientationEvent) {
            w.addEventListener(
                'deviceorientation',
                onDeviceOrientation,
                passive
            );
        }
    }

    function detach(doc, win) {
        const d = doc || document;
        const w = win || window;
        d.removeEventListener(
            'mousemove', onMouseMove
        );
        d.removeEventListener(
            'mousedown', onMouseDown
        );
        d.removeEventListener(
            'mouseup', onMouseUp
        );
        d.removeEventListener('click', onClick);
        d.removeEventListener(
            'keydown', onKeyDown
        );
        d.removeEventListener('keyup', onKeyUp);
        w.removeEventListener('scroll', onScroll);
        w.removeEventListener(
            'devicemotion', onDeviceMotion
        );
        w.removeEventListener(
            'deviceorientation', onDeviceOrientation
        );
    }

    function isReady() {
        if (rt() < minTime) return false;
        return (
            data.m.length >= 10 ||
            data.tc.length >= 5 ||
            data.k.length >= 3 ||
            data.s.length >= 3
        );
    }

    function getData() {
        data.dur = rt();
        return data;
    }

    function stats() {
        return {
            mouse: data.m.length,
            clicks: data.c.length,
            keys: data.k.length,
            scroll: data.s.length,
            touch: data.tc.length,
            accel: data.ac.length,
            gyro: data.gy.length,
            orient: data.or.length,
            events: data.ev.length,
            elapsed: rt(),
        };
    }

    function bind(element, label) {
        if (!element) return;
        const index = data.bl.length;
        data.bl.push(
            label || element.id || ''
        );
        boundElements.set(element, index);
    }

    function unbind(element) {
        boundElements.delete(element);
    }

    return {
        attach,
        detach,
        bind,
        unbind,
        isReady,
        getData,
        stats,
    };
}

function serializeInteractions(data) {
    return JSON.stringify(data);
}

function deserializeInteractions(json) {
    return typeof json === 'string'
        ? JSON.parse(json)
        : json;
}

function analyzeMouse(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.3,
    };
    const m = data.m;

    if (!m || m.length < 5) {
        result.score = 0.2;
        result.reasons.push(
            'Insufficient mouse data'
        );
        return result;
    }

    let penalty = 0;
    const points = m.map((p) => ({
        x: p[0],
        y: p[1],
        t: p[2],
    }));

    const curvatures = [];
    for (let i = 1; i < points.length - 1; i++) {
        const a = points[i - 1];
        const b = points[i];
        const c = points[i + 1];
        const ab = dist(a.x, a.y, b.x, b.y);
        const bc = dist(b.x, b.y, c.x, c.y);
        const ca = dist(c.x, c.y, a.x, a.y);
        if (ab > 0 && bc > 0 && ca > 0) {
            const cross = Math.abs(
                (b.x - a.x) * (c.y - a.y) -
                (b.y - a.y) * (c.x - a.x)
            );
            curvatures.push(
                (2 * cross) / (ab * bc * ca)
            );
        }
    }

    if (curvatures.length >= 10) {
        const curvEntropy =
            shannonEntropy(curvatures, 15);
        if (curvEntropy < 1.0) {
            penalty += 0.12;
            result.reasons.push(
                `Low curvature entropy: ` +
                `${curvEntropy.toFixed(2)} ` +
                `(straight-line)`
            );
        } else if (curvEntropy < 1.8) {
            penalty += 0.05;
            result.reasons.push(
                `Below-average curvature ` +
                `entropy: ` +
                `${curvEntropy.toFixed(2)}`
            );
        }
    }

    if (points.length >= 10) {
        const residuals = [];
        for (
            let i = 2;
            i < points.length - 2;
            i++
        ) {
            let sx = 0;
            let sy = 0;
            for (let j = -2; j <= 2; j++) {
                sx += points[i + j].x;
                sy += points[i + j].y;
            }
            sx /= 5;
            sy /= 5;
            residuals.push(
                dist(
                    points[i].x,
                    points[i].y,
                    sx,
                    sy
                )
            );
        }

        const tremorRMS = Math.sqrt(
            mean(residuals.map((r) => r * r))
        );
        if (tremorRMS < 0.05) {
            penalty += 0.1;
            result.reasons.push(
                `No micro-tremor: RMS=` +
                `${tremorRMS.toFixed(3)}px ` +
                `(too smooth)`
            );
        } else if (tremorRMS > 20) {
            penalty += 0.06;
            result.reasons.push(
                `Excessive tremor: RMS=` +
                `${tremorRMS.toFixed(1)}px ` +
                `(noise injection?)`
            );
        }
    }

    const velocities = [];
    const intervals = [];
    for (let i = 1; i < points.length; i++) {
        const dt =
            points[i].t - points[i - 1].t;
        if (dt > 0) {
            const d = dist(
                points[i - 1].x,
                points[i - 1].y,
                points[i].x,
                points[i].y
            );
            velocities.push(d / dt);
            intervals.push(dt);
        }
    }

    if (velocities.length >= 10) {
        const velCV = cv(velocities);
        if (velCV < 0.15) {
            penalty += 0.12;
            result.reasons.push(
                `Constant velocity: ` +
                `CV=${velCV.toFixed(3)}`
            );
        } else if (velCV < 0.3) {
            penalty += 0.05;
            result.reasons.push(
                `Low velocity variance: ` +
                `CV=${velCV.toFixed(3)}`
            );
        }
    }

    if (velocities.length >= 8) {
        const accelerations = [];
        for (
            let i = 1;
            i < velocities.length;
            i++
        ) {
            const dt = intervals[i] || 16;
            accelerations.push(
                (velocities[i] -
                    velocities[i - 1]) /
                dt
            );
        }
        const jerks = [];
        for (
            let i = 1;
            i < accelerations.length;
            i++
        ) {
            const dt = intervals[i] || 16;
            jerks.push(
                (accelerations[i] -
                    accelerations[i - 1]) /
                dt
            );
        }
        if (jerks.length >= 5) {
            const jerkCV =
                cv(jerks.map(Math.abs));
            if (
                jerkCV < 0.2 &&
                mean(jerks.map(Math.abs)) > 0
            ) {
                penalty += 0.06;
                result.reasons.push(
                    `Low jerk variance: ` +
                    `CV=${jerkCV.toFixed(3)} ` +
                    `(too smooth)`
                );
            }
        }
    }

    if (points.length >= 20) {
        const windowSize = 15;
        const straightnessValues = [];
        for (
            let i = 0;
            i <= points.length - windowSize;
            i += 5
        ) {
            const seg = points.slice(
                i, i + windowSize
            );
            const directDist = dist(
                seg[0].x,
                seg[0].y,
                seg[seg.length - 1].x,
                seg[seg.length - 1].y
            );
            if (directDist < 5) continue;
            let pathLength = 0;
            for (
                let j = 1;
                j < seg.length;
                j++
            ) {
                pathLength += dist(
                    seg[j - 1].x,
                    seg[j - 1].y,
                    seg[j].x,
                    seg[j].y
                );
            }
            straightnessValues.push(
                pathLength / directDist
            );
        }

        if (straightnessValues.length >= 3) {
            const avg =
                mean(straightnessValues);
            if (avg < 1.005) {
                penalty += 0.1;
                result.reasons.push(
                    `Perfectly straight paths: ` +
                    `idx=${avg.toFixed(4)}`
                );
            } else if (avg < 1.015) {
                penalty += 0.04;
                result.reasons.push(
                    `Very straight paths: ` +
                    `idx=${avg.toFixed(4)}`
                );
            }
        }
    }

    const angles = [];
    for (
        let i = 1;
        i < points.length - 1;
        i++
    ) {
        const dx1 =
            points[i].x - points[i - 1].x;
        const dy1 =
            points[i].y - points[i - 1].y;
        const dx2 =
            points[i + 1].x - points[i].x;
        const dy2 =
            points[i + 1].y - points[i].y;
        if (
            dx1 !== 0 ||
            dy1 !== 0 ||
            dx2 !== 0 ||
            dy2 !== 0
        ) {
            angles.push(
                Math.atan2(
                    dx1 * dy2 - dy1 * dx2,
                    dx1 * dx2 + dy1 * dy2
                )
            );
        }
    }

    if (angles.length >= 15) {
        const angleEntropy =
            shannonEntropy(angles, 24);
        if (angleEntropy < 1.2) {
            penalty += 0.08;
            result.reasons.push(
                `Low direction entropy: ` +
                `${angleEntropy.toFixed(2)} ` +
                `(mechanical)`
            );
        }
    }

    if (intervals.length >= 10) {
        const intervalCV = cv(intervals);
        const avgInterval = mean(intervals);
        if (
            intervalCV < 0.1 &&
            avgInterval > 50
        ) {
            penalty += 0.08;
            result.reasons.push(
                `Uniform timing: ` +
                `CV=${intervalCV.toFixed(3)}, ` +
                `avg=` +
                `${avgInterval.toFixed(0)}ms`
            );
        }

        const rounded = intervals
            .filter((i) => i > 30)
            .map((i) => Math.round(i / 5) * 5);
        const counts = {};
        for (const r of rounded) {
            counts[r] = (counts[r] || 0) + 1;
        }
        if (rounded.length >= 10) {
            const maxCount = Math.max(
                ...Object.values(counts)
            );
            const modeRatio =
                maxCount / rounded.length;
            if (
                modeRatio > 0.7 &&
                mean(intervals) > 80
            ) {
                penalty += 0.1;
                result.reasons.push(
                    `Machine-precise intervals: ` +
                    `${(modeRatio * 100)
                        .toFixed(0)}% identical`
                );
            }
        }
    }

    if (intervals.length >= 20) {
        const pauses =
            intervals.filter(
                (i) => i > 150
            ).length;
        const totalDur =
            points[points.length - 1].t -
            points[0].t;
        if (totalDur > 2000 && pauses < 2) {
            penalty += 0.06;
            result.reasons.push(
                `Continuous mouse movement: ` +
                `${pauses} pauses in ` +
                `${(totalDur / 1000)
                    .toFixed(1)}s`
            );
        }
    }

    if (velocities.length >= 20) {
        const avgVel = mean(velocities);
        let minima = 0;
        for (
            let i = 1;
            i < velocities.length - 1;
            i++
        ) {
            if (
                velocities[i] <
                    velocities[i - 1] &&
                velocities[i] <
                    velocities[i + 1] &&
                velocities[i] < avgVel * 0.3
            ) {
                minima++;
            }
        }
        const dur =
            (points[points.length - 1].t -
                points[0].t) /
            1000;
        const minimaRate =
            dur > 0 ? minima / dur : 0;
        if (minimaRate < 0.5 && dur > 2) {
            penalty += 0.06;
            result.reasons.push(
                `Few velocity minima: ` +
                `${minimaRate.toFixed(1)}/s ` +
                `(no corrective ` +
                `sub-movements)`
            );
        }
    }

    let teleports = 0;
    for (let i = 1; i < points.length; i++) {
        const d = dist(
            points[i - 1].x,
            points[i - 1].y,
            points[i].x,
            points[i].y
        );
        const dt =
            points[i].t - points[i - 1].t;
        if (d > 300 && dt < 10) teleports++;
    }
    if (teleports > 0) {
        penalty += Math.min(
            0.15, teleports * 0.08
        );
        result.reasons.push(
            `Mouse teleportation: ` +
            `${teleports} jumps`
        );
    }

    const originPoints = points.filter(
        (p) => p.x < 2 && p.y < 2
    ).length;
    if (originPoints >= 2) {
        penalty += 0.08;
        result.reasons.push(
            `${originPoints} points ` +
            `at origin (0,0)`
        );
    }

    if (points.length >= 20) {
        let smoothSegments = 0;
        let totalSegments = 0;
        for (
            let i = 3;
            i < points.length;
            i++
        ) {
            const ddx1 =
                points[i - 1].x -
                points[i - 2].x -
                (points[i - 2].x -
                    points[i - 3].x);
            const ddy1 =
                points[i - 1].y -
                points[i - 2].y -
                (points[i - 2].y -
                    points[i - 3].y);
            const ddx2 =
                points[i].x -
                points[i - 1].x -
                (points[i - 1].x -
                    points[i - 2].x);
            const ddy2 =
                points[i].y -
                points[i - 1].y -
                (points[i - 1].y -
                    points[i - 2].y);
            const accDiff = Math.sqrt(
                (ddx2 - ddx1) ** 2 +
                (ddy2 - ddy1) ** 2
            );
            if (accDiff < 1.5)
                smoothSegments++;
            totalSegments++;
        }
        if (totalSegments >= 15) {
            const smoothRatio =
                smoothSegments / totalSegments;
            if (smoothRatio > 0.85) {
                penalty += 0.1;
                result.reasons.push(
                    `Bezier-like curve: ` +
                    `${(smoothRatio * 100)
                        .toFixed(0)}% ` +
                    `constant acceleration`
                );
            }
        }
    }

    if (points.length >= 10) {
        const timestamps =
            points.map((p) => p.t);
        const nonInt =
            fractionNonInteger(timestamps);
        if (nonInt > 0.5) {
            penalty += 0.1;
            result.reasons.push(
                `Non-integer mouse ` +
                `timestamps: ` +
                `${(nonInt * 100)
                    .toFixed(0)}% fractional`
            );
        }
    }

    const precisions = points.map((p) =>
        Math.max(
            countDecimals(p.x),
            countDecimals(p.y)
        )
    );
    const avgPrecision = mean(precisions);
    if (avgPrecision > 6) {
        penalty += 0.15;
        result.reasons.push(
            `Synthetic coordinate ` +
            `precision: avg=` +
            `${avgPrecision.toFixed(1)} ` +
            `decimals`
        );
    } else if (avgPrecision > 3) {
        penalty += 0.08;
        result.reasons.push(
            `Unusual coordinate ` +
            `precision: avg=` +
            `${avgPrecision.toFixed(1)} ` +
            `decimals`
        );
    }

    if (points.length >= 30) {
        const xVals = points.map((p) => p.x);
        const yVals = points.map((p) => p.y);
        let maxCorr = 0;
        const maxLag = Math.min(
            Math.floor(points.length / 2), 50
        );
        for (
            let lag = 5;
            lag <= maxLag;
            lag++
        ) {
            const cx =
                autocorrelation(xVals, lag);
            const cy =
                autocorrelation(yVals, lag);
            maxCorr = Math.max(
                maxCorr,
                Math.abs(cx),
                Math.abs(cy)
            );
        }
        if (maxCorr > 0.7) {
            penalty += 0.1;
            result.reasons.push(
                `Periodic movement detected: ` +
                `corr=${maxCorr.toFixed(3)}`
            );
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeClicks(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.15,
    };
    const c = data.c;

    if (!c || c.length < 2) {
        if (
            c &&
            c.length === 0 &&
            data.dur > 5000
        ) {
            result.score = 0.05;
            result.reasons.push(
                'No clicks in extended session'
            );
        }
        return result;
    }

    let penalty = 0;
    const offsets = [];
    const dwells = [];

    for (const click of c) {
        const [ox, oy, dwell, tw, th] = click;
        if (tw > 0 && th > 0) {
            offsets.push(
                Math.sqrt(
                    (ox / (tw / 2)) ** 2 +
                    (oy / (th / 2)) ** 2
                )
            );
        }
        if (dwell >= 0) dwells.push(dwell);
    }

    if (offsets.length >= 3) {
        const centerClicks = offsets.filter(
            (o) => o < 0.05
        ).length;
        const centerRatio =
            centerClicks / offsets.length;

        if (centerRatio > 0.7) {
            penalty += 0.12;
            result.reasons.push(
                `${(centerRatio * 100)
                    .toFixed(0)}% ` +
                `center clicks ` +
                `(pixel-perfect)`
            );
        } else if (centerRatio > 0.5) {
            penalty += 0.06;
            result.reasons.push(
                `${(centerRatio * 100)
                    .toFixed(0)}% ` +
                `center clicks (suspicious)`
            );
        }

        const offsetStd = stddev(offsets);
        if (
            offsetStd < 0.02 &&
            offsets.length >= 5
        ) {
            penalty += 0.08;
            result.reasons.push(
                `Click offset variance ` +
                `too low: std=` +
                `${offsetStd.toFixed(4)}`
            );
        }
    }

    if (dwells.length >= 3) {
        const avgDwell = mean(dwells);
        const dwellCV = cv(dwells);

        if (avgDwell < 10) {
            penalty += 0.08;
            result.reasons.push(
                `Impossibly fast clicks: ` +
                `avg=${avgDwell.toFixed(0)}ms`
            );
        } else if (
            dwellCV < 0.05 &&
            dwells.length >= 5
        ) {
            penalty += 0.06;
            result.reasons.push(
                `Perfectly uniform click ` +
                `duration: ` +
                `CV=${dwellCV.toFixed(3)}`
            );
        }

        const zeroDwells = dwells.filter(
            (d) => d === 0
        ).length;
        if (zeroDwells > 0) {
            penalty += 0.08;
            result.reasons.push(
                `${zeroDwells} zero-duration ` +
                `clicks (dispatched events)`
            );
        }
    }

    if (dwells.length >= 3) {
        const nonInt =
            fractionNonInteger(dwells);
        if (nonInt > 0.5) {
            penalty += 0.08;
            result.reasons.push(
                `Non-integer click dwell ` +
                `times: ` +
                `${(nonInt * 100)
                    .toFixed(0)}% fractional`
            );
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzePreClick(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.1,
    };
    const m = data.m;
    const c = data.c;

    if (
        !m ||
        m.length < 10 ||
        !c ||
        c.length < 1
    ) {
        return result;
    }

    let penalty = 0;
    let noDecelCount = 0;
    let totalAnalyzed = 0;

    for (const click of c) {
        const clickTime = click[5];
        if (clickTime === undefined) continue;

        const preClickPoints = m.filter((p) => {
            const dt = clickTime - p[2];
            return dt > 0 && dt < 500;
        });

        if (preClickPoints.length < 4) continue;
        totalAnalyzed++;

        const vels = [];
        for (
            let i = 1;
            i < preClickPoints.length;
            i++
        ) {
            const dt =
                preClickPoints[i][2] -
                preClickPoints[i - 1][2];
            if (dt > 0) {
                const d = dist(
                    preClickPoints[i - 1][0],
                    preClickPoints[i - 1][1],
                    preClickPoints[i][0],
                    preClickPoints[i][1]
                );
                vels.push(d / dt);
            }
        }

        if (vels.length < 3) continue;

        const firstThird = vels.slice(
            0, Math.ceil(vels.length / 3)
        );
        const lastThird = vels.slice(
            -Math.ceil(vels.length / 3)
        );
        const avgFirst = mean(firstThird);
        const avgLast = mean(lastThird);

        if (
            avgFirst > 0.5 &&
            avgLast >= avgFirst * 0.9
        ) {
            noDecelCount++;
        }
    }

    if (
        totalAnalyzed >= 2 &&
        noDecelCount === totalAnalyzed
    ) {
        penalty += 0.08;
        result.reasons.push(
            `No pre-click deceleration ` +
            `in ${noDecelCount}/` +
            `${totalAnalyzed} clicks`
        );
    } else if (
        totalAnalyzed >= 3 &&
        noDecelCount > totalAnalyzed * 0.7
    ) {
        penalty += 0.04;
        result.reasons.push(
            `Minimal pre-click ` +
            `deceleration: ` +
            `${noDecelCount}/` +
            `${totalAnalyzed} clicks`
        );
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeKeystrokes(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.15,
    };
    const k = data.k;

    if (!k || k.length < 3) return result;

    let penalty = 0;
    const dwells = k
        .map((e) => e[0])
        .filter((d) => d > 0);
    const flights = k
        .map((e) => e[1])
        .filter((f) => f >= 0);

    if (dwells.length >= 3) {
        const dwellCV = cv(dwells);
        const avgDwell = mean(dwells);

        if (avgDwell < 5) {
            penalty += 0.1;
            result.reasons.push(
                `Key dwell impossibly ` +
                `short: avg=` +
                `${avgDwell.toFixed(1)}ms`
            );
        } else if (dwellCV < 0.08) {
            penalty += 0.08;
            result.reasons.push(
                `Uniform key dwell: ` +
                `CV=${dwellCV.toFixed(3)} ` +
                `(robotic)`
            );
        }

        const uniqueDwells = new Set(
            dwells.map((d) => Math.round(d))
        ).size;
        if (
            uniqueDwells === 1 &&
            dwells.length >= 5
        ) {
            penalty += 0.1;
            result.reasons.push(
                'All key dwells identical'
            );
        }
    }

    if (flights.length >= 3) {
        const flightCV = cv(flights);
        const tooFast = flights.filter(
            (f) => f > 0 && f < 15
        ).length;
        if (tooFast > flights.length * 0.3) {
            penalty += 0.1;
            result.reasons.push(
                `${tooFast} impossibly fast ` +
                `key transitions (<15ms)`
            );
        }

        if (
            flightCV < 0.08 &&
            flights.length >= 5
        ) {
            penalty += 0.08;
            result.reasons.push(
                `Uniform flight time: ` +
                `CV=${flightCV.toFixed(3)}`
            );
        }
    }

    const timings = [];
    for (
        let i = 0;
        i < Math.min(
            dwells.length, flights.length
        );
        i++
    ) {
        timings.push(dwells[i], flights[i]);
    }
    if (timings.length >= 10) {
        const rhythmEntropy =
            shannonEntropy(timings, 15);
        if (rhythmEntropy < 1.5) {
            penalty += 0.06;
            result.reasons.push(
                `Low rhythm entropy: ` +
                `${rhythmEntropy.toFixed(2)} ` +
                `(mechanical)`
            );
        }
    }

    const allTimings = [
        ...dwells, ...flights,
    ];
    if (allTimings.length >= 6) {
        const nonInt =
            fractionNonInteger(allTimings);
        if (nonInt > 0.5) {
            penalty += 0.1;
            result.reasons.push(
                `Non-integer key timing: ` +
                `${(nonInt * 100)
                    .toFixed(0)}% fractional`
            );
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeScroll(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.1,
    };
    const s = data.s;

    if (!s || s.length < 3) return result;

    let penalty = 0;
    const deltas = s.map((e) => e[1]);
    const times = s.map((e) => e[2]);

    const velocities = [];
    for (let i = 1; i < s.length; i++) {
        const dt = times[i] - times[i - 1];
        if (dt > 0)
            velocities.push(
                Math.abs(deltas[i]) / dt
            );
    }

    if (velocities.length >= 5) {
        const velCV = cv(velocities);
        if (velCV < 0.15) {
            penalty += 0.06;
            result.reasons.push(
                `Constant scroll velocity: ` +
                `CV=${velCV.toFixed(3)}`
            );
        }
    }

    let reversals = 0;
    for (let i = 1; i < deltas.length; i++) {
        if (deltas[i] * deltas[i - 1] < 0)
            reversals++;
    }
    if (
        reversals === 0 &&
        deltas.length >= 10
    ) {
        penalty += 0.04;
        result.reasons.push(
            'No scroll direction reversals'
        );
    }

    let pauses = 0;
    for (let i = 1; i < times.length; i++) {
        if (times[i] - times[i - 1] > 300)
            pauses++;
    }
    if (pauses === 0 && times.length >= 10) {
        penalty += 0.04;
        result.reasons.push(
            'No scroll pauses ' +
            '(continuous scrolling)'
        );
    }

    if (deltas.length >= 5) {
        const absDelta = deltas
            .map(Math.abs)
            .filter((d) => d > 0);
        const deltaCV = cv(absDelta);
        if (
            deltaCV < 0.05 &&
            absDelta.length >= 5
        ) {
            penalty += 0.05;
            result.reasons.push(
                `Uniform scroll deltas: ` +
                `CV=${deltaCV.toFixed(3)}`
            );
        }
    }

    if (times.length >= 3) {
        const nonInt =
            fractionNonInteger(times);
        if (nonInt > 0.5) {
            penalty += 0.05;
            result.reasons.push(
                `Non-integer scroll ` +
                `timestamps: ` +
                `${(nonInt * 100)
                    .toFixed(0)}% fractional`
            );
        }
    }

    if (s.length >= 3) {
        const positions =
            s.map((e) => e[0]);
        const posNonInt =
            fractionNonInteger(positions);
        if (posNonInt > 0.5) {
            penalty += 0.04;
            result.reasons.push(
                `Non-integer scroll ` +
                `positions: ` +
                `${(posNonInt * 100)
                    .toFixed(0)}% fractional`
            );
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeTouch(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.1,
    };
    const tc = data.tc;

    if (!tc || tc.length < 5) return result;

    let penalty = 0;
    const pressures = tc
        .map((e) => e[2])
        .filter((p) => p > 0);
    const radiiX = tc
        .map((e) => e[3])
        .filter((r) => r > 0);
    const radiiY = tc
        .map((e) => e[4])
        .filter((r) => r > 0);

    if (pressures.length >= 5) {
        const pressCV = cv(pressures);
        if (pressCV < 0.01) {
            penalty += 0.06;
            result.reasons.push(
                `No pressure variation: ` +
                `CV=${pressCV.toFixed(4)} ` +
                `(synthetic touch)`
            );
        }
    } else if (tc.length >= 10) {
        penalty += 0.04;
        result.reasons.push(
            'Touch events without ' +
            'pressure data'
        );
    }

    if (radiiX.length >= 5) {
        const rxCV = cv(radiiX);
        const ryCV = cv(radiiY);
        if (rxCV < 0.01 && ryCV < 0.01) {
            penalty += 0.05;
            result.reasons.push(
                'Zero contact area variation ' +
                '(point-touch)'
            );
        }
    }

    const gestures = [];
    let current = [tc[0]];
    for (let i = 1; i < tc.length; i++) {
        if (
            tc[i][5] - tc[i - 1][5] > 100
        ) {
            if (current.length >= 3)
                gestures.push(current);
            current = [];
        }
        current.push(tc[i]);
    }
    if (current.length >= 3)
        gestures.push(current);

    for (const gesture of gestures) {
        if (gesture.length < 5) continue;

        const start = gesture[0];
        const end =
            gesture[gesture.length - 1];
        const lineLen = dist(
            start[0], start[1],
            end[0], end[1]
        );
        if (lineLen < 10) continue;

        const deviations = [];
        for (
            let i = 1;
            i < gesture.length - 1;
            i++
        ) {
            const p = gesture[i];
            const cross = Math.abs(
                (end[0] - start[0]) *
                (start[1] - p[1]) -
                (start[0] - p[0]) *
                (end[1] - start[1])
            );
            deviations.push(
                cross / lineLen
            );
        }

        const wobbleRMS = Math.sqrt(
            mean(
                deviations.map((d) => d * d)
            )
        );
        if (
            wobbleRMS < 0.3 &&
            gesture.length >= 8
        ) {
            penalty += 0.04;
            result.reasons.push(
                `Geometrically perfect ` +
                `swipe: wobble=` +
                `${wobbleRMS.toFixed(2)}px`
            );
        }

        if (gesture.length >= 6) {
            const midVelocities = [];
            const endVelocities = [];
            const midEnd = Math.floor(
                gesture.length * 0.6
            );

            for (
                let i = 1;
                i < gesture.length;
                i++
            ) {
                const d = dist(
                    gesture[i - 1][0],
                    gesture[i - 1][1],
                    gesture[i][0],
                    gesture[i][1]
                );
                const dt =
                    gesture[i][5] -
                    gesture[i - 1][5];
                if (dt > 0) {
                    const v = d / dt;
                    if (i < midEnd)
                        midVelocities.push(v);
                    else
                        endVelocities.push(v);
                }
            }

            if (
                midVelocities.length >= 2 &&
                endVelocities.length >= 2
            ) {
                const midAvg =
                    mean(midVelocities);
                const endAvg =
                    mean(endVelocities);
                if (
                    midAvg > 0 &&
                    endAvg >= midAvg * 0.95
                ) {
                    penalty += 0.03;
                    result.reasons.push(
                        'No end-of-swipe ' +
                        'deceleration'
                    );
                }
            }
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeSensors(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.1,
    };
    const ac = data.ac;
    const gy = data.gy;
    const or = data.or;

    const hasTouchScreen =
        data.meta?.hasTouchScreen;
    const hasMotionSensors =
        data.meta?.hasMotionSensors;

    if (hasTouchScreen && !hasMotionSensors) {
        result.score = 0.03;
        result.reasons.push(
            'Touch device without ' +
            'motion sensors'
        );
        return result;
    }

    if (!ac || ac.length < 5) return result;

    let penalty = 0;
    const acX = ac.map((e) => e[0]);
    const acY = ac.map((e) => e[1]);
    const acZ = ac.map((e) => e[2]);

    const noiseX = stddev(acX);
    const noiseY = stddev(acY);
    const noiseZ = stddev(acZ);
    const totalNoise =
        noiseX + noiseY + noiseZ;

    if (totalNoise < 0.001) {
        penalty += 0.08;
        result.reasons.push(
            'Zero accelerometer noise ' +
            '(emulated or static)'
        );
    } else if (totalNoise < 0.01) {
        penalty += 0.04;
        result.reasons.push(
            `Very low accelerometer ` +
            `noise: ` +
            `${totalNoise.toFixed(4)}`
        );
    }

    const allZero = ac.every(
        (e) =>
            e[0] === 0 &&
            e[1] === 0 &&
            e[2] === 0
    );
    if (allZero) {
        penalty += 0.08;
        result.reasons.push(
            'All accelerometer readings ' +
            'zero (emulated)'
        );
    }

    if (gy && gy.length >= 5) {
        const gyAlpha =
            gy.map((e) => e[0]);
        const gyBeta =
            gy.map((e) => e[1]);
        const gyGamma =
            gy.map((e) => e[2]);
        const gyNoise =
            stddev(gyAlpha) +
            stddev(gyBeta) +
            stddev(gyGamma);

        if (
            gyNoise < 0.0001 &&
            gy.length >= 10
        ) {
            penalty += 0.05;
            result.reasons.push(
                'Zero gyroscope variation ' +
                '(no hand tremor)'
            );
        }
    }

    if (or && or.length >= 5) {
        const first = or[0];
        const last = or[or.length - 1];
        const totalDrift =
            Math.abs(last[0] - first[0]) +
            Math.abs(last[1] - first[1]) +
            Math.abs(last[2] - first[2]);
        const duration =
            (last[3] - first[3]) / 1000;

        if (
            totalDrift < 0.01 &&
            duration > 3
        ) {
            penalty += 0.04;
            result.reasons.push(
                'Zero orientation drift ' +
                '(perfectly static)'
            );
        }
    }

    if (ac.length >= 20) {
        if (
            noiseX > 0.1 &&
            noiseY < 0.001 &&
            noiseZ < 0.001
        ) {
            penalty += 0.03;
            result.reasons.push(
                'Single-axis accelerometer ' +
                'noise (fabricated)'
            );
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeEventOrder(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.05,
    };
    const ev = data.ev;

    if (!ev || ev.length < 5) return result;

    let penalty = 0;

    let orphanClicks = 0;
    for (let i = 0; i < ev.length; i++) {
        if (ev[i][0] === 3) {
            let foundDown = false;
            let foundUp = false;
            for (
                let j = i - 1;
                j >= Math.max(0, i - 10);
                j--
            ) {
                if (ev[j][0] === 2)
                    foundUp = true;
                if (
                    ev[j][0] === 1 && foundUp
                ) {
                    foundDown = true;
                    break;
                }
                if (
                    ev[j][0] === 1 && !foundUp
                )
                    break;
            }
            if (!foundDown || !foundUp)
                orphanClicks++;
        }
    }
    if (orphanClicks > 0) {
        penalty += Math.min(
            0.04, orphanClicks * 0.02
        );
        result.reasons.push(
            `${orphanClicks} clicks without ` +
            `mousedown/mouseup sequence`
        );
    }

    let orphanKeyups = 0;
    const pendingKeys = new Set();
    for (const [type] of ev) {
        if (type === 4)
            pendingKeys.add(type);
        if (type === 5) {
            if (pendingKeys.size === 0)
                orphanKeyups++;
            else pendingKeys.clear();
        }
    }
    if (orphanKeyups > 2) {
        penalty += 0.02;
        result.reasons.push(
            `${orphanKeyups} keyup events ` +
            `without keydown`
        );
    }

    for (let i = 1; i < ev.length; i++) {
        if (
            ev[i - 1][0] === 1 &&
            ev[i][0] === 2 &&
            ev[i][1] === ev[i - 1][1]
        ) {
            penalty += 0.03;
            result.reasons.push(
                'Zero-time mousedown/' +
                'mouseup (dispatched)'
            );
            break;
        }
    }

    let touchMovesWithoutStart = 0;
    let inTouch = false;
    for (const [type] of ev) {
        if (type === 7) inTouch = true;
        if (type === 8 && !inTouch)
            touchMovesWithoutStart++;
        if (type === 9) inTouch = false;
    }
    if (touchMovesWithoutStart > 0) {
        penalty += 0.02;
        result.reasons.push(
            `${touchMovesWithoutStart} ` +
            `touchmove without touchstart`
        );
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeEngagement(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.05,
    };

    let penalty = 0;
    const ttfi = data.ttfi || 0;
    const dur = data.dur || 0;

    if (ttfi > 0 && ttfi < 50) {
        penalty += 0.03;
        result.reasons.push(
            `Impossibly fast first ` +
            `interaction: ${ttfi}ms`
        );
    }

    if (dur > 0 && dur < 500) {
        const totalEvents =
            (data.m?.length || 0) +
            (data.c?.length || 0) +
            (data.k?.length || 0);
        if (totalEvents > 50) {
            penalty += 0.03;
            result.reasons.push(
                `${totalEvents} events in ` +
                `${dur}ms (burst)`
            );
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyzeSyntheticEvents(data) {
    const result = {
        score: 0,
        reasons: [],
        maxPenalty: 0.15,
    };
    const c = data.c;
    const k = data.k;
    const ev = data.ev;

    let penalty = 0;

    const fastClicks =
        c &&
        c.length >= 2 &&
        c.filter((click) => click[2] < 5)
            .length >
            c.length * 0.5;
    const fastKeys =
        k &&
        k.length >= 3 &&
        k.filter((key) => key[0] < 5).length >
            k.length * 0.5;

    if (fastClicks && fastKeys) {
        penalty += 0.1;
        result.reasons.push(
            'Clicks and keystrokes both ' +
            'impossibly fast ' +
            '(automated dispatch)'
        );
    } else if (fastClicks) {
        penalty += 0.04;
        result.reasons.push(
            'Automated click dispatch ' +
            'pattern'
        );
    } else if (fastKeys) {
        penalty += 0.04;
        result.reasons.push(
            'Automated keystroke dispatch ' +
            'pattern'
        );
    }

    if (ev && ev.length >= 10) {
        let zeroTimeClicks = 0;
        for (let i = 1; i < ev.length; i++) {
            if (
                ev[i - 1][0] === 1 &&
                ev[i][0] === 2 &&
                ev[i][1] === ev[i - 1][1]
            ) {
                zeroTimeClicks++;
            }
        }
        if (zeroTimeClicks >= 2) {
            penalty += 0.05;
            result.reasons.push(
                `${zeroTimeClicks} zero-time ` +
                `mousedown/mouseup pairs`
            );
        }
    }

    result.score = Math.min(
        penalty, result.maxPenalty
    );
    return result;
}

function analyze(data) {
    const categories = {
        mouse: analyzeMouse(data),
        clicks: analyzeClicks(data),
        preClick: analyzePreClick(data),
        keystrokes: analyzeKeystrokes(data),
        scroll: analyzeScroll(data),
        touch: analyzeTouch(data),
        sensors: analyzeSensors(data),
        eventOrder: analyzeEventOrder(data),
        engagement: analyzeEngagement(data),
        synthetic:
            analyzeSyntheticEvents(data),
    };

    let totalPenalty = 0;
    const allReasons = [];

    for (const [name, cat]
        of Object.entries(categories)) {
        totalPenalty += cat.score;
        for (const reason of cat.reasons) {
            allReasons.push(
                `[${name}] ${reason}`
            );
        }
    }

    const score = Math.max(
        0, Math.min(1, 1.0 - totalPenalty)
    );

    return {
        score:
            Math.round(score * 1000) / 1000,
        penalty:
            Math.round(totalPenalty * 1000) /
            1000,
        reasons: allReasons,
        categories: Object.fromEntries(
            Object.entries(categories).map(
                ([k, v]) => [
                    k,
                    {
                        penalty:
                            Math.round(
                                v.score * 1000
                            ) / 1000,
                        maxPenalty:
                            v.maxPenalty,
                        reasons: v.reasons,
                    },
                ]
            )
        ),
    };
}

function classifyScore(score) {
    if (score >= 0.5) return 'human';
    if (score >= 0.3) return 'suspicious';
    return 'bot';
}

export {
    createCollector,
    serializeInteractions,
    deserializeInteractions,
    MOTION_CATEGORIES,
    DEFAULT_LIMITS,
    analyze,
    classifyScore,
    analyzeMouse,
    analyzeClicks,
    analyzePreClick,
    analyzeKeystrokes,
    analyzeScroll,
    analyzeTouch,
    analyzeSensors,
    analyzeEventOrder,
    analyzeEngagement,
    analyzeSyntheticEvents,
    mean,
    stddev,
    cv,
    shannonEntropy,
    countDecimals,
    autocorrelation,
    fractionNonInteger,
};
