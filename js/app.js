import { parseDiet, extractPages } from './parser.js';
import { CATEGORIES, guessCategory, genericKind, seasonal, DEFAULT_FOODS } from './foods.js';

/* ---------------- Stato e salvataggio ---------------- */

const KEY = 'dieta-app-v1';
const blank = () => ({ version: 1, diet: null, plans: {}, shopping: [], foods: {}, recent: { frutta: [], verdura: [] } });

function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.version) return Object.assign(blank(), s);
  } catch (e) { /* storage non disponibile */ }
  return blank();
}
let state = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch (e) { toast('Non riesco a salvare i dati sul telefono'); }
}

const ui = { tab: 'oggi', date: todayStr(), foodFilter: 'dispensa', foodSearch: '' };

/* ---------------- Utility ---------------- */

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const uid = () => Math.random().toString(36).slice(2, 10);

function todayStr(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return todayStr(d); }
function fmtDate(s) {
  const t = parseDate(s).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function relDay(s) {
  const t = todayStr();
  if (s === t) return 'Oggi';
  if (s === addDays(t, 1)) return 'Domani';
  if (s === addDays(t, -1)) return 'Ieri';
  return '';
}
const fmtNum = (n) => {
  const r = Math.round(n * 10) / 10;
  return String(r).replace('.', ',');
};

/* ---------------- Alimenti ---------------- */

function getFood(name) {
  const k = norm(name);
  return Object.assign(
    { mode: 'g', per: 0, label: 'pz', pantry: false, cat: guessCategory(name) },
    DEFAULT_FOODS[k] || {},
    state.foods[k] || {}
  );
}
function setFood(name, patch) {
  const k = norm(name);
  state.foods[k] = Object.assign({}, state.foods[k] || {}, patch, { name: state.foods[k]?.name || name });
  save();
}

// Restituisce {main, sub} per mostrare una quantità
function fmtQty(name, qty, unit, shopping = false) {
  if (qty == null || isNaN(qty)) return { main: '', sub: '' };
  const f = getFood(name);
  if (unit === 'g' && f.mode === 'pz' && f.per > 0) {
    const raw = qty / f.per;
    const n = shopping ? Math.max(1, Math.ceil(raw - 0.05)) : Math.max(0.5, Math.round(raw * 2) / 2);
    const approx = Math.abs(n - raw) > 0.05 ? '≈ ' : '';
    return { main: `${approx}${fmtNum(n)} ${f.label || 'pz'}`, sub: `${Math.round(qty)} g` };
  }
  if (unit === 'g' && /^acqua\b/i.test(name)) unit = 'ml';
  if (unit === 'g' && qty >= 1000) return { main: `${fmtNum(qty / 1000)} kg`, sub: '' };
  if (unit === 'ml' && qty >= 1000) return { main: `${fmtNum(qty / 1000)} l`, sub: '' };
  const u = unit === 'g' || unit === 'ml' ? ` ${unit}` : unit ? ` ${unit}` : '';
  return { main: `${fmtNum(Math.round(qty * 10) / 10)}${u}`, sub: '' };
}
const qtyHtml = (q) => `${esc(q.main)}${q.sub ? `<small>${esc(q.sub)}</small>` : ''}`;

function allFoodNames() {
  const map = new Map();
  const add = (n) => { if (n && !map.has(norm(n))) map.set(norm(n), n); };
  if (state.diet) {
    for (const d of state.diet.days) for (const m of d.meals) for (const v of m.variants) for (const it of v.items) {
      if (!findRecipe(d.n, it.name)) add(it.name);
      for (const a of it.alts) if (!findRecipe(d.n, a.name)) add(a.name);
    }
    for (const r of Object.values(state.diet.recipes)) for (const i of r.ingredients) add(i.name);
  }
  for (const [k, v] of Object.entries(state.foods)) add(v.name || k);
  for (const s of state.shopping) add(s.name);
  return [...map.values()].filter((n) => !genericKind(n)).sort((a, b) => a.localeCompare(b, 'it'));
}

/* ---------------- Dieta e piani ---------------- */

const getDay = (n) => state.diet?.days.find((d) => d.n === n);
function findRecipe(dayN, name) {
  if (!state.diet) return null;
  return state.diet.recipes[`${dayN}|${norm(name)}`] || state.diet.recipes[norm(name)] || null;
}
const options = (item) => [{ name: item.name, qty: item.qty, unit: item.unit }, ...item.alts];

function plan(date = ui.date) {
  return state.plans[date] || null;
}
function ensurePlan(date = ui.date) {
  if (!state.plans[date]) state.plans[date] = { day: null, variants: {}, choices: {}, addedAt: null };
  return state.plans[date];
}

function dayIcon(d) {
  const l = (d.label || '').toLowerCase();
  if (l.includes('pesi')) return '🏋️';
  if (l.includes('corsa')) return '🏃';
  return '🌿';
}
function dayShort(d) {
  const l = (d.label || '').toLowerCase();
  if (l.includes('pesi')) return 'Pesi';
  if (l.includes('corsa')) return 'Corsa';
  return 'Libera';
}

// Tutti gli alimenti della giornata scelta (ricette espanse negli ingredienti)
function planEntries(date) {
  const p = plan(date);
  const d = p && getDay(p.day);
  if (!d) return [];
  const out = [];
  d.meals.forEach((m, mi) => {
    const vi = p.variants[mi] || 0;
    const v = m.variants[vi] || m.variants[0];
    v.items.forEach((it, ii) => {
      const opt = options(it)[p.choices[`${mi}.${vi}.${ii}`] || 0];
      const rec = findRecipe(d.n, opt.name);
      if (rec && opt.qty) {
        const f = opt.qty / rec.per;
        for (const ing of rec.ingredients) {
          out.push({ name: ing.name, qty: ing.qty * f, unit: ing.unit, from: `${m.name} · ${rec.name}` });
        }
      } else {
        out.push({ name: opt.name, qty: opt.qty, unit: opt.unit, from: m.name });
      }
    });
  });
  return out;
}

/* ---------------- Lista della spesa ---------------- */

function addToShopping(name, qty, unit, source, cat) {
  const existing = state.shopping.find((s) => !s.checked && norm(s.name) === norm(name) && (s.unit || '') === (unit || ''));
  if (existing) {
    if (qty != null && existing.qty != null) existing.qty += qty;
    if (source && !existing.sources.includes(source)) existing.sources.push(source);
  } else {
    state.shopping.push({
      id: uid(), name, qty: qty ?? null, unit: unit || '', checked: false,
      cat: cat || getFood(name).cat, sources: source ? [source] : [],
    });
  }
}

/* ---------------- Render ---------------- */

const ICONS = {
  oggi: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 2.2a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6Zm0 2.3a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9Z"/></svg>',
  spesa: '<svg viewBox="0 0 24 24"><path d="M3 4h2.2l2.1 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.5L21 8H6.6l-.5-2.4A2 2 0 0 0 4.1 4H3Zm6.5 14a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Zm8 0a1.6 1.6 0 1 0 0 3.2 1.6 1.6 0 0 0 0-3.2Z"/></svg>',
  alimenti: '<svg viewBox="0 0 24 24"><path d="M12 3 3 9.5V20a1 1 0 0 0 1 1h5v-6h6v6h5a1 1 0 0 0 1-1V9.5L12 3Z"/></svg>',
  impostazioni: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.6 7.6 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.3 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4-2.1-1.6ZM13 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" transform="translate(-1 0)"/></svg>',
};
const CHEVRON = '<svg class="chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function render() {
  const app = $('#app');
  if (!state.diet) { app.innerHTML = viewWelcome(); return; }
  const views = { oggi: viewOggi, spesa: viewSpesa, alimenti: viewAlimenti, impostazioni: viewImpostazioni };
  const scroll = window.scrollY;
  app.innerHTML = `<main class="view view-${ui.tab}">${views[ui.tab]()}</main>${tabbar()}`;
  if (ui.keepScroll) window.scrollTo(0, scroll);
  ui.keepScroll = false;
}

function tabbar() {
  const unchecked = state.shopping.filter((s) => !s.checked).length;
  const t = (id, label) => `
    <button class="tab ${ui.tab === id ? 'on' : ''}" data-a="tab" data-tab="${id}">
      ${ICONS[id]}<span>${label}</span>
      ${id === 'spesa' && unchecked ? `<i class="dot">${unchecked}</i>` : ''}
    </button>`;
  return `<nav class="tabbar">${t('oggi', 'Oggi')}${t('spesa', 'Spesa')}${t('alimenti', 'Dispensa')}${t('impostazioni', 'Impostazioni')}</nav>`;
}

const isStandalone = () => window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function installTip() {
  if (isStandalone()) return '';
  return `
    <div class="tip">
      <b>Installala sulla Home</b>
      <p>In Safari tocca <span class="share-ic">⬆︎</span> <b>Condividi</b> → <b>Aggiungi alla schermata Home</b>. Poi apri l'app dall'icona e carica lì il PDF: l'app installata ha una memoria sua, separata da Safari.</p>
    </div>`;
}

function viewWelcome() {
  return `
  <main class="welcome">
    <img src="icons/icon-192.png" class="logo" alt="">
    <h1>La mia dieta</h1>
    <p class="lead">Scegli la giornata, le alternative e crea la lista della spesa in un tocco.</p>
    ${isIOS() ? installTip() : ''}
    <button class="btn primary big" data-a="pick-pdf">Carica il PDF della dieta</button>
    <button class="btn plain" data-a="pick-backup">Ho un backup da importare</button>
    <p class="fine">Il PDF viene letto sul telefono e resta salvato solo qui.</p>
  </main>`;
}

/* ---- Oggi ---- */

function viewOggi() {
  const p = plan();
  const d = p && getDay(p.day);
  const rel = relDay(ui.date);
  const chips = state.diet.days.map((day) => `
    <button class="daychip ${d && d.n === day.n ? 'on' : ''}" data-a="set-day" data-n="${day.n}">
      <span class="ic">${dayIcon(day)}</span>
      <b>${day.n}°</b>
      <span>${dayShort(day)}</span>
    </button>`).join('');

  let body;
  if (!d) {
    body = `<div class="empty"><div class="big-ic">👆</div><p>Scegli quale giornata della dieta segui ${rel ? rel.toLowerCase() : 'in questa data'}.</p></div>`;
  } else {
    body = `
      <div class="dayhead">
        <div><h2>${d.n}° giorno</h2><p>${dayIcon(d)} ${esc(d.label)}</p></div>
        ${p.addedAt ? `<span class="pill ok">${CHECK} In lista</span>` : ''}
      </div>
      ${d.meals.map((m, mi) => mealCard(d, m, mi, p)).join('')}
      <div class="sticky-cta">
        <button class="btn primary big" data-a="open-add">${p.addedAt ? 'Aggiungi di nuovo alla spesa' : 'Aggiungi alla spesa'}</button>
      </div>`;
  }

  return `
    <header class="top">
      <div class="datenav">
        <button class="icon-btn" data-a="date" data-d="-1" aria-label="Giorno precedente">‹</button>
        <div class="datebox">
          <small>${rel || '&nbsp;'}</small>
          <h1>${fmtDate(ui.date)}</h1>
        </div>
        <button class="icon-btn" data-a="date" data-d="1" aria-label="Giorno successivo">›</button>
      </div>
      ${rel !== 'Oggi' ? '<button class="link center" data-a="date-today">Torna a oggi</button>' : ''}
    </header>
    <div class="daychips">${chips}</div>
    ${body}`;
}

function mealCard(d, m, mi, p) {
  const vi = p.variants[mi] || 0;
  const v = m.variants[vi] || m.variants[0];
  const seg = m.variants.length > 1 ? `
    <div class="seg">
      ${m.variants.map((vv, i) => `<button class="${i === vi ? 'on' : ''}" data-a="variant" data-mi="${mi}" data-vi="${i}">${i === 0 ? 'Classico' : esc(vv.title.replace(/^.*alternativ[oa]\s*/i, 'Alternativo '))}</button>`).join('')}
    </div>` : '';
  const rows = v.items.map((it, ii) => {
    const key = `${mi}.${vi}.${ii}`;
    const oi = p.choices[key] || 0;
    const opt = options(it)[oi];
    const rec = findRecipe(d.n, opt.name);
    const q = fmtQty(opt.name, opt.qty, opt.unit);
    const hasAlts = it.alts.length > 0;
    return `
      <div class="row ${hasAlts ? 'tappable' : ''}" ${hasAlts ? `data-a="pick" data-key="${key}"` : ''}>
        <div class="row-main">
          <span class="name">${esc(opt.name)}</span>
          ${hasAlts ? `<span class="hint">${oi === 0 ? `${it.alts.length} alternativ${it.alts.length === 1 ? 'a' : 'e'}` : `scelto al posto di ${esc(it.name)}`}</span>` : ''}
          ${rec ? `<button class="recipe-link" data-a="recipe" data-day="${d.n}" data-name="${esc(opt.name)}" data-qty="${opt.qty}">📖 Ricetta</button>` : ''}
        </div>
        <span class="qty">${qtyHtml(q)}</span>
        ${hasAlts ? CHEVRON : ''}
      </div>`;
  }).join('');
  return `
    <section class="card meal">
      <div class="card-h"><h3>${esc(m.name)}</h3>${v.note ? `<span class="note">${esc(v.note)}</span>` : ''}</div>
      ${seg}
      <div class="rows">${rows}</div>
    </section>`;
}

/* ---- Spesa ---- */

function viewSpesa() {
  const items = state.shopping;
  const done = items.filter((s) => s.checked).length;
  let list;
  if (!items.length) {
    list = `<div class="empty"><div class="big-ic">🛒</div><p>La lista è vuota.<br>Vai su <b>Oggi</b>, scegli la giornata e tocca <b>Aggiungi alla spesa</b>.</p></div>`;
  } else {
    const groups = {};
    for (const s of items) (groups[s.cat] = groups[s.cat] || []).push(s);
    const order = [...CATEGORIES, ...Object.keys(groups).filter((c) => !CATEGORIES.includes(c))];
    list = order.filter((c) => groups[c]).map((c) => {
      const g = groups[c].slice().sort((a, b) => a.checked - b.checked || a.name.localeCompare(b.name, 'it'));
      return `
        <h4 class="group">${esc(c)}</h4>
        <section class="card">
          ${g.map((s) => {
            const q = fmtQty(s.name, s.qty, s.unit, true);
            return `
            <div class="row shop ${s.checked ? 'checked' : ''}">
              <button class="check ${s.checked ? 'on' : ''}" data-a="toggle-shop" data-id="${s.id}" aria-label="Spunta">${CHECK}</button>
              <div class="row-main" data-a="toggle-shop" data-id="${s.id}">
                <span class="name">${esc(s.name)}</span>
                ${s.sources.length ? `<span class="hint">${esc(s.sources.join(' • '))}</span>` : ''}
              </div>
              <span class="qty">${qtyHtml(q)}</span>
              <button class="del" data-a="del-shop" data-id="${s.id}" aria-label="Elimina">×</button>
            </div>`;
          }).join('')}
        </section>`;
    }).join('');
  }
  return `
    <header class="top row-h">
      <h1>Spesa</h1>
      <button class="btn small primary" data-a="open-extra">+ Aggiungi</button>
    </header>
    ${items.length ? `<p class="counter">${items.length - done} da comprare${done ? ` · ${done} presi` : ''}</p>` : ''}
    ${list}
    ${items.length ? `
      <div class="actions">
        ${done ? `<button class="btn" data-a="clear-checked">Rimuovi presi (${done})</button>` : ''}
        <button class="btn danger-text" data-a="clear-all">Svuota lista</button>
      </div>` : ''}`;
}

/* ---- Dispensa / Alimenti ---- */

function viewAlimenti() {
  const all = allFoodNames();
  const q = norm(ui.foodSearch);
  let list = all.filter((n) => (ui.foodFilter === 'tutti' || getFood(n).pantry) && (!q || norm(n).includes(q)));
  const rows = list.map((n) => {
    const f = getFood(n);
    const unit = f.mode === 'pz' && f.per > 0 ? `in ${f.label || 'pz'} (${f.per} g)` : 'in grammi';
    return `
      <div class="row tappable" data-a="food" data-name="${esc(n)}">
        <div class="row-main">
          <span class="name">${esc(n)}</span>
          <span class="hint">${esc(f.cat)} · ${unit}</span>
        </div>
        <button class="pantry ${f.pantry ? 'on' : ''}" data-a="toggle-pantry" data-name="${esc(n)}" aria-label="In dispensa">🏠</button>
      </div>`;
  }).join('');
  return `
    <header class="top"><h1>Dispensa</h1></header>
    <div class="seg wide">
      <button class="${ui.foodFilter === 'dispensa' ? 'on' : ''}" data-a="food-filter" data-f="dispensa">In dispensa</button>
      <button class="${ui.foodFilter === 'tutti' ? 'on' : ''}" data-a="food-filter" data-f="tutti">Tutti gli alimenti</button>
    </div>
    <p class="explain">${ui.foodFilter === 'dispensa'
      ? 'Le cose che hai sempre in casa: quando aggiungi una giornata alla spesa partono già deselezionate.'
      : 'Tocca un alimento per scegliere se vederlo in grammi o in pezzi, e il reparto. 🏠 = in dispensa.'}</p>
    <div class="search"><input type="search" placeholder="Cerca alimento" value="${esc(ui.foodSearch)}" data-input="food-search"></div>
    ${ui.foodFilter === 'dispensa' ? `
      <form class="addline" data-form="add-pantry">
        <input name="n" placeholder="Aggiungi (es. Sale)" autocomplete="off" list="foodlist">
        <button class="btn small primary">Aggiungi</button>
      </form>` : ''}
    <datalist id="foodlist">${all.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
    <section class="card">${rows || `<div class="empty small"><p>${ui.foodFilter === 'dispensa' ? 'Nessun alimento in dispensa.' : 'Nessun alimento trovato.'}</p></div>`}</section>`;
}

/* ---- Impostazioni ---- */

function viewImpostazioni() {
  const d = state.diet;
  const nRec = Object.keys(d.recipes).filter((k) => k.includes('|')).length;
  const imp = d.importedAt ? new Date(d.importedAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  return `
    <header class="top"><h1>Impostazioni</h1></header>
    <h4 class="group">Dieta attuale</h4>
    <section class="card pad">
      <p class="strong">${esc(d.profile?.title || d.fileName || 'Piano alimentare')}</p>
      <p class="muted">${d.days.length} giornate · ${nRec} ricette${imp ? ` · caricata il ${imp}` : ''}</p>
      <button class="btn primary" data-a="pick-pdf">Carica un nuovo PDF</button>
      <p class="muted small">Quando la nutrizionista ti dà una dieta nuova. Lista della spesa, dispensa e impostazioni degli alimenti restano.</p>
    </section>
    <h4 class="group">Backup</h4>
    <section class="card pad">
      <p class="muted">Salva un file con dieta, dispensa e impostazioni, da reimportare se cambi telefono o elimini l'app.</p>
      <div class="btnrow">
        <button class="btn" data-a="export">Esporta backup</button>
        <button class="btn" data-a="pick-backup">Importa backup</button>
      </div>
    </section>
    ${isIOS() && !isStandalone() ? `<h4 class="group">Installazione</h4><section class="card pad">${installTip()}</section>` : ''}
    <h4 class="group">Dati</h4>
    <section class="card pad">
      <button class="btn danger-text" data-a="reset">Cancella tutti i dati</button>
    </section>
    <p class="fine">I dati sono salvati solo su questo dispositivo.</p>`;
}

/* ---------------- Fogli (sheet) ---------------- */

let sheetState = null;

function openSheet(html, cls = '') {
  const root = $('#sheet');
  root.innerHTML = `<div class="backdrop" data-a="close-sheet"></div><div class="sheet ${cls}" role="dialog"><div class="grab"></div>${html}</div>`;
  root.classList.add('open');
  document.body.classList.add('noscroll');
}
function closeSheet() {
  const root = $('#sheet');
  root.classList.remove('open');
  root.innerHTML = '';
  sheetState = null;
  document.body.classList.remove('noscroll');
}

function sheetPick(key) {
  const p = plan();
  const d = getDay(p.day);
  const [mi, vi, ii] = key.split('.').map(Number);
  const it = d.meals[mi].variants[vi].items[ii];
  const cur = p.choices[key] || 0;
  const opts = options(it);
  openSheet(`
    <div class="sheet-h"><h3>Scegli</h3><button class="link" data-a="close-sheet">Chiudi</button></div>
    <div class="sheet-body">
      <section class="card">
        ${opts.map((o, i) => {
          const rec = findRecipe(d.n, o.name);
          return `
          <div class="row tappable opt ${i === cur ? 'on' : ''}" data-a="choose" data-key="${key}" data-i="${i}">
            <span class="radio">${i === cur ? CHECK : ''}</span>
            <div class="row-main"><span class="name">${esc(o.name)}</span>${rec ? '<span class="hint">📖 ricetta</span>' : i === 0 ? '<span class="hint">indicato in dieta</span>' : ''}</div>
            <span class="qty">${qtyHtml(fmtQty(o.name, o.qty, o.unit))}</span>
          </div>`;
        }).join('')}
      </section>
    </div>`);
}

function sheetRecipe(dayN, name, qty) {
  const r = findRecipe(dayN, name);
  if (!r) return;
  const f = qty ? qty / r.per : 1;
  openSheet(`
    <div class="sheet-h"><h3>${esc(r.name)}</h3><button class="link" data-a="close-sheet">Chiudi</button></div>
    <div class="sheet-body">
      <p class="muted">Dose per ${Math.round(r.per * f)} ${r.unit}</p>
      <h4 class="group">Ingredienti</h4>
      <section class="card">
        ${r.ingredients.map((i) => `<div class="row"><div class="row-main"><span class="name">${esc(i.name)}</span></div><span class="qty">${qtyHtml(fmtQty(i.name, i.qty * f, i.unit))}</span></div>`).join('')}
      </section>
      <h4 class="group">Procedimento</h4>
      <section class="card pad recipe-steps">${r.steps.map((s) => `<p>${esc(s)}</p>`).join('')}</section>
    </div>`);
}

// Foglio "Aggiungi alla spesa"
function sheetAdd() {
  const entries = planEntries(ui.date);
  const agg = [];
  const byKey = new Map();
  for (const e of entries) {
    const kind = genericKind(e.name);
    if (kind) { agg.push({ ...e, kind, pick: state.recent[kind]?.[0] || '', sel: true, id: uid() }); continue; }
    const k = norm(e.name) + '|' + e.unit;
    if (byKey.has(k)) {
      const a = byKey.get(k);
      a.qty = (a.qty || 0) + (e.qty || 0);
      if (!a.froms.includes(e.from)) a.froms.push(e.from);
    } else {
      const a = { ...e, froms: [e.from], sel: !getFood(e.name).pantry, id: uid() };
      byKey.set(k, a); agg.push(a);
    }
  }
  sheetState = { type: 'add', rows: agg };
  renderSheetAdd();
}

function renderSheetAdd() {
  const rows = sheetState.rows;
  const nSel = rows.filter((r) => r.sel).length;
  const p = plan();
  const html = `
    <div class="sheet-h"><h3>Aggiungi alla spesa</h3><button class="link" data-a="close-sheet">Annulla</button></div>
    <div class="sheet-body">
      <p class="muted">${fmtDate(ui.date)} · ${p.day}° giorno. Togli la spunta a quello che hai già.</p>
      <div class="btnrow tight">
        <button class="btn small" data-a="add-all" data-v="1">Tutti</button>
        <button class="btn small" data-a="add-all" data-v="0">Nessuno</button>
      </div>
      <section class="card">
        ${rows.map((r) => {
          const pantry = getFood(r.name).pantry;
          if (r.kind) {
            const sugg = [...new Set([...(state.recent[r.kind] || []).slice(0, 4), ...seasonal(r.kind, parseDate(ui.date))])];
            return `
            <div class="row addrow generic ${r.sel ? '' : 'off'}">
              <button class="check ${r.sel ? 'on' : ''}" data-a="add-toggle" data-id="${r.id}">${CHECK}</button>
              <div class="row-main">
                <span class="name">${r.kind === 'frutta' ? 'Frutta' : 'Verdura'} <small class="muted">· ${esc(r.from)}</small></span>
                <div class="chips">
                  ${sugg.map((s) => `<button class="chip ${norm(s) === norm(r.pick) ? 'on' : ''}" data-a="add-pick" data-id="${r.id}" data-v="${esc(s)}">${esc(s)}</button>`).join('')}
                </div>
                <input class="other" placeholder="Altro…" value="${sugg.some((s) => norm(s) === norm(r.pick)) ? '' : esc(r.pick)}" data-input="add-other" data-id="${r.id}">
              </div>
              <span class="qty">${qtyHtml(fmtQty(r.pick || r.name, r.qty, r.unit, true))}</span>
            </div>`;
          }
          return `
            <div class="row addrow ${r.sel ? '' : 'off'}" data-a="add-toggle" data-id="${r.id}">
              <button class="check ${r.sel ? 'on' : ''}">${CHECK}</button>
              <div class="row-main">
                <span class="name">${esc(r.name)}${pantry ? ' <span class="tag">🏠 dispensa</span>' : ''}</span>
                <span class="hint">${esc(r.froms.join(' • '))}</span>
              </div>
              <span class="qty">${qtyHtml(fmtQty(r.name, r.qty, r.unit, true))}</span>
            </div>`;
        }).join('')}
      </section>
    </div>
    <div class="sheet-f"><button class="btn primary big" data-a="add-confirm" ${nSel ? '' : 'disabled'}>Aggiungi ${nSel} ${nSel === 1 ? 'prodotto' : 'prodotti'}</button></div>`;
  const body = $('#sheet .sheet-body');
  const st = body ? body.scrollTop : 0;
  if ($('#sheet.open')) {
    $('#sheet .sheet').innerHTML = `<div class="grab"></div>${html}`;
    $('#sheet .sheet-body').scrollTop = st;
  } else openSheet(html, 'tall');
}

function confirmAdd() {
  const p = plan();
  const label = `${p.day}° giorno`;
  for (const r of sheetState.rows) {
    if (!r.sel) continue;
    if (r.kind) {
      const name = (r.pick || '').trim() || (r.kind === 'frutta' ? 'Frutta di stagione' : 'Verdura di stagione');
      if (r.pick) {
        const rec = state.recent[r.kind] = (state.recent[r.kind] || []).filter((x) => norm(x) !== norm(r.pick));
        rec.unshift(r.pick.trim()); rec.length = Math.min(rec.length, 8);
      }
      addToShopping(name, r.qty, r.unit, `${label} · ${r.from}`, 'Frutta e verdura');
    } else {
      addToShopping(r.name, r.qty, r.unit, label);
    }
  }
  p.addedAt = Date.now();
  save();
  closeSheet();
  toast('Aggiunto alla lista della spesa');
  render();
}

function sheetExtra() {
  const names = allFoodNames();
  openSheet(`
    <div class="sheet-h"><h3>Aggiungi alla lista</h3><button class="link" data-a="close-sheet">Annulla</button></div>
    <form class="sheet-body form" data-form="extra">
      <label>Cosa<input name="name" required autocomplete="off" list="extralist" placeholder="Es. Detersivo, Caffè, Banane"></label>
      <datalist id="extralist">${names.map((n) => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="two">
        <label>Quantità <small>(facoltativa)</small><input name="qty" inputmode="decimal" placeholder="Es. 2"></label>
        <label>Unità<select name="unit"><option value="">—</option><option>pz</option><option>g</option><option>conf.</option><option>ml</option><option>kg</option></select></label>
      </div>
      <label>Reparto<select name="cat"><option value="">Automatico</option>${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
      <button class="btn primary big">Aggiungi</button>
    </form>`);
  setTimeout(() => $('#sheet input[name=name]')?.focus(), 250);
}

function sheetFood(name) {
  sheetState = { type: 'food', name };
  renderSheetFood(true);
}
function renderSheetFood(first) {
  const name = sheetState.name;
  const f = getFood(name);
  const ex = f.per > 0 ? `Esempio: 150 g → ${fmtNum(150 / f.per)} ${esc(f.label || 'pz')}` : 'Indica quanti grammi pesa un pezzo.';
  const html = `
    <div class="sheet-h"><h3>${esc(name)}</h3><button class="link" data-a="close-sheet">Fine</button></div>
    <div class="sheet-body form">
      <label class="switch-row">
        <span>🏠 In dispensa <small>ce l'ho sempre in casa</small></span>
        <input type="checkbox" class="switch" data-input="food-pantry" ${f.pantry ? 'checked' : ''}>
      </label>
      <label>Mostra la quantità in</label>
      <div class="seg wide">
        <button class="${f.mode !== 'pz' ? 'on' : ''}" data-a="food-mode" data-m="g">Grammi</button>
        <button class="${f.mode === 'pz' ? 'on' : ''}" data-a="food-mode" data-m="pz">Pezzi / confezioni</button>
      </div>
      ${f.mode === 'pz' ? `
        <div class="two">
          <label>Grammi per 1 pezzo<input inputmode="decimal" value="${f.per || ''}" placeholder="Es. 60" data-input="food-per"></label>
          <label>Nome unità<input value="${esc(f.label || '')}" placeholder="pz, vasetto, fetta…" data-input="food-label"></label>
        </div>
        <p class="muted small" id="food-ex">${ex}</p>` : ''}
      <label>Reparto
        <select data-input="food-cat">${CATEGORIES.map((c) => `<option ${c === f.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
      </label>
    </div>`;
  if (first) openSheet(html);
  else $('#sheet .sheet').innerHTML = `<div class="grab"></div>${html}`;
}

/* ---------------- Import / export ---------------- */

let pdfjsPromise = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('../vendor/pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href;
      return m;
    });
  }
  return pdfjsPromise;
}

function pickFile(accept, cb) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  input.onchange = () => { const f = input.files[0]; input.remove(); if (f) cb(f); };
  document.body.appendChild(input);
  input.click();
}

async function importPdf(file) {
  showBusy('Leggo la dieta…');
  try {
    const pdfjs = await getPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());
    const pages = await extractPages(pdfjs, data);
    const diet = parseDiet(pages);
    if (!diet.days.length || !diet.days.some((d) => d.meals.length)) throw new Error('Nessuna giornata trovata nel PDF');
    hideBusy();
    const nRec = Object.keys(diet.recipes).filter((k) => k.includes('|')).length;
    const had = !!state.diet;
    if (had && !confirm(`Ho trovato ${diet.days.length} giornate e ${nRec} ricette.\n\nSostituisco la dieta attuale? Le scelte dei giorni verranno azzerate; lista della spesa, dispensa e impostazioni restano.`)) return;
    state.diet = { ...diet, fileName: file.name, importedAt: Date.now() };
    if (had) state.plans = {};
    save();
    try { navigator.storage?.persist?.(); } catch (e) { /* facoltativo */ }
    ui.tab = 'oggi';
    render();
    toast(`Dieta caricata: ${diet.days.length} giornate, ${nRec} ricette`);
  } catch (e) {
    hideBusy();
    console.error(e);
    alert('Non sono riuscito a leggere questo PDF.\n\n' + (e.message || e));
  }
}

async function exportBackup() {
  const json = JSON.stringify({ app: 'dieta-app', exportedAt: new Date().toISOString(), state }, null, 1);
  const fname = `dieta-backup-${todayStr()}.json`;
  const file = new File([json], fname, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Backup dieta' });
      return;
    }
  } catch (e) { if (e.name === 'AbortError') return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = fname;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

async function importBackup(file) {
  try {
    const obj = JSON.parse(await file.text());
    const s = obj.state || obj;
    if (!s.version || !('diet' in s)) throw new Error('File non valido');
    if (state.diet && !confirm('Sostituisco tutti i dati attuali con quelli del backup?')) return;
    state = Object.assign(blank(), s);
    save();
    ui.tab = 'oggi';
    render();
    toast('Backup importato');
  } catch (e) {
    alert('Backup non valido: ' + (e.message || e));
  }
}

/* ---------------- Toast e attesa ---------------- */

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
function showBusy(msg) { const b = $('#busy'); b.querySelector('p').textContent = msg; b.classList.add('show'); }
function hideBusy() { $('#busy').classList.remove('show'); }

/* ---------------- Eventi ---------------- */

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a;
  const p = () => ensurePlan();
  switch (a) {
    case 'tab': ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); break;
    case 'date': ui.date = addDays(ui.date, Number(el.dataset.d)); render(); break;
    case 'date-today': ui.date = todayStr(); render(); break;
    case 'set-day': {
      const pl = p();
      const n = Number(el.dataset.n);
      if (pl.day !== n) { pl.day = n; pl.variants = {}; pl.choices = {}; pl.addedAt = null; }
      save(); ui.keepScroll = true; render(); break;
    }
    case 'variant': p().variants[el.dataset.mi] = Number(el.dataset.vi); save(); ui.keepScroll = true; render(); break;
    case 'pick': if (ev.target.closest('.recipe-link')) return; sheetPick(el.dataset.key); break;
    case 'choose': p().choices[el.dataset.key] = Number(el.dataset.i); save(); closeSheet(); ui.keepScroll = true; render(); break;
    case 'recipe': ev.stopPropagation(); sheetRecipe(Number(el.dataset.day), el.dataset.name, Number(el.dataset.qty)); break;
    case 'close-sheet': closeSheet(); if (ui.tab === 'alimenti') { ui.keepScroll = true; render(); } break;
    case 'open-add': sheetAdd(); break;
    case 'add-toggle': {
      const r = sheetState.rows.find((x) => x.id === el.dataset.id); r.sel = !r.sel; renderSheetAdd(); break;
    }
    case 'add-all': sheetState.rows.forEach((r) => { r.sel = el.dataset.v === '1'; }); renderSheetAdd(); break;
    case 'add-pick': {
      const r = sheetState.rows.find((x) => x.id === el.dataset.id);
      r.pick = norm(r.pick) === norm(el.dataset.v) ? '' : el.dataset.v; r.sel = true; renderSheetAdd(); break;
    }
    case 'add-confirm': confirmAdd(); break;
    case 'toggle-shop': {
      const s = state.shopping.find((x) => x.id === el.dataset.id); s.checked = !s.checked; save(); ui.keepScroll = true; render(); break;
    }
    case 'del-shop': state.shopping = state.shopping.filter((x) => x.id !== el.dataset.id); save(); ui.keepScroll = true; render(); break;
    case 'clear-checked': state.shopping = state.shopping.filter((x) => !x.checked); save(); render(); break;
    case 'clear-all': if (confirm('Svuotare tutta la lista della spesa?')) { state.shopping = []; save(); render(); } break;
    case 'open-extra': sheetExtra(); break;
    case 'food-filter': ui.foodFilter = el.dataset.f; render(); break;
    case 'toggle-pantry': ev.stopPropagation(); setFood(el.dataset.name, { pantry: !getFood(el.dataset.name).pantry }); ui.keepScroll = true; render(); break;
    case 'food': sheetFood(el.dataset.name); break;
    case 'food-mode': {
      const f = getFood(sheetState.name);
      setFood(sheetState.name, { mode: el.dataset.m, per: f.per || '', label: f.label || 'pz' });
      renderSheetFood(false); break;
    }
    case 'pick-pdf': pickFile('application/pdf,.pdf', importPdf); break;
    case 'pick-backup': pickFile('application/json,.json', importBackup); break;
    case 'export': exportBackup(); break;
    case 'reset':
      if (confirm('Cancellare dieta, lista della spesa, dispensa e impostazioni da questo telefono?')) {
        state = blank(); save(); ui.tab = 'oggi'; render();
      }
      break;
  }
});

document.addEventListener('input', (ev) => {
  const el = ev.target;
  const k = el.dataset?.input;
  if (!k) return;
  if (k === 'food-search') {
    ui.foodSearch = el.value;
    const pos = el.selectionStart;
    render();
    const inp = $('[data-input=food-search]');
    inp.focus(); try { inp.setSelectionRange(pos, pos); } catch (e) { /* */ }
  } else if (k === 'add-other') {
    const r = sheetState.rows.find((x) => x.id === el.dataset.id);
    r.pick = el.value; r.sel = true;
    el.closest('.row').querySelectorAll('.chip').forEach((c) => c.classList.toggle('on', norm(c.dataset.v) === norm(el.value)));
  } else if (k === 'food-per') {
    setFood(sheetState.name, { per: parseFloat(el.value.replace(',', '.')) || 0 });
    const f = getFood(sheetState.name);
    const ex = $('#food-ex');
    if (ex) ex.textContent = f.per > 0 ? `Esempio: 150 g → ${fmtNum(150 / f.per)} ${f.label || 'pz'}` : 'Indica quanti grammi pesa un pezzo.';
  } else if (k === 'food-label') {
    setFood(sheetState.name, { label: el.value.trim() || 'pz' });
  }
});

document.addEventListener('change', (ev) => {
  const el = ev.target;
  const k = el.dataset?.input;
  if (k === 'food-pantry') setFood(sheetState.name, { pantry: el.checked });
  else if (k === 'food-cat') {
    setFood(sheetState.name, { cat: el.value });
    state.shopping.forEach((s) => { if (norm(s.name) === norm(sheetState.name)) s.cat = el.value; });
    save();
  }
});

document.addEventListener('submit', (ev) => {
  const form = ev.target;
  const k = form.dataset.form;
  if (!k) return;
  ev.preventDefault();
  const fd = new FormData(form);
  if (k === 'extra') {
    const name = String(fd.get('name') || '').trim();
    if (!name) return;
    const qtyRaw = String(fd.get('qty') || '').replace(',', '.');
    const qty = qtyRaw ? parseFloat(qtyRaw) : null;
    let unit = String(fd.get('unit') || '');
    let q = qty;
    if (unit === 'kg' && q != null) { q *= 1000; unit = 'g'; }
    addToShopping(name, q, unit, 'Extra', String(fd.get('cat') || '') || getFood(name).cat);
    save(); closeSheet(); render(); toast(`${name} aggiunto`);
  } else if (k === 'add-pantry') {
    const name = String(fd.get('n') || '').trim();
    if (!name) return;
    const existing = allFoodNames().find((n) => norm(n) === norm(name));
    setFood(existing || name, { pantry: true });
    render(); toast(`${existing || name} in dispensa`);
  }
});

/* ---------------- Avvio ---------------- */

render();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

// Per i test
window.__dieta = { get state() { return state; }, importPdf, render };
