// websocket link to server/. Loads after cats.js and takes over `net.send`.
// ?ws=ws://host:port overrides the target (handy when serving the overlay from somewhere else).
(()=>{
  const url = q.get('ws') || (location.protocol==='https:'?'wss://':'ws://')+location.host;
  let ws=null, retry=1000, denied=false;
  function connect(){
    ws=new WebSocket(url);
    ws.onopen=()=>{ retry=1000; lastState=''; ws.send(JSON.stringify({type:'hello',role:PLAY?'play':'overlay',key:q.get('key')||''})); logLine('server','','connected'); };
    ws.onclose=()=>{ ws=null; if(denied) return; setTimeout(connect, retry); retry=Math.min(retry*2, 10000); };
    ws.onerror=()=>ws?.close();
    ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch{ return; }
      if(m.type==='denied'){ logLine('server','','denied — add ?key=<ADMIN_KEY> to the overlay URL'); denied=true; return; }
      if(m.type==='init') applyInit(m);
      else if(PLAY){   // companion: mirror state, visual-only events
        if(m.type==='state') applyState(m);
        else if(m.type==='event' && (m.name==='fish'||m.name==='laser')) events[m.name](m);
        else if(m.type==='banner') banner(m.text,m.ms);
        else if(m.type==='full'){ const h=document.getElementById('playhint'); if(h) h.textContent='room is full, try again later'; }
      }
      else if(m.type==='chat') handleChat(m.user, m.msg, m.key);
      else if(m.type==='event' && events[m.name]) events[m.name](m);
      else if(m.type==='twitch') handleTwitch(m);
      else if(m.type==='cooldown'){ const c=cats.get(m.key); if(c) c.say('⏳'); }
      else if(m.type==='config'){ if(m.maxCats) MAX_CATS=m.maxCats; }
      else if(m.type==='watchers') watchers=m.n;
      else if(m.type==='poke') handlePoke(m.x,m.z);
    };
  }
  net.send=o=>{ if(ws&&ws.readyState===1) ws.send(JSON.stringify(o)); };
  if(q.get('ws')!=='0') connect();
})();
