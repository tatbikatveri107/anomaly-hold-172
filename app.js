/* Config + Logic */
const CONFIG = {
  backupAudioSrc: ['./11L-Distorted,_earthquak-1754848264435.mp3','./audio.mp3'],
  audioSrc: './bg.mp3',
  webhookUrl: null,
  \170000, // 172 seconds
  // Mevcut sitedeki “kilit” kutusu mesajlarını bozmamak için, sadece durum satırını güncelliyoruz.
  \1\"✅ Human-Override kaydedildi: <b>172 → PROVISIONAL/ALLY\"
};

const timeEl = document.getElementById('time');
const barEl = document.getElementById('bar');
const holdArea = document.getElementById('holdArea');
const statusLine = document.getElementById('statusLine');
const unlockMessage = document.getElementById('unlockMessage');
const bgAudio = document.getElementById('bgAudio');
const rootEl = document.documentElement;
const rootHtml = document.documentElement;
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
  if (willEnable){
    tryAudioCandidates(true);
    bgAudio.muted = false;
    const p = bgAudio.play();
    if (p && typeof p.catch === 'function'){
      p.then(()=>{ statusLine.textContent = "// TRACE: audio: playing"; showAudioHelp(false); })
       .catch(()=>{ statusLine.textContent = "// TRACE: audio: blocked"; showAudioHelp(true); });
    }
  } else {
    try { bgAudio.pause(); } catch(e){}
    bgAudio.muted = true;
  }
});
    }
  } else {
    try { bgAudio.pause(); } catch(e){}
  }
});
  soundToggle.textContent = willEnable ? "SOUND: ON" : "SOUND: OFF";
  bgAudio.muted = !willEnable;
  if (willEnable) { bgAudio.play().catch(()=>{}); }
});

// Auto-prepare audio on first interaction
function primeAudio(){
  try{ setAudioSrc(); bgAudio.load(); }catch(e){}
  bgAudio.muted = true; // başta sessiz
  const p = bgAudio.play();
  if (p && typeof p.catch==='function'){
    p.catch(()=>{ showAudioHelp(true); });
  }
}
window.addEventListener('pointerdown', primeAudio, {once:true});
window.addEventListener('click', primeAudio, {once:true});

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
  if (remaining <= 30000) { rootEl.classList.add('glitch'); }
  const pct = Math.min(100, (elapsed / CONFIG.holdMs) * 100);
  barEl.style.width = pct.toFixed(2) + "%";
  timeEl.textContent = fmt(remaining);
  if (remaining <= 30000){ document.body.classList.add('glitch'); } else { document.body.classList.remove('glitch'); }

  if (elapsed >= CONFIG.holdMs){
    // Completed
    unlocked = true;
    holding = false;
    statusLine.textContent = "// TRACE: sequence-complete";
    holdArea.classList.add('flicker');
    // Mevcut mesajı koru, sadece göster
    addLog('complete');
    renderCount();
    sendBeacon({event:'complete', t: (new Date()).toISOString(), id: anonId()});
    const text = (CONFIG.unlockMessage || unlockMessage.innerHTML || "").trim();
    if (text){
      unlockMessage.hidden = false;
      // Eğer CONFIG.unlockMessage doluysa HTML'dekini değiştir
      if (CONFIG.unlockMessage){
        unlockMessage.innerHTML = CONFIG.unlockMessage;
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
  try{ e.preventDefault(); }catch(_){ }

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


/*** Minimal Counter Only *****************************************************/
const completedCountEl = document.getElementById('completedCount');
function renderCount(){
  try{
    const arr = loadLogs();
    if (completedCountEl) completedCountEl.textContent = String(arr.length);
  }catch(e){
    if (completedCountEl) completedCountEl.textContent = "0";
  }
}
// initial
renderCount();


/*** Audio Robustness *********************************************************/
const audioHelp = document.getElementById('audioHelp');

function setAudioSrc(){
  try {
    if (CONFIG.audioSrc && bgAudio.getAttribute('src') !== CONFIG.audioSrc){
      bgAudio.setAttribute('src', CONFIG.audioSrc);
      bgAudio.load();
    }
  } catch(e){}
}
function showAudioHelp(on=true){
  if (!audioHelp) return;
  audioHelp.hidden = !on;
}
function audioReady(){
  statusLine.textContent = "// TRACE: audio: ready";
  showAudioHelp(false);
}
function audioError(){
  statusLine.textContent = "// TRACE: audio: error (dosya yolu?)";
  showAudioHelp(true);
}
bgAudio.addEventListener('canplaythrough', audioReady);
bgAudio.addEventListener('error', audioError);

// Ensure source on load
setAudioSrc();


/*** Audio Fallback Chain *****************************************************/
let _audioTried = 0;
let _audioList = [];
function buildAudioList(){
  const cached = localStorage.getItem('audioSrcOK');
  if (cached){ return [cached, CONFIG.audioSrc, ...(CONFIG.backupAudioSrc||[])]; }
  return [CONFIG.audioSrc, ...(CONFIG.backupAudioSrc||[])];
}
function tryAudioCandidates(reset=false){
  if (reset){ _audioTried = 0; }
  _audioList = buildAudioList().filter((v,i,arr)=>v && arr.indexOf(v)===i);
  if (!_audioList.length){ audioError(); return; }
  if (_audioTried >= _audioList.length){ audioError(); return; }
  const src = _audioList[_audioTried++];
  bgAudio.setAttribute('src', src);
  try { bgAudio.load(); } catch(e){}
}
function audioReadyMark(){
  const src = bgAudio.getAttribute('src');
  if (src){ localStorage.setItem('audioSrcOK', src); }
  audioReady();
}
bgAudio.addEventListener('canplaythrough', audioReadyMark);
bgAudio.addEventListener('error', ()=>{
  // Try next candidate if current fails
  tryAudioCandidates(false);
});
// initialize
tryAudioCandidates(true);


/*** Block selection/context menu *********************************************/
function preventDefaultSelection(e){ e.preventDefault(); }
document.addEventListener('selectstart', preventDefaultSelection);
document.addEventListener('contextmenu', preventDefaultSelection);


// Default SOUND ON & autoplay attempt
function initAutoplay(){
  try {
    soundToggle.setAttribute('aria-pressed','true');
    soundToggle.textContent = "SOUND: ON";
    bgAudio.muted = false;
    tryAudioCandidates && tryAudioCandidates(true);
    const p = bgAudio.play();
    if (p && typeof p.catch === 'function'){
      p.then(()=>{ statusLine.textContent = "// TRACE: audio: playing"; showAudioHelp(false); })
       .catch(()=>{ statusLine.textContent = "// TRACE: audio: blocked"; showAudioHelp(true); });
    }
  } catch(e){}
}
document.addEventListener('DOMContentLoaded', initAutoplay);

// Fallbacks for mobile
holdArea.addEventListener('touchstart', (e)=>{ e.preventDefault(); onHoldStart(); }, {passive:false});
holdArea.addEventListener('touchend', (e)=>{ e.preventDefault(); onHoldEnd(true); }, {passive:false});
holdArea.addEventListener('mousedown', (e)=>{ e.preventDefault(); onHoldStart(); });
holdArea.addEventListener('mouseup', (e)=>{ e.preventDefault(); onHoldEnd(true); });


// Default SOUND: ON
try { soundToggle.setAttribute('aria-pressed','true'); soundToggle.textContent = "SOUND: ON"; } catch(e){}

const tapOverlay = document.getElementById('tapToEnable');
const tapEnableBtn = document.getElementById('tapEnableBtn');

function tryAutoplay(){
  tryAudioCandidates(true);
  bgAudio.muted = false;
  const p = bgAudio.play();
  if (p && typeof p.catch === 'function'){
    p.then(()=>{ statusLine.textContent = "// TRACE: audio: autoplay ok"; showAudioHelp(false); tapOverlay && (tapOverlay.hidden = true); })
     .catch(()=>{ statusLine.textContent = "// TRACE: audio: autoplay blocked"; showAudioHelp(true); tapOverlay && (tapOverlay.hidden = false); });
  }
}

// Attempt on load
document.addEventListener('DOMContentLoaded', tryAutoplay);
// Also allow enable via overlay button
tapEnableBtn?.addEventListener('click', ()=>{
  tryAutoplay();
});

