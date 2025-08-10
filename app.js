// Minimal ritual WITH VISIBLE COUNTDOWN (100s) + default-on audio
const CONFIG = { holdMs: 100000 }; // 100,000 ms = 100s

const elHold = document.getElementById('hold');
const elCount = document.getElementById('count');
const elTimer = document.getElementById('timer');
const bgAudio = document.getElementById('bgAudio');
const tapOverlay = document.getElementById('tapToEnable');
const tapEnableBtn = document.getElementById('tapEnableBtn');
const KEY = 'ritual_completions_v1';

function loadCount(){
  try{ return parseInt(localStorage.getItem(KEY) || '0', 10) || 0; }catch(_){ return 0; }
}
function saveCount(n){
  try{ localStorage.setItem(KEY, String(n)); }catch(_){}
}

let count = loadCount();
elCount.textContent = String(count);

let holding = false;
let startTs = 0;
let raf = 0;

function fmt(ms){
  const s = Math.ceil(ms/1000);
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const r = (s%60).toString().padStart(2,'0');
  return `${m}:${r}`;
}
function resetTimer(){
  elTimer.textContent = fmt(CONFIG.holdMs);
}
resetTimer();

function holdStart(){
  if (holding) return;
  holding = true;
  startTs = performance.now();
  elHold.setAttribute('aria-pressed','true');
  tick();
}
function holdEnd(){
  if (!holding) return;
  holding = false;
  elHold.setAttribute('aria-pressed','false');
  cancelAnimationFrame(raf);
  resetTimer();
}

function complete(){
  holding = false;
  elHold.setAttribute('aria-pressed','false');
  cancelAnimationFrame(raf);
  count += 1;
  saveCount(count);
  elCount.textContent = String(count);
  resetTimer();
}

function tick(){
  const elapsed = performance.now() - startTs;
  if (!holding){ return; }
  const remaining = Math.max(0, CONFIG.holdMs - elapsed);
  elTimer.textContent = fmt(remaining);
  if (elapsed >= CONFIG.holdMs){
    complete();
    return;
  }
  raf = requestAnimationFrame(tick);
}

// Default-on audio: try autoplay on load, fall back to first interaction
function tryAutoplay(){
  if (!bgAudio) return;
  bgAudio.muted = false;
  const p = bgAudio.play();
  if (p && typeof p.catch === 'function'){
    p.then(()=>{
      if (tapOverlay) tapOverlay.hidden = true;
    }).catch(()=>{
      if (tapOverlay) tapOverlay.hidden = false;
    });
  }
}
document.addEventListener('DOMContentLoaded', tryAutoplay);
// also try on first user gesture, just in case
window.addEventListener('pointerdown', tryAutoplay, {once:true});
window.addEventListener('click', tryAutoplay, {once:true});
tapEnableBtn?.addEventListener('click', tryAutoplay);

// Events (pointer + touch + mouse + keyboard)
elHold.addEventListener('pointerdown', (e)=>{ try{e.preventDefault();}catch(_){}
  elHold.setPointerCapture?.(e.pointerId);
  holdStart();
}, {passive:false});
elHold.addEventListener('pointerup', (e)=>{ try{e.preventDefault();}catch(_){}
  holdEnd();
}, {passive:false});
elHold.addEventListener('pointercancel', ()=>holdEnd(), {passive:false});
elHold.addEventListener('pointerleave', ()=>holdEnd(), {passive:false});

elHold.addEventListener('touchstart', (e)=>{ e.preventDefault(); holdStart(); }, {passive:false});
elHold.addEventListener('touchend', (e)=>{ e.preventDefault(); holdEnd(); }, {passive:false});

elHold.addEventListener('mousedown', (e)=>{ e.preventDefault(); holdStart(); });
elHold.addEventListener('mouseup', (e)=>{ e.preventDefault(); holdEnd(); });

elHold.addEventListener('keydown', (e)=>{
  if (e.code === 'Space' || e.code === 'Enter'){ e.preventDefault(); holdStart(); }
});
elHold.addEventListener('keyup', (e)=>{
  if (e.code === 'Space' || e.code === 'Enter'){ e.preventDefault(); holdEnd(); }
});

// Hard block selection/context menu globally
document.addEventListener('selectstart', (e)=>e.preventDefault());
document.addEventListener('contextmenu', (e)=>e.preventDefault());
