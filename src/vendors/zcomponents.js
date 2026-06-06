(()=>{
  if (window.__zcomponents) return;
  window.__zcomponents = true;

  const defs = {};
  let uidCounter = 0;

  Zinc.getComponent = name => defs[name];

  Zinc.component = (name, methods) => {
    if (defs[name]) return;
    methods = methods || {};
    defs[name] = methods;

    const tpl = document.querySelector('template[z-component="' + name + '"]');
    const props = methods.props || [];

    customElements.define(name, class extends HTMLElement {
      static get observedAttributes() { return props; }

      connectedCallback() {
        if (this._zStamped) return;
        this._zStamped = true;
        this.setAttribute('data-z-component', name);

        // Unique ID for scoped Zinc state
        const uid = 'zc_' + (uidCounter++);
        this._uid = uid;

        // Create internal ztore store
        this._store = ztore(Object.assign({}, methods.initial || {}));
        this._store.subscribe(state => {
          for (const k in state) Zinc.set(uid + '.' + k, state[k]);
        });

        // Sync initial attribute values into store
        for (const p of props) {
          if (this.hasAttribute(p)) this._store.set(p, this.getAttribute(p));
        }

        // Collect existing children before stamping (for slot components)
        var slotChildren = [];
        if (methods.slot) {
          while (this.firstChild) slotChildren.push(this.removeChild(this.firstChild));
        }

        // Stamp template
        if (tpl) {
          this.appendChild(tpl.content.cloneNode(true));
        } else if (methods.slot) {
          // No template — use a default container for slot children
          var wrapper = document.createElement('div');
          this.appendChild(wrapper);
        }

        // Move slot children into [data-z-slot] container
        if (methods.slot && slotChildren.length) {
          var slot = this.querySelector('[data-z-slot]');
          if (slot) {
            for (var i = 0; i < slotChildren.length; i++) {
              slot.appendChild(slotChildren[i]);
            }
          }
        }

        // Rewrite z-text/z-html/z-show/z-bind/z-modal values to scoped UID
        // Skips z-on:*, z-ref, z-each. Skips entire rewrite when skipRewrite:true
        if (!methods.skipRewrite) {
          for (const el of this.querySelectorAll('[z-text],[z-html],[z-show],[z-modal],[z-bind\\:],[zd-counter]')) {
            for (const a of el.attributes) {
              const n = a.name;
              if (n === 'z-text' || n === 'z-html' || n === 'z-show' || n === 'z-modal' || n === 'zd-counter' || n.startsWith('z-bind:')) {
                a.value = uid + '.' + a.value;
              }
            }
          }
        }

        // Bind methods to this element for scoped zd-* resolution
        for (const k in methods) {
          if (k === 'init' || k === 'props' || k === 'initial' || k === 'slot' || k === 'skipRewrite') continue;
          if (typeof methods[k] === 'function') {
            this['z_' + k] = methods[k].bind(this);
          }
        }

        // Run init lifecycle with this pointing to the element
        if (methods.init) methods.init.call(this, this);
      }

      attributeChangedCallback(name, oldVal, newVal) {
        if (oldVal === newVal || !this._store) return;
        this._store.set(name, newVal);
      }
    });
  };
})();
