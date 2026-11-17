/**
 * NVUI Kit · ST 实机性能探针
 *
 * 目的：用真实宿主（而非凭印象）测量 ISSUES.md 待办区各项的**实际代价**，
 * 为「修 / 不修」提供数据依据。
 *
 * 方法：Chrome DevTools Protocol 的 `Performance.getMetrics` 前后差值 →
 *       LayoutCount（布局次数）/ LayoutDuration（布局耗时）/ RecalcStyleCount。
 *       每个场景跑 A/B 对照：
 *         A = kit 当前实现（如 width 过渡）
 *         B = 假设的替代实现（如 transform 缩放）
 *       若 B 的布局增量并不显著低于 A，说明该待办的「性能风险」缺乏实据，
 *       应当撤销或改判，而不是引入破坏性变更。
 *
 * 用法：node test/st-perf-probe.js <输出目录>
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];

function check(pass, name, detail) {
    const mark = pass ? 'PASS' : 'FAIL';
    console.log(`[${mark}] ${name}${detail ? '  ->  ' + detail : ''}`);
    return pass;
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);

    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');

    async function metrics() {
        const { metrics } = await cdp.send('Performance.getMetrics');
        const map = {};
        metrics.forEach((m) => { map[m.name] = m.value; });
        return map;
    }

    const R = {};

    /* ------------------------------------------------------------------
     * 场景 1（#8）：进度条宽度过渡 vs transform 缩放
     * ------------------------------------------------------------------ */
    R.progress = await page.evaluate(async () => {
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:200px;z-index:-1;';
        document.body.appendChild(host);

        function runA() {
            // A：kit 当前实现 —— .nvui-progress-bar 用 width 过渡
            const track = document.createElement('div');
            track.className = 'nvui-progress';
            const bar = document.createElement('span');
            bar.className = 'nvui-progress-bar';
            track.appendChild(bar);
            host.appendChild(track);
            return new Promise((resolve) => {
                requestAnimationFrame(() => {
                    bar.style.width = '80%';
                    setTimeout(() => { track.remove(); resolve(); }, 600);
                });
            });
        }

        function runB() {
            // B：假设的替代实现 —— 固定 100% 宽 + transform: scaleX
            const track = document.createElement('div');
            track.className = 'nvui-progress';
            const bar = document.createElement('span');
            bar.className = 'nvui-progress-bar';
            bar.style.width = '100%';
            bar.style.transform = 'scaleX(0)';
            bar.style.transformOrigin = 'left center';
            bar.style.transition = 'none';
            track.appendChild(bar);
            host.appendChild(track);
            return new Promise((resolve) => {
                requestAnimationFrame(() => {
                    bar.style.transition = 'transform 400ms cubic-bezier(0.2, 0, 0, 1)';
                    bar.style.transform = 'scaleX(0.8)';
                    setTimeout(() => { track.remove(); resolve(); }, 600);
                });
            });
        }

        return { runA, runB };
    });

    async function measure(fn, iterations) {
        const before = await metrics();
        for (let i = 0; i < iterations; i++) {
            await page.evaluate((n) => {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:200px;z-index:-1;';
                document.body.appendChild(host);
                if (n === 'A') {
                    const track = document.createElement('div');
                    track.className = 'nvui-progress';
                    const bar = document.createElement('span');
                    bar.className = 'nvui-progress-bar';
                    track.appendChild(bar);
                    host.appendChild(track);
                    requestAnimationFrame(() => {
                        bar.style.width = '80%';
                        setTimeout(() => track.remove(), 500);
                    });
                } else {
                    const track = document.createElement('div');
                    track.className = 'nvui-progress';
                    const bar = document.createElement('span');
                    bar.className = 'nvui-progress-bar';
                    bar.style.width = '100%';
                    bar.style.transform = 'scaleX(0)';
                    bar.style.transformOrigin = 'left center';
                    bar.style.transition = 'none';
                    track.appendChild(bar);
                    host.appendChild(track);
                    requestAnimationFrame(() => {
                        bar.style.transition = 'transform 400ms cubic-bezier(0.2, 0, 0, 1)';
                        bar.style.transform = 'scaleX(0.8)';
                        setTimeout(() => track.remove(), 500);
                    });
                }
            }, fn);
            await page.waitForTimeout(560);
        }
        const after = await metrics();
        return {
            layoutCount: after.LayoutCount - before.LayoutCount,
            layoutDurationMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
            recalcCount: after.RecalcStyleCount - before.RecalcStyleCount,
            recalcDurationMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
        };
    }

    const ITER = 5;
    R.progress.widthTransition = await measure('A', ITER);
    R.progress.transformScale = await measure('B', ITER);

    /* ------------------------------------------------------------------
     * 场景 2（#9）：tabs 指示器 width/height 过渡 vs transform
     * ------------------------------------------------------------------ */
    async function measureTabs(kind) {
        const before = await metrics();
        for (let i = 0; i < ITER; i++) {
            await page.evaluate((k) => {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:120px;z-index:-1;';
                document.body.appendChild(host);
                const nav = document.createElement('nav');
                nav.className = 'nvui-tabs is-indicator';
                const ind = document.createElement('span');
                ind.className = 'nvui-tabs-indicator';
                nav.appendChild(ind);
                for (let t = 0; t < 3; t++) {
                    const b = document.createElement('button');
                    b.className = 'nvui-tab';
                    b.textContent = 'Tab' + t;
                    nav.appendChild(b);
                }
                host.appendChild(nav);
                requestAnimationFrame(() => {
                    if (k === 'A') {
                        ind.style.setProperty('--nvui-tab-ind-w', '100px');
                        ind.style.setProperty('--nvui-tab-ind-h', '2px');
                        ind.style.setProperty('--nvui-tab-ind-x', '20px');
                    } else {
                        ind.style.width = '100px';
                        ind.style.height = '2px';
                        ind.style.transform = 'translateX(20px) scaleX(0)';
                        ind.style.transformOrigin = 'left center';
                    }
                    setTimeout(() => {
                        if (k === 'A') {
                            ind.style.setProperty('--nvui-tab-ind-w', '160px');
                            ind.style.setProperty('--nvui-tab-ind-x', '120px');
                        } else {
                            ind.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0, 1)';
                            ind.style.transform = 'translateX(120px) scaleX(1)';
                        }
                        setTimeout(() => host.remove(), 400);
                    }, 60);
                });
            }, kind);
            await page.waitForTimeout(520);
        }
        const after = await metrics();
        return {
            layoutCount: after.LayoutCount - before.LayoutCount,
            layoutDurationMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
            recalcCount: after.RecalcStyleCount - before.RecalcStyleCount,
        };
    }
    R.tabs = {};
    R.tabs.widthHeight = await measureTabs('A');
    R.tabs.transform = await measureTabs('B');

    /* ------------------------------------------------------------------
     * 场景 3（#10）：折叠面板 grid-template-rows 过渡
     * ------------------------------------------------------------------ */
    async function measureAcc() {
        const before = await metrics();
        for (let i = 0; i < ITER; i++) {
            await page.evaluate(() => {
                const host = document.createElement('div');
                host.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:300px;z-index:-1;';
                document.body.appendChild(host);
                const acc = document.createElement('div');
                acc.className = 'nvui-acc';
                const head = document.createElement('button');
                head.className = 'nvui-acc-head';
                head.textContent = 'head';
                const body = document.createElement('div');
                body.className = 'nvui-acc-body';
                const inner = document.createElement('div');
                inner.className = 'nvui-acc-inner';
                for (let p = 0; p < 12; p++) {
                    const line = document.createElement('p');
                    line.textContent = 'line ' + p;
                    inner.appendChild(line);
                }
                body.appendChild(inner);
                acc.appendChild(head);
                acc.appendChild(body);
                host.appendChild(acc);
                requestAnimationFrame(() => {
                    acc.classList.add('is-open');
                    setTimeout(() => host.remove(), 600);
                });
            });
            await page.waitForTimeout(680);
        }
        const after = await metrics();
        return {
            layoutCount: after.LayoutCount - before.LayoutCount,
            layoutDurationMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
            recalcCount: after.RecalcStyleCount - before.RecalcStyleCount,
        };
    }
    R.accordion = await measureAcc();

    /* ------------------------------------------------------------------
     * 场景 4（#12）：双层 backdrop-filter（遮罩全屏 blur + 面板 blur）
     * 用长任务帧耗时（rAF 间隔）近似衡量合成成本。
     * ------------------------------------------------------------------ */
    async function measureBlur(double) {
        return await page.evaluate(async (dbl) => {
            function sample(ms) {
                return new Promise((resolve) => {
                    const deltas = [];
                    let last = performance.now();
                    const t0 = last;
                    function tick(now) {
                        deltas.push(now - last);
                        last = now;
                        if (now - t0 < ms) requestAnimationFrame(tick);
                        else {
                            deltas.sort((a, b) => a - b);
                            resolve({
                                frames: deltas.length,
                                median: deltas[Math.floor(deltas.length / 2)],
                                p95: deltas[Math.floor(deltas.length * 0.95)],
                                max: deltas[deltas.length - 1],
                            });
                        }
                    }
                    requestAnimationFrame(tick);
                });
            }
            const baseline = await sample(1200);
            const ov = document.createElement('div');
            ov.className = 'nvui-overlay';
            ov.style.cssText = 'position:fixed;inset:0;z-index:999999;';
            const pnl = document.createElement('div');
            pnl.className = 'nvui-panel';
            pnl.style.cssText = 'position:fixed;left:280px;top:100px;width:880px;height:600px;';
            ov.appendChild(pnl);
            document.body.appendChild(ov);
            if (!dbl) pnl.style.backdropFilter = 'none';
            await new Promise((r) => setTimeout(r, 400));
            const during = await sample(1200);
            ov.remove();
            return { baseline, during };
        }, double);
    }
    R.blur = {};
    R.blur.double = await measureBlur(true);
    R.blur.single = await measureBlur(false);

    /* ---------------- 判定 ---------------- */
    console.log('\n=== 实机性能数据（真实 SillyTavern 宿主） ===');
    console.log(JSON.stringify(R, null, 2));

    console.log('\n=== 判定 ===');
    const p = R.progress;
    // 每次动画理论至少 1 次布局；若 width 过渡与 transform 的布局次数接近，
    // 说明浏览器已把 width 过渡优化到「每帧一次」，代价比预估小得多。
    const pA = p.widthTransition.layoutCount / ITER;
    const pB = p.transformScale.layoutCount / ITER;
    check(pA <= pB + 2, '#8 进度条：width 过渡的布局次数未显著高于 transform 对照',
        `A(width)=${pA.toFixed(1)} 次/动画, B(transform)=${pB.toFixed(1)} 次/动画, ` +
        `布局耗时 A=${p.widthTransition.layoutDurationMs.toFixed(1)}ms / B=${p.transformScale.layoutDurationMs.toFixed(1)}ms`);

    const tA = R.tabs.widthHeight.layoutCount / ITER;
    const tB = R.tabs.transform.layoutCount / ITER;
    check(tA <= tB + 2, '#9 tabs 指示器：width/height 过渡的布局次数未显著高于 transform 对照',
        `A=${tA.toFixed(1)} 次/动画, B=${tB.toFixed(1)} 次/动画, ` +
        `布局耗时 A=${R.tabs.widthHeight.layoutDurationMs.toFixed(1)}ms / B=${R.tabs.transform.layoutDurationMs.toFixed(1)}ms`);

    check(R.accordion.layoutDurationMs < 60, '#10 折叠面板：grid-template-rows 过渡的单次总布局耗时可接受',
        `${ITER} 次展开共 ${R.accordion.layoutDurationMs.toFixed(1)}ms（${(R.accordion.layoutDurationMs / ITER).toFixed(1)}ms/次）, ` +
        `布局次数 ${R.accordion.layoutCount}`);

    const bDouble = R.blur.double.during.p95;
    const bSingle = R.blur.single.during.p95;
    check(bDouble >= bSingle, '#12 双层 backdrop-filter：已采到双层与单层的帧耗时对照（p95 双层 / 单层）',
        `双层 p95=${bDouble.toFixed(2)}ms, 单层 p95=${bSingle.toFixed(2)}ms, 基线 p95=${R.blur.double.baseline.p95.toFixed(2)}ms`);

    console.log(`\n控制台错误: ${errors.length ? errors.join(' | ') : '(无)'}`);

    fs.writeFileSync(path.join(OUT, 'perf.json'), JSON.stringify({ R, errors }, null, 2));
    await browser.close();
})();
