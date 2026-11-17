'use strict';
/**
 * 宿主实机冒烟：深水区 19 条断言（滚动 / 堆叠 / 吐司 / 回退）
 * 依赖真实 SillyTavern 宿主（默认 http://127.0.0.1:8000/）与 Chrome。
 * 运行：npm run test:host（或 node test/host/smoke-deep.js）
 * 环境变量：NVUI_HOST_URL / CHROME_PATH / NVUI_HOST_OUT / NODE_PATH
 */
const fs = require('fs');
const path = require('path');

const browserDeps = require('../../scripts/resolve-browser');
const { chromium } = browserDeps.requirePlaywright();

const ROOT = path.resolve(__dirname, '..', '..');
const OUT = process.env.NVUI_HOST_OUT
    ? path.resolve(process.env.NVUI_HOST_OUT)
    : path.join(ROOT, 'st-lab-out', 'host');
const HOST = process.env.NVUI_HOST_URL || 'http://127.0.0.1:8000/';
const CHROME = browserDeps.requireChrome();
const PKG_VERSION = require('../../package.json').version;
const res = [];
const ok = (n, c, d) => { res.push({ n, c: !!c, d: d == null ? '' : String(d) }); console.log(`${c ? 'PASS' : 'FAIL'} | ${n}${d ? ' | ' + d : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function boot(browser, viewport) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'no-preference' });
    const page = await ctx.newPage();
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
    page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
    await page.goto(HOST, { waitUntil: 'domcontentloaded' });
    await sleep(9000);
    await page.addStyleTag({ path: path.join(ROOT, 'tokens.css') });
    await page.addStyleTag({ path: path.join(ROOT, 'components.css') });
    await page.addScriptTag({ path: path.join(ROOT, 'nvui-api.js') });
    await page.evaluate(() => document.body.classList.remove('no_animation', 'reduced-motion'));
    return { ctx, page, logs };
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

    /* ===== 1. 长内容 + footer 操作区 ===== */
    const { page, logs } = await boot(browser, { width: 1280, height: 800 });
    const longRes = await page.evaluate(async () => {
        const p = NVUI.createPanel({
            id: 'longpanel', title: '长内容面板',
            tabs: [{ key: 'a', label: '内容' }],
            footer: [
                { label: '取消', variant: 'ghost', close: true },
                { label: '保存', variant: 'primary', onClick: () => { window.__SAVED__ = true; } },
            ],
        });
        for (let i = 0; i < 60; i++) p.addSectionTitle('a', '段落 ' + (i + 1) + '：' + '内容'.repeat(24));
        p.open();
        await new Promise((r) => setTimeout(r, 500));
        const panel = document.querySelector('#longpanel-layer .nvui-panel');
        const body = panel.querySelector('.nvui-panel-body');
        const footer = panel.querySelector('.nvui-panel-footer');
        const pr = panel.getBoundingClientRect();
        const fr = footer ? footer.getBoundingClientRect() : null;
        const beforeScroll = body.scrollTop;
        body.scrollTop = body.scrollHeight;
        await new Promise((r) => setTimeout(r, 120));
        const bodyCanScroll = body.scrollHeight > body.clientHeight + 2;
        const scrolledTo = body.scrollTop;
        // footer 是否始终可见（不随内容滚走）
        const footerVisibleAfterScroll = fr ? (fr.top >= pr.top - 1 && fr.bottom <= pr.bottom + 1) : null;
        return {
            panelH: Math.round(pr.height), vh: innerHeight,
            bodyScrollH: body.scrollHeight, bodyClientH: body.clientHeight,
            bodyCanScroll, scrolled: scrolledTo > beforeScroll,
            footer: !!footer, footerH: fr ? Math.round(fr.height) : 0,
            footerVisibleAfterScroll,
            bodyOverflowY: getComputedStyle(body).overflowY,
            pageScrollY: window.scrollY, docScrollH: document.documentElement.scrollHeight, winH: innerHeight,
        };
    });
    ok('长内容面板高度不超视口', longRes.panelH <= longRes.vh, `${longRes.panelH}/${longRes.vh}`);
    ok('内容区可独立滚动', longRes.bodyCanScroll && longRes.scrolled,
        `${longRes.bodyClientH}/${longRes.bodyScrollH} overflow=${longRes.bodyOverflowY}`);
    ok('底部操作区存在且滚动后仍可见', longRes.footer && longRes.footerVisibleAfterScroll === true, `h=${longRes.footerH}`);
    ok('面板打开时页面本身未被滚动', longRes.pageScrollY === 0, longRes.pageScrollY);

    const footerClick = await page.evaluate(() => {
        const btns = [...document.querySelectorAll('#longpanel-layer .nvui-panel-footer button')];
        const save = btns.find((b) => b.textContent.includes('保存'));
        save && save.click();
        return { found: btns.length, saved: window.__SAVED__ === true, labels: btns.map((b) => b.textContent.trim()) };
    });
    ok('footer 按钮可点击并触发回调', footerClick.found === 2 && footerClick.saved, JSON.stringify(footerClick));
    await page.screenshot({ path: path.join(OUT, 'long-content.png') });

    /* ===== 2. 双面板堆叠 + Esc 只关顶层 ===== */
    const stack = await page.evaluate(async () => {
        const a = NVUI.createPanel({ id: 'stack_a', title: '底层 A' });
        a.addSectionTitle(null, 'A 内容');
        a.open();
        await new Promise((r) => setTimeout(r, 300));
        const b = NVUI.createPanel({ id: 'stack_b', title: '顶层 B' });
        b.addSectionTitle(null, 'B 内容');
        b.open();
        await new Promise((r) => setTimeout(r, 300));
        const zA = getComputedStyle(document.querySelector('#stack_a-layer')).zIndex;
        const zB = getComputedStyle(document.querySelector('#stack_b-layer')).zIndex;
        const bRect = document.querySelector('#stack_b-layer .nvui-panel').getBoundingClientRect();
        const top = document.elementsFromPoint(bRect.left + bRect.width / 2, bRect.top + 30)[0];
        return { zA, zB, bOnTop: !!top.closest('#stack_b-layer'), topCls: (top.id || top.className || '') };
    });
    ok('双面板堆叠：顶层 B 命中自身', stack.bOnTop, `${stack.zA}/${stack.zB} -> ${stack.topCls}`);
    await page.keyboard.press('Escape');
    await sleep(500);
    const afterEsc = await page.evaluate(() => ({
        aOpen: !document.querySelector('#stack_a-overlay').hidden,
        bOpen: !document.querySelector('#stack_b-overlay').hidden,
    }));
    ok('Esc 只关闭顶层，底层保持', afterEsc.aOpen === true && afterEsc.bOpen === false, JSON.stringify(afterEsc));
    await page.keyboard.press('Escape');
    await sleep(500);
    const afterEsc2 = await page.evaluate(() => ({ aOpen: !document.querySelector('#stack_a-overlay').hidden }));
    ok('再按 Esc 关闭底层', afterEsc2.aOpen === false);

    /* ===== 3. 吐司堆叠 ===== */
    const toasts = await page.evaluate(async () => {
        for (let i = 0; i < 4; i++) NVUI.showToast({ type: ['success', 'error', 'warning', 'info'][i], message: '第 ' + (i + 1) + ' 条消息内容' });
        await new Promise((r) => setTimeout(r, 500));
        const list = [...document.querySelectorAll('.nvui-toast')].map((t) => {
            const r = t.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), right: Math.round(r.right), bottom: Math.round(r.bottom) };
        });
        return { n: list.length, list, vw: innerWidth, vh: innerHeight };
    });
    ok('4 条吐司全部出现', toasts.n === 4, toasts.n);
    const overlaps = toasts.list.some((a, i) => toasts.list.some((b, j) => i !== j && Math.abs(a.y - b.y) < 8 && Math.abs(a.x - b.x) < 8));
    ok('吐司互不重叠', !overlaps, JSON.stringify(toasts.list));
    ok('吐司都在视口内', toasts.list.every((t) => t.x >= 0 && t.y >= 0 && t.right <= toasts.vw && t.bottom <= toasts.vh),
        JSON.stringify(toasts.list.map((t) => [t.right, t.bottom])));
    await page.screenshot({ path: path.join(OUT, 'toasts-stack.png') });

    /* ===== 4. Fast UI（body.no-blur）回退 ===== */
    const fastui = await page.evaluate(async () => {
        document.body.classList.add('no-blur');
        NVUI.syncGlassFallback({ force: true });
        await new Promise((r) => setTimeout(r, 800));
        const state = NVUI.detectGlassSupport();
        const p = NVUI.createPanel({ id: 'fastui', title: 'Fast UI 面板' });
        p.addSectionTitle(null, '回退检查');
        p.open();
        await new Promise((r) => setTimeout(r, 600));
        const panel = document.querySelector('#fastui-layer .nvui-panel');
        const cs = getComputedStyle(panel);
        const probe = document.createElement('div');
        probe.className = 'nvui-glass';
        probe.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px';
        document.body.appendChild(probe);
        const probeBlur = getComputedStyle(probe).backdropFilter;
        probe.remove();
        const htmlCls = document.documentElement.className;
        const before = { bg: cs.backgroundColor, blur: cs.backdropFilter, state, probeBlur, htmlCls };
        document.body.classList.remove('no-blur');
        NVUI.syncGlassFallback({ force: true });
        await new Promise((r) => setTimeout(r, 1200));
        const cs2 = getComputedStyle(panel);
        return { before, after: { bg: cs2.backgroundColor, blur: cs2.backdropFilter, state: NVUI.detectGlassSupport(), htmlCls: document.documentElement.className } };
    });
    console.log('  fastui:', JSON.stringify(fastui));
    ok('宿主禁模糊时识别为不支持', fastui.before.state === false, String(fastui.before.state));
    ok('宿主禁模糊时面板近不透明回退', fastui.before.bg.includes('0.97') || /rgb\(/.test(fastui.before.bg), fastui.before.bg);
    ok('移除 no-blur 后自动恢复玻璃', fastui.after.state === true && fastui.after.blur !== 'none', `${fastui.after.state}/${fastui.after.blur}`);
    await page.screenshot({ path: path.join(OUT, 'fastui-fallback.png') });

    const errs = logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]'));
    ok('本轮无控制台错误', errs.length === 0, errs.slice(0, 2).join(' | '));
    await page.context().close();

    /* ===== 5. 小屏 360×640 ===== */
    const s = await boot(browser, { width: 360, height: 640 });
    const small = await s.page.evaluate(async () => {
        const p = NVUI.createPanel({ id: 'small', title: '很长的面板标题会不会换行或被截断呢', version: 'v9.9.9' });
        p.addSectionTitle(null, '内容');
        p.open();
        await new Promise((r) => setTimeout(r, 500));
        const panel = document.querySelector('#small-layer .nvui-panel');
        const r = panel.getBoundingClientRect();
        const title = panel.querySelector('.nvui-panel-title');
        const tr = title.getBoundingClientRect();
        const header = panel.querySelector('.nvui-panel-header');
        const hr = header.getBoundingClientRect();
        return {
            rect: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
            vw: innerWidth, vh: innerHeight,
            titleOverflow: title.scrollWidth > title.clientWidth + 2,
            titleLines: Math.round(tr.height / parseFloat(getComputedStyle(title).lineHeight)),
            headerOverflow: header.scrollWidth > header.clientWidth + 2,
            closeVisible: (() => { const c = panel.querySelector('.nvui-icon-btn'); const cr = c.getBoundingClientRect(); return cr.width >= 20 && cr.right <= r.right + 1; })(),
            docScrollW: document.documentElement.scrollWidth,
        };
    });
    ok('360×640 面板在视口内', small.rect.x >= -0.5 && small.rect.right <= small.vw + 0.5 && small.rect.bottom <= small.vh + 0.5, JSON.stringify(small.rect));
    ok('标题过长时不溢出头部', small.headerOverflow === false, `titleOverflow=${small.titleOverflow} lines=${small.titleLines}`);
    ok('关闭按钮仍可见且在面板内', small.closeVisible);
    ok('360 宽无横向滚动', small.docScrollW <= small.vw + 1, `${small.docScrollW}/${small.vw}`);
    await s.page.screenshot({ path: path.join(OUT, 'small-360.png') });
    await s.page.context().close();

    fs.writeFileSync(path.join(OUT, 'result2.json'), JSON.stringify(res, null, 2));
    const fail = res.filter((r) => !r.c);
    console.log(`\n===== 第二轮: ${res.length - fail.length}/${res.length} =====`);
    fail.forEach((f) => console.log('  FAIL', f.n, f.d));
    await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
