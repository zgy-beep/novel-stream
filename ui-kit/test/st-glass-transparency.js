/**
 * 玻璃透明感回归测试（零依赖，Node + 本机 Chrome + CDP + PNG 像素分析）
 *
 * 用法：node test/st-glass-transparency.js [输出目录]
 * 覆盖 v2.7.2 的四条核心行为：
 *   1. 面板单层玻璃：面板本体无 backdrop-filter，磨砂由遮罩提供；背景细节透出 ≥ 25%
 *   2. `.nvui-solid`：用户实心优先，背景细节透出 ≈ 0
 *   3. 宿主禁用模糊（body.no-blur）：自动半透明回退 `.nvui-glass-fallback`，透出 ≥ 12%，且不挂 `.nvui-solid`
 *   4. 加载顺序竞争：kit CSS 未就绪时不落回退；CSS 就绪后可自愈
 *   5. prefers-reduced-transparency：回退不透明；`.nvui-solid` 与自动回退同时存在时实心优先
 *
 * 说明：与 test/test-ui-kit.js 的静态契约互补；本脚本需要本机 Chrome，故不放进 `npm test`。
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

const KIT = path.resolve(__dirname, '..');
const browserDeps = require('../scripts/resolve-browser');
const CHROME = process.env.NVUI_CHROME || browserDeps.resolveChrome()
    || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.NVUI_CDP_PORT || 9350);
const PROFILE = path.join(process.env.TEMP, 'nvui-glass-' + Date.now());
const OUT = process.argv[2] || path.join(KIT, 'test', 'out', 'glass-transparency');
const tokensCss = fs.readFileSync(path.join(KIT, 'tokens.css'), 'utf8');
const componentsCss = fs.readFileSync(path.join(KIT, 'components.css'), 'utf8');
const apiJs = fs.readFileSync(path.join(KIT, 'nvui-api.js'), 'utf8');
const safeApiJs = apiJs.replace(/<\/script/gi, '<\\/script');

const checks = [];
function check(name, cond, detail) {
    checks.push({ name, ok: !!cond, detail: detail || '' });
    console.log(`[${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? '  ->  ' + detail : ''}`);
}

/* ---------------- PNG 解码（8-bit RGB/RGBA 非隔行） ---------------- */
function decodePng(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not png');
    let off = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
    const idat = [];
    while (off < buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('ascii', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'IHDR') {
            width = data.readUInt32BE(0); height = data.readUInt32BE(4);
            bitDepth = data[8]; colorType = data[9];
            if (bitDepth !== 8 || data[12] !== 0) throw new Error('unsupported png');
        } else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        off += 12 + len;
    }
    const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
    if (!ch) throw new Error('unsupported color type ' + colorType);
    const raw = zlib.inflateSync(Buffer.concat(idat));
    const stride = width * ch;
    const out = Buffer.alloc(width * height * 4);
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
        const filter = raw[y * (stride + 1)];
        const line = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
        for (let x = 0; x < stride; x++) {
            const a = x >= ch ? line[x - ch] : 0;
            const b = prev[x];
            const c = x >= ch ? prev[x - ch] : 0;
            let v = line[x];
            if (filter === 1) v = (v + a) & 0xff;
            else if (filter === 2) v = (v + b) & 0xff;
            else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
            else if (filter === 4) {
                const p = a + b - c;
                const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
                v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
            }
            line[x] = v;
        }
        for (let x = 0; x < width; x++) {
            const si = x * ch, di = (y * width + x) * 4;
            out[di] = line[si]; out[di + 1] = line[si + 1]; out[di + 2] = line[si + 2];
            out[di + 3] = ch === 4 ? line[si + 3] : 255;
        }
        prev = line;
    }
    return { width, height, data: out };
}

function lum(data, i) { return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; }

function regionStats(img, x0, y0, x1, y1) {
    const values = [];
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(img.height, Math.ceil(y1)); y++) {
        for (let x = Math.max(0, Math.floor(x0)); x < Math.min(img.width, Math.ceil(x1)); x++) {
            values.push(lum(img.data, (y * img.width + x) * 4));
        }
    }
    const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
    const std = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, values.length));
    return { mean, std };
}

/** 面板内部 vs 面板左侧（仅遮罩）的条纹对比度；返回 0 表示完全实心 */
function stripeVisibility(img, rect) {
    const rows = [rect.y + rect.h * 0.55, rect.y + rect.h * 0.75];
    const ins = rows.map((y) => regionStats(img, rect.x + 80, y - 18, rect.x + rect.w - 80, y + 18));
    const outs = rows.map((y) => regionStats(img, Math.max(0, rect.x - 280), y - 18, Math.max(1, rect.x - 20), y + 18));
    const inStd = ins.reduce((s, r) => s + r.std, 0) / ins.length;
    const outStd = outs.reduce((s, r) => s + r.std, 0) / outs.length;
    return { inStd, outStd, ratio: inStd / Math.max(0.01, outStd) };
}

/* ---------------- CDP ---------------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
class CDP {
    constructor(ws) {
        this.ws = ws; this.id = 0; this.pending = new Map(); this.events = [];
        ws.addEventListener('message', (ev) => {
            const msg = JSON.parse(ev.data);
            if (msg.id && this.pending.has(msg.id)) {
                const { resolve, reject } = this.pending.get(msg.id);
                this.pending.delete(msg.id);
                msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
            } else if (msg.method) this.events.push(msg);
        });
    }
    send(method, params = {}) {
        const id = ++this.id;
        return new Promise((resolve, reject) => {
            this.pending.set(id, { resolve, reject });
            this.ws.send(JSON.stringify({ id, method, params }));
        });
    }
    waitFor(method, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const started = Date.now();
            const tick = () => {
                const idx = this.events.findIndex((e) => e.method === method);
                if (idx >= 0) { const [ev] = this.events.splice(idx, 1); resolve(ev.params); return; }
                if (Date.now() - started > timeout) { reject(new Error('timeout ' + method)); return; }
                setTimeout(tick, 40);
            };
            tick();
        });
    }
    clear() { this.events.length = 0; }
}

async function waitHttp(url, timeout = 20000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
        try { const res = await fetch(url); if (res.ok) return res; } catch (e) { /* retry */ }
        await sleep(200);
    }
    throw new Error('CDP not up: ' + url);
}

const BACKDROP_CSS = `<style>
  html, body { margin: 0; height: 100%; }
  body {
    background:
      radial-gradient(circle 220px at 18% 22%, #ff2d55 0 99%, transparent 100%),
      radial-gradient(circle 260px at 82% 74%, #00c2ff 0 99%, transparent 100%),
      repeating-linear-gradient(90deg, #ffffff 0 120px, #101018 120px 240px);
    background-attachment: fixed;
  }
</style>`;

function panelHtml() {
    return `<dialog class="nvui-tl nvui-scope" open>
  <div class="nvui-overlay is-panel" id="ov">
    <div class="nvui-panel" role="dialog" aria-modal="true" aria-labelledby="t">
      <div class="nvui-sheet-handle" aria-hidden="true"></div>
      <div class="nvui-panel-header"><b class="nvui-panel-title" id="t">玻璃探针</b></div>
      <div class="nvui-panel-body">
        <div class="nvui-panel-heading"><span class="nvui-section-title">设置</span></div>
        <label class="nvui-switch-row is-feature"><input type="checkbox" checked><span>示例开关</span></label>
      </div>
      <div class="nvui-panel-footer"><button type="button" class="nvui-btn is-primary">保存</button></div>
    </div>
  </div>
</dialog>`;
}

function htmlWithKit() {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${BACKDROP_CSS}<style>${tokensCss}\n${componentsCss}</style></head>
<body>${panelHtml()}<script>${safeApiJs}<\/script></body></html>`;
}

const MEASURE = `(() => {
  const panel = document.querySelector('.nvui-panel');
  const overlay = document.querySelector('.nvui-overlay');
  const pcs = panel ? getComputedStyle(panel) : null;
  const ocs = overlay ? getComputedStyle(overlay) : null;
  const r = panel ? panel.getBoundingClientRect() : null;
  return {
    rootClass: document.documentElement.className,
    bodyClass: document.body.className,
    panelBg: pcs ? pcs.backgroundColor : null,
    panelBackdrop: pcs ? (pcs.backdropFilter || pcs.webkitBackdropFilter || '') : null,
    overlayBackdrop: ocs ? (ocs.backdropFilter || ocs.webkitBackdropFilter || '') : null,
    rect: r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null,
  };
})()`;

class Harness {
    constructor() {
        this.chrome = null; this.cdp = null; this.targetId = null; this.nav = 0;
    }
    async start() {
        this.chrome = spawn(CHROME, [
            '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
            '--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--disable-extensions',
            '--window-size=1280,900', 'about:blank',
        ], { stdio: 'ignore' });
        await waitHttp(`http://127.0.0.1:${PORT}/json/version`);
        const page = await (await fetch(`http://127.0.0.1:${PORT}/json/new?url=about:blank`, { method: 'PUT' })).json();
        this.targetId = page.id;
        const ws = new WebSocket(page.webSocketDebuggerUrl);
        await new Promise((resolve, reject) => { ws.addEventListener('open', resolve); ws.addEventListener('error', reject); });
        this.cdp = new CDP(ws);
        await this.cdp.send('Page.enable');
        await this.cdp.send('Runtime.enable');
        await this.cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false });
    }
    async navigate(html, tag) {
        fs.mkdirSync(OUT, { recursive: true });
        const file = path.join(OUT, `${String(++this.nav).padStart(2, '0')}-${tag}.html`);
        fs.writeFileSync(file, html, 'utf8');
        this.cdp.clear();
        await this.cdp.send('Page.navigate', { url: 'file:///' + file.replace(/\\/g, '/') });
        await this.cdp.waitFor('Page.loadEventFired');
        await this.settle();
    }
    async settle() {
        await this.cdp.send('Runtime.evaluate', {
            expression: 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 120))))',
            awaitPromise: true,
        });
    }
    async eval(expression) {
        const { result, exceptionDetails } = await this.cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (exceptionDetails) throw new Error('eval: ' + JSON.stringify(exceptionDetails.exception || exceptionDetails.text));
        return result.value;
    }
    async shot(name) {
        const { data } = await this.cdp.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
        const buf = Buffer.from(data, 'base64');
        const file = path.join(OUT, name + '.png');
        fs.writeFileSync(file, buf);
        return decodePng(buf);
    }
    async media(features) {
        await this.cdp.send('Emulation.setEmulatedMedia', { features });
        await this.settle();
    }
    async stop() {
        try { await fetch(`http://127.0.0.1:${PORT}/json/close/${this.targetId}`); } catch (e) { /* ignore */ }
        try { this.cdp.ws.close(); } catch (e) { /* ignore */ }
        try { this.chrome.kill(); } catch (e) { /* ignore */ }
    }
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const h = new Harness();
    const report = { generatedAt: new Date().toISOString(), cases: [] };
    try {
        await h.start();

        /* 1. 面板单层玻璃 */
        await h.navigate(htmlWithKit(), 'panel');
        let m = await h.eval(MEASURE);
        let img = await h.shot('panel-single-layer');
        let sv = stripeVisibility(img, m.rect);
        check('面板自身声明 backdrop-filter（透明面板 + 背后模糊）', /blur/.test(m.panelBackdrop || ''), m.panelBackdrop);
        check('遮罩层同时提供整页磨砂（overlay backdrop-filter 含 blur）', /blur/.test(m.overlayBackdrop || ''), m.overlayBackdrop);
        check('玻璃态面板背后细节可见但不透明（条纹对比度 ≥ 8%）', sv.ratio >= 0.08, `ratio=${sv.ratio.toFixed(3)}`);
        report.cases.push({ case: 'panel-single-layer', measure: m, stripe: sv });

        /* 2. .nvui-solid 实心优先 */
        await h.eval("document.documentElement.classList.add('nvui-solid')");
        await h.settle();
        m = await h.eval(MEASURE);
        img = await h.shot('panel-solid');
        sv = stripeVisibility(img, m.rect);
        check('.nvui-solid：面板不透明且细节透出 ≈ 0', m.panelBg === 'rgb(22, 26, 36)' && sv.ratio < 0.05, `bg=${m.panelBg} ratio=${sv.ratio.toFixed(3)}`);
        report.cases.push({ case: 'panel-solid', measure: m, stripe: sv });

        /* 3. 宿主 no-blur：半透明回退 */
        const noBlurCss = 'body.no-blur *, body.no-blur { -webkit-backdrop-filter: unset !important; backdrop-filter: unset !important; }';
        const noBlurHtml = htmlWithKit()
            .replace('<body>', '<body class="no-blur">')
            .replace('</head>', `<style>${noBlurCss}</style></head>`);
        await h.navigate(noBlurHtml, 'no-blur');
        const fallback = await h.eval("(() => { const supported = NVUI.syncGlassFallback({ force: true }); return { supported, rootClass: document.documentElement.className }; })()");
        await h.settle();
        m = await h.eval(MEASURE);
        img = await h.shot('panel-no-blur-fallback');
        sv = stripeVisibility(img, m.rect);
        check('no-blur：检测为不支持模糊', fallback.supported === false, JSON.stringify(fallback));
        check('no-blur：自动挂 .nvui-glass-fallback 且不挂 .nvui-solid',
            /nvui-glass-fallback/.test(fallback.rootClass) && !/nvui-solid/.test(fallback.rootClass), fallback.rootClass);
        check('no-blur：面板为 token 派生 97% 不透明回退（color-mix，极轻透出）',
            /color\(srgb[^)]*\/\s*0\.97\s*\)/.test(m.panelBg || '') || /rgba\([^)]*,\s*0?\.97\s*\)/.test(m.panelBg || ''), m.panelBg);
        check('no-blur：背景细节透出被压到 0.5%–6%（不再出现可读重影）', sv.ratio >= 0.005 && sv.ratio < 0.06, `ratio=${sv.ratio.toFixed(3)}`);
        report.cases.push({ case: 'no-blur-fallback', fallback, measure: m, stripe: sv });

        /* 4. 加载顺序竞争：CSS 未就绪 → unknown 不落回退；CSS 就绪后自愈 */
        const raceHtml = `<!doctype html><html><head><meta charset="utf-8">${BACKDROP_CSS}<script>${safeApiJs}<\/script></head><body></body></html>`;
        await h.navigate(raceHtml, 'race');
        const raceBefore = await h.eval("(() => { const supported = NVUI.syncGlassFallback(); return { supported, rootClass: document.documentElement.className }; })()");
        await h.eval(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(tokensCss + '\n' + componentsCss)}; document.head.appendChild(s); })()`);
        await h.settle();
        const raceAfter = await h.eval("(() => { const supported = NVUI.syncGlassFallback({ force: true }); return { supported, rootClass: document.documentElement.className }; })()");
        check('时序竞争：CSS 未就绪时不落回退类', !/nvui-glass-fallback/.test(raceBefore.rootClass) && !/nvui-solid/.test(raceBefore.rootClass), JSON.stringify(raceBefore));
        check('时序竞争：CSS 就绪后自愈为 supported 且无回退类', raceAfter.supported === true && !/nvui-glass-fallback/.test(raceAfter.rootClass), JSON.stringify(raceAfter));
        report.cases.push({ case: 'load-order-race', before: raceBefore, after: raceAfter });

        /* 5. prefers-reduced-transparency 降级 */
        await h.navigate(htmlWithKit(), 'reduced-transparency');
        await h.media([{ name: 'prefers-reduced-transparency', value: 'reduce' }]);
        m = await h.eval(MEASURE);
        img = await h.shot('panel-reduced-transparency');
        sv = stripeVisibility(img, m.rect);
        check('prefers-reduced-transparency：回退不透明（透出 ≈ 0）', sv.ratio < 0.05, `ratio=${sv.ratio.toFixed(3)}`);
        report.cases.push({ case: 'reduced-transparency', measure: m, stripe: sv });
        await h.media([]);

        /* 6. .nvui-solid 与自动回退同时存在时实心优先 */
        await h.eval("document.documentElement.classList.add('nvui-glass-fallback','nvui-solid')");
        await h.settle();
        m = await h.eval(MEASURE);
        check('.nvui-solid 与 .nvui-glass-fallback 并存时实心优先', m.panelBg === 'rgb(22, 26, 36)', m.panelBg);
        report.cases.push({ case: 'solid-overrides-fallback', measure: m });
    } finally {
        fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ...report, checks }, null, 2));
        await h.stop();
        try { fs.rmSync(PROFILE, { recursive: true, force: true }); } catch (e) { /* ignore */ }
    }
    const failed = checks.filter((c) => !c.ok);
    console.log(`\n玻璃透明感测试：通过 ${checks.length - failed.length}，失败 ${failed.length}`);
    console.log('报告：' + path.join(OUT, 'report.json'));
    process.exit(failed.length ? 1 : 0);
})().catch((e) => {
    console.error(e);
    process.exit(1);
});
