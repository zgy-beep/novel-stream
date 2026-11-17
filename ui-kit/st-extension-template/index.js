/**
 * 我的插件 · index.js（SillyTavern 扩展入口）
 * ------------------------------------------------------------------
 * 本文件演示 SillyTavern 扩展的规范骨架 + NVUI Kit 面板的装配方式。
 *
 * ST 扩展模板要点：
 *   1. 入口是 ES Module，manifest.json 的 "js" 指向本文件；
 *   2. 设置挂在 extension_settings[EXTENSION_NAME] 下，键名用插件自己的短名；
 *   3. 用 saveSettingsDebounced 落盘，不要直接写 localStorage；
 *   4. 菜单入口优先挂到酒馆顶部菜单（extensionsMenu），别自己造导航；
 *   5. 导出 manifest.json "hooks" 里声明的函数（如 init）供 ST 调用。
 *
 * 面板红线（来自 ui-kit，务必遵守）：
 *   - 浮层必须进 top-layer 载体 <dialog class="nvui-tl"> + 非模态 dialog.show()；
 *   - 禁止 showModal()（会给宿主文档加 inert，破坏酒馆 transform 下的 fixed 定位）；
 *   - 禁止裸 position: fixed 挂 body（宿主 html 有 transform，手机端会被顶出屏幕）。
 */

import { getContext, extension_settings as extensionSettings } from '../../../extensions.js';
import { eventSource, event_types, saveSettingsDebounced } from '../../../../script.js';

// NVUI Kit 面板运行时（UMD：import 执行后挂 globalThis.NVUI）
import './ui-kit/nvui-api.js';

const ctx = (typeof getContext === 'function')
    ? getContext()
    : (window.SillyTavern?.getContext?.() ?? {});

const EXTENSION_NAME = 'myPlugin';

/** 扩展设置：结构版本用 stamped，破坏性变更才递增 */
const DEFAULT_SETTINGS = {
    version: '1.0.0',
    enabled: true,
    threshold: 80,
};

/**
 * 取设置对象。
 * 注意：extension_settings 是 extensions.js 的模块级导出对象，
 * 必须**每次实时读取**（不要缓存 getContext() 的快照引用），
 * 否则扩展初始化早于宿主填充设置时会写到空对象上。
 * 宿主从不把 extension_settings 挂到 window 上，所以不要写 window.extension_settings 兜底。
 */
function getSettings() {
    const all = extensionSettings || {};
    if (!all[EXTENSION_NAME]) all[EXTENSION_NAME] = { ...DEFAULT_SETTINGS };
    return all[EXTENSION_NAME];
}

function saveSettings() {
    if (typeof saveSettingsDebounced === 'function') saveSettingsDebounced();
}

/* ==========================================================================
 * 面板
 * ========================================================================== */

let panel = null;

/**
 * 惰性创建面板（只在真正需要时建 DOM，避免扩展加载即占用 DOM）
 */
function getPanel() {
    if (panel) return panel;
    if (typeof NVUI === 'undefined' || typeof NVUI.createPanel !== 'function') {
        console.error('[myPlugin] NVUI 运行时未加载：请确认 ui-kit/nvui-api.js 与本文件同目录');
        return null;
    }

    const settings = getSettings();

    panel = NVUI.createPanel({
        id: 'my_plugin_panel',
        title: '我的插件设置',
        version: 'v1.0.0',
        tabs: [
            { key: 'basic', label: '基本设置', icon: 'fa-solid fa-sliders' },
            { key: 'advanced', label: '高级', icon: 'fa-solid fa-wrench' },
        ],
        /* 焦点归还兜底：
           酒馆的 wand 扩展菜单在点击菜单项后会自动收起，触发按钮随即不可聚焦，
           直接 focus() 会静默失败、焦点掉到 body。这里指定一个常驻元素兜底。 */
        focusFallback: '#extensionsMenuButton',
        footer: [
            {
                label: '保存',
                variant: 'primary',
                onClick: () => {
                    saveSettings();
                    NVUI.showToast({ message: '设置已保存', type: 'success' });
                },
            },
            { label: '取消', variant: 'ghost', close: true },
        ],
    });

    /* 基本分区 */
    panel.addSwitch('basic', {
        label: '启用插件功能',
        value: !!settings.enabled,
        feature: true,
        onChange: (v) => { settings.enabled = v; saveSettings(); },
    });
    panel.addInput('basic', {
        label: '上限 (MB)',
        type: 'number',
        value: settings.threshold,
        onChange: (v) => { settings.threshold = Number(v) || 0; saveSettings(); },
    });

    /* 高级分区：折叠分组（收起态务必给 summary，它是用户唯一的线索） */
    panel.addAccordion('advanced', {
        title: '高级选项',
        summary: '默认值',
        content: [
            panel.addInput('advanced', { label: '重试次数', type: 'number', value: 3 }),
        ],
    });

    return panel;
}

/** 打开面板（菜单入口调用它） */
export function openSettings() {
    getPanel()?.open();
}

/**
 * 调试钩子：让自动化测试能读到真实设置对象。
 * extension_settings 是模块导出，宿主不会挂到 window 上，
 * 所以外部无法直接观察，只能由扩展自己暴露只读视图。
 */
export function debugState() {
    return { settings: { ...getSettings() }, panelExists: !!panel };
}

/* ==========================================================================
 * 菜单入口
 * ========================================================================== */

function addMenuButton() {
    const menu = document.getElementById('extensionsMenu');
    if (!menu || document.getElementById('my_plugin_menu_btn')) return;

    const button = document.createElement('div');
    button.id = 'my_plugin_menu_btn';
    button.className = 'list-group-item flex-container flexGap5 interactable';
    button.tabIndex = 0;
    button.title = '打开我的插件设置';

    const icon = document.createElement('i');
    icon.className = 'fa-solid fa-sliders';
    const label = document.createElement('span');
    label.textContent = '我的插件';
    button.appendChild(icon);
    button.appendChild(label);

    button.addEventListener('click', openSettings);
    menu.appendChild(button);
}

/* ==========================================================================
 * 生命周期
 * ========================================================================== */

/** manifest.json 的 hooks.activate 指向这里 */
export function init() {
    const settings = getSettings();
    if (!settings.version) settings.version = DEFAULT_SETTINGS.version;

    /* 暴露只读调试视图（自动化测试用；生产环境无害）
     *
     * NEW-22（安全·低）：原先把 getSettings 一律挂到 window，
     * 同宿主内任意脚本都能读到插件设置（虽是副本，但仍是可读信息）。
     * 现在：open 保持全量暴露（业务入口，宿主需要），
     * getSettings 只在本地开发环境（localhost / 127.0.0.1 / ::1 / file://）暴露。
     * 自动化测试跑在 http://127.0.0.1:8000，hostname 为 127.0.0.1 → 门禁放行。 */
    const isLocalDev = (() => {
        try {
            const hn = window.location.hostname;
            return hn === 'localhost' || hn === '127.0.0.1' || hn === '::1' || hn === '[::1]'
                || window.location.protocol === 'file:';
        } catch (err) {
            return false;
        }
    })();
    window.__MY_PLUGIN__ = { open: openSettings };
    if (isLocalDev) {
        window.__MY_PLUGIN__.getSettings = () => (typeof structuredClone === 'function' ? structuredClone(getSettings()) : JSON.parse(JSON.stringify(getSettings())));
    }

    addMenuButton();

    /* 首次安装给个提示（不要在每次加载时都弹） */
    if (!settings.notified) {
        settings.notified = true;
        saveSettings();
        NVUI.showToast({ message: '我的插件已安装，点击顶部菜单图标进入设置', type: 'info' });
    }
}

export { EXTENSION_NAME };
