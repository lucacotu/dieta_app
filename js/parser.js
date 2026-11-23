// Parser del "Piano Alimentare" (PDF generato con Crystal Reports).
// Riceve le pagine come liste di elementi di testo {str, x, y, h} e restituisce
// la dieta strutturata: giornate -> pasti -> varianti -> alimenti (con alternative),
// più le ricette con ingredienti e procedimento.

const AMOUNT_RE = /^(\d+(?:[.,]\d+)?)\s*(g|gr|kg|ml|cl|l|pz|n)\.?$/i;

export function parseAmount(str) {
  const m = String(str).trim().match(AMOUNT_RE);
  if (!m) return null;
  let qty = parseFloat(m[1].replace(',', '.'));
  let unit = m[2].toLowerCase();
  if (unit === 'gr') unit = 'g';
  if (unit === 'kg') { qty *= 1000; unit = 'g'; }
  if (unit === 'l') { qty *= 1000; unit = 'ml'; }
  if (unit === 'cl') { qty *= 10; unit = 'ml'; }
  if (unit === 'n') unit = 'pz';
  return { qty, unit };
}

const clean = (s) => s.replace(/\s+/g, ' ').trim();

function titleCase(s) {
  const t = s.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// Raggruppa gli elementi di una pagina in righe (stessa y), dall'alto in basso.
function toLines(items) {
  const sorted = items
    .filter((it) => it.str && it.str.trim())
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  for (const l of lines) l.items.sort((a, b) => a.x - b.x);
  return lines;
}

// Divide gli elementi di una riga in "celle" nome+quantità.
function cells(items) {
  const out = [];
  let cur = null;
  for (const it of items) {
    const amt = parseAmount(it.str);
    if (amt) {
      if (cur && !cur.amount) { cur.amount = amt; cur.amountX = it.x; cur = null; }
      else out.push({ name: '', x: it.x, amount: amt });
      continue;
    }
    if (cur && !cur.amount && it.x - cur.lastX < 200) {
      cur.name = clean(cur.name + ' ' + it.str);
      cur.lastX = it.x;
    } else {
      cur = { name: clean(it.str), x: it.x, lastX: it.x, amount: null };
      out.push(cur);
    }
  }
  return out;
}

export function parseDiet(pages) {
  const days = [];
  const recipes = []; // {day, name, per, unit, ingredients, steps}
  let mode = null; // 'day' | 'recipe'
  let day = null, meal = null, variant = null, item = null;
  let inAlts = false;
  let lastAltByCol = [null, null];
  let recipe = null, recipeDay = null;
  let profile = {};

  const newItem = (name, amount) => {
    item = { name, qty: amount ? amount.qty : null, unit: amount ? amount.unit : 'g', alts: [] };
    variant.items.push(item);
    inAlts = false;
    lastAltByCol = [null, null];
  };

  pages.forEach((pageItems, pageIndex) => {
    const lines = toLines(pageItems);
    for (const line of lines) {
      const text = clean(line.items.map((i) => i.str).join(' '));
      const first = line.items[0];
      const maxH = Math.max(...line.items.map((i) => i.h || 0));

      // Piè di pagina
      if (line.y < 45 && /Pagina \d+ di \d+/i.test(text)) continue;
      if (/^Pagina \d+ di \d+$/i.test(text)) continue;

      // Prima pagina: dati anagrafici (solo informativi)
      if (pageIndex === 0 && !mode) {
        const m = text.match(/Piano Alimentare\s+(.+)$/i);
        if (m) profile.title = clean(m[0]);
        continue;
      }

      // Titoli di pagina
      if (maxH >= 12) {
        let m = text.match(/Ingredienti ricette del\s+(\d+)\s*°?\s*Giorno/i);
        if (m) { mode = 'recipe'; recipeDay = parseInt(m[1], 10); continue; }
        m = text.match(/^(\d+)\s*°?\s*Giorno/i);
        if (m) {
          const n = parseInt(m[1], 10);
          if (mode === 'day' && day && day.n === n) continue; // continua stesso giorno
          mode = 'day';
          day = { n, label: '', note: '', meals: [] };
          days.push(day);
          meal = variant = item = null;
          continue;
        }
      }

      if (mode === 'day') {
        if (/^\.\.\.\s*Continua/i.test(text)) continue;

        // Intestazione pasto: in alto a sinistra, maiuscolo
        if (first.x < 35) {
          const notaIdx = line.items.findIndex((i) => /^Nota:/i.test(i.str.trim()));
          const headerItems = notaIdx >= 0 ? line.items.slice(0, notaIdx) : line.items;
          const header = clean(headerItems.map((i) => i.str).join(' '));
          const note = notaIdx >= 0 ? clean(line.items.slice(notaIdx).map((i) => i.str).join(' ').replace(/^Nota:\s*/i, '')) : '';
          if (header && header === header.toUpperCase()) {
            const alt = header.match(/^(.*?)\s+ALTERNATIV[OA]\s*(\d*)$/);
            if (alt && meal && meal.key === alt[1]) {
              variant = { title: titleCase(header), note, items: [] };
              meal.variants.push(variant);
            } else {
              meal = { key: header, name: titleCase(header), variants: [] };
              variant = { title: titleCase(header), note, items: [] };
              meal.variants.push(variant);
              day.meals.push(meal);
            }
            if (note && !day.note && /GIORNATA/i.test(note)) {
              day.note = note;
            }
            item = null;
            continue;
          }
        }

        if (!variant) continue;

        if (/^Alternative:?$/i.test(text)) { inAlts = true; lastAltByCol = [null, null]; continue; }

        // Alimento principale (colonna a x ~ 52)
        if (first.x >= 45 && first.x < 60 && !inAlts) {
          const cs = cells(line.items);
          const c = cs[0];
          if (c.amount || !item) newItem(c.name, c.amount);
          else item.name = clean(item.name + ' ' + c.name); // nome su due righe
          continue;
        }
        if (first.x >= 45 && first.x < 60 && inAlts) {
          // nuovo alimento principale dopo un blocco di alternative
          const cs = cells(line.items);
          newItem(cs[0].name, cs[0].amount);
          continue;
        }

        // Alternative (due colonne: x ~ 40 e x ~ 310)
        if (inAlts && item) {
          const cs = cells(line.items);
          for (const c of cs) {
            const col = c.x < 300 ? 0 : 1;
            if (!c.name && c.amount && lastAltByCol[col] && lastAltByCol[col].qty == null) {
              lastAltByCol[col].qty = c.amount.qty; lastAltByCol[col].unit = c.amount.unit;
              continue;
            }
            if (c.name && !c.amount && lastAltByCol[col]) {
              lastAltByCol[col].name = clean(lastAltByCol[col].name + ' ' + c.name);
              continue;
            }
            if (c.name) {
              const alt = { name: c.name, qty: c.amount ? c.amount.qty : null, unit: c.amount ? c.amount.unit : 'g' };
              item.alts.push(alt);
              lastAltByCol[col] = alt;
            }
          }
          continue;
        }
        continue;
      }

      if (mode === 'recipe') {
        const m = text.match(/^Ingredienti per\s+(\d+(?:[.,]\d+)?)\s*(g|ml)\s+di\s+(.+)$/i);
        if (m) {
          recipe = {
            day: recipeDay,
            name: clean(m[3]),
            per: parseFloat(m[1].replace(',', '.')),
            unit: m[2].toLowerCase(),
            ingredients: [],
            steps: [],
          };
          recipes.push(recipe);
          continue;
        }
        if (!recipe) continue;
        if (/^Procedimento:?$/i.test(text)) continue;
        const cs = cells(line.items);
        const isIngredient =
          recipe.steps.length === 0 &&
          cs.length === 1 && cs[0].name && cs[0].amount && cs[0].name.length < 70;
        if (isIngredient) {
          recipe.ingredients.push({ name: cs[0].name, qty: cs[0].amount.qty, unit: cs[0].amount.unit });
        } else {
          recipe.steps.push(text);
        }
      }
    }
  });

  // Etichetta del giorno dalla nota (es. "GIORNATA DI ALLENAMENTO SALA PESI")
  for (const d of days) {
    d.label = dayLabel(d.note);
    // rimuove la nota "giornata" dal primo pasto per non ripeterla
    for (const m of d.meals) for (const v of m.variants) if (v.note === d.note) v.note = '';
  }

  // Ricette: testo del procedimento unito in paragrafi
  const recipeMap = {};
  for (const r of recipes) {
    const steps = joinSteps(r.steps, r.name);
    const rec = { name: r.name, per: r.per, unit: r.unit, ingredients: r.ingredients, steps };
    recipeMap[`${r.day}|${r.name.toLowerCase()}`] = rec;
    if (!recipeMap[r.name.toLowerCase()]) recipeMap[r.name.toLowerCase()] = rec;
  }

  return { profile, days, recipes: recipeMap };
}

function joinSteps(lines, name) {
  let txt = lines.join(' ').replace(/\s+/g, ' ').trim();
  // Il PDF a volte ripete il nome della ricetta in coda al testo
  if (name && txt.endsWith(name) && !txt.endsWith('. ' + name)) {
    const cut = txt.slice(0, txt.length - name.length).trim();
    if (/[.!]$/.test(cut)) txt = cut;
  }
  // Passaggi numerati "1. ... 2. ..."
  const numbered = txt.split(/\s(?=\d+\.\s)/);
  if (numbered.length > 1) return numbered.map((s) => s.trim());
  return [txt];
}

export function dayLabel(note) {
  if (!note) return 'Giornata libera';
  const n = note.toUpperCase();
  if (/PESI|SALA/.test(n)) return 'Allenamento pesi';
  if (/CORSA|RUN/.test(n)) return 'Allenamento corsa';
  const m = note.match(/GIORNATA DI\s+(.+)/i);
  return m ? titleCase(m[1]) : titleCase(note);
}

// Estrae gli elementi di testo da un PDF usando pdf.js (browser o Node).
export async function extractPages(pdfjs, data) {
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(
      tc.items
        .filter((it) => it.str !== undefined)
        .map((it) => ({ str: it.str, x: it.transform[4], y: it.transform[5], h: it.height }))
    );
  }
  return pages;
}
