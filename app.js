/* Config + Logic */
const CONFIG = {
  webhookUrl: null,
  holdMs: 90000, // 90 seconds
  // Mevcut sitedeki “kilit” kutusu mesajlarını bozmamak için, sadece durum satırını güncelliyoruz.
  unlockMessage: "", // İstersen buraya kendi mesajını gir. Boşsa HTML'deki #unlockMessage gösterilir.
};

const timeEl = document.getElementById('time');
const barEl = document.getElementById('bar');
const holdArea = document.getElementById('holdArea');
const statusLine = document.getElementById('statusLine');
const unlockMessage = document.getElementById('unlockMessage');
const bgAudio = document.getElementById('bgAudio');
const soundToggle = document.getElementById('soundToggle');

let holding = false;
let startTs = 0;
let rafId = null;
let unlocked = false;

// Utility: format mm:ss
function fmt(t){
  const s = Math.ceil(t/1000);
  const m = Math.floor(s/60).toString().padStart(2,'0');
  const r = (s % 60).toString().padStart(2,'0');
  return `${m}:${r}`;
}

// Initialize UI
timeEl.textContent = fmt(CONFIG.holdMs);
barEl.style.width = "0%";
statusLine.textContent = "// TRACE: idle";

// SOUND
soundToggle.addEventListener('click', () => {
  const willEnable = soundToggle.getAttribute('aria-pressed') === 'false';
  soundToggle.setAttribute('aria-pressed', String(willEnable));
  soundToggle.textContent = willEnable ? "SOUND: ON" : "SOUND: OFF";
  bgAudio.muted = !willEnable;
  if (willEnable) { bgAudio.play().catch(()=>{}); }
});

// Auto-prepare audio on first interaction
function primeAudio(){
  bgAudio.muted = true; // başta sessiz
  bgAudio.play().catch(()=>{});
  window.removeEventListener('pointerdown', primeAudio, {once:true});
}
window.addEventListener('pointerdown', primeAudio, {once:true});

function onHoldStart(){
  if (unlocked) return;
  if (holding) return;
  holding = true;
  startTs = performance.now();
  holdArea.setAttribute('aria-pressed','true');
  statusLine.textContent = "// TRACE: hold-start";
  holdTick();
  // Ses açık ise volume'u hafif artır
  if (soundToggle.getAttribute('aria-pressed') === 'true') {
    bgAudio.muted = false;
    bgAudio.play().catch(()=>{});
  }
}

function onHoldEnd(interrupted=true){
  if (!holding || unlocked) return;
  holding = false;
  holdArea.setAttribute('aria-pressed','false');
  cancelAnimationFrame(rafId);
  if (interrupted){
    // reset
    barEl.style.width = "0%";
    timeEl.textContent = fmt(CONFIG.holdMs);
    statusLine.textContent = "// TRACE: interrupt -> RESET";
  }
}

function holdTick(){
  const elapsed = performance.now() - startTs;
  const remaining = Math.max(0, CONFIG.holdMs - elapsed);
  const pct = Math.min(100, (elapsed / CONFIG.holdMs) * 100);
  barEl.style.width = pct.toFixed(2) + "%";
  timeEl.textContent = fmt(remaining);

  if (elapsed >= CONFIG.holdMs){
    // Completed
    unlocked = true;
    holding = false;
    statusLine.textContent = "// TRACE: sequence-complete";
    holdArea.classList.add('flicker');
    // Mevcut mesajı koru, sadece göster
    addLog('complete');
    sendBeacon({event:'complete', t: (new Date()).toISOString(), id: anonId()});
    const text = (CONFIG.unlockMessage || unlockMessage.textContent || "").trim();
    if (text){
      unlockMessage.hidden = false;
      // Eğer CONFIG.unlockMessage doluysa HTML'dekini değiştir
      if (CONFIG.unlockMessage){
        unlockMessage.textContent = CONFIG.unlockMessage;
      }
    } else {
      // Boşsa, sadece TRACE kalsın.
    }
    return;
  }
  rafId = requestAnimationFrame(holdTick);
}

// Pointer/Touch/Keyboard events
holdArea.addEventListener('pointerdown', (e)=>{
  holdArea.setPointerCapture(e.pointerId);
  onHoldStart();
});
holdArea.addEventListener('pointerup', ()=> onHoldEnd(true));
holdArea.addEventListener('pointercancel', ()=> onHoldEnd(true));
holdArea.addEventListener('pointerleave', ()=> onHoldEnd(true));

holdArea.addEventListener('keydown', (e)=>{
  if (e.code === 'Space' || e.code === 'Enter'){
    e.preventDefault();
    onHoldStart();
  }
});
holdArea.addEventListener('keyup', (e)=>{
  if (e.code === 'Space' || e.code === 'Enter'){
    e.preventDefault();
    onHoldEnd(true);
  }
});



/*** Local Completion Logs ***************************************************/

const LOGKEY = "ritual172_logs";

function loadLogs(){
  try{ return JSON.parse(localStorage.getItem(LOGKEY) || "[]"); }
  catch(e){ return []; }
}
function saveLogs(arr){
  localStorage.setItem(LOGKEY, JSON.stringify(arr));
}
function anonId(){
  // simple fingerprint: hash of UA + lang + screen size (local only)
  const s = (navigator.userAgent||"") + "|" + (navigator.language||"") + "|" + (screen.width+"x"+screen.height);
  let h=0;
  for(let i=0;i<s.length;i++){ h = Math.imul(31, h) + s.charCodeAt(i) | 0; }
  return (h>>>0).toString(16).padStart(8,"0");
}
function nowLocal(){
  try{
    const d = new Date();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "local";
    return { iso: d.toISOString(), view: d.toLocaleString([], { hour12:false }), tz };
  }catch(e){
    const d = new Date();
    return { iso: d.toISOString(), view: d.toString(), tz: "local" };
  }
}
const logsList = document.getElementById('logsList');
const logCountEl = document.getElementById('logCount');
const copyBtn = document.getElementById('copyLogs');
const downloadBtn = document.getElementById('downloadLogs');
const clearBtn = document.getElementById('clearLogs');

function renderLogs(){
  const arr = loadLogs();
  logCountEl.textContent = String(arr.length);
  if (!arr.length){
    logsList.textContent = "// no records";
    return;
  }
  const lines = arr.map((x,i)=>{
    return `>>> [${x.time.view} ${x.time.tz}] id:${x.id} status:${x.status}`;
  }).join("\n");
  logsList.textContent = lines;
}

function addLog(status="complete"){
  const arr = loadLogs();
  arr.push({ id: anonId(), status, time: nowLocal() });
  saveLogs(arr);
  renderLogs();
}

// Export / Copy / Clear
copyBtn?.addEventListener('click', ()=>{
  const arr = loadLogs();
  const txt = JSON.stringify(arr, null, 2);
  navigator.clipboard?.writeText(txt).then(()=>{
    statusLine.textContent = "// TRACE: logs copied";
  }).catch(()=>{
    statusLine.textContent = "// TRACE: copy failed";
  });
});
downloadBtn?.addEventListener('click', ()=>{
  const arr = loadLogs();
  const blob = new Blob([JSON.stringify(arr, null, 2)], {type:"application/json"});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = "ritual172_logs.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  statusLine.textContent = "// TRACE: logs exported";
});
clearBtn?.addEventListener('click', ()=>{
  if (!confirm("Clear local logs?")) return;
  saveLogs([]);
  renderLogs();
  statusLine.textContent = "// TRACE: logs cleared";
});

// Initial render
renderLogs();

/* Optional: remote webhook (disabled by default)
   - If you later add a URL to CONFIG.webhookUrl, we will send a beacon on completion.
*/
function sendBeacon(payload){
  const url = CONFIG.webhookUrl;
  if (!url) return;
  try{
    const data = new Blob([JSON.stringify(payload)], {type: 'application/json'});
    navigator.sendBeacon(url, data);
  }catch(e){}
}
