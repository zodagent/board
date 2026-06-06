(()=>{
if (window.__ztore) return;
window.__ztore = true;

let CURRENT = null, BATCH = 0;
const PENDING = new Set();

function flushBatch(){
  if (BATCH) return;
  BATCH = 1;
  queueMicrotask(()=>{
    const jobs = [...PENDING];
    PENDING.clear();
    BATCH = 0;
    jobs.forEach(fn => fn());
  });
}

function signal(value){
  const subs = new Set();
  const get = ()=> (CURRENT && (subs.add(CURRENT), CURRENT.deps.add(subs)), value);
  const set = nv => {
    const prev = value;
    value = typeof nv === "function" ? nv(value) : nv;
    if (!Object.is(prev, value)) {
      subs.forEach(fn => PENDING.add(fn));
      flushBatch();
    }
  };
  return { get, set };
}

function effect(fn){
  const run = ()=>{
    cleanup(run);
    const prev = CURRENT;
    CURRENT = run;
    try { fn(); } finally { CURRENT = prev; }
  };
  run.deps = new Set();
  run();
  return run;
}

function cleanup(ef){
  for (const d of ef.deps) d.delete(ef);
  ef.deps.clear();
}

window.ztore = (initial = {})=>{
  const signals = {};
  const events = {};
  const subs = new Set();

  const store = {
    get(k){
      if (k) return signals[k]?.get();
      const out = {};
      for (const k in signals) out[k] = signals[k].get();
      return out;
    },
    has(k){ return k in signals },
    set(k, v){
      if (typeof k === "object" || typeof k === "function"){
        const patch = typeof k === "function" ? k(store.get()) : k;
        for (const p in patch) store.set(p, patch[p]);
        return;
      }
      if (!signals[k]) signals[k] = signal(undefined);
      signals[k].set(v);
    },
    key(k){ return store.get(k) },
    update: function(fn){ return store.set(fn) },
    merge(k, v){
      var cur = store.get(k);
      if (typeof cur === 'object' && cur !== null && typeof v === 'object' && v !== null) {
        store.set(k, Object.assign({}, cur, v));
      } else {
        store.set(k, v);
      }
      return store;
    },
    subscribe(fn){
      const ef = effect(()=>fn(store.get()));
      subs.add(ef);
      return ()=> (subs.delete(ef), cleanup(ef));
    },
    select(sel, cb){
      let prev;
      return effect(()=>{
        const next = sel(store.get());
        if (!Object.is(prev, next)) { cb(next, prev); prev = next; }
      });
    },
    memo(fn){
      const s = signal();
      effect(()=>s.set(fn()));
      return s.get;
    },
    effect,
    on(ev, fn){
      (events[ev] ||= new Set()).add(fn);
      return ()=> events[ev]?.delete(fn);
    },
    once(ev, fn){
      const off = store.on(ev, (...a)=>(off(), fn(...a)));
      return off;
    },
    off(ev, fn){
      if (!ev) for (const k in events) events[k].clear();
      else if (!fn) events[ev]?.clear();
      else events[ev]?.delete(fn);
    },
    emit(ev, data){
      events[ev]?.forEach(fn=>{
        try { fn({ type: ev, data, state: store.get() }); }
        catch (e) { console.error(e); }
      });
    },
    destroy(){
      subs.forEach(cleanup);
      subs.clear();
      for (const k in signals) { if (signals[k]._ef) cleanup(signals[k]._ef); delete signals[k]; }
      for (const k in events) delete events[k];
    },
    watch(key, fn){
      const ef = effect(()=>{
        if (Array.isArray(key)) {
          fn(key.map(k => signals[k]?.get()), store);
        } else {
          fn(signals[key]?.get(), store);
        }
      });
      return ()=> cleanup(ef);
    },
    batch(fn){
      BATCH++;
      try { fn(); } finally { BATCH--; if (!BATCH) flushBatch(); }
    },
    enableHistory(opts){
      opts = opts || {};
      var depth = opts.depth || 50;
      var past = [], future = [], saving = false;
      var origSet = store.set, origBatch = store.batch;

      function saveSnap(){
        if (saving) return;
        saving = true;
        past.push(JSON.parse(JSON.stringify(store.get())));
        if (past.length > depth) past.shift();
        future = [];
      }

      store.set = function(k, v){
        if (!saving) { saveSnap(); saving = true; origSet(k, v); saving = false; }
        else { origSet(k, v); }
      };
      store.batch = function(fn){
        if (!saving) { saveSnap(); saving = true; try { origBatch(fn); } finally { saving = false; } }
        else { origBatch(fn); }
      };
      store.undo = function(){
        if (!past.length) return;
        future.push(JSON.parse(JSON.stringify(store.get())));
        saving = true;
        origSet(past.pop());
        saving = false;
      };
      store.redo = function(){
        if (!future.length) return;
        past.push(JSON.parse(JSON.stringify(store.get())));
        saving = true;
        origSet(future.pop());
        saving = false;
      };
      store.snapshot = function(){ return JSON.parse(JSON.stringify(store.get())); };
      store.restore = function(snap){
        saving = true;
        origSet(snap);
        saving = false;
      };
      store.clearHistory = function(){ past = []; future = []; };
      return store;
    },
  };

  for (const k in initial) {
    if (typeof initial[k] === 'function') {
      const fn = initial[k];
      signals[k] = signal();
      const ef = effect(() => {
        signals[k].set(fn(new Proxy({}, {
          get(_, prop) {
            if (typeof prop === 'string' && prop in signals) return signals[prop].get();
          },
        })));
      });
      signals[k]._ef = ef;
    } else {
      signals[k] = signal(initial[k]);
    }
  }

  return store;
};

ztore.signal = signal;
ztore.effect = effect;
ztore.cleanup = cleanup;
ztore.flush = () => {
  while (PENDING.size) {
    const jobs = [...PENDING];
    PENDING.clear();
    jobs.forEach(fn => fn());
  }
};
ztore.data = {};
})();
