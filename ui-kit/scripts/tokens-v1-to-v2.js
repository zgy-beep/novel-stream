/**
 * tokens-v1-to-v2.js — 把 tokens.json 从 schema v1 升到 v2（GH-#19 / C3）
 * ---------------------------------------------------------------------------
 * v1 只有 `{ dark: {token: value}, light: {...} }`：机器能读值，但读不到
 * 「这是什么」「属于哪一组」「是颜色还是长度」。下游想做令牌面板、做类型校验、
 * 或让 AI 生成界面时按语义挑选，都只能靠 token 名前缀猜。
 *
 * v2 的边界（刻意保守）：
 *   - **值结构不动**：dark / light 仍是 { token: value } 的扁平映射，键顺序保持原样。
 *     改结构会让所有下游解析器当场失效，而 v2 要解决的只是「缺元信息」。
 *   - 新增 `schema: 2` 与 `meta`：每个 token 一条 `{ group, type, description }`。
 *   - 分组与描述**从 tokens.css 的注释里取**，不新写一套文档：
 *     `/* ==== 表面 / 背景 ==== *\/` 是分组，token 上方/行尾的注释是描述。
 *     这样 tokens.css 仍是唯一出处（文件头本来就写着「由 tokens.css 生成」）。
 *
 * 用法：node scripts/tokens-v1-to-v2.js [--check]
 *   --check  只校验 tokens.json 是否为 v2 且 meta 覆盖完整（CI 用），不写文件。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CSS_PATH = path.join(ROOT, 'tokens.css');
const JSON_PATH = path.join(ROOT, 'tokens.json');

const TOKEN_RE = /^\s*(--nvui-[\w-]+)\s*:\s*([^;]+);\s*(?:\/\*\s*(.*?)\s*\*\/\s*)?$/;
const GROUP_RE = /\/\*\s*=+\s*(.+?)\s*=+\s*\*\//;

function inferType(rawValue) {
    const v = String(rawValue).trim();
    if (/^var\(/.test(v)) return 'alias';
    if (/^#/.test(v) || /^(rgb|rgba|hsl|hsla|oklch|lab|lch|color|color-mix)\(/.test(v) || v === 'transparent') return 'color';
    if (/^-?\d*\.?\d+(ms|s)$/.test(v)) return 'duration';
    if (/^(cubic-bezier|steps|linear)\(/.test(v) || v === 'linear' || v === 'ease' || v === 'ease-in-out') return 'easing';
    if (/^-?\d*\.?\d+(px|rem|em|ex|ch|vh|vw|dvh|dvw|vmin|vmax|pt|%)$/.test(v)) return 'length';
    if (/^-?\d*\.?\d+$/.test(v)) return 'number';
    if ((/^["']/.test(v) || v.indexOf(',') !== -1) && /serif|sans|mono|system-ui|ui-|inherit/i.test(v)) return 'font';
    if (/^(inset|0\s)/.test(v) || /px\s+-?\d/.test(v)) return 'shadow';
    if (!/\d/.test(v)) return 'keyword';
    return 'other';
}

/* 扫描 tokens.css：只认两个块 —— :root/.nvui-scope（深色默认）与 .nvui-theme-light */
function parseCss() {
    const lines = fs.readFileSync(CSS_PATH, 'utf8').split(/\r?\n/);
    const blocks = { dark: [], light: [] };
    let current = null;
    let depth = 0;
    let group = '未分组';
    let pendingComment = '';
    let inComment = false;
    let inPlainComment = false;
    let groupProse = '';
    const groupDescriptions = {};

    for (const line of lines) {
        const trimmed = line.trim();

        if (!current) {
            if (/^(:root|\.nvui-scope)[\s,{]/.test(trimmed) || /^:root,\s*$/.test(trimmed)) {
                current = 'dark';
                depth = 0;
                group = '未分组';
                continue;
            }
            if (/^\.nvui-theme-light\s*\{/.test(trimmed)) {
                current = 'light';
                depth = 0;
                group = '未分组';
                continue;
            }
            continue;
        }

        if (trimmed === '}' && depth === 0) {
            current = null;
            continue;
        }
        if (/\{/.test(trimmed)) depth++;
        if (/\}/.test(trimmed) && depth > 0) {
            depth--;
            /* 深度回到 0 = 当前块结束。必须在这里把 current 清掉，否则下一个块的
               `.nvui-theme-light {` 会被当成「块内的一行」，整段浅色值会被吸进深色表
               （实测就是这样把 --nvui-bg 写成 #f7f8fc 的）。 */
            if (depth === 0) {
                current = null;
                continue;
            }
        }

        const gm = trimmed.match(GROUP_RE);
        if (gm) {
            group = gm[1].replace(/\s+/g, ' ').trim();
            pendingComment = '';
            continue;
        }
        /* 多行分组头：`/* ================= 表面 / 背景 =================`（闭合在后续行）。
           这一段的散文说明属于「整组」，不该硬塞给紧跟其后的第一个 token ——
           于是收进 groupDescriptions，token 只认自己那行/上一行的单行注释。 */
        if (/^\/\*/.test(trimmed) && /={4,}/.test(trimmed)) {
            const gm2 = trimmed.match(/={4,}\s*(.+?)\s*={4,}/);
            if (gm2) {
                group = gm2[1].replace(/\s+/g, ' ').trim();
                pendingComment = '';
                groupProse = '';
                inComment = trimmed.indexOf('*/') === -1;
                if (!inComment) groupDescriptions[group] = '';
                continue;
            }
        }
        /* 空行 = 段落结束：上一段的注释不再顺延给后面的 token */
        if (!trimmed) {
            pendingComment = '';
            continue;
        }
        if (inComment) {
            /* 分组头的续行：拼成整组说明 */
            const body = trimmed.replace(/^\/\*\s*/, '').replace(/\*\/\s*$/, '').replace(/^\*\s?/, '').trim();
            if (body && !/^={4,}/.test(body)) groupProse = (groupProse ? groupProse + ' ' : '') + body;
            if (trimmed.indexOf('*/') !== -1) {
                inComment = false;
                groupDescriptions[group] = groupProse.replace(/\s+/g, ' ').trim();
            }
            continue;
        }
        if (/^\/\*/.test(trimmed) && trimmed.indexOf('*/') === -1) {
            /* 普通多行注释：整段拼成 pendingComment */
            pendingComment = trimmed.replace(/^\/\*\s*/, '').trim();
            inPlainComment = true;
            continue;
        }
        if (inPlainComment) {
            const body = trimmed.replace(/^\*\s?/, '').replace(/\*\/\s*$/, '').trim();
            pendingComment = (pendingComment ? pendingComment + ' ' : '') + body;
            if (trimmed.indexOf('*/') !== -1) {
                inPlainComment = false;
                pendingComment = pendingComment.replace(/\s+/g, ' ').trim();
            }
            continue;
        }
        const m = trimmed.match(TOKEN_RE);
        if (m) {
            blocks[current].push({
                key: m[1],
                value: m[2].trim(),
                group: group,
                description: (m[3] || pendingComment || '').replace(/\s+/g, ' ').trim(),
            });
            /* 刻意不清 pendingComment：CSS 里一条注释常常统管紧邻的连续几个 token
               （「输入控件底 / 行内代码底 / 遮罩底 / 开关关闭态轨道」就是四行一个注释）。
               空行或分组头会把它清掉，所以不会跨段传染。 */
            continue;
        }
        if (trimmed) pendingComment = '';
    }
    return { blocks: blocks, groupDescriptions: groupDescriptions };
}

function main() {
    const checkOnly = process.argv.includes('--check');
    const json = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
    const parsedAll = parseCss();
    const parsed = parsedAll.blocks;
    const groupDescriptions = parsedAll.groupDescriptions;

    const byKey = {};
    for (const t of parsed.dark) byKey[t.key] = t;
    for (const t of parsed.light) if (!byKey[t.key]) byKey[t.key] = t;

    const cssValues = {};
    for (const t of parsed.dark) cssValues[t.key] = t.value;

    /* 值以 CSS 为准（它是唯一出处）；但键顺序沿用现有 json，避免无意义的大 diff */
    const dark = {};
    const meta = {};
    const drift = [];
    for (const key of Object.keys(json.dark)) {
        const fromCss = cssValues[key];
        if (fromCss !== undefined && fromCss !== String(json.dark[key])) {
            drift.push(`${key}: css=${fromCss} json=${json.dark[key]}`);
        }
        dark[key] = (fromCss !== undefined) ? fromCss : json.dark[key];
        const info = byKey[key];
        meta[key] = {
            group: info ? info.group : '未分组',
            type: inferType(dark[key]),
            description: info ? info.description : '',
        };
    }
    for (const key of Object.keys(cssValues)) {
        if (!(key in dark)) drift.push(`${key}: 存在于 tokens.css 但不在 tokens.json`);
    }

    const out = {
        schema: 2,
        name: json.name,
        version: json.version,
        description: json.description,
        generatedFrom: json.generatedFrom || 'tokens.css',
        schemaNote: 'v2 只新增 schema 与 meta（group / type / description），dark / light 的值结构与键顺序不变。',
        meta: meta,
        groupDescriptions: groupDescriptions,
        dark: dark,
        light: json.light,
    };

    if (checkOnly) {
        const bad = [];
        if (json.schema !== 2) bad.push(`schema=${json.schema}（应为 2）`);
        if (!json.meta) bad.push('缺少 meta');
        else {
            const missing = Object.keys(json.dark).filter((k) => !json.meta[k]);
            if (missing.length) bad.push(`meta 缺 ${missing.length} 项：${missing.slice(0, 4).join(', ')}`);
        }
        if (drift.length) bad.push(`与 tokens.css 漂移：${drift.slice(0, 4).join(' | ')}`);
        if (bad.length) {
            console.error('[tokens] schema v2 校验失败：\n  - ' + bad.join('\n  - '));
            process.exit(1);
        }
        console.log('[tokens] schema v2 校验通过（' + Object.keys(json.dark).length + ' 个 token，meta 全覆盖）');
        return;
    }

    if (drift.length) {
        console.warn('[tokens] 与 tokens.css 存在差异，已以 CSS 为准：\n  - ' + drift.slice(0, 6).join('\n  - '));
    }
    fs.writeFileSync(JSON_PATH, JSON.stringify(out, null, 2) + '\n');
    const groups = new Set(Object.values(meta).map((m) => m.group));
    console.log('[tokens] tokens.json → schema 2：' + Object.keys(dark).length + ' token / '
        + groups.size + ' 组 / light ' + Object.keys(out.light).length + ' 覆盖');
}

main();
