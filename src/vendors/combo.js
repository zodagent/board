(()=>{
if (window.__combo) return;
window.__combo = true;

const shortcuts = {};
const listeners = new Set();

function combo(e){
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  const k = e.key.toLowerCase();
  if (!["shift","control","meta","alt"].includes(k)) parts.push(k);
  return parts.join("+");
}

document.addEventListener("keydown", function(e){
  const c = combo(e);
  if (shortcuts[c]) {
    e.preventDefault();
    shortcuts[c](c, e);
  }
  listeners.forEach(fn=>fn(c, e));
});

window.combo = {
  on(keys, fn){
    if (typeof keys === "string") keys = [keys];
    keys.forEach(k=>shortcuts[k.toLowerCase()] = fn);
    return this;
  },
  off(keys){
    if (typeof keys === "string") keys = [keys];
    keys.forEach(k=>delete shortcuts[k.toLowerCase()]);
    return this;
  },
  listen(fn){ listeners.add(fn); return this; },
  unlisten(fn){ listeners.delete(fn); return this; },
  parse: combo,
  get registered(){ return Object.keys(shortcuts); },
};
})();
