/**
 * NEW-22 实机取证：验证 window.__MY_PLUGIN__.getSettings 的本地开发门禁
 * 1) 本地（127.0.0.1）→ getSettings 必须暴露
 * 2) 非本地（把 location.hostname 伪装为 example.com）→ getSettings 必须不暴露，但 open 仍全量暴露
 * 用法: node test/st-template-new22-check.js <输出目录>
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const { HOST_URL, CHROME } = require('./st-review-harness');

const outDir = process.argv[2];
if (!outDir) { console.error('缺少输出目录参数'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: CHROME,
    // 把 example.com 解析到本地 8000 端口，用于构造「非 localhost 宿主」场景
    args: ['--host-resolver-rules=MAP example.com 127.0.0.1:8000']
  });
  const results = [];

  async function probe(url, hostname, label) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript((hn) => {
      try {
        Object.defineProperty(window.location, 'hostname', { get: () => hn, configurable: true });
      } catch (err) { /* 无法覆盖时走默认 hostname */ }
    }, hostname);
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const data = await page.evaluate(() => {
      const api = window.__MY_PLUGIN__;
      let value = null;
      if (api && typeof api.getSettings === 'function') {
        try { value = JSON.stringify(api.getSettings()); } catch (e) { value = 'ERR:' + e.message; }
      }
      return {
        hasApi: !!api,
        hasOpen: !!(api && typeof api.open === 'function'),
        hasGetSettings: !!(api && typeof api.getSettings === 'function'),
        getSettingsValue: value,
        keys: api ? Object.keys(api) : [],
        hostname: window.location.hostname
      };
    });
    results.push({ label, data, errors });
    await ctx.close();
    return data;
  }

  const local = await probe(HOST_URL, '127.0.0.1', 'local');
  const remote = await probe('http://example.com:8000/', 'example.com', 'remote');

  const checks = [
    { name: '本地暴露 getSettings', pass: local.hasGetSettings === true },
    { name: '本地暴露 open', pass: local.hasOpen === true },
    { name: '本地 getSettings 可调用且返回设置对象', pass: typeof local.getSettingsValue === 'string' && local.getSettingsValue.indexOf('enabled') >= 0 },
    { name: '非本地不暴露 getSettings', pass: remote.hasGetSettings === false },
    { name: '非本地仍暴露 open', pass: remote.hasOpen === true },
    { name: '本地无 pageerror', pass: results[0].errors.length === 0 },
    { name: '非本地无 pageerror', pass: results[1].errors.length === 0 }
  ];

  for (const c of checks) {
    console.log('[' + (c.pass ? 'PASS' : 'FAIL') + '] ' + c.name + '  ->  ' + JSON.stringify(c.pass ? '' : ''));
  }
  console.log('  本地快照: ' + JSON.stringify(local));
  console.log('  非本地快照: ' + JSON.stringify(remote));
  fs.writeFileSync(path.join(outDir, 'new22-result.json'), JSON.stringify({ results, checks }, null, 2));
  const failed = checks.filter((c) => !c.pass).length;
  console.log('\n总计 ' + checks.length + ' | 通过 ' + (checks.length - failed) + ' | 失败 ' + failed);
  await browser.close();
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
