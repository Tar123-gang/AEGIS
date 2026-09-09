(function(root) {
  const DAY = 86400000;
  const localDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const dayNumber = text => { const [y,m,d]=text.split('-').map(Number); return Date.UTC(y,m-1,d)/DAY; };
  function normalizeEvents(events, now=Date.now()) {
    const output=[];
    for(const event of (Array.isArray(events)?events:[]).slice(0,250)) {
      if(!event || typeof event.id!=='string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(event.id)) continue;
      const start=event.startedAt,end=event.endedAt;
      if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>43200000||end>Number(now)+60000||start<Number(now)-90*DAY)continue;
      const domain=String(event.domain||'').toLowerCase().replace(/^www\./,'');
      if(domain.length>253||!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain)||domain.includes('..'))continue;
      let from=start,index=0;
      while(from<end) {
        const d=new Date(from),next=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1).getTime();
        const until=Math.min(end,next);
        output.push({id:`chrome-${event.id}-${index++}`,eventId:event.id,appId:'chrome',origin:'chrome-extension',siteLabel:domain,date:localDate(d),day:dayNumber(localDate(d))-dayNumber(localDate(new Date(now))),start:d.getHours()*60+d.getMinutes()+d.getSeconds()/60+d.getMilliseconds()/60000,minutes:(until-from)/60000,startedAt:from,endedAt:until});
        from=until;
      }
    }
    return output;
  }
  function rebaseState(state,now=Date.now()) {
    const today=localDate(new Date(now)),old=state.anchor||today,shift=dayNumber(old)-dayNumber(today);
    for(const session of state.sessions||[]) {
      if(session.origin==='chrome-extension'&&Number.isFinite(session.startedAt))session.day=dayNumber(localDate(new Date(session.startedAt)))-dayNumber(today);
      else if(shift)session.day+=shift;
    }
    if(shift)for(const focus of state.focusHistory||[])focus.day+=shift;
    state.anchor=today;
    return state;
  }
  function coalesceSessions(existing,incoming,max=1500) {
    const all=[...new Map([...existing,...incoming].filter(s=>s?.origin==='chrome-extension'&&Number.isFinite(s.startedAt)&&Number.isFinite(s.endedAt)).map(s=>[s.id,{...s}])).values()].sort((a,b)=>a.startedAt-b.startedAt);
    const result=[];
    for(const session of all) {
      const previous=result[result.length-1];
      if(previous&&previous.siteLabel===session.siteLabel&&previous.date===session.date&&session.startedAt>=previous.startedAt&&session.startedAt<=previous.endedAt+1) {
        previous.endedAt=Math.max(previous.endedAt,session.endedAt);
        previous.minutes=(previous.endedAt-previous.startedAt)/60000;
      } else result.push(session);
    }
    return result.slice(-max);
  }
  function summarizeSites(sessions) {
    const sites=new Map();
    for(const s of sessions)if(s.origin==='chrome-extension')sites.set(s.siteLabel,(sites.get(s.siteLabel)||0)+s.minutes);
    return [...sites].map(([domain,minutes])=>({domain,minutes})).sort((a,b)=>b.minutes-a.minutes);
  }
  root.AegisChromeUsage={normalizeEvents,rebaseState,coalesceSessions,summarizeSites};
})(typeof window==='undefined'?globalThis:window);
