/**
 * NVUI Kit · review harness 自测
 * ------------------------------------------------------------------
 * 目的：证明 test/st-review-harness.js 这套脚手架本身是可靠的 ——
 *       注入后 window.NVUI 存在、版本正确、createPanel 可用，
 *       面板能正常 open / close / destroy，且宿主页面无新增 pageerror。
 *       后续所有实机验证脚本都跑在这套脚手架之上，本脚本是它们的"地基验收"。
 *
 * 运行：node test/st-review-harness-selftest.js
 */
'use strict';

const h = require('./st-review-harness');

(async () => {
    const ctx = await h.launch();
    const { page } = ctx;

    /* ---- 1. 宿主可用性 ---- */
    let hostOk = false;
    try {
        const resp = await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
        hostOk = !!resp && resp.status() === 200;
        h.assert('宿主首页可访问（HTTP 200）', hostOk, resp ? `status=${resp.status()}` : '无响应');
    } catch (e) {
        h.assert('宿主首页可访问（HTTP 200）', false, e.message);
    }

    await page.waitForTimeout(8000);
    h.assert('宿主页面完成渲染（body 有内容）',
        await page.evaluate(() => document.body && document.body.childElementCount > 0),
        'body.childElementCount>0');

    /* ---- 2. LAB 夹具是否在宿主里 ---- */
    const labInfo = await page.evaluate(() => ({
        hasLab: typeof window.__NVUI_LAB__ !== 'undefined',
        hasNVUI: typeof window.NVUI !== 'undefined',
        nvuiVersion: window.NVUI ? window.NVUI.version : null,
    }));
    console.log('[selftest] 宿主 LAB/NVUI 探测:', JSON.stringify(labInfo));
    // LAB 存在与否只是信息，不作为失败判据（宿主是否装了 lab 扩展不由本脚本决定）
    h.assert('宿主 LAB 探测完成', true, `__NVUI_LAB__=${labInfo.hasLab} NVUI=${labInfo.hasNVUI}`);

    /* ---- 3. 注入 kit ---- */
    const errorsBeforeInject = ctx.pageErrors.length;
    const inj = await h.injectKit(page, { force: true });

    h.assert('注入后 window.NVUI 存在', await page.evaluate(() => typeof window.NVUI !== 'undefined'));
    h.assert('NVUI.version === "2.4.0"',
        await page.evaluate(() => window.NVUI && window.NVUI.version === '2.4.0'),
        await page.evaluate(() => String(window.NVUI && window.NVUI.version)));
    h.assert('NVUI.createPanel 是函数',
        await page.evaluate(() => typeof window.NVUI.createPanel === 'function'));

    /* ---- 4. 创建面板并走完 open / close / destroy ---- */
    const panelResult = await page.evaluate(async () => {
        const out = {};
        const before = document.querySelectorAll('dialog.nvui-tl').length;
        const p = NVUI.createPanel({ id: 'selftest_panel', title: 'Harness 自测面板' });
        out.hasController = !!p;
        out.hasOpen = typeof p.open === 'function';
        out.hasClose = typeof p.close === 'function';
        out.hasDestroy = typeof p.destroy === 'function';

        const afterCreate = document.querySelectorAll('dialog.nvui-tl').length;
        out.createdCarrier = afterCreate > before;

        p.open();
        await new Promise(r => setTimeout(r, 700));
        out.opened = p.overlay ? !p.overlay.hidden : null;
        out.panelInDom = !!document.querySelector('#selftest_panel-panel, .nvui-panel');

        p.close();
        await new Promise(r => setTimeout(r, 900));
        out.closed = p.overlay ? p.overlay.hidden : null;

        const beforeDestroy = document.querySelectorAll('dialog.nvui-tl').length;
        p.destroy();
        await new Promise(r => setTimeout(r, 300));
        const afterDestroy = document.querySelectorAll('dialog.nvui-tl').length;
        out.destroyed = afterDestroy < beforeDestroy;
        out.counts = { before, afterCreate, beforeDestroy, afterDestroy };

        return out;
    });

    h.assert('createPanel 返回控制器', panelResult.hasController === true);
    h.assert('控制器具备 open / close / destroy',
        panelResult.hasOpen && panelResult.hasClose && panelResult.hasDestroy,
        `open=${panelResult.hasOpen} close=${panelResult.hasClose} destroy=${panelResult.hasDestroy}`);
    h.assert('创建面板后浮层载体已挂载 DOM', panelResult.createdCarrier === true,
        JSON.stringify(panelResult.counts));
    h.assert('open() 后面板可见（overlay 未隐藏）', panelResult.opened === true,
        `opened=${panelResult.opened}`);
    h.assert('面板内容已渲染进 DOM', panelResult.panelInDom === true);
    h.assert('close() 后 overlay 已隐藏', panelResult.closed === true,
        `closed=${panelResult.closed}`);
    h.assert('destroy() 后载体 DOM 被清理', panelResult.destroyed === true,
        `before=${panelResult.counts.beforeDestroy} after=${panelResult.counts.afterDestroy}`);

    /* ---- 5. 样式注入生效 ---- */
    const styleOk = await page.evaluate(() => {
        const probe = document.createElement('div');
        probe.className = 'nvui-panel';
        document.body.appendChild(probe);
        const cs = getComputedStyle(probe);
        const res = {
            hasTokens: !!document.querySelector('style'),
            bg: cs.backgroundColor,
            radius: cs.borderRadius,
        };
        probe.remove();
        return res;
    });
    h.assert('CSS 已注入（.nvui-panel 有非默认背景/圆角）',
        styleOk.bg !== 'rgba(0, 0, 0, 0)' || styleOk.radius !== '0px',
        JSON.stringify(styleOk));

    /* ---- 6. 无新增 pageerror ---- */
    const newErrors = ctx.pageErrors.slice(errorsBeforeInject);
    h.assert('注入与面板操作期间无新增 pageerror', newErrors.length === 0,
        newErrors.length ? newErrors.join(' | ') : '(无)');

    await h.cleanup();

    const ok = h.summary('harness 自测');
    process.exit(ok ? 0 : 1);
})().catch(async e => {
    console.error('FATAL', e);
    try { await h.cleanup(); } catch (_) { /* ignore */ }
    process.exit(1);
});
