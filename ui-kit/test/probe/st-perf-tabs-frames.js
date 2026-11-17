/**
 * NVUI Kit · ST 精测探针 III（#9 判定依据 · 是否真的掉帧）
 *
 * 上一轮测到「每次 tab 切换累计 21.89ms 布局耗时」——但这是**跨整个过渡期
 * （约 300ms ≈ 18 帧）累计**的，并不等于单帧卡顿。
 *
 * 本轮直接测**帧间隔**：过渡期间 rAF 相邻帧的间隔分布。
 * 判定标准：60fps 帧预算 16.7ms，若 p95 帧间隔 <= 20ms（允许偶发 1 帧超预算），
 *           则该过渡**不产生可感知卡顿** → 待办结论应改判。
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];

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

    await page.evaluate(() => {
        const host = document.createElement('div');
        host.id = 'perf-tabs-host';
        host.style.cssText = 'position:fixed;left:0;top:0;width:600px;height:120px;z-index:-1;';
        const nav = document.createElement('nav');
        nav.className = 'nvui-tabs is-indicator';
        const ind = document.createElement('span');
        ind.className = 'nvui-tabs-indicator';
        ind.id = 'perf-tabs-ind';
        nav.appendChild(ind);
        for (let t = 0; t < 3; t++) {
            const b = document.createElement('button');
            b.className = 'nvui-tab';
            b.textContent = 'Tab' + t;
            nav.appendChild(b);
        }
        host.appendChild(nav);
        document.body.appendChild(host);
    });
    await page.waitForTimeout(300);

    /* 在**真实酒馆页面**里跑：酒馆自身有持续的 DOM 活动（消息渲染等），
       这样测到的帧间隔才反映真实宿主环境下的表现。 */
    const result = await page.evaluate(async () => {
        const ind = document.getElementById('perf-tabs-ind');

        function sampleFrames(ms, mutate) {
            return new Promise((resolve) => {
                const deltas = [];
                let last = performance.now();
                const t0 = last;
                let mutated = false;
                function tick(now) {
                    deltas.push(now - last);
                    last = now;
                    if (!mutated && now - t0 > 120) { mutated = true; mutate(); }
                    if (now - t0 < ms) requestAnimationFrame(tick);
                    else {
                        const sorted = deltas.slice().sort((a, b) => a - b);
                        resolve({
                            frames: deltas.length,
                            median: sorted[Math.floor(sorted.length / 2)],
                            p95: sorted[Math.floor(sorted.length * 0.95)],
                            max: sorted[sorted.length - 1],
                            over16_7: deltas.filter((d) => d > 16.7).length,
                            over33: deltas.filter((d) => d > 33).length,
                        });
                    }
                }
                requestAnimationFrame(tick);
            });
        }

        const out = {};

        // 基线：不触发指示器动画
        out.baseline = await sampleFrames(1200, () => {});

        // A：现状 width/height 过渡
        ind.removeAttribute('style');
        ind.style.setProperty('--nvui-tab-ind-w', '100px');
        ind.style.setProperty('--nvui-tab-ind-h', '2px');
        ind.style.setProperty('--nvui-tab-ind-x', '20px');
        await new Promise((r) => setTimeout(r, 400));
        out.widthTransition = await sampleFrames(1200, () => {
            ind.style.setProperty('--nvui-tab-ind-w', '160px');
            ind.style.setProperty('--nvui-tab-ind-x', '120px');
        });

        // C：transform 缩放（合成器方案，作为上限参照）
        ind.removeAttribute('style');
        ind.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0, 1)';
        ind.style.width = '600px';
        ind.style.height = '2px';
        ind.style.transformOrigin = 'left center';
        ind.style.transform = 'translateX(20px) scaleX(100 / 600)';
        await new Promise((r) => setTimeout(r, 400));
        out.transformScale = await sampleFrames(1200, () => {
            ind.style.transform = 'translateX(120px) scaleX(160 / 600)';
        });

        return out;
    });

    console.log('=== #9 帧间隔判定（真实酒馆页面，含宿主自身活动） ===');
    const fmt = (s) => `中位 ${s.median.toFixed(2)}ms  p95 ${s.p95.toFixed(2)}ms  max ${s.max.toFixed(2)}ms  ` +
        `超 16.7ms 帧: ${s.over16_7}/${s.frames}  超 33ms: ${s.over33}`;
    console.log('  基线（无动画）      ', fmt(result.baseline));
    console.log('  A width/height 过渡 ', fmt(result.widthTransition));
    console.log('  C transform 缩放    ', fmt(result.transformScale));

    console.log('\n=== 判定 ===');
    const aOver = result.widthTransition.over16_7;
    const bOver = result.baseline.over16_7;
    const aP95 = result.widthTransition.p95;
    const pass = aP95 <= 20 && aOver <= bOver + 3;
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] width/height 过渡未造成可感知卡顿` +
        `（p95=${aP95.toFixed(2)}ms 阈值 20ms；超预算帧 ${aOver} vs 基线 ${bOver}）`);

    fs.writeFileSync(path.join(OUT, 'tabs-frames.json'), JSON.stringify({ result, errors }, null, 2));
    console.log('\n控制台错误:', errors.length ? errors.join(' | ') : '(无)');
    await browser.close();
})();
