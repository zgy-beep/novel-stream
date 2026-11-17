/**
 * 验证：Chrome 中非模态 dialog.show() 是否进入 top layer
 * 对照：showModal() / popover=manual / 纯 fixed div
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
        const probe = (label) => {
            // 在页面正中放一个 z-index 极高的 fixed div 作为「宿主顶层」参照
            const ref = document.createElement('div');
            ref.id = 'zzz_ref_' + label;
            ref.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;z-index:2147483647;background:rgba(255,0,0,.6);';
            document.body.appendChild(ref);
            // 测试元素
            const t = document.createElement('div');
            t.id = 'zzz_test_' + label;
            t.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;background:rgba(0,0,255,.6);';
            const hit = document.elementFromPoint(50, 50);
            const stack = document.elementsFromPoint(50, 50).map(e => e.id || e.tagName);
            out[label] = { stack, winner: hit ? (hit.id || hit.tagName) : null };
            ref.remove(); t.remove();
        };

        // 1) 纯 fixed div（无 stacking context 隔离）
        {
            const d = document.createElement('div');
            d.id = 'zzz_fixed';
            d.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;z-index:10;background:rgba(0,0,255,.6);';
            document.body.appendChild(d);
            probe('fixed_z10');
            d.remove();
        }

        // 2) 非模态 dialog.show()
        {
            const dg = document.createElement('dialog');
            dg.id = 'zzz_dialog';
            dg.style.cssText = 'position:fixed;inset:0;width:200px;height:200px;margin:0;border:0;padding:0;background:rgba(0,0,255,.6);';
            document.body.appendChild(dg);
            dg.show();
            probe('dialog_show');
            out.dialog_show__computed = {
                position: getComputedStyle(dg).position,
                zIndex: getComputedStyle(dg).zIndex,
                isModal: dg.matches(':modal'),
                open: dg.open,
            };
            dg.close(); dg.remove();
        }

        // 3) 模态 dialog.showModal()
        {
            const dg = document.createElement('dialog');
            dg.id = 'zzz_modal';
            dg.style.cssText = 'position:fixed;inset:0;width:200px;height:200px;margin:0;border:0;padding:0;background:rgba(0,0,255,.6);';
            document.body.appendChild(dg);
            dg.showModal();
            probe('dialog_showModal');
            out.dialog_showModal__computed = {
                position: getComputedStyle(dg).position,
                zIndex: getComputedStyle(dg).zIndex,
                isModal: dg.matches(':modal'),
            };
            dg.close(); dg.remove();
        }

        // 4) popover=manual
        {
            const pv = document.createElement('div');
            pv.id = 'zzz_popover';
            pv.setAttribute('popover', 'manual');
            pv.style.cssText = 'position:fixed;left:0;top:0;width:200px;height:200px;margin:0;border:0;background:rgba(0,0,255,.6);';
            document.body.appendChild(pv);
            pv.showPopover();
            probe('popover_manual');
            out.popover_manual__supported = typeof pv.showPopover === 'function';
            pv.hidePopover(); pv.remove();
        }

        // 5) 宿主里最大 z-index 抽样
        const zs = [];
        document.querySelectorAll('body *').forEach((el) => {
            const z = parseInt(getComputedStyle(el).zIndex, 10);
            if (!isNaN(z) && z >= 100) zs.push({ id: el.id, cls: (el.className || '').toString().slice(0, 50), z });
        });
        zs.sort((a, b) => b.z - a.z);
        out.hostHighZ = zs.slice(0, 25);
        return out;
    });

    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
