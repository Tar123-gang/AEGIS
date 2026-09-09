const STATE_KEY = 'aegisChromeActivityState';
const SITE_ORIGIN = 'https://aegis-project-team.netlify.app';
const MAX_QUEUE = 5000;
const MAX_GAP_MS = 90000;
const IDLE_SECONDS = 60;
let work = Promise.resolve();

// All browser events and messages share one queue so a tab switch cannot race a sync.
function serial(task) {
  const result = work.then(task);
  work = result.catch(error => console.error('AEGIS activity:', error.message));
  return result;
}

async function getState() {
  const saved = (await chrome.storage.local.get(STATE_KEY))[STATE_KEY];
  // Never assign unbound activity from the old extension to an account.
  return saved?.version === 2 ? saved : {
    version: 2, accountId: '', enabled: false, current: null, queue: [], error: ''
  };
}

async function putState(state) {
  await chrome.storage.local.set({ [STATE_KEY]: state });
}

function domainOf(tab) {
  if (!tab || tab.incognito) return '';
  try {
    const url = new URL(tab.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin === SITE_ORIGIN) return '';
    return url.hostname.toLowerCase().replace(/^www\./, '');
  } catch { return ''; }
}

async function activeTab() {
  if (await chrome.idle.queryState(IDLE_SECONDS) !== 'active') return null;
  const win = await chrome.windows.getLastFocused().catch(() => null);
  if (!win?.focused || win.incognito || win.type !== 'normal') return null;
  const tabs = await chrome.tabs.query({ active: true, windowId: win.id }).catch(() => []);
  return tabs[0] || null;
}

function checkpoint(state, now) {
  const current = state.current;
  state.current = null;
  if (!current || !state.enabled || !state.accountId) return;
  const elapsed = now - current.startedAt;
  // Sleep delays alarms. Discard an unverified gap instead of counting sleep.
  if (elapsed <= 0 || elapsed > MAX_GAP_MS) return;
  if (state.queue.length >= MAX_QUEUE) {
    state.enabled = false;
    state.error = 'QUEUE_FULL';
    return;
  }
  state.queue.push({ id: crypto.randomUUID(), domain: current.domain,
    startedAt: current.startedAt, endedAt: now });
}

async function reconcile(state, now = Date.now()) {
  checkpoint(state, now);
  if (state.enabled && state.accountId) {
    const tab = await activeTab();
    const domain = domainOf(tab);
    if (domain) state.current = { tabId: tab.id, domain, startedAt: now };
  }
  await putState(state);
  return state;
}

function status(state, extra = {}) {
  return { version: '1.1.0', accountId: state.accountId, connected: !!state.accountId,
    enabled: state.enabled, pending: state.queue.length, error: state.error || '', ...extra };
}

function trustedSender(sender) {
  if (sender.id !== chrome.runtime.id || sender.tab?.incognito) return false;
  try {
    return sender.tab ? sender.frameId === 0 && new URL(sender.url).origin === SITE_ORIGIN
      : sender.url === chrome.runtime.getURL('popup.html');
  } catch { return false; }
}

function validAccount(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\x00-\x20]/.test(value);
}

async function handleMessage(message, sender) {
  if (!trustedSender(sender)) return { error: 'UNTRUSTED_SOURCE' };
  const state = await getState();
  const popup = !sender.tab;
  if (message.type === 'AEGIS_STATUS') return { status: status(state) };
  if (message.type === 'AEGIS_SYNC' && !state.accountId) return { status: status(state) };
  const accountId = popup ? state.accountId : message.accountId;
  if (!validAccount(accountId)) return { status: status(state, { error: 'LOGIN_REQUIRED' }) };
  if (message.type === 'AEGIS_CONNECT') {
    if (popup) return { status: status(state, { error: 'CONNECT_FROM_AEGIS' }) };
    if (state.accountId && state.accountId !== accountId) {
      return { status: status(state, { error: 'ACCOUNT_MISMATCH' }) };
    }
    state.accountId = accountId;
    state.enabled = true;
    state.error = '';
    await reconcile(state);
    return { status: status(state), accountId, events: state.queue.slice(0, 100) };
  }
  if (state.accountId !== accountId) return { status: status(state, { error: 'ACCOUNT_MISMATCH' }) };
  if (message.type === 'AEGIS_SYNC') {
    await reconcile(state);
    return { status: status(state), accountId, events: state.queue.slice(0, 100) };
  }
  if (message.type === 'AEGIS_ACK') {
    const ids = new Set(Array.isArray(message.ids) ? message.ids.slice(0, 100) : []);
    state.queue = state.queue.filter(event => !ids.has(event.id));
    if (state.error === 'QUEUE_FULL') state.error = '';
    await putState(state);
    return { status: status(state), accountId, events: state.queue.slice(0, 100) };
  }
  if (message.type === 'AEGIS_PAUSE') {
    checkpoint(state, Date.now());
    state.enabled = false;
    await putState(state);
  } else if (message.type === 'AEGIS_RESUME') {
    state.enabled = true;
    state.error = '';
    await reconcile(state);
  } else if (message.type === 'AEGIS_DISCONNECT') {
    state.accountId = '';
    state.enabled = false;
    state.current = null;
    state.queue = [];
    state.error = '';
    await putState(state);
  }
  return { status: status(state) };
}

function updateTracking() { return serial(async () => reconcile(await getState())); }
chrome.tabs.onActivated.addListener(updateTracking);
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => { if (changeInfo.url) updateTracking(); });
chrome.tabs.onRemoved.addListener(updateTracking);
chrome.windows.onFocusChanged.addListener(updateTracking);
chrome.idle.onStateChanged.addListener(updateTracking);
chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'aegis-heartbeat') updateTracking(); });
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type?.startsWith('AEGIS_')) return false;
  serial(() => handleMessage(message, sender)).then(sendResponse,
    () => sendResponse({ status: { error: 'STORAGE_ERROR' } }));
  return true;
});

async function initialize(resetCurrent = false) {
  chrome.idle.setDetectionInterval(IDLE_SECONDS);
  if (!await chrome.alarms.get('aegis-heartbeat')) {
    await chrome.alarms.create('aegis-heartbeat', { periodInMinutes: 0.5 });
  }
  const state = await getState();
  if (resetCurrent) state.current = null;
  await reconcile(state);
}
chrome.runtime.onInstalled.addListener(() => serial(() => initialize(true)));
chrome.runtime.onStartup.addListener(() => serial(() => initialize(true)));
serial(() => initialize());
