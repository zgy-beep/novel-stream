/**
 * QA 诊断 D4 · NEW-05 'path' 伪类型的 type 访问器 setter 往返
 * ------------------------------------------------------------------
 * 工程师在 nvui-api.js 中为 path 伪类型挂了 Object.defineProperty(input,'type'):
 *      get: () => 'path'
 *      set: (v) => input.setAttribute('type', v)
 * 疑点：setter 只写 DOM 属性，**不回写 getter 的缓存**，
 *      于是 input.type = 'number' 之后，读 input.type 仍返回 'path'。
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

        /* 1) path 伪类型的 getter / DOM 属性 */
        const row = window.NVUI.inputRow({ type: 'path', label: 'P' });
        document.body.appendChild(row);
        out.path = {
            idlType: row.input.type,                                  // JS 侧读到
            attrType: row.input.getAttribute('type'),                 // DOM 属性
            cls: row.input.className,
            hasIsPath: row.input.classList.contains('is-path'),
            dataNvuiType: row.input.getAttribute('data-nvui-type'),
            isTextState: row.input.type === 'text',                   // 浏览器真实状态
        };

        /* 2) setter 往返：input.type = 'number' 之后读回 */
        try {
            row.input.type = 'number';
            out.setterRoundTrip = {
                setValue: 'number',
                idlAfterSet: row.input.type,
                attrAfterSet: row.input.getAttribute('type'),
                numberBehaviorWorks: (() => {
                    const probe = row.input;
                    probe.value = '42';
                    return probe.value === '42' && probe.step !== undefined;
                })(),
                readBackCorrect: row.input.type === 'number',
            };
        } catch (e) {
            out.setterRoundTrip = { thrown: e.name + ': ' + e.message };
        }
        row.remove();

        /* 3) 对照：普通 text 类型没有访问器，setter 往返正常 */
        const row2 = window.NVUI.inputRow({ type: 'text', label: 'T' });
        document.body.appendChild(row2);
        row2.input.type = 'email';
        out.plainTextSetter = {
            idlAfterSet: row2.input.type,
            attrAfterSet: row2.input.getAttribute('type'),
            readBackCorrect: row2.input.type === 'email',
        };
        row2.remove();

        /* 4) 表单重置 / 克隆 等依赖原生 type 的场景 */
        const row3 = window.NVUI.inputRow({ type: 'path', label: 'P3' });
        document.body.appendChild(row3);
        const clone = row3.input.cloneNode(true);
        out.clone = {
            clonedIdlType: clone.type,
            clonedAttrType: clone.getAttribute('type'),
            clonedHasAccessor: (() => {
                try { return Object.getOwnPropertyDescriptor(clone, 'type') !== undefined; } catch (e) { return 'err'; }
            })(),
            originalHasOwnAccessor: Object.getOwnPropertyDescriptor(row3.input, 'type') !== undefined,
        };
        row3.remove();

        return out;
    });

    console.log('\n===== D4 · path 伪类型 type 访问器 =====');
    console.log(JSON.stringify(r, null, 2));

    await h.cleanup();
})().catch(e => { console.error('DIAG ERROR:', e); process.exit(1); });
