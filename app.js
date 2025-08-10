// GLOBAL counter via Firebase RTDB (fallback local) + 40s timer + auto audio unlock
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const CONFIG = { holdMs: 40000 }; // 40,000 ms = 40s

// 1) FILL THESE BEFORE DEPLOY (Firebase console → Project settings → SDK setup & config)
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
// If left as-is (YOUR_*), app will fall back to LOCAL-ONLY mode.

const elHold = document.getElementById('hold');
const elCount = document.getElementById('count');
const elTimer = document.getElementById('timer');
const bgAudio = document.getElementById('bgAudio');
const modeHint = document.getElementById('modeHint');

const KEY_LOCAL = 'ritual_completions_v1';
let useFirebase = !Object.values(FIREBASE_CONFIG).some(v => typeof v === 'string' && v.startsWith("YOUR_"));

let app, db, counterRef;
if (useFirebase){
  try {
    app = initializeApp(FIREBASE_CONFIG);
    db = getDatabase(app);
    counterRef = ref(db, 'ritual/globalCount');
    // Live listener for global count
    onValue(counterRef, (snap)=>{
      let val = snap.val();
      elCount.textContent = String(val || 0);
      modeHint.textContent = ""; // online
    });
  } catch (e){
    console.warn("Firebase init failed, switching to LOCAL mode.", e);
    useFirebase = false;
  }
}

function loadLocal(){ try{ return parseInt(localStorage.getItem(KEY_LOCAL) || '0', 10) || 0; }catch(_){ return 0; } }
function saveLocal(n){ try{ localStorage.setItem(KEY_LOCAL, String(n)); }catch(_){ } }

if (!useFirebase){
  elCount.textContent = String(loadLocal());
  modeHint.textContent = "LOCAL MODE (Firebase config girilmedi)";
}

let holding = false;
let startTs = 0;
let raf = 0;

function fmt(ms){
  const s = Math.ceil(ms/1000);
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const r = (s%60).toString().padStart(2,'0');
  return `${m}:${r}`;
}
function resetTimer(){ elTimer.textContent = fmt(CONFIG.holdMs); }
resetTimer();

function holdStart(){
  if (holding) return;
  holding = true;
  startTs = performance.now();
  elHold.setAttribute('aria-pressed','true');
  unlockAudio(); // start audio as soon as user holds
  tick();
}
function holdEnd(){
  if (!holding) return;
  holding = false;
  elHold.setAttribute('aria-pressed','false');
  cancelAnimationFrame(raf);
  resetTimer();
}

async function complete(){
  holding = false;
  elHold.setAttribute('aria-pressed','false');
  cancelAnimationFrame(raf);
  if (useFirebase){
    try{
      await runTransaction(counterRef, (cur)=> (cur||0) + 1 );
    }catch(e){
      console.warn("Firebase transaction failed, fallback local.", e);
      const n = loadLocal()+1; saveLocal(n); elCount.textContent = String(n);
      modeHint.textContent = "LOCAL MODE (online yazma hatası)";
    }
  } else {
    const n = loadLocal()+1; saveLocal(n); elCount.textContent = String(n);
  }
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

// --- AUDIO AUTOUNLOCK ---
let audioTried = false;
function unlockAudio(){
  if (audioTried) return;
  audioTried = true;
  if (!bgAudio) return;
  bgAudio.muted = false;
  const p = bgAudio.play();
  if (p && typeof p.catch === 'function'){
    p.catch(()=>{ audioTried = false; }); // try again on next gesture
  }
}
document.addEventListener('DOMContentLoaded', unlockAudio);
document.addEventListener('pointerdown', unlockAudio, { once:true, capture:true });
document.addEventListener('touchstart', unlockAudio, { once:true, capture:true });
document.addEventListener('keydown', (e)=>{ if (e.key === ' ' || e.key === 'Enter') unlockAudio(); }, { once:true, capture:true });

// Events (pointer + touch + mouse + keyboard) for holding
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
