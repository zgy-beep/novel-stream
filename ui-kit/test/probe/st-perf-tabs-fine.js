/**
 * NVUI Kit · ST 精测探针（#9 tabs 指示器）
 *
 * 与 st-perf-probe.js 的区别：**把「创建/销毁 DOM」的成本与「纯动画」的成本分离**。
 * 元素预先建好并留在文档里，只反复修改 CSS 变量，测动画期间的真实布局增量。
 *
 * 三组对照：
 *   A  当前实现：width/height 过渡（kit 现状）
 *   B  无过渡：直接改 width/height（只有一次布局，测「每帧重排」的增量）
 *   C  transform 方案：固定基准宽 + scaleX（合成器方案，需改 JS 契约）
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

    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Performance.enable');
    async function metrics() {
        const { metrics } = await cdp.send('Performance.getMetrics');
        const map = {};
        metrics.forEach((m) => { map[m.name] = m.value; });
        return map;
    }

    /* 预建 DOM 并常驻，避免把创建成本计入动画成本 */
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

    const ITER = 8;

    async function run(kind) {
        // 预热一轮，不计入
        await page.evaluate((k) => {
            const ind = document.getElementById('perf-tabs-ind');
            if (k === 'A') {
                ind.style.transition = '';
                ind.style.width = '';
                ind.style.height = '';
                ind.style.transform = '';
                ind.style.setProperty('--nvui-tab-ind-w', '100px');
                ind.style.setProperty('--nvui-tab-ind-h', '2px');
                ind.style.setProperty('--nvui-tab-ind-x', '10px');
            } else if (k === 'B') {
                ind.style.transition = 'none';
                ind.style.width = '100px';
                ind.style.height = '2px';
                ind.style.transform = 'translateX(10px)';
            } else {
                ind.style.transition = 'transform 300ms cubic-bezier(0.2, 0, 0, 1)';
                ind.style.width = '600px';
                ind.style.height = '2px';
                ind.style.transformOrigin = 'left center';
                ind.style.transform = 'translateX(10px) scaleX(100 / 600)';
            }
        }, kind);
        await page.waitForTimeout(400);

        const before = await metrics();
        for (let i = 0; i < ITER; i++) {
            await page.evaluate(({ k, i }) => {
                const ind = document.getElementById('perf-tabs-ind');
                if (k === 'A') {
                    ind.style.setProperty('--nvui-tab-ind-w', (i % 2 ? 160 : 100) + 'px');
                    ind.style.setProperty('--nvui-tab-ind-x', (i % 2 ? 120 : 20) + 'px');
                } else if (k === 'B') {
                    ind.style.width = (i % 2 ? 160 : 100) + 'px';
                    ind.style.transform = 'translateX(' + (i % 2 ? 120 : 20) + 'px)';
                } else {
                    const w = i % 2 ? 160 : 100;
                    ind.style.transform = 'translateX(' + (i % 2 ? 120 : 20) + 'px) scaleX(' + w / 600 + ')';
                }
            }, { k: kind, i });
            await page.waitForTimeout(340);
        }
        const after = await metrics();
        return {
            layoutCount: after.LayoutCount - before.LayoutCount,
            layoutDurationMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
            recalcCount: after.RecalcStyleCount - before.RecalcStyleCount,
            recalcDurationMs: (after.RecalcStyleDuration - before.RecalcStyleDuration) * 1000,
        };
    }

    const R = {};
    R.A_width_transition = await run('A');
    R.B_no_transition = await run('B');
    R.C_transform_scale = await run('C');

    console.log('=== #9 tabs 指示器 精测（每组 %d 次切换，DOM 常驻） ===', ITER);
    for (const k of Object.keys(R)) {
        const m = R[k];
        console.log(`  ${k.padEnd(20)} 布局 ${String(m.layoutCount).padStart(3)} 次  ` +
            `布局耗时 ${m.layoutDurationMs.toFixed(1).padStart(7)}ms  ` +
            `样式重算 ${String(m.recalcCount).padStart(3)} 次  ` +
            `单次切换布局 ${(m.layoutCount / ITER).toFixed(1)} 次 / ${(m.layoutDurationMs / ITER).toFixed(2)}ms`);
    }

    const a = R.A_width_transition, b = R.B_no_transition, c = R.C_transform_scale;
    const verdict = {
        '每帧重排的额外代价(布局次数)': (a.layoutCount - b.layoutCount) / ITER,
        '每帧重排的额外代价(耗时ms)': (a.layoutDurationMs - b.layoutDurationMs) / ITER,
        'transform方案节省(布局次数/次切换)': (a.layoutCount - c.layoutCount) / ITER,
        'transform方案节省(耗时ms/次切换)': (a.layoutDurationMs - c.layoutDurationMs) / ITER,
    };
    console.log('\n=== 归因 ===');
    Object.keys(verdict).forEach((k) => console.log(`  ${k}: ${verdict[k].toFixed(2)}`));

    fs.writeFileSync(path.join(OUT, 'tabs-fine.json'), JSON.stringify({ R, verdict, errors }, null, 2));
    console.log('\n控制台错误:', errors.length ? errors.join(' | ') : '(无)');
    await browser.close();
})();
