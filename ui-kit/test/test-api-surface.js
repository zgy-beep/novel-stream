#!/usr/bin/env node
/** v2.8.0 API 表面冻结测试：顶层 27 导出 + 面板控制器方法清单。 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const api = require(path.join(ROOT, 'nvui-api.js'));
const src = fs.readFileSync(path.join(ROOT, 'nvui-api.js'), 'utf8');

const EXPECTED_EXPORTS = [
    'VERSION', 'PANEL_CLASS', 'accordion', 'checkCompatibility', 'classes', 'clearLayoutState', 'diagnostics',
    'clampPanelLayout', 'closeLayer', 'config', 'countHostModals', 'createPanel', 'defaultStorageAdapter',
    'defaults', 'detectGlassSupport', 'getCarrierState', 'getToken', 'inputRow', 'invalidateTokenCache',
    'migrateStateV1toV2',
    'openLayer', 'progress', 'selfCheck', 'setTheme', 'showToast', 'switchRow', 'syncGlassFallback',
    'syncHostModalState', 'version',
];

const CONTROLLER_METHODS = [
    'open', 'close', 'destroy', 'setTab', 'showUpdate', 'syncIndicator', 'addNode', 'addSwitch',
    'addInput', 'addAccordion', 'trackAccordion', 'adoptAccordions', 'addProgress', 'addSectionTitle',
    'clearLayoutState', 'flushPersistSave', 'setSize', 'setMaximized', 'setGlassMode', 'getGlassState',
    'getLayoutState', 'setLayoutState',
];

const failures = [];
const actual = Object.keys(api).sort();
const expected = [...EXPECTED_EXPORTS].sort();
const missing = expected.filter((k) => !actual.includes(k));
const extra = actual.filter((k) => !expected.includes(k));
if (missing.length) failures.push('缺少导出: ' + missing.join(', '));
if (extra.length) failures.push('未登记导出: ' + extra.join(', '));

for (const method of CONTROLLER_METHODS) {
    if (!new RegExp('\\b' + method + '\\s*:').test(src)) {
        failures.push('控制器方法未实现/未登记: ' + method);
    }
}

if (!api.defaults || !Object.isFrozen(api.defaults)) failures.push('NVUI.defaults 缺失或未冻结');
if (typeof api.selfCheck !== 'function' || typeof api.checkCompatibility !== 'function') {
    failures.push('selfCheck / checkCompatibility 缺失');
}

console.log(`=== API 表面（${actual.length} 顶层导出）===`);
console.log('  ' + actual.join(', '));
if (failures.length) {
    failures.forEach((f) => console.error('  FAIL', f));
    process.exit(1);
}
console.log('API 表面冻结通过。');
