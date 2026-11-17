/**
 * NVUI Kit · NEW-07 补充取证：真实宿主 <details> 折叠区触发全文档查询的量化
 *
 * 背景：NEW-07 指出 MutationObserver 装在 documentElement + subtree:true +
 *       attributeFilter:['open']，任何元素 open 属性变化都会触发
 *       syncHostModalState()（内含两次全文档 querySelectorAll）。
 *       实测宿主页面里 <details> 元素天然使用 open 属性 —— 宿主折叠面板的
 *       每次展开/收起都会命中这个观察器。
 *
 * 本脚本测：
 *   1. 宿主 <details> 数量（潜在触发点）
 *   2. 展开一个真实宿主 <details> 时，触发的全文档查询次数
 *   3. 触发一次全文档 querySelectorAll('dialog:modal') 的实测耗时（成本量级）
 */
'use strict';

const h = require('./st-review-harness');

(async () => {
    const ctx = await h.launch();
    const { page } = ctx;
    await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);

    const r = await page.evaluate(async () => {
        const out = {};
        out.detailsCount = document.querySelectorAll('details').length;
        out.dialogCount = document.querySelectorAll('dialog').length;

        /* 计数：全文档查询次数 */
        let modalQ = 0, tlQ = 0;
        const origQSA = Document.prototype.querySelectorAll;
        Document.prototype.querySelectorAll = function (sel) {
            if (sel === 'dialog:modal' || sel === 'dialog[open]') modalQ += 1;
            if (sel === 'dialog.nvui-tl') tlQ += 1;
            return origQSA.call(this, sel);
        };

        /* 1) 真实宿主 <details> 展开 */
        const det = document.querySelector('details');
        out.hasHostDetails = !!det;
        if (det) {
            const b = { m: modalQ, t: tlQ };
            det.open = true;
            await new Promise(r2 => setTimeout(r2, 300));
            const a = { m: modalQ, t: tlQ };
            out.hostDetailsToggle = { modalQueries: a.m - b.m, tlQueries: a.t - b.t };

            const b2 = { m: modalQ, t: tlQ };
            det.open = false;
            await new Promise(r2 => setTimeout(r2, 300));
            const a2 = { m: modalQ, t: tlQ };
            out.hostDetailsCollapse = { modalQueries: a2.m - b2.m, tlQueries: a2.t - b2.t };
        }

        /* 2) 一次全文档查询的成本（1000 次平均） */
        Document.prototype.querySelectorAll = origQSA;
        const t0 = performance.now();
        for (let i = 0; i < 1000; i++) document.querySelectorAll('dialog:modal');
        const t1 = performance.now();
        out.querySelectorAllCostMs = { total1000: Math.round((t1 - t0) * 100) / 100, perCall: Math.round((t1 - t0) * 1000 / 1000) / 1000 };

        const t2 = performance.now();
        for (let i = 0; i < 1000; i++) document.querySelectorAll('dialog.nvui-tl');
        const t3 = performance.now();
        out.querySelectorAllTlCostMs = { total1000: Math.round((t3 - t2) * 100) / 100, perCall: Math.round((t3 - t2) * 1000 / 1000) / 1000 };

        return out;
    });

    console.log('\n===== NEW-07 补充取证 =====');
    console.log(JSON.stringify(r, null, 2));

    h.assert('[缺陷] NEW-07 宿主 <details> 展开不应触发全文档 modal 查询',
        (r.hostDetailsToggle && r.hostDetailsToggle.modalQueries) <= 0,
        `实测 modalQueries=${r.hostDetailsToggle && r.hostDetailsToggle.modalQueries}，tlQueries=${r.hostDetailsToggle && r.hostDetailsToggle.tlQueries}`);
    h.assert('[缺陷] NEW-07 宿主 <details> 收起不应触发全文档 modal 查询',
        (r.hostDetailsCollapse && r.hostDetailsCollapse.modalQueries) <= 0,
        `实测 modalQueries=${r.hostDetailsCollapse && r.hostDetailsCollapse.modalQueries}`);

    await h.cleanup();
    const ok = h.summary('NEW-07 补充取证');
    process.exit(ok ? 0 : 1);
})().catch(async e => {
    console.error('FATAL', e);
    try { await h.cleanup(); } catch (_) { /* ignore */ }
    process.exit(1);
});
