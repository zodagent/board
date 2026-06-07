(()=>{
  if (window.__zinc) return;
  window.__zinc = true;

  const dirs = {};
  const bindings = new Map();
  const state = {};
  const pending = [];
  const refs = {};
  let observer = null;

  const BOOL_ATTRS = new Set(['checked', 'disabled', 'readOnly', 'selected', 'hidden', 'indeterminate']);

  dirs['z-text'] = (el, val) => { el.textContent = val ?? ''; };
  dirs['z-html'] = (el, val) => { el.innerHTML = val ?? ''; };
  dirs['z-show'] = (el, val) => {
    if (el._zOrig == null) el._zOrig = el.style.display || '';
    el.style.display = val ? el._zOrig : 'none';
  };
  dirs['z-class'] = (el, val) => {
    if (typeof val !== 'object' || val === null) return;
    for (const [cls, on] of Object.entries(val)) {
      el.classList.toggle(cls, !!on);
    }
  };
  dirs['z-each'] = (el, arr) => {
    if (!Array.isArray(arr)) arr = [];
    const tpl = el._zTpl || (el._zTpl = el.firstElementChild);
    if (!tpl) return;
    el.innerHTML = '';
    for (const item of arr) {
      const node = tpl.cloneNode(true);
      for (const n of [node, ...node.querySelectorAll('*')]) {
        for (const a of [...n.attributes]) {
          const na = a.name;
          if (!na.startsWith('z-')) continue;
          if (na === 'z-ref') { refs[a.value.trim()] = n; continue; }
          const val = item && typeof item === 'object' ? item[a.value.trim()] : item;
          if (na.startsWith('z-on:')) {
            if (typeof val === 'function') n.addEventListener(na.slice(5), val);
            continue;
          }
          if (na.startsWith('z-bind:')) dirs['z-bind'](n, val, na.slice(7));
          else if (dirs[na]) dirs[na](n, val);
        }
      }
      el.appendChild(node);
    }
  };

  dirs['z-bind'] = (el, val, attr) => {
    if (val == null || val === false) {
      el.removeAttribute(attr);
      if (BOOL_ATTRS.has(attr)) el[attr] = false;
    } else {
      el.setAttribute(attr, String(val));
      if (attr === 'value' && 'value' in el) el.value = val;
      else if (BOOL_ATTRS.has(attr)) el[attr] = true;
    }
  };

  const directive = (name, fn) => {
    if (typeof fn !== 'function') return;
    dirs[name] = fn;
    for (let i = pending.length - 1; i >= 0; i--) {
      const p = pending[i];
      if (p.type !== name) continue;
      if (!bindings.has(p.key)) bindings.set(p.key, []);
      bindings.get(p.key).push({ el: p.el, type: p.type, attr: p.attr });
      pending.splice(i, 1);
      if (p.key in state) {
        try { fn(p.el, state[p.key], p.attr); } catch (e) { console.error('zinc:', e); }
      }
    }
  };

  const set = (key, val) => {
    if (typeof key === 'object') {
      for (const k in key) set(k, key[k]);
      return;
    }
    state[key] = val;
    const entries = bindings.get(key);
    if (!entries) return;
    for (const { el, type, attr } of entries) {
      if (!document.contains(el)) continue;
      try { dirs[type](el, val, attr); } catch (e) { console.error('zinc:', e); }
    }
  };

  const get = k => state[k];

  const register = (el, type, key, attr) => {
    if (!dirs[type]) {
      pending.push({ el, type, key, attr });
      return;
    }
    if (!bindings.has(key)) bindings.set(key, []);
    bindings.get(key).push({ el, type, attr });
    if (key in state) {
      try { dirs[type](el, state[key], attr); } catch (e) { console.error('zinc:', e); }
    }
  };

  function walk(node) {
    if (node.nodeType !== 1) return;
    const stack = [node];
    while (stack.length) {
      const n = stack.pop();
      for (const a of [...n.attributes]) {
        const name = a.name;
        if (!name.startsWith('z-')) continue;
        const key = a.value.trim();
        if (!key) continue;
        if (name.startsWith('z-on:')) {
          const event = name.slice(5);
          n.addEventListener(event, function(e) {
            try {
              var store = null, el = n;
              while (el) { if (el._store) { store = el._store; break; } el = el.parentElement; }
              const m = key.match(/^(\w+)\(([^)]*)\)$/);
              if (m) {
                const fn = (store && store[m[1]]) || m[1].split('.').reduce((o, k) => o?.[k], window);
                if (fn) fn(...m[2].split(',').map(s => state[s.trim()]));
              } else {
                const fn = (store && store[key]) || key.split('.').reduce((o, k) => o?.[k], window);
                if (fn) fn();
              }
            } catch (ex) { console.error('zinc:', ex); }
          });
          continue;
        }
        if (name === 'z-ref') { refs[key] = n; continue; }
        let type = name, attr;
        if (name.startsWith('z-bind:')) { type = 'z-bind'; attr = name.slice(7); }
        register(n, type, key, attr);
      }
      stack.push(...n.children);
    }
  }

  const init = () => {
    observer = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) walk(n);
        for (const n of m.removedNodes) {
          if (n.nodeType !== 1) continue;
          for (const [, entries] of bindings) {
            for (let i = entries.length - 1; i >= 0; i--) {
              if (!document.contains(entries[i].el)) entries.splice(i, 1);
            }
          }
          for (let i = pending.length - 1; i >= 0; i--) {
            if (!document.contains(pending[i].el)) pending.splice(i, 1);
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
    walk(document.body);
    document.dispatchEvent(new CustomEvent('zinc:ready'));
  };

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  const zinc = { directive, set, get, refs };
  zinc.destroy = () => {
    if (observer) observer.disconnect();
    bindings.clear();
    pending.length = 0;
    for (const k in refs) delete refs[k];
  };
  window.Zinc = zinc;
})();
