# wireframe

Una skill per [Claude Code](https://claude.com/claude-code) che, mentre pianifichi una modifica al frontend, apre un **mockup dell'intera pagina** con i testi veri e un tipo per ogni elemento: bottone, campo data, lookup, tabella. Lo riorganizzi trascinando, aggiungi componenti da una libreria, imposti i vincoli dei campi e lasci note per chi svilupperà. Il risultato torna nel piano prima che venga scritto il codice.

Parte solo quando la chiami con `/wireframe`.

## Cosa fa

1. **Legge la pagina vera.** Parte dall'HTML reso, senza conoscere il framework. Riconosce sezioni, titoli, link, bottoni, gruppi di bottoni, tab, tabelle e campi, ognuno con il suo tipo. Un campo e la sua etichetta sono un'unità sola, e un campo con il bottone di ricerca diventa un lookup. Dei campi legge obbligatorietà e vincoli dagli attributi HTML, mai i valori.
2. **Applica il piano.** Gli elementi nuovi sono blu, quelli modificati gialli, quelli eliminati spariscono. È la versione di partenza: quella che verrebbe realizzata se non toccassi nulla.
3. **Ti lascia lavorare.** Sposti e ridimensioni i blocchi su una griglia con aggancio, aggiungi componenti, elimini, cambi testi e tipi, scomponi un gruppo nei suoi elementi, imposti i vincoli e scrivi note.
4. **Riporta il risultato nel piano.** Quando torni in chat e rispondi «Ho finito», Claude aggiunge al piano lo schema del layout, gli spostamenti, gli elementi aggiunti, eliminati e modificati, la tabella dei vincoli e le note per lo sviluppo, parola per parola.

Funziona con qualsiasi framework. Il server lavora in memoria e non scrive su disco, quindi non tocca i file del progetto: è pensata anche per la modalità piano.

## Installazione

È una cartella con `SKILL.md` alla radice: basta metterla in `~/.claude/skills/wireframe`.

**Con git**

```bash
git clone https://github.com/Giovanni1926/wireframe ~/.claude/skills/wireframe
```

Per aggiornarla:

```bash
git -C ~/.claude/skills/wireframe pull
```

**Con npx**, usando [`skills`](https://github.com/vercel-labs/skills), un installer di terzi che non fa parte di Claude Code:

```bash
npx skills add Giovanni1926/wireframe -g -a claude-code --copy
```

`-g` la installa per tutti i progetti e `--copy` copia i file invece di collegarli. Per aggiornarla: `npx skills update wireframe`.

**Solo per un progetto:** copia la cartella in `.claude/skills/wireframe/` del progetto e committala. Chi clona il progetto ha la skill.

## Uso

```text
/wireframe [URL, pagina o file] [pannello] [sezioni|elementi]
```

- Senza argomenti usa la pagina di cui stai parlando nella conversazione, oppure te la chiede.
- Con un URL, un file HTML o il nome di una pagina parte da quella.
- Con la parola `pannello` il mockup si apre nel browser integrato dell'app Claude invece che in una finestra del browser.
- Il livello di dettaglio decide cosa si può spostare:
  - `sezioni`: solo i blocchi principali;
  - senza parola, cioè `blocchi`: sezioni e unità di contenuto, come una card o un campo con la sua etichetta;
  - `elementi`: ogni bottone, link e campo, su una griglia a 24 colonne. Usalo per spostare singoli bottoni o campi.

Se la pagina è in esecuzione la legge da lì. Se l'app è spenta può partire dai sorgenti, con una struttura approssimata. Se la pagina non esiste ancora, la compone dal piano.

## L'editor

- **Libreria.** A sinistra, con i componenti divisi per categoria (Layout, Testo, Azioni, Campi, Dati, Media) e un filtro. Trascini una tessera sulla pagina o dentro una sezione, oppure la clicchi: va nella sezione selezionata o sotto il blocco selezionato. Il pannello si sposta dall'intestazione e si comprime. Ctrl+K apre l'aggiunta veloce per nome.
- **Inspector.** Clic su un blocco per vederne tipo, testo, vincoli, elementi ripetuti e nota. Doppio clic o F2 cambiano il testo sul posto. In fondo ci sono Duplica, Scomponi ed Elimina.
- **Vincoli.** Per i campi: obbligatorio, sola lettura, disabilitato, lunghezza minima e massima, valore minimo e massimo, decimali, formato (codice fiscale, partita IVA, IBAN, email, CAP, telefono, solo cifre o regex), valore predefinito e messaggio di errore. Un campo obbligatorio ha l'asterisco, uno in sola lettura il lucchetto.
- **Note.** Ogni blocco può avere una nota per lo sviluppo: comportamento, regole, dati. Compare come post-it numerato e arriva nel piano come requisito.
- **Scomponi.** Trasforma ciò che è disegnato dentro un blocco, per esempio i bottoni di un gruppo o le voci delle tab, in elementi da spostare e annotare uno per uno.
- **Temi.** Wireframe pulito (predefinito), Pulito scuro, Schizzo e Blueprint. Il tema scelto resta anche se ricarichi la pagina. I pulsanti Tipi e Note mostrano o nascondono il tipo di ogni blocco e i post-it.
- **Zoom.** Da 50% a 200%, con −, + e Adatta.
- **Esporta PNG.** Salva un'immagine del mockup, da allegare a un ticket o a una mail.

Ogni modifica si salva da sola. Gli elementi nuovi sono blu, quelli modificati gialli e quelli che hai spostato tu viola.

| Tasti | Azione |
|---|---|
| Ctrl+K | Aggiunta veloce |
| Doppio clic, F2 | Cambia il testo |
| Canc | Elimina il blocco selezionato |
| Ctrl+D | Duplica |
| Ctrl+Z | Annulla |
| Ctrl+Shift+Z, Ctrl+Y | Ripeti |
| Ctrl + / Ctrl − / Ctrl 0 | Zoom avanti, indietro, adatta |
| Ctrl+rotellina | Zoom |
| Esc | Deseleziona |

Su Mac, Cmd al posto di Ctrl.

## Requisiti

- **Node.js.** Serve per il server locale. L'ho provata con la versione 22.
- **App desktop di Claude**, per leggere una pagina in esecuzione: l'estrazione usa il suo browser integrato. Altrove la skill può partire dai sorgenti.
- **Un browser** per l'editor, che si apre in quello predefinito del sistema.

## Cosa passa e dove

- Il server ascolta solo su `127.0.0.1`, controlla host e origine delle richieste e si spegne da solo dopo 60 minuti di inattività.
- L'estrazione non legge i valori dei campi dei moduli e taglia i testi lunghi, ma i titoli, le etichette, i link e i bottoni visibili finiscono nella conversazione con Claude: non usarla su pagine con dati che non vuoi condividere.

## Com'è fatta

```text
wireframe/
├── SKILL.md               le istruzioni per Claude
├── scripts/
│   ├── extract-dom.js     legge la pagina e restituisce i blocchi
│   └── serve.mjs          il server locale dell'editor
├── assets/
│   ├── editor.html        la pagina dell'editor
│   ├── editor.js          griglia, libreria, Inspector, note, salvataggio e risultato
│   ├── catalog.js         il catalogo dei tipi
│   ├── constraints.js     i vincoli dei campi
│   ├── sketch.js          il disegno dei blocchi e i temi
│   ├── themes.css         i colori dei temi
│   └── vendor/            GridStack 14.0.0 e html-to-image (MIT), con le licenze
├── references/
│   ├── spec.md            il formato dei dati e il catalogo dei tipi
│   └── apply-to-code.md   come portare il risultato nel codice
└── tests/fixtures/
    ├── sample.html        una pagina di prova
    └── maschera.html      una maschera di ricerca gestionale
```

`maschera.html` contiene lookup, date, numero, select, email, checkbox, radio, toggle, textarea, gruppo di bottoni, tab, tabella e paginazione: serve a provare l'estrazione dei tipi.

## Stato

Versione 2.1: tipi, libreria, Inspector, vincoli, note, Scomponi, temi, zoom ed export PNG. L'estrazione e l'editor sono provati a mano sulle pagine di prova. L'uso completo con `/wireframe` in una sessione in modalità piano non è ancora stato verificato.

## Licenza

[MIT](LICENSE). L'editor include GridStack 14.0.0 e html-to-image, entrambi MIT, con le loro licenze in [`assets/vendor/`](assets/vendor/).
