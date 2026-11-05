# wireframe

Una skill per [Claude Code](https://claude.com/claude-code) che, mentre pianifichi una modifica al frontend, apre un **mockup disegnato a mano dell'intera pagina**: linee storte, Comic Sans e i testi veri della pagina. Lo riorganizzi trascinando i blocchi, e il layout approvato torna nel piano come schema e lista di spostamenti, prima che venga scritto il codice.

Parte solo quando la chiami con `/wireframe`.

## Cosa fa

1. **Legge la pagina vera.** Parte dall'HTML reso, senza conoscere il framework, e ne ricava blocchi, titoli, link, bottoni, campi e immagini.
2. **Applica il piano.** Le sezioni nuove sono blu, quelle modificate gialle, quelle eliminate spariscono. È la versione di partenza: quella che verrebbe realizzata se non toccassi nulla.
3. **Ti lascia trascinare.** I blocchi stanno su una griglia a 12 colonne con aggancio. Li sposti, li ridimensioni dal bordo destro o da quello in basso, annulli con Cmd/Ctrl+Z. Il blocco in mano ha il bordo più spesso, e quelli che hai mosso tu restano segnati in viola.
4. **Riporta il risultato nel piano.** Quando torni in chat e rispondi «Ho finito», Claude aggiunge al piano il layout approvato come schema di testo, con l'elenco degli spostamenti che hai fatto tu.

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
/wireframe [URL, pagina o file] [pannello]
```

- Senza argomenti usa la pagina di cui stai parlando nella conversazione, oppure te la chiede.
- Con un URL, un file HTML o il nome di una pagina parte da quella.
- Con la parola `pannello` il mockup si apre nel browser integrato dell'app Claude invece che in una finestra del browser.

Se la pagina è in esecuzione la legge da lì. Se l'app è spenta può partire dai sorgenti, con una struttura approssimata. Se la pagina non esiste ancora, la compone dal piano.

## Requisiti

- **Node.js.** Serve per il server locale. L'ho provata con la versione 22.
- **App desktop di Claude**, per leggere una pagina in esecuzione: l'estrazione usa il suo browser integrato. Altrove la skill può partire dai sorgenti.
- **Un browser** per l'editor, che si apre in quello predefinito del sistema.

## Cosa passa e dove

- Il server ascolta solo su `127.0.0.1`, controlla host e origine delle richieste e si spegne da solo dopo 60 minuti di inattività.
- L'estrazione non legge i valori dei campi dei moduli e taglia i testi lunghi, ma i titoli, i link e i bottoni visibili finiscono nella conversazione con Claude: non usarla su pagine con dati che non vuoi condividere.

## Com'è fatta

```text
wireframe/
├── SKILL.md              le istruzioni per Claude
├── scripts/
│   ├── extract-dom.js    legge la pagina e restituisce i blocchi
│   └── serve.mjs         il server locale dell'editor
├── assets/
│   ├── editor.html       l'editor
│   └── vendor/           GridStack 14.0.0 (MIT)
├── references/
│   ├── spec.md           il formato dei dati
│   └── apply-to-code.md  come portare il layout nel codice
└── tests/fixtures/       una pagina di prova
```

## Stato

Prima versione. L'estrazione, l'editor e il risultato sono provati a mano sulla pagina di prova. L'uso completo con `/wireframe` in una sessione in modalità piano è ancora da verificare.

## Licenza

[MIT](LICENSE). L'editor include GridStack 14.0.0, anch'esso MIT, con la sua licenza in [`assets/vendor/LICENSE-gridstack`](assets/vendor/LICENSE-gridstack).
