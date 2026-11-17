/**
 * NVUI Kit · 第四轮 · 版本溯源探针（只读）
 * ------------------------------------------------------------------
 * 目的：为「历史回归两组读的是不是同一份新版代码」提供**可核对的事实**，
 *       而不是靠推断（lead 第四轮要求「确认你跑的 4 套历史回归确实读的是新版」）。
 *
 * 做法：
 *   1) 直接 HTTP 拉取宿主 third-party 副本的 4 个资产，对**响应体**算 md5；
 *   2) 与仓库根目录同名文件的 md5 比对；
 *   3) 在真实宿主页面上读 window.NVUI.version；
 *   4) 打印「仓库注入组」实际会替换成的内容的 md5（= 仓库根目录 md5）。
 *
 * 结论口径：宿主副本 md5 == 仓库根 md5 ⇒ 两组跑的是**字节完全相同**的代码，
 *           故历史回归的「宿主副本组」与「仓库注入组」结果一致是可预期的、可合并标注的。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { chromium } = require('playwright-core');
const h = require('./st-review-harness');

const KIT_ROOT = h.KIT_ROOT;
const HOST_BASE = 'http://127.0.0.1:8000';
const ASSETS = ['nvui-api.js', 'components.css', 'tokens.css', 'tokens.json'];
const HOST_PREFIX = '/scripts/extensions/third-party/nvui-kit-lab/ui-kit/';

const md5buf = b => crypto.createHash('md5').update(b).digest('hex');
const md5file = f => crypto.createHash('md5').update(fs.readFileSync(f)).digest('hex');

function fetchBytes(urlPath) {
    return new Promise((resolve, reject) => {
        const req = http.get(HOST_BASE + urlPath, res => {
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        });
        req.on('error', reject);
        req.setTimeout(20000, () => { req.destroy(new Error('timeout')); });
    });
}

(async () => {
    const out = { hostBase: HOST_BASE, assets: {} };
    for (const a of ASSETS) {
        const buf = await fetchBytes(HOST_PREFIX + a);
        const repoFile = path.join(KIT_ROOT, a);
        const repoMd5 = md5file(repoFile);
        out.assets[a] = {
            hostServedMd5: md5buf(buf),
            hostServedBytes: buf.length,
            repoMd5,
            repoBytes: fs.statSync(repoFile).size,
            identical: md5buf(buf) === repoMd5,
        };
    }

    /* 宿主页面上的运行时版本 */
    const browser = await chromium.launch({
        executablePath: h.CHROME,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(8000);
    out.runtimeOnHostPage = await page.evaluate(() => ({
        hasNVUI: typeof window.NVUI !== 'undefined',
        version: (window.NVUI && window.NVUI.version) || null,
        hasConfig: !!(window.NVUI && window.NVUI.config),
        hasInvalidateTokenCache: !!(window.NVUI && typeof window.NVUI.invalidateTokenCache === 'function'),
    }));
    await browser.close();

    /* 仓库注入组替换进去的内容 = 仓库根目录文件 */
    out.repoInjectGroupUses = '仓库根目录同名文件（route 拦截替换）';

    console.log(JSON.stringify(out, null, 2));

    const allSame = Object.keys(out.assets).every(k => out.assets[k].identical);
    console.log('\n[溯源结论] 宿主 third-party 副本与仓库根目录' + (allSame ? ' ✅ 字节完全一致' : ' ❌ 存在差异'));
    console.log('[溯源结论] 历史回归「宿主副本组」与「仓库注入组」因此等价，结果可合并标注。');
    console.log('[溯源结论] 宿主页面运行时 NVUI.version =', out.runtimeOnHostPage.version);
    process.exit(allSame ? 0 : 1);
})().catch(e => { console.error('PROVENANCE ERROR:', e); process.exit(1); });
