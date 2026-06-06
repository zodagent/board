(function(){
  if (window.__ztex) return;
  window.__ztex = true;

  function Ztex(opts) {
    opts = opts || {};
    const s = {
      commands: {},
      resolvers: {},
      macros: {},
      middleware: [],
      vars: Object.create(null),
      maxDepth: opts.maxDepth || 100,
    };

    // ====================== TOKENIZER ======================
    function tokenize(input) {
      const tokens = [];
      let i = 0, len = input.length;

      while (i < len) {
        const ch = input[i];

        // Escape
        if (ch === '\\' && i + 1 < len && '\\/@'.includes(input[i+1])) {
          tokens.push({type: 'text', value: input[i+1]});
          i += 2;
          continue;
        }

        // Command (only at start of line)
        if (ch === '/' && (i === 0 || input[i-1] === '\n')) {
          const m = input.slice(i).match(/^\/(\w+)(?:\s+([\s\S]*?))?(?=\n|$)/);
          if (m) {
            tokens.push({type: 'command', name: m[1], args: (m[2] || '').trim()});
            i += m[0].length;
            continue;
          }
        }

        // @macro(args) or @macro or @resolver:
        if (ch === '@') {
          let m = input.slice(i).match(/^@(\w+)\(([^)]*)\)/);
          if (m) {
            tokens.push({type: 'macro', name: m[1], args: m[2].trim()});
            i += m[0].length;
            continue;
          }

          m = input.slice(i).match(/^@(\w+):/);
          if (m) {
            const name = m[1];
            i += m[0].length;
            let content = '';
            while (i < len) {
              if (input[i] === '\\' && i+1 < len && '\\/@:'.includes(input[i+1])) {
                content += input[i+1];
                i += 2;
                continue;
              }
              if (input[i] === '@' || (input[i] === '/' && (i === 0 || input[i-1] === '\n'))) break;
              content += input[i];
              i++;
            }
            tokens.push({type: 'resolver', name, content: content.trimEnd()});
            continue;
          }

          m = input.slice(i).match(/^@(\w+)/);
          if (m) {
            tokens.push({type: 'macro', name: m[1], args: null});
            i += m[0].length;
            continue;
          }
        }

        tokens.push({type: 'text', value: ch});
        i++;
      }
      return tokens;
    }

    // ====================== EVALUATOR ======================
    async function evaluate(tokens, ctx, depth = 0) {
      if (depth > s.maxDepth) throw new Error("Recursion limit exceeded");

      let out = '';
      for (const tok of tokens) {
        if (tok.type === 'text') {
          out += tok.value;
        }
        else if (tok.type === 'macro') {
          const val = s.macros[tok.name];
          if (val != null) {
            try {
              const result = typeof val === 'function' ? val(tok.args, ctx) : val;
              out += (result && typeof result.then === 'function' ? await result : result) ?? '';
            } catch (e) {
              out += `[${tok.name} error: ${e.message}]`;
            }
          } else {
            out += '@' + tok.name + (tok.args ? '(' + tok.args + ')' : '');
          }
        }
        else if (tok.type === 'resolver') {
          const fn = s.resolvers[tok.name];
          if (fn) {
            try {
              const result = await fn(tok.content || '', ctx);
              out += result ?? '';
            } catch (e) {
              out += `[${tok.name} error: ${e.message}]`;
            }
          } else {
            out += '@' + tok.name + ':' + (tok.content || '');
          }
        }
        else if (tok.type === 'command') {
          const cmd = s.commands[tok.name];
          if (!cmd) {
            out += `[/${tok.name} error: unknown command]`;
            continue;
          }
          try {
            const result = await cmd(tok.args, ctx);
            if (result != null) {
              const nested = tokenize(String(result));
              out += await evaluate(nested, ctx, depth + 1);
            }
          } catch (e) {
            out += `[/${tok.name} error: ${e.message}]`;
          }
        }
      }
      return out;
    }

    // ====================== CORE COMMANDS ======================
    s.commands.set = (args) => {
      const m = args.match(/^(\S+)\s+([\s\S]*)$/);
      if (m) s.vars[m[1]] = m[2];
    };
    s.commands.get = (args) => s.vars[args] ?? '';

    // ====================== PUBLIC API ======================
    const api = {
      command(name, fn) { s.commands[name] = fn; return this; },
      resolve(name, fn) { s.resolvers[name] = fn; return this; },
      macro(name, value) { s.macros[name] = value; return this; },
      use(fn) { s.middleware.push(fn); return this; },
      set(key, value) { s.vars[key] = value; return this; },
      get(key) { return s.vars[key]; },
    };

    api.process = async (input, ctx = {}) => {
      ctx = { ...ctx, vars: s.vars, process: (x, c = {}) => api.process(x, {...ctx, ...c}) };

      for (const mw of s.middleware) {
        try { input = await mw(input, { ...ctx, depth: ctx.depth || 0 }); }
        catch (e) { return `[middleware error: ${e.message}]`; }
      }

      if (!input.includes('@') && !input.includes('/')) return input;

      try {
        const tokens = tokenize(input);
        return await evaluate(tokens, ctx);
      } catch (e) {
        return `[ztex error: ${e.message}]`;
      }
    };

    api.commands = (obj) => { Object.assign(s.commands, obj); return api; };
    api.resolvers = (obj) => { Object.assign(s.resolvers, obj); return api; };
    api.macros = (obj) => { Object.assign(s.macros, obj); return api; };
    api.tag = (strings, ...values) => api.process(String.raw({raw: strings}, ...values));

    return api;
  }

  window.ztex = { create: (opts) => new Ztex(opts) };
})();
