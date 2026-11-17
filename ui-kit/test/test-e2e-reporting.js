/**
 * E2E 报告统计 / 版本断言回归（纯 Node，无浏览器、无网络）
 * ---------------------------------------------------------------------------
 * 目的：锁住 test/test-e2e-v250.js 中可离线验证的三件事，防止它们再次退化：
 *   1. 声明用例总数与源码里的用例 ID 一致（当前 58）；
 *   2. --no-host / 宿主不可达时，6 条宿主用例被显式登记为 SKIP（而不是静默消失），
 *      且摘要统计 passed / failed / skipped 分开计数、SKIP 不会导致失败退出码；
 *   3. 版本断言以 package.json 的当前版本为唯一期望，逐项校验
 *      tokens.json / tokens.css / components.css / nvui-api.js(VERSION + header) /
 *      README / AI-GUIDE / 运行时 NVUI.version，任一处漂移都必须暴露。
 *
 * 运行：node test/test-e2e-reporting.js
 * 退出码：0 全通过；1 有失败。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const e2e = require('./test-e2e-v250.js');

const KIT = path.join(__dirname, '..');
let pass = 0;
let fail = 0;

function check(name, cond, detail = '') {
    const ok = !!cond;
    if (ok) pass++; else fail++;
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? `  ->  ${detail}` : ''}`);
    return ok;
}

const read = (file) => fs.readFileSync(path.join(KIT, file), 'utf8');
const source = fs.readFileSync(path.join(__dirname, 'test-e2e-v250.js'), 'utf8');

/* ---------------- 1. 用例清单 ---------------- */

check('声明用例总数为 58', e2e.DECLARED_TEST_COUNT === 58, `实际 ${e2e.DECLARED_TEST_COUNT}`);

const ids = new Set();
for (const match of source.matchAll(/\b(T[1-4]-(?:R[1-4]|BC|CB|SC)-\d{2})\b/g)) {
    ids.add(match[1]);
}
check('源码用例 ID 唯一数与声明数一致', ids.size === e2e.DECLARED_TEST_COUNT, `扫描 ${ids.size} / 声明 ${e2e.DECLARED_TEST_COUNT}`);

check('6 条宿主用例都在声明清单内', e2e.HOST_TESTS.length === 6 && e2e.HOST_TESTS.every((t) => ids.has(t.id)));
check(
    '宿主用例分布于 T1(5) + T4(1)',
    e2e.HOST_TESTS.filter((t) => t.tier === 1).length === 5
        && e2e.HOST_TESTS.filter((t) => t.tier === 4).length === 1,
    e2e.HOST_TESTS.map((t) => `${t.id}/T${t.tier}`).join(', '),
);

/* ---------------- 2. 宿主 SKIP 与统计 ---------------- */

const noHostPlan = e2e.planHostSkip('--no-host');
check(
    '--no-host 生成 6 条显式 SKIP',
    noHostPlan.length === 6 && noHostPlan.every((t) => t.status === 'SKIP'),
    `实际 ${noHostPlan.length} 条`,
);
check('SKIP 原因原样保留', noHostPlan.every((t) => t.reason === '--no-host'));
check(
    '按 tier 过滤宿主 SKIP 不丢条目',
    e2e.planHostSkip('宿主不可达', 1).length === 5 && e2e.planHostSkip('宿主不可达', 4).length === 1,
);

const mixed = e2e.summarizeResults([
    { status: 'PASS' },
    { status: 'PASS' },
    { status: 'FAIL' },
    { status: 'SKIP' },
    { status: 'SKIP' },
]);
check(
    '统计分离 passed / failed / skipped',
    mixed.passed === 2 && mixed.failed === 1 && mixed.skipped === 2 && mixed.selected === 5,
    JSON.stringify(mixed),
);
check('未选中数 = 声明数 - 选中数', mixed.notSelected === e2e.DECLARED_TEST_COUNT - 5);
check('只有 SKIP 时退出码为 0', e2e.exitCodeFor({ failed: 0 }) === 0);
check('存在 FAIL 时退出码为 1', e2e.exitCodeFor({ failed: 1 }) === 1);

/* ---------------- 3. 版本断言逻辑 ---------------- */

const V = '9.9.9';
const base = {
    packageVersion: V,
    tokensJsonVersion: V,
    tokensCss: `版本：ui-kit v${V}`,
    componentsCss: `版本：ui-kit v${V}`,
    nvuiApi: `版本：ui-kit v${V}\nvar VERSION = '${V}';`,
    readme: `> 版本：**v${V}**`,
    aiGuide: `> 版本：**v${V}**`,
    apiRuntimeVersion: V,
};

const allMatch = e2e.versionReport(V, base);
check('全部声明一致时报告 ok', allMatch.ok && allMatch.mismatches.length === 0, `checks=${allMatch.checks.length}`);
check('版本报告覆盖 9 个声明点', allMatch.checks.length === 9, allMatch.checks.map((c) => c.file).join(', '));

const mutations = [
    { file: 'package.json', patch: { packageVersion: '9.9.8' } },
    { file: 'tokens.json', patch: { tokensJsonVersion: '9.9.8' } },
    { file: 'tokens.css', patch: { tokensCss: '版本：ui-kit v9.9.8' } },
    { file: 'components.css', patch: { componentsCss: '版本：ui-kit v9.9.8' } },
    { file: 'nvui-api.js (VERSION)', patch: { nvuiApi: base.nvuiApi.replace("VERSION = '9.9.9'", "VERSION = '9.9.8'") } },
    { file: 'nvui-api.js (header)', patch: { nvuiApi: base.nvuiApi.replace('ui-kit v9.9.9', 'ui-kit v9.9.8') } },
    { file: 'README.md', patch: { readme: '> 版本：**v9.9.8**' } },
    { file: 'AI-GUIDE.md', patch: { aiGuide: '> 版本：**v9.9.8**' } },
    { file: 'nvui-api.js (runtime NVUI.version)', patch: { apiRuntimeVersion: '9.9.8' } },
];

for (const mutation of mutations) {
    const report = e2e.versionReport(V, { ...base, ...mutation.patch });
    check(
        `单点漂移可定位：${mutation.file}`,
        !report.ok
            && report.mismatches.length === 1
            && report.mismatches[0].file === mutation.file
            && report.mismatches[0].actual === '9.9.8',
        report.mismatches.map((m) => `${m.file}=${m.actual}`).join(', ') || '未捕获',
    );
}

/* ---------------- 4. 真实仓库报告自洽（不强制当前版本已对齐） ---------------- */

let apiRuntime;
try {
    apiRuntime = require(path.join(KIT, 'nvui-api.js'));
} catch (err) {
    apiRuntime = null;
}

const real = e2e.versionReport(e2e.KIT_VERSION, {
    packageVersion: JSON.parse(read('package.json')).version,
    tokensJsonVersion: JSON.parse(read('tokens.json')).version,
    tokensCss: read('tokens.css'),
    componentsCss: read('components.css'),
    nvuiApi: read('nvui-api.js'),
    readme: read('README.md'),
    aiGuide: read('AI-GUIDE.md'),
    apiRuntimeVersion: apiRuntime ? apiRuntime.version : undefined,
});

check('真实仓库期望版本来自 package.json', real.version === e2e.KIT_VERSION, `KIT_VERSION=${e2e.KIT_VERSION}`);
check('真实仓库报告 9 项齐全', real.checks.length === 9);
check(
    '真实仓库报告逐项自洽（ok 与 actual 一致）',
    real.checks.every((c) => c.ok === (c.actual === e2e.KIT_VERSION)),
    real.checks.map((c) => `${c.file}=${c.actual}`).join(', '),
);
check(
    '真实仓库不一致项全部进入 mismatches（不被吞掉）',
    real.mismatches.length === real.checks.filter((c) => !c.ok).length,
);

/* ---------------- 5. E2E 源码契约 ---------------- */

check('E2E 不再硬编码 2.5.0 作为 package.json 期望', !/pkg\.version\s*===\s*['"]2\.5\.0['"]/.test(source));
check('E2E 从 package.json 读取 KIT_VERSION', /const KIT_VERSION\s*=\s*JSON\.parse\(fs\.readFileSync\(PATHS\.packageJson/.test(source));
check('E2E 摘要有独立的 Skipped 字段', /Skipped\s*:/.test(source));
check('E2E 宿主 SKIP 走显式 planHostSkip', /planHostSkip\(/.test(source));
check('E2E 被 require 时不会启动浏览器（main 有守卫）', /if \(require\.main === module\)/.test(source));

/* ---------------- 汇总 ---------------- */

console.log(`\n=== E2E 报告统计回归: 通过 ${pass}, 失败 ${fail} ===`);
if (fail > 0) {
    process.exit(1);
}
console.log('用例清单、宿主 SKIP 统计与版本断言逻辑一致。');
process.exit(0);
