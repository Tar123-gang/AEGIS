/* Website side of the optional, account-bound Chrome extension. */
window.AegisBrowserSync = (() => {
  const usage = () => window.AegisChromeUsage;
  function combine(documentData) {
    if (!documentData?.state) return null;
    const state = JSON.parse(JSON.stringify(documentData.state));
    state.sessions = [...(state.sessions || []).filter(s => s.origin !== 'chrome-extension'), ...(documentData.chromeSessions || [])];
    usage().rebaseState(state);
    return state;
  }
  function create({accountId, auth, db, getState, onUpdate}) {
    const ref = db.collection('appstate').doc(accountId);
    const controller = {installed:false, connected:false, enabled:false, pending:0, lastSync:null, error:'', accountId:null};
    let disposed = false, importing = false;
    const active = () => !disposed && auth.currentUser?.uid === accountId;
    const post = (type, extra = {}) => {
      if(active()) window.postMessage({source:'aegis-page', type, accountId, ...extra}, location.origin);
    };
    const apply = data => {
      const state = getState();
      state.sessions = [...state.sessions.filter(s => s.origin !== 'chrome-extension'), ...(data.chromeSessions || [])];
      usage().rebaseState(state);
      controller.lastSync = data.chromeUpdatedAt || null;
    };
    async function receive(event) {
      if(!active() || event.source !== window || event.origin !== location.origin) return;
      const data = event.data;
      if(data?.source !== 'aegis-chrome-extension') return;
      if(data.type === 'AEGIS_CHROME_STATUS') {
        controller.installed = true;
        controller.accountId = data.accountId || null;
        controller.connected = data.connected === true && data.accountId === accountId;
        controller.enabled = controller.connected && data.enabled === true;
        controller.pending = Number(data.pending) || 0;
        controller.error = data.error || (data.accountId && data.accountId !== accountId ? 'ACCOUNT_MISMATCH' : '');
        onUpdate();
        return;
      }
      if(data.type !== 'AEGIS_CHROME_USAGE' || data.accountId !== accountId || importing || !Array.isArray(data.events)) return;
      importing = true;
      try {
        const events = data.events.slice(0,250);
        const normalized = usage().normalizeEvents(events);
        const ids = events.filter(e => e && typeof e.id === 'string' && e.id.length <= 128).map(e => e.id);
        const result = await db.runTransaction(async transaction => {
          const snap = await transaction.get(ref);
          const saved = snap.exists ? snap.data() : {};
          const receipts = new Set(saved.chromeReceipts || []);
          const incoming = normalized.filter(s => !receipts.has(s.eventId) && s.startedAt >= (saved.chromeClearedAt || 0));
          ids.forEach(id => receipts.add(id));
          const chromeSessions = usage().coalesceSessions(saved.chromeSessions || [], incoming);
          const update = {chromeSessions, chromeReceipts:[...receipts].slice(-3000), chromeUpdatedAt:Date.now()};
          transaction.set(ref, update, {merge:true});
          return update;
        });
        if(!active()) return;
        apply(result);
        controller.error = '';
        // Never remove the extension's retry queue until Firebase confirms this transaction.
        post('AEGIS_CHROME_USAGE_ACK', {ids});
        onUpdate();
      } catch(error) {
        controller.error = 'Cloud sync failed. Check your connection; the extension keeps its pending data.';
        onUpdate();
      } finally { importing = false; }
    }
    window.addEventListener('message', receive);
    const unsubscribe = ref.onSnapshot(snap => {
      if(!active() || !snap.exists || snap.metadata.hasPendingWrites) return;
      apply(snap.data()); onUpdate();
    }, () => { controller.error = 'Cloud sync unavailable. Check your connection.'; onUpdate(); });
    const timer = setInterval(() => post('AEGIS_CHROME_SYNC'), 30000);
    controller.command = type => post(type);
    controller.sync = () => post('AEGIS_CHROME_SYNC');
    controller.clear = async (todayOnly=false) => {
      const cutoff=new Date();cutoff.setHours(0,0,0,0);
      const result=await db.runTransaction(async transaction=>{
        const snap=await transaction.get(ref),saved=snap.exists?snap.data():{};
        const chromeSessions=todayOnly?(saved.chromeSessions||[]).filter(s=>s.endedAt<=cutoff.getTime()):[];
        const update={chromeSessions,chromeClearedAt:Date.now(),chromeUpdatedAt:Date.now()};
        transaction.set(ref,update,{merge:true});return update;
      });
      apply(result); onUpdate();
    };
    controller.dispose = () => { disposed = true; clearInterval(timer); unsubscribe(); window.removeEventListener('message', receive); };
    post('AEGIS_CHROME_SYNC');
    return controller;
  }
  const escape = value => String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function card(sync) {
    const connected=sync?.connected,installed=sync?.installed;
    const button=(title,action,disabled=false)=>`<button class="btn btn-sm" data-action="${action}" ${disabled?'disabled':''}>${title}</button>`;
    return `<article class="card mb-16" id="chrome-status-panel"><div class="section-header"><div><h2>Chrome website tracking</h2><p>Website domains and active browsing time.</p></div><span class="pill ${connected?'pill-green':'pill-outline'}">${connected?(sync.enabled?'RECORDING':'PAUSED'):installed?'READY TO CONNECT':'EXTENSION NEEDED'}</span></div>
      <p class="text-sm muted">Install the extension in Chrome on your computer, then connect this account. It records the foreground website and pauses when Chrome loses focus or the computer is idle for 60 seconds. Domains and times sync to your Firebase account and can be seen by a linked guardian.</p>
      <p class="text-sm muted mt-12">AEGIS can be closed while recording. Reopen it and log in to sync. Incognito, page content, search text, and other desktop apps are excluded.</p>
      ${sync?.error?`<p class="text-sm negative mt-12">${escape(sync.error==='ACCOUNT_MISMATCH'?'The extension belongs to another account. Disconnect in the extension popup before connecting this account.':sync.error)}</p>`:''}
      <div class="flex wrap gap-8 mt-16">${!installed?'<a class="btn btn-primary btn-sm" href="/aegis-chrome-extension.zip" download>Download extension</a>':''}
      ${connected?button(sync.enabled?'Pause recording':'Resume recording',sync.enabled?'chrome-pause':'chrome-resume'):button('Connect Chrome','chrome-connect',!installed)}
      ${connected?button('Sync now','chrome-sync'):''}${button('Installation steps','chrome-help')}${connected?button('Disconnect','chrome-disconnect'):''}</div>
      <p class="text-sm faint mt-12">${connected?`${sync.pending} pending chunks · `:''}${sync?.lastSync?'Last cloud sync: '+escape(new Date(sync.lastSync).toLocaleString()):'No browser activity synced yet.'}</p></article>`;
  }
  function installation() {
    return `<ol class="modal-copy"><li>Download the ZIP below and extract it into a permanent folder.</li><li>Open <strong>chrome://extensions</strong> in Chrome on your computer.</li><li>Enable <strong>Developer mode</strong> and click <strong>Load unpacked</strong>.</li><li>Select the extracted <strong>chrome-extension</strong> folder that contains <strong>manifest.json</strong>.</li><li>Reload AEGIS, log in, and click <strong>Settings → Connect Chrome</strong>.</li><li>Use a website for about one minute, return to AEGIS, then click <strong>Sync now</strong>. Open <strong>App Activity</strong> to see the result.</li></ol><p class="modal-copy mt-12">This version works in desktop Chrome. Installing AEGIS as a phone website does not enable tracking.</p><div class="modal-actions"><a class="btn btn-primary" href="/aegis-chrome-extension.zip" download>Download extension ZIP</a><button class="btn" data-action="close-modal">Close</button></div>`;
  }
  return {create, combine, card, installation};
})();
