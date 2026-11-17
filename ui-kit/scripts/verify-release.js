#!/usr/bin/env node
/**
 * v2.9.0 verify-release.js
 * 以 package.json.version 为唯一版本源，校验发布前必须一致的静态契约。
 * 零依赖；失败 exit 1 并逐条打印原因。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const failures = [];
const notes = [];

function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function md5(file) { return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex'); }
function fail(msg) { failures.push(msg); }
function ok(msg) { notes.push(msg); }

const pkg = JSON.parse(read('package.json'));
const version = String(pkg.version || '');
const semverOk = /^\d+\.\d+\.\d+$/.test(version);
if (!semverOk) fail(`package.json.version 不是合法 semver: ${version}`);
else ok(`version=${version}`);

const tokensCss = read('tokens.css');
const componentsCss = read('components.css');
const apiSrc = read('nvui-api.js');
const tokensJson = JSON.parse(read('tokens.json'));

if (!tokensCss.includes(`ui-kit v${version}`)) fail(`tokens.css 文件头不是 v${version}`);
else ok('tokens.css 文件头');
if (!componentsCss.includes(`ui-kit v${version}`)) fail(`components.css 文件头不是 v${version}`);
else ok('components.css 文件头');
if (!apiSrc.includes(`var VERSION = '${version}'`)) fail(`nvui-api.js VERSION 不是 ${version}`);
else ok('nvui-api.js VERSION');
if (tokensJson.version !== version) fail(`tokens.json version=${tokensJson.version}，期望 ${version}`);
else ok('tokens.json version');
if (!/--nvui-kit-version:\s*"?([^";\s]+)"?/.test(tokensCss)) fail('tokens.css 缺少 --nvui-kit-version');
else {
    const m = tokensCss.match(/--nvui-kit-version:\s*"?([^";\s]+)"?/);
    if (m[1] !== version) fail(`--nvui-kit-version=${m[1]}，期望 ${version}`);
    else ok('--nvui-kit-version');
}

const darkCount = Object.keys(tokensJson.dark || {}).length;
if (darkCount !== 111) fail(`tokens.json dark 令牌 ${darkCount}，期望 111`);
else ok('tokens.json dark 111');

const componentsCssClean = componentsCss.replace(/\/\*[\s\S]*?\*\//g, '');
const important = (componentsCssClean.match(/!important/g) || []).length;
if (important !== 18) fail(`components.css !important=${important}，期望 18`);
else ok('!important 18');

if (!read('README.md').includes(`版本：**v${version}**`)) fail(`README 标题版本不是 v${version}`);
else ok('README 标题版本');
if (!read('preview.html').includes(`UI Kit v${version}`)) fail(`preview.html 标题不是 v${version}`);
else ok('preview.html 标题');
if (!read('CHANGELOG.md').includes(`## v${version}`)) fail(`CHANGELOG 缺少 v${version} 条目`);
else ok('CHANGELOG 条目');

/* 升级文档：UPGRADING 是常青入口，MIGRATION-v2 是 v2 全系速查。
   v3 起每开一个 MAJOR 都要有一份 MIGRATION-v<major>.md —— 破坏性变更不能只写在 CHANGELOG 里。
   判据跟着 major 走，升到 v4 时要求的是 MIGRATION-v4.md，不用改这段代码。 */
const docList = ['UPGRADING.md', 'MIGRATION-v2.md'];
const majorVersion = Number(version.split('.')[0]);
if (majorVersion >= 3) docList.push(`MIGRATION-v${majorVersion}.md`);
for (const doc of docList) {
    if (!fs.existsSync(path.join(ROOT, doc))) fail(`缺少升级文档 ${doc}`);
    else ok(`升级文档 ${doc}`);
}

/* 流程规范文档：发布动作、提交纪律、issue 关闭判据的唯一出处。
   缺章节说明有人只删了文档没改流程，发布前必须拦住。 */
const maintainDoc = read('MAINTAINING.md');
const maintainSections = ['## 1. 提交规范', '## 2. 版本迭代规范', '## 3. GitHub Issue 维护规范'];
const missingSections = maintainSections.filter((h) => !maintainDoc.includes(h));
if (missingSections.length) fail(`MAINTAINING.md 缺少章节：${missingSections.join(' / ')}`);
else ok('MAINTAINING.md 三章齐全（提交 / 版本 / Issue）');

const TPL = path.join(ROOT, 'st-extension-template', 'ui-kit');
for (const name of ['tokens.css', 'components.css', 'nvui-api.js', 'tokens.json']) {
    const rootFile = path.join(ROOT, name);
    const tplFile = path.join(TPL, name);
    if (!fs.existsSync(tplFile)) { fail(`模板缺少 ${name}`); continue; }
    const rootMd5 = md5(rootFile);
    const tplMd5 = md5(tplFile);
    if (rootMd5 !== tplMd5) fail(`模板 ${name} MD5 不一致`);
    else ok(`模板 ${name} MD5`);
}

/* README §11.4 版本时间线：必须含当前版本行。
   反向验证用 --self-test：把合成文本喂给同一判定函数，证明「版本写错时会红」。 */
function hasTimelineRow(text, v) {
    const i = text.indexOf('### 11.4');
    if (i === -1) return false;
    return text.slice(i).includes(`| v${v} |`);
}
const readmeSrc = read('README.md');
if (!hasTimelineRow(readmeSrc, version)) fail(`README §11.4 版本时间线缺少 v${version} 行`);
else ok('README §11.4 时间线');

if (process.argv.includes('--self-test')) {
    const cases = [
        ['### 11.4 版本时间线（摘要）\n\n| v1.2.3 | 2026-01-01 |', '1.2.3', true],
        ['### 11.4 版本时间线（摘要）\n\n| v1.2.4 | 2026-01-01 |', '1.2.3', false],
        ['## 11. 版本管理\n\n无时间线', '1.2.3', false],
    ];
    let bad = 0;
    cases.forEach(([text, v, expect], idx) => {
        const got = hasTimelineRow(text, v);
        if (got !== expect) { bad++; console.error(`  SELFTEST FAIL case ${idx + 1}: got ${got}, expect ${expect}`); }
    });
    if (bad) process.exit(1);
    console.log(`  SELFTEST PASS ${cases.length}/${cases.length}（写错版本必红）`);
}

const cdnRe = new RegExp(`@v?${version.replace(/\./g, '\\.')}`, 'g');
const cdnCount = (read('README.md').match(cdnRe) || []).length;
if (cdnCount < 3) fail(`README CDN 示例未锁定 @v${version}（命中 ${cdnCount} 次）`);
else ok(`README CDN tag v${version}`);

console.log(`=== verify:release (v${version}) ===`);
notes.forEach((n) => console.log('  PASS', n));
if (failures.length) {
    failures.forEach((f) => console.error('  FAIL', f));
    process.exit(1);
}
console.log('全部通过。');
