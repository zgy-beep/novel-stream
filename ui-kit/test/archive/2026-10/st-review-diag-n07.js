/**
 * QA 诊断脚本 D3 · NEW-07 观察器收窄的边界场景
 * ------------------------------------------------------------------
 * 疑问：仓库根新版把观察面收窄为「逐 dialog 观察 open 属性」后，
 *      宿主**动态新建**的 dialog 在「同一任务内创建并 showModal()」时，
 *      open 属性的变化发生在观察器挂载之前 → 观察器 A 收不到记录
 *      → syncHostModalState() 不被调用 → 载体不降级。
 *
 * 对照场景：
 *   V1 新建 + 立即 showModal()      （同一 task）
 *   V2 新建 + 等一帧 + showModal()  （观察器 B 已有机会挂上）
 *   V3 注入前就存在的 dialog + showModal()
 *   V4 已 observe 过的 dialog 再次 showModal()
 *
 * 只读，不修改产品代码。
 */
'use strict';

const h = require('../../st-review-harness');

(async () => {
    const ctx = await h.launch();
    const blank = await ctx.context.newPage();
    await blank.setContent('<!DOCTYPE html><html><head><title>blank</title></head><body></body></html>');
    await h.injectKit(blank, { force: true });

    const r = await blank.evaluate(async () => {
        const out = {};
        const sleep = ms => new Promise(res => setTimeout(res, ms));

        const p = window.NVUI.createPanel({ id: 'diag3', title: 'D3' });
        p.open();
        await sleep(500);

        const carrier = () => document.querySelector('dialog.nvui-tl');
        const degraded = () => { const c = carrier(); return c ? c.classList.contains('is-host-modal') : null; };
        const modals = () => window.NVUI.countHostModals();

        /* --- V1 新建 + 立即 showModal() --- */
        const d1 = document.createElement('dialog');
        d1.id = 'v1';
        document.body.appendChild(d1);
        d1.showModal();
        await sleep(600);
        out.V1_newAndShowImmediately = { modalCount: modals(), degraded: degraded() };
        d1.close();
        await sleep(400);
        out.V1_afterClose = { modalCount: modals(), degraded: degraded() };
        d1.remove();

        /* --- V2 新建 + 等一帧 + showModal() --- */
        const d2 = document.createElement('dialog');
        d2.id = 'v2';
        document.body.appendChild(d2);
        await sleep(300);            // 让 childList 观察器挂上
        d2.showModal();
        await sleep(600);
        out.V2_newWaitThenShow = { modalCount: modals(), degraded: degraded() };
        d2.close();
        await sleep(400);
        d2.remove();

        /* --- V3 早已存在的 dialog + showModal() --- */
        const d3 = document.createElement('dialog');
        d3.id = 'v3';
        document.body.appendChild(d3);
        await sleep(300);
        d3.showModal();
        await sleep(600);
        out.V3_existingThenShow = { modalCount: modals(), degraded: degraded() };
        d3.close();
        await sleep(400);
        d3.remove();

        /* --- V4 反复 showModal 同一 dialog --- */
        const d4 = document.createElement('dialog');
        d4.id = 'v4';
        document.body.appendChild(d4);
        await sleep(300);
        d4.showModal(); await sleep(500);
        const first = { modalCount: modals(), degraded: degraded() };
        d4.close(); await sleep(400);
        d4.showModal(); await sleep(500);
        const second = { modalCount: modals(), degraded: degraded() };
        out.V4_reopenSameDialog = { first, second };
        d4.close(); await sleep(400);
        d4.remove();

        p.destroy();
        return out;
    });

    console.log('\n===== D3 · NEW-07 边界场景 =====');
    console.log(JSON.stringify(r, null, 2));

    await h.cleanup();
})().catch(e => { console.error('DIAG ERROR:', e); process.exit(1); });
