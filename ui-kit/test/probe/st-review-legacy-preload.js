/**
 * QA 预加载垫片 · 历史回归脚本「仓库注入组」
 * ------------------------------------------------------------------
 * 目的：team-lead 要求历史回归脚本除「宿主 third-party 副本组」外，
 *       还要额外用**仓库根目录新版**跑同样断言，证明两组等价。
 *
 * 实现方式（**不修改任何历史脚本**，也不碰任何产品代码）：
 *   通过 node -r 预加载，在 playwright-core 的 chromium.launch 上打补丁，
 *   给每个新 page 挂 route 拦截：把宿主 third-party 副本的
 *   nvui-api.js / components.css / tokens.css 请求，
 *   **替换为仓库根目录的同名文件内容**再返回。
 *   这样历史脚本的所有断言原封不动地跑在「仓库新版」上。
 *
 * 用法：
 *   node -r ./test/st-review-legacy-preload.js test/st-live-check.js <OUT_DIR>
 * 环境变量：
 *   ST_LEGACY_INTERCEPT=0  → 关闭拦截（退化为宿主副本组，可做对照）
 */
'use strict';

const fs = require('fs');
const path = require('path');
const Module = require('module');

const KIT_ROOT = path.resolve(__dirname, '..', '..');
const INTERCEPT_ENABLED = process.env.ST_LEGACY_INTERCEPT !== '0';

/* 宿主 third-party 副本目录（相对宿主站点） */
const HOST_THIRDPARTY = 'third-party/nvui-kit-lab/ui-kit/';

/* 需要替换的资产：仓库根目录相对路径 ← 宿主请求里的路径特征 */
const ASSETS = [
    { root: 'nvui-api.js', match: /third-party\/nvui-kit-lab\/ui-kit\/nvui-api\.js/i },
    { root: 'components.css', match: /third-party\/nvui-kit-lab\/ui-kit\/components\.css/i },
    { root: 'tokens.css', match: /third-party\/nvui-kit-lab\/ui-kit\/tokens\.css/i },
    { root: 'tokens.json', match: /third-party\/nvui-kit-lab\/ui-kit\/tokens\.json/i },
];

const origLaunch = null;

function install() {
    if (!INTERCEPT_ENABLED) {
        console.log('[legacy-preload] 拦截已关闭（ST_LEGACY_INTERCEPT=0）→ 本次为「宿主副本组」');
        return;
    }
    const pwPath = require.resolve('playwright-core');
    const pw = require(pwPath);
    if (!pw.chromium || typeof pw.chromium.launch !== 'function') {
        console.log('[legacy-preload] 无法定位 playwright-core.chromium.launch，跳过注入');
        return;
    }
    const rawLaunch = pw.chromium.launch.bind(pw.chromium);
    pw.chromium.launch = async function (opts) {
        const browser = await rawLaunch(opts);
        const origNewPage = browser.newPage.bind(browser);
        browser.newPage = async function (...args) {
            const page = await origNewPage(...args);
            attachRoute(page);
            return page;
        };
        /* 覆盖 newContext 路径下的 newPage */
        const origNewContext = browser.newContext.bind(browser);
        browser.newContext = async function (...cargs) {
            const context = await origNewContext(...cargs);
            const origCtxNewPage = context.newPage.bind(context);
            context.newPage = async function (...pargs) {
                const page = await origCtxNewPage(...pargs);
                attachRoute(page);
                return page;
            };
            return context;
        };
        return browser;
    };
    console.log('[legacy-preload] 已启用：宿主 third-party 副本请求 → 替换为仓库根目录新版');
}

function attachRoute(page) {
    page.route('**/*', async route => {
        const url = route.request().url();
        const hit = ASSETS.find(a => a.match.test(url));
        if (!hit) return route.continue();
        const file = path.join(KIT_ROOT, hit.root);
        try {
            const body = fs.readFileSync(file);
            const isJson = hit.root.endsWith('.json');
            await route.fulfill({
                status: 200,
                contentType: isJson ? 'application/json' : (hit.root.endsWith('.css') ? 'text/css' : 'application/javascript'),
                body,
            });
            console.log('[legacy-preload] 替换 ' + hit.root + '  <-  ' + url);
        } catch (e) {
            console.log('[legacy-preload] 替换失败 ' + hit.root + '：' + e.message);
            return route.continue();
        }
    });
}

install();

module.exports = { KIT_ROOT, HOST_THIRDPARTY };
