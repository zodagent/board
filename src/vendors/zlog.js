(()=>{
if (window.__zlog) return;
window.__zlog = true;

var LEVELS = { trace:0, debug:1, info:2, success:2, warn:3, error:4, silent:5 };
var COLORS = { trace:'#888', debug:'#6366f1', info:'#3b82f6', success:'#22c55e', warn:'#f59e0b', error:'#ef4444' };
var ICON = { trace:'~', debug:'#', info:'i', success:'+', warn:'!', error:'x' };

var currentLevel = 'trace';
var muted = false;
var consoleOn = true;
var showTimestamp = true;
var domTargets = [];

function levelNum(l){ return LEVELS[l] ?? LEVELS.info; }

function formatTime(){
  var d = new Date();
  return d.toLocaleTimeString('en-US', { hour12:false }) + '.' + String(d.getMilliseconds()).padStart(3,'0');
}

function emitConsole(level, msg, data, name){
  if (muted || levelNum(level) < levelNum(currentLevel) || !consoleOn) return;
  var c = COLORS[level] || '#333';
  var ts = showTimestamp ? formatTime() : '';
  var icon = ICON[level] || '?';
  var label = level.toUpperCase();

  if (name) {
    var args = ['%c' + icon + ' \u276f %c' + ts + ' \u276f %c' + label + ' \u276f %c' + name + ' \u276f %c' + msg,
      'color:' + c + ';font-weight:700',
      'color:#888',
      'color:' + c + ';font-weight:600',
      'color:#6366f1;font-weight:500',
      'color:inherit'];
    if (data && data.length) data.forEach(function(d){ args.push(d); });
    if (level === 'error') console.error.apply(console, args);
    else if (level === 'warn') console.warn.apply(console, args);
    else console.log.apply(console, args);
  } else {
    var args = ['%c' + icon + ' \u276f %c' + ts + ' \u276f %c' + label + ' \u276f %c' + msg,
      'color:' + c + ';font-weight:700',
      'color:#888',
      'color:' + c + ';font-weight:600',
      'color:inherit'];
    if (data && data.length) data.forEach(function(d){ args.push(d); });
    if (level === 'error') console.error.apply(console, args);
    else if (level === 'warn') console.warn.apply(console, args);
    else console.log.apply(console, args);
  }
}

function emitDOM(level, msg, data, name){
  if (muted || levelNum(level) < levelNum(currentLevel) || !domTargets.length) return;
  var c = COLORS[level] || '#333';
  var ts = showTimestamp ? formatTime() : '';
  var icon = ICON[level] || '?';
  var label = level.toUpperCase();

  var el = document.createElement('div');
  el.className = 'zlog-entry zlog-' + level;
  el.style.cssText = 'padding:2px 10px;margin:1px 0;font:13px/1.6 ui-monospace,SFMono-Regular,monospace;word-break:break-all;display:flex;flex-wrap:wrap;align-items:baseline;gap:0 2px';

  function span(text, color, weight){
    var s = document.createElement('span');
    s.textContent = text;
    s.style.cssText = 'color:' + color + ';' + (weight ? 'font-weight:' + weight + ';' : '') + 'flex-shrink:0';
    return s;
  }

  if (ts) el.appendChild(span(icon + ' \u276f ', c, '700'));
  el.appendChild(span(ts + ' \u276f ', '#888'));
  el.appendChild(span('' + label + ' \u276f ', c, '600'));

  if (name) {
    el.appendChild(span('' + name + ' \u276f ', '#6366f1', '500'));
  }

  var msgSpan = document.createElement('span');
  msgSpan.textContent = msg;
  msgSpan.style.cssText = 'color:inherit;flex:1;min-width:0';
  el.appendChild(msgSpan);

  if (data && data.length){
    data.forEach(function(d){
      var pre = document.createElement('pre');
      pre.style.cssText = 'margin:2px 0 2px 20px;font:11px/1.4 ui-monospace,SFMono-Regular,monospace;color:#888;white-space:pre-wrap;width:100%';
      try { pre.textContent = JSON.stringify(d, null, 2); } catch(e){ pre.textContent = String(d); }
      el.appendChild(pre);
    });
  }

  domTargets.forEach(function(t){
    if (!t) return;
    t.appendChild(el.cloneNode(true));
    requestAnimationFrame(function(){ t.scrollTop = t.scrollHeight; });
  });
}

function log(level, msg, data, name){
  emitConsole(level, msg, data, name);
  emitDOM(level, msg, data, name);
}

function makeLogger(name){
  var self = {};
  ['trace','debug','info','success','warn','error'].forEach(function(lvl){
    self[lvl] = function(msg){
      log(lvl, msg, [].slice.call(arguments, 1), name);
      return self;
    };
  });
  self.group = function(label){
    if (!muted && consoleOn) console.group(label || '');
    return self;
  };
  self.groupEnd = function(){
    if (!muted && consoleOn) console.groupEnd();
    return self;
  };
  self.table = function(data){
    if (!muted && consoleOn) console.table(data);
    return self;
  };
  self.time = function(label){
    if (!muted && consoleOn) console.time(label);
    return self;
  };
  self.timeEnd = function(label){
    if (!muted && consoleOn) console.timeEnd(label);
    return self;
  };
  return self;
}

var zlog = makeLogger('');

zlog.create = function(name){ return makeLogger(name || ''); };

Object.defineProperties(zlog, {
  level: { get: function(){ return currentLevel; }, set: function(v){ if (LEVELS[v] !== undefined) currentLevel = v; } },
  muted: { get: function(){ return muted; }, set: function(v){ muted = !!v; } },
  console: { get: function(){ return consoleOn; }, set: function(v){ consoleOn = !!v; } },
  timestamp: { get: function(){ return showTimestamp; }, set: function(v){ showTimestamp = !!v; } },
});

zlog.setLevel = function(l){ if (LEVELS[l] !== undefined) currentLevel = l; return zlog; };
zlog.getLevel = function(){ return currentLevel; };
zlog.mute = function(){ muted = true; return zlog; };
zlog.unmute = function(){ muted = false; return zlog; };

zlog.capture = function(el){
  if (el && domTargets.indexOf(el) === -1) domTargets.push(el);
  return zlog;
};
zlog.release = function(el){
  var idx = domTargets.indexOf(el);
  if (idx !== -1) domTargets.splice(idx, 1);
  return zlog;
};
zlog.toConsole = function(v){ consoleOn = v !== false; return zlog; };
zlog.toDOM = function(v){ if (v === false) domTargets = []; return zlog; };
zlog.clear = function(){ domTargets.forEach(function(t){ if (t) t.innerHTML = ''; }); return zlog; };

window.zlog = zlog;
})();
