# Formato dei dati

## Dati in entrata

`extract-dom.js` restituisce questo oggetto. Il server richiede solo `blocks`, gli altri campi servono a te e all'editor.

```json
{
  "page": "Ricerca ordini",
  "source": "http://localhost:8080/acquisti/ordini.do",
  "granularity": "blocchi",
  "width": 1280,
  "columns": 12,
  "rowPx": 24,
  "count": 22,
  "truncated": false,
  "overlays": [
    { "tag": "div", "label": "Banner dei cookie", "selector": "body > div:nth-of-type(5)" }
  ],
  "blocks": [
    {
      "id": "form-6",
      "tag": "form",
      "type": "form",
      "label": "Filtri di ricerca",
      "selector": "main > form",
      "x": 0,
      "y": 6,
      "w": 12,
      "h": 9,
      "status": "existing",
      "children": [
        {
          "id": "div-7",
          "tag": "div",
          "type": "lookup",
          "label": "Fornitore",
          "selector": "main > form > div:nth-of-type(1)",
          "x": 0, "y": 0, "w": 4, "h": 2,
          "status": "existing",
          "required": true
        },
        {
          "id": "input-8",
          "tag": "input",
          "type": "input-number",
          "label": "Importo minimo",
          "selector": "#importo",
          "x": 4, "y": 0, "w": 4, "h": 2,
          "status": "existing",
          "constraints": { "min": 0, "decimals": 2 }
        }
      ]
    },
    {
      "id": "div-20",
      "tag": "div",
      "type": "button-group",
      "label": "Azioni",
      "selector": "main > div:nth-of-type(2)",
      "x": 0, "y": 16, "w": 6, "h": 2,
      "status": "existing",
      "parts": [["button", 0, 0, 20, 100, "Cerca"], ["button", 24, 0, 22, 100, "Pulisci"]]
    }
  ]
}
```

| Campo | Significato |
|---|---|
| `granularity` | Livello di dettaglio dell'estrazione: `sezioni`, `blocchi` o `elementi` |
| `columns` | Colonne della griglia della pagina: 12, oppure 24 con `elementi` |
| `id` | Identificativo unico in tutta la pagina |
| `tag` | Tag HTML del blocco |
| `type` | Tipo del catalogo, vedi sotto. Se manca si ricava dal tag |
| `label` | Testo breve mostrato nel mockup. Per un campo è la sua etichetta |
| `selector` | Selettore CSS, per ritrovare il blocco nella pagina |
| `x`, `w` | Colonna di partenza e larghezza, in colonne della pagina. Dentro una sezione, `x` parte dal bordo sinistro della sezione |
| `y`, `h` | Riga di partenza e altezza. Una riga vale `rowPx` pixel. Dentro una sezione, `y` parte dal bordo superiore della sezione |
| `status` | `existing`, `new` o `changed`. Se manca vale `existing` |
| `children` | Blocchi contenuti. Chi ne ha diventa una sezione in cui si può trascinare |
| `container` | `true` per una sezione rimasta vuota, così resta una sezione |
| `fixed` | `true` se il blocco è fisso o sticky nella pagina |
| `repeat` | Numero di elementi simili raggruppati nel blocco, per esempio 8 loghi |
| `parts` | Cosa si vede dentro un blocco che non è una sezione. Vedi sotto |
| `tone` | `dark` se il blocco sta su un fondo scuro |
| `required` | `true` se il campo è obbligatorio |
| `disabled` | `true` se il campo o il bottone è disabilitato |
| `readonly` | `true` se il campo è in sola lettura |
| `constraints` | Vincoli del campo, vedi sotto |
| `note` | Nota per lo sviluppo. La scrive solo l'utente nell'editor |
| `kind` | Vecchio nome di `type`, ancora accettato: `button`, `image`, `input`, `heading`, `text`, `link`, `video`, `box` |

I contenitori che occupano quasi tutta la pagina, come `main`, non diventano blocchi: le loro sezioni compaiono direttamente al primo livello, dove si riordinano meglio.

Un campo e la sua etichetta (`<label for>` o un `<label>` che lo avvolge) sono un'unità sola: un blocco con il `type` del campo e l'etichetta in `label`. Un campo di testo seguito da un bottone di ricerca diventa un `lookup`.

Per una pagina nuova bastano `id`, `type`, `tag`, `label`, `x`, `y`, `w`, `h` e `status`. Usa altezze realistiche: da 2 a 4 righe per una barra, da 8 a 14 per una sezione.

### Vincoli

I vincoli valgono per i campi. L'estrazione li legge solo dagli attributi HTML (`required`, `disabled`, `readonly`, `minlength`, `maxlength`, `min`, `max`, `step`, `pattern`), mai dal valore dei campi.

| Chiave | Significato | Tipi |
|---|---|---|
| `minLength`, `maxLength` | Lunghezza minima e massima, in caratteri | campi di testo, `lookup`, `textarea` |
| `min`, `max` | Valore minimo e massimo. Numeri per `input-number` e `range`, stringhe ISO per date e ore (`2026-01-31`, `08:30`) | numeri, date, ore |
| `decimals` | Cifre dopo la virgola. L'estrazione le ricava da uno `step` decimale | numeri |
| `format` | `codice-fiscale`, `partita-iva`, `iban`, `email`, `cap`, `telefono`, `cifre` o `regex` | campi di testo |
| `pattern` | Espressione regolare, solo con `format: "regex"`. Un attributo `pattern` diventa `format: "regex"` | campi di testo |
| `default` | Valore predefinito | tutti i campi tranne `input-file` |
| `message` | Messaggio di errore da mostrare all'utente | tutti i campi |

Si scrivono solo le chiavi con un valore. Select, checkbox, radio e toggle hanno solo flag, `default` e `message`.

## Catalogo dei tipi

È in `assets/catalog.js`, unico riferimento per libreria, Inspector e disegno. I nomi dei componenti d'interfaccia restano nell'inglese corrente, quelli generici in italiano.

| Tipo | Nome | Disegno | Categoria |
|---|---|---|---|
| `section` | Sezione | Contenitore con titolo | Layout |
| `form` | Form | Contenitore con titolo | Layout |
| `fieldset` | Gruppo di campi | Contenitore con titolo | Layout |
| `card` | Card | Riquadro con titolo e righe di testo | Layout |
| `box` | Riquadro | Riquadro grigio con il testo al centro | Layout |
| `header` | Header | Barra in alto | Layout |
| `footer` | Footer | Barra in basso | Layout |
| `nav` | Navbar | Voci di menu affiancate | Layout |
| `sidebar` | Sidebar | Colonna laterale | Layout |
| `modal` | Modal | Finestra con barra del titolo | Layout |
| `tabs` | Tabs | Linguette, la prima attiva | Layout |
| `separator` | Separator | Linea orizzontale | Layout |
| `content` | Blocco generico | Titolo e righe di testo | Layout |
| `heading` | Titolo | Testo grande | Testo |
| `text` | Paragrafo | Prima riga vera, poi righe di testo | Testo |
| `label` | Etichetta | Testo in grassetto | Testo |
| `link` | Link | Testo sottolineato | Testo |
| `list` | Elenco | Voci con il punto | Testo |
| `badge` | Badge | Pastiglia piccola | Testo |
| `alert` | Alert | Riquadro con messaggio | Testo |
| `button` | Button | Bottone | Azioni |
| `icon-button` | Icon button | Bottone quadrato con icona | Azioni |
| `button-group` | Button group | Bottoni affiancati | Azioni |
| `menu` | Dropdown menu | Bottone con freccia | Azioni |
| `breadcrumb` | Breadcrumb | Percorso con `›`, l'ultimo in grassetto | Azioni |
| `pagination` | Pagination | Caselle ‹ 1 2 3 › | Azioni |
| `input-text` | Campo testo | Etichetta e campo | Campi |
| `input-number` | Campo numero | Campo con frecce su e giù | Campi |
| `input-date` | Campo data | Campo con calendario | Campi |
| `input-time` | Campo ora | Campo con orologio | Campi |
| `input-datetime` | Campo data e ora | Campo con calendario e orologio | Campi |
| `input-email` | Campo email | Campo con @ | Campi |
| `input-password` | Campo password | Campo con pallini | Campi |
| `input-tel` | Campo telefono | Campo con +39 | Campi |
| `input-url` | Campo URL | Campo con www | Campi |
| `input-search` | Campo ricerca | Campo con lente | Campi |
| `input-file` | Caricamento file | Campo con bottone Sfoglia | Campi |
| `lookup` | Lookup | Campo con bottone lente accanto | Campi |
| `select` | Select | Campo con freccia | Campi |
| `multiselect` | Multiselect | Campo alto con etichette selezionate | Campi |
| `textarea` | Textarea | Campo alto con righe | Campi |
| `checkbox` | Checkbox | Casella di spunta con etichetta | Campi |
| `radio` | Radio button | Cerchio con etichetta | Campi |
| `toggle` | Toggle | Interruttore con etichetta | Campi |
| `range` | Slider | Cursore su una barra | Campi |
| `table` | Tabella | Griglia con intestazione | Dati |
| `tree` | Tree | Nodi rientrati | Dati |
| `image` | Immagine | Riquadro con una foto stilizzata | Media |
| `video` | Video | Riquadro con il tasto play | Media |
| `icon` | Icona | Piccolo simbolo | Media |

Nei campi un `*` accanto all'etichetta indica `required` e un lucchetto indica `readonly`.

In `button-group`, `tabs`, `nav` e `breadcrumb` il testo si divide in voci con `·`, `|`, `›` o `>`: per esempio `"Salva · Annulla · Elimina"`. Così si disegnano e si possono scomporre anche quando non hanno `parts`.

Se manca `type`, si ricava dal tag: `h1`–`h6` → `heading`, `p` → `text`, `a` → `link`, `input` → `input-text`, `table` → `table`, `nav` → `nav`, `form` → `form`, e così via. Un blocco con `children` senza tipo è una `section`.

## Il disegno dei blocchi

Un blocco senza `parts` si disegna dal suo tipo. Con `repeat` e senza `parts` compaiono tante caselle quanti sono gli elementi.

Se il blocco contiene più elementi, descrivili con `parts`. Ogni parte è una lista `[tipo, x, y, w, h, testo]`, con le misure in percentuale del blocco, da 0 a 100. Il testo è facoltativo. Il formato è stretto perché questi dati passano da te al server.

Il tipo di una parte è un tipo atomico del catalogo: `heading`, `text`, `label`, `link`, `button`, `icon-button`, `image`, `video`, `icon`, `table`, tutti i campi (`input-*`, `lookup`, `select`, `textarea`, `checkbox`...), più `box` e `alert`. Valgono anche i tipi della prima versione: `heading`, `text`, `link`, `button`, `input`, `image`, `video`, `box`.

Le parti si disegnano in ordine, quindi un `box` va prima di ciò che contiene. Il disegno serve a riconoscere il blocco: le parti diventano blocchi veri solo se l'utente sceglie «Scomponi».

## Regole del trascinamento

Servono per spiegare all'utente cosa vede.

- Un blocco entra in una sezione solo se è più stretto di lei, oppure se ci stava già. Così le sezioni a tutta larghezza si riordinano invece di annidarsi.
- Una sezione si allarga da sola per contenere ciò che riceve.
- I blocchi che si scontrano vengono spinti in basso.

## Operazioni dell'editor

- **Aggiungere:** si trascina una tessera della libreria sulla pagina o dentro una sezione, oppure la si clicca. Con un clic il blocco va dentro la sezione selezionata, o sotto il blocco selezionato. Ctrl+K apre l'aggiunta veloce per nome. I blocchi nuovi hanno `id` `nuovo-<n>` e `status: "new"`.
- **Modificare:** clic per selezionare. Doppio clic o F2 cambiano il testo sul posto. L'Inspector cambia tipo, testo, vincoli, ripetizioni e nota.
- **Duplicare ed eliminare:** Ctrl+D duplica, Canc elimina. Una copia è un blocco nuovo, senza nota e senza selettore.
- **Scomporre:** «Scomponi» trasforma le parti di un blocco in blocchi figli trascinabili. Se non ha parti, divide il testo di `button-group`, `tabs`, `nav` e `breadcrumb` nelle sue voci. I figli hanno `id` `<id>.p<n>`, lo stesso `selector` del blocco e `derived: true`, il blocco ha `exploded: true`. Le posizioni appena nate non contano come spostamenti.
- **Note:** si scrivono nell'Inspector e compaiono come post-it numerati in ordine di lettura.
- **Annullare:** Ctrl+Z annulla, Ctrl+Shift+Z ripete. «Ripristina» torna alla versione di partenza.

## Risultato

`GET RESULT_URL` restituisce:

```json
{
  "opened": true,
  "page": "Ricerca ordini",
  "source": "http://localhost:8080/acquisti/ordini.do",
  "granularity": "elementi",
  "columns": 24,
  "changed": true,
  "moves": [
    {
      "id": "button-21",
      "tag": "button",
      "type": "button",
      "label": "Cerca",
      "selector": "main > div:nth-of-type(2) > button:nth-of-type(1)",
      "touched": true,
      "kinds": ["parent", "position"],
      "from": { "parent": "div-20", "x": 0, "y": 0, "w": 3, "h": 2 },
      "to": { "parent": "form-6", "x": 20, "y": 6, "w": 4, "h": 2 }
    }
  ],
  "added": [
    {
      "id": "nuovo-1",
      "tag": "input",
      "type": "input-text",
      "label": "Codice fiscale",
      "parent": "form-6",
      "x": 0, "y": 6, "w": 8, "h": 2,
      "note": "Se valorizzato ignora gli altri filtri",
      "constraints": { "maxLength": 16, "format": "codice-fiscale", "message": "Codice fiscale non valido" }
    }
  ],
  "removed": [
    { "id": "button-24", "tag": "button", "type": "button", "label": "Elimina", "selector": "main > div:nth-of-type(2) > button:nth-of-type(4)", "parent": "div-20" }
  ],
  "edited": [
    {
      "id": "input-8",
      "tag": "input",
      "type": "input-number",
      "label": "Importo minimo",
      "selector": "#importo",
      "fields": {
        "required": { "from": null, "to": true },
        "constraints": { "from": { "min": 0, "decimals": 2 }, "to": { "min": 0, "max": 100000, "decimals": 2 } }
      }
    }
  ],
  "notes": [
    { "n": 1, "id": "nuovo-1", "tag": "input", "type": "input-text", "label": "Codice fiscale", "note": "Se valorizzato ignora gli altri filtri" }
  ],
  "constraints": [
    { "id": "div-7", "type": "lookup", "label": "Fornitore", "selector": "main > form > div:nth-of-type(1)", "required": true },
    { "id": "input-8", "type": "input-number", "label": "Importo minimo", "selector": "#importo", "required": true, "constraints": { "min": 0, "max": 100000, "decimals": 2 } },
    { "id": "nuovo-1", "type": "input-text", "label": "Codice fiscale", "constraints": { "maxLength": 16, "format": "codice-fiscale", "message": "Codice fiscale non valido" } }
  ],
  "outline": "form \"Filtri di ricerca\" [24/24]\n  dentro form \"Filtri di ricerca\":\n    lookup* \"Fornitore\" [8/24] | input-number* \"Importo minimo\" {obbl., 0–100000, 2 dec.} [8/24]\n    input-text \"Codice fiscale\" {max 16, formato CF, msg errore} [nota 1] [8/24] | button \"Cerca\" [4/24]",
  "final": []
}
```

| Campo | Significato |
|---|---|
| `opened` | `false` se l'editor non è mai stato aperto |
| `granularity`, `columns` | Livello e colonne della pagina, come in entrata |
| `changed` | `true` se almeno una lista tra `moves`, `added`, `removed`, `edited` e `notes` non è vuota |
| `moves[].touched` | `true` se l'ha spostato l'utente, `false` se è stato spinto da un altro blocco |
| `moves[].kinds` | Cosa è cambiato: `parent` (contenitore), `position`, `size` |
| `moves[].from`, `to` | Prima e dopo. `parent: null` indica il livello della pagina |
| `added` | Elementi aggiunti, solo le radici: `id`, `tag`, `type`, `label`, `parent`, `x`, `y`, `w`, `h` e, se ci sono, `note`, `readonly`, `constraints` e `children` (`[{ type, label }]`, il contenuto) |
| `removed` | Elementi eliminati, solo le radici: `id`, `tag`, `type`, `label`, `selector`, `parent` e `children` se conteneva altro |
| `edited` | Elementi rimasti ma cambiati. `fields` contiene solo ciò che è cambiato, tra `label`, `type`, `required`, `disabled`, `repeat`, `readonly` e `constraints`, ognuno con `from` e `to`. `null` indica un valore assente |
| `notes` | Le note, numerate in ordine di lettura: `n`, `id`, `tag`, `type`, `label`, `selector`, `note` |
| `constraints` | Tutti gli elementi con flag o vincoli alla fine: `id`, `type`, `label`, `selector` e, se presenti, `required`, `readonly`, `disabled`, `constraints`. È lo stato, non la differenza |
| `outline` | Schema del layout, vedi sotto |
| `final` | Struttura finale, con lo stesso formato di `blocks` ma senza `parts`. Contiene anche `type`, `note`, `required`, `disabled`, `readonly`, `constraints`, `derived` ed `exploded` |

Un elemento nato da «Scomponi» compare in `removed` solo se il suo blocco è ancora scomposto. Il server toglie dal risultato lo `snapshot` interno, che serve solo all'editor per riprendere dopo un ricaricamento.

### Lo schema

Ogni riga dell'`outline` è una fila. `|` separa le colonne e `/` i blocchi impilati nella stessa colonna. Ogni blocco si scrive `tipo "testo"`, seguito da:

- `*` se è obbligatorio;
- ` {…}` con il riassunto dei vincoli, per esempio `{obbl., max 16, formato CF}`;
- `[nota n]` se ha una nota;
- `[n/m]`, la larghezza: `m` sono le colonne del contenitore, cioè quelle della pagina al primo livello e la larghezza della sezione all'interno.

Il contenuto di una sezione segue su righe rientrate, dopo `dentro tipo "testo":`.

### Editor mai aperto

Se l'utente non ha mai aperto l'editor, il risultato contiene `opened: false`, `changed: false`, le liste `moves`, `added`, `removed`, `edited` e `notes` vuote e `final` uguale a `blocks`.
