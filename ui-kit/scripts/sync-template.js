#!/usr/bin/env node
/**
 * v2.9.0 sync-template.js
 * 只做一件事：把根目录 4 个运行资产同步到 st-extension-template/ui-kit/，并打印逐文件 md5。
 * 不读写 README/AUDIT 等文档，避免把「模板同步」变成隐藏的文档改写。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const TPL = path.join(ROOT, 'st-extension-template', 'ui-kit');
const ASSETS = ['tokens.css', 'components.css', 'nvui-api.js', 'tokens.json'];

function md5(file) {
    return crypto.createHash('md5').update(fs.readFileSync(file)).digest('hex');
}

function main() {
    if (!fs.existsSync(TPL)) {
        console.error('[sync] 模板目录不存在:', TPL);
        process.exit(1);
    }
    const rows = [];
    for (const name of ASSETS) {
        const src = path.join(ROOT, name);
        const dst = path.join(TPL, name);
        if (!fs.existsSync(src)) {
            console.error('[sync] 缺少源资产:', src);
            process.exit(1);
        }
        fs.copyFileSync(src, dst);
        const hash = md5(dst);
        rows.push({ name, md5: hash });
        console.log(`[sync] ${name}  md5=${hash}`);
    }
    const manifest = {
        syncedAt: new Date().toISOString(),
        source: path.basename(ROOT),
        files: rows,
    };
    fs.writeFileSync(path.join(TPL, '.sync-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log('[sync] 完成：4 资产已同步到', TPL);
}

main();
