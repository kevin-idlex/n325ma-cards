let CARDS = [];
const LS_KEY = "n325ma_cards_v2";

function boldNumbers(text) {
  const esc = String(text)
    .replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">");
  return esc
    .replace(/(\d[\d,]*(?:\.\d+)?(?:\s*(?:KCAS|KIAS|kt|kts|\u00b0[CF]|\u00b0|lb-?ft|lb|shp|RPM|psi|%|gal|ft|fpm))?)/gi,
      '<span class="num">$1</span>')
    .replace(/\n/g, "<br/>");
}
function extractSource(back) {
  const lines = String(back).split(/\n/);
  let srcIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*Sources?:\s*/i.test(lines[i])) { srcIdx = i; break; }
  }
  if (srcIdx === -1) return { body: back, source: "" };
  return {
    body: lines.slice(0, srcIdx).join("\n").trim(),
    source: lines.slice(srcIdx).join("\n").replace(/^\s*Sources?:\s*/i, "Source: ")
  };
}

let state = { cat:"ALL", order:[], idx:0, flipped:false, dark:false, againQueue:[] };

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_KEY) || "null");
    if (!s) return;
    if (s.cat) state.cat = s.cat;
    if (Array.isArray(s.order)) state.order = s.order;
    if (typeof s.idx === "number") state.idx = s.idx;
    if (typeof s.dark === "boolean") state.dark = s.dark;
    if (Array.isArray(s.againQueue)) state.againQueue = s.againQueue;
  } catch (e) {}
}
function saveState() {
  localStorage.setItem(LS_KEY, JSON.stringify({
    cat: state.cat, order: state.order, idx: state.idx, dark: state.dark, againQueue: state.againQueue
  }));
}
function filteredIds() {
  if (state.cat === "ALL") return CARDS.map(c => c.id);
  return CARDS.filter(c => c.category === state.cat).map(c => c.id);
}
function ensureOrder(force) {
  const ids = filteredIds();
  const bad = !state.order.length || state.order.length !== ids.length || state.order.some(id => !ids.includes(id));
  if (force || bad) { state.order = ids.slice(); state.idx = 0; state.flipped = false; }
  if (state.idx >= state.order.length) state.idx = 0;
}
function shuffleOrder() {
  const a = filteredIds().slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  state.order = a; state.idx = 0; state.flipped = false;
  state.againQueue = state.againQueue.filter(id => a.includes(id));
  toast("Shuffled"); saveState(); render();
}
function currentCard() {
  if (!state.order.length) return null;
  return CARDS.find(c => c.id === state.order[state.idx]) || null;
}
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 900);
}
function applyFaces() {
  const front = document.getElementById("faceFront");
  const back = document.getElementById("faceBack");
  front.classList.toggle("active", !state.flipped);
  back.classList.toggle("active", state.flipped);
}
function render() {
  document.documentElement.classList.toggle("dark", state.dark);
  document.getElementById("cat").value = state.cat;
  const card = currentCard();
  const prog = document.getElementById("progress");
  if (!card) {
    prog.textContent = "0/0";
    document.getElementById("qText").textContent = "No cards in this category.";
    document.getElementById("aText").textContent = "";
    document.getElementById("sourceText").textContent = "";
    applyFaces();
    return;
  }
  prog.textContent = (state.idx + 1) + "/" + state.order.length
    + (state.againQueue.length ? (" · ↻" + state.againQueue.length) : "");
  document.getElementById("catPill").textContent = card.category;
  document.getElementById("catPillB").textContent = card.category;
  const showV = !!card.verify;
  document.getElementById("verifyFront").classList.toggle("show", showV);
  document.getElementById("verifyBack").classList.toggle("show", showV);
  document.getElementById("qText").innerHTML = boldNumbers(card.front);
  const parts = extractSource(card.back);
  document.getElementById("aText").innerHTML = boldNumbers(parts.body || card.back);
  document.getElementById("sourceText").textContent = parts.source || ("Tags: " + card.tags);
  applyFaces();
  saveState();
}
function flip(){ state.flipped = !state.flipped; render(); }
function go(delta){
  if (!state.order.length) return;
  state.idx = (state.idx + delta + state.order.length) % state.order.length;
  state.flipped = false; render();
}
function gotIt(){
  const id = state.order[state.idx];
  state.againQueue = state.againQueue.filter(x => x !== id);
  go(1); toast("Got it");
}
function again(){
  const id = state.order[state.idx];
  if (!state.againQueue.includes(id)) state.againQueue.push(id);
  state.order.splice(state.idx, 1);
  state.order.push(id);
  if (state.idx >= state.order.length) state.idx = 0;
  state.flipped = false; render(); toast("Requeued");
}

document.getElementById("card").addEventListener("click", flip);
document.getElementById("flipBtn").addEventListener("click", (e)=>{ e.stopPropagation(); flip(); });
document.getElementById("prevBtn").addEventListener("click", ()=>go(-1));
document.getElementById("nextBtn").addEventListener("click", ()=>go(1));
document.getElementById("gotBtn").addEventListener("click", gotIt);
document.getElementById("againBtn").addEventListener("click", again);
document.getElementById("shuffleBtn").addEventListener("click", shuffleOrder);
document.getElementById("themeBtn").addEventListener("click", ()=>{ state.dark=!state.dark; saveState(); render(); });
document.getElementById("resetBtn").addEventListener("click", ()=>{
  localStorage.removeItem(LS_KEY);
  state = { cat:"ALL", order:[], idx:0, flipped:false, dark:state.dark, againQueue:[] };
  ensureOrder(true); render(); toast("Progress reset");
});
document.getElementById("cat").addEventListener("change", (e)=>{
  state.cat = e.target.value; state.order=[]; ensureOrder(true); saveState(); render();
});

let touchX=null, touchY=null, touching=false;
const stage = document.getElementById("stage");
stage.addEventListener("touchstart", (e)=>{
  const t=e.changedTouches[0]; touchX=t.clientX; touchY=t.clientY; touching=true;
}, {passive:true});
stage.addEventListener("touchend", (e)=>{
  if (!touching) return; touching=false;
  const t=e.changedTouches[0];
  const dx=t.clientX-touchX, dy=t.clientY-touchY;
  if (Math.abs(dx)>60 && Math.abs(dx)>Math.abs(dy)*1.2) { if (dx<0) go(1); else go(-1); }
}, {passive:true});

window.addEventListener("keydown", (e)=>{
  if (e.key==="ArrowRight") go(1);
  if (e.key==="ArrowLeft") go(-1);
  if (e.key===" " || e.key==="f" || e.key==="F") { e.preventDefault(); flip(); }
});

(async function boot() {
  try {
    const parts = await Promise.all([
      fetch('cards.b64.1', {cache:'default'}).then(r => { if(!r.ok) throw new Error(r.status); return r.text(); }),
      fetch('cards.b64.2', {cache:'default'}).then(r => { if(!r.ok) throw new Error(r.status); return r.text(); }),
    ]);
    const b64 = parts[0].trim() + parts[1].trim();
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([bin]).stream().pipeThrough(ds);
    CARDS = JSON.parse(await new Response(stream).text());
  } catch (e) {
    console.error(e);
    document.getElementById('qText').textContent = 'Failed to load cards';
    return;
  }
  loadState();
  ensureOrder(false);
  if (!state.order.length) ensureOrder(true);
  render();
})();
