'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const browserDeps = require('../scripts/resolve-browser');
const { chromium } = browserDeps.requirePlaywright();

async function main() {
    const browser = await chromium.launch({ executablePath: browserDeps.requireChrome() });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
        const pageErrors = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        if (process.argv.includes('--host')) {
            await page.goto(process.env.NVUI_HOST_URL || 'http://127.0.0.1:8000/', { waitUntil: 'domcontentloaded' });
            await page.waitForTimeout(9000);
        } else {
            await page.setContent('<!doctype html><html><body></body></html>');
        }
        const root = path.join(__dirname, '..');
        for (const file of ['tokens.css', 'components.css']) await page.addStyleTag({ path: path.join(root, file) });
        await page.addScriptTag({ path: path.join(root, 'nvui-api.js') });
        await page.evaluate(() => {
            for (const id of ['opener', 'other']) {
                const button = document.createElement('button');
                button.id = id;
                button.textContent = id;
                button.style.cssText = 'position:fixed;top:12px;left:12px;z-index:2147483646';
                document.body.prepend(button);
            }
            window.fixture = (opts) => NVUI.createPanel({
                tabs: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
                width: 720, ...opts,
            });
            window.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            window.closePanel = async (panel) => {
                panel.close();
                const deadline = performance.now() + 1000;
                while (panel.dialog.open && performance.now() < deadline) await delay(20);
                if (panel.dialog.open) throw new Error('Panel did not close');
            };
        });

        const imported = await page.evaluate(async () => {
            const writes = [];
            const storage = { get: () => null, set: (key, value) => writes.push(value) };
            const panel = fixture({ id: 'audit-import', persist: { storage } });
            const accordion = panel.addAccordion('b', { id: 'advanced', title: 'Advanced' });
            const snapshot = () => [panel.activeTab, panel.panel.offsetWidth, panel.panel.offsetHeight,
                accordion.classList.contains('is-open')];
            panel.open();
            const initial = snapshot();
            panel.setLayoutState({
                version: 2, tab: 'b', size: { w: 912, h: 480, mode: 'normal' }, accordion: { advanced: true },
            });
            await delay(300);
            const whileOpen = snapshot();
            const exportedTab = panel.getLayoutState().tab;
            await closePanel(panel);
            panel.open();
            const reopened = snapshot();
            const persisted = writes.map(({ tab, size }) => [tab, size.w, size.h]);
            panel.setLayoutState({ tab: 'a', size: null, accordion: null }, { silent: true });
            await closePanel(panel);
            panel.open();
            const silent = snapshot();
            await delay(300);
            await closePanel(panel);
            panel.destroy();
            return { initial, whileOpen, exportedTab, reopened, persisted, silent, writeCount: writes.length };
        });
        assert.deepEqual(imported.whileOpen, imported.initial);
        assert.equal(imported.exportedTab, 'b');
        assert.deepEqual(imported.reopened, ['b', 912, 480, true]);
        assert.deepEqual(imported.persisted, [['b', 912, 480]]);
        assert.deepEqual(imported.silent, imported.initial);
        assert.equal(imported.writeCount, 1);
        console.log('PASS GH-23: deferred import, immediate export and silent reopen');

        const races = await page.evaluate(async () => {
            let resolveRead;
            let saved = { version: 2, tab: 'b', size: { w: 910, h: 450, mode: 'normal' } };
            const slowRead = {
                get() {
                    const old = saved;
                    return new Promise((resolve) => { resolveRead = () => resolve(old); });
                },
                set: (key, val) => { saved = val; },
                delete: () => { saved = null; },
            };
            const reading = fixture({ id: 'audit-read', persist: { storage: slowRead } });
            reading.open();
            reading.clearLayoutState();
            resolveRead();
            await delay(300);
            const afterRead = [reading.activeTab, reading.panel.offsetWidth, saved];
            reading.destroy();

            const writes = [];
            const slowWrite = {
                get: () => saved,
                set: (key, val) => new Promise((resolve) => {
                    writes.push(() => { saved = val; resolve(); });
                }),
                delete: () => { saved = null; },
            };
            const writing = fixture({ id: 'audit-write', persist: { size: false, storage: slowWrite } });
            writing.setTab('b');
            writing.flushPersistSave();
            writing.setTab('a');
            writing.flushPersistSave();
            const concurrent = writes.length;
            writes[0]();
            await delay(0);
            writes[1]();
            await delay(0);
            const lastTab = saved.tab;
            writing.setTab('b');
            writing.flushPersistSave();
            writing.clearLayoutState();
            writes[2]();
            await delay(0);
            const deleted = saved === null;
            writing.destroy();
            return { afterRead, concurrent, lastTab, deleted };
        });
        assert.deepEqual(races, { afterRead: ['a', 720, null], concurrent: 1, lastTab: 'a', deleted: true });
        console.log('PASS GH-24: stale read, ordered writes and clear after an in-flight write');

        const identity = await page.evaluate(() => {
            const records = new Map();
            const storage = { get: (key) => records.get(key), set: (key, value) => records.set(key, value),
                delete: (key) => records.delete(key) };
            const create = (id) => fixture({ id, persist: { size: false, storage } });
            const plain = create('plugin_one');
            plain.setTab('b');
            plain.flushPersistSave();
            const encoded = create('plugin one');
            const initial = encoded.activeTab;
            encoded.setTab('a');
            encoded.flushPersistSave();
            const both = Array.from(records.values(), (value) => value.tab);
            encoded.destroy();
            plain.destroy();
            const legacy = { version: 2, tab: 'b' };
            records.set('nvui_state_old_plugin', legacy);
            const migrated = create('old plugin');
            const restored = migrated.activeTab;
            migrated.clearLayoutState();
            migrated.destroy();
            const rebuilt = create('old plugin');
            const cleared = rebuilt.activeTab;
            rebuilt.destroy();
            return { initial, both, restored, cleared, legacyPreserved: records.get('nvui_state_old_plugin') === legacy };
        });
        assert.deepEqual(identity, { initial: 'a', both: ['b', 'a'], restored: 'b', cleared: 'a', legacyPreserved: true });
        console.log('PASS GH-25: stable isolated keys, old record fallback and clear');

        const resized = await page.evaluate(async () => {
            let value = { version: 2, size: { w: 810, h: 450, mode: 'normal' } };
            const storage = { get: () => value, set: (key, saved) => { value = saved; } };
            const create = () => fixture({ id: 'audit-resize', resizable: true, persist: { storage } });
            const panel = create();
            panel.open();
            panel.setMaximized(true);
            panel.panel.querySelector('.nvui-resize').dispatchEvent(
                new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true }));
            await delay(300);
            const height = value.size.h;
            await closePanel(panel);
            panel.destroy();
            await delay(60);
            const rebuilt = create();
            rebuilt.open();
            const result = [rebuilt.panel.offsetWidth, rebuilt.panel.style.getPropertyValue('--nvui-panel-h'), height];
            rebuilt.destroy();
            return result;
        });
        assert.deepEqual(resized, [720, '', null]);
        console.log('PASS GH-26: Home keeps height under CSS control across a reload');

        const navigation = await page.evaluate(() => {
            const panel = fixture({ id: '-1' });
            panel.open();
            const tab = panel.tabs.querySelector('[role=tab]');
            tab.focus();
            tab.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
            const after = [panel.activeTab, document.activeElement.id];
            panel.destroy();
            return after;
        });
        assert.deepEqual(navigation, ['b', '-1-tab-b']);
        assert.deepEqual(pageErrors, []);
        console.log('PASS GH-27: directional navigation accepts ID -1');

        const focus = await page.evaluate(async () => {
            const panel = fixture({ id: 'audit-focus' });
            document.getElementById('opener').focus();
            panel.open();
            await delay(80);
            const inPanel = panel.panel.contains(document.activeElement);
            panel.close();
            panel.open();
            await closePanel(panel);
            const restored = document.activeElement.id;
            panel.destroy();
            return [inPanel, restored];
        });
        assert.deepEqual(focus, [true, 'opener']);
        console.log('PASS GH-28: animated reopen preserves the original focus target');

        const destroyed = await page.evaluate(async () => {
            let calls = 0;
            const storage = { get: () => null, set: () => panel.destroy() };
            const panel = fixture({ id: 'audit-destroy', persist: { storage },
                destroy() { calls += 1; } });
            panel.open();
            panel.destroy();
            panel.destroy();
            await delay(80);
            const count = () => NVUI.diagnostics().listenerCounts.resize || 0;
            const baseline = count();
            panel.open();
            return [calls, count() - baseline, panel.dialog.isConnected];
        });
        assert.deepEqual(destroyed, [1, 0, false]);
        console.log('PASS GH-29: destroy is idempotent and open stays inert');
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
