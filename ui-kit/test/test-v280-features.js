#!/usr/bin/env node
/**
 * v2.8.x 静态功能断言：自检、默认值、间距、force 玻璃契约。
 * 版本号一律从 package.json 读取（自 v2.8.1 起），避免每次补丁发版都要改测试。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const pkg = require(path.join(ROOT, 'package.json'));
const VERSION = pkg.version;
const api = require(path.join(ROOT, 'nvui-api.js'));
const css = fs.readFileSync(path.join(ROOT, 'components.css'), 'utf8');
const tokens = fs.readFileSync(path.join(ROOT, 'tokens.css'), 'utf8');
const failures = [];
const checks = [];

function check(name, ok, detail) {
    checks.push({ name, ok: !!ok, detail: detail || '' });
    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ->  ' + detail : ''}`);
}

check(`版本 ${VERSION} 与 selfCheck/checkCompatibility/defaults 导出`,
    api.version === VERSION && typeof api.selfCheck === 'function'
    && typeof api.checkCompatibility === 'function' && !!api.defaults);
check('defaults 冻结且覆盖 7 个组件默认值', Object.isFrozen(api.defaults)
    && ['switchRow', 'inputRow', 'accordion', 'progress', 'createPanel', 'showToast', 'actions']
        .every((k) => !!api.defaults[k]));
/* 上界同样不能用「当前大版本」：max:'3.0.0' 在 v3.0 时通过，升到 v3.1 当天就红
   （实测）。min 与 max 两边都采用不可能的边界值 —— 低到一定兼容、高到一定不兼容。 */
check('checkCompatibility min/max 语义', api.checkCompatibility({ min: '2.7.0', max: '99.0.0' }).compatible
    && !api.checkCompatibility({ min: '99.0.0' }).compatible);
const nodeCheck = api.selfCheck({ expect: VERSION });
check('selfCheck 在 Node 无 DOM 安全返回 no-dom', nodeCheck.ok === false
    && nodeCheck.issues.includes('no-dom') && nodeCheck.kitVersion === VERSION);
check(`tokens.css 包含 --nvui-kit-version ${VERSION}`,
    new RegExp(`--nvui-kit-version:\\s*"?${VERSION.replace(/\./g, '\\.')}`).test(tokens));
/* v3.0.0 起 .nvui-actions 的 flex / gap 并入按钮组统一规则（`:where(...)` 内），
   因此不能再断言字面量 `.nvui-actions {`；判据改为「它确实在那条统一规则里」。 */
check('CSS 包含 .nvui-actions 与正文相邻按钮默认间距',
    /:where\([^)]*\.nvui-actions[^)]*\)\s*\{/.test(css)
    && /:where\([^)]*\)\s*>\s*\.nvui-btn\s*\+\s*\.nvui-btn/.test(css));
check('CSS 包含 force 玻璃作用域与 4 条 !important',
    /dialog\.nvui-tl\[data-nvui-glass="force"\]\s+\.nvui-panel/.test(css)
    && (css.replace(/\/\*[\s\S]*?\*\//g, '').match(/!important/g) || []).length === 18);
check('CSS 含面板级 solid 覆盖（dialog 自身 .nvui-solid）',
    /dialog\.nvui-tl\.nvui-solid\s+\.nvui-panel/.test(css));

if (failures.length || checks.some((c) => !c.ok)) process.exit(1);
console.log(`v${VERSION} 静态功能断言通过。`);
