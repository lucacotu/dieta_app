# La mia dieta

Web app per iPhone: scegli la giornata della dieta, le alternative di ogni pasto e crea la lista della spesa. Funziona offline e salva tutto sul telefono.

## Pubblicarla su GitHub Pages (gratis)

1. Su github.com crea un nuovo repository **pubblico**, ad esempio `dieta-app`.
2. Nella pagina del repo scegli **Add file → Upload files** e trascina **il contenuto** di questa cartella: `index.html`, `manifest.webmanifest`, `sw.js` e le cartelle `css`, `js`, `icons`, `vendor`. Poi fai **Commit changes**.
3. Vai su **Settings → Pages**. In "Build and deployment" scegli *Deploy from a branch*, branch `main`, cartella `/ (root)` e premi **Save**.
4. Dopo un paio di minuti l'app è su `https://<tuo-utente>.github.io/dieta-app/`.

Il repository contiene solo il codice. La dieta non c'è: la carichi tu dal telefono e resta salvata lì.

## Installarla sull'iPhone

1. Apri il link in **Safari**.
2. Tocca **Condividi** → **Aggiungi alla schermata Home**.
3. Apri l'app **dall'icona sulla Home** e carica il PDF della dieta. L'app sulla Home ha una memoria separata da Safari, quindi il PDF va caricato da lì.

## Come si usa

- **Oggi**: scegli la giornata (1°–7°), tocca un alimento per scegliere l'alternativa, guarda le ricette e premi *Aggiungi alla spesa*. Puoi scorrere le date con ‹ ›.
- **Spesa**: lista divisa per reparto. Spunti quello che hai preso e aggiungi cose extra con *+ Aggiungi*.
- **Dispensa**: le cose che hai sempre in casa partono già deselezionate. In *Tutti gli alimenti* tocchi un alimento per vederlo in pezzi invece che in grammi (es. uova: 1 pz = 60 g).
- **Impostazioni**: carica un nuovo PDF quando cambia la dieta, esporta o importa il backup.

## Provarla sul computer

Serve un piccolo server locale, perché aprendo `index.html` con un doppio clic non funziona:

```
cd dieta-app
python3 -m http.server 8000
```

Poi apri http://localhost:8000.

Usa [pdf.js](https://mozilla.github.io/pdf.js/) (licenza Apache 2.0, in `vendor/`).
