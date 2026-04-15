/* ================================================================
   Tab Out — Dashboard App (Pure Extension Edition)

   This file is the brain of the dashboard. Now that the dashboard
   IS the extension page (not inside an iframe), it can call
   chrome.tabs and chrome.storage directly — no postMessage bridge needed.

   What this file does:
   1. Reads open browser tabs directly via chrome.tabs.query()
   2. Groups tabs by domain with a landing pages category
   3. Renders domain cards, banners, and stats
   4. Handles all user actions (close tabs, save for later, focus tab)
   5. Stores "Saved for Later" tabs in chrome.storage.local (no server)
   ================================================================ */

'use strict';


/* ----------------------------------------------------------------
   CHROME TABS — Direct API Access

   Since this page IS the extension's new tab page, it has full
   access to chrome.tabs and chrome.storage. No middleman needed.
   ---------------------------------------------------------------- */

// All open tabs — populated by fetchOpenTabs()
let openTabs = [];
let quickLinks = [];
let currentLanguage = 'zh-CN';
let customBackgroundImage = '';

const LANGUAGE_STORAGE_KEY = 'uiLanguage';
const QUICK_LINKS_STORAGE_KEY = 'quickLinks';
const BACKGROUND_IMAGE_STORAGE_KEY = 'customBackgroundImage';
const MAX_BACKGROUND_EDGE = 2200;
const MAX_BACKGROUND_STORAGE_LENGTH = 3_500_000;

const MESSAGES = {
  'zh-CN': {
    languageName: '中文',
    languageShort: '中',
    languageSwitcherLabel: '切换语言',
    greetingMorning: '早上好',
    greetingAfternoon: '下午好',
    greetingEvening: '晚上好',
    tabOutDupeBanner: count => `你打开了 <strong>${count}</strong> 个 Tab Out 标签页。只保留当前这个吗？`,
    closeExtras: '关闭多余标签',
    openTabs: '打开中的标签',
    quickLinksTitle: '常用入口',
    quickLinksSubtitle: '把每天都会打开的网站放在这里，从新标签页一步直达。',
    quickLinksAddButton: '添加入口',
    quickLinksEmptyTitle: '先固定几个常用网站吧',
    quickLinksEmptySubtitle: '把飞书、GitHub、邮箱或项目后台放进来，打开新标签页就能直接进入。',
    quickLinkAddCardTitle: '新增快捷入口',
    quickLinkAddCardSubtitle: '自定义名称和网址，做成你自己的起手板。',
    quickLinkEdit: '编辑入口',
    quickLinkDelete: '删除入口',
    quickLinkModalAddTitle: '新增常用入口',
    quickLinkModalEditTitle: '编辑常用入口',
    quickLinkModalClose: '关闭弹窗',
    quickLinkNameLabel: '名称',
    quickLinkNamePlaceholder: '例如 GitHub / 飞书 / 邮箱',
    quickLinkUrlLabel: '网址',
    quickLinkUrlPlaceholder: '例如 https://github.com',
    backgroundImageUpload: '设置背景',
    backgroundImageChange: '更换背景',
    backgroundImageClear: '清除背景',
    quickLinkCancel: '取消',
    quickLinkSave: '保存入口',
    quickLinkUpdate: '保存修改',
    quickLinkDeleteConfirm: title => `要删除“${title}”这个快捷入口吗？`,
    toastQuickLinkInvalidName: '请输入入口名称',
    toastQuickLinkAdded: '快捷入口已添加',
    toastQuickLinkUpdated: '快捷入口已更新',
    toastQuickLinkDeleted: '快捷入口已删除',
    toastQuickLinkInvalidUrl: '请输入有效的网址',
    toastBackgroundUpdated: '背景已更新',
    toastBackgroundCleared: '背景已清除',
    toastBackgroundFailed: '背景设置失败，请换一张图片试试',
    savedForLater: '稍后保存',
    nothingSaved: '还没有保存内容。活在当下。',
    archive: '归档',
    archiveSearchPlaceholder: '搜索已归档的标签...',
    statOpenTabs: '打开标签',
    footerCreditEyebrow: '原作者',
    footerCreditMain: 'Tab Out 由 Zara Zhang 创作并开源',
    footerProjectLink: '原项目',
    footerAuthorLink: 'GitHub',
    inboxZeroTitle: '标签清零了。',
    inboxZeroSubtitle: '现在轻松多了。',
    domainsCount: count => `${count} 个域名`,
    itemsCount: count => `${count} 项`,
    tabsOpenBadge: count => `${count} 个标签`,
    duplicateBadge: count => `${count} 个重复`,
    closeAllTabsAction: count => `关闭全部 ${count} 个标签`,
    closeDuplicatesAction: count => `关闭 ${count} 个重复项`,
    homepages: '主页',
    tabsLabel: '标签',
    moreTabs: count => `还有 ${count} 个`,
    justNow: '刚刚',
    minutesAgo: count => `${count} 分钟前`,
    hoursAgo: count => `${count} 小时前`,
    yesterday: '昨天',
    daysAgo: count => `${count} 天前`,
    saveForLaterTitle: '稍后保存',
    closeThisTabTitle: '关闭此标签',
    dismissTitle: '移除',
    noResults: '没有结果',
    toastClosedExtraTabOutTabs: '已关闭多余的 Tab Out 标签页',
    toastTabClosed: '标签已关闭',
    toastSaveFailed: '保存失败',
    toastSavedForLater: '已保存到稍后处理',
    toastClosedGroupTabs: (count, groupLabel) => `已从 ${groupLabel} 关闭 ${count} 个标签`,
    toastClosedDuplicates: '已关闭重复标签，并保留一份',
    toastClosedAllTabs: '所有标签已关闭，重新开始吧。',
    postByUser: username => `@${username} 的帖子`,
    githubIssue: (owner, repo, number) => `${owner}/${repo} Issue #${number}`,
    githubPr: (owner, repo, number) => `${owner}/${repo} PR #${number}`,
    githubPath: (owner, repo, path) => `${owner}/${repo} - ${path}`,
    youtubeVideo: 'YouTube 视频',
    redditPost: subreddit => `r/${subreddit} 帖子`,
    substackBy: name => `${capitalize(name)} 的 Substack`,
    githubPages: name => `${capitalize(name)}（GitHub Pages）`,
    localFiles: '本地文件',
  },
  'en-US': {
    languageName: 'English',
    languageShort: 'EN',
    languageSwitcherLabel: 'Switch language',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    tabOutDupeBanner: count => `You have <strong>${count}</strong> Tab Out tabs open. Keep just this one?`,
    closeExtras: 'Close extras',
    openTabs: 'Open tabs',
    quickLinksTitle: 'Quick links',
    quickLinksSubtitle: 'Pin the sites you open every day so your new tab becomes a real launchpad.',
    quickLinksAddButton: 'Add link',
    quickLinksEmptyTitle: 'Start with a few favorites',
    quickLinksEmptySubtitle: 'Pin GitHub, email, docs, or your admin tools so they are always one click away.',
    quickLinkAddCardTitle: 'Add a shortcut',
    quickLinkAddCardSubtitle: 'Name it, paste the URL, and make this page your own.',
    quickLinkEdit: 'Edit link',
    quickLinkDelete: 'Delete link',
    quickLinkModalAddTitle: 'Add quick link',
    quickLinkModalEditTitle: 'Edit quick link',
    quickLinkModalClose: 'Close dialog',
    quickLinkNameLabel: 'Name',
    quickLinkNamePlaceholder: 'For example GitHub / Slack / Mail',
    quickLinkUrlLabel: 'URL',
    quickLinkUrlPlaceholder: 'For example https://github.com',
    backgroundImageUpload: 'Set background',
    backgroundImageChange: 'Change background',
    backgroundImageClear: 'Clear background',
    quickLinkCancel: 'Cancel',
    quickLinkSave: 'Save link',
    quickLinkUpdate: 'Save changes',
    quickLinkDeleteConfirm: title => `Delete the quick link "${title}"?`,
    toastQuickLinkInvalidName: 'Enter a name for the link',
    toastQuickLinkAdded: 'Quick link added',
    toastQuickLinkUpdated: 'Quick link updated',
    toastQuickLinkDeleted: 'Quick link deleted',
    toastQuickLinkInvalidUrl: 'Enter a valid URL',
    toastBackgroundUpdated: 'Background updated',
    toastBackgroundCleared: 'Background cleared',
    toastBackgroundFailed: 'Failed to update background',
    savedForLater: 'Saved for later',
    nothingSaved: 'Nothing saved. Living in the moment.',
    archive: 'Archive',
    archiveSearchPlaceholder: 'Search archived tabs...',
    statOpenTabs: 'Open tabs',
    footerCreditEyebrow: 'Original Creator',
    footerCreditMain: 'Tab Out was created and open-sourced by Zara Zhang',
    footerProjectLink: 'Original project',
    footerAuthorLink: 'GitHub',
    inboxZeroTitle: 'Inbox zero, but for tabs.',
    inboxZeroSubtitle: "You're free.",
    domainsCount: count => `${count} domain${count !== 1 ? 's' : ''}`,
    itemsCount: count => `${count} item${count !== 1 ? 's' : ''}`,
    tabsOpenBadge: count => `${count} tab${count !== 1 ? 's' : ''} open`,
    duplicateBadge: count => `${count} duplicate${count !== 1 ? 's' : ''}`,
    closeAllTabsAction: count => `Close all ${count} tab${count !== 1 ? 's' : ''}`,
    closeDuplicatesAction: count => `Close ${count} duplicate${count !== 1 ? 's' : ''}`,
    homepages: 'Homepages',
    tabsLabel: 'tabs',
    moreTabs: count => `+${count} more`,
    justNow: 'just now',
    minutesAgo: count => `${count} min ago`,
    hoursAgo: count => `${count} hr${count !== 1 ? 's' : ''} ago`,
    yesterday: 'yesterday',
    daysAgo: count => `${count} days ago`,
    saveForLaterTitle: 'Save for later',
    closeThisTabTitle: 'Close this tab',
    dismissTitle: 'Dismiss',
    noResults: 'No results',
    toastClosedExtraTabOutTabs: 'Closed extra Tab Out tabs',
    toastTabClosed: 'Tab closed',
    toastSaveFailed: 'Failed to save tab',
    toastSavedForLater: 'Saved for later',
    toastClosedGroupTabs: (count, groupLabel) => `Closed ${count} tab${count !== 1 ? 's' : ''} from ${groupLabel}`,
    toastClosedDuplicates: 'Closed duplicates, kept one copy each',
    toastClosedAllTabs: 'All tabs closed. Fresh start.',
    postByUser: username => `Post by @${username}`,
    githubIssue: (owner, repo, number) => `${owner}/${repo} Issue #${number}`,
    githubPr: (owner, repo, number) => `${owner}/${repo} PR #${number}`,
    githubPath: (owner, repo, path) => `${owner}/${repo} - ${path}`,
    youtubeVideo: 'YouTube Video',
    redditPost: subreddit => `r/${subreddit} post`,
    substackBy: name => `${capitalize(name)}'s Substack`,
    githubPages: name => `${capitalize(name)} (GitHub Pages)`,
    localFiles: 'Local Files',
  },
};

function getMessages() {
  return MESSAGES[currentLanguage] || MESSAGES['en-US'];
}

function t(key, ...args) {
  const localized = getMessages()[key];
  if (typeof localized === 'function') return localized(...args);
  if (localized !== undefined) return localized;

  const fallback = MESSAGES['en-US'][key];
  return typeof fallback === 'function' ? fallback(...args) : fallback || '';
}

async function loadLanguagePreference() {
  try {
    const { [LANGUAGE_STORAGE_KEY]: storedLanguage } = await chrome.storage.local.get(LANGUAGE_STORAGE_KEY);
    if (storedLanguage && MESSAGES[storedLanguage]) currentLanguage = storedLanguage;
  } catch {
    currentLanguage = 'zh-CN';
  }
}

async function setLanguagePreference(language) {
  if (!MESSAGES[language] || language === currentLanguage) return;
  currentLanguage = language;
  try {
    await chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language });
  } catch {
    // Ignore storage failures and keep the in-memory language.
  }
}

function syncLanguageSwitcher() {
  const switcher = document.getElementById('languageSwitcher');
  if (switcher) switcher.setAttribute('aria-label', t('languageSwitcherLabel'));

  document.querySelectorAll('.language-option').forEach(button => {
    const { language } = button.dataset;
    const isActive = language === currentLanguage;
    button.textContent = MESSAGES[language]?.languageShort || language;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    button.title = MESSAGES[language]?.languageName || language;
  });
}

function syncBackgroundControls() {
  const triggerBtn = document.getElementById('backgroundImageTriggerBtn');
  const clearBtn = document.getElementById('backgroundImageClearBtn');
  const dock = document.querySelector('.header-control-dock');
  const triggerLabel = customBackgroundImage ? t('backgroundImageChange') : t('backgroundImageUpload');

  if (triggerBtn) {
    triggerBtn.title = triggerLabel;
    triggerBtn.setAttribute('aria-label', triggerLabel);
    triggerBtn.classList.toggle('is-active', !!customBackgroundImage);
  }

  if (clearBtn) {
    clearBtn.title = t('backgroundImageClear');
    clearBtn.setAttribute('aria-label', t('backgroundImageClear'));
    clearBtn.hidden = !customBackgroundImage;
  }

  if (dock) {
    dock.classList.toggle('has-image', !!customBackgroundImage);
  }
}

function applyStaticText() {
  document.documentElement.lang = currentLanguage;

  const quickLinksTitle = document.getElementById('quickLinksTitle');
  const quickLinksSubtitle = document.getElementById('quickLinksSubtitle');
  const quickLinksAddBtn = document.getElementById('quickLinksAddBtn');
  const deferredTitle = document.getElementById('deferredSectionTitle');
  const deferredEmpty = document.getElementById('deferredEmpty');
  const archiveLabel = document.getElementById('archiveToggleLabel');
  const archiveSearch = document.getElementById('archiveSearch');
  const statTabsLabel = document.getElementById('statTabsLabel');
  const footerCreditEyebrow = document.getElementById('footerCreditEyebrow');
  const footerCreditMain = document.getElementById('footerCreditMain');
  const footerProjectLink = document.getElementById('footerProjectLink');
  const footerAuthorLink = document.getElementById('footerAuthorLink');
  const closeTabOutDupesBtn = document.getElementById('closeTabOutDupesBtn');
  const quickLinkNameLabel = document.getElementById('quickLinkNameLabel');
  const quickLinkNameInput = document.getElementById('quickLinkNameInput');
  const quickLinkUrlLabel = document.getElementById('quickLinkUrlLabel');
  const quickLinkUrlInput = document.getElementById('quickLinkUrlInput');
  const quickLinkCancelBtn = document.getElementById('quickLinkCancelBtn');
  const quickLinkModalCloseBtn = document.getElementById('quickLinkModalCloseBtn');

  if (quickLinksTitle) quickLinksTitle.textContent = t('quickLinksTitle');
  if (quickLinksSubtitle) quickLinksSubtitle.textContent = t('quickLinksSubtitle');
  if (quickLinksAddBtn) quickLinksAddBtn.textContent = t('quickLinksAddButton');
  if (deferredTitle) deferredTitle.textContent = t('savedForLater');
  if (deferredEmpty) deferredEmpty.textContent = t('nothingSaved');
  if (archiveLabel) archiveLabel.textContent = t('archive');
  if (archiveSearch) archiveSearch.placeholder = t('archiveSearchPlaceholder');
  if (statTabsLabel) statTabsLabel.textContent = t('statOpenTabs');
  if (footerCreditEyebrow) footerCreditEyebrow.textContent = t('footerCreditEyebrow');
  if (footerCreditMain) footerCreditMain.textContent = t('footerCreditMain');
  if (footerProjectLink) footerProjectLink.textContent = t('footerProjectLink');
  if (footerAuthorLink) footerAuthorLink.textContent = t('footerAuthorLink');
  if (closeTabOutDupesBtn) closeTabOutDupesBtn.textContent = t('closeExtras');
  if (quickLinkNameLabel) quickLinkNameLabel.textContent = t('quickLinkNameLabel');
  if (quickLinkNameInput) quickLinkNameInput.placeholder = t('quickLinkNamePlaceholder');
  if (quickLinkUrlLabel) quickLinkUrlLabel.textContent = t('quickLinkUrlLabel');
  if (quickLinkUrlInput) quickLinkUrlInput.placeholder = t('quickLinkUrlPlaceholder');
  if (quickLinkCancelBtn) quickLinkCancelBtn.textContent = t('quickLinkCancel');
  if (quickLinkModalCloseBtn) quickLinkModalCloseBtn.textContent = '×';
  if (quickLinkModalCloseBtn) quickLinkModalCloseBtn.title = t('quickLinkModalClose');

  syncLanguageSwitcher();
  syncBackgroundControls();
  syncQuickLinkModalText();
}

function updateTabOutDupeBannerText(count) {
  const textEl = document.getElementById('tabOutDupeText');
  if (textEl) textEl.innerHTML = t('tabOutDupeBanner', count);
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function summarizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url || '';
  }
}

function getQuickLinkMonogram(title, url) {
  const source = (title || summarizeUrl(url)).replace(/^https?:\/\//, '').trim();
  const parts = source.split(/[\s./_-]+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || '+';
}

function normalizeQuickLinkUrl(rawUrl) {
  let normalized = String(rawUrl || '').trim();
  if (!normalized) throw new Error('invalid-url');
  if (!/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(normalized)) normalized = `https://${normalized}`;

  const parsed = new URL(normalized);
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('invalid-url');
  return parsed.toString();
}

function normalizeQuickLink(link, index = 0) {
  return {
    id: link.id || `quick-link-${Date.now()}-${index}`,
    title: String(link.title || '').trim(),
    url: String(link.url || '').trim(),
    createdAt: link.createdAt || new Date().toISOString(),
    order: Number.isFinite(link.order) ? link.order : index,
  };
}

function applyCustomBackground(imageDataUrl = '') {
  customBackgroundImage = typeof imageDataUrl === 'string' ? imageDataUrl : '';
  document.body.style.setProperty(
    '--custom-background-image',
    customBackgroundImage ? `url("${customBackgroundImage}")` : 'none'
  );
  document.body.classList.toggle('has-custom-background', !!customBackgroundImage);
  syncBackgroundControls();
}

async function loadBackgroundPreference() {
  try {
    const { [BACKGROUND_IMAGE_STORAGE_KEY]: storedBackground = '' } = await chrome.storage.local.get(BACKGROUND_IMAGE_STORAGE_KEY);
    applyCustomBackground(typeof storedBackground === 'string' ? storedBackground : '');
  } catch {
    applyCustomBackground('');
  }
}

async function saveBackgroundPreference(imageDataUrl) {
  await chrome.storage.local.set({ [BACKGROUND_IMAGE_STORAGE_KEY]: imageDataUrl });
  applyCustomBackground(imageDataUrl);
}

async function clearBackgroundPreference() {
  await chrome.storage.local.remove(BACKGROUND_IMAGE_STORAGE_KEY);
  applyCustomBackground('');
}

function loadImageFromUrl(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('image-load-failed'));
    image.src = source;
  });
}

function getScaledDimensions(width, height, maxEdge) {
  const largestEdge = Math.max(width, height);
  if (largestEdge <= maxEdge) {
    return { width, height };
  }

  const ratio = maxEdge / largestEdge;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function exportBackgroundCanvas(canvas) {
  const attempts = [
    ['image/webp', 0.82],
    ['image/webp', 0.72],
    ['image/jpeg', 0.8],
    ['image/jpeg', 0.7],
  ];

  let fallback = '';
  for (const [type, quality] of attempts) {
    const dataUrl = canvas.toDataURL(type, quality);
    fallback = dataUrl;
    if (dataUrl.length <= MAX_BACKGROUND_STORAGE_LENGTH) return dataUrl;
  }

  return fallback;
}

async function prepareBackgroundImage(file) {
  if (!(file instanceof File) || !file.type.startsWith('image/')) {
    throw new Error('invalid-image');
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await loadImageFromUrl(objectUrl);
    const sourceWidth = image.naturalWidth || image.width;
    const sourceHeight = image.naturalHeight || image.height;

    let maxEdge = MAX_BACKGROUND_EDGE;
    let bestDataUrl = '';

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { width, height } = getScaledDimensions(sourceWidth, sourceHeight, maxEdge);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) throw new Error('canvas-unavailable');

      context.fillStyle = '#f8f5f0';
      context.fillRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);

      bestDataUrl = exportBackgroundCanvas(canvas);
      if (bestDataUrl.length <= MAX_BACKGROUND_STORAGE_LENGTH) return bestDataUrl;

      maxEdge = Math.max(1280, Math.round(maxEdge * 0.82));
    }

    if (bestDataUrl.length > MAX_BACKGROUND_STORAGE_LENGTH) {
      throw new Error('background-too-large');
    }

    return bestDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function sortQuickLinks(list) {
  return [...list].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.createdAt).localeCompare(String(b.createdAt)));
}

async function getQuickLinks() {
  const { [QUICK_LINKS_STORAGE_KEY]: stored = [] } = await chrome.storage.local.get(QUICK_LINKS_STORAGE_KEY);
  return sortQuickLinks(stored.map((item, index) => normalizeQuickLink(item, index)).filter(item => item.title && item.url));
}

async function saveQuickLinks(list) {
  quickLinks = sortQuickLinks(list).map((item, index) => ({ ...normalizeQuickLink(item, index), order: index }));
  await chrome.storage.local.set({ [QUICK_LINKS_STORAGE_KEY]: quickLinks });
}

function renderQuickLinkCard(link) {
  const safeTitle = escapeHtml(link.title);
  const safeDomain = escapeHtml(summarizeUrl(link.url));
  const safeId = escapeHtml(link.id);
  const monogram = escapeHtml(getQuickLinkMonogram(link.title, link.url));
  let faviconUrl = '';

  try {
    faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(link.url).hostname}&sz=64`;
  } catch {
    faviconUrl = '';
  }

  return `
    <div class="quick-link-card quick-link-site-card clickable" data-action="open-quick-link" data-quick-link-id="${safeId}" title="${safeTitle} · ${safeDomain}">
      <div class="quick-link-actions">
        <button type="button" class="quick-link-icon-btn" data-action="edit-quick-link" data-quick-link-id="${safeId}" title="${t('quickLinkEdit')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931ZM19.5 7.125 16.875 4.5" /></svg>
        </button>
        <button type="button" class="quick-link-icon-btn" data-action="delete-quick-link" data-quick-link-id="${safeId}" title="${t('quickLinkDelete')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.8" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673A2.25 2.25 0 0 1 15.916 21.75H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.088-2.201a51.964 51.964 0 0 0-3.324 0C9.16 2.313 8.25 3.296 8.25 4.477v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>
        </button>
      </div>
      <div class="quick-link-avatar">
        ${faviconUrl ? `<img src="${faviconUrl}" alt="" data-hide-on-error="true" data-show-fallback-on-error="next">` : ''}
        <span class="quick-link-avatar-fallback"${faviconUrl ? ' style="display:none"' : ''}>${monogram}</span>
      </div>
      <div class="quick-link-copy">
        <div class="quick-link-name">${safeTitle}</div>
      </div>
    </div>`;
}

function renderQuickLinkAddCard() {
  return `
    <button type="button" class="quick-link-card quick-link-add-card" data-action="open-quick-link-modal" title="${t('quickLinkAddCardTitle')}" aria-label="${t('quickLinkAddCardTitle')}" data-tooltip="${t('quickLinkAddCardTitle')}">
      <div class="quick-link-add-symbol">+</div>
    </button>`;
}

function renderQuickLinkEmptyCard() {
  return `
    <div class="quick-link-empty-card">
      <div class="quick-link-empty-title">${t('quickLinksEmptyTitle')}</div>
      <div class="quick-link-empty-subtitle">${t('quickLinksEmptySubtitle')}</div>
    </div>`;
}

async function renderQuickLinksSection() {
  const grid = document.getElementById('quickLinksGrid');
  if (!grid) return;

  try {
    quickLinks = await getQuickLinks();
    const cards = quickLinks.map(link => renderQuickLinkCard(link));
    if (quickLinks.length === 0) cards.unshift(renderQuickLinkEmptyCard());
    cards.push(renderQuickLinkAddCard());
    grid.innerHTML = cards.join('');
  } catch (err) {
    console.warn('[tab-out] Could not load quick links:', err);
    grid.innerHTML = `${renderQuickLinkEmptyCard()}${renderQuickLinkAddCard()}`;
  }
}

function syncQuickLinkModalText() {
  const titleEl = document.getElementById('quickLinkModalTitle');
  const submitBtn = document.getElementById('quickLinkSubmitBtn');
  const idInput = document.getElementById('quickLinkId');
  const isEditing = !!idInput?.value;

  if (titleEl) titleEl.textContent = isEditing ? t('quickLinkModalEditTitle') : t('quickLinkModalAddTitle');
  if (submitBtn) submitBtn.textContent = isEditing ? t('quickLinkUpdate') : t('quickLinkSave');
}

function closeQuickLinkModal() {
  const backdrop = document.getElementById('quickLinkModalBackdrop');
  const form = document.getElementById('quickLinkForm');
  const idInput = document.getElementById('quickLinkId');
  if (backdrop) backdrop.style.display = 'none';
  if (form) form.reset();
  if (idInput) idInput.value = '';
  syncQuickLinkModalText();
}

function openQuickLinkModal(linkId = '') {
  const backdrop = document.getElementById('quickLinkModalBackdrop');
  const idInput = document.getElementById('quickLinkId');
  const nameInput = document.getElementById('quickLinkNameInput');
  const urlInput = document.getElementById('quickLinkUrlInput');
  const link = quickLinks.find(item => item.id === linkId);

  if (!backdrop || !idInput || !nameInput || !urlInput) return;

  idInput.value = link?.id || '';
  nameInput.value = link?.title || '';
  urlInput.value = link?.url || '';
  backdrop.style.display = 'flex';
  syncQuickLinkModalText();
  setTimeout(() => nameInput.focus(), 0);
}

async function openQuickLink(url) {
  const targetUrl = normalizeQuickLinkUrl(url);
  const currentTab = await chrome.tabs.getCurrent();

  if (currentTab?.id) {
    await chrome.tabs.update(currentTab.id, { url: targetUrl, active: true });
    return;
  }

  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (activeTab?.id) {
    await chrome.tabs.update(activeTab.id, { url: targetUrl, active: true });
    return;
  }

  await chrome.tabs.create({ url: targetUrl });
}

/**
 * fetchOpenTabs()
 *
 * Reads all currently open browser tabs directly from Chrome.
 * Sets the extensionId flag so we can identify Tab Out's own pages.
 */
async function fetchOpenTabs() {
  try {
    const extensionId = chrome.runtime.id;
    // The new URL for this page is now index.html (not newtab.html)
    const newtabUrl = `chrome-extension://${extensionId}/index.html`;

    const tabs = await chrome.tabs.query({});
    openTabs = tabs.map(t => ({
      id:       t.id,
      url:      t.url,
      title:    t.title,
      windowId: t.windowId,
      active:   t.active,
      // Flag Tab Out's own pages so we can detect duplicate new tabs
      isTabOut: t.url === newtabUrl || t.url === 'chrome://newtab/',
    }));
  } catch {
    // chrome.tabs API unavailable (shouldn't happen in an extension page)
    openTabs = [];
  }
}

/**
 * closeTabsByUrls(urls)
 *
 * Closes all open tabs whose hostname matches any of the given URLs.
 * After closing, re-fetches the tab list to keep our state accurate.
 *
 * Special case: file:// URLs are matched exactly (they have no hostname).
 */
async function closeTabsByUrls(urls) {
  if (!urls || urls.length === 0) return;

  // Separate file:// URLs (exact match) from regular URLs (hostname match)
  const targetHostnames = [];
  const exactUrls = new Set();

  for (const u of urls) {
    if (u.startsWith('file://')) {
      exactUrls.add(u);
    } else {
      try { targetHostnames.push(new URL(u).hostname); }
      catch { /* skip unparseable */ }
    }
  }

  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs
    .filter(tab => {
      const tabUrl = tab.url || '';
      if (tabUrl.startsWith('file://') && exactUrls.has(tabUrl)) return true;
      try {
        const tabHostname = new URL(tabUrl).hostname;
        return tabHostname && targetHostnames.includes(tabHostname);
      } catch { return false; }
    })
    .map(tab => tab.id);

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabsExact(urls)
 *
 * Closes tabs by exact URL match (not hostname). Used for landing pages
 * so closing "Gmail inbox" doesn't also close individual email threads.
 */
async function closeTabsExact(urls) {
  if (!urls || urls.length === 0) return;
  const urlSet = new Set(urls);
  const allTabs = await chrome.tabs.query({});
  const toClose = allTabs.filter(t => urlSet.has(t.url)).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * focusTab(url)
 *
 * Switches Chrome to the tab with the given URL (exact match first,
 * then hostname fallback). Also brings the window to the front.
 */
async function focusTab(url) {
  if (!url) return;
  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();

  // Try exact URL match first
  let matches = allTabs.filter(t => t.url === url);

  // Fall back to hostname match
  if (matches.length === 0) {
    try {
      const targetHost = new URL(url).hostname;
      matches = allTabs.filter(t => {
        try { return new URL(t.url).hostname === targetHost; }
        catch { return false; }
      });
    } catch {}
  }

  if (matches.length === 0) return;

  // Prefer a match in a different window so it actually switches windows
  const match = matches.find(t => t.windowId !== currentWindow.id) || matches[0];
  await chrome.tabs.update(match.id, { active: true });
  await chrome.windows.update(match.windowId, { focused: true });
}

/**
 * closeDuplicateTabs(urls, keepOne)
 *
 * Closes duplicate tabs for the given list of URLs.
 * keepOne=true → keep one copy of each, close the rest.
 * keepOne=false → close all copies.
 */
async function closeDuplicateTabs(urls, keepOne = true) {
  const allTabs = await chrome.tabs.query({});
  const toClose = [];

  for (const url of urls) {
    const matching = allTabs.filter(t => t.url === url);
    if (keepOne) {
      const keep = matching.find(t => t.active) || matching[0];
      for (const tab of matching) {
        if (tab.id !== keep.id) toClose.push(tab.id);
      }
    } else {
      for (const tab of matching) toClose.push(tab.id);
    }
  }

  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}

/**
 * closeTabOutDupes()
 *
 * Closes all duplicate Tab Out new-tab pages except the current one.
 */
async function closeTabOutDupes() {
  const extensionId = chrome.runtime.id;
  const newtabUrl = `chrome-extension://${extensionId}/index.html`;

  const allTabs = await chrome.tabs.query({});
  const currentWindow = await chrome.windows.getCurrent();
  const tabOutTabs = allTabs.filter(t =>
    t.url === newtabUrl || t.url === 'chrome://newtab/'
  );

  if (tabOutTabs.length <= 1) return;

  // Keep the active Tab Out tab in the CURRENT window — that's the one the
  // user is looking at right now. Falls back to any active one, then the first.
  const keep =
    tabOutTabs.find(t => t.active && t.windowId === currentWindow.id) ||
    tabOutTabs.find(t => t.active) ||
    tabOutTabs[0];
  const toClose = tabOutTabs.filter(t => t.id !== keep.id).map(t => t.id);
  if (toClose.length > 0) await chrome.tabs.remove(toClose);
  await fetchOpenTabs();
}


/* ----------------------------------------------------------------
   SAVED FOR LATER — chrome.storage.local

   Replaces the old server-side SQLite + REST API with Chrome's
   built-in key-value storage. Data persists across browser sessions
   and doesn't require a running server.

   Data shape stored under the "deferred" key:
   [
     {
       id: "1712345678901",          // timestamp-based unique ID
       url: "https://example.com",
       title: "Example Page",
       savedAt: "2026-04-04T10:00:00.000Z",  // ISO date string
       completed: false,             // true = checked off (archived)
       dismissed: false              // true = dismissed without reading
     },
     ...
   ]
   ---------------------------------------------------------------- */

/**
 * saveTabForLater(tab)
 *
 * Saves a single tab to the "Saved for Later" list in chrome.storage.local.
 * @param {{ url: string, title: string }} tab
 */
async function saveTabForLater(tab) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  deferred.push({
    id:        Date.now().toString(),
    url:       tab.url,
    title:     tab.title,
    savedAt:   new Date().toISOString(),
    completed: false,
    dismissed: false,
  });
  await chrome.storage.local.set({ deferred });
}

/**
 * getSavedTabs()
 *
 * Returns all saved tabs from chrome.storage.local.
 * Filters out dismissed items (those are gone for good).
 * Splits into active (not completed) and archived (completed).
 */
async function getSavedTabs() {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const visible = deferred.filter(t => !t.dismissed);
  return {
    active:   visible.filter(t => !t.completed),
    archived: visible.filter(t => t.completed),
  };
}

/**
 * checkOffSavedTab(id)
 *
 * Marks a saved tab as completed (checked off). It moves to the archive.
 */
async function checkOffSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.completed = true;
    tab.completedAt = new Date().toISOString();
    await chrome.storage.local.set({ deferred });
  }
}

/**
 * dismissSavedTab(id)
 *
 * Marks a saved tab as dismissed (removed from all lists).
 */
async function dismissSavedTab(id) {
  const { deferred = [] } = await chrome.storage.local.get('deferred');
  const tab = deferred.find(t => t.id === id);
  if (tab) {
    tab.dismissed = true;
    await chrome.storage.local.set({ deferred });
  }
}


/* ----------------------------------------------------------------
   UI HELPERS
   ---------------------------------------------------------------- */

/**
 * playCloseSound()
 *
 * Plays a clean "swoosh" sound when tabs are closed.
 * Built entirely with the Web Audio API — no sound files needed.
 * A filtered noise sweep that descends in pitch, like air moving.
 */
function playCloseSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const t = ctx.currentTime;

    // Swoosh: shaped white noise through a sweeping bandpass filter
    const duration = 0.25;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate noise with a natural envelope (quick attack, smooth decay)
    for (let i = 0; i < data.length; i++) {
      const pos = i / data.length;
      // Envelope: ramps up fast in first 10%, then fades out smoothly
      const env = pos < 0.1 ? pos / 0.1 : Math.pow(1 - (pos - 0.1) / 0.9, 1.5);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass filter sweeps from high to low — creates the "swoosh" character
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 2.0;
    filter.frequency.setValueAtTime(4000, t);
    filter.frequency.exponentialRampToValueAtTime(400, t + duration);

    // Volume
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t);

    setTimeout(() => ctx.close(), 500);
  } catch {
    // Audio not supported — fail silently
  }
}

/**
 * shootConfetti(x, y)
 *
 * Shoots a burst of colorful confetti particles from the given screen
 * coordinates (typically the center of a card being closed).
 * Pure CSS + JS, no libraries.
 */
function shootConfetti(x, y) {
  const colors = [
    '#c8713a', // amber
    '#e8a070', // amber light
    '#5a7a62', // sage
    '#8aaa92', // sage light
    '#5a6b7a', // slate
    '#8a9baa', // slate light
    '#d4b896', // warm paper
    '#b35a5a', // rose
  ];

  const particleCount = 17;

  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('div');

    const isCircle = Math.random() > 0.5;
    const size = 5 + Math.random() * 6; // 5–11px
    const color = colors[Math.floor(Math.random() * colors.length)];

    el.style.cssText = `
      position: fixed;
      left: ${x}px;
      top: ${y}px;
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border-radius: ${isCircle ? '50%' : '2px'};
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      opacity: 1;
    `;
    document.body.appendChild(el);

    // Physics: random angle and speed for the outward burst
    const angle   = Math.random() * Math.PI * 2;
    const speed   = 60 + Math.random() * 120;
    const vx      = Math.cos(angle) * speed;
    const vy      = Math.sin(angle) * speed - 80; // bias upward
    const gravity = 200;

    const startTime = performance.now();
    const duration  = 700 + Math.random() * 200; // 700–900ms

    function frame(now) {
      const elapsed  = (now - startTime) / 1000;
      const progress = elapsed / (duration / 1000);

      if (progress >= 1) { el.remove(); return; }

      const px = vx * elapsed;
      const py = vy * elapsed + 0.5 * gravity * elapsed * elapsed;
      const opacity = progress < 0.5 ? 1 : 1 - (progress - 0.5) * 2;
      const rotate  = elapsed * 200 * (isCircle ? 0 : 1);

      el.style.transform = `translate(calc(-50% + ${px}px), calc(-50% + ${py}px)) rotate(${rotate}deg)`;
      el.style.opacity = opacity;

      requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
  }
}

/**
 * animateCardOut(card)
 *
 * Smoothly removes a mission card: fade + scale down, then confetti.
 * After the animation, checks if the grid is now empty.
 */
function animateCardOut(card) {
  if (!card) return;

  const rect = card.getBoundingClientRect();
  shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);

  card.classList.add('closing');
  setTimeout(() => {
    card.remove();
    checkAndShowEmptyState();
  }, 300);
}

/**
 * showToast(message)
 *
 * Brief pop-up notification at the bottom of the screen.
 */
function showToast(message) {
  const toast = document.getElementById('toast');
  document.getElementById('toastText').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 2500);
}

/**
 * checkAndShowEmptyState()
 *
 * Shows a cheerful "Inbox zero" message when all domain cards are gone.
 */
function checkAndShowEmptyState() {
  const missionsEl = document.getElementById('openTabsMissions');
  if (!missionsEl) return;

  const remaining = missionsEl.querySelectorAll('.mission-card:not(.closing)').length;
  if (remaining > 0) return;

  missionsEl.innerHTML = `
    <div class="missions-empty-state">
      <div class="empty-checkmark">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <div class="empty-title">${t('inboxZeroTitle')}</div>
      <div class="empty-subtitle">${t('inboxZeroSubtitle')}</div>
    </div>
  `;

  const countEl = document.getElementById('openTabsSectionCount');
  if (countEl) countEl.textContent = t('domainsCount', 0);
}

/**
 * timeAgo(dateStr)
 *
 * Converts an ISO date string into a human-friendly relative time.
 * "2026-04-04T10:00:00Z" → "2 hrs ago" or "yesterday"
 */
function timeAgo(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  const now  = new Date();
  const diffMins  = Math.floor((now - then) / 60000);
  const diffHours = Math.floor((now - then) / 3600000);
  const diffDays  = Math.floor((now - then) / 86400000);

  if (diffMins < 1) return t('justNow');
  if (diffMins < 60) return t('minutesAgo', diffMins);
  if (diffHours < 24) return t('hoursAgo', diffHours);
  if (diffDays === 1) return t('yesterday');
  return t('daysAgo', diffDays);
}

/**
 * getGreeting() — "Good morning / afternoon / evening"
 */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return t('greetingMorning');
  if (hour < 17) return t('greetingAfternoon');
  return t('greetingEvening');
}

/**
 * getDateDisplay() — "Friday, April 4, 2026"
 */
function getDateDisplay() {
  return new Date().toLocaleDateString(currentLanguage, {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
  });
}


/* ----------------------------------------------------------------
   DOMAIN & TITLE CLEANUP HELPERS
   ---------------------------------------------------------------- */

// Map of known hostnames → friendly display names.
const FRIENDLY_DOMAINS = {
  'github.com':           'GitHub',
  'www.github.com':       'GitHub',
  'gist.github.com':      'GitHub Gist',
  'youtube.com':          'YouTube',
  'www.youtube.com':      'YouTube',
  'music.youtube.com':    'YouTube Music',
  'x.com':                'X',
  'www.x.com':            'X',
  'twitter.com':          'X',
  'www.twitter.com':      'X',
  'reddit.com':           'Reddit',
  'www.reddit.com':       'Reddit',
  'old.reddit.com':       'Reddit',
  'substack.com':         'Substack',
  'www.substack.com':     'Substack',
  'medium.com':           'Medium',
  'www.medium.com':       'Medium',
  'linkedin.com':         'LinkedIn',
  'www.linkedin.com':     'LinkedIn',
  'stackoverflow.com':    'Stack Overflow',
  'www.stackoverflow.com':'Stack Overflow',
  'news.ycombinator.com': 'Hacker News',
  'google.com':           'Google',
  'www.google.com':       'Google',
  'mail.google.com':      'Gmail',
  'docs.google.com':      'Google Docs',
  'drive.google.com':     'Google Drive',
  'calendar.google.com':  'Google Calendar',
  'meet.google.com':      'Google Meet',
  'gemini.google.com':    'Gemini',
  'chatgpt.com':          'ChatGPT',
  'www.chatgpt.com':      'ChatGPT',
  'chat.openai.com':      'ChatGPT',
  'claude.ai':            'Claude',
  'www.claude.ai':        'Claude',
  'code.claude.com':      'Claude Code',
  'notion.so':            'Notion',
  'www.notion.so':        'Notion',
  'figma.com':            'Figma',
  'www.figma.com':        'Figma',
  'slack.com':            'Slack',
  'app.slack.com':        'Slack',
  'discord.com':          'Discord',
  'www.discord.com':      'Discord',
  'wikipedia.org':        'Wikipedia',
  'en.wikipedia.org':     'Wikipedia',
  'amazon.com':           'Amazon',
  'www.amazon.com':       'Amazon',
  'netflix.com':          'Netflix',
  'www.netflix.com':      'Netflix',
  'spotify.com':          'Spotify',
  'open.spotify.com':     'Spotify',
  'vercel.com':           'Vercel',
  'www.vercel.com':       'Vercel',
  'npmjs.com':            'npm',
  'www.npmjs.com':        'npm',
  'developer.mozilla.org':'MDN',
  'arxiv.org':            'arXiv',
  'www.arxiv.org':        'arXiv',
  'huggingface.co':       'Hugging Face',
  'www.huggingface.co':   'Hugging Face',
  'producthunt.com':      'Product Hunt',
  'www.producthunt.com':  'Product Hunt',
  'xiaohongshu.com':      'RedNote',
  'www.xiaohongshu.com':  'RedNote',
  'local-files':          'Local Files',
};

function friendlyDomain(hostname) {
  if (!hostname) return '';
  if (hostname === 'local-files') return t('localFiles');
  if (FRIENDLY_DOMAINS[hostname]) return FRIENDLY_DOMAINS[hostname];

  if (hostname.endsWith('.substack.com') && hostname !== 'substack.com') {
    return t('substackBy', hostname.replace('.substack.com', ''));
  }
  if (hostname.endsWith('.github.io')) {
    return t('githubPages', hostname.replace('.github.io', ''));
  }

  let clean = hostname
    .replace(/^www\./, '')
    .replace(/\.(com|org|net|io|co|ai|dev|app|so|me|xyz|info|us|uk|co\.uk|co\.jp)$/, '');

  return clean.split('.').map(part => capitalize(part)).join(' ');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function stripTitleNoise(title) {
  if (!title) return '';
  // Strip leading notification count: "(2) Title"
  title = title.replace(/^\(\d+\+?\)\s*/, '');
  // Strip inline counts like "Inbox (16,359)"
  title = title.replace(/\s*\([\d,]+\+?\)\s*/g, ' ');
  // Strip email addresses (privacy + cleaner display)
  title = title.replace(/\s*[\-\u2010-\u2015]\s*[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  title = title.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '');
  // Clean X/Twitter format
  title = title.replace(/\s+on X:\s*/, ': ');
  title = title.replace(/\s*\/\s*X\s*$/, '');
  return title.trim();
}

function cleanTitle(title, hostname) {
  if (!title || !hostname) return title || '';

  const friendly = friendlyDomain(hostname);
  const domain   = hostname.replace(/^www\./, '');
  const seps     = [' - ', ' | ', ' — ', ' · ', ' – '];

  for (const sep of seps) {
    const idx = title.lastIndexOf(sep);
    if (idx === -1) continue;
    const suffix     = title.slice(idx + sep.length).trim();
    const suffixLow  = suffix.toLowerCase();
    if (
      suffixLow === domain.toLowerCase() ||
      suffixLow === friendly.toLowerCase() ||
      suffixLow === domain.replace(/\.\w+$/, '').toLowerCase() ||
      domain.toLowerCase().includes(suffixLow) ||
      friendly.toLowerCase().includes(suffixLow)
    ) {
      const cleaned = title.slice(0, idx).trim();
      if (cleaned.length >= 5) return cleaned;
    }
  }
  return title;
}

function smartTitle(title, url) {
  if (!url) return title || '';
  let pathname = '', hostname = '';
  try { const u = new URL(url); pathname = u.pathname; hostname = u.hostname; }
  catch { return title || ''; }

  const titleIsUrl = !title || title === url || title.startsWith(hostname) || title.startsWith('http');

  if ((hostname === 'x.com' || hostname === 'twitter.com' || hostname === 'www.x.com') && pathname.includes('/status/')) {
    const username = pathname.split('/')[1];
    if (username) return titleIsUrl ? t('postByUser', username) : title;
  }

  if (hostname === 'github.com' || hostname === 'www.github.com') {
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const [owner, repo, ...rest] = parts;
      if (rest[0] === 'issues' && rest[1]) return t('githubIssue', owner, repo, rest[1]);
      if (rest[0] === 'pull'   && rest[1]) return t('githubPr', owner, repo, rest[1]);
      if (rest[0] === 'blob' || rest[0] === 'tree') return t('githubPath', owner, repo, rest.slice(2).join('/'));
      if (titleIsUrl) return `${owner}/${repo}`;
    }
  }

  if ((hostname === 'www.youtube.com' || hostname === 'youtube.com') && pathname === '/watch') {
    if (titleIsUrl) return t('youtubeVideo');
  }

  if ((hostname === 'www.reddit.com' || hostname === 'reddit.com' || hostname === 'old.reddit.com') && pathname.includes('/comments/')) {
    const parts  = pathname.split('/').filter(Boolean);
    const subIdx = parts.indexOf('r');
    if (subIdx !== -1 && parts[subIdx + 1]) {
      if (titleIsUrl) return t('redditPost', parts[subIdx + 1]);
    }
  }

  return title || url;
}


/* ----------------------------------------------------------------
   SVG ICON STRINGS
   ---------------------------------------------------------------- */
const ICONS = {
  tabs:    `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18" /></svg>`,
  close:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>`,
  archive: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" /></svg>`,
  focus:   `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 19.5 15-15m0 0H8.25m11.25 0v11.25" /></svg>`,
};


/* ----------------------------------------------------------------
   IN-MEMORY STORE FOR OPEN-TAB GROUPS
   ---------------------------------------------------------------- */
let domainGroups = [];


/* ----------------------------------------------------------------
   HELPER: filter out browser-internal pages
   ---------------------------------------------------------------- */

/**
 * getRealTabs()
 *
 * Returns tabs that are real web pages — no chrome://, extension
 * pages, about:blank, etc.
 */
function getRealTabs() {
  return openTabs.filter(t => {
    const url = t.url || '';
    return (
      !url.startsWith('chrome://') &&
      !url.startsWith('chrome-extension://') &&
      !url.startsWith('about:') &&
      !url.startsWith('edge://') &&
      !url.startsWith('brave://')
    );
  });
}

/**
 * checkTabOutDupes()
 *
 * Counts how many Tab Out pages are open. If more than 1,
 * shows a banner offering to close the extras.
 */
function checkTabOutDupes() {
  const tabOutTabs = openTabs.filter(t => t.isTabOut);
  const banner  = document.getElementById('tabOutDupeBanner');
  if (!banner) return;

  if (tabOutTabs.length > 1) {
    updateTabOutDupeBannerText(tabOutTabs.length);
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function renderOpenTabsSectionCount(domainCount, totalTabs) {
  return `${t('domainsCount', domainCount)} &nbsp;&middot;&nbsp; <button class="action-btn close-tabs" data-action="close-all-open-tabs" style="font-size:11px;padding:3px 10px;">${ICONS.close} ${t('closeAllTabsAction', totalTabs)}</button>`;
}


/* ----------------------------------------------------------------
   OVERFLOW CHIPS ("+N more" expand button in domain cards)
   ---------------------------------------------------------------- */

function buildOverflowChips(hiddenTabs, urlCounts = {}) {
  const hiddenChips = hiddenTabs.map(tab => {
    const label    = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), '');
    const count    = urlCounts[tab.url] || 1;
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="" data-hide-on-error="true">` : ''}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${t('saveForLaterTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${t('closeThisTabTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-chips-overflow" style="display:none">${hiddenChips}</div>
    <div class="page-chip page-chip-overflow clickable" data-action="expand-chips">
      <span class="chip-text">${t('moreTabs', hiddenTabs.length)}</span>
    </div>`;
}


/* ----------------------------------------------------------------
   DOMAIN CARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderDomainCard(group, groupIndex)
 *
 * Builds the HTML for one domain group card.
 * group = { domain: string, tabs: [{ url, title, id, windowId, active }] }
 */
function renderDomainCard(group) {
  const tabs      = group.tabs || [];
  const tabCount  = tabs.length;
  const isLanding = group.domain === '__landing-pages__';
  const stableId  = 'domain-' + group.domain.replace(/[^a-z0-9]/g, '-');

  // Count duplicates (exact URL match)
  const urlCounts = {};
  for (const tab of tabs) urlCounts[tab.url] = (urlCounts[tab.url] || 0) + 1;
  const dupeUrls   = Object.entries(urlCounts).filter(([, c]) => c > 1);
  const hasDupes   = dupeUrls.length > 0;
  const totalExtras = dupeUrls.reduce((s, [, c]) => s + c - 1, 0);

  const tabBadge = `<span class="open-tabs-badge">
    ${ICONS.tabs}
    ${t('tabsOpenBadge', tabCount)}
  </span>`;

  const dupeBadge = hasDupes
    ? `<span class="open-tabs-badge duplicate-badge" style="color:var(--accent-amber);background:rgba(200,113,58,0.08);">
        ${t('duplicateBadge', totalExtras)}
      </span>`
    : '';

  // Deduplicate for display: show each URL once, with (Nx) badge if duped
  const seen = new Set();
  const uniqueTabs = [];
  for (const tab of tabs) {
    if (!seen.has(tab.url)) { seen.add(tab.url); uniqueTabs.push(tab); }
  }

  const visibleTabs = uniqueTabs.slice(0, 8);
  const extraCount  = uniqueTabs.length - visibleTabs.length;

  const pageChips = visibleTabs.map(tab => {
    let label = cleanTitle(smartTitle(stripTitleNoise(tab.title || ''), tab.url), group.domain);
    // For localhost tabs, prepend port number so you can tell projects apart
    try {
      const parsed = new URL(tab.url);
      if (parsed.hostname === 'localhost' && parsed.port) label = `${parsed.port} ${label}`;
    } catch {}
    const count    = urlCounts[tab.url];
    const dupeTag  = count > 1 ? ` <span class="chip-dupe-badge">(${count}x)</span>` : '';
    const chipClass = count > 1 ? ' chip-has-dupes' : '';
    const safeUrl   = (tab.url || '').replace(/"/g, '&quot;');
    const safeTitle = label.replace(/"/g, '&quot;');
    let domain = '';
    try { domain = new URL(tab.url).hostname; } catch {}
    const faviconUrl = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=16` : '';
    return `<div class="page-chip clickable${chipClass}" data-action="focus-tab" data-tab-url="${safeUrl}" title="${safeTitle}">
      ${faviconUrl ? `<img class="chip-favicon" src="${faviconUrl}" alt="" data-hide-on-error="true">` : ''}
      <span class="chip-text">${label}</span>${dupeTag}
      <div class="chip-actions">
        <button class="chip-action chip-save" data-action="defer-single-tab" data-tab-url="${safeUrl}" data-tab-title="${safeTitle}" title="${t('saveForLaterTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
        </button>
        <button class="chip-action chip-close" data-action="close-single-tab" data-tab-url="${safeUrl}" title="${t('closeThisTabTitle')}">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>`;
  }).join('') + (extraCount > 0 ? buildOverflowChips(uniqueTabs.slice(8), urlCounts) : '');

  let actionsHtml = `
    <button class="action-btn close-tabs" data-action="close-domain-tabs" data-domain-id="${stableId}">
      ${ICONS.close}
      ${t('closeAllTabsAction', tabCount)}
    </button>`;

  if (hasDupes) {
    const dupeUrlsEncoded = dupeUrls.map(([url]) => encodeURIComponent(url)).join(',');
    actionsHtml += `
      <button class="action-btn" data-action="dedup-keep-one" data-dupe-urls="${dupeUrlsEncoded}">
        ${t('closeDuplicatesAction', totalExtras)}
      </button>`;
  }

  return `
    <div class="mission-card domain-card ${hasDupes ? 'has-amber-bar' : 'has-neutral-bar'}" data-domain-id="${stableId}">
      <div class="status-bar"></div>
      <div class="mission-content">
        <div class="mission-top">
          <span class="mission-name">${isLanding ? t('homepages') : (group.label || friendlyDomain(group.domain))}</span>
          ${tabBadge}
          ${dupeBadge}
        </div>
        <div class="mission-pages">${pageChips}</div>
        <div class="actions">${actionsHtml}</div>
      </div>
      <div class="mission-meta">
        <div class="mission-page-count">${tabCount}</div>
        <div class="mission-page-label">${t('tabsLabel')}</div>
      </div>
    </div>`;
}


/* ----------------------------------------------------------------
   SAVED FOR LATER — Render Checklist Column
   ---------------------------------------------------------------- */

/**
 * renderDeferredColumn()
 *
 * Reads saved tabs from chrome.storage.local and renders the right-side
 * "Saved for Later" checklist column. Shows active items as a checklist
 * and completed items in a collapsible archive.
 */
async function renderDeferredColumn() {
  const column         = document.getElementById('deferredColumn');
  const list           = document.getElementById('deferredList');
  const empty          = document.getElementById('deferredEmpty');
  const countEl        = document.getElementById('deferredCount');
  const archiveEl      = document.getElementById('deferredArchive');
  const archiveCountEl = document.getElementById('archiveCount');
  const archiveList    = document.getElementById('archiveList');

  if (!column) return;

  try {
    const { active, archived } = await getSavedTabs();

    // Hide the entire column if there's nothing to show
    if (active.length === 0 && archived.length === 0) {
      column.style.display = 'none';
      return;
    }

    column.style.display = 'block';

    // Render active checklist items
    if (active.length > 0) {
      countEl.textContent = t('itemsCount', active.length);
      list.innerHTML = active.map(item => renderDeferredItem(item)).join('');
      list.style.display = 'block';
      empty.style.display = 'none';
    } else {
      list.style.display = 'none';
      countEl.textContent = '';
      empty.style.display = 'block';
    }

    // Render archive section
    if (archived.length > 0) {
      archiveCountEl.textContent = `(${archived.length})`;
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      archiveEl.style.display = 'block';
    } else {
      archiveEl.style.display = 'none';
    }

  } catch (err) {
    console.warn('[tab-out] Could not load saved tabs:', err);
    column.style.display = 'none';
  }
}

/**
 * renderDeferredItem(item)
 *
 * Builds HTML for one active checklist item: checkbox, title link,
 * domain, time ago, dismiss button.
 */
function renderDeferredItem(item) {
  let domain = '';
  try { domain = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
  const ago = timeAgo(item.savedAt);

  return `
    <div class="deferred-item" data-deferred-id="${item.id}">
      <input type="checkbox" class="deferred-checkbox" data-action="check-deferred" data-deferred-id="${item.id}">
      <div class="deferred-info">
        <a href="${item.url}" target="_blank" rel="noopener" class="deferred-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
          <img src="${faviconUrl}" alt="" style="width:14px;height:14px;vertical-align:-2px;margin-right:4px" data-hide-on-error="true">${item.title || item.url}
        </a>
        <div class="deferred-meta">
          <span>${domain}</span>
          <span>${ago}</span>
        </div>
      </div>
      <button class="deferred-dismiss" data-action="dismiss-deferred" data-deferred-id="${item.id}" title="${t('dismissTitle')}">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
      </button>
    </div>`;
}

/**
 * renderArchiveItem(item)
 *
 * Builds HTML for one completed/archived item (simpler: just title + date).
 */
function renderArchiveItem(item) {
  const ago = item.completedAt ? timeAgo(item.completedAt) : timeAgo(item.savedAt);
  return `
    <div class="archive-item">
      <a href="${item.url}" target="_blank" rel="noopener" class="archive-item-title" title="${(item.title || '').replace(/"/g, '&quot;')}">
        ${item.title || item.url}
      </a>
      <span class="archive-item-date">${ago}</span>
    </div>`;
}


/* ----------------------------------------------------------------
   MAIN DASHBOARD RENDERER
   ---------------------------------------------------------------- */

/**
 * renderStaticDashboard()
 *
 * The main render function:
 * 1. Paints greeting + date
 * 2. Fetches open tabs via chrome.tabs.query()
 * 3. Groups tabs by domain (with landing pages pulled out to their own group)
 * 4. Renders domain cards
 * 5. Updates footer stats
 * 6. Renders the "Saved for Later" checklist
 */
async function renderStaticDashboard() {
  applyStaticText();
  await renderQuickLinksSection();

  // --- Header ---
  const greetingEl = document.getElementById('greeting');
  const dateEl     = document.getElementById('dateDisplay');
  if (greetingEl) greetingEl.textContent = getGreeting();
  if (dateEl)     dateEl.textContent     = getDateDisplay();

  // --- Fetch tabs ---
  await fetchOpenTabs();
  const realTabs = getRealTabs();

  // --- Group tabs by domain ---
  // Landing pages (Gmail inbox, Twitter home, etc.) get their own special group
  // so they can be closed together without affecting content tabs on the same domain.
  const LANDING_PAGE_PATTERNS = [
    { hostname: 'mail.google.com', test: (p, h) =>
        !h.includes('#inbox/') && !h.includes('#sent/') && !h.includes('#search/') },
    { hostname: 'x.com',               pathExact: ['/home'] },
    { hostname: 'www.linkedin.com',    pathExact: ['/'] },
    { hostname: 'github.com',          pathExact: ['/'] },
    { hostname: 'www.youtube.com',     pathExact: ['/'] },
    // Merge personal patterns from config.local.js (if it exists)
    ...(typeof LOCAL_LANDING_PAGE_PATTERNS !== 'undefined' ? LOCAL_LANDING_PAGE_PATTERNS : []),
  ];

  function isLandingPage(url) {
    try {
      const parsed = new URL(url);
      return LANDING_PAGE_PATTERNS.some(p => {
        // Support both exact hostname and suffix matching (for wildcard subdomains)
        const hostnameMatch = p.hostname
          ? parsed.hostname === p.hostname
          : p.hostnameEndsWith
            ? parsed.hostname.endsWith(p.hostnameEndsWith)
            : false;
        if (!hostnameMatch) return false;
        if (p.test)       return p.test(parsed.pathname, url);
        if (p.pathPrefix) return parsed.pathname.startsWith(p.pathPrefix);
        if (p.pathExact)  return p.pathExact.includes(parsed.pathname);
        return parsed.pathname === '/';
      });
    } catch { return false; }
  }

  domainGroups = [];
  const groupMap    = {};
  const landingTabs = [];

  // Custom group rules from config.local.js (if any)
  const customGroups = typeof LOCAL_CUSTOM_GROUPS !== 'undefined' ? LOCAL_CUSTOM_GROUPS : [];

  // Check if a URL matches a custom group rule; returns the rule or null
  function matchCustomGroup(url) {
    try {
      const parsed = new URL(url);
      return customGroups.find(r => {
        const hostMatch = r.hostname
          ? parsed.hostname === r.hostname
          : r.hostnameEndsWith
            ? parsed.hostname.endsWith(r.hostnameEndsWith)
            : false;
        if (!hostMatch) return false;
        if (r.pathPrefix) return parsed.pathname.startsWith(r.pathPrefix);
        return true; // hostname matched, no path filter
      }) || null;
    } catch { return null; }
  }

  for (const tab of realTabs) {
    try {
      if (isLandingPage(tab.url)) {
        landingTabs.push(tab);
        continue;
      }

      // Check custom group rules first (e.g. merge subdomains, split by path)
      const customRule = matchCustomGroup(tab.url);
      if (customRule) {
        const key = customRule.groupKey;
        if (!groupMap[key]) groupMap[key] = { domain: key, label: customRule.groupLabel, tabs: [] };
        groupMap[key].tabs.push(tab);
        continue;
      }

      let hostname;
      if (tab.url && tab.url.startsWith('file://')) {
        hostname = 'local-files';
      } else {
        hostname = new URL(tab.url).hostname;
      }
      if (!hostname) continue;

      if (!groupMap[hostname]) groupMap[hostname] = { domain: hostname, tabs: [] };
      groupMap[hostname].tabs.push(tab);
    } catch {
      // Skip malformed URLs
    }
  }

  if (landingTabs.length > 0) {
    groupMap['__landing-pages__'] = { domain: '__landing-pages__', tabs: landingTabs };
  }

  // Sort: landing pages first, then domains from landing page sites, then by tab count
  // Collect exact hostnames and suffix patterns for priority sorting
  const landingHostnames = new Set(LANDING_PAGE_PATTERNS.map(p => p.hostname).filter(Boolean));
  const landingSuffixes = LANDING_PAGE_PATTERNS.map(p => p.hostnameEndsWith).filter(Boolean);
  function isLandingDomain(domain) {
    if (landingHostnames.has(domain)) return true;
    return landingSuffixes.some(s => domain.endsWith(s));
  }
  domainGroups = Object.values(groupMap).sort((a, b) => {
    const aIsLanding = a.domain === '__landing-pages__';
    const bIsLanding = b.domain === '__landing-pages__';
    if (aIsLanding !== bIsLanding) return aIsLanding ? -1 : 1;

    const aIsPriority = isLandingDomain(a.domain);
    const bIsPriority = isLandingDomain(b.domain);
    if (aIsPriority !== bIsPriority) return aIsPriority ? -1 : 1;

    return b.tabs.length - a.tabs.length;
  });

  // --- Render domain cards ---
  const openTabsSection      = document.getElementById('openTabsSection');
  const openTabsMissionsEl   = document.getElementById('openTabsMissions');
  const openTabsSectionCount = document.getElementById('openTabsSectionCount');
  const openTabsSectionTitle = document.getElementById('openTabsSectionTitle');

  if (domainGroups.length > 0 && openTabsSection) {
    if (openTabsSectionTitle) openTabsSectionTitle.textContent = t('openTabs');
    openTabsSectionCount.innerHTML = renderOpenTabsSectionCount(domainGroups.length, realTabs.length);
    openTabsMissionsEl.innerHTML = domainGroups.map(g => renderDomainCard(g)).join('');
    openTabsSection.style.display = 'block';
  } else if (openTabsSection) {
    openTabsSection.style.display = 'none';
  }

  // --- Footer stats ---
  const statTabs = document.getElementById('statTabs');
  if (statTabs) statTabs.textContent = openTabs.length;

  // --- Check for duplicate Tab Out tabs ---
  checkTabOutDupes();

  // --- Render "Saved for Later" column ---
  await renderDeferredColumn();
}

async function renderDashboard() {
  await renderStaticDashboard();
}


/* ----------------------------------------------------------------
   EVENT HANDLERS — using event delegation

   One listener on document handles ALL button clicks.
   Think of it as one security guard watching the whole building
   instead of one per door.
   ---------------------------------------------------------------- */

document.addEventListener('click', async (e) => {
  // Walk up the DOM to find the nearest element with data-action
  const actionEl = e.target.closest('[data-action]');
  if (!actionEl) return;

  const action = actionEl.dataset.action;

  if (action === 'set-language') {
    const language = actionEl.dataset.language;
    if (!language || language === currentLanguage) return;
    await setLanguagePreference(language);
    await renderDashboard();
    return;
  }

  if (action === 'choose-background-image') {
    const input = document.getElementById('backgroundImageInput');
    if (!(input instanceof HTMLInputElement)) return;
    input.value = '';
    input.click();
    return;
  }

  if (action === 'clear-background-image') {
    try {
      await clearBackgroundPreference();
      showToast(t('toastBackgroundCleared'));
    } catch (err) {
      console.warn('[tab-out] Could not clear background:', err);
      showToast(t('toastBackgroundFailed'));
    }
    return;
  }

  if (action === 'open-quick-link-modal') {
    e.preventDefault();
    e.stopPropagation();
    openQuickLinkModal(actionEl.dataset.quickLinkId || '');
    return;
  }

  if (action === 'close-quick-link-modal') {
    e.preventDefault();
    e.stopPropagation();
    closeQuickLinkModal();
    return;
  }

  if (action === 'open-quick-link') {
    const linkId = actionEl.dataset.quickLinkId;
    const link = quickLinks.find(item => item.id === linkId);
    if (!link) return;

    try {
      await openQuickLink(link.url);
    } catch (err) {
      console.warn('[tab-out] Could not open quick link:', err);
      showToast(t('toastQuickLinkInvalidUrl'));
    }
    return;
  }

  if (action === 'edit-quick-link') {
    e.preventDefault();
    e.stopPropagation();
    openQuickLinkModal(actionEl.dataset.quickLinkId || '');
    return;
  }

  if (action === 'delete-quick-link') {
    e.preventDefault();
    e.stopPropagation();
    const linkId = actionEl.dataset.quickLinkId;
    const link = quickLinks.find(item => item.id === linkId);
    if (!link) return;
    if (!window.confirm(t('quickLinkDeleteConfirm', link.title))) return;

    await saveQuickLinks(quickLinks.filter(item => item.id !== linkId));
    await renderQuickLinksSection();
    showToast(t('toastQuickLinkDeleted'));
    return;
  }

  // ---- Close duplicate Tab Out tabs ----
  if (action === 'close-tabout-dupes') {
    await closeTabOutDupes();
    playCloseSound();
    const banner = document.getElementById('tabOutDupeBanner');
    if (banner) {
      banner.style.transition = 'opacity 0.4s';
      banner.style.opacity = '0';
      setTimeout(() => { banner.style.display = 'none'; banner.style.opacity = '1'; }, 400);
    }
    showToast(t('toastClosedExtraTabOutTabs'));
    return;
  }

  const card = actionEl.closest('.mission-card');

  // ---- Expand overflow chips ("+N more") ----
  if (action === 'expand-chips') {
    const overflowContainer = actionEl.parentElement.querySelector('.page-chips-overflow');
    if (overflowContainer) {
      overflowContainer.style.display = 'contents';
      actionEl.remove();
    }
    return;
  }

  // ---- Focus a specific tab ----
  if (action === 'focus-tab') {
    const tabUrl = actionEl.dataset.tabUrl;
    if (tabUrl) await focusTab(tabUrl);
    return;
  }

  // ---- Close a single tab ----
  if (action === 'close-single-tab') {
    e.stopPropagation(); // don't trigger parent chip's focus-tab
    const tabUrl = actionEl.dataset.tabUrl;
    if (!tabUrl) return;

    // Close the tab in Chrome directly
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    playCloseSound();

    // Animate the chip row out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      const rect = chip.getBoundingClientRect();
      shootConfetti(rect.left + rect.width / 2, rect.top + rect.height / 2);
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => {
        chip.remove();
        // If the card now has no tabs, remove it too
        const parentCard = document.querySelector('.mission-card:has(.mission-pages:empty)');
        if (parentCard) animateCardOut(parentCard);
        document.querySelectorAll('.mission-card').forEach(c => {
          if (c.querySelectorAll('.page-chip[data-action="focus-tab"]').length === 0) {
            animateCardOut(c);
          }
        });
      }, 200);
    }

    // Update footer
    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;

    showToast(t('toastTabClosed'));
    return;
  }

  // ---- Save a single tab for later (then close it) ----
  if (action === 'defer-single-tab') {
    e.stopPropagation();
    const tabUrl   = actionEl.dataset.tabUrl;
    const tabTitle = actionEl.dataset.tabTitle || tabUrl;
    if (!tabUrl) return;

    // Save to chrome.storage.local
    try {
      await saveTabForLater({ url: tabUrl, title: tabTitle });
    } catch (err) {
      console.error('[tab-out] Failed to save tab:', err);
      showToast(t('toastSaveFailed'));
      return;
    }

    // Close the tab in Chrome
    const allTabs = await chrome.tabs.query({});
    const match   = allTabs.find(t => t.url === tabUrl);
    if (match) await chrome.tabs.remove(match.id);
    await fetchOpenTabs();

    // Animate chip out
    const chip = actionEl.closest('.page-chip');
    if (chip) {
      chip.style.transition = 'opacity 0.2s, transform 0.2s';
      chip.style.opacity    = '0';
      chip.style.transform  = 'scale(0.8)';
      setTimeout(() => chip.remove(), 200);
    }

    showToast(t('toastSavedForLater'));
    await renderDeferredColumn();
    return;
  }

  // ---- Check off a saved tab (moves it to archive) ----
  if (action === 'check-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await checkOffSavedTab(id);

    // Animate: strikethrough first, then slide out
    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('checked');
      setTimeout(() => {
        item.classList.add('removing');
        setTimeout(() => {
          item.remove();
          renderDeferredColumn(); // refresh counts and archive
        }, 300);
      }, 800);
    }
    return;
  }

  // ---- Dismiss a saved tab (removes it entirely) ----
  if (action === 'dismiss-deferred') {
    const id = actionEl.dataset.deferredId;
    if (!id) return;

    await dismissSavedTab(id);

    const item = actionEl.closest('.deferred-item');
    if (item) {
      item.classList.add('removing');
      setTimeout(() => {
        item.remove();
        renderDeferredColumn();
      }, 300);
    }
    return;
  }

  // ---- Close all tabs in a domain group ----
  if (action === 'close-domain-tabs') {
    const domainId = actionEl.dataset.domainId;
    const group    = domainGroups.find(g => {
      return 'domain-' + g.domain.replace(/[^a-z0-9]/g, '-') === domainId;
    });
    if (!group) return;

    const urls      = group.tabs.map(t => t.url);
    // Landing pages and custom groups (whose domain key isn't a real hostname)
    // must use exact URL matching to avoid closing unrelated tabs
    const useExact  = group.domain === '__landing-pages__' || !!group.label;

    if (useExact) {
      await closeTabsExact(urls);
    } else {
      await closeTabsByUrls(urls);
    }

    if (card) {
      playCloseSound();
      animateCardOut(card);
    }

    // Remove from in-memory groups
    const idx = domainGroups.indexOf(group);
    if (idx !== -1) domainGroups.splice(idx, 1);

    const groupLabel = group.domain === '__landing-pages__' ? t('homepages') : (group.label || friendlyDomain(group.domain));
    showToast(t('toastClosedGroupTabs', urls.length, groupLabel));

    const statTabs = document.getElementById('statTabs');
    if (statTabs) statTabs.textContent = openTabs.length;
    return;
  }

  // ---- Close duplicates, keep one copy ----
  if (action === 'dedup-keep-one') {
    const urlsEncoded = actionEl.dataset.dupeUrls || '';
    const urls = urlsEncoded.split(',').map(u => decodeURIComponent(u)).filter(Boolean);
    if (urls.length === 0) return;

    await closeDuplicateTabs(urls, true);
    playCloseSound();

    // Hide the dedup button
    actionEl.style.transition = 'opacity 0.2s';
    actionEl.style.opacity    = '0';
    setTimeout(() => actionEl.remove(), 200);

    // Remove dupe badges from the card
    if (card) {
      card.querySelectorAll('.chip-dupe-badge').forEach(b => {
        b.style.transition = 'opacity 0.2s';
        b.style.opacity    = '0';
        setTimeout(() => b.remove(), 200);
      });
      card.querySelectorAll('.duplicate-badge').forEach(badge => {
        badge.style.transition = 'opacity 0.2s';
        badge.style.opacity    = '0';
        setTimeout(() => badge.remove(), 200);
      });
      card.classList.remove('has-amber-bar');
      card.classList.add('has-neutral-bar');
    }

    showToast(t('toastClosedDuplicates'));
    return;
  }

  // ---- Close ALL open tabs ----
  if (action === 'close-all-open-tabs') {
    const allUrls = openTabs
      .filter(t => t.url && !t.url.startsWith('chrome') && !t.url.startsWith('about:'))
      .map(t => t.url);
    await closeTabsByUrls(allUrls);
    playCloseSound();

    document.querySelectorAll('#openTabsMissions .mission-card').forEach(c => {
      shootConfetti(
        c.getBoundingClientRect().left + c.offsetWidth / 2,
        c.getBoundingClientRect().top  + c.offsetHeight / 2
      );
      animateCardOut(c);
    });

    showToast(t('toastClosedAllTabs'));
    return;
  }
});

document.getElementById('quickLinkForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const idInput = document.getElementById('quickLinkId');
  const nameInput = document.getElementById('quickLinkNameInput');
  const urlInput = document.getElementById('quickLinkUrlInput');
  if (!idInput || !nameInput || !urlInput) return;

  const title = nameInput.value.trim();
  const existingId = idInput.value.trim();
  let url;

  if (!title) {
    showToast(t('toastQuickLinkInvalidName'));
    nameInput.focus();
    return;
  }

  try {
    url = normalizeQuickLinkUrl(urlInput.value);
  } catch {
    showToast(t('toastQuickLinkInvalidUrl'));
    urlInput.focus();
    return;
  }

  const nextLink = normalizeQuickLink({
    id: existingId || `quick-link-${Date.now()}`,
    title,
    url,
    createdAt: existingId ? (quickLinks.find(item => item.id === existingId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
    order: existingId ? (quickLinks.find(item => item.id === existingId)?.order ?? quickLinks.length) : quickLinks.length,
  }, quickLinks.length);

  if (existingId) {
    await saveQuickLinks(quickLinks.map(item => item.id === existingId ? nextLink : item));
    showToast(t('toastQuickLinkUpdated'));
  } else {
    await saveQuickLinks([...quickLinks, nextLink]);
    showToast(t('toastQuickLinkAdded'));
  }

  await renderQuickLinksSection();
  closeQuickLinkModal();
});

document.getElementById('quickLinkModalBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'quickLinkModalBackdrop') closeQuickLinkModal();
});

document.getElementById('backgroundImageInput')?.addEventListener('change', async (e) => {
  const input = e.target;
  if (!(input instanceof HTMLInputElement)) return;

  const [file] = input.files || [];
  if (!file) return;

  try {
    const imageDataUrl = await prepareBackgroundImage(file);
    await saveBackgroundPreference(imageDataUrl);
    showToast(t('toastBackgroundUpdated'));
  } catch (err) {
    console.warn('[tab-out] Could not update background:', err);
    showToast(t('toastBackgroundFailed'));
  } finally {
    input.value = '';
  }
});

document.addEventListener('error', (e) => {
  const target = e.target;
  if (!(target instanceof HTMLImageElement)) return;

  if (target.dataset.hideOnError === 'true') {
    target.style.display = 'none';
  }

  if (target.dataset.showFallbackOnError === 'next' && target.nextElementSibling instanceof HTMLElement) {
    target.nextElementSibling.style.display = 'flex';
  }
}, true);

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const backdrop = document.getElementById('quickLinkModalBackdrop');
  if (backdrop?.style.display === 'flex') closeQuickLinkModal();
});

// ---- Archive toggle — expand/collapse the archive section ----
document.addEventListener('click', (e) => {
  const toggle = e.target.closest('#archiveToggle');
  if (!toggle) return;

  toggle.classList.toggle('open');
  const body = document.getElementById('archiveBody');
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
});

// ---- Archive search — filter archived items as user types ----
document.addEventListener('input', async (e) => {
  if (e.target.id !== 'archiveSearch') return;

  const q = e.target.value.trim().toLowerCase();
  const archiveList = document.getElementById('archiveList');
  if (!archiveList) return;

  try {
    const { archived } = await getSavedTabs();

    if (q.length < 2) {
      // Show all archived items
      archiveList.innerHTML = archived.map(item => renderArchiveItem(item)).join('');
      return;
    }

    // Filter by title or URL containing the query string
    const results = archived.filter(item =>
      (item.title || '').toLowerCase().includes(q) ||
      (item.url  || '').toLowerCase().includes(q)
    );

    archiveList.innerHTML = results.map(item => renderArchiveItem(item)).join('')
      || `<div style="font-size:12px;color:var(--muted);padding:8px 0">${t('noResults')}</div>`;
  } catch (err) {
    console.warn('[tab-out] Archive search failed:', err);
  }
});


/* ----------------------------------------------------------------
   INITIALIZE
   ---------------------------------------------------------------- */
async function initializeApp() {
  await loadLanguagePreference();
  await loadBackgroundPreference();
  await renderDashboard();
}

initializeApp();
