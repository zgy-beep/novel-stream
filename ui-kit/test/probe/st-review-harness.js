/**
 * NVUI Kit · ST 实机验证脚手架（review harness）
 * ------------------------------------------------------------------
 * 用途：为后续实机验证脚本提供统一入口，避免每个脚本重复写
 *      启动浏览器 / 收集日志 / 注入 kit / 断言 / 收尾 的样板代码。
 *
 * 设计要点：
 *   1. launch() 一律清掉代理环境变量（http_proxy / https_proxy 等），
 *      否则访问 127.0.0.1 会绕代理导致连不上；并带 --no-sandbox。
 *   2. injectKit() 用 page.addScriptTag / addStyleTag 把**仓库根目录**的
 *      nvui-api.js / components.css / tokens.css 注入宿主页面，
 *      从而保证测的是被评审的版本，而不是宿主 third-party 里可能过期的副本。
 *   3. assert() 统一收集 PASS/FAIL，summary() 打印汇总与失败明细，
 *      退出码在有失败时为 1，便于 CI / 人工判定。
 *   4. cleanup() 关闭浏览器并输出 pageerror 摘要。
 *
 * 用法示例：
 *   const h = require('./st-review-harness');
 *   (async () => {
 *       const ctx = await h.launch();
 *       await ctx.page.goto(h.HOST_URL, { waitUntil: 'domcontentloaded' });
 *       await ctx.page.waitForTimeout(8000);
 *       await h.injectKit(ctx.page);
 *       const r = await ctx.page.evaluate(() => ({
 *           has: typeof window.NVUI !== 'undefined',
 *           version: window.NVUI?.version,
 *       }));
 *       h.assert('NVUI 注入成功', r.has === true, JSON.stringify(r));
 *       await h.cleanup();
 *   })();
 */
'use strict';

const path = require('path');
const { chromium } = require('playwright-core');

/* ==================== 常量 ==================== */

const KIT_ROOT = path.resolve(__dirname, '..', '..');
const HOST_URL = process.env.ST_HOST_URL || 'http://127.0.0.1:8000/';
const CHROME = process.env.ST_CHROME
    || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const KIT_ASSETS = {
    api: path.join(KIT_ROOT, 'nvui-api.js'),
    components: path.join(KIT_ROOT, 'components.css'),
    tokens: path.join(KIT_ROOT, 'tokens.css'),
};

/* ==================== 断言收集器 ==================== */

const results = [];

/**
 * 记录一条断言。
 * @param {string} name 断言名
 * @param {boolean} cond 断言结果（真=通过）
 * @param {*} [detail] 附加信息
 */
function assert(name, cond, detail) {
    const pass = !!cond;
    results.push({ name, pass, detail: detail === undefined ? '' : String(detail) });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail !== undefined ? '  ->  ' + detail : ''}`);
    return pass;
}

/**
 * 打印汇总。返回是否全部通过。
 */
function summary(title) {
    const total = results.length;
    const passed = results.filter(r => r.pass).length;
    const failed = total - passed;
    console.log(`\n===== ${title || '断言汇总'} =====`);
    console.log(`总计 ${total} | 通过 ${passed} | 失败 ${failed}`);
    if (failed) {
        console.log('\n失败明细:');
        results.filter(r => !r.pass).forEach(r => {
            console.log(`  - ${r.name}${r.detail ? '  ->  ' + r.detail : ''}`);
        });
    }
    return failed === 0;
}

/** 清空已收集的断言（供多个独立场景复用同一脚本时调用）。 */
function resetAssertions() {
    results.length = 0;
}

/* ==================== 浏览器生命周期 ==================== */

let browser = null;
let context = null;
let page = null;
const consoleLogs = [];
const pageErrors = [];

/**
 * 启动浏览器 + 新 context/page，并挂上 console / pageerror 收集。
 * @returns {Promise<{browser,context,page,consoleLogs,pageErrors}>}
 */
async function launch(opts) {
    const options = opts || {};

    // 关键：清掉代理环境变量，避免 localhost 被代理劫持
    for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
        delete process.env[k];
    }
    process.env.NO_PROXY = process.env.NO_PROXY || '*';
    process.env.no_proxy = process.env.no_proxy || '*';

    browser = await chromium.launch({
        executablePath: CHROME,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    context = await browser.newContext({
        viewport: options.viewport || { width: 1440, height: 900 },
    });
    page = await context.newPage();

    page.on('console', m => {
        const line = `[${m.type()}] ${m.text()}`;
        consoleLogs.push(line);
        if (options.echoConsole) console.log(line);
    });
    page.on('pageerror', e => {
        pageErrors.push(e.message);
        console.log(`[pageerror] ${e.message}`);
    });

    return { browser, context, page, consoleLogs, pageErrors };
}

/**
 * 把仓库根目录的 kit 资产注入宿主页面。
 * 注入顺序：tokens.css -> components.css -> nvui-api.js
 * （nvui-api.js 必须是最后注入的，因为它依赖样式已就位）
 *
 * @param {import('playwright-core').Page} targetPage
 * @param {{force?:boolean}} [opts] force=true 时即使页面已有 NVUI 也再注入一份（用于对比宿主版本）
 */
async function injectKit(targetPage, opts) {
    const p = targetPage || page;
    if (!p) throw new Error('injectKit: 没有可用的 page，请先调用 launch()');
    const options = opts || {};

    if (!options.force) {
        const already = await p.evaluate(() => typeof window.NVUI !== 'undefined');
        if (already) {
            console.log('[harness] 页面已存在 window.NVUI，跳过注入（如需强制注入请传 {force:true}）');
            return { injected: false, reason: 'NVUI already present' };
        }
    }

    await p.addStyleTag({ path: KIT_ASSETS.tokens });
    await p.addStyleTag({ path: KIT_ASSETS.components });
    await p.addScriptTag({ path: KIT_ASSETS.api });

    const info = await p.evaluate(() => ({
        hasNVUI: typeof window.NVUI !== 'undefined',
        version: window.NVUI ? window.NVUI.version : null,
        hasCreatePanel: !!(window.NVUI && typeof window.NVUI.createPanel === 'function'),
    }));
    console.log('[harness] injectKit 完成:', JSON.stringify(info));
    return { injected: true, ...info };
}

/**
 * 关闭浏览器，输出 pageerror 摘要。
 */
async function cleanup() {
    if (browser) {
        try { await browser.close(); } catch (e) { /* ignore */ }
    }
    browser = null;
    context = null;
    page = null;
    const errs = pageErrors.slice();
    console.log(`\n[harness] pageerror 数量: ${errs.length}`);
    errs.slice(0, 20).forEach(e => console.log('  [pageerror]', e));
    return errs;
}

module.exports = {
    KIT_ROOT,
    KIT_ASSETS,
    HOST_URL,
    CHROME,
    launch,
    injectKit,
    assert,
    summary,
    resetAssertions,
    cleanup,
    get page() { return page; },
    get consoleLogs() { return consoleLogs; },
    get pageErrors() { return pageErrors; },
};
