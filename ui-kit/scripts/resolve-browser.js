/**
 * 浏览器依赖统一解析（Roadmap A2）
 * ---------------------------------------------------------------------------
 * 解决两个问题：
 *   1. `playwright-core` 的解析顺序散落在 11 个脚本里，且兜底路径写死了本机
 *      `C:/Users/Administrator/.workbuddy/...`，换机器只能一条条改；
 *   2. 缺包/缺 Chrome 时的报错是「无法解析」，没给出可执行修复命令。
 *
 * 解析顺序（先命中先返回）：
 *   playwright-core: PLAYWRIGHT_MODULE_PATH → 常规 require（含 repo 的 devDependency）
 *                    → NODE_PATH 里每个目录 → 本机 WorkBuddy 自带 node_modules（历史兜底）
 *   Chrome:          ST_CHROME / CHROME_PATH / NVUI_CHROME → 各平台默认安装路径
 *
 * 退出码约定：`require*()` 失败时打印修复命令并以 **2** 退出（与 test/host/ 一致，
 * 便于 `verify:all` 把「环境缺失」和「断言失败」区分开）。
 *
 * 运行时零依赖不受影响：本文件只在 `scripts/` 与 `test/` 使用，不进 4 个发布资产。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const EXIT_ENV_MISSING = 2;

function playwrightCandidates() {
    const list = [];
    const modulePath = process.env.PLAYWRIGHT_MODULE_PATH;
    if (modulePath) {
        list.push(modulePath);
        list.push(path.join(modulePath, 'playwright-core'));
    }
    list.push('playwright-core');
    const nodePath = process.env.NODE_PATH || '';
    for (const dir of nodePath.split(path.delimiter)) {
        if (dir) list.push(path.join(dir, 'playwright-core'));
    }
    /* 历史兜底：本机 WorkBuddy 自带的 node_modules（新机器走 npm i 那条路）。
       NVUI_BROWSER_DEPS_NO_LOCAL_FALLBACK=1 可关掉它，用来验证「缺包」时的退出码与修复提示。 */
    if (process.env.NVUI_BROWSER_DEPS_NO_LOCAL_FALLBACK !== '1') {
        list.push('C:/Users/Administrator/.workbuddy/binaries/node/workspace/node_modules/playwright-core');
    }
    return list;
}

/** @returns {object|null} playwright-core 模块，解析不到返回 null */
function resolvePlaywright() {
    for (const candidate of playwrightCandidates()) {
        try {
            return require(candidate);
        } catch (err) {
            /* 继续试下一个候选 */
        }
    }
    return null;
}

function playwrightFixMessage() {
    return [
        '无法解析 playwright-core。任选一种修复：',
        '  1) npm i                      （本仓库已把 playwright-core 列为 devDependency，推荐）',
        '  2) $env:PLAYWRIGHT_MODULE_PATH = "<含 playwright-core 的目录>"',
        '  3) $env:NODE_PATH = "<含 playwright-core 的 node_modules>"',
        '当前探测顺序：PLAYWRIGHT_MODULE_PATH → 本地 require → NODE_PATH → 本机兜底路径',
    ].join('\n');
}

/** 解析不到就抛错，供调用方自己决定怎么退出 */
function loadPlaywright() {
    const mod = resolvePlaywright();
    if (!mod) throw new Error(playwrightFixMessage());
    return mod;
}

/** 解析不到就打印修复命令并以退出码 2 结束 */
function requirePlaywright() {
    const mod = resolvePlaywright();
    if (!mod) {
        console.error('[FATAL] ' + playwrightFixMessage());
        process.exit(EXIT_ENV_MISSING);
    }
    return mod;
}

function chromeCandidates() {
    const env = [process.env.ST_CHROME, process.env.CHROME_PATH, process.env.NVUI_CHROME];
    const platform = [
        'C:/Program Files/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
        'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
        'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
    ];
    return env.concat(platform).filter(Boolean);
}

/** @returns {string|null} 可用的 Chrome/Edge 可执行文件路径 */
function resolveChrome() {
    for (const candidate of chromeCandidates()) {
        try {
            if (fs.existsSync(candidate)) return candidate;
        } catch (err) {
            /* 忽略不可读路径 */
        }
    }
    return null;
}

function chromeFixMessage() {
    return [
        '未找到 Chrome / Edge 可执行文件。任选一种修复：',
        '  1) $env:CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"',
        '  2) $env:ST_CHROME  = "<Chrome 路径>"（test/ 历史脚本的旧变量名，仍兼容）',
        '  3) CI 上无浏览器时跳过浏览器段：npm run verify:all -- --no-browser',
    ].join('\n');
}

/** 解析不到就打印修复命令并以退出码 2 结束 */
function requireChrome() {
    const exe = resolveChrome();
    if (!exe) {
        console.error('[FATAL] ' + chromeFixMessage());
        process.exit(EXIT_ENV_MISSING);
    }
    return exe;
}

/** 供 diagnostics / verify:all 打印的环境快照 */
function describe() {
    const pw = resolvePlaywright();
    const chrome = resolveChrome();
    return {
        repoRoot: REPO_ROOT,
        node: process.version,
        playwright: pw ? (pw.version || require.resolve('playwright-core')) : null,
        chrome: chrome,
        env: {
            PLAYWRIGHT_MODULE_PATH: process.env.PLAYWRIGHT_MODULE_PATH || '',
            NODE_PATH: process.env.NODE_PATH || '',
            CHROME_PATH: process.env.CHROME_PATH || '',
            ST_CHROME: process.env.ST_CHROME || '',
        },
    };
}

module.exports = {
    EXIT_ENV_MISSING,
    REPO_ROOT,
    describe,
    loadPlaywright,
    playwrightFixMessage,
    requireChrome,
    requirePlaywright,
    resolveChrome,
    resolvePlaywright,
};
