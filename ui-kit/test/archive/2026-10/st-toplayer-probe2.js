/**
 * 探针 v3：#chat 的 stacking context 链 + popover 在真实 ST 中能否压住 #chat
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

    const res = await page.evaluate(() => {
        const out = {};
        const chain = (el) => {
            const arr = [];
            let n = el;
            while (n && n.nodeType === 1) {
                const cs = getComputedStyle(n);
                arr.push({
                    tag: n.tagName,
                    id: n.id,
                    cls: (n.className || '').toString().slice(0, 60),
                    z: cs.zIndex,
                    pos: cs.position,
                    transform: cs.transform !== 'none',
                    filter: cs.filter !== 'none',
                    willChange: cs.willChange,
                    contain: cs.contain,
                    isolation: cs.isolation,
                    opacity: cs.opacity,
                });
                n = n.parentElement;
            }
            return arr;
        };
        out.chatChain = chain(document.getElementById('chat'));
        out.sheldChain = chain(document.getElementById('sheld'));

        // 现有 NVUI overlay 链
        const ov = document.getElementById('novel_stream_panel-overlay') || document.querySelector('.nvui-overlay');
        out.overlayChain = ov ? chain(ov) : null;

        // 真实测试：popover=manual 能否压住 #chat
        const pv = document.createElement('div');
        pv.id = 'zzz_pop';
        pv.setAttribute('popover', 'manual');
        pv.style.cssText = 'position:fixed;inset:0;margin:0;border:0;padding:0;background:rgba(0,120,255,.35);pointer-events:none;';
        document.body.appendChild(pv);
        pv.showPopover();
        const stack = document.elementsFromPoint(700, 400).map(e => e.id || (e.className || '').toString().slice(0, 40) || e.tagName);
        out.popoverStackAt700x400 = stack;
        out.popoverTop = (document.elementsFromPoint(700, 400)[0] || {}).id;
        pv.hidePopover(); pv.remove();

        // 对照：dialog[popover=manual] 组合
        try {
            const dg = document.createElement('dialog');
            dg.id = 'zzz_dgp';
            dg.setAttribute('popover', 'manual');
            dg.style.cssText = 'position:fixed;inset:0;margin:0;border:0;padding:0;background:rgba(0,120,255,.35);pointer-events:none;';
            document.body.appendChild(dg);
            dg.showPopover();
            out.dialogPopover = {
                ok: true,
                stack: document.elementsFromPoint(700, 400).map(e => e.id || e.tagName).slice(0, 3),
                open: dg.open,
            };
            dg.hidePopover(); dg.remove();
        } catch (e) {
            out.dialogPopover = { ok: false, err: String(e) };
        }

        // 对照：dialog.show() 在真实 ST 中能否压住 #chat
        {
            const dg = document.createElement('dialog');
            dg.id = 'zzz_dgs';
            dg.style.cssText = 'position:fixed;inset:0;margin:0;border:0;padding:0;background:rgba(0,120,255,.35);pointer-events:none;';
            document.body.appendChild(dg);
            dg.show();
            out.dialogShowStack = document.elementsFromPoint(700, 400).map(e => e.id || e.tagName).slice(0, 3);
            dg.close(); dg.remove();
        }

        out.uaSupport = {
            popoverApi: typeof HTMLElement.prototype.showPopover === 'function',
            dialogApi: typeof HTMLDialogElement !== 'undefined',
        };
        return out;
    });

    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
