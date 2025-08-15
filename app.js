// app.js (tam sürüm) — 40s hold, global sayaç (Firebase), otomatik ses, Pastebin reveal

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Firebase config (client-side görünür; güvenlik RTDB Rules ile)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyC4QYTj4oKPw4GK-0Gz48m2iHLI-JDre8Q",
  authDomain: "veri107.firebaseapp.com",
  databaseURL: "https://veri107-default-rtdb.firebaseio.com",
  projectId: "veri107",
  storageBucket: "veri107.firebasestorage.app",
  messagingSenderId: "672324720558",
  appId: "1:672324720558:web:efbb05b275c87e655f5a3f"
};

// Sayaç süresi ve Pastebin linki
const CONFIG = { holdMs: 40000 }; // 40s
const PASTEBIN_URL = "https://pastebin.com/hK8Ccqk8";

// DOM elemanları
const elHold  = document.getElementById("hold");
const elCount = document.getElementById("count");
const elTimer = document.getElementById("timer");
const bgAudio = document.getElementById("bgAudio");
const modeHint = document.getElementById("modeHint");

// Pastebin çıktısı kutusu (counter'ın altına eklenir)
let reveal = document.getElementById("reveal");
if (!reveal) {
  reveal = document.createElement("div");
  reveal.id = "reveal";
  reveal.hidden = true;
  reveal.style.marginTop = "10px";
  reveal.style.padding = "10px 12px";
  reveal.style.border = "1px solid #155e52";
  reveal.style.borderRadius = "12px";
  reveal.style.background = "#06100f";
  reveal.style.textAlign = "center";
  reveal.style.fontSize = "14px";
  const wrap = document.querySelector(".counter-wrap");
  if (wrap) wrap.appendChild(reveal);
}

// Local fallback anahtarı
const KEY_LOCAL = "ritual_completions_v1";

// Firebase’i başlat
let useFirebase = true;
let app, db, counterRef;
try {
  app = initializeApp(FIREBASE_CONFIG);
  db = getDatabase(app);
  counterRef = ref(db, "ritual/globalCount");

  // Global sayaç canlı dinleme
  onValue(counterRef, (snap) => {
    const val = snap.val();
    elCount.textContent = String(val || 0);
    if (modeHint) modeHint.textContent = ""; // online
  });
} catch (e) {
  console.warn("Firebase init failed, switching to LOCAL mode.", e);
  useFirebase = false;
  if (modeHint) modeHint.textContent = "LOCAL MODE (Firebase init hatası)";
}

// Local yardımcıları
function loadLocal() {
  try { return parseInt(localStorage.getItem(KEY_LOCAL) || "0", 10) || 0; } catch (_) { return 0; }
}
function saveLocal(n) {
  try { localStorage.setItem(KEY_LOCAL, String(n)); } catch (_) {}
}
if (!useFirebase) {
  elCount.textContent = String(loadLocal());
}

// --------- Sayaç/hold mantığı ---------
let holding = false;
let startTs = 0;
let raf = 0;

function fmt(ms) {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const r = (s % 60).toString().padStart(2, "0");
  return `${m}:${r}`;
}
function resetTimer() {
  elTimer.textContent = fmt(CONFIG.holdMs);
}
resetTimer();

function holdStart() {
  if (holding) return;
  reveal.hidden = true; // yeni turda gizle
  holding = true;
  startTs = performance.now();
  elHold.setAttribute("aria-pressed", "true");
  unlockAudio(); // ilk jestte sesi açmayı dene
  tick();
}
function holdEnd() {
  if (!holding) return;
  holding = false;
  elHold.setAttribute("aria-pressed", "false");
  cancelAnimationFrame(raf);
  resetTimer();
}

async function complete() {
  holding = false;
  elHold.setAttribute("aria-pressed", "false");
  cancelAnimationFrame(raf);

  if (useFirebase) {
    try {
      await runTransaction(counterRef, (cur) => (cur || 0) + 1);
    } catch (e) {
      console.warn("Firebase transaction failed, fallback local.", e);
      const n = loadLocal() + 1;
      saveLocal(n);
      elCount.textContent = String(n);
      if (modeHint) modeHint.textContent = "LOCAL MODE (online yazma hatası)";
    }
  } else {
    const n = loadLocal() + 1;
    saveLocal(n);
    elCount.textContent = String(n);
  }

  resetTimer();

  // Bitti → Pastebin linkini göster
  if (PASTEBIN_URL) {
    reveal.innerHTML =
      'ACCESS GRANTED<br><a href="' + PASTEBIN_URL +
      '" target="_blank" rel="noopener">Pastebin bağlantısı</a>';
    reveal.hidden = false;
  }
}

function tick() {
  const elapsed = performance.now() - startTs;
  if (!holding) return;
  const remaining = Math.max(0, CONFIG.holdMs - elapsed);
  elTimer.textContent = fmt(remaining);
  if (elapsed >= CONFIG.holdMs) {
    complete();
    return;
  }
  raf = requestAnimationFrame(tick);
}

// --- HOLD event'leri (pointer + touch + mouse + klavye) ---
elHold.addEventListener("pointerdown", (e) => {
  try { e.preventDefault(); } catch {}
  elHold.setPointerCapture?.(e.pointerId);
  holdStart();
}, { passive: false });
elHold.addEventListener("pointerup", (e) => {
  try { e.preventDefault(); } catch {}
  holdEnd();
}, { passive: false });
elHold.addEventListener("pointercancel", () => holdEnd(), { passive: false });
elHold.addEventListener("pointerleave",  () => holdEnd(), { passive: false });

elHold.addEventListener("touchstart", (e) => { e.preventDefault(); holdStart(); }, { passive: false });
elHold.addEventListener("touchend",   (e) => { e.preventDefault(); holdEnd();   }, { passive: false });

elHold.addEventListener("mousedown", (e) => { e.preventDefault(); holdStart(); });
elHold.addEventListener("mouseup",   (e) => { e.preventDefault(); holdEnd();   });

elHold.addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); holdStart(); }
});
elHold.addEventListener("keyup", (e) => {
  if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); holdEnd(); }
});

// --- AUDIO AUTO-UNLOCK ---
let audioTried = false;
function unlockAudio() {
  if (audioTried) return;
  audioTried = true;
  if (!bgAudio) return;
  bgAudio.muted = false;
  const p = bgAudio.play();
  if (p && typeof p.catch === "function") {
    p.catch(() => { audioTried = false; }); // engellenirse sonraki jestte yeniden dene
  }
}
document.addEventListener("DOMContentLoaded", unlockAudio);
document.addEventListener("pointerdown", unlockAudio, { once: true, capture: true });
document.addEventListener("touchstart", unlockAudio, { once: true, capture: true });
document.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") unlockAudio(); }, { once: true, capture: true });

// Koruyucu: seçim ve sağ tık kapalı
document.addEventListener("selectstart", (e) => e.preventDefault());
document.addEventListener("contextmenu", (e) => e.preventDefault());
