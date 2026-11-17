/**
 * 决定性实验：三种载体在真实 ST 中能否压住 #sheld / #chat
 * 注意：dialog 必须显式给 width/height，否则 UA 的 fit-content 会让它塌成 0x0
 */
const { chromium } = require('playwright-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = process.argv[2];
const FULL = 'position:fixed;left:0;top:0;width:100vw;height:100vh;margin:0;border:0;padding:0;';

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(9000);

    const res = await page.evaluate(() => {
        const FULL = 'position:fixed;left:0;top:0;width:100vw;height:100vh;margin:0;border:0;padding:0;';
        const out = {};
        const PTS = [[700, 400], [300, 200], [1000, 600]];
        const stackAt = (x, y) => (document.elementsFromPoint(x, y) || [])
            .map(e => e.id || (e.className || '').toString().slice(0, 35) || e.tagName);
        const wins = (id) => PTS.map(([x, y]) => stackAt(x, y)[0] === id);

        const mkCarrier = (id, extra, tag) => {
            const e = document.createElement(tag);
            e.id = id;
            e.style.cssText = FULL + extra;
            document.body.appendChild(e);
            return e;
        };
        const mkChild = (carrier, id) => {
            const c = document.createElement('div');
            c.id = id;
            c.style.cssText = 'position:absolute;inset:0;background:rgba(0,120,255,.25);z-index:1000020;';
            carrier.appendChild(c);
            return c;
        };

        out.baselineTop = PTS.map(([x, y]) => stackAt(x, y)[0]);

        // D：现状 —— dialog.show() + 载体 z-index:auto
        {
            const dg = mkCarrier('D_carrier', '', 'dialog');
            mkChild(dg, 'D_child');
            dg.show();
            out.D_dialog_auto = {
                wins: wins('D_child'),
                top: PTS.map(([x, y]) => stackAt(x, y)[0]),
                rect: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(dg.getBoundingClientRect()),
                carrierZ: getComputedStyle(dg).zIndex,
            };
            dg.close(); dg.remove();
        }

        // E：dialog.show() + 载体 z-index:2147483647
        {
            const dg = mkCarrier('E_carrier', 'z-index:2147483647;', 'dialog');
            mkChild(dg, 'E_child');
            dg.show();
            out.E_dialog_zmax = {
                wins: wins('E_child'),
                top: PTS.map(([x, y]) => stackAt(x, y)[0]),
                rect: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(dg.getBoundingClientRect()),
            };
            dg.close(); dg.remove();
        }

        // F：popover=manual（真 top layer）
        {
            const pv = mkCarrier('F_carrier', '', 'div');
            pv.setAttribute('popover', 'manual');
            mkChild(pv, 'F_child');
            pv.showPopover();
            out.F_popover = {
                wins: wins('F_child'),
                top: PTS.map(([x, y]) => stackAt(x, y)[0]),
                rect: (r => ({ w: Math.round(r.width), h: Math.round(r.height) }))(pv.getBoundingClientRect()),
            };
            pv.hidePopover(); pv.remove();
        }

        // G：dialog.show() + 载体 z-max vs 宿主 z-max fixed div
        {
            const dg = mkCarrier('G_carrier', 'z-index:2147483647;', 'dialog');
            mkChild(dg, 'G_child');
            dg.show();
            const zmax = document.createElement('div');
            zmax.id = 'G_zmax';
            zmax.style.cssText = FULL + 'z-index:2147483647;background:transparent;';
            document.body.appendChild(zmax);
            out.G_dialog_vs_zmax = { wins: wins('G_child'), top: PTS.map(([x, y]) => stackAt(x, y)[0]) };
            zmax.remove();
            dg.close(); dg.remove();
        }

        // H：popover=manual vs 宿主 z-max fixed div
        {
            const pv = mkCarrier('H_carrier', '', 'div');
            pv.setAttribute('popover', 'manual');
            mkChild(pv, 'H_child');
            pv.showPopover();
            const zmax = document.createElement('div');
            zmax.id = 'H_zmax';
            zmax.style.cssText = FULL + 'z-index:2147483647;background:transparent;';
            document.body.appendChild(zmax);
            out.H_popover_vs_zmax = { wins: wins('H_child'), top: PTS.map(([x, y]) => stackAt(x, y)[0]) };
            zmax.remove();
            pv.hidePopover(); pv.remove();
        }

        const zs = [];
        document.querySelectorAll('body *').forEach((el) => {
            const z = parseInt(getComputedStyle(el).zIndex, 10);
            if (!isNaN(z) && z > 1000 && !(el.className || '').toString().includes('nvui')) {
                zs.push({ id: el.id, cls: (el.className || '').toString().slice(0, 40), z });
            }
        });
        zs.sort((a, b) => b.z - a.z);
        out.hostMaxZ = zs.slice(0, 10);
        return out;
    });

    console.log(JSON.stringify(res, null, 2));
    await browser.close();
})();
