(() => {
  if (window.top !== window) return;
  let pageAccountId = '';
  const types = {
    AEGIS_CHROME_CONNECT: 'AEGIS_CONNECT', AEGIS_CHROME_SYNC: 'AEGIS_SYNC',
    AEGIS_CHROME_USAGE_ACK: 'AEGIS_ACK', AEGIS_CHROME_PAUSE: 'AEGIS_PAUSE',
    AEGIS_CHROME_RESUME: 'AEGIS_RESUME', AEGIS_CHROME_DISCONNECT: 'AEGIS_DISCONNECT'
  };
  function post(type, data) {
    window.postMessage({ source: 'aegis-chrome-extension', type, ...data }, window.location.origin);
  }
  function send(type, data = {}) {
    chrome.runtime.sendMessage({ type, ...data }, response => {
      if (chrome.runtime.lastError) return;
      if (response?.status) post('AEGIS_CHROME_STATUS', response.status);
      if (response?.accountId === pageAccountId && response.events?.length) {
        post('AEGIS_CHROME_USAGE', { accountId: response.accountId, events: response.events });
      }
    });
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data;
    if (data?.source !== 'aegis-page') return;
    if (data.type === 'AEGIS_CHROME_READY') { send('AEGIS_STATUS'); return; }
    if (!types[data.type]) return;
    if (typeof data.accountId !== 'string' || !data.accountId) return;
    pageAccountId = data.accountId;
    send(types[data.type], { accountId: data.accountId, ids: data.ids });
    if (data.type === 'AEGIS_CHROME_DISCONNECT' || data.type === 'AEGIS_CHROME_PAUSE') pageAccountId = '';
  });
  send('AEGIS_STATUS');
  setInterval(() => { if (pageAccountId) send('AEGIS_SYNC', { accountId: pageAccountId }); }, 30000);
})();
