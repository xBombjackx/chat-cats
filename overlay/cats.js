// ---------- scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 9, 27); camera.lookAt(0, 0, -2.5);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5a7a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(5, 10, 6); scene.add(sun);
const XMAX = 11; let ZMIN = -7, ZMAX = 3;   // depth: ZMIN is far, ZMAX is near the viewer
function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- helpers ----------
const COLORS = {orange:0xf28c38, ginger:0xf28c38, black:0x2b2b33, white:0xf5f1ea, gray:0x8e8e96, grey:0x8e8e96,
  pink:0xf5a3c7, brown:0x7a4b2a, cream:0xf1dfb8, blue:0x7aa6d9, purple:0xa98bd6, mint:0x9fd6b5, tortie:0x6b3a1e};
const EYES = {green:0x5fd36a, blue:0x5aa9ff, yellow:0xffd54a, amber:0xffa62b, pink:0xff7bd1, red:0xff5252, gold:0xffd54a};
const HATS = ['none','crown','beanie','party','bow','halo'];
const PATTERNS = ['solid','tabby','tuxedo','calico'];
const pick = a => a[Math.floor(Math.random()*a.length)];
const rnd = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
function mat(c){ return new THREE.MeshLambertMaterial({color:c}); }
function box(g,w,h,d,c,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c)); m.position.set(x,y,z); g.add(m); return m; }
function darken(c,f){ const k=new THREE.Color(c); k.multiplyScalar(f); return k.getHex(); }
function parseColor(s, table){ if(table[s]!=null) return table[s]; if(/^#?[0-9a-f]{6}$/i.test(s)) return parseInt(s.replace('#',''),16); return null; }

// ---------- cat ----------
class Cat {
  constructor(name, look){
    this.name = name;
    this.look = Object.assign({body:'orange', eyes:'green', pattern:'solid', hat:'none'}, look);
    this.g = new THREE.Group();
    this.g.position.set(rnd(-XMAX,XMAX), 0, rnd(ZMIN,ZMAX));
    scene.add(this.g);
    this.facing = Math.random()<0.5?0:Math.PI;
    this.build();
    this.state = 'idle'; this.t = 0; this.timer = rnd(1,3); this.target = null; this.speed = 2.2;
    this.jumpT = -1; this.spinT = -1; this.waveT = -1; this.anim = null; this.noCollide = false; this.prop = null; this.bubbleEl = null; this.dead = false;
    this.tag = document.createElement('div'); this.tag.className='tag'; this.tag.textContent=name; labels.appendChild(this.tag);
  }
  build(){
    while(this.g.children.length) this.g.remove(this.g.children[0]);
    const L = this.look, c = parseColor(L.body,COLORS) ?? COLORS.orange, e = parseColor(L.eyes,EYES) ?? EYES.green;
    const g = this.g, dark = darken(c, 0.72), white=0xf5f1ea;
    this.body = new THREE.Group(); g.add(this.body);
    const b = this.body; b.scale.setScalar(0.72);   // chibi + small
    box(b,1.1,0.75,0.8,c,0,0.7,0);                       // stubby torso
    const head = box(b,1.35,1.2,1.25,c,0.55,1.55,0);     // big head
    // ears: short, wide, pink inside
    this.ears=[ box(b,0.45,0.42,0.22,c,0.3,2.3,-0.42), box(b,0.45,0.42,0.22,c,0.3,2.3,0.42) ];
    box(b,0.25,0.24,0.16,0xffb3c6,0.35,2.27,-0.42); box(b,0.25,0.24,0.16,0xffb3c6,0.35,2.27,0.42);
    // big eyes with highlight
    this.eyes=[]; for(const z of [-0.33,0.33]){ const eg=new THREE.Group(); eg.position.set(1.23,1.6,z); b.add(eg);
      box(eg,0.08,0.4,0.36,e,0,0,0); box(eg,0.1,0.14,0.12,0x111111,0.01,-0.02,0.03); box(eg,0.12,0.1,0.08,0xffffff,0.02,0.1,-0.08); this.eyes.push(eg); }
    box(b,0.1,0.1,0.16,0xff8fa3,1.23,1.3,0);              // nose
    box(b,0.06,0.06,0.16,0x7a4b2a,1.23,1.2,-0.1); box(b,0.06,0.06,0.16,0x7a4b2a,1.23,1.2,0.1); // w mouth
    box(b,0.06,0.16,0.28,0xffa0b8,1.23,1.28,-0.5); box(b,0.06,0.16,0.28,0xffa0b8,1.23,1.28,0.5); // blush
    box(b,0.06,0.04,0.42,0xffffff,1.24,1.32,0.5); box(b,0.06,0.04,0.42,0xffffff,1.24,1.32,-0.5);   // whiskers
    if(L.pattern==='tuxedo'){ box(b,0.2,0.4,0.45,white,0.5,0.6,0); box(b,0.1,0.5,0.55,white,1.22,1.15,0); }
    if(L.pattern==='tabby'){ for(let i=0;i<2;i++) box(b,0.16,0.12,0.85,dark,-0.35+i*0.4,1.1,0); box(b,0.55,0.12,0.6,dark,0.55,2.17,0); box(b,0.16,0.14,0.3,dark,0.55,2.16,-0.5); box(b,0.16,0.14,0.3,dark,0.55,2.16,0.5); }
    if(L.pattern==='calico'){ box(b,0.5,0.35,0.85,0xf28c38,-0.25,0.95,0); box(b,0.6,0.5,0.55,0x2b2b33,0.45,2.0,-0.45); box(b,0.4,0.3,0.3,0xf28c38,0.9,1.9,0.6); }
    // stubby legs (pivot at top)
    this.legs=[]; const lp=[[0.35,-0.25],[0.35,0.25],[-0.35,-0.25],[-0.35,0.25]];
    for(const [x,z] of lp){ const p=new THREE.Group(); p.position.set(x,0.4,z); box(p,0.32,0.4,0.32,c,0,-0.2,0); box(p,0.33,0.12,0.34,L.pattern==='tuxedo'?white:c,0,-0.35,0); b.add(p); this.legs.push(p); }
    // little tail
    this.tail = new THREE.Group(); this.tail.position.set(-0.55,0.85,0); box(this.tail,0.22,0.7,0.22,c,-0.05,0.3,0); box(this.tail,0.24,0.24,0.24,L.pattern==='tabby'?dark:c,-0.05,0.72,0);
    this.tail.rotation.z = 0.6; b.add(this.tail);
    // hat
    const h=new THREE.Group(); h.position.set(0.55,2.15,0); b.add(h);
    if(L.hat==='crown'){ box(h,0.8,0.2,0.8,0xffd23f,0,0.1,0); for(const [x,z] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]) box(h,0.18,0.3,0.18,0xffd23f,x,0.3,z); box(h,0.16,0.16,0.16,0xff4d6d,0.42,0.2,0); }
    if(L.hat==='beanie'){ box(h,1.2,0.35,1.15,0x6c8ed6,0,0.15,0); box(h,0.9,0.28,0.85,0x6c8ed6,0,0.45,0); box(h,0.32,0.32,0.32,white,0,0.72,0); }
    if(L.hat==='party'){ const cone=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.8,6),mat(0xff7bd1)); cone.position.set(0.15,0.42,0.25); cone.rotation.z=-0.2; h.add(cone); box(h,0.2,0.2,0.2,0xffd23f,0.22,0.87,0.25); }
    if(L.hat==='bow'){ box(h,0.3,0.28,0.3,0xff4d6d,0.1,0.1,0.5); box(h,0.28,0.4,0.28,0xff4d6d,-0.14,0.12,0.5); box(h,0.28,0.4,0.28,0xff4d6d,0.34,0.12,0.5); }
    if(L.hat==='halo'){ const r=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.07,8,24),new THREE.MeshLambertMaterial({color:0xffe28a,emissive:0x8a6a00})); r.rotation.x=Math.PI/2; r.position.y=0.55; h.add(r); }
    // shadow blob
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85,20), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.22}));
    this.shadow.rotation.x=-Math.PI/2; this.shadow.position.y=0.01; g.add(this.shadow);
    this.g.rotation.y = this.facing;
  }
  say(text, cls=''){ if(this.bubbleEl) this.bubbleEl.remove(); const d=document.createElement('div'); d.className='bubble '+cls; d.textContent=text; labels.appendChild(d); this.bubbleEl=d; clearTimeout(this.bt); this.bt=setTimeout(()=>{d.remove(); if(this.bubbleEl===d) this.bubbleEl=null;}, cls==='pow'?600:2600); }
  releaseProp(){ if(this.prop){ this.prop.users--; this.prop=null; } }
  walkTo(x,z,speed,keep){ if(!keep) this.releaseProp(); this.target={x:clamp(x,-XMAX,XMAX), z:clamp(z,ZMIN,ZMAX)}; this.speed=speed||2.2; this.setState('walk'); }
  setState(s){ this.state=s; this.t=0; }
  // one-shot actions
  jump(){ if(this.jumpT<0) this.jumpT=0; }
  play(name,dur){ if(!PROP_ANIMS.includes(name)) this.releaseProp(); this.target=null; if(this.state!=='idle') this.setState('idle'); this.timer=dur+1; this.anim={name,dur,t:0}; }
  spin(){ this.spinT=0; }
  wave(){ this.waveT=0; this.setState('idle'); this.timer=2; }
  update(dt, now){
    this.t += dt;
    const g=this.g, b=this.body, s=this.state;
    // eye blink
    const blink = (Math.sin(now*1.3+this.g.position.x*3)>0.985)||s==='sleep';
    for(const e of this.eyes) e.scale.y = blink?0.15:1;
    // tail idle wag
    this.tail.rotation.z = 0.5 + Math.sin(now*3+this.g.position.x)*0.25;
    this.tail.rotation.x = Math.sin(now*2.2)*0.3;
    // lying states
    const lying = s==='loaf'||s==='sleep';
    b.position.y = lying ? -0.3 : 0;
    for(const l of this.legs) l.visible = !lying;

    if(s==='walk' && this.target){
      const dx=this.target.x-g.position.x, dz=this.target.z-g.position.z, d=Math.hypot(dx,dz);
      if(d<0.15){ this.target=null; this.setState('idle'); this.timer=rnd(1.5,4); if(this.onArrive){const f=this.onArrive;this.onArrive=null;f();} }
      else { let vx=dx/d, vz=dz/d;   // steer around other cats and props
        for(const o of cats.values()){ if(o===this||o.noCollide) continue; const ox=g.position.x-o.g.position.x, oz=g.position.z-o.g.position.z, od=Math.hypot(ox,oz); if(od<2.2&&od>1e-3){ const w=(1-od/2.2)*1.7; vx+=ox/od*w; vz+=oz/od*w; } }
        for(const p of props){ if(p===this.prop||p.type==='toy') continue; const ox=g.position.x-p.x, oz=g.position.z-p.z, od=Math.hypot(ox,oz), rr=p.r+1.0; if(od<rr&&od>1e-3){ const w=(1-od/rr)*2.4; vx+=ox/od*w; vz+=oz/od*w; } }
        const vl=Math.hypot(vx,vz)||1; vx/=vl; vz/=vl;
        const st=Math.min(d,this.speed*dt); g.position.x=clamp(g.position.x+vx*st,-XMAX,XMAX); g.position.z=clamp(g.position.z+vz*st,ZMIN,ZMAX); this.facing=Math.atan2(-vz,vx);
        for(let i=0;i<4;i++) this.legs[i].rotation.z = Math.sin(now*this.speed*4 + (i%2?Math.PI:0) + (i>1?Math.PI/2:0))*0.6;
        b.position.y = Math.abs(Math.sin(now*this.speed*4))*0.06; }
    } else {
      for(const l of this.legs) l.rotation.z *= 0.8;
      if(s==='idle'){ this.timer-=dt; if(this.timer<=0) this.pickIdle(); }
      if(s==='sit'){ b.rotation.z = -0.28; b.position.y=0.1; b.children[1].rotation.x = Math.sin(now*0.8)*0.12; this.timer-=dt; if(this.timer<=0){ this.setState('idle'); this.timer=1; } }
      else if(!lying) b.rotation.z *= 0.8;
      if(s==='loaf'){ this.timer-=dt; if(this.timer<=0){ this.setState('idle'); this.timer=1; } }
      if(s==='sleep'){ this.timer-=dt; if(Math.floor(this.t)!==Math.floor(this.t-dt) && Math.floor(this.t)%2===0) this.say('z'.repeat(1+Math.floor(this.t)%3)); if(this.timer<=0){ this.setState('idle'); this.play('stretch',1.5); } }
      if(s==='groom'){ b.children[1].rotation.z = Math.sin(now*10)*0.2; b.children[1].position.y=1.55+Math.abs(Math.sin(now*10))*0.08; this.timer-=dt; if(this.timer<=0){ b.children[1].rotation.z=0; b.children[1].position.y=1.55; this.setState('idle'); this.timer=2; } }
    }
    // facing (smooth turn)
    const ry = this.facing; let dr=((ry-g.rotation.y+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI; g.rotation.y += dr*Math.min(1,dt*10);
    // jump
    if(this.jumpT>=0){ this.jumpT+=dt*1.8; const p=this.jumpT; if(p>=1){this.jumpT=-1; g.position.y=0; this.shadow.scale.setScalar(1);} else { g.position.y=Math.sin(p*Math.PI)*1.3; const sc=1-Math.sin(p*Math.PI)*0.4; this.shadow.scale.setScalar(sc); } }
    // spin
    if(this.spinT>=0){ this.spinT+=dt; g.rotation.y += dt*14; if(this.spinT>0.7){ this.spinT=-1; } }
    // wave (front-left leg)
    if(this.waveT>=0){ this.waveT+=dt; this.legs[0].rotation.z = -2.2 + Math.sin(this.waveT*14)*0.5; if(this.waveT>1.5) this.waveT=-1; }
    // one-shot animations
    if(this.anim){ const A=this.anim; A.t+=dt; const p=Math.min(1,A.t/A.dur), s1=Math.sin(p*Math.PI);
      switch(A.name){
        case 'stretch': this.legs[0].rotation.z=this.legs[1].rotation.z=-1.3*s1; b.rotation.z=-0.38*s1; b.position.y=-0.1*s1; this.tail.rotation.z=0.6+1.1*s1; break;
        case 'roll': b.rotation.x=p*Math.PI*2; b.position.y=0.35*s1; break;
        case 'pounce': if(p<0.4){ const q=p/0.4; b.position.y=-0.22*q; b.rotation.z=0.18*q; this.tail.rotation.x=Math.sin(A.t*30)*0.4; }
                       else { const q=(p-0.4)/0.6; g.position.y=Math.sin(q*Math.PI)*0.9; g.position.x=clamp(g.position.x+Math.cos(this.facing)*dt*4.5,-XMAX,XMAX); g.position.z=clamp(g.position.z-Math.sin(this.facing)*dt*4.5,ZMIN,ZMAX); b.rotation.z=-0.25*Math.sin(q*Math.PI); this.legs[0].rotation.z=this.legs[1].rotation.z=-1.0*Math.sin(q*Math.PI); } break;
        case 'arch': b.scale.y=0.72*(1+0.32*s1); b.position.y=0.04*s1; this.tail.rotation.z=0.6-0.75*s1; for(const e of this.eyes) e.scale.setScalar(1+0.4*s1); break;
        case 'shake': b.rotation.x=Math.sin(A.t*40)*0.28*(1-p); this.ears[0].rotation.x=this.ears[1].rotation.x=-b.rotation.x*1.5; break;
        case 'nuzzle': b.rotation.z=-0.35*Math.abs(Math.sin(A.t*5))*(1-p*0.5); b.position.y=-0.06*s1; break;
        case 'twitch': this.ears[p<0.5?0:1].rotation.x=Math.sin(A.t*35)*0.35*(1-p); break;
        case 'peek': b.children[1].rotation.z=0.25*s1; break;
        case 'eat': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)), hd=b.children[1]; hd.position.y=1.55-0.42*env-0.05*Math.abs(Math.sin(A.t*8))*env; hd.rotation.z=-0.35*env; this.tail.rotation.z=0.6+0.6*env; break; }
        case 'drink': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)), hd=b.children[1]; hd.position.y=1.55-0.4*env-0.03*Math.abs(Math.sin(A.t*16))*env; hd.rotation.z=-0.3*env; break; }
        case 'scratch': { const env=Math.max(0,Math.min(1,p*4,(1-p)*4)); b.rotation.z=0.8*env; b.position.y=0.32*env; this.legs[0].rotation.z=(-1.7+Math.sin(A.t*14)*0.4)*env; this.legs[1].rotation.z=(-1.7-Math.sin(A.t*14)*0.4)*env; break; }
        case 'bat': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)); this.legs[0].rotation.z=-1.3*Math.abs(Math.sin(A.t*10))*env; b.rotation.z=-0.1*env; break; }
      }
      if(p>=1){ this.anim=null; b.rotation.x=0; b.rotation.z=0; b.scale.setScalar(0.72); b.position.y=0; g.position.y=0; this.tail.rotation.x=0; this.legs[0].rotation.z=this.legs[1].rotation.z=0; this.ears[0].rotation.x=this.ears[1].rotation.x=0; b.children[1].rotation.z=0; b.children[1].position.y=1.55; for(const e of this.eyes) e.scale.setScalar(1); this.releaseProp(); }
    }
    // labels
    const v=new THREE.Vector3(g.position.x, g.position.y+ (lying?1.5:2.05), g.position.z).project(camera);
    const sx=(v.x+1)/2*innerWidth, sy=(1-v.y)/2*innerHeight;
    this.tag.style.left=sx+'px'; this.tag.style.top=sy+'px';
    if(this.bubbleEl){ this.bubbleEl.style.left=sx+'px'; this.bubbleEl.style.top=(sy-18)+'px'; }
  }
  goTo(p){
    p.users++; this.prop=p;
    const dx=this.g.position.x-p.x, dz=this.g.position.z-p.z, d=Math.hypot(dx,dz)||1;
    this.walkTo(p.x+dx/d*(p.r+0.6), p.z+dz/d*(p.r+0.6), 2.4, true);
    this.onArrive=()=>{ if(this.prop!==p) return; this.facing=Math.atan2(-(p.z-this.g.position.z), p.x-this.g.position.x);
      if(p.type==='bowl'){ if(p.amount<=0){ this.say('empty…'); this.releaseProp(); return; } p.amount--; propVisual(p); this.play('eat',4); this.say(pick(['nom nom','crunch','😋'])); }
      else if(p.type==='water'){ if(p.amount<=0){ this.say('dry…'); this.releaseProp(); return; } p.amount--; propVisual(p); this.play('drink',3); this.say('lap lap'); }
      else if(p.type==='post'){ this.play('scratch',3); this.say(pick(['scritch scritch','scrrrrt'])); }
      else if(p.type==='toy'){ this.play('bat',1.0); setTimeout(()=>{ if(p.mesh.parent){ p.vx=Math.cos(this.facing)*6; p.vz=-Math.sin(this.facing)*6; } },350); if(Math.random()<0.5) this.say('!'); }
    };
  }
  pickIdle(){
    if(props.length && Math.random()<0.4){ const cands=props.filter(p=>p.users<(p.type==='toy'?3:1) && (p.amount==null||p.amount>0)); if(cands.length){ this.goTo(pick(cands)); return; } }
    const r=Math.random();
    if(r<0.45) this.walkTo(this.g.position.x+rnd(-5,5), this.g.position.z+rnd(-4,4));
    else if(r<0.65){ this.setState('sit'); this.timer=rnd(2,5); }
    else if(r<0.8){ this.setState('groom'); this.timer=rnd(1,2); }
    else if(r<0.88){ this.setState('loaf'); this.timer=rnd(3,6); }
    else if(r<0.91){ this.setState('sleep'); this.timer=rnd(5,9); }
    else if(r<0.93) this.play('stretch',1.5);
    else if(r<0.95) this.play('twitch',0.8);
    else if(r<0.97) this.play('shake',0.7);
    else if(r<0.985){ this.facing=-Math.PI/2; this.timer=rnd(2,4); this.play('peek',2.5); }   // look at the viewer
    else { this.facing += Math.PI; this.timer=rnd(1,3); }
  }
  remove(){ this.dead=true; scene.remove(this.g); this.tag.remove(); if(this.bubbleEl) this.bubbleEl.remove(); }
}

// ---------- registry + commands ----------
const cats = new Map();
const labels = document.getElementById('labels');
const log = document.getElementById('log');
function logLine(user, msg, note){ const d=document.createElement('div'); d.innerHTML=`<b>${user}</b>: ${msg}${note?` <span style="opacity:.6">— ${note}</span>`:''}`; log.prepend(d); while(log.children.length>30) log.lastChild.remove(); }

function handleChat(user, msg){
  msg = msg.trim(); if(!msg.startsWith('!')) return;
  const parts = msg.slice(1).toLowerCase().split(/\s+/); const cmd = parts.shift(); let note='';
  let cat = cats.get(user);
  if(cmd==='cat'){
    const look = cat ? {...cat.look} : {};
    for(let i=0;i<parts.length;i++){ const p=parts[i];
      if(p==='eyes' && parts[i+1]){ look.eyes=parts[++i]; continue; }
      if(HATS.includes(p)) look.hat=p; else if(PATTERNS.includes(p)) look.pattern=p; else if(parseColor(p,COLORS)!=null) look.body=p; }
    if(!cat){ cat=new Cat(user, look); cats.set(user,cat); cat.say('hi!'); note='spawned'; }
    else { cat.look=look; cat.build(); cat.jump(); note='updated'; }
  } else if(!cat){ note='no cat yet — use !cat'; }
  else if(cmd==='meow') cat.say(pick(['meow','mrrp','meow~','MEOW','mrow?','prrr']));
  else if(cmd==='jump') cat.jump();
  else if(cmd==='spin') cat.spin();
  else if(cmd==='sleep'){ cat.setState('sleep'); cat.timer=8; }
  else if(cmd==='loaf'){ cat.setState('loaf'); cat.timer=8; }
  else if(cmd==='wave') cat.wave();
  else if(cmd==='zoomies') zoomies(cat, 6);
  else if(cmd==='leave'){ cat.say('bye'); setTimeout(()=>{cat.remove(); cats.delete(user);}, 900); }
  else if(cmd==='stretch') cat.play('stretch',1.5);
  else if(cmd==='roll') cat.play('roll',1.2);
  else if(cmd==='pounce') cat.play('pounce',1.0);
  else if(cmd==='hiss'){ cat.play('arch',1.3); cat.say(pick(['hsss','HISS','>:3'])); }
  else if(cmd==='shake') cat.play('shake',0.7);
  else if(cmd==='pet'||cmd==='boop'||cmd==='hug'){
    const who=(parts[0]||'').replace(/^@/,''); const other=cats.get(who);
    if(!other||other===cat) note='who? try !pet @name';
    else { cat.noCollide=other.noCollide=true; const side=cat.g.position.x<other.g.position.x?-1:1;
      cat.walkTo(other.g.position.x+side*1.15, other.g.position.z, 3.2);
      cat.onArrive=()=>{ cat.facing=side<0?0:Math.PI; other.facing=side<0?Math.PI:0; cat.play('nuzzle',1.4); other.play('nuzzle',1.4); cat.say('💕'); setTimeout(()=>other.say('💕'),300); setTimeout(()=>{cat.noCollide=other.noCollide=false;},1800); }; }
  }
  else note='unknown command';
  logLine(user, msg, note);
}
function zoomies(cat, secs){
  const end = performance.now()+secs*1000;
  const go=()=>{ if(cat.dead||performance.now()>end){ cat.spin(); return; } cat.walkTo(rnd(-XMAX,XMAX), rnd(ZMIN,ZMAX), 7); cat.onArrive=()=>{ if(Math.random()<0.4) cat.jump(); go(); }; };
  go();
}

// ---------- props ----------
const PROP_ANIMS=['eat','drink','scratch','bat'];
let props=[];
function propVisual(p){ if(p.fill){ const k=Math.max(0,p.amount)/6; p.fill.visible=k>0; p.fill.scale.y=Math.max(0.05,k); p.fill.position.y=p.fillY0+ (p.fillH*k)/2 - p.fillH/2; } }
function spawnProp(type,x,z){
  const g=new THREE.Group(); g.position.set(x,0,z); scene.add(g);
  const p={type,mesh:g,x,z,r:0.7,users:0};
  if(type==='bowl'){ box(g,1.1,0.35,1.1,0x8b5a3c,0,0.175,0); box(g,0.9,0.1,0.9,0x5e3a22,0,0.36,0); p.fill=box(g,0.8,0.22,0.8,0xc98a4b,0,0.5,0); p.fillY0=0.5; p.fillH=0.22; p.amount=6; }
  if(type==='water'){ box(g,1.1,0.3,1.1,0x6c8ed6,0,0.15,0); box(g,0.9,0.1,0.9,0x4a6cb0,0,0.31,0); p.fill=box(g,0.8,0.16,0.8,0x9fd0ff,0,0.42,0); p.fillY0=0.42; p.fillH=0.16; p.amount=6; }
  if(type==='post'){ box(g,1.4,0.25,1.4,0x8b5a3c,0,0.125,0); const c=new THREE.Mesh(new THREE.CylinderGeometry(0.32,0.32,2.4,8),mat(0xd8c3a5)); c.position.y=1.45; g.add(c); box(g,1.0,0.2,1.0,0x8b5a3c,0,2.75,0); box(g,0.7,0.12,0.7,0xb9574a,0,2.9,0); p.r=0.75; }
  if(type==='toy'){ const b=new THREE.Mesh(new THREE.SphereGeometry(0.35,10,8),mat(pick([0xff6b6b,0xffd166,0x7fd6ff,0xb28dff]))); b.position.y=0.35; g.add(b); p.ball=b; p.r=0.35; p.vx=0; p.vz=0; }
  propVisual(p); props.push(p); return p;
}
function clearProps(){ for(const p of props){ scene.remove(p.mesh); } props=[]; for(const c of cats.values()){ c.prop=null; } }
function refill(){ for(const p of props){ if(p.amount!=null){ p.amount=6; propVisual(p); } } }
// click-to-place
let placing=null; const ray=new THREE.Raycaster(), floor=new THREE.Plane(new THREE.Vector3(0,1,0),0), hit=new THREE.Vector3();
canvas.addEventListener('pointerdown',e=>{ if(!placing) return; ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1),camera);
  if(ray.ray.intersectPlane(floor,hit)) spawnProp(placing, clamp(hit.x,-XMAX,XMAX), clamp(hit.z,ZMIN,ZMAX)); placing=null; document.body.style.cursor=''; });
addEventListener('keydown',e=>{ if(e.key==='Escape'){ placing=null; document.body.style.cursor=''; } });

// ---------- streamer events ----------
let laser=null, fishes=[], busy=false;
const events = {
  wrestlemania(){
    const list=[...cats.values()].filter(c=>!c.dead); if(list.length<2){ toast('need 2+ cats'); return; }
    const [a,b] = list.sort(()=>Math.random()-0.5).slice(0,2); busy=true;
    const mx=rnd(-4,4), mz=rnd(ZMIN+0.3,ZMAX-0.3);
    a.say('👊'); b.say('😾'); a.noCollide=b.noCollide=true; a.walkTo(mx-1,mz,4); b.walkTo(mx+1,mz,4);
    setTimeout(()=>{ a.facing=0; b.facing=Math.PI; let n=0;
      const iv=setInterval(()=>{ const c=n%2?a:b; c.jump(); (n%2?b:a).spin(); c.say(pick(['POW','BONK','BAP','WHAP','HISS']),'pow'); if(++n>7) clearInterval(iv); }, 380);
      setTimeout(()=>{ const w=Math.random()<0.5?a:b, l=w===a?b:a; l.setState('loaf'); l.timer=6; l.say('😵'); w.jump(); setTimeout(()=>w.jump(),500); w.say('🏆 '+w.name+' wins!'); busy=false; setTimeout(()=>{a.noCollide=b.noCollide=false;},1500); }, 3400);
    }, 2200);
  },
  catnip(){ for(const c of cats.values()){ for(const e of c.eyes) e.scale.x=3; zoomies(c, 8); c.say(pick(['!!!','WHEEE','MRRAOW','😵‍💫'])); setTimeout(()=>{for(const e of c.eyes) e.scale.x=1;}, 8500); } toast('catnip loaded'); },
  nap(){ for(const c of cats.values()){ c.target=null; c.setState('sleep'); c.timer=rnd(8,12); } },
  fish(){ for(let i=0;i<14;i++){ setTimeout(()=>{ const f=box(scene,0.6,0.3,0.12,pick([0x6cc4ff,0xffa64d,0xb6e36b]),rnd(-XMAX,XMAX),13,rnd(ZMIN,ZMAX)); box(f,0.25,0.4,0.1,f.material.color.getHex(),-0.38,0,0); f.userData.vy=0; f.rotation.z=rnd(-0.5,0.5); fishes.push(f); }, i*220); }
    for(const c of cats.values()) setTimeout(()=>{ c.walkTo(rnd(-XMAX,XMAX),rnd(ZMIN,ZMAX),4); c.onArrive=()=>c.jump(); }, rnd(300,2500)); },
  laser(){ if(laser) return; laser=new THREE.Mesh(new THREE.CircleGeometry(0.18,12),new THREE.MeshBasicMaterial({color:0xff2b2b})); laser.rotation.x=-Math.PI/2; laser.position.y=0.02; laser.userData.t0=performance.now(); scene.add(laser);
    const chase=()=>{ if(!laser) return; for(const c of cats.values()){ c.walkTo(laser.position.x+rnd(-0.6,0.6), laser.position.z, 5); c.onArrive=()=>{ if(Math.random()<0.5) c.jump(); }; } };
    chase(); laser.userData.iv=setInterval(chase,900);
    setTimeout(()=>{ clearInterval(laser.userData.iv); scene.remove(laser); laser=null; for(const c of cats.values()) c.say('…'); }, 12000); }
};
function toast(t){ logLine('event','',t); }

// ---------- UI ----------
const $=s=>document.querySelector(s);
const send=()=>{ const u=$('#user').value.trim()||'anon', m=$('#msg').value; if(!m) return; handleChat(u,m); $('#msg').value=''; };
$('#send').onclick=send; $('#msg').addEventListener('keydown',e=>{ if(e.key==='Enter') send(); });
document.querySelectorAll('#chat [data-m]').forEach(b=>b.onclick=()=>handleChat($('#user').value.trim()||'anon', b.dataset.m));
document.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>events[b.dataset.ev]());
const NAMES=['mochi','biscuit','pixel','noodle','tofu','gizmo','pepper','waffles','bean','miso','clover','ziggy','toast','nova','pudding'];
$('#rand5').onclick=()=>{ for(let i=0;i<5;i++){ const u=pick(NAMES)+Math.floor(Math.random()*99); handleChat(u, `!cat ${pick(Object.keys(COLORS))} ${pick(PATTERNS)} ${pick(HATS)} eyes ${pick(Object.keys(EYES))}`); } };
document.querySelectorAll('[data-prop]').forEach(b=>b.onclick=()=>{ placing=b.dataset.prop; document.body.style.cursor='crosshair'; });
$('#refill').onclick=refill; $('#clearprops').onclick=clearProps;
$('#bg').onclick=()=>document.body.classList.toggle('demo-bg');
$('#tags').onclick=()=>labels.classList.toggle('notags');
const st=document.createElement('style'); st.textContent='.notags .tag{display:none}'; document.head.appendChild(st);
$('#hideui').onclick=()=>document.body.classList.add('hidden');
addEventListener('keydown',e=>{ if(e.key==='h'&&document.activeElement.tagName!=='INPUT') document.body.classList.toggle('hidden'); });
// URL params for OBS: ?ui=0&bg=0&tags=0
const q=new URLSearchParams(location.search);
if(q.get('depth')==='0'){ ZMIN=-1.6; ZMAX=1.8; camera.position.set(0,5.5,24); camera.lookAt(0,0.8,0); }
if(q.get('ui')==='0') document.body.classList.add('hidden');
if(q.get('bg')==='0') document.body.classList.remove('demo-bg');
if(q.get('tags')==='0') labels.classList.add('notags');

spawnProp('bowl',-6,1.5); spawnProp('water',-4.5,1.8); spawnProp('post',7,-3); spawnProp('toy',2,0);
// starter cats
handleChat('mochi_fan','!cat orange tabby crown eyes amber');
handleChat('void_enjoyer','!cat black tuxedo beanie eyes yellow');
handleChat('cream_puff','!cat cream calico bow eyes blue');

// ---------- loop ----------
let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now; const t=now/1000;
  // soft collision: push overlapping cats apart
  const arr=[...cats.values()], R=1.3;
  for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++){ const a=arr[i], b=arr[j]; if(a.noCollide||b.noCollide) continue;
    const dx=b.g.position.x-a.g.position.x, dz=b.g.position.z-a.g.position.z, d=Math.hypot(dx,dz);
    if(d<R && d>1e-4){ const push=(R-d)/2, nx=dx/d, nz=dz/d;
      a.g.position.x=clamp(a.g.position.x-nx*push,-XMAX,XMAX); a.g.position.z=clamp(a.g.position.z-nz*push,ZMIN,ZMAX);
      b.g.position.x=clamp(b.g.position.x+nx*push,-XMAX,XMAX); b.g.position.z=clamp(b.g.position.z+nz*push,ZMIN,ZMAX); } }
  for(const p of props){
    if(p.type==='toy'){ p.x+=p.vx*dt; p.z+=p.vz*dt; const f=Math.pow(0.3,dt); p.vx*=f; p.vz*=f;
      if(p.x<-XMAX||p.x>XMAX){ p.vx*=-0.7; p.x=clamp(p.x,-XMAX,XMAX); } if(p.z<ZMIN||p.z>ZMAX){ p.vz*=-0.7; p.z=clamp(p.z,ZMIN,ZMAX); }
      p.mesh.position.set(p.x,0,p.z); p.ball.rotation.z-=p.vx*dt/0.35; p.ball.rotation.x+=p.vz*dt/0.35;
      for(const c of cats.values()){ const dx=p.x-c.g.position.x, dz=p.z-c.g.position.z, d=Math.hypot(dx,dz); if(d<0.85&&d>1e-3&&c.state==='walk'&&Math.hypot(p.vx,p.vz)<1){ p.vx=dx/d*3; p.vz=dz/d*3; } }
    } else { for(const c of cats.values()){ const dx=c.g.position.x-p.x, dz=c.g.position.z-p.z, d=Math.hypot(dx,dz), rr=p.r+0.35; if(d<rr&&d>1e-3&&c.prop!==p){ c.g.position.x=clamp(p.x+dx/d*rr,-XMAX,XMAX); c.g.position.z=clamp(p.z+dz/d*rr,ZMIN,ZMAX); } } }
  }
  for(const c of cats.values()) c.update(dt,t);
  if(laser){ const k=(now-laser.userData.t0)/1000; laser.position.x=Math.sin(k*1.1)*7+Math.sin(k*3.7)*1.5; laser.position.z=(ZMIN+ZMAX)/2+Math.cos(k*1.7)*4; }
  for(const f of fishes){ f.userData.vy-=25*dt; f.position.y+=f.userData.vy*dt; f.rotation.y+=dt*3; if(f.position.y<0.6){ scene.remove(f); } }
  fishes=fishes.filter(f=>f.position.y>=0.6);
  renderer.render(scene,camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
