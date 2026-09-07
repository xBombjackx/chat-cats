// websocket link to server/. Loads after cats.js and takes over `net.send`.
// ?ws=ws://host:port overrides the target (handy when serving the overlay from somewhere else).
(()=>{
  const url = q.get('ws') || (location.protocol==='https:'?'wss://':'ws://')+location.host;
  let ws=null, retry=1000;
  function connect(){
    ws=new WebSocket(url);
    ws.onopen=()=>{ retry=1000; ws.send(JSON.stringify({type:'hello',role:'overlay'})); logLine('server','','connected'); };
    ws.onclose=()=>{ ws=null; setTimeout(connect, retry); retry=Math.min(retry*2, 10000); };
    ws.onerror=()=>ws?.close();
    ws.onmessage=e=>{ let m; try{ m=JSON.parse(e.data); }catch{ return; }
      if(m.type==='init') applyInit(m);
      else if(m.type==='chat') handleChat(m.user, m.msg, m.key);
      else if(m.type==='event' && events[m.name]) events[m.name]();
    };
  }
  net.send=o=>{ if(ws&&ws.readyState===1) ws.send(JSON.stringify(o)); };
  if(q.get('ws')!=='0') connect();
})();
