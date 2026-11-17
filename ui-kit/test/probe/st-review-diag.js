/**
 * QA 诊断脚本（第三轮专用，辅助定位）
 * ------------------------------------------------------------------
 * 用途：对 st-review-verify.js 中的两条存疑断言做**根因隔离**实验，
 *      不做 PASS/FAIL 判定，只输出实测数据，供报告引用。
 *
 *  D1 · NEW-03：restoreFocus() 的三级兜底第 3 级（焦点落到面板容器）
 *               在 overlay 已 hidden 之后才执行 —— 验证 panel.focus()
 *               是否因此静默失效、焦点是否真的掉到 BODY。
 *  D2 · NEW-07：在**空白页**（只注入仓库根 kit，无宿主 third-party 旧副本）
 *               测量 <details> / 任意 open 属性切换是否触发全文档 modal 查询。
 *
 * 只读：不修改任何产品代码。
 */
'use strict';

const h = require('./st-review-harness');

(async () => {
    const ctx = await h.launch();
    const page = ctx.page;

    /* ============ D1 · NEW-03 焦点兜底根因隔离（在宿主页面测） ============ */
    await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    await h.injectKit(page, { force: true });

    const d1 = await page.evaluate(async () => {
        const out = {};
        const sleep = ms => new Promise(r => setTimeout(r, ms));

        /* 用例 A：opener 不可聚焦 + focusFallback 非法 → 应走第 3 级兜底（面板容器） */
        const trig = document.createElement('button');
        trig.id = 'diag_trig_a';
        trig.textContent = 'A';
        document.body.appendChild(trig);
        trig.focus();
        const p = window.NVUI.createPanel({ id: 'diag_a', title: 'A', focusFallback: '#a[' });
        p.open();
        await sleep(400);
        trig.style.display = 'none';          // 迫使 opener 不可聚焦
        const overlayEl = document.getElementById('diag_a-overlay');
        const panelEl = document.querySelector('#diag_a-overlay .nvui-panel');
        out.beforeClose = {
            overlayHidden: overlayEl ? overlayEl.hidden : null,
            panelTabindex: panelEl ? panelEl.getAttribute('tabindex') : null,
            activeEl: document.activeElement ? document.activeElement.tagName : null,
        };
        p.close();
        await sleep(1000);
        out.afterClose = {
            overlayHidden: overlayEl ? overlayEl.hidden : null,
            activeTag: document.activeElement ? document.activeElement.tagName : null,
            activeId: document.activeElement ? document.activeElement.id : null,
            isBody: document.activeElement === document.body,
            panelHasTabindex: panelEl ? panelEl.hasAttribute('tabindex') : null,
            panelDisplay: panelEl ? getComputedStyle(panelEl).display : null,
            overlayDisplay: overlayEl ? getComputedStyle(overlayEl).display : null,
            panelIsFocusableByHand: (() => {
                if (!panelEl) return false;
                const before = document.activeElement;
                panelEl.focus();
                const ok = document.activeElement === panelEl;
                if (!ok && before && before.focus) before.focus();
                return ok;
            })(),
        };
        trig.remove();
        p.destroy();

        /* 用例 B：把 restoreFocus 的时序点前移对比 ——
           手动模拟「overlay 尚未 hidden 时 focus panel」是否成功 */
        const trig2 = document.createElement('button');
        trig2.id = 'diag_trig_b';
        document.body.appendChild(trig2);
        trig2.focus();
        const p2 = window.NVUI.createPanel({ id: 'diag_b', title: 'B' });
        p2.open();
        await sleep(400);
        const overlay2 = document.getElementById('diag_b-overlay');
        const panel2 = document.querySelector('#diag_b-overlay .nvui-panel');
        trig2.style.display = 'none';
        out.orderProbe = {
            /* 模拟 restoreFocus 的实际时序：overlay 已 hidden */
            hiddenThenFocus: (() => {
                overlay2.hidden = true;
                panel2.setAttribute('tabindex', '-1');
                panel2.focus();
                const ok = document.activeElement === panel2;
                overlay2.hidden = false;
                return ok;
            })(),
            /* 反向：overlay 可见时 focus panel */
            visibleThenFocus: (() => {
                panel2.setAttribute('tabindex', '-1');
                panel2.focus();
                const ok = document.activeElement === panel2;
                return ok;
            })(),
        };
        trig2.remove();
        p2.destroy();

        return out;
    });
    console.log('\n===== D1 · NEW-03 焦点兜底根因 =====');
    console.log(JSON.stringify(d1, null, 2));

    /* ============ D2 · NEW-07 空白页隔离测量 ============ */
    const blank = await ctx.context.newPage();
    await blank.setContent('<!DOCTYPE html><html><head><title>blank</title></head><body></body></html>');
    await h.injectKit(blank, { force: true });

    const d2 = await blank.evaluate(async () => {
        const out = {};
        const sleep = ms => new Promise(r => setTimeout(r, ms));
        let modalQ = 0, tlQ = 0;
        const orig = Document.prototype.querySelectorAll;
        Document.prototype.querySelectorAll = function (sel) {
            if (sel === 'dialog:modal' || sel === 'dialog[open]') modalQ += 1;
            if (sel === 'dialog.nvui-tl') tlQ += 1;
            return orig.call(this, sel);
        };
        const snap = () => ({ m: modalQ, t: tlQ });
        const diff = (a, b) => ({ modalQueries: b.m - a.m, tlQueries: b.t - a.m });

        /* 建一个面板以装上 hostModal watcher */
        const p = window.NVUI.createPanel({ id: 'diag_blank', title: 'Blank' });
        p.open();
        await sleep(500);

        /* 1) <details> 展开/收起 */
        const det = document.createElement('details');
        det.innerHTML = '<summary>s</summary><div>x</div>';
        document.body.appendChild(det);
        let a = snap();
        det.open = true; await sleep(500);
        let b = snap();
        out.detailsOpen = { modalQueries: b.m - a.m, tlQueries: b.t - a.t };
        a = snap();
        det.open = false; await sleep(500);
        b = snap();
        out.detailsClose = { modalQueries: b.m - a.m, tlQueries: b.t - a.t };

        /* 2) 任意元素 open 属性切换 20 次 */
        const probe = document.createElement('div');
        document.body.appendChild(probe);
        a = snap();
        for (let i = 0; i < 20; i++) {
            probe.setAttribute('open', '');
            probe.removeAttribute('open');
            await sleep(20);
        }
        await sleep(500);
        b = snap();
        out.toggle20 = { modalQueries: b.m - a.m, tlQueries: b.t - a.t };

        /* 3) 宿主真实 dialog.showModal() —— 必须仍然触发降级 */
        const dlg = document.createElement('dialog');
        document.body.appendChild(dlg);
        a = snap();
        dlg.showModal();
        await sleep(600);
        b = snap();
        out.hostModalOpen = { modalQueries: b.m - a.m, tlQueries: b.t - a.t };
        out.carrierDegraded = (() => {
            const c = document.querySelector('dialog.nvui-tl');
            return c ? c.classList.contains('is-host-modal') : null;
        })();
        out.countHostModals = window.NVUI.countHostModals();
        a = snap();
        dlg.close();
        await sleep(600);
        b = snap();
        out.hostModalClose = { modalQueries: b.m - a.m, tlQueries: b.t - a.t };
        out.carrierRestored = (() => {
            const c = document.querySelector('dialog.nvui-tl');
            return c ? c.classList.contains('is-host-modal') : null;
        })();

        Document.prototype.querySelectorAll = orig;
        p.destroy();
        return out;
    });
    console.log('\n===== D2 · NEW-07 空白页隔离测量 =====');
    console.log(JSON.stringify(d2, null, 2));

    await h.cleanup();
})().catch(e => { console.error('DIAG ERROR:', e); process.exit(1); });
