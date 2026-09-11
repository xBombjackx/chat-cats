// ---------- scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
let CAM0={x:0,y:10.5,z:31}, LOOK={x:0,y:0.4,z:-2.5};   // 16:9 framing; fitCamera() pulls back on narrower windows so the stage always fits
const ZOOM=Math.max(0.5,Math.min(2.5,+(new URLSearchParams(location.search).get('zoom'))||1));
function fitCamera(){ const aspect=innerWidth/innerHeight, half=Math.tan(camera.fov/2*Math.PI/180)*aspect, d0=Math.hypot(CAM0.x-LOOK.x,CAM0.y-LOOK.y,CAM0.z-LOOK.z);
  const k=Math.max(1,(XMAX+2.5)/half/(d0-6))*ZOOM;   // width needed at the near edge of the stage
  camera.position.set(LOOK.x+(CAM0.x-LOOK.x)*k, LOOK.y+(CAM0.y-LOOK.y)*k, LOOK.z+(CAM0.z-LOOK.z)*k); camera.lookAt(LOOK.x,LOOK.y,LOOK.z); }
const hemi = new THREE.HemisphereLight(0xfff4e0, 0x6b5a7a, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 0.8); sun.position.set(5, 10, 6); scene.add(sun);
const XMAX = 11; let ZMIN = -7, ZMAX = 3;   // depth: ZMIN is far, ZMAX is near the viewer
const PLAY = new URLSearchParams(location.search).get('mode')==='play';   // companion page: mirrors the overlay, no AI of its own
function resize(){ renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth/innerHeight; camera.updateProjectionMatrix(); fitCamera(); }
addEventListener('resize', resize); resize();

// ---------- helpers ----------
const COLORS = {orange:0xf28c38, ginger:0xf28c38, black:0x2b2b33, white:0xf5f1ea, gray:0x8e8e96, grey:0x8e8e96,
  pink:0xf5a3c7, brown:0x7a4b2a, cream:0xf1dfb8, golden:0xd9a441, tan:0xc9a06a, silver:0xb8bcc4, dilute:0x9fa4b0, peach:0xf5c6a0, blue:0x7aa6d9, purple:0xa98bd6, mint:0x9fd6b5, tortie:0x6b3a1e};
const EYES = {green:0x5fd36a, blue:0x5aa9ff, yellow:0xffd54a, amber:0xffa62b, pink:0xff7bd1, red:0xff5252, gold:0xffd54a};
const HATS = ['none','crown','beanie','party','bow','halo'];
const ACCS = ['collar','glasses','scarf','wings','backpack','bowtie','noacc'];   // one accessory; 'noacc' clears it
const PATTERNS = ['solid','tabby','tuxedo','calico','spotted','patch','tortie'];
// personality: multipliers on the idle AI. Picked from the key hash like everything else secret.
const TRAITS = { chill:{}, lazy:{walk:0.5,scrap:0.5,zoom:0,follow:0.7,ambush:0.5,sleep:1.7,speed:0.85,sit:1.6},
  zoomy:{walk:1.5,zoom:2,sleep:0.6,speed:1.3,sit:0.6,ball:1.6}, clingy:{scrap:0.4,follow:2,hiss:0.4,ambush:0.5,greet:2,sit:1.2},
  grumpy:{walk:0.8,scrap:2,follow:0.4,hiss:2.5,ambush:1.8,greet:0.5,hungry:0.6} };
const TRAIT_DEF = {walk:1,scrap:1,zoom:1,follow:1,ambush:1,sleep:1,speed:1,sit:1,ball:1,hiss:1,greet:1,hungry:0.7};
const SIZES = {adult:[1,1,1], kitten:[0.62,0.62,0.62], puppy:[0.62,0.62,0.62], pup:[0.62,0.62,0.62], baby:[0.62,0.62,0.62], fat:[1.12,0.95,1.3], skinny:[0.95,1.06,0.8], chonk:[1.12,0.95,1.3], smol:[0.62,0.62,0.62]};   // body scale multipliers x,y,z
const pick = a => a[Math.floor(Math.random()*a.length)];
const rnd = (a,b) => a + Math.random()*(b-a);
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const normA = a=>Math.atan2(Math.sin(a),Math.cos(a));
function mat(c){ return new THREE.MeshLambertMaterial({color:c}); }
function box(g,w,h,d,c,x,y,z){ const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c)); m.position.set(x,y,z); g.add(m); return m; }
function darken(c,f){ const k=new THREE.Color(c); k.multiplyScalar(f); return k.getHex(); }
function parseColor(s, table){ if(table[s]!=null) return table[s]; if(/^#?[0-9a-f]{6}$/i.test(s)) return parseInt(s.replace('#',''),16); return null; }

// ---------- species ----------
// Every species builds the same rig: body group (scale 0.72), this.head at this.headPos (face/ears/hat are its children), ears[2], eyes[2] (groups),
// legs[4] (pivot y=0.4), tail (group), tongue, hatG (on the head), h (label height). Animations only touch those, so they work for all of them.
function lighten(c,f){ const k=new THREE.Color(c); k.lerp(new THREE.Color(0xffffff), Math.min(1,f-1)); return k.getHex(); }
function buildCat(t,L,c,e,dark,white){ const b=t.body;
  box(b,1.1,0.75,0.8,c,0,0.7,0);                       // stubby torso
  if(L.size==='fat'||L.size==='chonk') box(b,1.0,0.55,0.9,c,0.05,0.42,0);   // belly
  const hd = t.head = new THREE.Group(); t.headPos=new THREE.Vector3(0.55,1.55,0); hd.position.copy(t.headPos); b.add(hd);
  box(hd,1.35,1.2,1.25,c,0,0,0);                        // big head
  t.ears=[ box(hd,0.45,0.42,0.22,c,-0.25,0.75,-0.42), box(hd,0.45,0.42,0.22,c,-0.25,0.75,0.42) ];
  box(hd,0.25,0.24,0.16,0xffb3c6,-0.2,0.72,-0.42); box(hd,0.25,0.24,0.16,0xffb3c6,-0.2,0.72,0.42);
  t.eyes=[]; for(const z of [-0.33,0.33]){ const eg=new THREE.Group(); eg.position.set(0.68,0.05,z); hd.add(eg);
    box(eg,0.08,0.4,0.36,e,0,0,0); box(eg,0.1,0.14,0.12,0x111111,0.01,-0.02,0.03); box(eg,0.12,0.1,0.08,0xffffff,0.02,0.1,-0.08); t.eyes.push(eg); }
  box(hd,0.1,0.1,0.16,0xff8fa3,0.68,-0.25,0);              // nose
  box(hd,0.06,0.06,0.16,0x7a4b2a,0.68,-0.35,-0.1); box(hd,0.06,0.06,0.16,0x7a4b2a,0.68,-0.35,0.1); // w mouth
  t.tongue=box(hd,0.1,0.14,0.14,0xff7b9c,0.7,-0.47,0); t.tongue.visible=false;
  box(hd,0.06,0.16,0.28,0xffa0b8,0.68,-0.27,-0.5); box(hd,0.06,0.16,0.28,0xffa0b8,0.68,-0.27,0.5); // blush
  box(hd,0.06,0.04,0.42,0xffffff,0.69,-0.23,0.5); box(hd,0.06,0.04,0.42,0xffffff,0.69,-0.23,-0.5);   // whiskers
  if(L.pattern==='tuxedo'){ box(b,0.2,0.4,0.45,white,0.5,0.6,0); box(hd,0.1,0.5,0.55,white,0.67,-0.4,0); }
  if(L.pattern==='tabby'){ for(let i=0;i<2;i++) box(b,0.16,0.12,0.85,dark,-0.35+i*0.4,1.1,0); box(hd,0.55,0.12,0.6,dark,0,0.62,0); box(hd,0.16,0.14,0.3,dark,0,0.61,-0.5); box(hd,0.16,0.14,0.3,dark,0,0.61,0.5); }
  if(L.pattern==='calico'){ box(b,0.5,0.35,0.85,0xf28c38,-0.25,0.95,0); box(hd,0.6,0.5,0.55,0x2b2b33,-0.1,0.45,-0.45); box(hd,0.4,0.3,0.3,0xf28c38,0.35,0.35,0.6); }
  t.legs=[]; for(const [x,z] of [[0.35,-0.25],[0.35,0.25],[-0.35,-0.25],[-0.35,0.25]]){ const p=new THREE.Group(); p.position.set(x,0.4,z); box(p,0.32,0.4,0.32,c,0,-0.2,0); box(p,0.33,0.12,0.34,L.pattern==='tuxedo'?white:c,0,-0.35,0); b.add(p); t.legs.push(p); }
  t.tail = new THREE.Group(); t.tail.position.set(-0.55,0.85,0); box(t.tail,0.22,0.7,0.22,c,-0.05,0.3,0); box(t.tail,0.24,0.24,0.24,L.pattern==='tabby'?dark:c,-0.05,0.72,0); t.tail.rotation.z = 0.6; b.add(t.tail);
  if(L.pattern==='tortie'||L.pattern==='spotted'){ const sc=parseColor(L.spots||'',COLORS)??(L.pattern==='tortie'?COLORS.peach:dark);   // mottled patches on both flanks, the back, forehead, a paw and the tail tip
    for(const [x,y,z,w,h] of [[-0.35,0.95,1,0.42,0.3],[0.15,1.02,-1,0.36,0.28],[-0.05,0.58,1,0.3,0.24],[0.3,0.72,-1,0.3,0.3],[-0.42,0.62,-1,0.26,0.22],[0.38,0.95,1,0.22,0.2]]) box(b,w,h,0.06,sc,x,y,z*0.43);
    box(b,0.44,0.28,0.32,sc,-0.28,1.1,0.05);
    if(L.pattern==='tortie'){ box(hd,0.62,0.36,0.6,sc,0.38,0.45,0.32); box(hd,0.5,0.2,0.28,sc,0.42,-0.42,-0.36); box(t.tail,0.26,0.28,0.26,sc,-0.05,0.74,0); box(t.legs[1],0.34,0.22,0.34,sc,0,-0.18,0); } }
  t.hatG=new THREE.Group(); t.hatG.position.set(0,0.6,0); hd.add(t.hatG); t.h=2.05; }
function buildDog(t,L,c,e,dark,white){ const b=t.body, light=lighten(c,1.3);
  box(b,1.5,0.8,0.85,c,0,0.75,0); box(b,0.5,0.5,0.62,light,0.55,0.55,0);   // longer torso, lighter chest
  if(L.size==='fat'||L.size==='chonk') box(b,1.3,0.6,0.95,c,0,0.42,0);
  const hd=t.head=new THREE.Group(); t.headPos=new THREE.Vector3(0.75,1.55,0); hd.position.copy(t.headPos); b.add(hd);
  box(hd,1.1,1.0,1.0,c,0,0,0); box(hd,0.6,0.5,0.62,light,0.75,-0.15,0); box(hd,0.22,0.2,0.24,0x222222,1.06,-0.02,0);   // head, snout, nose
  t.ears=[]; for(const z of [-0.58,0.58]){ const ear=box(hd,0.28,0.7,0.34,dark,-0.15,0.05,z); ear.rotation.x=z<0?-0.25:0.25; t.ears.push(ear); }   // floppy
  t.eyes=[]; for(const z of [-0.3,0.3]){ const eg=new THREE.Group(); eg.position.set(0.53,0.2,z); hd.add(eg); box(eg,0.08,0.26,0.24,e,0,0,0); box(eg,0.1,0.12,0.1,0x111111,0.01,-0.02,0.02); box(eg,0.1,0.07,0.06,0xffffff,0.02,0.07,-0.05); t.eyes.push(eg); }
  box(hd,0.06,0.06,0.3,0x552200,0.98,-0.28,0);
  t.tongue=box(hd,0.14,0.16,0.18,0xff7b9c,0.95,-0.45,0); t.tongue.visible=false;
  if(L.pattern==='patch') box(hd,0.12,0.42,0.42,dark,0.5,0.2,0.3);
  if(L.pattern==='spotted'){ for(const [x,y,z,w] of [[-0.4,0.9,1,0.35],[0.2,1.0,-1,0.3],[-0.1,0.55,1,0.25],[0.45,0.8,-1,0.22]]) box(b,w,w,0.12,dark,x,y,z*0.44); box(hd,0.3,0.3,0.12,dark,-0.2,0.25,-0.51); }
  if(L.pattern==='tuxedo'||L.pattern==='calico') box(b,0.12,0.5,0.6,white,0.76,0.7,0);
  if(L.pattern==='tabby') for(let i=0;i<3;i++) box(b,0.14,0.12,0.9,dark,-0.5+i*0.4,1.16,0);
  t.legs=[]; for(const [x,z] of [[0.5,-0.28],[0.5,0.28],[-0.5,-0.28],[-0.5,0.28]]){ const p=new THREE.Group(); p.position.set(x,0.4,z); box(p,0.3,0.42,0.3,c,0,-0.21,0); box(p,0.32,0.12,0.34,light,0,-0.38,0); b.add(p); t.legs.push(p); }
  t.tail=new THREE.Group(); t.tail.position.set(-0.75,0.95,0); box(t.tail,0.16,0.75,0.16,c,-0.05,0.35,0); box(t.tail,0.2,0.2,0.2,light,-0.05,0.75,0); t.tail.rotation.z=0.9; b.add(t.tail);
  t.hatG=new THREE.Group(); t.hatG.position.set(-0.05,0.5,0); hd.add(t.hatG); t.h=2.15; }
function buildRaccoon(t,L,c,e,dark,white){ const b=t.body, blk=0x2a2a30, lite=0xd8d8dc;
  box(b,1.25,0.85,0.95,c,0,0.72,0); box(b,0.9,0.2,0.9,dark,-0.1,1.2,0);   // torso, darker back
  if(L.size==='fat'||L.size==='chonk') box(b,1.1,0.6,1.0,c,0,0.42,0);
  const hd=t.head=new THREE.Group(); t.headPos=new THREE.Vector3(0.6,1.5,0); hd.position.copy(t.headPos); b.add(hd);
  box(hd,1.15,0.95,1.1,c,0,0,0); box(hd,0.5,0.42,0.5,lite,0.72,-0.18,0); box(hd,0.18,0.16,0.2,blk,1.0,-0.12,0);   // head, snout, nose
  box(hd,0.3,0.34,1.14,blk,0.45,0.08,0); box(hd,0.28,0.14,1.16,lite,0.46,0.34,0); box(hd,0.28,0.14,1.16,lite,0.46,-0.18,0);   // the mask
  t.ears=[ box(hd,0.34,0.36,0.16,dark,-0.15,0.6,-0.42), box(hd,0.34,0.36,0.16,dark,-0.15,0.6,0.42) ]; box(hd,0.2,0.2,0.12,lite,-0.12,0.58,-0.42); box(hd,0.2,0.2,0.12,lite,-0.12,0.58,0.42);
  t.eyes=[]; for(const z of [-0.3,0.3]){ const eg=new THREE.Group(); eg.position.set(0.62,0.08,z); hd.add(eg); box(eg,0.08,0.28,0.26,e,0,0,0); box(eg,0.1,0.12,0.1,0x111111,0.01,-0.02,0.02); box(eg,0.1,0.07,0.06,0xffffff,0.02,0.07,-0.05); t.eyes.push(eg); }
  t.tongue=box(hd,0.1,0.12,0.14,0xff7b9c,0.9,-0.4,0); t.tongue.visible=false;
  box(hd,0.06,0.04,0.4,0xffffff,0.85,-0.2,0.4); box(hd,0.06,0.04,0.4,0xffffff,0.85,-0.2,-0.4);
  if(L.pattern==='tuxedo') box(b,0.14,0.45,0.6,lite,0.63,0.65,0);
  t.legs=[]; for(const [x,z] of [[0.38,-0.27],[0.38,0.27],[-0.38,-0.27],[-0.38,0.27]]){ const p=new THREE.Group(); p.position.set(x,0.4,z); box(p,0.3,0.4,0.3,dark,0,-0.2,0); box(p,0.32,0.12,0.34,blk,0,-0.36,0); b.add(p); t.legs.push(p); }
  t.tail=new THREE.Group(); t.tail.position.set(-0.6,0.8,0); for(let i=0;i<5;i++) box(t.tail,0.36-i*0.03,0.26,0.36-i*0.03,i%2?lite:blk,-0.08*i,0.13+i*0.26,0); t.tail.rotation.z=1.0; b.add(t.tail);   // ringed
  t.hatG=new THREE.Group(); t.hatG.position.set(0,0.5,0); hd.add(t.hatG); t.h=2.05; }
function buildOtter(t,L,c,e,dark,white){ const b=t.body, belly=lighten(c,1.5);
  box(b,1.8,0.7,0.85,c,0,0.6,0); box(b,0.9,0.45,0.62,belly,0.5,0.55,0); box(b,1.2,0.3,0.7,belly,-0.1,0.4,0);   // long low body, pale belly
  if(L.size==='fat'||L.size==='chonk') box(b,1.5,0.5,0.95,c,0,0.4,0);
  const hd=t.head=new THREE.Group(); t.headPos=new THREE.Vector3(0.85,1.25,0); hd.position.copy(t.headPos); b.add(hd);
  box(hd,0.95,0.8,0.95,c,0,0,0); box(hd,0.5,0.42,0.62,belly,0.6,-0.12,0); box(hd,0.2,0.16,0.22,0x222222,0.88,-0.02,0);   // head, muzzle, nose
  t.ears=[ box(hd,0.2,0.2,0.12,dark,-0.15,0.38,-0.42), box(hd,0.2,0.2,0.12,dark,-0.15,0.38,0.42) ];
  t.eyes=[]; for(const z of [-0.27,0.27]){ const eg=new THREE.Group(); eg.position.set(0.48,0.15,z); hd.add(eg); box(eg,0.08,0.24,0.22,e,0,0,0); box(eg,0.09,0.12,0.1,0x111111,0.01,-0.02,0.02); box(eg,0.09,0.07,0.06,0xffffff,0.02,0.06,-0.04); t.eyes.push(eg); }
  for(const z of [-1,1]){ box(hd,0.05,0.03,0.6,0xffffff,0.7,-0.1,z*0.5); box(hd,0.05,0.03,0.55,0xffffff,0.7,-0.18,z*0.48); }   // long whiskers
  t.tongue=box(hd,0.1,0.12,0.14,0xff7b9c,0.78,-0.36,0); t.tongue.visible=false;
  t.legs=[]; for(const [x,z] of [[0.6,-0.28],[0.6,0.28],[-0.6,-0.28],[-0.6,0.28]]){ const p=new THREE.Group(); p.position.set(x,0.4,z); box(p,0.26,0.3,0.26,c,0,-0.15,0); box(p,0.4,0.1,0.42,dark,0.02,-0.33,0); b.add(p); t.legs.push(p); }   // short legs, webbed feet
  t.tail=new THREE.Group(); t.tail.position.set(-0.9,0.55,0); box(t.tail,0.9,0.28,0.5,c,-0.45,0,0); box(t.tail,0.6,0.2,0.32,c,-1.15,0,0); t.tail.rotation.z=0.1; b.add(t.tail);   // thick flat tail
  t.hatG=new THREE.Group(); t.hatG.position.set(0,0.42,0); hd.add(t.hatG); t.h=1.75; }
const SPECIES={
  cat:    { build:buildCat,     body:'orange', tail:{base:0.5,amp:0.25,speed:3,wagX:0.3},  say:{meow:['meow','mrrp','meow~','MEOW','mrow?','prrr'], hiss:['hsss','HISS','>:3','hss'], purr:['prrr','💕',':3'] } },
  dog:    { build:buildDog,     body:'golden', pant:true, tail:{base:0.9,amp:0.35,speed:9,wagX:0.9}, say:{meow:['woof','arf','bork','awoo','wuf?'], hiss:['grrr','GRRR','bark!'], purr:['*wag wag*','💕','happy!'] } },
  raccoon:{ build:buildRaccoon, body:'gray',   tail:{base:1.0,amp:0.15,speed:2.5,wagX:0.2}, say:{meow:['chitter','churr','trill','chrrr?'], hiss:['HISS','screech','grr'], purr:['churr','💕','trill~'] } },
  otter:  { build:buildOtter,   body:'brown',  tail:{base:0.1,amp:0.12,speed:2,wagX:0.5},  say:{meow:['squeak','chirp','eep','squee'], hiss:['hiss','huff','HUFF'], purr:['chirp~','💕','eep'] } },
};
const SPAWN_CMDS={cat:'cat',kitty:'cat',dog:'dog',pup:'dog',puppy:'dog',doggo:'dog',raccoon:'raccoon',trashpanda:'raccoon',otter:'otter'};
let SPECIES_MODE='cat';   // what a spawn command produces: one species for the whole channel, or 'mixed' (each command spawns its own)
const voice=(c,k)=>{ const S=SPECIES[c.look.species]||SPECIES.cat; return pick(S.say[k]||SPECIES.cat.say[k]); };

// ---------- cat ----------
class Cat {
  constructor(key, name, look){
    this.key = key; this.name = name; this.last = performance.now();
    this.look = Object.assign({species:'cat', body:'orange', eyes:'green', pattern:'solid', hat:'none', size:'adult'}, look);
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
    const L = this.look, S = SPECIES[L.species]||SPECIES.cat, c = parseColor(L.body,COLORS) ?? COLORS[S.body], e = parseColor(L.eyes,EYES) ?? EYES.green;
    const g = this.g, dark = darken(c, 0.72), white=0xf5f1ea;
    this.body = new THREE.Group(); g.add(this.body);
    const sz=SIZES[L.size]||SIZES.adult; this.baseScale=new THREE.Vector3(0.72*sz[0],0.72*sz[1],0.72*sz[2]);
    const b = this.body; b.scale.copy(this.baseScale);   // chibi + small
    S.build(this, L, c, e, dark, white);                  // species sets head/headPos/ears/eyes/legs/tail/tongue/hatG/h
    this.h = this.h*sz[1];                                // label height
    // hat (shared)
    const h=this.hatG, hat=this.raceCrown?'crown':this.party?'party':L.hat;
    if(hat==='crown'){ box(h,0.8,0.2,0.8,0xffd23f,0,0.1,0); for(const [x,z] of [[-.3,-.3],[.3,-.3],[-.3,.3],[.3,.3]]) box(h,0.18,0.3,0.18,0xffd23f,x,0.3,z); box(h,0.16,0.16,0.16,0xff4d6d,0.42,0.2,0); }
    if(hat==='beanie'){ box(h,1.2,0.35,1.15,0x6c8ed6,0,0.15,0); box(h,0.9,0.28,0.85,0x6c8ed6,0,0.45,0); box(h,0.32,0.32,0.32,white,0,0.72,0); }
    if(hat==='party'){ const cone=new THREE.Mesh(new THREE.ConeGeometry(0.34,0.8,6),mat(0xff7bd1)); cone.position.set(0.15,0.42,0.25); cone.rotation.z=-0.2; h.add(cone); box(h,0.2,0.2,0.2,0xffd23f,0.22,0.87,0.25); }
    if(hat==='bow'){ box(h,0.3,0.28,0.3,0xff4d6d,0.1,0.1,0.5); box(h,0.28,0.4,0.28,0xff4d6d,-0.14,0.12,0.5); box(h,0.28,0.4,0.28,0xff4d6d,0.34,0.12,0.5); }
    // accessory (shared, anchored on headPos / body)
    const acc=L.acc||'none', hp=this.headPos, neckY=hp.y-0.7, neckX=hp.x+0.2;   // under the chin, wide enough to peek past the big head from the front
    if(acc==='collar'){ box(b,0.7,0.14,1.34,0xd6283c,neckX,neckY,0); box(b,0.1,0.18,0.14,0xffd23f,hp.x+0.62,neckY-0.14,0); }
    if(acc==='scarf'){ box(b,0.74,0.24,1.38,0xe0563b,neckX,neckY+0.02,0); box(b,0.22,0.62,0.24,0xe0563b,hp.x+0.5,neckY-0.32,0.62); box(b,0.22,0.4,0.24,0xc94a30,hp.x+0.55,neckY-0.6,0.64); }
    if(acc==='bowtie'){ box(b,0.14,0.24,0.24,0x2b2b33,hp.x+0.6,neckY-0.06,-0.17); box(b,0.14,0.24,0.24,0x2b2b33,hp.x+0.6,neckY-0.06,0.17); box(b,0.16,0.14,0.14,0xd6283c,hp.x+0.61,neckY-0.06,0); }
    if(acc==='glasses'){ for(const eg of this.eyes){ const p=eg.position; const lens=new THREE.Mesh(new THREE.BoxGeometry(0.06,0.4,0.4),new THREE.MeshLambertMaterial({color:0x8ad0ff,transparent:true,opacity:0.35})); lens.position.set(p.x+0.08,p.y,p.z); h.parent.add(lens);
        box(h.parent,0.05,0.44,0.05,0x222222,p.x+0.08,p.y,p.z-0.2); box(h.parent,0.05,0.44,0.05,0x222222,p.x+0.08,p.y,p.z+0.2); box(h.parent,0.05,0.05,0.4,0x222222,p.x+0.08,p.y+0.2,p.z); box(h.parent,0.05,0.05,0.4,0x222222,p.x+0.08,p.y-0.2,p.z); }
      const e0=this.eyes[0].position, e1=this.eyes[1].position; box(h.parent,0.05,0.05,Math.abs(e1.z-e0.z)-0.4,0x222222,e0.x+0.08,e0.y,(e0.z+e1.z)/2); }
    if(acc==='wings'){ for(const z of [-1,1]){ const w=box(b,0.12,0.9,0.5,0xfafafa,-0.2,1.25,z*0.55); w.rotation.x=z*0.7; w.rotation.z=0.35; const w2=box(b,0.12,0.6,0.4,0xfafafa,-0.25,1.05,z*0.8); w2.rotation.x=z*0.9; w2.rotation.z=0.2; } }
    if(acc==='backpack'){ box(b,0.6,0.55,0.62,0x4b7bd6,-0.35,1.15,0); box(b,0.62,0.18,0.64,0x2f57a6,-0.35,1.35,0); box(b,0.08,0.4,0.1,0x2f57a6,0.0,1.05,-0.3); box(b,0.08,0.4,0.1,0x2f57a6,0.0,1.05,0.3); }
    if(hat==='halo'){ const r=new THREE.Mesh(new THREE.TorusGeometry(0.55,0.07,8,24),new THREE.MeshLambertMaterial({color:0xffe28a,emissive:0x8a6a00})); r.rotation.x=Math.PI/2; r.position.y=0.55; h.add(r); }
    // shadow blob
    this.shadow = new THREE.Mesh(new THREE.CircleGeometry(0.85,20), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.22}));
    this.shadow.rotation.x=-Math.PI/2; this.shadow.position.y=0.01; g.add(this.shadow);
    this.g.rotation.y = this.facing;
  }
  say(text, cls=''){ if(this.bubbleEl) this.bubbleEl.remove(); const d=document.createElement('div'); d.className='bubble '+cls; d.textContent=text; labels.appendChild(d); this.bubbleEl=d; clearTimeout(this.bt); this.bt=setTimeout(()=>{d.remove(); if(this.bubbleEl===d) this.bubbleEl=null;}, cls==='pow'?600:2600); }
  reserve(p){ this.releaseProp(); p.users++; this.prop=p; p.taken=p.taken||new Set(); this.slot=0; while(p.taken.has(this.slot)) this.slot++; p.taken.add(this.slot); }
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
    for(const l of this.legs){ l.rotation.x=0; l.rotation.z=0; l.position.y=0.4; } this.ears[0].rotation.x=this.ears[1].rotation.x=0; this.head.rotation.set(0,this.head.rotation.y,0); this.head.position.copy(this.headPos); for(const e of this.eyes) e.scale.setScalar(1); }
  spin(){ this.spinT=0; }
  wave(){ this.waveT=0; this.setState('idle'); this.timer=2; }
  update(dt, now){
    this.t += dt; if(!PLAY) this.hunger=Math.min(1,this.hunger+dt/900);
    if(this.party && performance.now()>this.partyUntil){ this.party=false; this.build(); }
    const g=this.g, b=this.body, s=this.state;
    // eye blink
    const blink = (Math.sin(now*1.3+this.g.position.x*3)>0.985)||s==='sleep';
    for(const e of this.eyes) e.scale.y = blink?0.15:1;
    // tail idle wag
    const SP=SPECIES[this.look.species]||SPECIES.cat;
    this.tail.rotation.z = SP.tail.base + Math.sin(now*SP.tail.speed+this.g.position.x)*SP.tail.amp;
    this.tail.rotation.x = Math.sin(now*(SP.tail.speed*0.7))*SP.tail.wagX;
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
      else { b.rotation.x=Math.PI; b.position.y=0.95+br; this.head.position.set(this.headPos.x+0.35,this.headPos.y-0.95,0); this.head.rotation.set(0,0,-0.9); for(let i=0;i<4;i++) this.legs[i].rotation.z=Math.sin(now*0.8+i)*0.25+(i>1?0.3:-0.3); } }

    if(this.mirror){   // companion page: position/state come from the overlay over the wire
      const n=this.net; if(n){ const k=Math.min(1,dt*8); g.position.x+=(n.x-g.position.x)*k; g.position.z+=(n.z-g.position.z)*k; this.facing=n.f; }
      if(this.moving){ for(let i=0;i<4;i++) this.legs[i].rotation.z = Math.sin(now*9 + (i%2?Math.PI:0) + (i>1?Math.PI/2:0))*0.6; b.position.y = Math.abs(Math.sin(now*9))*0.06; }
      else for(const l of this.legs) l.rotation.z *= 0.8;
      if(s==='sit'){ b.rotation.z=-0.28; b.position.y=0.1; } else if(!lying) b.rotation.z*=0.8;
    } else if(s==='walk' && this.target){
      const dx=this.target.x-g.position.x, dz=this.target.z-g.position.z, d=Math.hypot(dx,dz);
      if(d<this.bestD-0.05){ this.bestD=d; this.stuckT=0; } else this.stuckT+=dt;   // no progress for a while (blocked by a zone/prop) → give up
      const close=this.prop?0.6:0.15;   // heading for a prop: near enough is fine, repulsion fields can overlap the exact spot
      if(d<close || (this.stuckT>3 && d<1.4)){ this.target=null; this.setState('idle'); this.timer=rnd(1.5,4); if(this.onArrive){const f=this.onArrive;this.onArrive=null;f();} }
      else if(this.stuckT>3) this.giveUp();
      else { let vx=dx/d, vz=dz/d;   // steer around other cats and props
        if(!this.racing) for(const o of cats.values()){ if(o===this||o.noCollide) continue; const ox=g.position.x-o.g.position.x, oz=g.position.z-o.g.position.z, od=Math.hypot(ox,oz); if(od<2.2&&od>1e-3){ const w=(1-od/2.2)*1.7; vx+=ox/od*w; vz+=oz/od*w; } }
        for(const p of props){ if(p===this.prop||p.type==='toy') continue; const ox=g.position.x-p.x, oz=g.position.z-p.z, od=Math.hypot(ox,oz), rr=p.r+1.0; if(od<rr&&od>1e-3){ const w=(1-od/rr)*2.4; vx+=ox/od*w; vz+=oz/od*w; } }
        if(vac){ const ox=g.position.x-vac.mesh.position.x, oz=g.position.z-vac.mesh.position.z, od=Math.hypot(ox,oz); if(od<4&&od>1e-3){ const w=(1-od/4)*4, rx=ox/od, rz=oz/od, side=(rx*vz-rz*vx)>=0?1:-1; vx+=rx*w-rz*side*w*0.9; vz+=rz*w+rx*side*w*0.9; } }   // nobody walks into the vacuum — step round it
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
        if(!PLAY && !this.anim && Math.random()<dt*0.02){ if(this.hunger>0.85) this.say(pick(['😾','hungry…','grr','feed me'])); else if(this.hunger<0.15) this.say(voice(this,'purr')); }   // mood shows
        if(!PLAY && !this.anim && !this.noCollide){ this.glanceT=(this.glanceT??rnd(0.5,2))-dt; if(this.glanceT<=0){ this.glanceT=rnd(1,2.5); const o=near(this,3.5); if(o && Math.random()<0.6){ this.look={x:o.g.position.x,z:o.g.position.z,until:now+rnd(1.2,2.5)}; if(Math.abs(normA(Math.atan2(-(o.g.position.z-g.position.z), o.g.position.x-g.position.x)-this.facing))>1.2) faceAt(this,o); const aff=affinity(this,o);
          if((aff<-0.55 || (this.T.hiss>2 && aff<0.2)) && Math.random()<0.35*this.T.hiss){ this.play('arch',0.8); this.say(voice(this,'hiss')); } else if(aff>0.55 && Math.random()<0.2*this.T.greet) this.say(voice(this,'purr')); } } } }
      if(s==='sit'){ b.rotation.z = -0.28; b.position.y=0.1; this.head.rotation.x = Math.sin(now*0.8)*0.12; this.timer-=dt; if(this.timer<=0){ this.setState('idle'); this.timer=1; } }
      else if(!lying) b.rotation.z *= 0.8;
      if(s==='loaf'){ this.timer-=dt; if(this.timer<=0){ this.setState('idle'); this.timer=1; } }
      if(s==='sleep'){ this.timer-=dt; if(Math.floor(this.t)!==Math.floor(this.t-dt) && Math.floor(this.t)%2===0) this.say('z'.repeat(1+Math.floor(this.t)%3)); if(this.timer<=0){ this.setState('idle'); this.play('stretch',1.5); } }
      if(s==='groom'){ const lick=Math.abs(Math.sin(now*10)); this.head.rotation.z = -0.25+Math.sin(now*10)*0.15; this.head.position.y=this.headPos.y-0.1+lick*0.06;   // head down, tongue out, paw up to the face
        this.tongue.visible=true; this.tongue.position.y=-0.47-lick*0.1; this.tongue.scale.y=0.6+lick*0.8;
        this.legs[0].rotation.z=-1.9+Math.sin(now*10)*0.15; this.legs[0].position.y=0.55;
        this.timer-=dt; if(this.timer<=0){ this.head.rotation.z=0; this.head.position.y=this.headPos.y; this.tongue.visible=false; this.legs[0].position.y=0.4; this.setState('idle'); this.timer=2; } }
    }
    // facing (smooth turn)
    if(SP.pant && !this.anim && !posed && s!=='sleep' && !this.inBox) this.tongue.visible = Math.sin(now*0.35+this.ph)>0.35;   // dogs pant
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
        case 'lickfoot': { const env=Math.max(0,Math.min(1,p*4,(1-p)*4)); this.head.rotation.y=-1.1*env; this.head.rotation.z=-0.55*env; this.head.position.x=this.headPos.x-0.25*env; this.legs[2].rotation.z=1.5*env; this.legs[2].rotation.x=-0.6*env; b.rotation.x=-0.25*env; this.tongue.visible=env>0.6; this.tongue.scale.y=0.5+Math.abs(Math.sin(A.t*12)); break; }
        case 'lickbutt': { const env=Math.max(0,Math.min(1,p*4,(1-p)*4)); this.head.rotation.y=-2.3*env; this.head.rotation.z=-0.4*env; this.head.position.x=this.headPos.x-0.45*env; this.legs[3].rotation.x=1.6*env; b.rotation.x=0.55*env; b.position.y=0.05*env; this.tongue.visible=env>0.6; this.tongue.scale.y=0.5+Math.abs(Math.sin(A.t*12)); break; }
        case 'swipe': { const pop=Math.min(1,p*4); b.position.y=-0.85+1.0*Math.sin(pop*Math.PI/2)-0.3*Math.max(0,(p-0.7)/0.3); this.legs[0].visible=true; this.legs[0].rotation.z=-2.1*Math.min(1,p*3); this.legs[0].rotation.x=Math.sin(A.t*22)*0.9*(p<0.8?1:0); this.head.rotation.z=-0.15; for(const e of this.eyes) e.scale.setScalar(1.3); break; }   // pop up out of the box and bat
        case 'crouch': { const low=Math.min(1,p*3); b.position.y=-0.24*low; b.rotation.z=0.1*low; this.head.position.y=this.headPos.y-0.12*low; for(const e of this.eyes) e.scale.setScalar(1+0.35*low);
          this.tail.rotation.z=0.2+Math.sin(A.t*14)*0.15; b.rotation.x=Math.sin(A.t*9)*0.05*low;   // butt wiggle
          const t=this.sneakTarget; if(t&&!t.dead){ this.head.rotation.y=clamp(normA(Math.atan2(-(t.g.position.z-g.position.z), t.g.position.x-g.position.x)-this.facing),-1.2,1.2); if(Math.hypot(t.g.position.x-g.position.x,t.g.position.z-g.position.z)<(this.elev>0?4:2.9)) A.t=A.dur; }
          if(p>=1&&this.sneakTarget) setTimeout(()=>sneakPounce(this),0); break; }
        case 'tackle': b.position.x=1.1*s1; b.rotation.z=-0.4*s1; this.legs[0].rotation.z=this.legs[1].rotation.z=-1.4*s1; this.head.rotation.z=-0.2*s1; break;   // lunge along facing
        case 'knocked': { const env=p<0.3?p/0.3:1-(p-0.3)/0.7; b.rotation.x=1.25*env; b.position.y=0.3*Math.sin(Math.min(1,p*2)*Math.PI); b.position.x=-0.8*s1; this.ears[0].rotation.x=this.ears[1].rotation.x=-0.6*env; for(const e of this.eyes) e.scale.setScalar(1+0.5*env); break; }   // shoved onto its side
        case 'stalk': { const low=Math.min(1,p*4,(1-p)*6); b.position.y=-0.24*low; b.rotation.z=0.12*low; this.head.position.y=this.headPos.y-0.15*low; for(const e of this.eyes) e.scale.setScalar(1+0.35*low);   // creep low and slow
          this.tail.rotation.z=0.2+Math.sin(A.t*18)*0.12; this.tail.rotation.x=Math.sin(A.t*18)*0.25; const st=dt*0.9*low; g.position.x=clamp(g.position.x+Math.cos(this.facing)*st,-XMAX,XMAX); g.position.z=clamp(g.position.z-Math.sin(this.facing)*st,ZMIN,ZMAX);
          for(let i=0;i<4;i++) this.legs[i].rotation.z=Math.sin(A.t*4+(i%2?Math.PI:0)+(i>1?Math.PI/2:0))*0.35*low; break; }
        case 'arch': b.scale.y=this.baseScale.y*(1+0.32*s1); b.position.y=0.04*s1; this.tail.rotation.z=0.6-0.75*s1; for(const e of this.eyes) e.scale.setScalar(1+0.4*s1); break;
        case 'shake': b.rotation.x=Math.sin(A.t*40)*0.28*(1-p); this.ears[0].rotation.x=this.ears[1].rotation.x=-b.rotation.x*1.5; break;
        case 'nuzzle': b.rotation.z=-0.35*Math.abs(Math.sin(A.t*5))*(1-p*0.5); b.position.y=-0.06*s1; break;
        case 'twitch': this.ears[p<0.5?0:1].rotation.x=Math.sin(A.t*35)*0.35*(1-p); break;
        case 'peek': this.head.rotation.z=0.25*s1; break;
        case 'eat': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)), hd=this.head; hd.position.y=this.headPos.y-0.42*env-0.05*Math.abs(Math.sin(A.t*8))*env; hd.rotation.z=-0.35*env; this.tail.rotation.z=0.6+0.6*env; break; }
        case 'drink': { const env=Math.max(0,Math.min(1,p*5,(1-p)*5)), hd=this.head; hd.position.y=this.headPos.y-0.4*env-0.03*Math.abs(Math.sin(A.t*16))*env; hd.rotation.z=-0.3*env; this.tongue.visible=env>0.5; this.tongue.scale.y=0.5+Math.abs(Math.sin(A.t*16)); break; }
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
    if(this.anim) this.resetAnim();   // an animation ending later would drop the reservation we're about to make
    this.reserve(p); this.chase=0;
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
    if(p.type==='cake'){ if(p.amount<=0){ this.say('all gone 😿'); this.releaseProp(); return; }
      if(p.lit){ if(this.key!==LOU.key && cats.has(LOU.key) && !cats.get(LOU.key).dead){ this.say(pick(['not yet!','wait for Lou','🎶'])); this.releaseProp(); this.timer=rnd(2,4); return; }   // birthday girl blows the candles first
        p.lit=false; for(const m of p.mesh.children) if(m.userData.flame) m.visible=false; this.jump(); this.say('💨 🎂'); banner('🎂 make a wish, Lou!',3000); confettiBurst(); }
      p.amount--; propVisual(p); this.hunger=0; this.play('eat',3); this.say(pick(['🎂','nom nom','cake!!','😋']));
      if(p.amount<=0) setTimeout(()=>{ if(props.includes(p)) removeProp(p); toast('cake: gone'); },3500); return; }
    if(p.type==='bowl'){ if(p.amount<=0){ this.say('empty…'); this.releaseProp(); return; } p.amount--; propVisual(p); this.hunger=0; this.play('eat',4); this.say(pick(['nom nom','crunch','😋'])); }
    else if(p.type==='water'){ if(p.amount<=0){ this.say('dry…'); this.releaseProp(); return; } p.amount--; propVisual(p); this.hunger=Math.max(0,this.hunger-0.15); this.play('drink',3); this.say('lap lap'); }
    else if(p.type==='post'){ this.play('scratch',3); this.say(pick(['scritch scritch','scrrrrt'])); }
    else if(p.type==='box'||p.type==='perch'||PERCHY.includes(p.type)){ this.onProp=p; this.noCollide=true;
      if(p.xmas&&p.ornaments?.length){ setTimeout(()=>{ for(let k=0;k<1+Math.floor(Math.random()*2)&&p.ornaments.length;k++){ const o=p.ornaments.pop(); const f=box(scene,0.3,0.3,0.3,o.material.color.getHex(),o.position.x,o.position.y,o.position.z); o.parent?.remove(o); f.userData.vy=0; f.userData.conf=true; f.userData.vy=-1; fishes.push(f); } this.say(pick(['🎄','oops','hehe'])); }, 700); } const off=(p.cap||1)>1?((this.slot||0)%2?0.95:-0.95):0; this.hopTo(p.x+off*(p.sx||1),p.z+off*(p.sz||0),p.h||0,p.type==='box');
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
    if(this.onProp && vac){ if(this.inBox){ this.hiding=true; this.setState('loaf'); } else { this.setState('sit'); this.look={x:vac.mesh.position.x,z:vac.mesh.position.z,until:performance.now()/1000+3}; } this.timer=rnd(1.5,3); return; }
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
    if(!PLAY && treats.length){ const tr=nearestTreat(this, this.hunger>0.5?18:10); if(tr && Math.random()<(this.hunger>0.5?0.9:0.5)){ this.say(pick(['👀','ooh','treat?'])); claimTreat(this,tr); return; } }   // spotted a treat on the floor
    if(!PLAY && this.hunger>T.hungry && Math.random()<0.6){   // hungry: find food, or stare at the empty bowl and complain
      const bowls=props.filter(p=>p.type==='bowl'), full=bowls.filter(p=>p.amount>0&&p.users<1);
      if(full.length){ this.goTo(pick(full)); return; }
      if(bowls.length && Math.random()<0.5){ const b=pick(bowls); this.walkTo(b.x+rnd(-1.5,1.5), Math.min(ZMAX,b.z+1.6)); this.onArrive=()=>{ this.facing=-Math.PI/2; this.play('peek',2.5); this.say(pick(['feed me','bowl is empty 😾','hungry…','🍽️👀'])); }; return; } }
    if(Math.random()<0.3*T.sleep){   // nap pile: curl up next to a sleeping friend (or anyone, sometimes)
      const z=near(this,10,c=>c.state==='sleep'&&!c.onProp&&(isFriend(this,c)||Math.random()<0.3)); if(z){ const a=rnd(0,Math.PI*2), f=freePoint(z.g.position.x+Math.cos(a)*1.35, z.g.position.z+Math.sin(a)*1.35);
        this.walkTo(f.x,f.z,2); this.onArrive=()=>{ if(!z.dead&&z.state==='sleep'){ faceAt(this,z); this.setState('sleep'); this.timer=rnd(8,14)*T.sleep; if(Math.random()<0.4) this.say('💤'); } }; return; } }
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
    const lively=0.6+0.8*ENERGY;   // busy chat → more walking/zoomies, dead chat → more naps
    const pool=[['walk',0.45*T.walk*(1-0.5*NIGHT)*lively],['sit',0.2*T.sit],['groom',0.09],['lickfoot',0.03],['lickbutt',0.03],['loaf',(0.08+0.1*NIGHT)*T.sleep],['sleep',(0.03+0.15*NIGHT+0.08*(1-ENERGY))*T.sleep],['stretch',0.02],['twitch',0.02],['shake',0.02],['peek',0.015],['turn',0.015],['zoom',0.015*T.zoom*lively]];
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
function logLine(user, msg, note){ if(window.parent!==window) try{ parent.postMessage({type:'log',user,msg,note:note||''},'*'); }catch{}   // demo page shows a chat feed
  const d=document.createElement('div'); d.innerHTML=`<b></b>: <span></span><span style="opacity:.6"></span>`; const [m,n]=d.querySelectorAll('span'); d.querySelector('b').textContent=user; m.textContent=msg; n.textContent=note?` — ${note}`:''; log.prepend(d); while(log.children.length>30) log.lastChild.remove(); }
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

function handleChat(user, msg, key, away, lvl){
  key = key || 'sim:'+user.toLowerCase();
  msg = msg.trim(); if(!msg.startsWith('!')) return;
  const raw = msg.slice(1).split(/\s+/); raw.shift();
  const parts = msg.slice(1).toLowerCase().split(/\s+/); const cmd = parts.shift(); let note='';
  let cat = cats.get(key);
  if(cat) cat.last=performance.now();
  if(cat && cat.afk){ cat.setAfk(false); cat.say(pick(['back!','o/','👋'])); }
  const welcome = away>20*3600e3;   // long time no see — greeted after the command's own bubble, also when the cat is respawning via !cat
  if(SPAWN_CMDS[cmd]){
    const species = SPECIES_MODE==='mixed' ? SPAWN_CMDS[cmd] : (SPECIES[SPECIES_MODE]?SPECIES_MODE:'cat');
    const look = cat ? {...cat.look} : {species};
    if(SPECIES_MODE==='mixed') look.species=species;
    for(let i=0;i<parts.length;i++){ const p=parts[i];
      if(p==='eyes' && parts[i+1]){ look.eyes=parts[++i]; continue; }
      if(p==='spots' && parts[i+1]){ look.spots=parts[++i]; continue; }   // patch colour for spotted / tortie
      if(ACCS.includes(p)){ look.acc=p==='noacc'?'none':p; continue; }
      if(HATS.includes(p)) look.hat=p; else if(PATTERNS.includes(p)) look.pattern=p; else if(SIZES[p]) look.size=p; else if(parseColor(p,COLORS)!=null) look.body=p; }
    if(!cat){ look.body=look.body||SPECIES[look.species].body; cat=spawnCat(key, user, look); note='spawned'; crownCotd(cat); }
    else { cat.look=look; cat.build(); cat.jump(); note='updated'; }
    net.send({type:'cat', key, name:user, look:cat.look});
  } else if(!cat){ note='no cat yet — use !'+(SPECIES_MODE==='mixed'?'cat / !dog / !raccoon / !otter':(SPECIES[SPECIES_MODE]?SPECIES_MODE:'cat')); }
  else if(cmd==='join') note=race.phase==='join'?race.join(cat):game.join(cat);
  else if(cmd==='name'){ const n=raw.join(' ').replace(/[<>]/g,'').trim().slice(0,20); cat.setName(n||user); net.send({type:'cat', key, name:cat.name, look:cat.look}); note='named '+cat.name; }
  else if(cmd==='afk'){ cat.setAfk(true); note='afk'; }
  else if(cmd==='follow'){ const who=(parts[0]||'').replace(/^@/,''); const other=who?findCat(who):null; if(!who){ cat.following=null; note='stopped following'; } else if(!other||other===cat) note='who? try !follow @name'; else { cat.following={cat:other, until:performance.now()+60000}; cat.say(pick(['👀','coming!','wait up'])); cat.giveUp(); cat.timer=0.2; note='following '+other.name; } }
  else if(cmd==='lick') cat.play(pick(['lickfoot','lickbutt']),1.9);
  else if(['meow','bark','woof','chitter','squeak','speak'].includes(cmd)) cat.say(voice(cat,'meow'));
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
  else if(cmd==='tackle'||cmd==='fight'){ const who=(parts[0]||'').replace(/^@/,''); const o=findCat(who); if(!o||o===cat) note='who? try !tackle @name'; else if(busy) note='busy'; else { nudgeRel(cat,o,-0.08); wrestle(cat,o,false); } }
  else if(cmd==='pull'){ if(tug.on&&tug.side.has(key)){ tug.force[tug.side.get(key)]+=1; cat.play('tackle',0.4,true); note='pull!'; } else note='no tug of war on'; }
  else if(cmd==='pick'){ const n=+parts[0]; if(!roulette.on) note='no roulette running'; else if(!(n>=1&&n<=5)) note='pick 1-5'; else { roulette.picks[key]=n; cat.say('📦 '+n); note='picked '+n; } }
  else if(cmd==='level'){ cat.say(`level ${lvl||0} ${lvl>=10?'🌟':lvl>=5?'⭐':'✨'}`); note='level '+(lvl||0); }
  else if(cmd==='photo'){ note=takePhoto(user); }
  else if(cmd==='hiss'){ cat.play('arch',1.3); cat.say(voice(cat,'hiss')); }
  else if(cmd==='shake') cat.play('shake',0.7);
  else if(cmd==='pet'||cmd==='boop'||cmd==='hug'){
    const who=(parts[0]||'').replace(/^@/,''); const other=findCat(who);
    if(!other||other===cat) note='who? try !pet @name';
    else { stat(cat,'pets'); cat.noCollide=other.noCollide=true; cat.pal=other; const side=cat.g.position.x<other.g.position.x?-1:1;
      cat.walkTo(other.g.position.x+side*1.15, other.g.position.z, 3.2);
      nudgeRel(cat,other,0.12);
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
function propVisual(p){ if(p.type==='cake'){ const k=0.45+0.55*Math.max(0,p.amount)/8; p.mesh.scale.set(k,Math.max(0.5,k),k); }
  if(p.fill){ const k=Math.max(0,p.amount)/6; p.fill.visible=k>0; p.fill.scale.y=Math.max(0.05,k); p.fill.position.y=p.fillY0+ (p.fillH*k)/2 - p.fillH/2; } }
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
  if(type==='catbed'){ const c=pick([0x8fb3ff,0xffb3c6,0xb5e0a0,0xffe08a]); box(g,1.3,0.28,1.3,darken(c,0.8),0,0.14,0); box(g,1.0,0.16,1.0,c,0,0.34,0); p.r=0.7; p.h=0.42; p.cap=1; }
  if(type==='cake'){ box(g,1.7,0.5,1.7,0xf3a6c4,0,0.25,0); box(g,1.75,0.12,1.75,0xfff1f6,0,0.52,0); box(g,1.1,0.42,1.1,0xfff1f6,0,0.78,0); box(g,1.15,0.1,1.15,0xf3a6c4,0,1.0,0);
    for(const [x,z] of [[-0.3,-0.3],[0.3,-0.3],[0,0.3]]){ box(g,0.08,0.4,0.08,0xffffff,x,1.25,z); const f=box(g,0.14,0.2,0.14,0xffb347,x,1.52,z); f.userData.flame=true; }
    for(let i=0;i<8;i++) box(g,0.1,0.1,0.1,pick([0xff6b6b,0x7fd6ff,0xffd166,0xb28dff]),Math.cos(i/8*Math.PI*2)*0.75,0.6,Math.sin(i/8*Math.PI*2)*0.75);
    p.r=0.95; p.cap=6; p.amount=8; p.lit=true; }
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
let laser=null, fishes=[], busy=false, vac=null, treats=[]; const weather={kind:null,t0:0}, roulette={on:false,picks:{},boxes:[]};
let ENERGY=0.5, AUTO_REFILL_MIN=30, lastRefill=performance.now();   // ENERGY 0 (dead chat) … 1 (busy) from messages per minute
function setEnergy(perMin){ ENERGY=clamp(perMin/25,0,1); }
// cats react to what chat says, not just commands
function vibe(kind){ const list=[...cats.values()].filter(c=>!c.dead&&!c.onProp&&!c.anim&&c.state!=='sleep'); if(!list.length) return; const some=list.sort(()=>Math.random()-0.5).slice(0,1+Math.floor(list.length/3));
  let i=0; for(const c of some) setTimeout(()=>{ if(c.dead) return;
    if(kind==='lol'){ c.say(pick(['😹','lol','hehe','😆'])); if(Math.random()<0.5) c.play('roll',1.2); }
    else if(kind==='aww'){ c.say(pick(['💕','🥹',':3','prrr'])); c.look={x:c.g.position.x,z:c.g.position.z+20,until:performance.now()/1000+3}; }
    else if(kind==='hi'){ c.facing=-Math.PI/2; c.wave(); c.say(pick(['hi!','o/','hello','👋'])); }
    else if(kind==='f'){ c.giveUp(); c.facing=-Math.PI/2; c.setState('sit'); c.timer=4; c.say('F'); }
    else if(kind==='hype'){ c.jump(); c.say(pick(['🎉','POG','LETS GO','!!'])); }
    else if(kind==='bye'){ c.facing=-Math.PI/2; c.wave(); c.say(pick(['bye!','gn 💤','o/'])); }
  }, i++*220); }
function refuge(c){ let best=null, bd=40; for(const p of props){ if(!(p.h>0||p.type==='box')||p.users>=(p.cap||1)) continue; const d=Math.hypot(p.x-c.g.position.x,p.z-c.g.position.z); if(d<bd){ bd=d; best=p; } } return best; }
function removeProp(p){ for(const c of cats.values()){ if(c.onProp===p) c.dismountNow(); if(c.prop===p) c.releaseProp(); } scene.remove(p.mesh); props=props.filter(x=>x!==p); }
const events = {
  wrestlemania(){
    const list=[...cats.values()].filter(c=>!c.dead); if(list.length<2){ toast('need 2+ cats'); return; }
    const [a,b] = list.sort(()=>Math.random()-0.5).slice(0,2); wrestle(a,b,true);
  },
  refill(){ refill(); toast('refilled'); },
  clearcats(){ for(const c of [...cats.values()]) removeCat(c); race.end(); busy=false; banner(''); toast('all cats cleared'); },
  clearprops(){ clearProps(); toast('props cleared'); },
  catnip(){ for(const c of cats.values()){ for(const e of c.eyes) e.scale.x=3; zoomies(c, 8); c.say(pick(['!!!','WHEEE','MRRAOW','😵‍💫'])); setTimeout(()=>{for(const e of c.eyes) e.scale.x=1;}, 8500); } toast('catnip loaded'); },
  race(m){ race.start({predictions:!!m?.predictions, joinSecs:m?.joinSecs}); },
  vacuum(){ if(vac||PLAY) return; const g=new THREE.Group(); const body=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.3,16),mat(0x444a55)); body.position.y=0.15; g.add(body); box(g,0.3,0.1,0.3,0xff4d4d,0,0.35,0);
    const z=(ZMIN+ZMAX)/2; g.position.set(-XMAX-2,0,z); scene.add(g); vac={mesh:g,t0:performance.now(),z}; banner('🤖 VACUUM',1500); toast('vacuum');
    for(const c of cats.values()){ if(c.onProp){ if(c.inBox) c.hiding=true; c.say(pick(['👀','…'])); continue; } c.giveUp(); c.say(pick(['!!','😱','NOPE','hss'])); c.play('arch',0.5);
      setTimeout(()=>{ if(c.dead||!vac) return; const spot=refuge(c); if(spot){ c.goTo(spot); c.say(pick(['up!','hide!','📦'])); }   // get off the floor if anything's free
        else { const away=c.g.position.z<z?ZMIN+0.5:ZMAX-0.5; c.walkTo(c.g.position.x+rnd(-3,3), away, 6); c.onArrive=()=>{ if(vac){ c.look={x:vac.mesh.position.x,z:vac.mesh.position.z,until:performance.now()/1000+9}; c.play('arch',1.0); c.timer=9; } }; } }, rnd(100,600)); }
    setTimeout(()=>{ if(!vac) return; const r=[...cats.values()].filter(c=>!c.dead&&!c.onProp&&!c.riding&&(c.trait==='zoomy'||c.trait==='chill')&&Math.hypot(c.g.position.x-vac.mesh.position.x,c.g.position.z-vac.mesh.position.z)<7);   // one brave one hops on for a ride
      if(r.length&&Math.random()<0.7){ const c=pick(r); c.giveUp(); c.riding=true; c.noCollide=true; c.elev=0.35; c.setState('sit'); c.timer=99; c.say(pick(['wheee','🤖🐾','taxi!'])); } }, 2200);
    setTimeout(()=>{ if(vac){ scene.remove(vac.mesh); vac=null; } for(const c of cats.values()){ if(c.riding){ c.riding=false; c.noCollide=false; c.elev=0; c.g.position.y=0; c.g.position.x=clamp(c.g.position.x,-XMAX,XMAX); c.say('again!'); c.giveUp(); } else if(!c.dead&&Math.random()<0.5) c.say(pick(['…','phew','😾'])); } }, 9500); },
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
  birthday(){ const lou=spawnLou(); banner('🎂 HAPPY BIRTHDAY LOU 🎂',5000); toast('birthday girl'); events.confetti();
    for(const p of [...props]) if(p.type==='cake') removeProp(p);
    const f=freePoint(0,-0.5); const cake=spawnProp('cake',f.x,f.z); cake.temp=true;
    let i=0; for(const c of cats.values()){ c.party=true; c.partyUntil=performance.now()+120000; c.build(); if(c!==lou) setTimeout(()=>{ if(!c.dead) c.say(pick(['🎶','happy birthday!','🎉','🎂'])); }, 400+i++*350); }
    lou.giveUp(); lou.say('me?? 🥹'); setTimeout(()=>{ if(!lou.dead) lou.goTo(cake); }, 800);
    let j=0; for(const c of cats.values()) if(c!==lou) setTimeout(()=>{ if(!c.dead&&props.includes(cake)&&cake.amount>0){ c.giveUp(); c.goTo(cake); } }, 6000+j++*900);   // everyone shares once she's had the first bite
  },
  catniproulette(){ const list=[...cats.values()].filter(c=>!c.dead&&!c.onProp); if(!list.length){ toast('no cats'); return; } const c=pick(list); banner('🎰 catnip roulette… '+c.name+'!',3500); toast('catnip roulette: '+c.name);
    c.giveUp(); for(const e of c.eyes) e.scale.x=3; c.say(pick(['!!!','WHEEE','😵‍💫','MRRAOW'])); zoomies(c,10); c.noCollide=false;
    setTimeout(()=>{ if(!c.dead){ for(const e of c.eyes) e.scale.x=1; c.say('…'); c.play('shake',0.7); } }, 10500); },
  boxroulette(){ if(roulette.on||PLAY) return; roulette.on=true; roulette.picks={}; roulette.boxes=[]; banner('📦 BOX ROULETTE — !pick 1-5',4000); toast('box roulette');
    for(let i=0;i<5;i++){ const f=freePoint(-8+i*4, ZMIN+3); const p=spawnProp('box',f.x,f.z); p.temp=true; p.roulette=i+1; p.mesh.position.y=10; p.drop=true; roulette.boxes.push(p); const l=document.createElement('div'); l.className='tag boxnum'; l.textContent=String(i+1); labels.appendChild(l); p.label=l; }
    setTimeout(()=>{ if(!roulette.on) return; const win=1+Math.floor(Math.random()*5); const box=roulette.boxes[win-1]; banner('📦 box '+win+' had the treat!',5000);
      for(const p of roulette.boxes){ if(p!==box){ if(p.label) p.label.textContent='✖'; } else if(p.label) p.label.textContent='🐟'; }
      if(box&&props.includes(box)){ if(box.users) for(const c of cats.values()) if(c.onProp===box) c.dismountNow(); events.treat({x:box.x, z:box.z+1.6}); }
      const winners=Object.entries(roulette.picks).filter(([k,n])=>n===win).map(([k])=>cats.get(k)).filter(c=>c&&!c.dead), losers=Object.entries(roulette.picks).filter(([k,n])=>n!==win).map(([k])=>cats.get(k)).filter(c=>c&&!c.dead);
      let i=0; for(const c of winners) setTimeout(()=>{ if(!c.dead){ c.jump(); c.say(pick(['🎉','YES','called it'])); } }, i++*150); for(const c of losers) setTimeout(()=>{ if(!c.dead) c.say(pick(['aw','😾','next time'])); }, 600+rnd(0,800));
      toast(`box roulette: ${winners.length} right, ${losers.length} wrong`);
      setTimeout(()=>{ for(const p of roulette.boxes){ p.label?.remove(); if(props.includes(p)) removeProp(p); } roulette.boxes=[]; roulette.on=false; }, 7000); }, 15000); },
  holiday(m){ setHoliday(m?.kind||(holidayKind==='none'?'halloween':holidayKind==='halloween'?'xmas':'none')); },
  tug(){ game.open('🪢 TUG OF WAR — !join, then spam !pull', 15, tugOfWar); },
  beds(){ game.open('🛏️ MUSICAL BEDS', 15, musicalBeds); },
  rlgl(){ game.open('🚦 RED LIGHT GREEN LIGHT', 15, redLightGreenLight); },
  photo(){ takePhoto('streamer'); },
  weather(m){ const kind=m?.kind||pick(['rain','snow']); if(weather.kind) return; weather.kind=kind; weather.t0=performance.now(); banner(kind==='rain'?'🌧️ RAIN':'❄️ SNOW',2500); toast('weather: '+kind);
    if(kind==='rain'){ for(const c of cats.values()){ if(c.onProp){ if(c.inBox) c.hiding=true; continue; } c.giveUp(); c.say(pick(['!!','wet','😾','nope'])); setTimeout(()=>{ if(c.dead||!weather.kind) return; const spot=refuge(c); if(spot){ c.goTo(spot); } else { c.walkTo(c.g.position.x+rnd(-2,2), ZMIN+rnd(0.3,1.2), 5); c.onArrive=()=>{ c.setState('loaf'); c.timer=20; }; } }, rnd(100,900)); } }
    else { let i=0; for(const c of cats.values()){ if(c.onProp) continue; setTimeout(()=>{ if(c.dead) return; c.giveUp(); c.say(pick(['❄️','!!','snow!','🐾'])); if(Math.random()<0.5) zoomies(c,4); else { c.play('roll',1.2); } }, i++*300); } }
    setTimeout(()=>{ weather.kind=null; for(const c of cats.values()) if(!c.dead&&Math.random()<0.4) c.say(pick(['…','phew','☀️'])); }, 40000); },
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
const REL={};   // learned deltas per pair ('a|b' sorted) — pets warm a pair up, tackles cool it; the server remembers
function affinity(a,b){ const k=[a.key,b.key].sort().join('|'); let h=2166136261; for(let i=0;i<k.length;i++){ h^=k.charCodeAt(i); h=Math.imul(h,16777619); } return clamp(((h>>>0)%2001)/1000-1 + (REL[k]||0), -1, 1); }
function nudgeRel(a,b,d){ const k=[a.key,b.key].sort().join('|'); REL[k]=clamp((REL[k]||0)+d,-0.9,0.9); net.send({type:'rel', a:a.key, b:b.key, d:REL[k]}); }
const isFriend=(a,b)=>affinity(a,b)>0.55, isRival=(a,b)=>affinity(a,b)<-0.55;
function near(me,r,filter){ let best=null,bd=r; for(const c of cats.values()){ if(c===me||c.dead||(filter&&!filter(c))) continue; const d=Math.hypot(c.g.position.x-me.g.position.x,c.g.position.z-me.g.position.z); if(d<bd){ bd=d; best=c; } } return best; }
const faceAt=(me,o)=>{ me.facing=Math.atan2(-(o.g.position.z-me.g.position.z), o.g.position.x-me.g.position.x); };
function greet(a,b){   // friends meeting: nose boop
  a.noCollide=b.noCollide=true; a.pal=b; faceAt(a,b); faceAt(b,a); a.play('nuzzle',1.2,false); b.play('nuzzle',1.2,false); a.say(pick(['💕',':3','hi '+b.name])); setTimeout(()=>{ if(!b.dead) b.say(voice(b,'purr')); },350);
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
  a.play('arch',1.0,true); b.play('arch',1.0,true); a.say(Math.random()<0.5?voice(a,'hiss'):'MINE'); setTimeout(()=>{ if(!b.dead) b.say(Math.random()<0.5?voice(b,'hiss'):'no!'); },250);
  setTimeout(()=>{ if(a.dead||b.dead||!p.mesh.parent) return;   // arch ended: both reservations were dropped by the anim reset
    const winner=Math.random()<(isRival(a,b)?0.6:0.5)?a:b, loser=winner===a?b:a;   // the pushy one usually wins
    loser.say(pick(['😾','fine.','hmph'])); loser.walkTo(loser.g.position.x+rnd(-4,4), loser.g.position.z+rnd(-3,3), 3);
    winner.reserve(p); winner.useProp(p); }, 1150);
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
$('#refill').onclick=refill; $('#clearprops').onclick=clearProps; $('#clearcats').onclick=()=>{ for(const c of [...cats.values()]) net.send({type:'catgone',key:c.key}); events.clearcats(); };
$('#bg').onclick=()=>document.body.classList.toggle('demo-bg');
$('#tags').onclick=()=>labels.classList.toggle('notags');
const st=document.createElement('style'); st.textContent='.notags .tag{display:none}'; document.head.appendChild(st);
$('#hideui').onclick=()=>document.body.classList.add('hidden');
addEventListener('keydown',e=>{ if(!PLAY&&e.key==='h'&&document.activeElement.tagName!=='INPUT') document.body.classList.toggle('hidden'); });
// URL params for OBS: ?ui=0&bg=0&tags=0
const q=new URLSearchParams(location.search);
if(q.get('depth')==='0'){ ZMIN=-1.6; ZMAX=1.8; CAM0={x:0,y:5.5,z:24}; LOOK={x:0,y:0.8,z:0}; fitCamera(); }
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
  const W=XMAX+3.5, ZB=ZMIN-3.5, ZF=ZMAX+12, H=10;   // floor runs well past the camera's bottom edge
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
// ---------- day / night ----------
// real clock (or ?time=HH). Night dims the lights and makes everyone sleepier. Off unless the server setting or ?daynight=1 says so.
let DAYNIGHT=q.get('daynight')==='1', NIGHT=0;
function applyTimeOfDay(){ const h=q.get('time')!=null?+q.get('time'):(new Date().getHours()+new Date().getMinutes()/60);
  NIGHT = !DAYNIGHT ? 0 : h>=22||h<6 ? 1 : h>=20 ? (h-20)/2 : h<7.5 ? 1-(h-6)/1.5 : 0;   // 0 day … 1 night, dusk 20-22, dawn 6-7:30
  hemi.intensity=0.9-0.55*NIGHT; sun.intensity=0.8-0.55*NIGHT; hemi.color.setHex(NIGHT>0.5?0xb9c6ff:0xfff4e0); sun.color.setHex(NIGHT>0.5?0x9fb3ff:0xffffff);
  document.body.classList.toggle('night', NIGHT>0.5); }
setInterval(applyTimeOfDay, 60000);
// Screen-space rects (fractions of the viewport — the webcam, alerts box…) turned into floor-space convex polygons.
// Top edge unprojects at foot level, bottom edge at head height, so a cat can't poke its head up into the rect.
// ---------- holiday decor: pumpkins for halloween, a tree with ornaments that fall when a cat climbs it ----------
let holidayGroup=null, holidayKind='none';
function setHoliday(kind){ if(!['none','halloween','xmas'].includes(kind)) kind='none'; holidayKind=kind;
  if(holidayGroup){ scene.remove(holidayGroup); holidayGroup=null; } for(const p of [...props]) if(p.holiday) removeProp(p); obstacles=obstacles.filter(o=>!o.holiday);
  if(kind==='none') return; const g=holidayGroup=new THREE.Group(); scene.add(g);
  if(kind==='halloween'){ for(const [x,z,r] of [[-9.5,-5.5,0.7],[-8.3,-6.2,0.5],[9.8,-6,0.65]]){ const pk=new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mat(0xf28c38)); pk.position.set(x,r*0.85,z); pk.scale.y=0.8; g.add(pk); box(g,0.16,0.3,0.16,0x3f6b2f,x,r*1.5,z);
      box(g,0.16,0.16,0.05,0x222222,x-0.25,r*0.95,z+r*0.95); box(g,0.16,0.16,0.05,0x222222,x+0.25,r*0.95,z+r*0.95); box(g,0.4,0.08,0.05,0x222222,x,r*0.6,z+r*0.95); addObstacle(x,z,r*2,r*2); obstacles[obstacles.length-1].holiday=true; }
    for(let i=0;i<6;i++) box(g,0.3,0.4,0.05,0xffffff,-6+i*2.4,7.5+Math.sin(i)*0.6,ZMIN-3.2); }   // ghosts on the wall, sort of
  if(kind==='xmas'){ const p=spawnProp('tree',8.5,-5.5); p.holiday=true; p.xmas=true; p.ornaments=[];
    for(let i=0;i<10;i++){ const a=i/10*Math.PI*2, y=2.4+Math.sin(i*1.7)*0.9, r=1.0+Math.cos(i*2.1)*0.25; const o=new THREE.Mesh(new THREE.SphereGeometry(0.16,8,6),mat(pick([0xff4d4d,0xffd23f,0x4d8bff,0xff7bd1]))); o.position.set(8.5+Math.cos(a)*r, y, -5.5+Math.sin(a)*r); g.add(o); p.ornaments.push(o); }
    box(g,0.3,0.5,0.3,0xffd23f,8.5,5.4,-5.5); for(let i=0;i<8;i++){ box(g,0.9,0.5,0.7,pick([0xff4d4d,0x4d8bff,0x3fbf6f]),6.5+i*0.55-(i%2?0.3:0),0.25,-6.8+(i%3)*0.4); }   // presents
    if(!envGroup) box(g,2*XMAX,0.12,0.12,0x3fbf6f,0,4.2,ZMIN-3.3); } }
// ---------- no-go zones ----------
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
applyTimeOfDay();
if(q.get('env')){ envLocked=true; setEnv(q.get('env')); }
if(q.get('holiday')) setHoliday(q.get('holiday'));
document.querySelectorAll('[data-holiday]').forEach(b=>b.onclick=()=>{ setHoliday(b.dataset.holiday); fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json','x-key':q.get('key')||''},body:JSON.stringify({holiday:b.dataset.holiday})}).catch(()=>{}); });
// full settings on the overlay panel (needs the server; the demo just applies the cat cap locally)
(function(){ const F=['maxCats','cooldownMs','respawnHours','autoRefillMin'], key=q.get('key')||''; const el=id=>document.getElementById(id);
  const show=s=>{ for(const k of F) el('s-'+k).value=s[k]; el('s-predictions').checked=!!s.predictions; el('s-daynight').checked=!!s.daynight; el('s-note').textContent='saved on the server'; };
  fetch('/api/settings',{headers:{'x-key':key}}).then(r=>r.ok?r.json():Promise.reject()).then(show).catch(()=>{ el('s-note').textContent='no server here — only the cat cap applies, locally'; });
  el('savesettings').onclick=async()=>{ const body={predictions:el('s-predictions').checked?1:0, daynight:el('s-daynight').checked?1:0}; for(const k of F) body[k]=+el('s-'+k).value;
    MAX_CATS=body.maxCats||MAX_CATS; DAYNIGHT=!!body.daynight; applyTimeOfDay(); AUTO_REFILL_MIN=body.autoRefillMin;
    try{ const r=await fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json','x-key':key},body:JSON.stringify(body)}); if(r.ok){ show(await r.json()); toast('settings saved'); } else throw 0; }catch{ el('s-note').textContent='applied locally (no server)'; } }; })();
document.querySelectorAll('[data-species]').forEach(b=>b.onclick=()=>{ SPECIES_MODE=b.dataset.species; toast('animals: '+b.dataset.species); fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json','x-key':q.get('key')||''},body:JSON.stringify({species:b.dataset.species})}).catch(()=>{}); });
document.querySelectorAll('[data-env]').forEach(b=>b.onclick=()=>{ setEnv(b.dataset.env); fetch('/api/settings',{method:'POST',headers:{'content-type':'application/json','x-key':q.get('key')||''},body:JSON.stringify({env:b.dataset.env})}).catch(()=>{}); });
rebuildZones();

// ---------- companion page (/play) ----------
// overlay streams compact cat state to the server while anyone is watching; the companion mirrors it and sends clicks back as pokes
let watchers=0, lastState='';
if(!PLAY) setInterval(()=>{ if(!cats.size) return; net.send({type:'pos', cats:[...cats.values()].filter(c=>!c.dead&&!c.key.startsWith('raid:')).map(c=>[c.key,+c.g.position.x.toFixed(1),+c.g.position.z.toFixed(1)])}); }, 20000);   // resume where they were
if(!PLAY) setInterval(()=>{ if(!watchers) return;
  const payload=JSON.stringify({type:'state', cats:[...cats.values()].map(c=>[c.key,c.name,+c.g.position.x.toFixed(2),+c.g.position.z.toFixed(2),+c.facing.toFixed(2),c.state,c.bubbleEl?c.bubbleEl.textContent:'',c.g.position.y>0.05?1:0,`${c.look.body}/${c.look.eyes}/${c.look.pattern}/${c.look.hat}/${c.look.size||'adult'}/${c.look.species||'cat'}`])});
  if(payload===lastState) return; lastState=payload; net.send(JSON.parse(payload)); }, 125);
function applyState(m){
  const seen=new Set();
  for(const [key,name,x,z,f,state,bubble,jumping,lk] of m.cats){ seen.add(key); let c=cats.get(key);
    if(!c){ const [body,eyes,pattern,hat,size,species]=lk.split('/'); c=spawnCat(key,name,{body,eyes,pattern,hat,size,species},true); c.mirror=true; c.g.position.set(x,0,z); c.g.rotation.y=f; c.lk=lk; }
    else if(c.lk!==lk){ const [body,eyes,pattern,hat,size,species]=lk.split('/'); c.look={body,eyes,pattern,hat,size,species}; c.build(); c.lk=lk; }
    if(Math.hypot(c.g.position.x-x,c.g.position.z-z)>4) c.g.position.set(x,0,z);   // teleport → snap
    c.net={x,z,f}; c.moving=state==='walk'; if(c.state!==state) c.setState(state);
    if(bubble && bubble!==c.lastBubble) c.say(bubble); c.lastBubble=bubble;
    if(jumping && !c.wasJumping) c.jump(); c.wasJumping=jumping;
  }
  for(const c of [...cats.values()]) if(!seen.has(c.key)) removeCat(c);
  const cen=document.getElementById('census'); if(cen){ const em={cat:'🐱',dog:'🐶',raccoon:'🦝',otter:'🦦'}; cen.innerHTML=''; for(const c of cats.values()){ const d=document.createElement('div'); d.textContent=(em[c.look.species]||'🐾')+' '+c.name+(c.state==='sleep'?' 💤':''); cen.appendChild(d); } }
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
  const cen=document.createElement('div'); cen.id='census'; document.body.appendChild(cen);
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
  if(m.species) SPECIES_MODE=m.species;
  if(m.holiday!=null && !q.get('holiday')) setHoliday(m.holiday);
  if(m.autoRefillMin!=null) AUTO_REFILL_MIN=+m.autoRefillMin;
  if(m.daynight!=null && q.get('daynight')==null){ DAYNIGHT=!!m.daynight; applyTimeOfDay(); }
  if(m.rels) for(const [k,v] of Object.entries(m.rels)) REL[k]=v;
  if(m.cotd){ cotdKey=m.cotd.key; setTimeout(()=>crownCotd(cats.get(cotdKey)), 800); }
  if(!zonesLocked && Array.isArray(m.zones)){ zones=m.zones; rebuildZones(); }
  if(booted){   // reconnect (server restart, wifi blip): keep everything that's on stage, only add what we're missing
    if(!PLAY) for(const c of m.cats||[]) if(!cats.has(c.key)) spawnCat(c.key,c.name,c.look,true);
    return;
  }
  booted=true;
  if(Array.isArray(m.props)) for(const p of m.props) spawnProp(p.type,p.x,p.z); else if(!props.length) defaultProps();
  if(!PLAY) for(const c of m.cats||[]){ const cat=spawnCat(c.key,c.name,c.look,true); cat.last=performance.now()-(Date.now()-c.last); if(Number.isFinite(c.x)&&Number.isFinite(c.z)){ const f=freePoint(c.x,c.z); cat.g.position.set(f.x,0,f.z); } }
}
if(q.get('demo')==='1'){   // standalone demo, no server
  defaultProps();
  handleChat('mochi_fan','!cat orange tabby crown eyes amber');
  handleChat('void_enjoyer','!cat black tuxedo beanie eyes yellow');
  handleChat('cream_puff','!cat cream calico bow eyes blue');
}

// ---------- demo director (public demo page, trailer recording) ----------
// ?autodemo=1: no server needed — spawns a crowd and keeps things happening. ?trailer=1: a tight scripted 40s for recording.
const AUTODEMO=q.get('autodemo')==='1', TRAILER=q.get('trailer')==='1';
const DEMO_NAMES=['mochi','biscuit','pixel','noodle','tofu','gizmo','pepper','waffles','bean','miso','clover','ziggy','nova','pudding','maple','sprout','pickle','olive','peach','tater'];
const usedNames=new Set();
function demoSpawn(n, species){ const looks=Object.keys(COLORS).filter(k=>!['ginger','grey','tortie'].includes(k)), sizes=['adult','adult','kitten','fat','skinny'];
  for(let i=0;i<n;i++){ let name=pick(DEMO_NAMES); let k=0; while(usedNames.has(name)&&k++<30) name=pick(DEMO_NAMES)+Math.floor(Math.random()*90); usedNames.add(name);
    const sp=species||(SPECIES_MODE==='mixed'?pick(['cat','cat','cat','dog','dog','raccoon','otter']):SPECIES_MODE);
    handleChat(name, `!${sp} ${pick(looks)} ${pick(PATTERNS)} ${pick(HATS)} ${pick(sizes)} eyes ${pick(Object.keys(EYES))}`); } }
function randomCatName(){ const l=[...cats.values()].filter(c=>!c.dead); return l.length?pick(l).name:null; }
const director={ timers:[], on:false,
  start(){ if(this.on) return; this.on=true;
    const chat=()=>{ if(!this.on) return; const who=randomCatName(); if(who){ const other=randomCatName();
        const cmd=pick(['!meow','!meow','!jump','!zoomies','!lick','!roll','!stretch','!pounce','!hiss','!sleep','!loaf','!wave','!shake','!stalk','!sneak','!spin', other&&other!==who?'!pet @'+other:'!meow', other&&other!==who?'!tackle @'+other:'!jump', other&&other!==who?'!follow @'+other:'!zoomies']);
        handleChat(who, cmd); }
      this.timers.push(setTimeout(chat, rnd(2500,7000))); };
    const ev=()=>{ if(!this.on) return; const name=pick(['race','treat','treat','boxes','feeding','cucumber','doorbell','fish','laser','catnip','wrestlemania','vacuum','confetti','birthday','beds','rlgl','weather','catniproulette','boxroulette','tug']);
      if(name==='race'){ events.race({joinSecs:8}); this.timers.push(setTimeout(()=>{ for(const c of [...cats.values()].sort(()=>Math.random()-0.5).slice(0,5)) handleChat(c.name,'!join'); },2000)); }
      else if(name==='tug'){ events.tug(); this.timers.push(setTimeout(()=>{ const ps=[...cats.values()].sort(()=>Math.random()-0.5).slice(0,6); for(const c of ps) handleChat(c.name,'!join'); const pulls=setInterval(()=>{ if(!tug.on){ clearInterval(pulls); return; } const c=pick(ps); if(c&&!c.dead) handleChat(c.name,'!pull'); },400); this.timers.push(pulls); },2000)); }
      else if(name==='boxroulette'){ events.boxroulette(); this.timers.push(setTimeout(()=>{ for(const c of [...cats.values()].sort(()=>Math.random()-0.5).slice(0,5)) handleChat(c.name,'!pick '+(1+Math.floor(Math.random()*5))); },3000)); }
      else events[name]();
      this.timers.push(setTimeout(ev, ['race','beds','rlgl','birthday','tug'].includes(name)?70000:name==='boxroulette'?30000:rnd(25000,45000))); };
    chat(); this.timers.push(setTimeout(ev, 12000));
    if(cats.size<6) demoSpawn(6-cats.size);
    this.timers.push(setInterval(()=>{ if(cats.size<7&&Math.random()<0.5) demoSpawn(1); },45000)); },
  stop(){ this.on=false; for(const t of this.timers){ clearTimeout(t); clearInterval(t); } this.timers=[]; } };
// trailer: scripted beats you can record in OBS
function trailer(){ const at=(ms,f)=>setTimeout(f,ms);
  at(0,()=>{ demoSpawn(6); spawnLou(); banner('chat cats',2500); });
  at(4000,()=>{ const n=randomCatName(); if(n) handleChat(n,'!zoomies'); });
  at(6000,()=>{ const a=randomCatName(), b=randomCatName(); if(a&&b&&a!==b) handleChat(a,'!pet @'+b); });
  at(9000,()=>{ events.treat(); });
  at(13000,()=>{ const a=randomCatName(), b=randomCatName(); if(a&&b&&a!==b) handleChat(a,'!sneak @'+b); });
  at(19000,()=>{ events.race({joinSecs:6}); at(1500,()=>{ for(const c of [...cats.values()].slice(0,5)) handleChat(c.name,'!join'); }); });
  at(42000,()=>{ events.boxes({n:4}); });
  at(46000,()=>{ events.cucumber(); });
  at(52000,()=>{ events.vacuum(); });
  at(64000,()=>{ events.confetti(); banner('!cat to join',4000); });
  at(70000,()=>{ director.start(); }); }
// the demo page drives the embedded overlay with postMessage
addEventListener('message', e=>{ const m=e.data; if(!m||typeof m!=='object') return;
  if(m.type==='chat' && typeof m.msg==='string') handleChat(String(m.user||'you').slice(0,25), m.msg.slice(0,80));
  else if(m.type==='event' && events[m.name]) events[m.name](m);
  else if(m.type==='env') setEnv(m.env);
  else if(m.type==='species' && (SPECIES[m.species]||m.species==='mixed')) SPECIES_MODE=m.species;
  else if(m.type==='director') m.on?director.start():director.stop();
  else if(m.type==='toggleui') document.body.classList.toggle('hidden'); });
if(window.parent!==window) document.body.classList.add('embedded');   // smaller panels inside the demo page
if(AUTODEMO||TRAILER){ SPECIES_MODE=q.get('species')||'mixed'; if(!envLocked) setEnv(q.get('env')||'living'); if(!props.length) defaultProps(); document.body.classList.add('hidden'); }
if(AUTODEMO) setTimeout(()=>{ spawnLou(); director.start(); }, 300);
if(TRAILER) setTimeout(trailer, 500);

// ---------- photo: everyone poses, one frame goes to the server (and Discord if a webhook is set) ----------
let photoWanted=false, photoBy='', lastPhoto=0;
function takePhoto(by){ if(PLAY) return 'not here'; if(performance.now()-lastPhoto<20000) return 'camera is recharging'; lastPhoto=performance.now(); photoBy=by||'streamer';
  banner('📸 say cheese!',3200); for(const c of cats.values()){ if(c.onProp||c.dead) continue; c.giveUp(); c.facing=-Math.PI/2; c.setState('sit'); c.timer=4; c.look={x:c.g.position.x,z:c.g.position.z+20,until:performance.now()/1000+4}; if(Math.random()<0.4) c.say(pick(['😸','cheese','✌️',':3'])); }
  setTimeout(()=>{ banner(''); photoWanted=true; }, 3000); return 'posing…'; }

// ---------- minigames ----------
const bannerEl=document.getElementById('banner');
function banner(text, ms){ bannerEl.textContent=text||''; bannerEl.classList.toggle('show',!!text); clearTimeout(banner.t); if(text&&ms) banner.t=setTimeout(()=>banner(''),ms); if(!PLAY) net.send({type:'banner',text:text||'',ms:ms||0}); }
// cat race: !join during the window, line up, (optional twitch prediction window), 3-2-1, run right with bursts and distractions. Winner wears a crown until the next race.
const race={ phase:'idle', racers:[], finished:[], t:0, opts:{}, winner:null, champion:null, butterfly:null };
// generic join window used by the smaller games
const game={ name:null, phase:'idle', players:[], onStart:null,
  open(name, secs, onStart){ if(this.phase!=='idle'||race.phase!=='idle'||PLAY) return false; this.name=name; this.phase='join'; this.players=[]; this.onStart=onStart;
    banner(`${name} — type !join`); toast(name+': join window'); for(const c of cats.values()) if(Math.random()<0.4) c.say(pick(['!join','me!','🙋']));
    setTimeout(()=>{ if(this.phase!=='join') return; if(this.players.length<3){ for(const c of [...cats.values()].filter(c=>!c.dead&&!this.players.includes(c)).sort(()=>Math.random()-0.5).slice(0,4-this.players.length)) this.players.push(c); }
      if(this.players.length<2){ banner('not enough players 😿',2500); this.phase='idle'; return; } this.phase='running'; this.onStart(this.players); }, secs*1000); return true; },
  join(cat){ if(this.phase!=='join') return 'nothing to join right now'; if(this.players.includes(cat)) return 'already in'; if(this.players.length>=8) return 'full'; this.players.push(cat); cat.say('🙋'); return 'joined '+this.name; },
  end(){ this.phase='idle'; this.name=null; for(const p of [...props]) if(p.type==='catbed') removeProp(p); banner(''); } };

// musical beds: n players, n-1 beds. Music → wander; stop → rush; the one left standing is out. Last one wins.
// tug of war: two teams on a yarn string; every !pull from a team member yanks it; 25 s or a big enough lead wins
const tug={on:false, side:new Map(), force:{red:0,blue:0}, rope:null, offset:0};
function tugOfWar(players){ tug.on=true; tug.side=new Map(); tug.force={red:0,blue:0}; tug.offset=0; const cz=(ZMIN+ZMAX)/2;
  const rope=tug.rope=new THREE.Group(); box(rope,9,0.12,0.12,0xe0563b,0,0.35,0); box(rope,0.4,0.4,0.4,0xffd23f,0,0.35,0); rope.position.set(0,0,cz); scene.add(rope);
  players.forEach((c,i)=>{ const side=i%2?'blue':'red'; tug.side.set(c.key,side); c.giveUp(); c.noCollide=true; c.tugSide=side; const k=Math.floor(i/2); c.walkTo(side==='red'?-5-k*1.3:5+k*1.3, cz+(k%2?0.9:-0.9), 4); c.onArrive=()=>{ c.facing=side==='red'?0:Math.PI; c.timer=99; }; c.say(side==='red'?'🔴':'🔵'); });
  banner('🪢 RED vs BLUE — !pull',3000);
  const t0=performance.now(); const tick=setInterval(()=>{ if(game.phase!=='running'){ clearInterval(tick); return; }
    const d=tug.force.red-tug.force.blue; tug.offset=clamp(d*0.35,-4.5,4.5); rope.position.x=tug.offset;
    for(const c of players){ if(c.dead) continue; const side=c.tugSide; const homeX=side==='red'?-5:5; c.g.position.x=clamp(homeX+tug.offset+(side==='red'?-1:1)*Math.floor([...tug.side.keys()].filter(k=>tug.side.get(k)===side).indexOf(c.key)/1)*1.3, -XMAX, XMAX); c.facing=side==='red'?0:Math.PI; c.body.rotation.z=(side==='red'?-1:1)*0.25*Math.min(1,Math.abs(d)/6); }
    banner(`🪢 🔴 ${tug.force.red}  ${tug.offset<-0.5?'◀':tug.offset>0.5?'▶':'•'}  ${tug.force.blue} 🔵`,0);
    if(Math.abs(tug.offset)>=4.5 || performance.now()-t0>25000){ clearInterval(tick); const win=d===0?null:d>0?'red':'blue'; banner(win?`🪢 ${win==='red'?'🔴 RED':'🔵 BLUE'} WINS!`:'🪢 draw!',5000);
      for(const c of players){ if(c.dead) continue; c.body.rotation.z=0; c.noCollide=false; if(win&&c.tugSide!==win){ c.play('knocked',0.8); c.say(pick(['oof','😾','aw'])); } else if(win){ c.jump(); c.say(pick(['🎉','YES','💪'])); stat(c,'wins'); } }
      setTimeout(()=>{ scene.remove(rope); tug.rope=null; tug.on=false; game.end(); },3000); } }, 250); }
function musicalBeds(players){ let alive=players.filter(c=>!c.dead); const cx=0, cz=(ZMIN+ZMAX)/2;
  const round=()=>{ alive=alive.filter(c=>!c.dead); if(alive.length<=1){ const w=alive[0]; if(w){ banner('🛏️ '+w.name+' wins!',5000); w.jump(); w.say('🏆'); stat(w,'wins'); } game.end(); return; }
    for(const p of [...props]) if(p.type==='catbed') removeProp(p); const n=alive.length-1;
    for(let i=0;i<n;i++){ const a=i/n*Math.PI*2; const f=freePoint(cx+Math.cos(a)*3.2, cz+Math.sin(a)*2.2); const p=spawnProp('catbed',f.x,f.z); p.temp=true; }
    banner('🎵 🎵 🎵',0); for(const c of alive){ c.giveUp(); c.noCollide=true; c.walkTo(cx+rnd(-5,5), cz+rnd(-3,3), 3); c.onArrive=()=>{ if(game.phase==='running'&&!c.onProp&&c.wander) c.walkTo(cx+rnd(-5,5), cz+rnd(-3,3), 3); }; c.wander=true; }
    setTimeout(()=>{ if(game.phase!=='running') return; banner('🛑 STOP!',2000); const beds=props.filter(p=>p.type==='catbed');
      for(const c of alive){ c.wander=false; c.giveUp(); const free=beds.filter(b=>b.users<1).sort((a,b)=>Math.hypot(a.x-c.g.position.x,a.z-c.g.position.z)-Math.hypot(b.x-c.g.position.x,b.z-c.g.position.z))[0]; if(free) c.goTo(free); }
      setTimeout(()=>{ if(game.phase!=='running') return; const out=alive.filter(c=>!c.onProp||c.onProp.type!=='catbed'); const loser=out.length?pick(out):null;
        if(loser){ loser.say(pick(['aw','😾','no bed!'])); alive=alive.filter(c=>c!==loser); loser.noCollide=false; loser.giveUp(); loser.walkTo(loser.g.position.x+rnd(-4,4), ZMAX-0.5, 3); }
        for(const c of alive){ if(c.onProp) c.dismountNow(); c.noCollide=true; } setTimeout(round, 1500); }, 4500); }, rnd(4000,8000)); };
  round(); }
// red light / green light: run to the laser on green, freeze on red; caught moving → out. First to the line wins.
function redLightGreenLight(players){ let alive=players.filter(c=>!c.dead); const startX=-XMAX+1.5, finishX=XMAX-1.5;
  alive.forEach((c,i)=>{ c.giveUp(); c.noCollide=true; c.racing=true; c.react=rnd(0.15,1.3); c.walkTo(startX, ZMIN+0.8+(ZMAX-ZMIN-1.6)*(alive.length<2?0.5:i/(alive.length-1)), 4); c.onArrive=()=>{ c.facing=0; c.timer=99; }; });
  if(!laser){ laser=new THREE.Mesh(new THREE.CircleGeometry(0.18,12),new THREE.MeshBasicMaterial({color:0xff2b2b})); laser.rotation.x=-Math.PI/2; laser.position.set(finishX,0.02,(ZMIN+ZMAX)/2); laser.userData.t0=performance.now(); laser.userData.fixed=true; scene.add(laser); }
  const finish=()=>{ for(const c of players){ c.racing=false; c.noCollide=false; } if(laser&&laser.userData.fixed){ scene.remove(laser); laser=null; } game.end(); };
  let red=false; const tick=()=>{ if(game.phase!=='running') return; alive=alive.filter(c=>!c.dead);
    const winner=alive.find(c=>c.g.position.x>=finishX-0.3); if(winner||alive.length===0){ if(winner){ banner('🏁 '+winner.name+' wins!',5000); winner.jump(); winner.say('🏆'); stat(winner,'wins'); } else banner('everyone got caught 😹',3000); setTimeout(finish,1500); return; }
    red=!red;
    if(!red){ banner('🟢 GREEN LIGHT',0); for(const c of alive){ setTimeout(()=>{ if(!red&&game.phase==='running'&&!c.dead){ c.racing=true; c.walkTo(finishX+0.5, c.g.position.z, rnd(2.4,3.4)); c.onArrive=()=>{ c.facing=0; }; } }, c.react*600); } setTimeout(tick, rnd(2000,4500)); }
    else { banner('🔴 RED LIGHT',0); for(const c of alive){ setTimeout(()=>{ if(!c.dead){ c.giveUp(); c.timer=99; c.racing=true; } }, c.react*1000); }
      setTimeout(()=>{ if(game.phase!=='running') return; const caught=alive.filter(c=>c.state==='walk'); for(const c of caught){ c.giveUp(); c.racing=false; c.noCollide=false; c.say(pick(['😱 caught','busted','oops'])); c.play('knocked',0.7); } alive=alive.filter(c=>!caught.includes(c)); }, 900);
      setTimeout(tick, rnd(1800,3200)); } };
  setTimeout(tick, 3500); }

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
// Lou: the birthday girl. A dilute tortie — blue-grey with orange patches, a split forehead, one patched paw.
const LOU={key:'special:lou', name:'Lou', look:{species:'cat', body:'dilute', pattern:'tortie', spots:'orange', eyes:'amber', size:'adult', hat:'none'}};
function spawnLou(){ let c=cats.get(LOU.key); if(!c||c.dead){ c=spawnCat(LOU.key, LOU.name, {...LOU.look}, true); c.say('hi 💕'); net.send({type:'cat', key:LOU.key, name:LOU.name, look:c.look}); } return c; }
function confettiBurst(){ for(let i=0;i<24;i++) setTimeout(()=>{ const f=box(scene,0.22,0.22,0.05,pick([0xff6b6b,0xffd166,0x7fd6ff,0xb28dff,0x9fd6b5]),rnd(-3,3),4+rnd(0,2),rnd(-2,1)); f.userData.vy=rnd(1,3); f.userData.conf=true; f.rotation.set(rnd(0,3),rnd(0,3),0); fishes.push(f); }, i*30); }
function spawnButterfly(){ const g=new THREE.Group(); box(g,0.02,0.3,0.4,0xffd166,0,0,-0.2); box(g,0.02,0.3,0.4,0xffd166,0,0,0.2); box(g,0.08,0.08,0.3,0x333333,0,0,0); scene.add(g); return g; }

// treats on the ground: whoever gets there first eats it; losers and idle cats keep an eye out for the rest
const nearestTreat=(c,r)=>{ let best=null,bd=r; for(const tr of treats){ if(!tr.userData.landed||tr.userData.gone) continue; const d=Math.hypot(tr.position.x-c.g.position.x,tr.position.z-c.g.position.z); if(d<bd){ bd=d; best=tr; } } return best; };
function eatTreat(c,tr){ if(tr.userData.gone) return false; tr.userData.gone=true; scene.remove(tr); c.giveUp(); c.facing=Math.atan2(-(tr.position.z-c.g.position.z), tr.position.x-c.g.position.x)||c.facing; c.hunger=Math.max(0,c.hunger-0.3); c.play('eat',1.5); c.say(pick(['nom','😋','gotcha','mine'])); return true; }
function claimTreat(c,tr){ if(c.dead||tr.userData.gone) return; c.giveUp(); c.walkTo(tr.position.x+rnd(-0.3,0.3), tr.position.z+rnd(-0.3,0.3), 4.5);
  c.onArrive=()=>{ if(!tr.userData.gone){ eatTreat(c,tr); return; } const next=nearestTreat(c,12);   // too slow — is there another one?
    if(next){ c.say(pick(['that one!','👀','mine then'])); claimTreat(c,next); } else c.say(pick(['aw','😾','too slow'])); }; }

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
  if(laser&&!laser.userData.fixed){ const k=(now-laser.userData.t0)/1000; laser.position.x=Math.sin(k*1.1)*7+Math.sin(k*3.7)*1.5; laser.position.z=(ZMIN+ZMAX)/2+Math.cos(k*1.7)*4; }
  for(const f of fishes){ const conf=f.userData.conf; f.userData.vy-=(conf?3:25)*dt; if(conf) f.userData.vy=Math.max(f.userData.vy,f.userData.rain?-16:-2.5); f.position.y+=f.userData.vy*dt; f.rotation.y+=dt*3; if(conf){ f.rotation.x+=dt*4; f.position.x+=Math.sin(t*3+f.position.z)*dt*1.2; } if(f.position.y<(conf?0.03:0.6)){ scene.remove(f); f.userData.gone=true; } }
  fishes=fishes.filter(f=>!f.userData.gone);
  if(vac){ const k=(now-vac.t0)/1000; vac.mesh.position.x=-XMAX-2+k*(2*XMAX+4)/8.5; vac.mesh.rotation.y+=dt*4;
    for(const c of cats.values()) if(c.onProp&&!c.inBox&&!c.anim) c.look={x:vac.mesh.position.x,z:vac.mesh.position.z,until:t+0.5};
    for(const c of cats.values()) if(c.riding){ c.g.position.x=vac.mesh.position.x; c.g.position.z=vac.mesh.position.z; c.g.position.y=0.35; c.facing=0; }
    for(const c of cats.values()){ const dx=c.g.position.x-vac.mesh.position.x, dz=c.g.position.z-vac.mesh.position.z, d=Math.hypot(dx,dz); if(d<1.7&&d>1e-3&&!c.onProp&&!c.riding){ c.g.position.x=clamp(c.g.position.x+dx/d*(1.7-d),-XMAX,XMAX); c.g.position.z=clamp(c.g.position.z+dz/d*(1.7-d),ZMIN,ZMAX); if(c.state!=='walk'){ c.giveUp(); c.walkTo(c.g.position.x+dx/d*3, c.g.position.z+dz/d*3, 6); c.say('!!'); } } } }
  for(const tr of treats){ if(tr.position.y>0.15){ tr.userData.vy-=25*dt; tr.position.y=Math.max(0.15,tr.position.y+tr.userData.vy*dt); tr.rotation.y+=dt*4; if(tr.position.y<=0.15){ tr.userData.landed=t;
      const near4=[...cats.values()].filter(c=>!c.dead).sort((a,b)=>Math.hypot(a.g.position.x-tr.position.x,a.g.position.z-tr.position.z)-Math.hypot(b.g.position.x-tr.position.x,b.g.position.z-tr.position.z)).slice(0,4);
      for(const c of near4){ c.say(pick(['!','treat!','MINE'])); claimTreat(c,tr); } } }
    else if(!tr.userData.gone){ if(t-tr.userData.landed>60){ tr.userData.gone=true; scene.remove(tr); }
      else for(const c of cats.values()) if(!c.dead&&!c.onProp&&!c.anim&&Math.hypot(c.g.position.x-tr.position.x,c.g.position.z-tr.position.z)<1.1){ eatTreat(c,tr); break; } } }   // walked right over one
  treats=treats.filter(tr=>!tr.userData.gone);  if(weather.kind && Math.random()<(weather.kind==='rain'?0.9:0.5)){ const rain=weather.kind==='rain'; const f=box(scene,rain?0.05:0.18,rain?0.5:0.18,rain?0.05:0.05,rain?0x8fc7ff:0xffffff,rnd(-XMAX-3,XMAX+3),10+rnd(0,3),rnd(ZMIN-3,ZMAX+3)); f.userData.vy=rain?-14:-1.2; f.userData.conf=true; f.userData.rain=rain; fishes.push(f); }
  for(const p of props) if(p.label){ const v=new THREE.Vector3(p.x,1.6,p.z).project(camera); p.label.style.left=(v.x+1)/2*innerWidth+'px'; p.label.style.top=(1-v.y)/2*innerHeight+'px'; }
  if(!PLAY && AUTO_REFILL_MIN>0 && now-lastRefill>AUTO_REFILL_MIN*60000){ lastRefill=now; if(props.some(p=>p.amount!=null&&p.amount<3)){ refill(); toast('auto refill'); } }
  for(const p of props) if(p.drop){ p.mesh.position.y=Math.max(0,p.mesh.position.y-dt*16); if(p.mesh.position.y<=0) p.drop=false; }
  renderer.render(scene,camera);
  if(photoWanted){ photoWanted=false; try{ const data=renderer.domElement.toDataURL('image/jpeg',0.82); net.send({type:'photo', data, by:photoBy}); toast('📸 sent'); }catch(e){ toast('photo failed: '+e.message); } }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
