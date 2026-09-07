import WebSocket from 'ws';
const B='http://localhost:8095', K='?key=k1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const open=(role,key)=>new Promise(res=>{ const ws=new WebSocket('ws://localhost:8095'); const got=[]; ws.on('message',b=>got.push(JSON.parse(b))); ws.on('open',()=>{ if(role) ws.send(JSON.stringify({type:'hello',role,key})); res({ws,got}); }); });
const alive=async()=>{ try{ return (await fetch(B+'/api/status'+K)).status===200; }catch{ return false; } };
// 1. crash paths
console.log('redeem test:', (await fetch(B+'/api/test'+K+'&kind=redeem&user=bob').then(r=>r.json())).ok, 'alive:', await alive());
console.log('settings 30.5 ->', (await fetch(B+'/api/settings'+K,{method:'POST',body:'{"maxCats":30.5}'}).then(r=>r.json())).maxCats);
// 2. role gating + malformed
const ov=await open('overlay','k1'), pl=await open('play'), nohello=await open(null), ad=await open('admin','k1'); await wait(200);
for(const bad of [{type:'event',name:'clearprops'},{type:'chat',user:5,msg:'!x'},{type:'catgone',key:'twitch:x'},{type:'zones',zones:[]},{type:'cat',key:{},look:{}},{type:'state',cats:[]}]) { pl.ws.send(JSON.stringify(bad)); nohello.ws.send(JSON.stringify(bad)); }
ov.ws.send(JSON.stringify({type:'cat',key:{},look:{}})); ov.ws.send(JSON.stringify({type:'chat',user:'x',msg:'!leave'})); ov.ws.send('not json'); ad.ws.send(JSON.stringify({type:'chat',user:{a:1},msg:5}));
await wait(300); console.log('after abuse alive:', await alive(), '| overlay got:', ov.got.map(m=>m.type).join(','), '| admin log:', ad.got.filter(m=>m.type==='log').length);
console.log('status:', await fetch(B+'/api/status'+K).then(r=>r.json()));
// 3. eventsub via mock: auth then count
await fetch(B+'/api/redeems'+K,{method:'POST',body:JSON.stringify({'custom cat':'!cat'})});
console.log('callback', (await fetch(B+'/auth'+K,{redirect:'manual'})).headers.get('location')?.slice(0,60));
