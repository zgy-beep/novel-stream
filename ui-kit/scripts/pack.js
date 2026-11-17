#!/usr/bin/env node
/**
 * v2.9.0 pack.js — 生成发布物：
 *   dist/ui-kit-<version>.zip
 *   dist/SHA256SUMS
 *   dist/manifest.json
 * 零依赖：用 Node zlib 的 deflateRaw 写最小 ZIP（deflate），CRC32 自实现。
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const version = pkg.version;
const DIST = path.join(ROOT, 'dist');
const FILES = ['tokens.css', 'components.css', 'nvui-api.js', 'tokens.json', 'README.md', 'CHANGELOG.md', 'preview.html'];

function crc32(buf) {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function dosTime(d) {
    const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((Math.floor(d.getSeconds() / 2)) & 31);
    const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
    return { time, date };
}

function makeZip(entries) {
    const localParts = [];
    const centralParts = [];
    let offset = 0;
    const now = new Date();
    const { time, date } = dosTime(now);
    for (const entry of entries) {
        const nameBuf = Buffer.from(entry.name, 'utf8');
        const data = entry.data;
        const crc = crc32(data);
        const compressed = zlib.deflateRawSync(data, { level: 9 });
        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);
        local.writeUInt16LE(20, 4);
        local.writeUInt16LE(0, 6);
        local.writeUInt16LE(8, 8);
        local.writeUInt16LE(time, 10);
        local.writeUInt16LE(date, 12);
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(compressed.length, 18);
        local.writeUInt32LE(data.length, 22);
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);
        localParts.push(local, nameBuf, compressed);

        const central = Buffer.alloc(46);
        central.writeUInt32LE(0x02014b50, 0);
        central.writeUInt16LE(20, 4);
        central.writeUInt16LE(20, 6);
        central.writeUInt16LE(0, 8);
        central.writeUInt16LE(8, 10);
        central.writeUInt16LE(time, 12);
        central.writeUInt16LE(date, 14);
        central.writeUInt32LE(crc, 16);
        central.writeUInt32LE(compressed.length, 20);
        central.writeUInt32LE(data.length, 24);
        central.writeUInt16LE(nameBuf.length, 28);
        central.writeUInt16LE(0, 30);
        central.writeUInt16LE(0, 32);
        central.writeUInt16LE(0, 34);
        central.writeUInt16LE(0, 36);
        central.writeUInt32LE(0, 38);
        central.writeUInt32LE(offset, 42);
        centralParts.push(central, nameBuf);
        offset += local.length + nameBuf.length + compressed.length;
    }
    const centralBuf = Buffer.concat(centralParts);
    const eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0);
    eocd.writeUInt16LE(0, 4);
    eocd.writeUInt16LE(0, 6);
    eocd.writeUInt16LE(entries.length, 8);
    eocd.writeUInt16LE(entries.length, 10);
    eocd.writeUInt32LE(centralBuf.length, 12);
    eocd.writeUInt32LE(offset, 16);
    eocd.writeUInt16LE(0, 20);
    return Buffer.concat([...localParts, centralBuf, eocd]);
}

function main() {
    fs.rmSync(DIST, { recursive: true, force: true });
    fs.mkdirSync(DIST, { recursive: true });

    const entries = [];
    const manifestFiles = [];
    for (const name of FILES) {
        const file = path.join(ROOT, name);
        if (!fs.existsSync(file)) throw new Error('缺少发布文件: ' + name);
        const data = fs.readFileSync(file);
        entries.push({ name, data });
        manifestFiles.push({
            path: name,
            sha256: crypto.createHash('sha256').update(data).digest('hex'),
            bytes: data.length,
        });
    }

    const zipName = `ui-kit-${version}.zip`;
    fs.writeFileSync(path.join(DIST, zipName), makeZip(entries));
    fs.writeFileSync(path.join(DIST, 'SHA256SUMS'), manifestFiles
        .map((f) => `${f.sha256}  ${f.path}`).join('\n') + '\n');

    const components = fs.readFileSync(path.join(ROOT, 'components.css'), 'utf8');
    const tokens = fs.readFileSync(path.join(ROOT, 'tokens.css'), 'utf8');
    const tokensJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'tokens.json'), 'utf8'));
    const componentsClean = components.replace(/\/\*[\s\S]*?\*\//g, '');
    const manifest = {
        name: pkg.name,
        version,
        generatedAt: new Date().toISOString(),
        files: manifestFiles,
        contracts: {
            tokens: Object.keys(tokensJson.dark || {}).length,
            classes: 84,
            keyframes: 16,
            important: (componentsClean.match(/!important/g) || []).length,
        },
        domContracts: [
            'dialog.nvui-tl > .nvui-overlay',
            'dialog.nvui-tl > .nvui-floating',
            'dialog.nvui-tl .nvui-toast-stack',
            '.nvui-panel > .nvui-panel-header/.nvui-panel-body/.nvui-panel-footer',
            '.nvui-acc > .nvui-acc-head + .nvui-acc-body > .nvui-acc-inner',
        ],
    };
    fs.writeFileSync(path.join(DIST, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    console.log(`[pack] ${zipName}`);
    console.log(`[pack] SHA256SUMS + manifest.json（${manifestFiles.length} files）`);
}

main();
