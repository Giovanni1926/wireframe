---
name: wireframe
description: Apre un mockup disegnato a mano dell'intera pagina, da riorganizzare trascinando i blocchi, mentre si pianifica una modifica al frontend. Parte dall'HTML reale, con qualsiasi framework, e riporta nel piano il layout approvato.
argument-hint: "[URL, pagina o file] [pannello]"
allowed-tools: Read, Bash(node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs *), Bash(curl -s http://127.0.0.1:*), mcp__Claude_Browser__preview_start, mcp__Claude_Browser__navigate, mcp__Claude_Browser__resize_window, mcp__Claude_Browser__javascript_tool, mcp__Claude_Browser__tabs_context
---

# Mockup trascinabile

Mostra all'utente la pagina come la prevedi tu, con i testi veri e un tipo per ogni elemento (bottone, campo data, lookup, tabella...). Lascia che la riorganizzi: sposta, aggiunge, elimina, imposta i vincoli dei campi e lascia note per lo sviluppo. Poi porta il risultato nel piano. Serve a decidere prima di scrivere il codice, non dopo.

**Argomenti:** `$ARGUMENTS`. Possono contenere un URL, un file o il nome di una pagina, la parola `pannello` e il livello di dettaglio `sezioni` o `elementi`.

**Modalità piano:** questo flusso è compatibile, perché non tocca i file del progetto. Il server lavora in memoria e non scrive su disco, e l'unico file da modificare resta il file del piano. Per lo stesso motivo non creare `.claude/launch.json` mentre sei in modalità piano.

## 1. Individua la pagina

Usa l'argomento o il contesto della conversazione. Se non è chiaro quale pagina stai pianificando, chiedilo.

## 2. Ricava la struttura

Il mockup deve partire dall'HTML vero, così funziona con qualsiasi framework. Scegli il caso giusto.

**Livello di dettaglio.** L'estrazione ha tre livelli:

- `sezioni`: solo i blocchi principali. Il contenuto resta disegnato dentro e non si sposta.
- `blocchi` (predefinito): sezioni e unità di contenuto, come una card o un campo con la sua etichetta.
- `elementi`: ogni bottone, link e campo è un blocco a sé. Gruppi di bottoni, form e tab diventano sezioni, e la griglia passa a 24 colonne.

Usa il livello scritto negli argomenti. Se non c'è e l'utente vuole spostare singoli bottoni o campi, proponi `elementi`. Altrimenti resta su `blocchi`.

**App in esecuzione o URL**

1. Apri la pagina con `preview_start` e `url`: ottieni una scheda nuova e il suo `tabId`. Se serve un accesso, chiedi all'utente di farlo nel pannello Browser.
2. Imposta la scheda a 1280×800 con `resize_window`. Il pannello è spesso stretto, e a quella larghezza leggeresti il layout mobile.
3. Leggi `${CLAUDE_SKILL_DIR}/scripts/extract-dom.js` e passa a `javascript_tool` il testo intero, preceduto da una riga con il livello:

   ```js
   window.WF_OPTIONS = { granularity: 'elementi' };
   ```

   Senza quella riga vale `blocchi`. Lo script restituisce già i dati del mockup: tipi, ciò che si vede dentro ogni blocco, obbligatorietà e vincoli dichiarati negli attributi HTML dei campi.
4. Riporta la scheda alla sua larghezza con `resize_window` e `preset: "desktop"`.

**File HTML statici**

Il pannello Browser non esegue script sui file locali, quindi servono via HTTP. Avvia in background `node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs --site <cartella>`, leggi `SITE_URL` e `CLOSE_URL` dal suo output e segui i passi qui sopra con `SITE_URL` più il nome del file. Alla fine spegni il server con `curl -s "<CLOSE_URL>"`.

**App spenta**

Se esiste già `.claude/launch.json`, avviala con `preview_start` e `name`. Altrimenti chiedi all'utente se preferisce avviarla lui o procedere dai sorgenti. Dai sorgenti, leggi template e componenti e scrivi i blocchi nello stesso formato, con il `type` del catalogo. Di' all'utente che la struttura è approssimata.

**Pagina nuova**

Componi i blocchi dal piano, con il `type` del catalogo, i tag HTML che intendi scrivere e i testi che prevedi.

Se `truncated` è `true`, la pagina ha più blocchi del limite: quelli più piccoli restano interi. Se `overlays` non è vuoto, cita quegli elementi all'utente: sono fissi sopra la pagina e non compaiono nel mockup.

## 3. Applica il piano

Trasforma la struttura nella pagina come la prevede il piano, perché è questa la versione di partenza: quella che realizzeresti se l'utente non toccasse nulla.

- Aggiungi le sezioni e gli elementi nuovi con `status: "new"`, nella posizione in cui li metteresti. Dai a ognuno il `type` del catalogo: `input-date` per una data, `lookup` per un codice con ricerca, `button-group` per una barra di bottoni.
- Segna con `status: "changed"` i blocchi che il piano modifica.
- Togli i blocchi che il piano elimina.
- Sposta i blocchi che il piano sposta, e fai spazio ai nuovi spingendo in basso quelli che seguono.
- Nei blocchi nuovi o modificati scrivi in `label` il testo che prevedi, e aggiungi `parts` se contengono più elementi: l'utente deve riconoscere cosa proponi, non una scatola vuota.
- Nei campi nuovi puoi impostare `required` e `constraints` se il piano li prevede, per esempio un codice fiscale obbligatorio.
- Negli altri blocchi copia `type`, `parts`, `tone`, `required`, `disabled`, `readonly` e `constraints` senza toccarli.
- Non scrivere `note`: le note sono dell'utente.

Il formato e il catalogo dei tipi sono in [references/spec.md](references/spec.md). Controlla che gli `id` siano unici e lascia `granularity` e `columns` come li ha restituiti l'estrazione.

## 4. Apri il mockup

Avvia il server in background (`run_in_background`), passando i dati su stdin:

```bash
node ${CLAUDE_SKILL_DIR}/scripts/serve.mjs --open <<'JSON'
{ "page": "...", "source": "...", "granularity": "blocchi", "columns": 12, "blocks": [ ... ] }
JSON
```

Il mockup si apre in una finestra del browser, dove c'è più spazio. Leggi `WIREFRAME_URL` e `RESULT_URL` dall'output del comando.

Se l'utente ha scritto `pannello`, o se l'output contiene `WIREFRAME_OPEN_FAILED`, avvia il server senza `--open` e apri `WIREFRAME_URL` con `preview_start`. Poi controlla con `tabs_context`: se il pannello è nascosto, chiedi all'utente di mostrarlo con Cmd+Shift+B. Suggerisci di allargarlo trascinandone il bordo.

## 5. Aspetta l'utente

Usa `AskUserQuestion`. L'editor salva da solo, quindi basta un clic, e la domanda è il modo corretto di attendere anche in modalità piano.

- Domanda: "Il mockup è aperto: sposta, aggiungi, elimina gli elementi, imposta i vincoli e lascia note. Hai finito?"
- Opzioni: "Ho finito" e "Annulla".

Se l'utente risponde con altro, rispondigli e ripeti la domanda.

## 6. Leggi il risultato

Esegui `curl -s "<RESULT_URL>"`: restituisce il risultato e spegne il server. Fallo anche se l'utente ha scelto "Annulla", ignorando il contenuto, così il server non resta acceso.

Se il server non risponde, le modifiche sono perse: si spegne da solo dopo 60 minuti senza la pagina aperta. Diglielo e riapri il mockup dal passo 4.

- `opened: false`: l'utente non ha mai aperto la pagina. Diglielo e proponi di riprovare.
- `changed: false`: il layout resta quello proposto, senza note.
- `moves`: gli spostamenti. Con `touched: true` li ha fatti l'utente, con `touched: false` sono blocchi spinti di conseguenza.
- `added`: gli elementi aggiunti. Solo le radici, con il loro contenuto in `children`.
- `removed`: gli elementi eliminati. Solo le radici, con `selector` per ritrovarli nel codice.
- `edited`: testo, tipo, flag, ripetizioni o vincoli cambiati, ognuno con `from` e `to`.
- `notes`: le note dell'utente, numerate in ordine di lettura.
- `constraints`: tutti gli elementi con flag o vincoli, come sono alla fine. È lo stato, non la differenza.
- `outline`: lo schema del layout finale, già pronto da riportare.
- `final`: la struttura completa, senza `parts`.

## 7. Aggiorna il piano

Aggiungi al piano questa sezione. Se non c'è un file del piano, mettila nella risposta. Togli le parti vuote.

````markdown
## Layout approvato

```text
<outline>
```

Spostamenti:
- <ogni blocco con touched: true, in parole: "Bottone "Cerca" sopra la tabella">

Elementi aggiunti:
- <tipo "testo"> in <contenitore o pagina>, <posizione in parole>

Elementi eliminati:
- <tipo "testo"> (`<selector>`)

Modifiche:
- <tipo "testo">: <campo> da <from> a <to>

Vincoli applicativi:

| Elemento | Selettore | Vincoli |
|---|---|---|
| <tipo "testo"> | `<selector>` o "nuovo" | <obbligatorio, max 16, formato codice fiscale, messaggio "..."> |

Note per lo sviluppo:
1. <tipo "testo"> (`<selector>`): <nota, parola per parola>
````

Elenca solo gli spostamenti fatti dall'utente: gli altri sono conseguenze. Se un blocco cambia contenitore e i suoi dati vanno ricollegati, scrivilo nel piano.

Le note sono requisiti dell'utente: riportale parola per parola, con il numero, senza riassumerle. Se una nota contraddice il piano, segnalalo all'utente.

Prima di scrivere il codice leggi [references/apply-to-code.md](references/apply-to-code.md).

## 8. Dopo il codice

Se l'app è in esecuzione, ripeti l'estrazione del passo 2 sulla pagina vera, con lo stesso livello, e confrontala con `final`: l'ordine di lettura deve coincidere, i tipi devono essere gli stessi e le colonne possono differire al massimo di una. Riporta le differenze all'utente, anche se sembrano piccole.
