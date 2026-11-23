// Reparti, stagionalità e valori predefiniti per gli alimenti.

export const CATEGORIES = [
  'Frutta e verdura',
  'Carne e salumi',
  'Pesce',
  'Latticini e uova',
  'Pane, pasta e cereali',
  'Legumi',
  'Frutta secca',
  'Alternative vegetali',
  'Surgelati',
  'Dispensa e condimenti',
  'Bevande e integratori',
  'Altro',
];

// L'ordine conta: la prima regola che corrisponde vince.
const RULES = [
  ['Surgelati', ['surgelat', 'gelato', 'bastoncini']],
  ['Bevande e integratori', ['acqua', 'creatina', 'vino']],
  ['Dispensa e condimenti', ['olio', 'marmellata', 'crema ', 'crema di', 'miele', 'pesto', 'passata', 'pelati', 'aceto', 'salsa', 'brodo', 'curcuma', 'paprika', 'in polvere', 'olive', 'pomodori secchi', 'amido', ' sale ', ' pepe ', 'spezie', 'cannella']],
  ['Alternative vegetali', ['tofu', 'seitan', 'tempeh', 'vegetale', 'burger di']],
  ['Frutta secca', ['mandorle', 'noci', 'nocciole', 'arachidi', 'pistacchi', 'anacardi']],
  ['Legumi', ['lenticchie', 'ceci', 'fagioli', 'piselli', 'cicerchie', 'borlotti', 'cannellini', 'edamame']],
  ['Pesce', ['merluzzo', 'nasello', 'orata', 'pesce', 'polpo', 'salmone', 'trota', 'sogliola', 'spigola', 'calamar', 'seppi', 'gamber', 'persico', 'tonno', 'branzino']],
  ['Carne e salumi', ['pollo', 'tacchin', 'vitell', 'maiale', 'arista', 'prosciutto', 'prosc', 'bresaola', 'macinat', 'manzo', 'bovino', 'speck']],
  ['Latticini e uova', ['latte', 'yogurt', 'ricotta', 'philadelphia', 'mozzarella', 'feta', 'fiocchi di latte', 'parmigiano', 'grana', 'gorgonzola', 'robiola', 'stracchino', 'burro', 'uova', 'uovo', 'albume', 'formaggio', 'skyr']],
  ['Pane, pasta e cereali', ['pane', 'fette biscottate', 'pasta', 'spaghetti', 'tagliatelle', 'riso', 'farro', 'orzo', 'couscous', 'quinoa', 'grano', 'kamut', 'gallette', 'barretta', 'pancarr', 'pangrattato', 'farina', 'polenta', 'avena', 'cereali', 'piadina', 'cracker', 'pizza']],
  ['Frutta e verdura', ['frutta', 'verdur', 'ortaggi', 'mela', 'mele', 'pera', 'pere', 'limon', 'arance', 'zucca', 'zucchin', 'spinaci', 'cavol', 'funghi', 'pomodor', 'cipoll', 'carot', 'sedano', 'porri', 'verza', 'cicoria', 'valeriana', 'rucola', 'rughetta', 'radicchio', 'barbabietol', 'melagran', 'asparagi', 'peperon', 'patate', 'prezzemolo', 'basilico', 'salvia', 'rosmarino', 'erbe', 'aglio', 'banan', 'kiwi', 'insalata', 'lattuga', 'finocch', 'melanzan', 'broccol', 'carciof', 'bietol', 'fragol', 'uva', 'cachi', 'mandarin', 'clementin', 'pesche', 'albicocc', 'anguria', 'melone', 'ciliegi', 'prugne', 'fichi', 'mirtilli', 'lamponi', 'ananas', 'pompelm']],
];

export function guessCategory(name) {
  const n = ' ' + String(name).toLowerCase() + ' ';
  for (const [cat, keys] of RULES) {
    if (keys.some((k) => n.includes(k))) return cat;
  }
  return 'Altro';
}

// Alimenti "generici" da specificare quando si fa la spesa
export function genericKind(name) {
  const n = String(name).toLowerCase();
  if (!n.includes('stagione') && !/^frutta( fresca)?$/.test(n) && !/^verdur/.test(n)) return null;
  if (n.includes('frutta')) return 'frutta';
  if (n.includes('verdur') || n.includes('ortaggi')) return 'verdura';
  return null;
}

// Frutta e verdura di stagione in Italia, per mese (0 = gennaio)
const FRUTTA = [
  ['Arance', 'Mandarini', 'Clementine', 'Kiwi', 'Mele', 'Pere', 'Pompelmo', 'Limoni'],
  ['Arance', 'Mandarini', 'Kiwi', 'Mele', 'Pere', 'Pompelmo', 'Limoni'],
  ['Arance', 'Kiwi', 'Mele', 'Pere', 'Pompelmo', 'Limoni'],
  ['Arance', 'Kiwi', 'Mele', 'Pere', 'Fragole', 'Limoni'],
  ['Fragole', 'Ciliegie', 'Nespole', 'Mele', 'Kiwi', 'Arance'],
  ['Ciliegie', 'Albicocche', 'Fragole', 'Pesche', 'Melone', 'Anguria', 'Nespole'],
  ['Pesche', 'Albicocche', 'Melone', 'Anguria', 'Prugne', 'Ciliegie', 'Mirtilli'],
  ['Pesche', 'Melone', 'Anguria', 'Prugne', 'Fichi', 'Pere', 'More'],
  ['Uva', 'Fichi', 'Pere', 'Mele', 'Prugne', 'Pesche', 'Melone'],
  ['Uva', 'Mele', 'Pere', 'Cachi', 'Melagrana', 'Kiwi'],
  ['Mele', 'Pere', 'Kiwi', 'Cachi', 'Melagrana', 'Arance', 'Mandarini', 'Clementine', 'Uva'],
  ['Arance', 'Mandarini', 'Clementine', 'Kiwi', 'Mele', 'Pere', 'Cachi', 'Melagrana'],
];
const VERDURA = [
  ['Broccoli', 'Cavolfiore', 'Cavolo nero', 'Cavolo verza', 'Carciofi', 'Finocchi', 'Spinaci', 'Bietole', 'Radicchio', 'Porri', 'Carote', 'Insalata'],
  ['Broccoli', 'Cavolfiore', 'Cavolo nero', 'Carciofi', 'Finocchi', 'Spinaci', 'Bietole', 'Radicchio', 'Porri', 'Carote', 'Insalata'],
  ['Carciofi', 'Asparagi', 'Finocchi', 'Spinaci', 'Bietole', 'Broccoli', 'Carote', 'Insalata', 'Rucola'],
  ['Asparagi', 'Carciofi', 'Piselli', 'Fave', 'Spinaci', 'Bietole', 'Carote', 'Insalata', 'Rucola'],
  ['Asparagi', 'Zucchine', 'Piselli', 'Fagiolini', 'Insalata', 'Carote', 'Rucola', 'Bietole'],
  ['Zucchine', 'Fagiolini', 'Pomodori', 'Melanzane', 'Peperoni', 'Cetrioli', 'Insalata', 'Carote'],
  ['Zucchine', 'Fagiolini', 'Pomodori', 'Melanzane', 'Peperoni', 'Cetrioli', 'Insalata'],
  ['Zucchine', 'Fagiolini', 'Pomodori', 'Melanzane', 'Peperoni', 'Cetrioli', 'Insalata'],
  ['Zucchine', 'Pomodori', 'Melanzane', 'Peperoni', 'Zucca', 'Funghi', 'Fagiolini', 'Insalata'],
  ['Zucca', 'Funghi', 'Broccoli', 'Cavolfiore', 'Spinaci', 'Bietole', 'Finocchi', 'Radicchio', 'Carote', 'Insalata'],
  ['Zucca', 'Broccoli', 'Cavolfiore', 'Cavolo nero', 'Cavolo verza', 'Cavoletti di Bruxelles', 'Finocchi', 'Spinaci', 'Bietole', 'Radicchio', 'Carciofi', 'Funghi', 'Carote', 'Insalata'],
  ['Zucca', 'Broccoli', 'Cavolfiore', 'Cavolo nero', 'Cavolo verza', 'Cavoletti di Bruxelles', 'Finocchi', 'Spinaci', 'Bietole', 'Radicchio', 'Carciofi', 'Porri', 'Carote', 'Insalata'],
];

export function seasonal(kind, date = new Date()) {
  const m = date.getMonth();
  return (kind === 'frutta' ? FRUTTA : VERDURA)[m].slice();
}

// Impostazioni predefinite per alcuni alimenti (l'utente può cambiarle)
export const DEFAULT_FOODS = {
  'uova di gallina - intero': { mode: 'pz', per: 60, label: 'uova' },
  'yogurt greco 0% bianco': { mode: 'pz', per: 170, label: 'vasetto' },
  'acqua': { pantry: true },
  'olio di oliva extra vergine': { pantry: true },
  'creatina vector': { pantry: true },
};
