'use strict';
/**
 * 宿主实机冒烟：面板主路径 35 条断言
 * 依赖真实 SillyTavern 宿主（默认 http://127.0.0.1:8000/）与 Chrome。
 * 运行：npm run test:host（或 node test/host/smoke-panel.js）
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
const A = {
    tokens: path.join(ROOT, 'tokens.css'),
    comp: path.join(ROOT, 'components.css'),
    api: path.join(ROOT, 'nvui-api.js'),
};

const results = [];
function ok(name, cond, detail) {
    results.push({ name, pass: !!cond, detail: detail == null ? '' : String(detail) });
    console.log(`${cond ? 'PASS' : 'FAIL'} | ${name}${detail ? ' | ' + detail : ''}`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function openPage(browser, opts) {
    const context = await browser.newContext(Object.assign({
        viewport: { width: 1440, height: 900 },
        reducedMotion: 'no-preference',
    }, opts || {}));
    const page = await context.newPage();
    const logs = [];
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
    await page.goto(HOST, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);
    await page.addStyleTag({ path: A.tokens });
    await page.addStyleTag({ path: A.comp });
    await page.addScriptTag({ path: A.api });
    // 宿主若开了「减少动效 / 禁用动画」，会干扰动效与退场观察；探针里显式清掉
    await page.evaluate(() => document.body.classList.remove('no_animation', 'reduced-motion'));
    return { context, page, logs };
}

const BUILD = function (cfg) {
    const opener = document.createElement('button');
    opener.id = cfg.id + '_opener';
    opener.textContent = '打开面板';
    opener.style.cssText = 'position:fixed;left:12px;top:12px;z-index:2147483646;';
    document.body.appendChild(opener);
    opener.focus();
    const p = NVUI.createPanel({
        id: cfg.id,
        title: cfg.title || '冒烟测试面板',
        version: 'v-smoke',
        persist: true,
        tabs: cfg.tabs || [
            { key: 'a', label: '概览' },
            { key: 'b', label: '表单' },
            { key: 'c', label: '长内容' }
        ]
    });
    p.addSectionTitle('a', '状态');
    p.addSwitch('a', { label: '启用自动连载', value: true, feature: true });
    p.addProgress('a', { label: '同步进度', value: 42 });
    p.addAccordion('a', {
        title: '高级选项',
        content: [p.addInput('a', { label: '上限 (MB)', type: 'number', value: 80 })]
    });
    p.addSwitch('b', { label: '深色玻璃', value: true, onChange: function () {} });
    p.addInput('b', { label: '接口地址', type: 'text', value: 'https://example.com/api' });
    p.addInput('b', { label: '并发数', type: 'number', value: 4 });
    for (let i = 0; i < 24; i++) p.addSectionTitle('c', '长内容段落 ' + (i + 1));
    window.__SMOKE__ = p;
    window.__SMOKE_OPENER__ = opener;
    p.open();
    return true;
};

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

    /* ========== A. 桌面 · 深色 · 正常动效 ========== */
    const { page, logs } = await openPage(browser, {});
    const env = await page.evaluate(() => ({
        nvui: window.NVUI && window.NVUI.version,
        glass: (() => { try { return NVUI.detectGlassSupport(); } catch (e) { return 'ERR ' + e.message; } })(),
        bodyClass: document.body.className,
        reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    }));
    console.log('ENV', JSON.stringify(env));
    ok('注入后 NVUI 可用且版本匹配', env.nvui === PKG_VERSION, env.nvui + ' vs ' + PKG_VERSION);
    ok('宿主未强制禁用模糊（no-blur 不存在）', !/\bno-blur\b/.test(env.bodyClass), env.bodyClass);

    await page.evaluate(BUILD, { id: 'smoke_panel' });
    await sleep(500);

    const geo = await page.evaluate(() => {
        const dlg = document.querySelector('#smoke_panel-layer');
        const ov = document.querySelector('#smoke_panel-overlay');
        const panel = document.querySelector('#smoke_panel-layer .nvui-panel');
        if (!dlg || !ov || !panel) return { missing: true };
        const r = panel.getBoundingClientRect();
        const cs = getComputedStyle(panel);
        const ovcs = getComputedStyle(ov);
        const top = document.elementsFromPoint(r.left + r.width / 2, r.top + 40)[0];
        return {
            missing: false,
            rect: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
            carrierZ: getComputedStyle(dlg).zIndex,
            panelBg: cs.backgroundColor,
            panelBlur: cs.backdropFilter,
            overlayBg: ovcs.backgroundColor,
            topTag: top && (top.id || top.className || top.tagName),
            inside: !!(top && panel.contains(top)),
            docH: document.documentElement.scrollHeight,
            winH: innerHeight,
            vw: innerWidth,
            vh: innerHeight,
        };
    });
    ok('面板 DOM 三件套齐全（layer/overlay/panel）', !geo.missing);
    if (!geo.missing) {
        ok('面板完全在视口内（无溢出）',
            geo.rect.x >= 0 && geo.rect.y >= 0 && geo.rect.right <= geo.vw + 0.5 && geo.rect.bottom <= geo.vh + 0.5,
            JSON.stringify(geo.rect));
        ok('载体 z-index 在专属档（≥1e6）', parseInt(geo.carrierZ, 10) >= 1000000, geo.carrierZ);
        ok('面板中心点命中自身（未被宿主遮挡）', geo.inside, geo.topTag);
        ok('玻璃生效（backdrop-filter 非 none）', geo.panelBlur && geo.panelBlur !== 'none', geo.panelBlur);
        ok('面板背景为半透明（alpha < 1）',
            /rgba?\([^)]*,\s*0?\.\d+\)/.test(geo.panelBg) || /\/\s*0?\.\d+\s*\)/.test(geo.panelBg),
            geo.panelBg);
    }
    await page.screenshot({ path: path.join(OUT, 'panel-dark.png') });

    // Tab 切换
    const tab = await page.evaluate(async () => {
        const tabs = [...document.querySelectorAll('#smoke_panel-layer .nvui-tab')];
        tabs[1].click();
        await new Promise((r) => setTimeout(r, 350));
        const pane = document.querySelector('#smoke_panel-pane-b');
        const ind = document.querySelector('#smoke_panel-layer .nvui-tabs-indicator');
        return {
            count: tabs.length,
            selected: tabs[1].getAttribute('aria-selected'),
            paneVisible: pane && getComputedStyle(pane).display !== 'none' && pane.getBoundingClientRect().height > 0,
            indicator: ind ? ind.getBoundingClientRect().width : 0,
        };
    });
    ok('3 个 tab 渲染', tab.count === 3, tab.count);
    ok('切换后 aria-selected=true', tab.selected === 'true', tab.selected);
    ok('切换后对应 pane 可见', tab.paneVisible);
    ok('指示器有宽度（未塌陷）', tab.indicator > 10, tab.indicator);

    // 折叠 + 持久化
    const acc = await page.evaluate(async () => {
        window.__SMOKE__.setTab('a');
        await new Promise((r) => setTimeout(r, 300));
        const head = document.querySelector('#smoke_panel-layer .nvui-acc-head');
        head.click();
        await new Promise((r) => setTimeout(r, 500));
        const acc = head.closest('.nvui-acc');
        const body = acc.querySelector('.nvui-acc-body');
        const key = 'nvui_state_smoke_panel';
        return {
            open: acc.classList.contains('is-open'),
            expanded: head.getAttribute('aria-expanded'),
            bodyH: body.getBoundingClientRect().height,
            storage: localStorage.getItem(key) || '',
        };
    });
    ok('折叠面板展开态正确', acc.open && acc.expanded === 'true', `${acc.open}/${acc.expanded}`);
    ok('展开后内容有高度', acc.bodyH > 10, acc.bodyH);
    ok('持久化写入含 tab 与 accordion', /accordion/.test(acc.storage) && /tab/.test(acc.storage), acc.storage.slice(0, 160));

    // 焦点陷阱 + Esc + 焦点归还
    const kb = await page.evaluate(async () => {
        const panel = document.querySelector('#smoke_panel-layer .nvui-panel');
        const focusables = [...panel.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
            .filter((n) => !n.disabled && n.offsetParent !== null);
        focusables[0].focus();
        return {
            count: focusables.length,
            first: document.activeElement === focusables[0],
            list: focusables.map((n) => (n.id || n.className) + '|ti=' + n.tabIndex),
            active: (document.activeElement.id || document.activeElement.className || document.activeElement.tagName),
            panelExists: !!document.querySelector('#smoke_panel-layer .nvui-panel'),
        };
    });
    console.log('  KB:', JSON.stringify(kb));
    ok('面板内可聚焦元素数量合理（≥5）', kb.count >= 5, kb.count);
    let trapped = true, escapedAt = '';
    for (let i = 0; i < kb.count + 3; i++) {
        await page.keyboard.press('Tab');
        const inside = await page.evaluate(() => {
            const panel = document.querySelector('#smoke_panel-layer .nvui-panel');
            return panel ? panel.contains(document.activeElement) : false;
        });
        if (!inside) { trapped = false; escapedAt = String(i + 1); break; }
    }
    ok('Tab 循环不逃出面板', trapped, trapped ? '' : `第 ${escapedAt} 次 Tab 逃出`);
    await page.keyboard.press('Escape');
    await sleep(500);
    const esc = await page.evaluate(() => ({
        open: (() => { const o = document.querySelector('#smoke_panel-overlay'); return o ? !o.hidden : false; })(),
        active: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : '',
    }));
    ok('Esc 关闭面板', !esc.open);
    ok('关闭后焦点归还触发按钮', esc.active === 'smoke_panel_opener', esc.active);

    // 吐司
    const toast = await page.evaluate(async () => {
        NVUI.showToast({ type: 'success', message: '冒烟测试吐司：保存成功', title: '成功' });
        await new Promise((r) => setTimeout(r, 400));
        const layer = document.querySelector('dialog.nvui-tl-toast, dialog.nvui-tl');
        const t = document.querySelector('.nvui-toast');
        if (!t) return { found: false };
        const r = t.getBoundingClientRect();
        return {
            found: true, role: t.getAttribute('role'), rect: { x: r.x, y: r.y, w: r.width, h: r.height },
            inViewport: r.x >= 0 && r.y >= 0 && r.right <= innerWidth && r.bottom <= innerHeight,
            layerZ: layer ? getComputedStyle(layer).zIndex : '',
            text: t.textContent.slice(0, 40),
        };
    });
    ok('吐司出现', toast.found, toast.found ? toast.text : '');
    if (toast.found) {
        ok('吐司在视口内', toast.inViewport, JSON.stringify(toast.rect));
        ok('吐司有 role 语义（status/alert）', ['status', 'alert'].includes(toast.role), toast.role);
    }
    await page.screenshot({ path: path.join(OUT, 'toast-dark.png') });

    // 宿主模态让位
    const modal = await page.evaluate(async () => {
        const d = document.createElement('dialog');
        d.id = 'smoke_host_modal';
        d.textContent = '宿主模态';
        document.body.appendChild(d);
        d.showModal();
        await new Promise((r) => setTimeout(r, 250));
        const carrier = document.querySelector('#smoke_panel-layer');
        const on = carrier.classList.contains('is-host-modal');
        const pe = getComputedStyle(carrier).pointerEvents;
        d.close(); d.remove();
        await new Promise((r) => setTimeout(r, 250));
        return { on, pe, off: !carrier.classList.contains('is-host-modal') };
    });
    ok('宿主 showModal 时载体降级让位', modal.on && modal.pe === 'none', `${modal.on}/${modal.pe}`);
    ok('宿主模态关闭后自动还原', modal.off);

    // destroy 清理
    const destroy = await page.evaluate(async () => {
        window.__SMOKE__.destroy();
        await new Promise((r) => setTimeout(r, 300));
        return {
            layer: !!document.querySelector('#smoke_panel-layer'),
            overlay: !!document.querySelector('#smoke_panel-overlay'),
            panels: document.querySelectorAll('.nvui-panel').length,
            nvui: typeof window.NVUI,
        };
    });
    ok('destroy 后 DOM 清理干净', !destroy.layer && !destroy.overlay && destroy.panels === 0, JSON.stringify(destroy));
    ok('destroy 后 NVUI 仍在', destroy.nvui === 'object');

    // 浅色主题截图
    await page.evaluate(() => { NVUI.setTheme('light'); });
    await page.evaluate(BUILD, { id: 'smoke_panel_l', title: '浅色主题面板' });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, 'panel-light.png') });
    await page.evaluate(() => { window.__SMOKE__.destroy(); NVUI.setTheme('dark'); });

    const errs = logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]'));
    ok('桌面全流程无控制台错误', errs.length === 0, errs.slice(0, 3).join(' || '));
    await page.context().close();

    /* ========== B. 移动端 390×844 ========== */
    const m = await openPage(browser, { viewport: { width: 390, height: 844 }, isMobile: false });
    await m.page.evaluate(BUILD, { id: 'smoke_mobile' });
    await sleep(500);
    const mob = await m.page.evaluate(() => {
        const panel = document.querySelector('#smoke_mobile-layer .nvui-panel');
        const r = panel.getBoundingClientRect();
        const nav = document.querySelector('#smoke_mobile-layer .nvui-bottom-nav');
        const navBtns = nav ? [...nav.querySelectorAll('.nvui-bottom-nav-item')] : [];
        const hs = navBtns.map((b) => b.getBoundingClientRect().height);
        return {
            rect: { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom },
            vw: innerWidth, vh: innerHeight,
            docScrollW: document.documentElement.scrollWidth,
            nav: !!nav, navCount: navBtns.length, navHeights: hs,
            panelW: r.width,
        };
    });
    ok('移动端面板不超出视口', mob.rect.x >= -0.5 && mob.rect.right <= mob.vw + 0.5 && mob.rect.bottom <= mob.vh + 0.5,
        JSON.stringify(mob.rect));
    ok('移动端无横向滚动', mob.docScrollW <= mob.vw + 1, `${mob.docScrollW} vs ${mob.vw}`);
    ok('移动端底部导航存在', mob.nav && mob.navCount >= 3, `${mob.nav}/${mob.navCount}`);
    ok('移动端导航触控高度 ≥40px（GH-#21）', mob.navHeights.length > 0 && Math.min(...mob.navHeights) >= 40, JSON.stringify(mob.navHeights));
    await m.page.screenshot({ path: path.join(OUT, 'panel-mobile.png') });
    const merrs = m.logs.filter((l) => l.startsWith('[pageerror]') || l.startsWith('[error]'));
    ok('移动端无控制台错误', merrs.length === 0, merrs.slice(0, 3).join(' || '));
    await m.page.context().close();

    /* ========== C. 减弱动效 ========== */
    const rm = await openPage(browser, { reducedMotion: 'reduce' });
    await rm.page.evaluate(BUILD, { id: 'smoke_rm' });
    await sleep(400);
    const rmStyle = await rm.page.evaluate(() => {
        const panel = document.querySelector('#smoke_rm-layer .nvui-panel');
        const ov = document.querySelector('#smoke_rm-overlay');
        const cs = getComputedStyle(panel);
        const ocs = getComputedStyle(ov);
        return {
            panelT: cs.transitionDuration, panelA: cs.animationDuration,
            ovA: ocs.animationDuration,
            pref: matchMedia('(prefers-reduced-motion: reduce)').matches,
        };
    });
    const nearZero = (v) => /^0s(,\s*0s)*$/.test(v) || /0\.0*1m?s/.test(v) || /^1e-0\d+s$/.test(v);
    ok('减少动效下偏好已生效', rmStyle.pref === true, rmStyle.pref);
    ok('面板过渡被降级（≤1ms）', nearZero(rmStyle.panelT) || nearZero(rmStyle.panelA),
        `${rmStyle.panelT} / ${rmStyle.panelA}`);
    ok('遮罩动画被降级', nearZero(rmStyle.ovA), rmStyle.ovA);
    await rm.page.screenshot({ path: path.join(OUT, 'panel-reduced.png') });
    await rm.page.context().close();

    fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify({ results, env }, null, 2));
    const fail = results.filter((r) => !r.pass);
    console.log(`\n===== 冒烟汇总: ${results.length - fail.length}/${results.length} 通过 =====`);
    if (fail.length) fail.forEach((f) => console.log('  FAIL', f.name, f.detail));
    await browser.close();
    process.exit(fail.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
