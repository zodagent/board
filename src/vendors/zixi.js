(()=>{
	if(document.__zixi_mo) return;
	document.__zixi_mo = new MutationObserver((recs)=>recs.forEach((r)=>r.type === "childList" && r.addedNodes.forEach((n)=>process(n))))
	let send = (elt, type, detail, bub)=>elt.dispatchEvent(new CustomEvent("zx:" + type, {detail, cancelable:true, bubbles:bub !== false, composed:true}))
	let attr = (elt, name, defaultVal)=>elt.getAttribute(name) || defaultVal
	let dflt = (n, d)=>(window.zixiCfg ?? {})[n] ?? d
	let ignore = (elt)=>elt.closest("[zx-ignore]") != null
	let init = (elt)=>{
		let options = {}
		if (elt.__zixi || ignore(elt) || !send(elt, "init", {options})) return
		elt.__zixi = async(evt)=>{
			let reqs = elt.__zixi.requests ||= new Set()
			let form = elt.form || elt.closest("form")
			let body = new FormData(form ?? undefined, evt.submitter)
			if (elt.name && !evt.submitter && (!form || (elt.form === form && elt.type === 'submit'))) body.append(elt.name, elt.value)
			let ac = new AbortController()
			let cfg = {
				trigger:evt,
				action:attr(elt, "zx-action"),
				method:attr(elt, "zx-method", "GET").toUpperCase(),
				target:document.querySelector(attr(elt, "zx-target")) ?? elt,
				swap:attr(elt, "zx-swap", dflt("swap", "outerHTML")),
				body,
				drop:reqs.size,
				headers:{"ZX-Request":"true", ...window.zixiCfg?.headers},
				abort:ac.abort.bind(ac),
				signal:ac.signal,
				preventTrigger:true,
				transition:dflt("transition", document.startViewTransition?.bind(document)),
				fetch:fetch.bind(window)
			}
			let go = send(elt, "config", {cfg, requests:reqs})
			if (cfg.preventTrigger) evt.preventDefault()
			if (!go || cfg.drop) return
			if (/GET|DELETE/.test(cfg.method)){
				let params = new URLSearchParams(cfg.body)
				if (params.size)
					cfg.action += (/\?/.test(cfg.action) ? "&" : "?") + params
				cfg.body = null
			}
			reqs.add(cfg)
			try {
				if (cfg.confirm){
					let result = await cfg.confirm()
					if (!result) return
				}
				if (!send(elt, "before", {cfg, requests:reqs})) return
				cfg.response = await cfg.fetch(cfg.action, cfg)
				cfg.text = await cfg.response.text()
				if (!send(elt, "after", {cfg})) return
			} catch(error) {
				send(elt, "error", {cfg, error})
				return
			} finally {
				reqs.delete(cfg)
				send(elt, "finally", {cfg})
			}
			let scripts = [];
			let textNoScripts = cfg.text.replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, function(m, code) {
				scripts.push(code);
				return '';
			});
			let doSwap = ()=>{
				if (cfg.swap instanceof Function)
					return cfg.swap(cfg)
				else if (/(before|after)(begin|end)/.test(cfg.swap))
					cfg.target.insertAdjacentHTML(cfg.swap, textNoScripts)
				else if(cfg.swap in cfg.target)
					cfg.target[cfg.swap] = textNoScripts
				else if(cfg.swap !== 'none') throw cfg.swap
			}
			if (cfg.transition)
				await cfg.transition(doSwap).finished
			else
				await doSwap()
			// Initialize any zx-action elements in the swapped content before running scripts
			process(cfg.target)
			scripts.forEach(function(code) {
				try {
					var s = document.createElement('script');
					if (code.trim()) s.textContent = code;
					document.body.appendChild(s).parentNode.removeChild(s);
				} catch(e) { console.warn('zixi script error:', e); }
			});
			send(elt, "swapped", {cfg})
			if (!document.contains(elt)) send(document, "swapped", {cfg})
		}
		elt.__zixi.evt = attr(elt, "zx-trigger", elt.matches("form") ? "submit" : elt.matches("input:not([type=button]),select,textarea") ? "change" : "click")
		elt.addEventListener(elt.__zixi.evt, elt.__zixi, options)
		send(elt, "inited", {}, false)
	}
	let process = (n)=>{
		if (n.matches){
			if (ignore(n)) return
			if (n.matches("[zx-action]")) init(n)
		}
		if(n.querySelectorAll) n.querySelectorAll("[zx-action]").forEach(init)
	}
	document.addEventListener("zx:process", (evt)=>process(evt.target))
	document.addEventListener("DOMContentLoaded", ()=>{
		document.__zixi_mo.observe(document.documentElement, {childList:true, subtree:true})
		process(document.body)
	})
})()
