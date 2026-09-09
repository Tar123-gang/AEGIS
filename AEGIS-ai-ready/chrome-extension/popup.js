let current;
async function request(type) {
  const response = await chrome.runtime.sendMessage({ type });
  current = response.status || {};
  document.getElementById('status').textContent = current.error === 'QUEUE_FULL'
    ? 'Storage is full. Open AEGIS to sync, then resume.'
    : !current.connected ? 'Not connected. Log in to AEGIS and connect in Settings.'
    : current.enabled ? 'Tracking is on.' : 'Tracking is paused.';
  document.getElementById('pending').textContent = (current.pending || 0) + ' intervals waiting to sync.';
  document.getElementById('toggle').hidden = !current.connected;
  document.getElementById('toggle').textContent = current.enabled ? 'Pause tracking' : 'Resume tracking';
  document.getElementById('disconnect').hidden = !current.connected;
}
document.getElementById('toggle').addEventListener('click', () => request(current.enabled ? 'AEGIS_PAUSE' : 'AEGIS_RESUME'));
document.getElementById('disconnect').addEventListener('click', () => {
  if (confirm('Disconnect this account and delete unsynced data from this browser? Saved AEGIS data will stay.')) request('AEGIS_DISCONNECT');
});
request('AEGIS_STATUS');
