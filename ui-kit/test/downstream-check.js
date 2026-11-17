#!/usr/bin/env node
/**
 * v2.9.0 downstream-check.js
 * 只依赖 4 个运行资产；可随资产拷入下游 ui-kit/test/ 后执行：
 *   node ui-kit/test/downstream-check.js
 * 不读取 README/CHANGELOG/AUDIT；失败 exit 1。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const HERE = __dirname;
const ROOT = fs.existsSync(path.join(HERE, '..', 'tokens.css')) ? path.join(HERE, '..') : process.cwd();
const failures = [];
const passes = [];

function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function ok(msg) { passes.push(msg); }
function fail(msg) { failures.push(msg); }

function main() {
    for (const name of ['tokens.css', 'components.css', 'nvui-api.js', 'tokens.json']) {
        if (!fs.existsSync(path.join(ROOT, name))) fail(`缺少运行资产 ${name}`);
    }
    if (failures.length) return finish();

    const pkgPath = path.join(ROOT, 'package.json');
    const pkg = fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync(pkgPath, 'utf8')) : null;
    const tokensCss = read('tokens.css');
    const componentsCss = read('components.css');
    const apiSrc = read('nvui-api.js');
    const tokensJson = JSON.parse(read('tokens.json'));

    const versionMatch = apiSrc.match(/var VERSION = '([^']+)'/);
    const apiVersion = versionMatch ? versionMatch[1] : '';
    if (!apiVersion) fail('nvui-api.js 未找到 VERSION');
    else ok(`NVUI.version=${apiVersion}`);

    const cssVersion = (tokensCss.match(/--nvui-kit-version:\s*"?([^";\s]+)"?/) || [])[1] || '';
    if (!cssVersion) fail('tokens.css 缺少 --nvui-kit-version');
    else if (cssVersion !== apiVersion) fail(`tokens.css 版本 ${cssVersion} != NVUI.version ${apiVersion}`);
    else ok(`tokens.css 版本 ${cssVersion}`);

    if (tokensJson.version !== apiVersion) fail(`tokens.json 版本 ${tokensJson.version} != ${apiVersion}`);
    else ok(`tokens.json 版本 ${apiVersion}`);

    if (pkg && pkg.version !== apiVersion) fail(`package.json 版本 ${pkg.version} != ${apiVersion}`);
    else if (pkg) ok(`package.json 版本 ${apiVersion}`);

    const darkKeys = Object.keys(tokensJson.dark || {});
    if (darkKeys.length !== 111) fail(`tokens.json dark 令牌 ${darkKeys.length}，期望 111`);
    else ok('tokens.json dark 111');

    for (const key of ['--nvui-glass-bg', '--nvui-glass-blur', '--nvui-kit-version', '--nvui-z-layer']) {
        if (!tokensJson.dark || !(key in tokensJson.dark)) fail(`tokens.json dark 缺少 ${key}`);
    }
    if (!failures.length) ok('关键 token 齐全');

    const componentsClean = componentsCss.replace(/\/\*[\s\S]*?\*\//g, '');
    const important = (componentsClean.match(/!important/g) || []).length;
    if (important !== 18) fail(`components.css !important=${important}，期望 18`);
    else ok('!important 18');

    try {
        const api = require(path.join(ROOT, 'nvui-api.js'));
        if (api.version !== apiVersion) fail(`require NVUI.version=${api.version} != ${apiVersion}`);
        if (typeof api.selfCheck !== 'function') fail('NVUI.selfCheck 不可用');
        if (!api.defaults) fail('NVUI.defaults 不可用');
        if (!failures.length) ok('Node 侧 API 可加载');
    } catch (err) {
        fail('Node require nvui-api.js 失败: ' + err.message);
    }

    finish();
}

function finish() {
    console.log('=== downstream-check ===');
    passes.forEach((p) => console.log('  PASS', p));
    if (failures.length) {
        failures.forEach((f) => console.error('  FAIL', f));
        process.exit(1);
    }
    console.log('升级自检通过。');
}

main();
