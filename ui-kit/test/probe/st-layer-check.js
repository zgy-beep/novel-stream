/**
 * NVUI Kit · ST 层级回归
 * 断言：面板打开时，NVUI 浮层在宿主内容（#sheld / #chat 消息区）之上。
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
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);

    const R = {};

    /* ---------- 1. 面板打开时的层级 ---------- */
    await page.evaluate(() => window.__NVUI_LAB__.open('basic'));
    await page.waitForTimeout(1500);

    R.layer = await page.evaluate(() => {
        const panel = document.getElementById('nvui_lab_panel-panel') || document.querySelector('.nvui-panel');
        if (!panel) return { error: 'panel not found' };
        const pr = panel.getBoundingClientRect();
        const pts = [];
        // 采样点：面板中心 + 四角内侧（都应落在浮层上）
        const cand = [
            [Math.round(pr.left + pr.width / 2), Math.round(pr.top + pr.height / 2)],
            [Math.round(pr.left + 30), Math.round(pr.top + 30)],
            [Math.round(pr.right - 30), Math.round(pr.top + 30)],
            [Math.round(pr.left + 30), Math.round(pr.bottom - 30)],
            [Math.round(pr.right - 30), Math.round(pr.bottom - 30)],
        ];
        for (const [x, y] of cand) {
            const stack = (document.elementsFromPoint(x, y) || []).map(e => e.id || (e.className || '').toString().slice(0, 40) || e.tagName);
            const ours = stack.findIndex(s => /nvui/.test(s));
            const hostFirst = stack.findIndex(s => /^(chat|sheld|mes_|expression-wrapper|background|drawer-content)$/.test(s));
            pts.push({ x, y, top: stack[0], oursIdx: ours, hostIdx: hostFirst, oursOnTop: ours >= 0 && (hostFirst === -1 || ours < hostFirst) });
        }
        const carrier = document.getElementById('nvui_lab_panel-layer');
        const cs = carrier ? getComputedStyle(carrier) : null;
        return {
            points: pts,
            allOnTop: pts.every(p => p.oursOnTop),
            carrierZ: cs ? cs.zIndex : null,
            carrierClass: carrier ? carrier.className : null,
            panelRect: { t: Math.round(pr.top), l: Math.round(pr.left), w: Math.round(pr.width), h: Math.round(pr.height) },
        };
    });

    /* ---------- 2. 吐司层级高于面板 ---------- */
    await page.evaluate(() => window.__NVUI_LAB__.toast('层级测试吐司'));
    await page.waitForTimeout(700);
    R.toast = await page.evaluate(() => {
        const toast = document.querySelector('.nvui-toast');
        if (!toast) return { error: 'toast not found' };
        const tr = toast.getBoundingClientRect();
        const x = Math.round(tr.left + tr.width / 2);
        const y = Math.round(tr.top + tr.height / 2);
        const stack = (document.elementsFromPoint(x, y) || []).map(e => e.id || (e.className || '').toString().slice(0, 40) || e.tagName);
        const toastIdx = stack.findIndex(s => /nvui-toast/.test(s));
        const panelIdx = stack.findIndex(s => /nvui-panel|nvui-overlay/.test(s));
        const toastCarrier = document.getElementById('nvui-api-toast-layer');
        return {
            top: stack[0],
            toastIdx,
            panelIdx,
            toastOnTop: toastIdx >= 0 && (panelIdx === -1 || toastIdx < panelIdx),
            toastCarrierZ: toastCarrier ? getComputedStyle(toastCarrier).zIndex : null,
            toastCarrierClass: toastCarrier ? toastCarrier.className : null,
        };
    });

    await page.screenshot({ path: path.join(OUT, 'layer-after-fix.png') });

    /* ---------- 3. 关闭后层级还原 ---------- */
    await page.evaluate(() => window.__NVUI_LAB__.close());
    await page.waitForTimeout(600);
    R.afterClose = await page.evaluate(() => {
        const overlay = document.getElementById('nvui_lab_panel-overlay');
        const carrier = document.getElementById('nvui_lab_panel-layer');
        return {
            overlayHidden: overlay ? overlay.hidden : null,
            carrierOpen: carrier ? carrier.open : null,
            topAt400: (document.elementsFromPoint(700, 400) || []).map(e => e.id || e.tagName)[0],
        };
    });

    R.errors = errors;
    console.log(JSON.stringify(R, null, 2));
    await browser.close();
})();
