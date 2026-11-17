/**
 * NVUI Kit · ST 精测探针 II（#9 tabs 指示器 · 修复方案选型）
 *
 * 目的：在**不改变 JS/CSS 变量契约**的前提下，找出让 width/height 过渡
 *       不再触发文档级重排的最小改动方案。
 *
 * 候选：
 *   A  现状（width/height 过渡）
 *   D  A + `contain: layout`（独立格式化上下文，限制重排影响范围）
 *   E  A + `contain: strict`（layout + paint + size 隔离）
 *   F  A + `will-change: transform`（提升合成层，验证是否有效）
 *   C  transform 缩放（需改 JS 契约，作为上限参照）
 */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];
const ITER = 8;

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

    async function run(kind) {
        await page.evaluate((k) => {
            const ind = document.getElementById('perf-tabs-ind');
            ind.style.transition = '';
            ind.style.width = '';
            ind.style.height = '';
            ind.style.transform = '';
            ind.style.transformOrigin = '';
            ind.style.contain = '';
            ind.style.willChange = '';
            ind.removeAttribute('style');
            ind.setAttribute('style', '');
            if (k === 'A') {
                ind.style.setProperty('--nvui-tab-ind-w', '100px');
                ind.style.setProperty('--nvui-tab-ind-h', '2px');
                ind.style.setProperty('--nvui-tab-ind-x', '10px');
            } else if (k === 'D') {
                ind.style.contain = 'layout';
                ind.style.setProperty('--nvui-tab-ind-w', '100px');
                ind.style.setProperty('--nvui-tab-ind-h', '2px');
                ind.style.setProperty('--nvui-tab-ind-x', '10px');
            } else if (k === 'E') {
                ind.style.contain = 'strict';
                ind.style.setProperty('--nvui-tab-ind-w', '100px');
                ind.style.setProperty('--nvui-tab-ind-h', '2px');
                ind.style.setProperty('--nvui-tab-ind-x', '10px');
            } else if (k === 'F') {
                ind.style.willChange = 'transform';
                ind.style.setProperty('--nvui-tab-ind-w', '100px');
                ind.style.setProperty('--nvui-tab-ind-h', '2px');
                ind.style.setProperty('--nvui-tab-ind-x', '10px');
            } else if (k === 'C') {
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
                if (k === 'C') {
                    const w = i % 2 ? 160 : 100;
                    ind.style.transform = 'translateX(' + (i % 2 ? 120 : 20) + 'px) scaleX(' + w / 600 + ')';
                } else {
                    ind.style.setProperty('--nvui-tab-ind-w', (i % 2 ? 160 : 100) + 'px');
                    ind.style.setProperty('--nvui-tab-ind-x', (i % 2 ? 120 : 20) + 'px');
                }
            }, { k: kind, i });
            await page.waitForTimeout(340);
        }
        const after = await metrics();
        return {
            layoutCount: after.LayoutCount - before.LayoutCount,
            layoutDurationMs: (after.LayoutDuration - before.LayoutDuration) * 1000,
            recalcCount: after.RecalcStyleCount - before.RecalcStyleCount,
        };
    }

    const R = {};
    for (const k of ['A', 'D', 'E', 'F', 'C']) R[k] = await run(k);

    const NAME = {
        A: 'A 现状（width/height 过渡）',
        D: 'D + contain: layout',
        E: 'E + contain: strict',
        F: 'F + will-change: transform',
        C: 'C transform 缩放（需改契约）',
    };
    console.log('=== #9 修复方案选型（每组 %d 次切换，DOM 常驻） ===', ITER);
    for (const k of Object.keys(R)) {
        const m = R[k];
        console.log(`  ${NAME[k].padEnd(34)} 布局 ${String(m.layoutCount).padStart(3)} 次  ` +
            `布局耗时 ${m.layoutDurationMs.toFixed(1).padStart(7)}ms  ` +
            `单次切换 ${(m.layoutCount / ITER).toFixed(1).padStart(5)} 次 / ${(m.layoutDurationMs / ITER).toFixed(2)}ms`);
    }

    console.log('\n=== 相对现状 A 的收益 ===');
    for (const k of ['D', 'E', 'F', 'C']) {
        const dL = (R.A.layoutCount - R[k].layoutCount) / ITER;
        const dT = (R.A.layoutDurationMs - R[k].layoutDurationMs) / ITER;
        console.log(`  ${NAME[k].padEnd(34)} 布局 -${dL.toFixed(1)} 次/切换, 耗时 -${dT.toFixed(2)}ms/切换`);
    }

    fs.writeFileSync(path.join(OUT, 'tabs-options.json'), JSON.stringify({ R, errors }, null, 2));
    console.log('\n控制台错误:', errors.length ? errors.join(' | ') : '(无)');
    await browser.close();
})();
