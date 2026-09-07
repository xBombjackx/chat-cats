// ---------- scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
camera.position.set(0, 10.5, 31); camera.lookAt(0, 0.4, -2.5);
scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6b5a7a, 0.9));
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(5, 10, 6); scene.add(sun);
const XMAX = 11; let ZMIN = -7, ZMAX = 3;   // depth: ZMIN is far, ZMAX is near the viewer
const PLAY = new URLSearchParams(location.search).get('mode')==='play';   // companion page: mirrors the overlay, no AI of its own
function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

// ---------- helpers ----------
const COLORS = {orange:0xf28c38, ginger:0xf28c38, black:0x2b2b33, white:0xf5f1ea, gray:0x8e8e96, grey:0x8e8e96,
  pink:0xf5a3c7, brown:0x7a4b2a, cream:0xf1dfb8, blue:0x7aa6d9, purple:0xa98bd6, mint:0x9fd6b5, tortie:0x6b3a1e};
const EYES = {green:0x5fd36a, blue:0x5aa9ff, yellow:0xffd54a, amber:0xffa62b, pink:0xff7bd1, red:0xff5252, gold:0xffd54a};
const HATS = ['none','crown','beanie','party','bow','halo'];
const PATTERNS = ['solid','tabby','tuxedo','calico'];
// personality: multipliers on the idle AI. Picked from the key hash like everything else secret.
const TRAITS = { chill:{}, lazy:{walk:0.5,scrap:0.5,zoom:0,follow:0.7,ambush:0.5,sleep:1.7,speed:0.85,sit:1.6},
  zoomy:{walk:1.5,zoom:2,sleep:0.6,speed:1.3,sit:0.6,ball:1.6}, clingy:{scrap:0.4,follow:2,hiss:0.4,ambush:0.5,greet:2,sit:1.2},
  grumpy:{walk:0.8,scrap:2,follow:0.4,hiss:2.5,ambush:1.8,greet:0.5,hungry:0.6} };
const TRAIT_DEF = {walk:1,scrap:1,zoom:1,follow:1,ambush:1,sleep:1,speed:1,sit:1,ball:1,hiss:1,greet:1,hungry:0.7};
const SIZES = {adult:[1,1,1], kitten:[0.62,0.62,0.62], fat:[1.12,0.95,1.3], skinny:[0.95,1.06,0.8], chonk:[1.12,0.95,1.3], smol:[0.62,0.62,0.62]};   // body scale multipliers x,y,z
const pick = a => a[Math.floor(Math.random()*a.length)];
const rnd = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const normA = a=>Math.atan2(Math.sin(a),Math.cos(a));
function mat(c){ return new THREE.MeshLambertMaterial({color:c}); }
function box(g,w,h,d,c,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c)); m.position.set(x,y,z); g.add(m); return m; }
function darken(c,f){ const k=new THREE.Color(c); k.multiplyScalar(f); return k.getHex(); }
function parseColor(s, table){ if(table[s]!=null) return table[s]; if(/^#?[0-9a-f]{6}$/i.test(s)) return parseInt(s.replace('#',''),16); return null; }

// ---------- cat ----------
class Cat {
  constructor(key, name, look){
    this.key = key; this.name = name; this.last = performance.now();
    this.look = Object.assign({body:'orange', eyes:'green', pattern:'solid', hat:'none', size:'adult'}, look);
    this.g = new THREE.Group();
    const sp=freePoint(rnd(-XMAX,XMAX), rnd(ZMIN,ZMAX)); this.g.position.set(sp.x, 0, sp.z);
    scene.add(this.g);
    this.facing = Math.random()<0.5?0:Math.PI;
    let hh=0; for(const ch of key) hh=(hh*31+ch.charCodeAt(0))>>>0;
    this.sleepStyle=['loaf','side','back'][hh%3]; this.ph=(hh%1000)/159;   // secret traits + neck wander phase
    this.trait=['chill','lazy','zoomy','clingy','grumpy'][(hh>>>3)%5]; this.T={...TRAIT_DEF, ...TRAITS[this.trait]};
    this.hunger=rnd(0.2,0.6);   // 0 = just ate, 1 = starving (≈15 min)
    this.elev=0; this.onProp=null; this.inBox=false;
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
    const sz=SIZES[L.size]||SIZES.adult; this.baseScale=new THREE.Vector3(0.72*sz[0],0.72*sz[1],0.72*sz[2]);
    const b = this.body; b.scale.copy(this.baseScale);   // chibi + small
    this.h = 2.05*sz[1];                                  // label height
    box(b,1.1,0.75,0.8,c,0,0.7,0);                       // stubby torso
    if(L.size==='fat'||L.size==='chonk') box(b,1.0,0.55,0.9,c,0.05,0.42,0);   // belly
    // head group pivots at the neck-ish centre (0.55,1.55,0); face, ears and hat are its children so they move with it
    const hd = this.head = new THREE.Group(); hd.position.set(0.55,1.55,0); b.add(hd);
    box(hd,1.35,1.2,1.25,c,0,0,0);                        // big head
    // ears: short, wide, pink inside
    this.ears=[ box(hd,0.45,0.42,0.22,c,-0.25,0.75,-0.42), box(hd,0.45,0.42,0.22,c,-0.25,0.75,0.42) ];
    box(hd,0.25,0.24,0.16,0xffb3c6,-0.2,0.72,-0.42); box(hd,0.25,0.24,0.16,0xffb3c6,-0.2,0.72,0.42);
    // big eyes with highlight
    this.eyes=[]; for(const z of [-0.33,0.33]){ const eg=new THREE.Group(); eg.position.set(0.68,0.05,z); hd.add(eg);
      box(eg,0.08,0.4,0.36,e,0,0,0); box(eg,0.1,0.14,0.12,0x111111,0.01,-0.02,0.03); box(eg,0.12,0.1,0.08,0xffffff,0.02,0.1,-0.08); this.eyes.push(eg); }
    box(hd,0.1,0.1,0.16,0xff8fa3,0.68,-0.25,0);              // nose
    box(hd,0.06,0.06,0.16,0x7a4b2a,0.68,-0.35,-0.1); box(hd,0.06,0.06,0.16,0x7a4b2a,0.68,-0.35,0.1); // w mouth
    this.tongue=box(hd,0.1,0.14,0.14,0xff7b9c,0.7,-0.47,0); this.tongue.visible=false;               // out while grooming / drinking
    box(hd,0.06,0.16,0.28,0xffa0b8,0.68,-0.27,-0.5); box(hd,0.06,0.16,0.28,0xffa0b8,0.68,-0.27,0.5); // blush
    box(hd,0.06,0.04,0.42,0xffffff,0.69,-0.23,0.5); box(hd,0.06,0.04,0.42,0xffffff,0.69,-0.23,-0.5);   // whiskers
    if(L.pattern==='tuxedo'){ box(b,0.2,0.4,0.45,white,0.5,0.6,0); box(hd,0.1,0.5,0.55,white,0.67,-0.4,0); }
    if(L.pattern==='tabby'){ for(let i=0;i<2;i++) box(b,0.16,0.12,0.85,dark,-0.35+i*0.4,1.1,0); box(hd,0.55,0.12,0.6,dark,0,0.62,0); box(hd,0.16,0.14,0.3,dark,0,0.61,-0.5); box(hd,0.16,0.14,0.3,dark,0,0.61,0.5); }
    if(L.pattern==='calico'){ box(b,0.5,0.35,0.85,0xf28c38,-0.25,0.95,0); box(hd,0.6,0.5,0.55,0x2b2b33,-0.1,0.45,-0.45); box(hd,0.4,0.3,0.3,0xf28c38,0.35,0.35,0.6); }
    // stubby legs (pivot at top)
    this.legs=[]; const lp=[[0.35,-0.25],[0.35,0.25],[-0.35,-0.25],[-0.35,0.25]];
    for(const [x,z] of lp){ const p=new THREE.Group(); p.position.set(x,0.4,z); box(p,0.32,0.4,0.32,c,0,-0.2,0); box(p,0.33,0.12,0.34,L.pattern==='tuxedo'?white:c,0,-0.35,0); b.add(p); this.legs.push(p); }
    // little tail
    this.tail = new THREE.Group(); this.tail.position.set(-0.55,0.85,0); box(this.tail,0.22,0.7,0.22,c,-0.05,0.3,0); box(this.tail,0.24,0.24,0.24,L.pattern==='tabby'?dark:c,-0.05,0.72,0);
    this.tail.rotation.z = 0.6; b.add(this.tail);
    // hat
    const h=new THREE.Group(); h.position.set(0,0.6,0); hd.add(h); const hat=this.raceCrown?'crown':L.hat;
    if(hat==='crown'){ box(h,0.8,0.2,0.8,0xffd23f,0,0.1,0); for(const [x,z] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]) box(h,0.18,0.3,0.18,0xffd23f,x,0.3,z); box(h,0.16,0.16,0.16,0xff4d6d,0.42,0.2,0); }
    if(hat==='beanie'){ box(h,1.2,0.35,1.15,0x6c8ed6,0,0.15,0); box(h,0.9,0.28,0.85,0x6c8ed6,0,0.45,0); box(h,0.32,0.32,0.32,white,0,0.72,0); }
    if(hat==='party'){ const cone=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.8,6),mat(0xff7bd1)); cone.position.set(0.15,0.42,0.25); cone.rotation.z=-0.2; h.add(cone); box(h,0.2,0.2,0.2,0xffd23f,0.22,0.87,0.25); }
    if(hat==='bow'){ box(h,0.3,0.28,0.3,0xff4d6d,0.1,0.1,0.5); box(h,0.28,0.4,0.28,0xff4d6d,-0.14,0.12,0.5); box(h,0.28,0.4,0.28,0xff4d6d,0.34,0.12,0.5); }
    if(hat==='halo'){ const r=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.07,8,24),new THREE.MeshLambertMaterial({color:0xffe28a,emissive:0x8a6a00})); r.rotation.x=Math.PI/2; r.position.y=0.55; h.add(r); }
    // shadow blob
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85,20), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.22}));
    this.shadow.rotation.x=-Math.PI/2; this.shadow.position.y=0.01; g.add(this.shadow);
    this.g.rotation.y = this.facing;
  }
  say(text, cls=''){ if(this.bubbleEl) this.bubbleEl.remove(); const d=document.createElement('div'); d.className='bubble '+cls; d.textContent=text; labels.appendChild(d); this.bubbleEl=d; clearTimeout(this.bt); this.bt=setTimeout(()=>{d.remove(); if(this.bubbleEl===d) this.bubbleEl=null;}, cls==='pow'?600:2600); }
  releaseProp(){ if(this.prop){ this.prop.users--; this.prop.taken?.delete(this.slot); this.prop=null; } }
  walkTo(x,z,speed,keep){ if(this.onProp) this.dismountNow(); if(!keep) this.releaseProp(); this.target=freePoint(x,z); this.speed=speed||2.2*this.T.speed; this.bestD=Infinity; this.stuckT=0; this.setState('walk'); }
  setName(n){ this.name=n; this.tag.textContent=this.afk?n+' 💤':this.key===cotdKey?n+' ✨':n; }
  setAfk(on){ this.afk=on; this.tag.textContent=on?this.name+' 💤':this.name; if(!on){ if(this.onProp) this.dismount(); else this.giveUp(); return; }
    this.following=null; this.giveUp(); this.say(pick(['brb','💤','afk'])); const bx=props.find(p=>p.type==='box'&&p.users<1);
    if(bx){ this.goTo(bx); } else { const side=this.g.position.x<0?-1:1; this.walkTo(side*(XMAX-1), ZMIN+rnd(0.5,1.5), 2.5); this.onArrive=()=>{ this.setState('sleep'); this.timer=30; }; } }
  hopTo(x,z,y,into){ const from={x:this.g.position.x,z:this.g.position.z,y:this.elev}; this.play('hop',0.6,true); this.anim.from=from; this.anim.to={x,z,y,into:!!into}; }
  dismount(){ const p=this.onProp; if(!p) return; this.onProp=null; this.inBox=false; this.hiding=false; this.noCollide=false; const a=rnd(0,Math.PI*2), f=freePoint(p.x+Math.cos(a)*(p.r+0.9), p.z+Math.sin(a)*(p.r+0.9)); this.releaseProp(); this.facing=Math.atan2(-(f.z-this.g.position.z), f.x-this.g.position.x); this.hopTo(f.x,f.z,0); }
  dismountNow(){ const p=this.onProp; if(!p) return; this.onProp=null; this.inBox=false; this.hiding=false; this.noCollide=false; this.elev=0; const a=rnd(0,Math.PI*2), f=freePoint(p.x+Math.cos(a)*(p.r+0.9), p.z+Math.sin(a)*(p.r+0.9)); this.g.position.set(f.x,0,f.z); this.releaseProp(); if(this.anim) this.resetAnim(); }
  giveUp(){ this.sneakTarget=null; if(this.onProp) this.dismountNow(); this.target=null; this.onArrive=null; this.releaseProp(); this.noCollide=false; if(this.pal){ this.pal.noCollide=false; this.pal=null; } this.setState('idle'); this.timer=rnd(0.5,1.5); }
  setState(s){ if(this.state==='sleep' && s!=='sleep' && !this.anim) this.resetAnim(); if(s==='sleep' && this.state!=='sleep') stat(this,'naps'); this.state=s; this.t=0; }   // sleeping poses need undoing
  // one-shot actions
  jump(){ if(this.jumpT<0) this.jumpT=0; }
  play(name,dur,keepProp){ if(this.anim) this.resetAnim(); if(!keepProp&&!this.onProp&&!PROP_ANIMS.includes(name)) this.releaseProp(); this.target=null; if(this.state!=='idle') this.setState('idle'); this.timer=dur+1; this.anim={name,dur,t:0}; }
  resetAnim(){ const b=this.body; this.anim=null; b.rotation.x=0; b.rotation.z=0; b.position.z=0; b.position.x=0; b.scale.copy(this.baseScale); this.tongue.visible=false; this.tongue.scale.y=1; b.position.y=0; this.g.position.y=this.elev; this.tail.rotation.x=0;
    for(const l of this.legs){ l.rotation.x=0; l.rotation.z=0; l.position.y=0.4; } this.ears[0].rotation.x=this.ears[1].rotation.x=0; this.head.rotation.set(0,this.head.rotation.y,0); this.head.position.set(0.55,1.55,0); for(const e of this.eyes) e.scale.setScalar(1); }
  spin(){ this.spinT=0; }
  wave(){ this.waveT=0; this.setState('idle'); this.timer=2; }
  update(dt, now){
    this.t += dt; if(!PLAY) this.hunger=Math.min(1,this.hunger+dt/900);
    const g=this.g, b=this.body, s=this.state;
    // eye blink
    const blink = (Math.sin(now*1.3+this.g.position.x*3)>0.985)||s==='sleep';
    for(const e of this.eyes) e.scale.y = blink?0.15:1;
    // tail idle wag
    this.tail.rotation.z = 0.5 + Math.sin(now*3+this.g.position.x)*0.25;
    this.tail.rotation.x = Math.sin(now*2.2)*0.3;
    // lying states
    const posed = s==='sleep' && this.sleepStyle!=='loaf' && !this.inBox && !this.anim;   // side / back sleepers
    const lying = s==='loaf' || this.inBox || (s==='sleep' && !posed);
    if(!this.anim){ b.position.y = this.inBox ? (this.hiding ? -0.85 : -0.3) : lying ? -0.3 : 0; }   // hiding = fully ducked, ear tips showing
    if(this.inBox && this.hiding && !this.anim && !PLAY && !busy){ const st=this.sneakTarget;
      if(st&&!st.dead&&Math.hypot(st.g.position.x-g.position.x,st.g.position.z-g.position.z)<3.2){ this.hiding=false; sneakPounce(this); }
      else { const v=near(this,2.4,c=>c.state==='walk'&&!c.noCollide&&!c.onProp&&!c.anim); if(v) ambush(this,v); } }
    for(const l of this.legs) l.visible = !lying;
    if(posed){ const br=Math.sin(now*1.5+this.ph)*0.03;
      if(this.sleepStyle==='side'){ b.rotation.x=1.35; b.position.y=0.22+br; this.head.rotation.z=0.25; this.head.rotation.y=0; for(let i=0;i<4;i++) this.legs[i].rotation.z=(i%2?0.45:-0.5)+Math.sin(now*0.7+i)*0.08; }
      else { b.rotation.x=Math.PI; b.position.y=0.95+br; this.head.position.set(0.9,0.6,0); this.head.rotation.set(0,0,-0.9); for(let i=0;i<4;i++) this.legs[i].rotation.z=Math.sin(now*0.8+i)*0.25+(i>1?0.3:-0.3); } }

    if(this.mirror){   // companion page: position/state come from the overlay over the wire
      const n=this.net; if(n){ const k=Math.min(1,dt*8); g.position.x+=(n.x-g.position.x)*k; g.position.z+=(n.z-g.position.z)*k; this.facing=n.f; }
      if(this.moving){ for(let i=0;i<4;i++) this.legs[i].rotation.z = Math.sin(now*9 + (i%2?Math.PI:0) + (i>1?Math.PI/2:0))*0.6; b.position.y = Math.abs(Math.sin(now*9))*0.06; }
      else for(const l of this.legs) l.rotation.z *= 0.8;
      if(s==='sit'){ b.rotation.z=-0.28; b.position.y=0.1; } else if(!lying) b.rotation.z*=0.8;
    } else if(s==='walk' && this.target){
      const dx=this.target.x-g.position.x, dz=this.target.z-g.position.z, d=Math.hypot(dx,dz);
      if(d<this.bestD-0.05){ this.bestD=d; this.stuckT=0; } else this.stuckT+=dt;   // no progress for a while (blocked by a zone/prop) → give up
      if(d<0.15){ this.target=null; this.setState('idle'); this.timer=rnd(1.5,4); if(this.onArrive){const f=this.onArrive;this.onArrive=null;f();} }
      else if(this.stuckT>1.5) this.giveUp();
      else { let vx=dx/d, vz=dz/d;   // steer around other cats and props
        if(!this.racing) for(const o of cats.values()){ if(o===this||o.noCollide) continue; const ox=g.position.x-o.g.position.x, oz=g.position.z-o.g.position.z, od=Math.hypot(ox,oz); if(od<2.2&&od>1e-3){ const w=(1-od/2.2)*1.7; vx+=ox/od*w; vz+=oz/od*w; } }
        for(const p of props){ if(p===this.prop||p.type==='toy') continue; const ox=g.position.x-p.x, oz=g.position.z-p.z, od=Math.hypot(ox,oz), rr=p.r+1.0; if(od<rr&&od>1e-3){ const w=(1-od/rr)*2.4; vx+=ox/od*w; vz+=oz/od*w; } }
        if(obstacles.length){ const o=obstaclePush(g.position.x,g.position.z,1.4); if(o.nx||o.nz){ const into=vx*o.nx+vz*o.nz; if(into<0){ vx-=into*o.nx; vz-=into*o.nz; }   // slide along room furniture
          if(Math.hypot(vx,vz)<0.35){ const r=o.rect; if(o.nx) vz+=(g.position.z<(r.z0+r.z1)/2)?-1:1; else vx+=(g.position.x<(r.x0+r.x1)/2)?-1:1; }   // head-on: go round the nearer end
          vx+=o.nx*0.35; vz+=o.nz*0.35; } }
        for(const q of zoneQuads){ const {d,e}=zoneDepth(q,g.position.x,g.position.z); if(d<ZONE_PAD+0.8){ const into=vx*e.nx+vz*e.nz; if(into<0){ vx-=into*e.nx; vz-=into*e.nz; }   // slide along the zone edge
          if(d<ZONE_PAD){ const w=(ZONE_PAD-d)*2; vx+=e.nx*w; vz+=e.nz*w; } } }
        const vl=Math.hypot(vx,vz)||1; vx/=vl; vz/=vl;
        const st=Math.min(d,this.speed*dt); g.position.x=clamp(g.position.x+vx*st,-XMAX,XMAX); g.position.z=clamp(g.position.z+vz*st,ZMIN,ZMAX); this.facing=Math.atan2(-vz,vx);
        for(let i=0;i<4;i++) this.legs[i].rotation.z = Math.sin(now*this.speed*4 + (i%2?Math.PI:0) + (i>1?Math.PI/2:0))*0.6;
        b.position.y = Math.abs(Math.sin(now*this.speed*4))*0.06; }
    } else {
      for(const l of this.legs) l.rotation.z *= 0.8;
      if(s==='idle'){ this.timer-=dt; if(this.timer<=0) this.pickIdle();
        if(!PLAY && !this.anim && Math.random()<dt*0.02){ if(this.hunger>0.85) this.say(pick(['😾','hungry…','grr','feed me'])); else if(this.hunger<0.15) this.say(pick(['💕','prrr','😌'])); }   // mood shows
        if(!PLAY && !this.anim && !this.noCollide){ this.glanceT=(this.glanceT??rnd(0.5,2))-dt; if(this.glanceT<=0){ this.glanceT=rnd(1,2.5); const o=near(this,3.5); if(o && Math.random()<0.6){ this.look={x:o.g.position.x,z:o.g.position.z,until:now+rnd(1.2,2.5)}; if(Math.abs(normA(Math.atan2(-(o.g.position.z-g.position.z), o.g.position.x-g.position.x)-this.facing))>1.2) faceAt(this,o); const aff=affinity(this,o);
          if((aff<-0.55 || (this.T.hiss>2 && aff<0.2)) && Math.random()<0.35*this.T.hiss){ this.play('arch',0.8); this.say(pick(['hss','😾','go away'])); } else if(aff>0.55 && Math.random()<0.2*this.T.greet) this.say(pick(['💕',':3','prrr'])); } } } }
      if(s==='sit'){ b.rotation.z = -0.28; b.position.y=0.1; this.head.rotation.x = Math.sin(now*0.8)*0.12; this.timer-=dt; if(this.timer<=0){ this.setState('idle'); this.timer=1; } }
      else if(!lying) b.rotation.z *= 0.8;
      if(s==='loaf'){ this.timer-=dt; if(this.timer<=0){ this.setState('idle'); this.timer=1; } }
      if(s==='sleep'){ this.timer-=dt; if(Math.floor(this.t)!==Math.floor(this.t-dt) && Math.floor(this.t)%2===0) this.say('z'.repeat(1+Math.floor(this.t)%3)); if(this.timer<=0){ this.setState('idle'); this.play('stretch',1.5); } }
      if(s==='groom'){ const lick=Math.abs(Math.sin(now*10)); this.head.rotation.z = -0.25+Math.sin(now*10)*0.15; this.head.position.y=1.45+lick*0.06;   // head down, tongue out, paw up to the face
        this.tongue.visible=true; this.tongue.position.y=-0.47-lick*0.1; this.tongue.scale.y=0.6+lick*0.8;
        this.legs[0].rotation.z=-1.9+Math.sin(now*10)*0.15; this.legs[0].position.y=0.55;
        this.timer-=dt; if(this.timer<=0){ this.head.rotation.z=0; this.head.position.y=1.55; this.tongue.visible=false; this.legs[0].position.y=0.4; this.setState('idle'); this.timer=2; } }
    }
    // facing (smooth turn)
    // neck: idle wander, look at whatever caught its eye, bob while walking — only when nothing else is driving the head
    if(!this.anim && !posed && s!=='groom' && !this.inBox){
      let yaw=0.22*Math.sin(now*0.6+this.ph)+0.12*Math.sin(now*1.7+this.ph*2), pitch=0.05*Math.sin(now*0.9+this.ph);
      if(this.look && now<this.look.until) yaw=clamp(normA(Math.atan2(-(this.look.z-g.position.z), this.look.x-g.position.x)-this.facing),-1.1,1.1);
      if(s==='walk'){ pitch+=Math.sin(now*this.speed*4)*0.06; yaw+=clamp((this.turn||0)*0.8,-0.6,0.6); }
      const k=Math.min(1,dt*6); this.head.rotation.y+=(yaw-this.head.rotation.y)*k; this.head.rotation.z+=(pitch-this.head.rotation.z)*k; }
    const ry = this.facing; let dr=((ry-g.rotation.y+Math.PI)%(2*Math.PI)+2*Math.PI)%(2*Math.PI)-Math.PI; this.turn=dr; g.rotation.y += dr*Math.min(1,dt*10);
    // jump
    if(this.jumpT>=0){ this.jumpT+=dt*1.8; const p=this.jumpT; if(p>=1){this.jumpT=-1; g.position.y=this.elev; this.shadow.scale.setScalar(1);} else { g.position.y=this.elev+Math.sin(p*Math.PI)*1.3*(this.jumpScale||1); const sc=1-Math.sin(p*Math.PI)*0.4; this.shadow.scale.setScalar(sc); } }
    // spin
    if(this.spinT>=0){ this.spinT+=dt; g.rotation.y += dt*14; if(this.spinT>0.7){ this.spinT=-1; } }
    // wave (front-left leg)
    if(this.waveT>=0){ this.waveT+=dt; this.legs[0].rotation.z = -2.2 + Math.sin(this.waveT*14)*0.5; if(this.waveT>1.5) this.waveT=-1; }
    // one-shot animations
    if(this.anim){ const A=this.anim; A.t+=dt; const p=Math.min(1,A.t/A.dur), s1=Math.sin(p*Math.PI);
      switch(A.name){
        case 'stretch': this.legs[0].rotation.z=this.legs[1].rotation.z=-1.3*s1; b.rotation.z=-0.38*s1; b.position.y=-0.1*s1; this.tail.rotation.z=0.6+1.1*s1; break;
        case 'roll': { const th=p*Math.PI*2, cy=0.7*0.72; b.rotation.x=th; b.position.y=cy*(1-Math.cos(th))+0.15*s1; b.position.z=-cy*Math.sin(th); break; }
        case 'pounce': if(p<0.4){ const q=p/0.4; b.position.y=-0.22*q; b.rotation.z=0.18*q; this.tail.rotation.x=Math.sin(A.t*30)*0.4; }
                       else { const q=(p-0.4)/0.6; g.position.y=this.elev+Math.sin(q*Math.PI)*0.9; g.position.x=clamp(g.position.x+Math.cos(this.facing)*dt*4.5,-XMAX,XMAX); g.position.z=clamp(g.position.z-Math.sin(this.facing)*dt*4.5,ZMIN,ZMAX); b.rotation.z=-0.25*Math.sin(q*Math.PI); this.legs[0].rotation.z=this.legs[1].rotation.z=-1.0*Math.sin(q*Math.PI); } break;
        case 'hop': { const f=A.from,t=A.to; g.position.x=f.x+(t.x-f.x)*p; g.position.z=f.z+(t.z-f.z)*p; g.position.y=f.y+(t.y-f.y)*p+Math.sin(p*Math.PI)*0.9; b.rotation.z=-0.3*s1; this.legs[0].rotation.z=this.legs[1].rotation.z=-1.1*s1; this.legs[2].rotation.z=this.legs[3].rotation.z=0.8*s1;
          if(p>=1){ this.elev=t.y; this.inBox=t.into; } break; }
        case 'lickfoot': { const env=Math.max(0,Math.min(1,p*4,(1-p)*4)); this.head.rotation.y=-1.1*env; this.head.rotation.z=-0.55*env; this.head.position.x=0.55-0.25*env; this.legs[2].rotation.z=1.5*env; this.legs[2].rotation.x=-0.6*env; b.rotation.x=-0.25*env; this.tongue.visible=env>0.6; this.tongue.scale.y=0.5+Math.abs(Math.sin(A.t*12)); break; }
        case 'lickbutt': { const env=Math.max(0,Math.min(1,p*4,(1-p)*4)); this.head.rotation.y=-2.3*env; this.head.rotation.z=-0.4*env; this.head.position.x=0.55-0.45*env; this.legs[3].rotation.x=1.6*env; b.rotation.x=0.55*env; b.position.y=0.05*env; this.tongue.visible=env>0.6; this.tongue.scale.y=0.5+Math.abs(Math.sin(A.t*12)); break; }
        case 'swipe': { const pop=Math.min(1,p*4); b.position.y=-0.85+1.0*Math.sin(pop*Math.PI/2)-0.3*Math.max(0,(p-0.7)/0.3); this.legs[0].visible=true; this.legs[0].rotation.z=-2.1*Math.min(1,p*3); this.legs[0].rotation.x=Math.sin(A.t*22)*0.9*(p<0.8?1:0); this.head.rotation.z=-0.15; for(const e of this.eyes) e.scale.setScalar(1.3); break; }   // pop up out of the box and bat
        case 'crouch': { const low=Math.min(1,p*3); b.position.y=-0.24*low; b.rotation.z=0.1*low; this.head.position.y=1.55-0.12*low; for(const e of this.eyes) e.scale.setScalar(1+0.35*low);
          this.tail.rotation.z=0.2+Math.sin(A.t*14)*0.15; b.rotation.x=Math.sin(A.t*9)*0.05*low;   // butt wiggle
          const t=this.sneakTarget; if(t&&!t.dead){ this.head.rotation.y=clamp(normA(Math.atan2(-(t.g.position.z-g.position.z), t.g.position.x-g.position.x)-this.facing),-1.2,1.2); if(Math.hypot(t.g.position.x-g.position.x,t.g.position.z-g.position.z)<(this.elev>0?4:2.9)) A.t=A.dur; }
          if(p>=1&&this.sneakTarget) setTimeout(()=>sneakPounce(this),0); break; }
        case 'tackle': b.position.x=1.1*s1; b.rotation.z=-0.4*s1; this.legs[0].rotation.z=this.legs[1].rotation.z=-1.4*s1; this.head.rotation.z=-0.2*s1; break;   // lunge along facing
        case 'knocked': { const env=p<0.3?p/0.3:1-(p-0.3)/0.7; b.rotation.x=1.25*env; b.position.y=0.3*Math.sin(Math.min(1,p*2)*Math.PI); b.position.x=-0.8*s1; this.ears[0].rotation.x=this.ears[1].rotation.x=-0.6*env; for(const e of this.eyes) e.scale.setScalar(1+0.5*env); break; }   // shoved onto its side
        case 'stalk': { const low=Math.min(1,p*4,(1-p)*6); b.position.y=-0.24*low; b.rotation.z=0.12*low; this.head.position.y=1.55-0.15*low; for(const e of this.eyes) e.scale.setScalar(1+0.35*low);   // creep low and slow
          this.tail.rotation.z=0.2+Math.sin(A.t*18)*0.12; this.tail.rotation.x=Math.sin(A.t*18)*0.25; const st=dt*0.9*low; g.position.x=clamp(g.position.x+Math.cos(this.facing)*st,-XMAX,XMAX); g.position.z=clamp(g.position.z-Math.sin(this.facing)*st,ZMIN,ZMAX);
          for(let i=0;i<4;i++) this.legs[i].rotation.z=Math.sin(A.t*4+(i%2?Math.PI:0)+(i>1?Math.PI/2:0))*0.35*low; break; }
        case 'arch': b.scale.y=this.baseScale.y*(1+0.32*s1); b.position.y=0.04*s1; this.tail.rotation.z=0.6-0.75*s1; for(const e of this.eyes) e.scale.setScalar(1+0.4*s1); break;
        case 'shake': b.rotation.x=Math.sin(A.t*40)*0.28*(1-p); this.ears[0].rotation.x=this.ears[1].rotation.x=-b.rotation.x*1.5; break;
        case 'nuzzle': b.rotation.z=-0.35*Math.abs(Math.sin(A.t*5))*(1-p*0.5); b.position.y=-0.06*s1; break;
        case 'twitch': this.ears[p<0.5?0:1].rotation.x=Math.sin(A.t*35)*0.35*(1-p); break;
        case 'peek': this.head.rotation.z=0.25*s1; break;
        case 'eat': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)), hd=this.head; hd.position.y=1.55-0.42*env-0.05*Math.abs(Math.sin(A.t*8))*env; hd.rotation.z=-0.35*env; this.tail.rotation.z=0.6+0.6*env; break; }
        case 'drink': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)), hd=this.head; hd.position.y=1.55-0.4*env-0.03*Math.abs(Math.sin(A.t*16))*env; hd.rotation.z=-0.3*env; this.tongue.visible=env>0.5; this.tongue.scale.y=0.5+Math.abs(Math.sin(A.t*16)); break; }
        case 'scratch': { const env=Math.max(0,Math.min(1,p*4,(1-p)*4)); b.rotation.z=0.8*env; b.position.y=0.32*env; this.legs[0].rotation.z=(-1.7+Math.sin(A.t*14)*0.4)*env; this.legs[1].rotation.z=(-1.7-Math.sin(A.t*14)*0.4)*env; break; }
        case 'bat': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)); this.legs[0].rotation.z=-1.3*Math.abs(Math.sin(A.t*10))*env; b.rotation.z=-0.1*env; break; }
      }
      if(p>=1){ this.resetAnim(); if(A.name!=='hop' && !this.onProp) this.releaseProp(); }   // parked cats keep their reservation until they dismount
    }
    // labels
    const v=new THREE.Vector3(g.position.x, g.position.y+ (lying?this.h*0.73:this.h), g.position.z).project(camera);
    const sx=(v.x+1)/2*innerWidth, sy=(1-v.y)/2*innerHeight;
    this.tag.style.left=sx+'px'; this.tag.style.top=sy+'px';
    if(this.bubbleEl){ this.bubbleEl.style.left=sx+'px'; this.bubbleEl.style.top=(sy-18)+'px'; }
  }
  goTo(p){
    p.users++; this.prop=p; this.chase=0; p.taken=p.taken||new Set(); this.slot=0; while(p.taken.has(this.slot)) this.slot++; p.taken.add(this.slot);
    const walk=()=>{ const dx=this.g.position.x-p.x, dz=this.g.position.z-p.z, d=Math.hypot(dx,dz)||1; this.walkTo(p.x+dx/d*(p.r+0.6), p.z+dz/d*(p.r+0.6), p.type==='toy'?3.2:2.4, true); this.onArrive=arrive; };
    const arrive=()=>{ if(this.prop!==p) return;
      if(p.type==='toy' && Math.hypot(p.x-this.g.position.x,p.z-this.g.position.z)>p.r+1.4 && this.chase++<3){ walk(); return; }   // ball rolled off — chase it
      if((p.type==='bowl'||p.type==='water') && p.amount>0){ const other=[...cats.values()].find(c=>c!==this&&!c.dead&&c.prop===p);
        if(other && !isFriend(this,other)){ if(isRival(this,other)||Math.random()<0.6) squabble(this,other,p); else { this.say('…'); this.releaseProp(); this.walkTo(this.g.position.x+rnd(-3,3), this.g.position.z+rnd(-2,2)); } return; } }
      this.useProp(p); };
    walk();
  }
  useProp(p){
    this.facing=Math.atan2(-(p.z-this.g.position.z), p.x-this.g.position.x);
    if(p.type==='bowl'){ if(p.amount<=0){ this.say('empty…'); this.releaseProp(); return; } p.amount--; propVisual(p); this.hunger=0; this.play('eat',4); this.say(pick(['nom nom','crunch','😋'])); }
    else if(p.type==='water'){ if(p.amount<=0){ this.say('dry…'); this.releaseProp(); return; } p.amount--; propVisual(p); this.hunger=Math.max(0,this.hunger-0.15); this.play('drink',3); this.say('lap lap'); }
    else if(p.type==='post'){ this.play('scratch',3); this.say(pick(['scritch scritch','scrrrrt'])); }
    else if(p.type==='box'||p.type==='perch'||PERCHY.includes(p.type)){ this.onProp=p; this.noCollide=true; const off=(p.cap||1)>1?((this.slot||0)%2?0.95:-0.95):0; this.hopTo(p.x+off*(p.sx||1),p.z+off*(p.sz||0),p.h||0,p.type==='box');
      this.say(pick(p.type==='box'?['box!','if i fits…','mine now']:p.type==='bed'?['comfy','zzz soon','mine']:p.type==='counter'?['not allowed up here','👀','hehe']:p.type==='tree'?['🌳','up up','👀']:['👀','up here','👑'])); }
    else if(p.type==='toy'){ this.play('bat',1.0); setTimeout(()=>{ if(p.mesh.parent){ p.vx=Math.cos(this.facing)*6; p.vz=-Math.sin(this.facing)*6; } },350); if(Math.random()<0.5) this.say('!');
      // rope a nearby idle cat into the game
      const ok=c=>c.state==='idle'&&!c.anim&&!c.prop&&!c.noCollide, buddy=near(this,7,c=>ok(c)&&isFriend(this,c))||near(this,7,c=>ok(c)&&!isRival(this,c));
      if(buddy && p.users<3 && Math.random()<0.6) setTimeout(()=>{ if(!buddy.dead&&!buddy.prop&&buddy.state==='idle'&&p.mesh.parent){ buddy.say(pick(['ooh','me too!','!'])); buddy.goTo(p); } }, 500); }
  }
  pickIdle(){
    if(this.afk){ if(!this.onProp && this.state!=='sleep'){ this.setState('sleep'); } this.timer=30; if(this.onProp){ this.hiding=false; this.setState('sleep'); } return; }   // parked until they type again
    if(this.following){ const f=this.following; if(f.cat.dead||performance.now()>f.until){ this.following=null; } else { const o=f.cat, dx=this.g.position.x-o.g.position.x, dz=this.g.position.z-o.g.position.z, d=Math.hypot(dx,dz)||1;
      if(d>2.4){ this.walkTo(o.g.position.x+dx/d*1.7, o.g.position.z+dz/d*1.7, Math.max(2.5,o.speed||2.5)); this.onArrive=()=>{ this.look={x:o.g.position.x,z:o.g.position.z,until:performance.now()/1000+2}; this.timer=rnd(0.5,1.5); }; }
      else { this.look={x:o.g.position.x,z:o.g.position.z,until:performance.now()/1000+2}; this.setState('sit'); this.timer=rnd(1,2); } return; } }
    if(this.onProp && this.sneakTarget){ const t=this.sneakTarget; if(t.dead||Math.hypot(t.g.position.x-this.g.position.x,t.g.position.z-this.g.position.z)>13){ this.sneakTarget=null; }
      else if(this.inBox){ this.hiding=true; this.setState('loaf'); this.timer=rnd(5,9); this.sneakWaits=(this.sneakWaits||0)+1; if(this.sneakWaits>2) this.sneakTarget=null; return; }
      else { faceAt(this,t); this.play('crouch',rnd(3,6)); return; } }   // crouch ends → sneakPounce leaps off
    if(this.onProp){   // up on a perch or in a box: lounge, then eventually hop down
      const r=Math.random();
      if(r<0.25){ this.dismount(); } else if(this.inBox && r<0.25+0.35*this.T.ambush){ this.hiding=true; this.setState('loaf'); this.timer=rnd(6,14); }   // lie in wait
      else if(r<0.55){ this.setState('loaf'); this.timer=rnd(4,8); } else if(r<0.7){ this.setState('sleep'); this.timer=rnd(6,10); }
      else if(r<0.85 && !this.inBox){ this.setState('sit'); this.timer=rnd(3,6); } else if(this.inBox){ this.hiding=false; this.play('peek',2); this.say(pick(['👀','…'])); } else { this.setState('groom'); this.timer=rnd(1,2); }
      return; }
    const T=this.T;
    if(!PLAY && this.hunger>T.hungry && Math.random()<0.6){   // hungry: find food, or stare at the empty bowl and complain
      const bowls=props.filter(p=>p.type==='bowl'), full=bowls.filter(p=>p.amount>0&&p.users<1);
      if(full.length){ this.goTo(pick(full)); return; }
      if(bowls.length && Math.random()<0.5){ const b=pick(bowls); this.walkTo(b.x+rnd(-1.5,1.5), Math.min(ZMAX,b.z+1.6)); this.onArrive=()=>{ this.facing=-Math.PI/2; this.play('peek',2.5); this.say(pick(['feed me','bowl is empty 😾','hungry…','🍽️👀'])); }; return; } }
    if(props.length && Math.random()<0.4){
      const game=props.find(p=>p.type==='toy'&&p.users>0&&p.users<3); if(game && Math.random()<0.6*T.ball){ this.goTo(game); return; }   // someone's playing — join in
      const taken=props.filter(p=>(p.type==='bowl'||p.type==='water')&&p.users>=1&&p.amount>0); if(taken.length && Math.random()<0.25 && !busy){ this.goTo(pick(taken)); return; }   // hungry enough to muscle in
      const cands=props.filter(p=>p.users<(p.cap||1) && (p.amount==null||p.amount>0)); if(cands.length){ this.goTo(pick(cands)); return; } }
    const free=c=>c.state==='idle'&&!c.anim&&!c.prop&&!c.noCollide;
    if(!busy && Math.random()<0.05*T.scrap){   // spontaneous scrap — rivals mostly, friends never
      const o=near(this,6,c=>free(c)&&!isFriend(this,c)&&(isRival(this,c)||Math.random()<0.25)); if(o){ wrestle(this,o,false); return; } }
    if(Math.random()<0.035*T.scrap && sneak(this)) return;
    if(Math.random()<0.03*T.scrap){ stalk(this, near(this,9,c=>free(c)&&!isFriend(this,c))); return; }
    if(Math.random()<0.5*T.follow){   // go hang out with a friend; greet on arrival
      const f=near(this,14,c=>isFriend(this,c)&&c.state!=='walk'); if(f){ const dx=this.g.position.x-f.g.position.x, dz=this.g.position.z-f.g.position.z, d=Math.hypot(dx,dz)||1;
        if(d>2.6){ this.walkTo(f.g.position.x+dx/d*1.8, f.g.position.z+dz/d*1.8); this.onArrive=()=>{ if(!f.dead&&free(f)&&Math.random()<0.5*T.greet&&Math.hypot(f.g.position.x-this.g.position.x,f.g.position.z-this.g.position.z)<3) greet(this,f); }; return; } } }
    const rv=near(this,3,c=>isRival(this,c)); if(rv && Math.random()<0.5){ const dx=this.g.position.x-rv.g.position.x, dz=this.g.position.z-rv.g.position.z, d=Math.hypot(dx,dz)||1; this.say(pick(['hmph','…'])); this.walkTo(this.g.position.x+dx/d*4, this.g.position.z+dz/d*3); return; }   // not sitting next to *that* one
    const pool=[['walk',0.45*T.walk],['sit',0.2*T.sit],['groom',0.09],['lickfoot',0.03],['lickbutt',0.03],['loaf',0.08*T.sleep],['sleep',0.03*T.sleep],['stretch',0.02],['twitch',0.02],['shake',0.02],['peek',0.015],['turn',0.015],['zoom',0.015*T.zoom]];
    let r=Math.random()*pool.reduce((a,[,w])=>a+w,0), act='walk'; for(const [a,w] of pool){ r-=w; if(r<=0){ act=a; break; } }
    switch(act){
      case 'walk': this.walkTo(this.g.position.x+rnd(-5,5), this.g.position.z+rnd(-4,4)); break;
      case 'sit': this.setState('sit'); this.timer=rnd(2,5)*T.sit; break;
      case 'groom': this.setState('groom'); this.timer=rnd(1,2); break;
      case 'lickfoot': this.play('lickfoot',1.8); break;
      case 'lickbutt': this.play('lickbutt',2.0); break;
      case 'loaf': this.setState('loaf'); this.timer=rnd(3,6)*T.sleep; break;
      case 'sleep': this.setState('sleep'); this.timer=rnd(5,9)*T.sleep; break;
      case 'stretch': this.play('stretch',1.5); break;
      case 'twitch': this.play('twitch',0.8); break;
      case 'shake': this.play('shake',0.7); break;
      case 'peek': this.facing=-Math.PI/2; this.timer=rnd(2,4); this.play('peek',2.5); break;   // look at the viewer
      case 'zoom': zoomies(this,3); break;
      default: this.facing += Math.PI; this.timer=rnd(1,3);
    }
  }
  remove(){ this.dead=true; this.releaseProp(); if(this.pal){ this.pal.noCollide=false; this.pal=null; } scene.remove(this.g); this.tag.remove(); if(this.bubbleEl) this.bubbleEl.remove(); }
}

// ---------- registry + commands ----------
const cats = new Map();   // key (platform:user) -> Cat
let MAX_CATS = 30;
const labels = document.getElementById('labels');
const log = document.getElementById('log');
const net = { send(){} };   // replaced by net.js when the server is around
function logLine(user, msg, note){ const d=document.createElement('div'); d.innerHTML=`<b></b>: <span></span><span style="opacity:.6"></span>`; const [m,n]=d.querySelectorAll('span'); d.querySelector('b').textContent=user; m.textContent=msg; n.textContent=note?` — ${note}`:''; log.prepend(d); while(log.children.length>30) log.lastChild.remove(); }
const stat=(cat,name)=>{ if(!PLAY&&cat&&!cat.dead) net.send({type:'stat', key:cat.key, name}); };   // cozy leaderboards
let cotdKey=null;
function crownCotd(c){ if(!c||c.key!==cotdKey) return; c.tag.classList.add('cotd'); c.tag.textContent=c.name+' ✨'; c.say('cat of the day ✨'); }
function findCat(name){ name=name.toLowerCase(); if(!name) return null; for(const c of cats.values()) if(c.name.toLowerCase()===name||c.key.split(':')[1]===name) return c;
  const pre=[...cats.values()].filter(c=>c.name.toLowerCase().startsWith(name)||c.key.split(':')[1].startsWith(name)); return pre.length===1?pre[0]:null; }   // unique prefix is fine too ("@sir" for "Sir Biscuit")
function removeCat(cat){ cat.remove(); cats.delete(cat.key); }
function spawnCat(key, name, look, quiet){
  if(!PLAY && cats.size>=MAX_CATS){ let old=null; for(const c of cats.values()) if(!old||(c.visitor&&!old.visitor)||(c.visitor===old.visitor&&c.last<old.last)) old=c; if(old){ old.say('bye'); removeCat(old); } }   // evict: raid visitors first, then least recently active
  const cat=new Cat(key, name, look); cats.set(key,cat); if(!quiet) cat.say('hi!'); return cat;
}

function handleChat(user, msg, key, away){
  key = key || 'sim:'+user.toLowerCase();
  msg = msg.trim(); if(!msg.startsWith('!')) return;
  const raw = msg.slice(1).split(/\s+/); raw.shift();
  const parts = msg.slice(1).toLowerCase().split(/\s+/); const cmd = parts.shift(); let note='';
  let cat = cats.get(key);
  if(cat) cat.last=performance.now();
  if(cat && cat.afk){ cat.setAfk(false); cat.say(pick(['back!','o/','👋'])); }
  const welcome = away>20*3600e3;   // long time no see — greeted after the command's own bubble, also when the cat is respawning via !cat
  if(cmd==='cat'){
    const look = cat ? {...cat.look} : {};
    for(let i=0;i<parts.length;i++){ const p=parts[i];
      if(p==='eyes' && parts[i+1]){ look.eyes=parts[++i]; continue; }
      if(HATS.includes(p)) look.hat=p; else if(PATTERNS.includes(p)) look.pattern=p; else if(SIZES[p]) look.size=p; else if(parseColor(p,COLORS)!=null) look.body=p; }
    if(!cat){ cat=spawnCat(key, user, look); note='spawned'; crownCotd(cat); }
    else { cat.look=look; cat.build(); cat.jump(); note='updated'; }
    net.send({type:'cat', key, name:user, look:cat.look});
  } else if(!cat){ note='no cat yet — use !cat'; }
  else if(cmd==='join') note=race.join(cat);
  else if(cmd==='name'){ const n=raw.join(' ').replace(/[<>]/g,'').trim().slice(0,20); cat.setName(n||user); net.send({type:'cat', key, name:cat.name, look:cat.look}); note='named '+cat.name; }
  else if(cmd==='afk'){ cat.setAfk(true); note='afk'; }
  else if(cmd==='follow'){ const who=(parts[0]||'').replace(/^@/,''); const other=who?findCat(who):null; if(!who){ cat.following=null; note='stopped following'; } else if(!other||other===cat) note='who? try !follow @name'; else { cat.following={cat:other, until:performance.now()+60000}; cat.say(pick(['👀','coming!','wait up'])); cat.giveUp(); cat.timer=0.2; note='following '+other.name; } }
  else if(cmd==='lick') cat.play(pick(['lickfoot','lickbutt']),1.9);
  else if(cmd==='meow') cat.say(pick(['meow','mrrp','meow~','MEOW','mrow?','prrr']));
  else if(cmd==='jump') cat.jump();
  else if(cmd==='spin') cat.spin();
  else if(cmd==='sleep'){ cat.setState('sleep'); cat.timer=8; }
  else if(cmd==='loaf'){ cat.setState('loaf'); cat.timer=8; }
  else if(cmd==='wave') cat.wave();
  else if(cmd==='zoomies'){ zoomies(cat, 6); stat(cat,'zoomies'); }
  else if(cmd==='leave'){ cat.say('bye'); net.send({type:'catgone', key}); setTimeout(()=>removeCat(cat), 900); }
  else if(cmd==='stretch') cat.play('stretch',1.5);
  else if(cmd==='roll') cat.play('roll',1.2);
  else if(cmd==='pounce') cat.play('pounce',1.0);
  else if(cmd==='sneak'){ const who=(parts[0]||'').replace(/^@/,''); const t=who?findCat(who):null; note=sneak(cat, t&&t!==cat?t:null)?'sneaking':'nobody to sneak up on'; }
  else if(cmd==='stalk'){ const who=(parts[0]||'').replace(/^@/,''); const t=who?findCat(who):null; stalk(cat, t&&t!==cat?t:null); }
  else if(cmd==='tackle'||cmd==='fight'){ const who=(parts[0]||'').replace(/^@/,''); const o=findCat(who); if(!o||o===cat) note='who? try !tackle @name'; else if(busy) note='busy'; else wrestle(cat,o,false); }
  else if(cmd==='hiss'){ cat.play('arch',1.3); cat.say(pick(['hsss','HISS','>:3'])); }
  else if(cmd==='shake') cat.play('shake',0.7);
  else if(cmd==='pet'||cmd==='boop'||cmd==='hug'){
    const who=(parts[0]||'').replace(/^@/,''); const other=findCat(who);
    if(!other||other===cat) note='who? try !pet @name';
    else { stat(cat,'pets'); cat.noCollide=other.noCollide=true; cat.pal=other; const side=cat.g.position.x<other.g.position.x?-1:1;
      cat.walkTo(other.g.position.x+side*1.15, other.g.position.z, 3.2);
      cat.onArrive=()=>{ cat.facing=side<0?0:Math.PI; other.facing=side<0?Math.PI:0; cat.play('nuzzle',1.4); other.play('nuzzle',1.4); cat.say('💕'); setTimeout(()=>other.say('💕'),300); setTimeout(()=>{cat.noCollide=other.noCollide=false;},1800); }; }
  }
  else note='unknown command';
  if(welcome && cat && !cat.dead){ const c=cat; setTimeout(()=>{ if(c.dead) return; c.facing=-Math.PI/2; c.jump(); c.say(pick(['missed you 💕','you came back!','🥹'])); },1500); }
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
  if(type==='box'){ const c=0xc9a06a, d=0xa8824f; box(g,1.7,0.1,1.5,d,0,0.05,0); box(g,1.7,0.9,0.1,c,0,0.5,-0.7); box(g,1.7,0.9,0.1,c,0,0.5,0.7); box(g,0.1,0.9,1.5,c,-0.8,0.5,0); box(g,0.1,0.9,1.5,c,0.8,0.5,0); const flap=box(g,0.9,0.06,0.6,d,0,0.98,0.95); flap.rotation.x=0.6; p.r=0.95; p.h=0; }
  if(type==='bed'){ box(g,4.2,0.5,2.8,0x8b5a3c,0,0.25,0); box(g,4.0,0.4,2.6,0xf1e6d6,0,0.7,0); box(g,1.2,0.3,2.2,0xffffff,-1.3,1.0,0); box(g,2.4,0.25,2.6,0x7fa7d9,0.7,0.95,0); box(g,4.4,1.4,0.25,0x8b5a3c,0,1.0,-1.45); p.r=1.9; p.h=0.9; p.cap=2; p.sx=1; }
  if(type==='couch'){ box(g,4.4,0.6,1.8,0x7a5c8f,0,0.3,0); box(g,4.4,0.5,1.5,0x8f6fa6,0,0.75,0.1); box(g,4.4,1.3,0.5,0x7a5c8f,0,1.15,-0.75); box(g,0.5,1.1,1.8,0x7a5c8f,-2.2,0.85,0); box(g,0.5,1.1,1.8,0x7a5c8f,2.2,0.85,0); p.r=1.8; p.h=1.0; p.cap=2; p.sx=1; }
  if(type==='counter'){ box(g,3.6,1.6,1.4,0xf3f0ea,0,0.8,0); box(g,3.8,0.15,1.6,0x7b6a58,0,1.65,0); box(g,0.9,0.06,0.15,0x999999,-0.9,0.9,0.71); box(g,0.9,0.06,0.15,0x999999,0.9,0.9,0.71); p.r=1.6; p.h=1.72; p.cap=2; p.sx=1; }
  if(type==='tree'){ const t=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.5,3,8),mat(0x7a4b2a)); t.position.y=1.5; g.add(t); for(const [x,y,z,r] of [[0,3.6,0,1.6],[-1.1,3.0,0.4,1.1],[1.0,3.2,-0.5,1.2],[0.3,4.4,0.6,1.0]]){ const b=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mat(0x5aa14f)); b.position.set(x,y,z); g.add(b); }
    box(g,2.2,0.25,0.5,0x7a4b2a,1.0,2.2,0.3); p.r=1.3; p.h=2.35; p.cap=1; }
  if(type==='perch'){ box(g,0.6,0.25,0.6,0x8b5a3c,0,0.125,0); const c=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.2,1.5,8),mat(0xd8c3a5)); c.position.y=0.9; g.add(c); box(g,2.0,0.18,1.6,0x8b5a3c,0,1.7,0); box(g,1.8,0.08,1.4,0xb9574a,0,1.83,0); p.r=1.0; p.h=1.87; }
  if(type==='toy'){ const b=new THREE.Mesh(new THREE.SphereGeometry(0.35,10,8),mat(pick([0xff6b6b,0xffd166,0x7fd6ff,0xb28dff]))); b.position.y=0.35; g.add(b); p.ball=b; p.r=0.35; p.vx=0; p.vz=0; }
  propVisual(p); props.push(p); return p;
}
function clearProps(){ for(const p of [...props]) if(!p.env) removeProp(p); saveProps(); }   // furniture that belongs to the room stays
function saveProps(){ net.send({type:'props', props:props.filter(p=>!p.env&&!p.temp).map(p=>({type:p.type,x:p.x,z:p.z}))}); }
function refill(){ for(const p of props){ if(p.amount!=null){ p.amount=6; propVisual(p); } } }
// click-to-place
let placing=null; const ray=new THREE.Raycaster(), floor=new THREE.Plane(new THREE.Vector3(0,1,0),0), hit=new THREE.Vector3();
canvas.addEventListener('pointerdown',e=>{ if(!placing) return; ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1),camera);
  if(ray.ray.intersectPlane(floor,hit)){ const f=freePoint(hit.x,hit.z); spawnProp(placing, f.x, f.z); saveProps(); } placing=null; document.body.style.cursor=''; });
addEventListener('keydown',e=>{ if(e.key==='Escape'){ placing=null; document.body.style.cursor=''; } });

// ---------- streamer events ----------
let laser=null, fishes=[], busy=false, vac=null, treats=[];
function removeProp(p){ for(const c of cats.values()){ if(c.onProp===p) c.dismountNow(); if(c.prop===p) c.releaseProp(); } scene.remove(p.mesh); props=props.filter(x=>x!==p); }
const events = {
  wrestlemania(){
    const list=[...cats.values()].filter(c=>!c.dead); if(list.length<2){ toast('need 2+ cats'); return; }
    const [a,b] = list.sort(()=>Math.random()-0.5).slice(0,2); wrestle(a,b,true);
  },
  refill(){ refill(); toast('refilled'); },
  clearprops(){ clearProps(); toast('props cleared'); },
  catnip(){ for(const c of cats.values()){ for(const e of c.eyes) e.scale.x=3; zoomies(c, 8); c.say(pick(['!!!','WHEEE','MRRAOW','😵‍💫'])); setTimeout(()=>{for(const e of c.eyes) e.scale.x=1;}, 8500); } toast('catnip loaded'); },
  race(m){ race.start({predictions:!!m?.predictions, joinSecs:m?.joinSecs}); },
  vacuum(){ if(vac||PLAY) return; const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.3,16),mat(0x444a55)); body.position.y=0.15; g.add(body); box(g,0.3,0.1,0.3,0xff4d4d,0,0.35,0);
    const z=(ZMIN+ZMAX)/2; g.position.set(-XMAX-2,0,z); scene.add(g); vac={mesh:g,t0:performance.now(),z}; banner('🤖 VACUUM',1500); toast('vacuum');
    for(const c of cats.values()){ if(c.onProp&&c.elev>0){ c.say('👀'); continue; } c.giveUp(); c.say(pick(['!!','😱','NOPE','hss'])); c.play('arch',0.6); const away=c.g.position.z<z?ZMIN+0.5:ZMAX-0.5; setTimeout(()=>{ if(!c.dead) c.walkTo(c.g.position.x+rnd(-2,2), away, 6); },rnd(100,700)); }
    setTimeout(()=>{ if(vac){ scene.remove(vac.mesh); vac=null; } for(const c of cats.values()) if(!c.dead&&Math.random()<0.5) c.say(pick(['…','phew','😾'])); }, 9500); },
  doorbell(){ banner('🔔 ding dong',2000); toast('doorbell');
    for(const c of cats.values()){ if(c.onProp){ c.say('👀'); continue; } c.giveUp(); c.say(pick(['!!','who?','😨'])); const side=c.g.position.x<0?-1:1; c.walkTo(side*(XMAX-0.3), ZMIN+rnd(0.3,1.5), 5.5); c.onArrive=()=>{ c.facing=-Math.PI/2; c.setState('sit'); c.timer=rnd(5,8); }; }
    setTimeout(()=>{ let i=0; for(const c of cats.values()){ if(c.onProp) continue; setTimeout(()=>{ if(c.dead) return; c.giveUp(); c.facing=Math.atan2(-((ZMIN+ZMAX)/2-c.g.position.z), rnd(-4,4)-c.g.position.x); c.play('stalk',2.6);   // creep back one by one
      setTimeout(()=>{ if(!c.dead){ c.say(pick(['…','all clear?','👀'])); c.timer=rnd(0.5,2); } },2700); }, i++*rnd(400,900)); } }, 5000); },
  feeding(){ refill(); const bowls=props.filter(p=>p.type==='bowl'); if(!bowls.length){ toast('no bowls'); return; } banner('🍽️ FEEDING TIME',2500); toast('feeding time');
    let i=0; for(const c of cats.values()){ c.hunger=1; setTimeout(()=>{ if(c.dead) return; if(c.onProp) c.dismountNow(); c.giveUp(); c.say(pick(['FOOD','!!','nom?','🏃'])); c.goTo(pick(bowls)); }, i++*250); } },
  cucumber(){ const list=[...cats.values()].filter(c=>!c.dead&&!c.onProp&&c.state!=='walk'&&!c.noCollide); if(!list.length){ toast('no cat to prank'); return; } const c=pick(list);
    const g=new THREE.Group(); box(g,1.1,0.28,0.28,0x3f9b3f,0,0.14,0); box(g,0.3,0.3,0.3,0x2f7a2f,-0.55,0.15,0); g.rotation.y=rnd(0,Math.PI*2);
    g.position.set(clamp(c.g.position.x-Math.cos(c.facing)*1.4,-XMAX,XMAX),0,clamp(c.g.position.z+Math.sin(c.facing)*1.4,ZMIN,ZMAX)); scene.add(g); toast('cucumber behind '+c.name);
    setTimeout(()=>{ if(c.dead){ scene.remove(g); return; } c.giveUp(); c.facing+=Math.PI;
      setTimeout(()=>{ if(c.dead) return; c.jumpScale=1.9; c.jump(); c.play('arch',1.0); c.say(pick(['😱','WHAT','!!!','AAAA']),'pow'); setTimeout(()=>{ if(!c.dead){ c.jumpScale=1; zoomies(c,3); } },700);
        for(const o of cats.values()) if(o!==c&&!o.dead&&Math.hypot(o.g.position.x-c.g.position.x,o.g.position.z-c.g.position.z)<5){ o.look={x:c.g.position.x,z:c.g.position.z,until:performance.now()/1000+2}; if(Math.random()<0.5) o.say(pick(['?','lol','😹'])); } },400); }, 1500);
    setTimeout(()=>scene.remove(g), 9000); },
  treat(m){ const x=Number.isFinite(+m?.x)?+m.x:rnd(-XMAX+2,XMAX-2), z=Number.isFinite(+m?.z)?+m.z:rnd(ZMIN+1,ZMAX-0.5); const f=freePoint(x,z);
    const t=box(scene,0.5,0.25,0.12,0xffa64d,f.x,12,f.z); box(t,0.2,0.35,0.1,0xffa64d,-0.32,0,0); t.userData.vy=0; treats.push(t); toast('treat incoming'); },
  boxes(m){ const n=clamp(+m?.n||4,1,6); banner('📦 BOXES!',2000); toast('box drop');
    for(let i=0;i<n;i++) setTimeout(()=>{ const f=freePoint(rnd(-XMAX+1.5,XMAX-1.5), rnd(ZMIN+1,ZMAX-1)); const p=spawnProp('box',f.x,f.z); p.temp=true; p.mesh.position.y=10; p.drop=true; setTimeout(()=>{ if(props.includes(p)) removeProp(p); }, 180000); }, i*350); },
  confetti(){ for(let i=0;i<50;i++) setTimeout(()=>{ const f=box(scene,0.25,0.25,0.05,pick([0xff6b6b,0xffd166,0x7fd6ff,0xb28dff,0x9fd6b5]),rnd(-XMAX,XMAX),11+rnd(0,3),rnd(ZMIN,ZMAX)); f.userData.vy=-rnd(1,2); f.userData.conf=true; f.rotation.set(rnd(0,3),rnd(0,3),0); fishes.push(f); }, i*40); },
  nap(){ for(const c of cats.values()){ c.target=null; c.setState('sleep'); c.timer=rnd(8,12); } },
  fish(n=14){ for(let i=0;i<n;i++){ setTimeout(()=>{ const f=box(scene,0.6,0.3,0.12,pick([0x6cc4ff,0xffa64d,0xb6e36b]),rnd(-XMAX,XMAX),13,rnd(ZMIN,ZMAX)); box(f,0.25,0.4,0.1,f.material.color.getHex(),-0.38,0,0); f.userData.vy=0; f.rotation.z=rnd(-0.5,0.5); fishes.push(f); }, i*220); }
    if(!PLAY) for(const c of cats.values()) setTimeout(()=>{ if(!c.dead){ c.walkTo(rnd(-XMAX,XMAX),rnd(ZMIN,ZMAX),4); c.onArrive=()=>c.jump(); } }, rnd(300,2500)); },
  laser(){ if(laser) return; laser=new THREE.Mesh(new THREE.CircleGeometry(0.18,12),new THREE.MeshBasicMaterial({color:0xff2b2b})); laser.rotation.x=-Math.PI/2; laser.position.y=0.02; laser.userData.t0=performance.now(); scene.add(laser);
    const chase=()=>{ if(!laser) return; for(const c of cats.values()){ c.walkTo(laser.position.x+rnd(-0.6,0.6), laser.position.z, 5); c.onArrive=()=>{ if(Math.random()<0.5) c.jump(); }; } };
    if(!PLAY){ chase(); laser.userData.iv=setInterval(chase,900); }
    setTimeout(()=>{ clearInterval(laser.userData.iv); scene.remove(laser); laser=null; for(const c of cats.values()) c.say('…'); }, 12000); }
};
function toast(t){ logLine('event','',t); }
// secret likes/dislikes: a stable hash of the pair → -1..1. Nobody configures it, it just is.
function affinity(a,b){ const k=[a.key,b.key].sort().join('|'); let h=2166136261; for(let i=0;i<k.length;i++){ h^=k.charCodeAt(i); h=Math.imul(h,16777619); } return ((h>>>0)%2001)/1000-1; }
const isFriend=(a,b)=>affinity(a,b)>0.55, isRival=(a,b)=>affinity(a,b)<-0.55;
function near(me,r,filter){ let best=null,bd=r; for(const c of cats.values()){ if(c===me||c.dead||(filter&&!filter(c))) continue; const d=Math.hypot(c.g.position.x-me.g.position.x,c.g.position.z-me.g.position.z); if(d<bd){ bd=d; best=c; } } return best; }
const faceAt=(me,o)=>{ me.facing=Math.atan2(-(o.g.position.z-me.g.position.z), o.g.position.x-me.g.position.x); };
function greet(a,b){   // friends meeting: nose boop
  a.noCollide=b.noCollide=true; a.pal=b; faceAt(a,b); faceAt(b,a); a.play('nuzzle',1.2,false); b.play('nuzzle',1.2,false); a.say(pick(['💕',':3','hi '+b.name])); setTimeout(()=>{ if(!b.dead) b.say(pick(['💕','prrr','hi!'])); },350);
  setTimeout(()=>{ a.noCollide=b.noCollide=false; a.pal=null; },1600);
}
function ambush(a,v){   // a is hiding in a box, v just walked past
  a.hiding=false; faceAt(a,v); a.play('swipe',0.8,true); a.say(pick(['SWIPE','gotcha!','>:3','BOO']),'pow');
  v.giveUp(); faceAt(v,a); v.play('knocked',0.7); setTimeout(()=>{ if(!v.dead) v.say(pick(['!!','HEY','😾','😱'])); },120);
  setTimeout(()=>{ if(a.dead||v.dead) return;
    if(isFriend(a,v)){ a.say(pick(['😹','lol','hehe'])); v.say(pick(['😹','rude','hehe'])); v.timer=1.5; }
    else if(!busy && (isRival(a,v)||Math.random()<0.5)){ a.dismountNow(); wrestle(v,a,false); }   // the victim starts it
    else { v.say(pick(['hmph','nope','😾'])); const dx=v.g.position.x-a.g.position.x, dz=v.g.position.z-a.g.position.z, d=Math.hypot(dx,dz)||1; v.walkTo(v.g.position.x+dx/d*5, v.g.position.z+dz/d*3, 4.5); a.timer=rnd(3,6); }
  }, 900);
}
// sneak attack: get out of the victim's sight — behind it, round the far side of furniture, into a box, or up on something — wait, then spring
function sneak(cat, target){
  const ok=c=>!c.dead&&c!==cat&&!c.noCollide&&!c.onProp&&c.state!=='walk'&&!c.sneakTarget;
  const t=target||near(cat,12,c=>ok(c)&&!isFriend(cat,c)&&(isRival(cat,c)||Math.random()<0.5)); if(!t||t.dead) return false;
  const tp=t.g.position, dist=(x,z)=>Math.hypot(x-tp.x,z-tp.z);
  const perch=props.find(p=>(p.h>0)&&p.users<(p.cap||1)&&dist(p.x,p.z)<8&&dist(p.x,p.z)>2), box=props.find(p=>p.type==='box'&&p.users<1&&dist(p.x,p.z)<9);
  cat.sneakTarget=t; cat.sneakWaits=0; cat.releaseProp(); if(cat.onProp) cat.dismountNow();
  const r=Math.random();
  if(perch && r<0.35){ cat.goTo(perch); cat.say(pick(['…','👀'])); return true; }   // crouch up high, leap off
  if(box && r<0.6){ cat.goTo(box); return true; }                                   // hide in the box, pop out
  const spots=[{x:tp.x-Math.cos(t.facing)*2.6, z:tp.z+Math.sin(t.facing)*2.6}];    // right behind it
  for(const o of obstacles){ const cx=(o.x0+o.x1)/2, cz=(o.z0+o.z1)/2, rr=Math.max(o.x1-o.x0,o.z1-o.z0)/2+1.0, dx=cx-tp.x, dz=cz-tp.z, d=Math.hypot(dx,dz)||1; if(d<9) spots.push({x:cx+dx/d*rr, z:cz+dz/d*rr}); }
  for(const p of props){ if(['toy','bowl','water'].includes(p.type)) continue; const dx=p.x-tp.x, dz=p.z-tp.z, d=Math.hypot(dx,dz)||1; if(d<9&&d>1.5) spots.push({x:p.x+dx/d*(p.r+1.0), z:p.z+dz/d*(p.r+1.0)}); }
  const sp=pick(spots.filter(q=>dist(q.x,q.z)>1.8)); if(!sp){ cat.sneakTarget=null; return false; }
  const f=freePoint(sp.x,sp.z); cat.walkTo(f.x,f.z,2.8); if(Math.random()<0.5) cat.say(pick(['…','>:3','hehe']));
  cat.onArrive=()=>{ const v=cat.sneakTarget; if(!v||v.dead){ cat.sneakTarget=null; return; } faceAt(cat,v); cat.play('crouch',rnd(3,6)); cat.timer=99; };
  return true;
}
function sneakPounce(cat){
  const t=cat.sneakTarget; cat.sneakTarget=null; if(!t||t.dead||cat.dead) return;
  const d=()=>Math.hypot(t.g.position.x-cat.g.position.x,t.g.position.z-cat.g.position.z);
  if(d()>7){ cat.say('…'); if(cat.onProp&&!cat.inBox) cat.dismount(); return; }   // they wandered off
  const strike=()=>{ if(cat.dead||t.dead) return; faceAt(cat,t); cat.say(pick(['GOTCHA','BOO','>:3','sneak attack!']),'pow');
    setTimeout(()=>{ if(cat.dead||t.dead) return;
      if(d()<2.6){ t.giveUp(); faceAt(t,cat); t.play('knocked',0.7); t.say(pick(['!!','😱','HEY','😾']));
        setTimeout(()=>{ if(cat.dead||t.dead) return; if(isFriend(cat,t)) t.say(pick(['😹','rude','lol'])); else if(!busy&&(isRival(cat,t)||Math.random()<0.4)) wrestle(t,cat,false); else t.say(pick(['hmph','😾'])); },800); }
      else cat.say('missed'); }, 650); };
  if(cat.elev>0){   // leap off the perch straight at them
    const p=cat.onProp; cat.onProp=null; cat.noCollide=false; cat.releaseProp(); const f=freePoint(t.g.position.x+rnd(-0.4,0.4), t.g.position.z+rnd(-0.4,0.4)); faceAt(cat,t); cat.hopTo(f.x,f.z,0); strike(); return; }
  if(cat.onProp) cat.dismountNow();
  if(d()>3){ cat.walkTo(t.g.position.x, t.g.position.z, 7); cat.onArrive=()=>{ cat.play('pounce',1.0); strike(); }; }   // dash then pounce
  else { cat.play('pounce',1.0); strike(); }
}
function stalk(cat, target){   // creep low toward a cat (or the ball), then pounce
  target=target||near(cat,9,c=>c.state!=='walk'&&!c.noCollide); const ball=props.find(p=>p.type==='toy');
  const tx=target?target.g.position.x:ball?ball.x:cat.g.position.x+rnd(-4,4), tz=target?target.g.position.z:ball?ball.z:cat.g.position.z+rnd(-3,3);
  cat.facing=Math.atan2(-(tz-cat.g.position.z), tx-cat.g.position.x); cat.releaseProp(); cat.play('stalk',2.6);
  setTimeout(()=>{ if(cat.dead) return; cat.facing=Math.atan2(-(tz-cat.g.position.z), tx-cat.g.position.x); cat.play('pounce',1.0);
    setTimeout(()=>{ if(cat.dead||!target||target.dead) return; if(Math.hypot(target.g.position.x-cat.g.position.x,target.g.position.z-cat.g.position.z)<2.2){ faceAt(target,cat); target.play('knocked',0.7); target.say(pick(['!!','😾','hey!'])); cat.say(pick(['gotcha','>:3','boo']));
      if(isRival(cat,target)&&!busy&&Math.random()<0.5) setTimeout(()=>{ if(!cat.dead&&!target.dead&&!busy) wrestle(target,cat,false); },900); } else cat.say('…'); }, 700); }, 2600);
}
// full = the streamer event (centre stage, 8 rounds, trophy); otherwise a quick scrap where the cats already are
function wrestle(a,b,full){
  busy=true;
  for(const c of [a,b]){ c.releaseProp(); c.anim&&c.resetAnim(); c.noCollide=true; }
  const mx=full?rnd(-4,4):(a.g.position.x+b.g.position.x)/2, mz=clamp(full?rnd(ZMIN+0.3,ZMAX-0.3):(a.g.position.z+b.g.position.z)/2, ZMIN+0.3, ZMAX-0.3);
  a.say(full?'👊':pick(['grr','😾','MINE'])); setTimeout(()=>{ if(!b.dead) b.say('😾'); },300);
  a.walkTo(mx-1,mz,4); b.walkTo(mx+1,mz,4); a.onArrive=b.onArrive=function(){ this.timer=12; };   // don't wander off mid-fight
  const bail=()=>{ if(a.dead||b.dead){ busy=false; a.noCollide=b.noCollide=false; return true; } return false; };
  const rounds=full?8:4;
  setTimeout(()=>{ if(bail()) return; a.facing=0; b.facing=Math.PI; let n=0;
    const iv=setInterval(()=>{ if(bail()){ clearInterval(iv); return; } const c=n%2?a:b, o=n%2?b:a;
      if(n<rounds-1){ c.play('tackle',0.5,true); setTimeout(()=>{ if(!o.dead) o.play('knocked',0.75,true); },160); c.say(pick(['POW','BONK','BAP','WHAP']),'pow'); }
      else { a.spin(); b.spin(); a.say('💥','pow'); }   // final tumble
      if(++n>=rounds) clearInterval(iv); }, 700);
    setTimeout(()=>{ if(bail()) return; const aff=affinity(a,b), w=Math.random()<0.5?a:b, l=w===a?b:a; l.play('knocked',0.8,true); setTimeout(()=>{ if(!l.dead){ l.setState('loaf'); l.timer=full?6:3; } },800); l.say('😵'); w.jump();
      if(full){ setTimeout(()=>{ if(!w.dead) w.jump(); },500); w.say('🏆 '+w.name+' wins!'); } else { w.say(pick(['hmph','😤','mine.'])); w.timer=1.5; }
      busy=false; setTimeout(()=>{a.noCollide=b.noCollide=false;},1500); }, rounds*700+300);
  }, full?2200:1500);
}
// newcomer a arrives at bowl/water p while b is using it: hiss-off, then one of them eats
function squabble(a,b,p){
  a.facing=Math.atan2(-(b.g.position.z-a.g.position.z), b.g.position.x-a.g.position.x); b.facing=a.facing+Math.PI;
  a.play('arch',1.0,true); b.play('arch',1.0,true); a.say(pick(['hsss','MINE','>:3'])); setTimeout(()=>{ if(!b.dead) b.say(pick(['HISS','no!','>:('])); },250);
  setTimeout(()=>{ if(a.dead||b.dead||!p.mesh.parent) return;   // arch ended: both reservations were dropped by the anim reset
    const winner=Math.random()<(isRival(a,b)?0.6:0.5)?a:b, loser=winner===a?b:a;   // the pushy one usually wins
    loser.say(pick(['😾','fine.','hmph'])); loser.walkTo(loser.g.position.x+rnd(-4,4), loser.g.position.z+rnd(-3,3), 3);
    p.users++; winner.prop=p; winner.useProp(p); }, 1150);
}

// ---------- twitch reactions (subs, bits, raids, follows) ----------
const randomLook=()=>({body:pick(Object.keys(COLORS)), eyes:pick(Object.keys(EYES)), pattern:pick(PATTERNS), hat:pick(HATS)});
function celebrate(){ let i=0; for(const c of cats.values()) setTimeout(()=>{ if(c.dead) return; c.jump(); if(Math.random()<0.35) c.say(pick(['yay!','🎉','MEOW','!!'])); }, i++*90); }
function handleTwitch(m){
  const key=m.key||'twitch:'+String(m.id||m.user).toLowerCase(); let cat=cats.get(key);
  switch(m.kind){
    case 'follow': { const c=cat||pick([...cats.values()]); if(c){ c.target=null; c.setState('idle'); c.facing=-Math.PI/2; c.wave(); c.say('hi '+m.user+'!'); } toast(m.user+' followed'); break; }
    case 'sub': case 'resub': {
      if(!cat){ cat=spawnCat(key, m.user, {hat:'party'}); } else if(cat.look.hat==='none'){ cat.look.hat='party'; cat.build(); }
      net.send({type:'cat', key, name:m.user, look:cat.look});
      cat.jump(); cat.say(m.kind==='resub'?`${m.months} months! 🎉`:'🎉 subbed!');
      celebrate(); events.fish(8); events.confetti(); toast(m.user+(m.kind==='resub'?' resubbed':' subscribed')); break; }
    case 'gift': { if(cat){ cat.jump(); cat.say(`🎁 x${m.count}`); } celebrate(); events.fish(clamp(4+m.count*2,6,30)); toast(m.user+' gifted '+m.count); break; }
    case 'cheer': { if(cat){ cat.jump(); cat.say(`💎 ${m.bits}`); } events.fish(clamp(Math.round(m.bits/50),3,30)); if(m.bits>=500) celebrate(); toast(m.user+' cheered '+m.bits); break; }
    case 'raid': {
      const real=[...cats.values()].filter(c=>!c.visitor).length, n=Math.min(clamp(Math.round((m.viewers||1)/5),2,8), MAX_CATS-real);   // visitors never push out real chatters
      for(let i=0;i<n;i++) setTimeout(()=>{ const c=spawnCat('raid:'+performance.now()+':'+i, m.user+"'s crew", randomLook(), true); c.visitor=true; c.say(pick(['RAID!','hi!!','🏴‍☠️'])); zoomies(c,5);
        setTimeout(()=>{ if(!c.dead){ c.say('bye!'); setTimeout(()=>removeCat(c),900); } }, 90000); }, i*250);   // visitors leave after 90s
      for(const c of cats.values()) zoomies(c,3); events.boxes({n:clamp(Math.round((m.viewers||1)/10),2,5)});
      toast(m.user+' raided with '+m.viewers); break; }
  }
}

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
addEventListener('keydown',e=>{ if(!PLAY&&e.key==='h'&&document.activeElement.tagName!=='INPUT') document.body.classList.toggle('hidden'); });
// URL params for OBS: ?ui=0&bg=0&tags=0
const q=new URLSearchParams(location.search);
if(q.get('depth')==='0'){ ZMIN=-1.6; ZMAX=1.8; camera.position.set(0,5.5,24); camera.lookAt(0,0.8,0); }
if(q.get('ui')==='0') document.body.classList.add('hidden');
if(q.get('bg')==='0') document.body.classList.remove('demo-bg');
if(q.get('tags')==='0') labels.classList.add('notags');

// ---------- environments ----------
// a floor, walls and decor; some furniture doubles as a prop cats can get on. Chosen by ?env=, else the server setting.
const ENVS=['none','bedroom','kitchen','living','garden'], PERCHY=['bed','couch','counter','tree'];
let envGroup=null, envName='none', envLocked=false;
function setEnv(name){ if(!ENVS.includes(name)) name='none'; if(name===envName&&(envGroup||name==='none')) return; envName=name;
  if(envGroup){ scene.remove(envGroup); envGroup=null; } for(const p of [...props]) if(p.env) removeProp(p); obstacles=[];
  document.body.classList.toggle('env', name!=='none');
  if(name==='none') return;
  const g=envGroup=new THREE.Group(); scene.add(g);
  const W=XMAX+3.5, ZB=ZMIN-3.5, ZF=ZMAX+4, H=10;
  const walls=c=>{ box(g,2*W,H,0.3,c,0,H/2,ZB); box(g,0.3,H,ZF-ZB,darken(c,0.88),-W,H/2,(ZB+ZF)/2); box(g,0.3,H,ZF-ZB,darken(c,0.88),W,H/2,(ZB+ZF)/2); box(g,2*W,0.25,0.35,darken(c,0.7),0,0.12,ZB+0.05); };
  const floor=c=>box(g,2*W,0.2,ZF-ZB,c,0,-0.1,(ZB+ZF)/2);
  const win=(x,y=5.2)=>{ box(g,3.4,2.8,0.1,0x9fd8ff,x,y,ZB+0.2); box(g,3.8,0.22,0.2,0xffffff,x,y+1.5,ZB+0.25); box(g,3.8,0.22,0.2,0xffffff,x,y-1.5,ZB+0.25); box(g,0.22,3.2,0.2,0xffffff,x-1.8,y,ZB+0.25); box(g,0.22,3.2,0.2,0xffffff,x+1.8,y,ZB+0.25); box(g,0.15,2.8,0.15,0xffffff,x,y,ZB+0.27); box(g,0.9,0.9,0.4,0xffffff,x+0.9,y+0.6,ZB+0.3); };
  const furn=(type,x,z)=>{ const p=spawnProp(type,x,z); p.env=true; return p; };
  const solid=(w,h,d,c,x,y,z)=>{ addObstacle(x,z,w,d); return box(g,w,h,d,c,x,y,z); };   // decor that stands on the floor
  if(name==='bedroom'){ floor(0xb59a7f); walls(0xcdb6da); win(4.5); box(g,7.5,0.06,4.6,0xd9788a,-2.5,0.03,-1); box(g,6.5,0.04,3.8,0xe89aa8,-2.5,0.07,-1);
    furn('bed',-7,-6.2); solid(1.3,1.2,1.3,0x8b5a3c,-2.6,0.6,-8.6); box(g,0.15,0.9,0.15,0x333333,-2.6,1.65,-8.6); box(g,1.0,0.7,1.0,0xffe9a8,-2.6,2.4,-8.6);
    box(g,2.6,3.2,0.08,0xffb3c6,-9.5,5.4,ZB+0.2); box(g,1.8,1.3,0.1,0xf28c38,-9.5,5.6,ZB+0.25); box(g,1.2,0.4,0.1,0x2b2b33,-9.5,4.6,ZB+0.25);
    solid(2.2,2.0,1.2,0x8b5a3c,10,1.0,-8.5); box(g,0.9,0.08,0.9,0x5aa14f,10,2.4,-8.5); }
  if(name==='kitchen'){ floor(0xe6e0d3); for(let i=-3;i<=3;i++) for(let j=-2;j<=2;j++) if((i+j)%2===0) box(g,3.9,0.02,2.9,0xd6cfc0,i*4,0.01,j*3-2); walls(0xf3e7c6); win(-1);
    solid(2.4,5.2,1.4,0xdde3e8,10.5,2.6,-9.0); box(g,0.15,1.2,0.15,0x8a8f96,9.5,3.4,-8.2); box(g,2.4,0.1,1.4,0xb8c0c8,10.5,3.6,-9.0);
    furn('counter',-8,-8.6); furn('counter',-4.2,-8.6); box(g,2.2,0.08,1.1,0x9fd0ff,-8,1.8,-8.6);
    solid(3.4,1.6,1.4,0xd8d8d8,3.5,0.8,-8.6); for(const [x,z] of [[-0.8,-0.35],[0.8,-0.35],[-0.8,0.35],[0.8,0.35]]) box(g,0.7,0.06,0.7,0x222222,3.5+x,1.64,-8.6+z); box(g,3.4,0.9,0.15,0xc9c9c9,3.5,2.05,-9.25);
    solid(3,1.3,2,0x8b5a3c,7,0.65,-1.5); box(g,3.2,0.12,2.2,0xa0693f,7,1.36,-1.5); }
  if(name==='living'){ floor(0xa78b6a); walls(0xd8e2c4); win(6); box(g,8,0.06,5,0x7a9bd1,-1,0.03,-1.5);
    furn('couch',-6.5,-6.5); solid(3.2,0.5,1.6,0x8b5a3c,-6.5,0.25,-2.8); box(g,3.4,0.1,1.8,0xa0693f,-6.5,0.55,-2.8);
    solid(3.6,0.9,1.2,0x3a3a3a,5.5,0.45,-9.0); box(g,3.4,2.0,0.2,0x111111,5.5,2.1,-9.0); box(g,3.0,1.7,0.05,0x2a4a6a,5.5,2.1,-8.88);
    solid(2.4,5.0,1.0,0x8b5a3c,11,2.5,-9.0); for(let i=0;i<4;i++){ box(g,2.2,0.08,0.9,0xa0693f,11,0.9+i*1.2,-9.0); for(let k=0;k<5;k++) box(g,0.3,0.9,0.7,pick([0xff6b6b,0xffd166,0x7fd6ff,0xb28dff,0x9fd6b5]),10.1+k*0.42,1.4+i*1.2,-9.0); }
    solid(1.0,0.9,1.0,0xc9764b,-11,0.45,-8.5); const pl=new THREE.Mesh(new THREE.SphereGeometry(1.1,10,8),mat(0x5aa14f)); pl.position.set(-11,1.9,-8.5); g.add(pl); }
  if(name==='garden'){ floor(0x6fae5a); box(g,2*W,H,0.3,0x9fd3ff,0,H/2,ZB); const sun=new THREE.Mesh(new THREE.CircleGeometry(1.4,24),new THREE.MeshBasicMaterial({color:0xffe27a})); sun.position.set(-9,8,ZB+0.2); g.add(sun);
    for(let x=-W;x<=W;x+=2.4){ box(g,0.3,1.8,0.3,0xc9a06a,x,0.9,ZB+0.6); } box(g,2*W,0.25,0.15,0xc9a06a,0,1.3,ZB+0.6); box(g,2*W,0.25,0.15,0xc9a06a,0,0.6,ZB+0.6);
    for(let i=0;i<14;i++){ const x=rnd(-W+1,W-1), z=rnd(ZB+1,ZB+2.2); box(g,0.08,0.5,0.08,0x3f9b3f,x,0.25,z); box(g,0.3,0.25,0.3,pick([0xff6b6b,0xffd166,0xff9ecf,0xffffff]),x,0.55,z); }
    furn('tree',8.5,-6); solid(1.6,0.35,1.6,0x8a8f96,-8,0.17,-7.5); solid(1.2,0.3,1.2,0x9aa0a8,-6.3,0.15,-8.2); }
}
// ---------- no-go zones ----------
// Screen-space rects (fractions of the viewport — the webcam, alerts box…) turned into floor-space convex polygons.
// Top edge unprojects at foot level, bottom edge at head height, so a cat can't poke its head up into the rect.
let zones=[], zoneQuads=[], zonesLocked=false;   // locked = came from ?nogo=, server can't override
const CAT_H=2.1, ZONE_PAD=0.6;
const zonesEl=document.getElementById('zones');
function unproj(sx,sy,y){ const r=new THREE.Raycaster(); r.setFromCamera(new THREE.Vector2(sx*2-1,1-sy*2),camera); const v=new THREE.Vector3();
  if(!r.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-y),v)) r.ray.at(200,v);   // above the horizon → just "very far"
  return {x:v.x, z:v.z}; }
function rebuildZones(){
  camera.updateMatrixWorld(); camera.updateProjectionMatrix();   // may run before the first render — lookAt() alone leaves matrixWorld stale
  zoneQuads=[];
  for(const r of zones){
    const pts=[unproj(r.x,r.y,0),unproj(r.x+r.w,r.y,0),unproj(r.x+r.w,r.y+r.h,CAT_H),unproj(r.x,r.y+r.h,CAT_H)];
    const cx=pts.reduce((s,p)=>s+p.x,0)/4, cz=pts.reduce((s,p)=>s+p.z,0)/4, edges=[];
    for(let i=0;i<4;i++){ const a=pts[i], b=pts[(i+1)%4];
      // edges fully outside the stage are walls, not real boundaries — pushing "out" through them would just re-clamp into the zone
      if((a.x>XMAX&&b.x>XMAX)||(a.x<-XMAX&&b.x<-XMAX)||(a.z>ZMAX&&b.z>ZMAX)||(a.z<ZMIN&&b.z<ZMIN)) continue;
      let nx=b.z-a.z, nz=-(b.x-a.x); const l=Math.hypot(nx,nz)||1; nx/=l; nz/=l; if((cx-a.x)*nx+(cz-a.z)*nz>0){ nx=-nx; nz=-nz; }   // outward
      edges.push({a,nx,nz}); }
    if(edges.length) zoneQuads.push({pts,edges});
  }
  drawZones();
}
function zoneDepth(q,x,z){ let d=-1e9, e=null; for(const ed of q.edges){ const k=(x-ed.a.x)*ed.nx+(z-ed.a.z)*ed.nz; if(k>d){ d=k; e=ed; } } return {d,e}; }   // d<0 → inside
// room decor footprints (axis-aligned rects on the floor). Cats steer round them, never target inside them, and get clamped out each frame.
let obstacles=[];
function addObstacle(x,z,w,d){ obstacles.push({x0:x-w/2,x1:x+w/2,z0:z-d/2,z1:z+d/2}); }
function obstaclePush(x,z,pad){   // nearest-edge push out of any expanded rect; returns the moved point and the push normal
  let nx=0, nz=0, rect=null;
  for(const o of obstacles){ if(x>o.x0-pad&&x<o.x1+pad&&z>o.z0-pad&&z<o.z1+pad){ const dl=x-(o.x0-pad), dr=(o.x1+pad)-x, dn=z-(o.z0-pad), df=(o.z1+pad)-z, m=Math.min(dl,dr,dn,df); rect=o;
    if(m===dl){ x=o.x0-pad; nx=-1; } else if(m===dr){ x=o.x1+pad; nx=1; } else if(m===dn){ z=o.z0-pad; nz=-1; } else { z=o.z1+pad; nz=1; } } }
  return {x,z,nx,nz,rect}; }
function freePoint(x,z){ x=clamp(x,-XMAX,XMAX); z=clamp(z,ZMIN,ZMAX);
  if(obstacles.length){ const o=obstaclePush(x,z,0.7); x=clamp(o.x,-XMAX,XMAX); z=clamp(o.z,ZMIN,ZMAX); }
  for(let k=0;k<3&&zoneQuads.length;k++) for(const q of zoneQuads){ const {d,e}=zoneDepth(q,x,z); if(d<ZONE_PAD){ x=clamp(x+e.nx*(ZONE_PAD-d+0.05),-XMAX,XMAX); z=clamp(z+e.nz*(ZONE_PAD-d+0.05),ZMIN,ZMAX); } }
  return {x,z}; }
function drawZones(){ zonesEl.innerHTML=''; for(const r of zones){ const d=document.createElement('div'); d.className='zone'; Object.assign(d.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'}); zonesEl.appendChild(d); } }
function saveZones(){ if(!zonesLocked) net.send({type:'zones', zones}); }
// draw a zone by dragging on the stage
let drawing=false, drag=null;
const dragRect=e=>{ const x1=clamp(e.clientX/innerWidth,0,1), y1=clamp(e.clientY/innerHeight,0,1), r3=v=>Math.round(v*1000)/1000; return {x:r3(Math.min(drag.x0,x1)), y:r3(Math.min(drag.y0,y1)), w:r3(Math.abs(x1-drag.x0)), h:r3(Math.abs(y1-drag.y0))}; };
canvas.addEventListener('pointerdown',e=>{ if(!drawing) return; drag={x0:e.clientX/innerWidth, y0:e.clientY/innerHeight, el:document.createElement('div')}; drag.el.className='zone tmp'; zonesEl.appendChild(drag.el); });
addEventListener('pointermove',e=>{ if(!drag) return; const r=dragRect(e); Object.assign(drag.el.style,{left:r.x*100+'%',top:r.y*100+'%',width:r.w*100+'%',height:r.h*100+'%'}); });
addEventListener('pointerup',e=>{ if(!drag) return; const r=dragRect(e); drag.el.remove(); drag=null; drawing=false; document.body.style.cursor=''; if(r.w>0.01&&r.h>0.01){ zones.push(r); rebuildZones(); saveZones(); } });
$('#drawzone').onclick=()=>{ drawing=true; placing=null; document.body.style.cursor='crosshair'; };
$('#clearzones').onclick=()=>{ zones=[]; rebuildZones(); saveZones(); };
addEventListener('resize', rebuildZones);
// ?nogo=x,y,w,h;x,y,w,h  (fractions, or percentages if any value > 1)   ?zones=1 shows them even in overlay mode
if(q.get('nogo')){ zones=q.get('nogo').split(';').map(s=>{ let [x,y,w,h]=s.split(',').map(Number); if([x,y,w,h].some(v=>v>1)){ x/=100;y/=100;w/=100;h/=100; } return {x,y,w,h}; }).filter(r=>[r.x,r.y,r.w,r.h].every(Number.isFinite)); zonesLocked=true; }
if(q.get('zones')==='1') document.body.classList.add('showzones');
if(q.get('env')){ envLocked=true; setEnv(q.get('env')); }
document.querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>{ setEnv(b.dataset.env); fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json','x-key':q.get('key')||''},body:JSON.stringify({env:b.dataset.env})}).catch(()=>{}); });
rebuildZones();

// ---------- companion page (/play) ----------
// overlay streams compact cat state to the server while anyone is watching; the companion mirrors it and sends clicks back as pokes
let watchers=0, lastState='';
if(!PLAY) setInterval(()=>{ if(!watchers) return;
  const payload=JSON.stringify({type:'state', cats:[...cats.values()].map(c=>[c.key,c.name,+c.g.position.x.toFixed(2),+c.g.position.z.toFixed(2),+c.facing.toFixed(2),c.state,c.bubbleEl?c.bubbleEl.textContent:'',c.g.position.y>0.05?1:0,`${c.look.body}/${c.look.eyes}/${c.look.pattern}/${c.look.hat}`])});
  if(payload===lastState) return; lastState=payload; net.send(JSON.parse(payload)); }, 125);
function applyState(m){
  const seen=new Set();
  for(const [key,name,x,z,f,state,bubble,jumping,lk] of m.cats){ seen.add(key); let c=cats.get(key);
    if(!c){ const [body,eyes,pattern,hat]=lk.split('/'); c=spawnCat(key,name,{body,eyes,pattern,hat},true); c.mirror=true; c.g.position.set(x,0,z); c.g.rotation.y=f; c.lk=lk; }
    else if(c.lk!==lk){ const [body,eyes,pattern,hat]=lk.split('/'); c.look={body,eyes,pattern,hat}; c.build(); c.lk=lk; }
    if(Math.hypot(c.g.position.x-x,c.g.position.z-z)>4) c.g.position.set(x,0,z);   // teleport → snap
    c.net={x,z,f}; c.moving=state==='walk'; if(c.state!==state) c.setState(state);
    if(bubble && bubble!==c.lastBubble) c.say(bubble); c.lastBubble=bubble;
    if(jumping && !c.wasJumping) c.jump(); c.wasJumping=jumping;
  }
  for(const c of [...cats.values()]) if(!seen.has(c.key)) removeCat(c);
  const h=document.getElementById('playhint'); if(h) h.textContent=cats.size?`${cats.size} cat${cats.size>1?'s':''} · click one to boop it`:'no cats yet — type !cat in chat';
}
function handlePoke(x,z){   // viewer clicked the stage: nearest cat reacts, or comes over to look
  const f=freePoint(x,z); let best=null, bd=1e9;
  for(const c of cats.values()){ const d=Math.hypot(c.g.position.x-f.x,c.g.position.z-f.z); if(d<bd){ bd=d; best=c; } }
  if(!best) return;
  if(bd<2.5){ stat(best,'boops'); if(best.state!=='idle') best.giveUp(); best.timer=Math.max(best.timer,1); best.facing=-Math.PI/2; best.jump(); best.say(pick(['!','?','mrrp','💕','boop'])); }
  else if(best.state!=='walk'){ best.walkTo(f.x,f.z,3.5); best.onArrive=()=>{ best.facing=-Math.PI/2; best.say('?'); }; }
}
if(PLAY){
  document.body.classList.add('hidden','play');
  const hint=document.createElement('div'); hint.id='playhint'; hint.textContent='connecting…'; document.body.appendChild(hint);
  canvas.addEventListener('pointerdown',e=>{ ray.setFromCamera(new THREE.Vector2(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1),camera);
    if(!ray.ray.intersectPlane(floor,hit)) return; net.send({type:'poke', x:hit.x, z:hit.z});
    const r=document.createElement('div'); r.className='ripple'; r.style.left=e.clientX+'px'; r.style.top=e.clientY+'px'; labels.appendChild(r); setTimeout(()=>r.remove(),600); });
}

function defaultProps(){ spawnProp('bowl',-6,1.5); spawnProp('water',-4.5,1.8); spawnProp('post',7,-3); spawnProp('toy',2,0); spawnProp('box',-8.5,-4); spawnProp('perch',3.5,-5.5); }
// server sends this on connect: persisted cats + prop layout
let booted=false;
function applyInit(m){
  if(m.maxCats) MAX_CATS=m.maxCats;
  if(!envLocked && m.env) setEnv(m.env);
  if(m.cotd){ cotdKey=m.cotd.key; setTimeout(()=>crownCotd(cats.get(cotdKey)), 800); }
  if(!zonesLocked && Array.isArray(m.zones)){ zones=m.zones; rebuildZones(); }
  if(booted){   // reconnect (server restart, wifi blip): keep everything that's on stage, only add what we're missing
    if(!PLAY) for(const c of m.cats||[]) if(!cats.has(c.key)) spawnCat(c.key,c.name,c.look,true);
    return;
  }
  booted=true;
  if(Array.isArray(m.props)) for(const p of m.props) spawnProp(p.type,p.x,p.z); else if(!props.length) defaultProps();
  if(!PLAY) for(const c of m.cats||[]){ const cat=spawnCat(c.key,c.name,c.look,true); cat.last=performance.now()-(Date.now()-c.last); }
}
if(q.get('demo')==='1'){   // standalone demo, no server
  defaultProps();
  handleChat('mochi_fan','!cat orange tabby crown eyes amber');
  handleChat('void_enjoyer','!cat black tuxedo beanie eyes yellow');
  handleChat('cream_puff','!cat cream calico bow eyes blue');
}

// ---------- minigames ----------
const bannerEl=document.getElementById('banner');
function banner(text, ms){ bannerEl.textContent=text||''; bannerEl.classList.toggle('show',!!text); clearTimeout(banner.t); if(text&&ms) banner.t=setTimeout(()=>banner(''),ms); if(!PLAY) net.send({type:'banner',text:text||'',ms:ms||0}); }
// cat race: !join during the window, line up, (optional twitch prediction window), 3-2-1, run right with bursts and distractions. Winner wears a crown until the next race.
const race={ phase:'idle', racers:[], finished:[], t:0, opts:{}, winner:null, champion:null, butterfly:null };
race.lane=function(i,n){ return ZMIN+0.8+(ZMAX-ZMIN-1.6)*(n<2?0.5:i/(n-1)); };
race.join=function(cat){ if(this.phase!=='join') return 'no race open'; if(this.racers.includes(cat)) return 'already in'; if(this.racers.length>=8) return 'race is full';
  this.racers.push(cat); cat.say('🏁'); this.lineup(); return 'joined the race'; };
race.lineup=function(){ const n=this.racers.length; this.racers.forEach((c,i)=>{ c.racing=true; c.noCollide=true; c.walkTo(-XMAX+1.5, this.lane(i,n), 3.5); c.onArrive=()=>{ c.facing=0; c.timer=99; }; }); };
race.start=function(opts={}){ if(this.phase!=='idle'||PLAY) return; this.opts=opts; this.phase='join'; this.racers=[]; this.finished=[]; this.winner=null;
  banner('🏁 CAT RACE — type !join'); toast('race: join window open'); for(const c of cats.values()) if(Math.random()<0.5) c.say(pick(['!join','🏁','race?']));
  setTimeout(()=>{ if(this.phase!=='join') return;
    if(this.racers.length<2){ const extra=[...cats.values()].filter(c=>!c.dead&&!this.racers.includes(c)).sort(()=>Math.random()-0.5).slice(0,4-this.racers.length); for(const c of extra){ this.racers.push(c); c.say('🏁'); } this.lineup(); }   // fill the field
    if(this.racers.length<2){ banner('not enough cats 😿',2500); this.phase='idle'; return; }
    this.phase='lineup'; net.send({type:'race',phase:'roster',racers:this.racers.map(c=>({key:c.key,name:c.name}))});
    banner(opts.predictions?'place your bets! 🏁':'get ready…'); setTimeout(()=>this.countdown(), opts.predictions?32000:4000);
  }, (opts.joinSecs||20)*1000); };
race.countdown=function(){ let n=3; const tick=()=>{ if(this.phase!=='lineup') return; if(n>0){ banner(String(n)); for(const c of this.racers) if(!c.dead) c.say(String(n)); n--; setTimeout(tick,900); } else { banner('GO!',1500); this.go(); } }; tick(); };
race.go=function(){ this.phase='running'; this.t=0; this.finishX=XMAX-1.2;
  this.racers.forEach((c,i)=>{ c.raceBase=rnd(2.6,3.6)*(c.look.size==='fat'?0.85:c.look.size==='kitten'?1.05:1)*(0.9+0.1*c.T.speed); c.raceZ=this.lane(i,this.racers.length); c.nextDistract=rnd(1.5,4); this.run(c); });
  this.butterfly=spawnButterfly(); };
race.run=function(c){ if(c.dead) return; c.racing=true; c.walkTo(this.finishX+0.6, c.raceZ, c.raceBase); c.onArrive=()=>this.finish(c); };
race.update=function(dt,now){ if(this.phase!=='running') return; this.t+=dt;
  for(const c of this.racers){ if(c.dead||this.finished.includes(c)) continue;
    if(c.state==='walk'){ c.speed=Math.max(0.8, c.raceBase*(0.75+0.5*Math.sin(now*3.1+c.ph*7)+0.35*Math.sin(now*7.3+c.ph*3)));   // bursts
      if(c.g.position.x>=this.finishX){ this.finish(c); continue; } }
    c.nextDistract-=dt;
    if(c.nextDistract<=0 && c.state==='walk'){ c.nextDistract=rnd(2.5,6); const r=Math.random();
      if(r<0.5){ const a=pick(['twitch','lickfoot','shake','stretch']), d=a==='stretch'?1.2:0.8; c.play(a,d); c.say(pick(['?','…','hm','itchy'])); setTimeout(()=>{ if(this.phase==='running'&&!this.finished.includes(c)) this.run(c); }, d*1000+100); }
      else if(this.butterfly){ c.say('🦋'); c.walkTo(c.g.position.x+1.5, clamp(this.butterfly.position.z,ZMIN+0.5,ZMAX-0.5), 2.5); c.onArrive=()=>this.run(c); } } }
  if(this.butterfly){ const b=this.butterfly; b.position.x=-XMAX+((this.t*3)%(2*XMAX)); b.position.z=(ZMIN+ZMAX)/2+Math.sin(this.t*1.3)*(ZMAX-ZMIN)*0.4; b.position.y=1.4+Math.sin(this.t*9)*0.3; b.children[0].rotation.x=Math.sin(this.t*40)*0.9; b.children[1].rotation.x=-b.children[0].rotation.x; }
  if(this.t>45) this.end(); };
race.finish=function(c){ if(this.finished.includes(c)) return; this.finished.push(c); c.racing=false; c.target=null; c.onArrive=null; c.setState('idle'); c.timer=3; c.facing=-Math.PI/2;
  if(this.finished.length===1){ this.winner=c; stat(c,'wins'); banner('🏆 '+c.name+' wins!',6000); if(this.champion&&this.champion!==c&&!this.champion.dead){ this.champion.raceCrown=false; this.champion.build(); } this.champion=c; c.raceCrown=true; c.build();
    c.jump(); setTimeout(()=>{ if(!c.dead) c.jump(); },500); c.say('🏆'); net.send({type:'race',phase:'winner',key:c.key,name:c.name}); toast('race: '+c.name+' wins'); setTimeout(()=>this.end(),6000); }
  else c.say(pick(['aw','so close','😾','next time'])); };
race.end=function(){ if(this.phase==='idle') return; const hadWinner=!!this.winner; this.phase='idle';
  for(const c of this.racers){ c.racing=false; c.noCollide=false; if(!c.dead&&c.state==='walk'){ c.target=null; c.onArrive=null; c.setState('idle'); c.timer=rnd(1,3); } }
  if(this.butterfly){ scene.remove(this.butterfly); this.butterfly=null; } if(!hadWinner) net.send({type:'race',phase:'cancel'}); banner(''); };
function spawnButterfly(){ const g=new THREE.Group(); box(g,0.02,0.3,0.4,0xffd166,0,0,-0.2); box(g,0.02,0.3,0.4,0xffd166,0,0,0.2); box(g,0.08,0.08,0.3,0x333333,0,0,0); scene.add(g); return g; }

// ---------- loop ----------
let last=performance.now();
function frame(now){
  const dt=Math.min(0.05,(now-last)/1000); last=now; const t=now/1000;
  // soft collision: push overlapping cats apart
  const arr=[...cats.values()], R=1.3;
  if(!PLAY) for(let i=0;i<arr.length;i++) for(let j=i+1;j<arr.length;j++){ const a=arr[i], b=arr[j]; if(a.noCollide||b.noCollide) continue;
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
  if(!PLAY && obstacles.length) for(const c of cats.values()){ if(c.onProp||c.anim?.name==='hop') continue; const o=obstaclePush(c.g.position.x,c.g.position.z,0.45); c.g.position.x=clamp(o.x,-XMAX,XMAX); c.g.position.z=clamp(o.z,ZMIN,ZMAX); }
  if(!PLAY && zoneQuads.length) for(const c of cats.values()){ if(c.onProp) continue; const f=freePoint(c.g.position.x,c.g.position.z); c.g.position.x=f.x; c.g.position.z=f.z; }   // hard rule: never inside a zone
  for(const c of cats.values()) c.update(dt,t);
  race.update(dt,t);
  if(laser){ const k=(now-laser.userData.t0)/1000; laser.position.x=Math.sin(k*1.1)*7+Math.sin(k*3.7)*1.5; laser.position.z=(ZMIN+ZMAX)/2+Math.cos(k*1.7)*4; }
  for(const f of fishes){ const conf=f.userData.conf; f.userData.vy-=(conf?3:25)*dt; if(conf) f.userData.vy=Math.max(f.userData.vy,-2.5); f.position.y+=f.userData.vy*dt; f.rotation.y+=dt*3; if(conf){ f.rotation.x+=dt*4; f.position.x+=Math.sin(t*3+f.position.z)*dt*1.2; } if(f.position.y<(conf?0.03:0.6)){ scene.remove(f); f.userData.gone=true; } }
  fishes=fishes.filter(f=>!f.userData.gone);
  if(vac){ const k=(now-vac.t0)/1000; vac.mesh.position.x=-XMAX-2+k*(2*XMAX+4)/8.5; vac.mesh.rotation.y+=dt*4;
    for(const c of cats.values()){ const dx=c.g.position.x-vac.mesh.position.x, dz=c.g.position.z-vac.mesh.position.z, d=Math.hypot(dx,dz); if(d<1.7&&d>1e-3&&!c.onProp){ c.g.position.x=clamp(c.g.position.x+dx/d*(1.7-d),-XMAX,XMAX); c.g.position.z=clamp(c.g.position.z+dz/d*(1.7-d),ZMIN,ZMAX); if(c.state!=='walk'){ c.giveUp(); c.walkTo(c.g.position.x+dx/d*3, c.g.position.z+dz/d*3, 6); c.say('!!'); } } } }
  for(const tr of treats){ if(tr.position.y>0.15){ tr.userData.vy-=25*dt; tr.position.y=Math.max(0.15,tr.position.y+tr.userData.vy*dt); tr.rotation.y+=dt*4; if(tr.position.y<=0.15){ tr.userData.landed=t;
      const near4=[...cats.values()].filter(c=>!c.dead).sort((a,b)=>Math.hypot(a.g.position.x-tr.position.x,a.g.position.z-tr.position.z)-Math.hypot(b.g.position.x-tr.position.x,b.g.position.z-tr.position.z)).slice(0,4);
      for(const c of near4){ c.giveUp(); c.say(pick(['!','treat!','MINE'])); c.walkTo(tr.position.x+rnd(-0.4,0.4), tr.position.z+rnd(-0.4,0.4), 4.5); c.onArrive=()=>{ if(tr.userData.gone){ c.say(pick(['aw','😾','too slow'])); return; } tr.userData.gone=true; scene.remove(tr); c.hunger=Math.max(0,c.hunger-0.3); c.play('eat',1.5); c.say(pick(['nom','😋','gotcha'])); }; } } }
    else if(t-tr.userData.landed>25 && !tr.userData.gone){ tr.userData.gone=true; scene.remove(tr); } }
  treats=treats.filter(tr=>!tr.userData.gone);
  for(const p of props) if(p.drop){ p.mesh.position.y=Math.max(0,p.mesh.position.y-dt*16); if(p.mesh.position.y<=0) p.drop=false; }
  renderer.render(scene,camera); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
