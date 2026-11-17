/**
 * 核实：面板玻璃背景是否生效（宿主 body.no-blur 是否影响 backdrop-filter）
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);
    await page.evaluate(() => window.__NVUI_LAB__.open('basic'));
    await page.waitForTimeout(1500);

    const r = await page.evaluate(() => {
        const pick = (sel) => {
            const el = document.querySelector(sel);
            if (!el) return null;
            const cs = getComputedStyle(el);
            return {
                sel,
                background: cs.backgroundColor,
                backgroundImage: cs.backgroundImage.slice(0, 80),
                backdropFilter: cs.backdropFilter,
                webkitBackdropFilter: cs.webkitBackdropFilter,
                opacity: cs.opacity,
                filter: cs.filter,
                isolation: cs.isolation,
                mixBlendMode: cs.mixBlendMode,
                classes: (el.className || '').toString().slice(0, 80),
            };
        };
        return {
            bodyClass: document.body.className,
            panel: pick('.nvui-panel'),
            overlay: pick('.nvui-overlay'),
            panelBody: pick('.nvui-panel-body'),
            // 宿主 body 上的 no-blur 是否禁用了全局 backdrop-filter
            htmlBackdropRule: (() => {
                let found = [];
                for (const sheet of Array.from(document.styleSheets)) {
                    let rules;
                    try { rules = sheet.cssRules; } catch (e) { continue; }
                    for (const rule of Array.from(rules || [])) {
                        const t = rule.cssText || '';
                        if (/backdrop-filter/.test(t) && /none/i.test(t)) found.push(t.slice(0, 160));
                    }
                }
                return found.slice(0, 8);
            })(),
        };
    });
    console.log(JSON.stringify(r, null, 2));
    await browser.close();
})();
