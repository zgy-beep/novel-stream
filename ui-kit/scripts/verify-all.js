#!/usr/bin/env node
/**
 * verify-all.js — 一键门禁（Roadmap A3）
 * ---------------------------------------------------------------------------
 * 一条命令跑完「发布前必须为真」的全部静态项，并在有浏览器的机器上追加
 * 浏览器段（浏览器 spec / 压力 / e2e）。CI 上没有 Chrome 时浏览器段自动跳过、
 * 不报错；任何断言失败都以非零退出码结束。
 *
 * 顺序固定：
 *   test → test:api → test:v280 → test:compat → downstream:check → verify:release
 *   → pack + 产物校验 → test:browser → test:stress → test:e2e
 *
 * 用法：
 *   node scripts/verify-all.js                 # 全量（无浏览器则跳过三段）
 *   node scripts/verify-all.js --no-browser    # CI / 快检：只跑静态 + 打包
 *   node scripts/verify-all.js --only=test,pack
 *   node scripts/verify-all.js --list          # 只列步骤名
 *
 * 退出码：0 全绿（含跳过）；1 有步骤失败。
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const browserDeps = require('./resolve-browser');

const ROOT = browserDeps.REPO_ROOT;
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = pkg.version;

const argv = process.argv.slice(2);
const noBrowser = argv.includes('--no-browser');
const onlyArg = (argv.find((a) => a.startsWith('--only=')) || '').slice('--only='.length);
const only = onlyArg ? onlyArg.split(',').map((s) => s.trim()).filter(Boolean) : null;

const steps = [
    { name: 'test', label: '静态规范（npm test）', cmd: ['npm', ['test']] },
    { name: 'api', label: '导出面冻结（test:api）', cmd: ['npm', ['run', 'test:api']] },
    { name: 'v280', label: 'v2.8.x 契约（test:v280）', cmd: ['npm', ['run', 'test:v280']] },
    { name: 'compat', label: '兼容矩阵（test:compat）', cmd: ['npm', ['run', 'test:compat']] },
    { name: 'downstream', label: '下游 4 资产自检（downstream:check）', cmd: ['npm', ['run', 'downstream:check']] },
    { name: 'release', label: '发布一致性（verify:release）', cmd: ['npm', ['run', 'verify:release']] },
    { name: 'pack', label: `打包 + 产物校验 v${VERSION}`, cmd: ['npm', ['run', 'pack']], verify: verifyArtifacts },
    { name: 'browser', label: '浏览器 spec（test:browser）', cmd: ['npm', ['run', 'test:browser']], needsBrowser: true },
    { name: 'stress', label: '压力/竞态（test:stress）', cmd: ['npm', ['run', 'test:stress']], needsBrowser: true },
    { name: 'e2e', label: '全路径 e2e（test:e2e）', cmd: ['npm', ['run', 'test:e2e']], needsBrowser: true },
];

if (argv.includes('--list')) {
    for (const s of steps) console.log(s.name.padEnd(11) + s.label);
    process.exit(0);
}

function sha256(file) {
    return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/** pack 产物校验：zip 存在且是合法 ZIP；SHA256SUMS 与仓库文件一致；manifest 版本/文件表对齐 */
function verifyArtifacts() {
    const dist = path.join(ROOT, 'dist');
    const problems = [];
    const zip = path.join(dist, `ui-kit-${VERSION}.zip`);
    if (!fs.existsSync(zip)) {
        problems.push('缺少 dist/ui-kit-' + VERSION + '.zip');
    } else {
        const head = fs.readFileSync(zip).subarray(0, 4);
        if (head[0] !== 0x50 || head[1] !== 0x4b || head[2] !== 0x03 || head[3] !== 0x04) {
            problems.push('zip 头不是 PK\\x03\\x04（可能写坏）');
        }
        if (fs.statSync(zip).size < 1024) problems.push('zip 体积异常（<1KB）');
    }

    const sumsFile = path.join(dist, 'SHA256SUMS');
    if (!fs.existsSync(sumsFile)) {
        problems.push('缺少 dist/SHA256SUMS');
    } else {
        const lines = fs.readFileSync(sumsFile, 'utf8').trim().split('\n').filter(Boolean);
        if (!lines.length) problems.push('SHA256SUMS 为空');
        for (const line of lines) {
            const m = line.match(/^([0-9a-f]{64})\s{2}(.+)$/);
            if (!m) {
                problems.push('SHA256SUMS 行格式异常: ' + line.slice(0, 40));
                continue;
            }
            const src = path.join(ROOT, m[2]);
            if (!fs.existsSync(src)) {
                problems.push('SHA256SUMS 指向的文件不存在: ' + m[2]);
            } else if (sha256(src) !== m[1]) {
                problems.push('SHA256SUMS 哈希与仓库文件不一致: ' + m[2]);
            }
        }
    }

    const manifestFile = path.join(dist, 'manifest.json');
    if (!fs.existsSync(manifestFile)) {
        problems.push('缺少 dist/manifest.json');
    } else {
        try {
            const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
            if (manifest.version !== VERSION) {
                problems.push(`manifest.version=${manifest.version} 与 package.json=${VERSION} 不一致`);
            }
            if (!Array.isArray(manifest.files) || manifest.files.length < 4) {
                problems.push('manifest.files 少于 4 个资产');
            }
        } catch (err) {
            problems.push('manifest.json 解析失败: ' + err.message);
        }
    }
    return problems;
}

const colors = process.stdout.isTTY
    ? { dim: '\x1b[90m', red: '\x1b[31m', green: '\x1b[32m', yellow: '\x1b[33m', bold: '\x1b[1m', reset: '\x1b[0m' }
    : { dim: '', red: '', green: '', yellow: '', bold: '', reset: '' };

/* 代理会污染本地 127.0.0.1 的浏览器/宿主访问：子进程一律清掉并设 NO_PROXY */
const env = Object.assign({}, process.env);
for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'all_proxy']) {
    delete env[k];
}
env.NO_PROXY = '*';

function runStep(step) {
    console.log('\n' + colors.bold + '▶ ' + step.label + colors.reset + colors.dim
        + '  [' + step.cmd[0] + ' ' + step.cmd[1].join(' ') + ']' + colors.reset);
    const t0 = Date.now();
    const res = spawnSync(step.cmd[0], step.cmd[1], { cwd: ROOT, env, stdio: 'inherit', shell: true });
    const ms = Date.now() - t0;
    if (res.status !== 0) {
        return { status: 'fail', ms, detail: 'exit=' + (res.status === null ? res.signal : res.status) };
    }
    if (step.verify) {
        const problems = step.verify();
        if (problems.length) return { status: 'fail', ms, detail: problems.join('; ') };
    }
    return { status: 'pass', ms, detail: '' };
}

function main() {
    const pw = browserDeps.resolvePlaywright();
    const chrome = browserDeps.resolveChrome();
    const browserReady = !noBrowser && !!(pw && chrome);
    const skipReason = noBrowser
        ? '--no-browser'
        : !pw
            ? '未找到 playwright-core（npm i 或设 PLAYWRIGHT_MODULE_PATH）'
            : !chrome
                ? '未找到 Chrome（设 CHROME_PATH）'
                : '';

    const picked = steps.filter((s) => !only || only.includes(s.name));
    const results = [];

    console.log(colors.bold + 'verify:all · v' + VERSION + colors.reset
        + colors.dim + '  node ' + process.version + '  ' + (browserReady ? '浏览器段可用' : '浏览器段将跳过：' + skipReason) + colors.reset);

    let skipped = 0;
    for (const step of picked) {
        if (step.needsBrowser && !browserReady) {
            console.log('\n' + colors.yellow + '⊘ 跳过 ' + step.label + colors.reset
                + colors.dim + '（' + skipReason + '）' + colors.reset);
            results.push({ label: step.label, status: 'skip', ms: 0, detail: skipReason });
            skipped += 1;
            continue;
        }
        const r = runStep(step);
        results.push(Object.assign({ label: step.label }, r));
        if (r.status === 'fail') {
            console.log('\n' + colors.red + '✗ ' + step.label + ' 失败：' + r.detail + colors.reset);
            break;
        }
    }

    console.log('\n' + colors.bold + '── verify:all 汇总 ──' + colors.reset);
    for (const r of results) {
        const tag = r.status === 'pass' ? colors.green + 'PASS' + colors.reset
            : r.status === 'skip' ? colors.yellow + 'SKIP' + colors.reset
                : colors.red + 'FAIL' + colors.reset;
        const ms = r.ms ? String(r.ms) + 'ms' : '—';
        console.log('  ' + tag + '  ' + r.label.padEnd(34) + colors.dim + ms.padStart(8)
            + (r.detail ? '  ' + r.detail : '') + colors.reset);
    }

    const failed = results.filter((r) => r.status === 'fail');
    const passed = results.filter((r) => r.status === 'pass').length;
    console.log('\n  ' + (failed.length
        ? colors.red + '结果：' + failed.length + ' 项失败 / ' + passed + ' 项通过 / ' + skipped + ' 项跳过' + colors.reset
        : colors.green + '结果：' + passed + ' 项通过' + (skipped ? ' / ' + skipped + ' 项跳过' : '') + colors.reset));
    process.exit(failed.length ? 1 : 0);
}

main();
