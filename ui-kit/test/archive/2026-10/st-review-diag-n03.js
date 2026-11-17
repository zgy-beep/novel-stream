/**
 * QA 诊断 D5 · NEW-03 第 3 级兜底（面板容器）的确定性验证
 * ------------------------------------------------------------------
 * 疑点：restoreFocus() 的第 3 级兜底是「焦点落到面板容器上」，
 *       但 restoreFocus() 是在 closeLayer 的 finish() 回调里执行的，
 *       而 finish() 在调用 done() **之前**已经 `overlayEl.hidden = true`
 *       → 面板容器 display:none → panel.focus() 静默失效。
 *
 * 宿主页面实测：焦点落在某个宿主元素（leftNavDrawerIcon），
 *               而空白页实测：落在 BODY —— 说明「落点」不确定、依赖环境。
 *
 * 本脚本在**空白页**（只注入仓库根 kit）上重复 N 次该场景，
 * 统计焦点落点分布，判断第 3 级兜底是否真的生效。
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
        const sleep = ms => new Promise(res => setTimeout(res, ms));
        const runs = [];
        for (let i = 0; i < 8; i++) {
            const trig = document.createElement('button');
            trig.id = 'd5_trig_' + i;
            document.body.appendChild(trig);
            trig.focus();
            const p = window.NVUI.createPanel({ id: 'd5_' + i, title: 'D5', focusFallback: '#a[' });
            p.open();
            await sleep(350);
            trig.style.display = 'none';         // opener 不可聚焦
            const panelEl = p.panel;
            const overlayEl = p.overlay;
            p.close();
            await sleep(900);
            const ae = document.activeElement;
            runs.push({
                i,
                activeTag: ae ? ae.tagName : null,
                activeId: ae ? ae.id : null,
                isBody: ae === document.body,
                insidePanel: !!(ae && panelEl.contains(ae)),
                overlayHidden: overlayEl.hidden,
                panelDisplay: getComputedStyle(panelEl).display,
                /* 关闭后手动聚焦面板容器是否能成功 */
                panelFocusableAfterClose: (() => {
                    const before = document.activeElement;
                    panelEl.focus();
                    const ok = document.activeElement === panelEl;
                    if (!ok && before && before.focus) before.focus();
                    return ok;
                })(),
            });
            trig.remove();
            p.destroy();
        }
        const dist = {};
        runs.forEach(r => {
            const k = r.isBody ? 'BODY' : (r.insidePanel ? 'PANEL' : (r.activeTag + '#' + (r.activeId || '')));
            dist[k] = (dist[k] || 0) + 1;
        });
        return { runs, distribution: dist };
    });

    console.log('\n===== D5 · NEW-03 第 3 级兜底确定性（空白页 ×8）=====');
    console.log(JSON.stringify(r, null, 2));

    await h.cleanup();
})().catch(e => { console.error('DIAG ERROR:', e); process.exit(1); });
