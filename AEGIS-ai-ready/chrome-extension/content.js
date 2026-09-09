function requestSync() {
  chrome.runtime.sendMessage({ type: 'AEGIS_SYNC_REQUEST' }, response => {
    if (chrome.runtime.lastError || !Array.isArray(response?.events) || !response.events.length) return;
    window.postMessage({ source: 'aegis-chrome-extension', type: 'AEGIS_CHROME_USAGE', events: response.events }, window.location.origin);
  });
}
window.addEventListener('message', event => {
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (data?.source === 'aegis-page' && data.type === 'AEGIS_CHROME_USAGE_ACK') chrome.runtime.sendMessage({ type: 'AEGIS_SYNC_ACK', ids: data.ids || [] });
});
requestSync();
setInterval(requestSync, 60000);
