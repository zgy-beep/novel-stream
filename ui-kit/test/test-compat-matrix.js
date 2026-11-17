/**
 * test-compat-matrix.js — 兼容矩阵硬门禁（Roadmap C4 / GH-#19）
 * ---------------------------------------------------------------------------
 * 「支持到哪个版本」以前散在三处：README 的一句话、ST 模板 manifest 的
 * `minimum_client_version`、以及没人维护的口头约定。这三处一旦不一致，
 * 下游拿着 A 版本去配 B 宿主就会踩空，而 CI 什么都不会说。
 *
 * 本脚本把它们钉在一起（任一不符即非零退出）：
 *   1. README 必须有「兼容矩阵」表，且**包含当前版本那一行**（发版必须补行）
 *   2. 该行声明的宿主最低版本 === st-extension-template/manifest.json 的
 *      `minimum_client_version`
 *   3. 该行声明的 Node 最低版本 === package.json 的 `engines.node`，且当前 Node 满足它
 *   4. 运行时的版本判定与矩阵自洽：
 *      checkCompatibility({ min: 当前 }) 必须通过；min 高于当前必须不通过
 *
 * 用法：node test/test-compat-matrix.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const failures = [];
const notes = [];
function check(name, ok, detail) {
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ->  ' + detail : ''}`);
    if (!ok) failures.push(name + (detail ? ' (' + detail + ')' : ''));
}

const pkg = JSON.parse(read('package.json'));
const VERSION = pkg.version;
const manifest = JSON.parse(read(path.join('st-extension-template', 'manifest.json')));
const readme = read('README.md');
const NVUI = require(path.join(ROOT, 'nvui-api.js'));

/* ---- 1. README 兼容矩阵：找到当前版本那一行 ---- */
/* 必须以 §11.5 的**标题**为锚点，不能裸搜「兼容矩阵」四个字：README 里别处（§10.10 速查表、
   §11.4 时间线）也会提到它，裸搜会切到时间线上、把日期当宿主版本读（实测 v3.0.0 收口时
   就这么红过一次：README=2026-11-16 / manifest=1.12.0）。 */
const matrixHeading = readme.search(/^#{2,4}\s*11\.5\s+兼容矩阵/m);
let matrixSection = '';
if (matrixHeading !== -1) {
    /* 下一个标题的位置 = 本节的结束。不能拿 `rest.slice(1)` 去搜 `^#{2,4}`
       —— 那会把本节自己的标题当成「下一个标题」（`## 11.5` 本身就以 `##` 开头）。 */
    const headingRe = /^#{2,4}\s+\S.*$/gm;
    let next = -1;
    let m;
    while ((m = headingRe.exec(readme)) !== null) {
        if (m.index > matrixHeading) { next = m.index; break; }
    }
    matrixSection = next === -1 ? readme.slice(matrixHeading) : readme.slice(matrixHeading, next);
}
const rows = matrixSection.split('\n')
    .filter((l) => /^\|\s*v\d+\.\d+\.\d+\s*\|/.test(l))
    .map((l) => l.split('|').map((c) => c.trim()).filter(Boolean));
const currentRow = rows.find((r) => r[0] === 'v' + VERSION);

/* 判据按「大版本线」而不是「每个版本一行」：补丁不可能每次都动最小宿主要求，
   要求逐版本补行只会逼人复制粘贴。规则是 —— 当前版本所属的大版本线（vX.0.0）
   必须在表里，且新开一条线必须当天补。
   例：跑 2.9.0 → 需要 v2.0.0 行；跑 3.0.0 → 需要 v3.0.0 行。 */
const lineVersion = 'v' + VERSION.split('.')[0] + '.0.0';
const lineRow = rows.find((r) => r[0] === lineVersion) || currentRow;

check('README 有「兼容矩阵」表', matrixHeading !== -1 && rows.length > 0, `找到 ${rows.length} 行`);
check(`兼容矩阵声明了当前大版本线 ${lineVersion}（新开一条线必须当天补行）`, !!lineRow,
    lineRow ? lineRow.join(' | ') : `已有：${rows.map((r) => r[0]).join(', ')}`);

/* ---- 2. 宿主最低版本必须与 ST 模板 manifest 一致 ---- */
if (lineRow) {
    /* 列序：Kit | 宿主最低（ST minimum_client_version）| Node 最低（engines）| 依据 */
    const hostMin = lineRow[1];
    const nodeMin = lineRow[2];
    check('矩阵的宿主最低版本 === ST 模板 manifest.minimum_client_version',
        hostMin === manifest.minimum_client_version,
        `README=${hostMin} / manifest=${manifest.minimum_client_version}`);

    /* ---- 3. Node 最低版本 === engines.node，且当前 Node 满足 ---- */
    const enginesNode = (pkg.engines && pkg.engines.node) || '';
    check('package.json 声明了 engines.node', !!enginesNode, enginesNode || '缺少 engines.node');
    const norm = (v) => String(v).replace(/^[>=^~\s]+/, '');
    check('矩阵的 Node 最低版本 === package.json engines.node',
        !!enginesNode && norm(nodeMin) === norm(enginesNode),
        `README=${nodeMin} / engines=${enginesNode}`);
    const curMajor = parseInt(process.versions.node.split('.')[0], 10);
    const minMajor = parseInt(norm(enginesNode).split('.')[0], 10);
    check('当前 Node 满足 engines.node', !isNaN(minMajor) && curMajor >= minMajor,
        `当前 ${process.versions.node} / 要求 ${enginesNode}`);
}

/* ---- 4. 运行时版本判定与矩阵自洽 ---- */
check('checkCompatibility({ min: 当前版本 }) 通过',
    NVUI.checkCompatibility({ min: VERSION }).compatible === true);
check('checkCompatibility({ min: 高于当前 }) 不通过（矩阵不会把未来版本蒙成可用）',
    NVUI.checkCompatibility({ min: '99.0.0' }).compatible === false);

/* ---- 5. 迁移器与状态版本：v3 必须能把 v1 存档读成 v2 ---- */
const migrated = NVUI.migrateStateV1toV2({ version: 1, size: { width: 800, height: 600, isMaximized: true } });
check('migrateStateV1toV2 把 v1 读成 v2（规格：w / h / mode）',
    !!migrated && migrated.version === 2 && !!migrated.size
    && migrated.size.w === 800 && migrated.size.h === 600 && migrated.size.mode === 'maximized');

notes.push(`矩阵行：${lineRow ? lineRow.slice(0, 3).join(' / ') : '无'}`);

console.log('\n------------------------------------------------------------');
if (failures.length) {
    console.log(`\x1b[31m兼容矩阵门禁失败：${failures.length} 项\x1b[0m`);
    failures.forEach((f) => console.log('  - ' + f));
    process.exit(1);
}
console.log(`\x1b[32m兼容矩阵门禁通过（v${VERSION}）\x1b[0m  ${notes.join(' ; ')}`);
