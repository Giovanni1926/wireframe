# Formato dei dati

## Dati in entrata

`extract-dom.js` restituisce questo oggetto. Il server richiede solo `blocks`, gli altri campi servono a te e all'editor.

```json
{
  "page": "Home",
  "source": "http://localhost:3000/",
  "width": 1280,
  "rowPx": 24,
  "count": 26,
  "truncated": false,
  "overlays": [
    { "tag": "div", "label": "Banner dei cookie", "selector": "body > div:nth-of-type(5)" }
  ],
  "blocks": [
    {
      "id": "section-4",
      "tag": "section",
      "label": "Hero",
      "selector": "main > section:nth-of-type(1)",
      "x": 0,
      "y": 2,
      "w": 12,
      "h": 10,
      "status": "existing",
      "children": [
        { "id": "h1-5", "tag": "h1", "label": "Titolo", "x": 0, "y": 0, "w": 7, "h": 3, "status": "existing" },
        {
          "id": "div-6",
          "tag": "div",
          "label": "Inizia",
          "x": 0,
          "y": 4,
          "w": 7,
          "h": 2,
          "status": "existing",
          "parts": [["button", 0, 0, 20, 100, "Inizia"], ["link", 24, 20, 30, 60, "Guarda la demo"]]
        }
      ]
    }
  ]
}
```

| Campo | Significato |
|---|---|
| `id` | Identificativo unico in tutta la pagina |
| `tag` | Tag HTML del blocco |
| `label` | Testo breve mostrato nel mockup |
| `selector` | Selettore CSS, per ritrovare il blocco nella pagina |
| `x`, `w` | Colonna di partenza e larghezza, in colonne della pagina (12 in tutto). Dentro una sezione, `x` parte dal bordo sinistro della sezione |
| `y`, `h` | Riga di partenza e altezza. Una riga vale `rowPx` pixel. Dentro una sezione, `y` parte dal bordo superiore della sezione |
| `status` | `existing`, `new` (blu) o `changed` (giallo). Se manca vale `existing` |
| `children` | Blocchi contenuti. Chi ne ha diventa una sezione in cui si può trascinare |
| `container` | `true` per una sezione rimasta vuota, così resta una sezione |
| `fixed` | `true` se il blocco è fisso o sticky nella pagina |
| `repeat` | Numero di elementi simili raggruppati nel blocco, per esempio 8 loghi |
| `parts` | Cosa si vede dentro un blocco che non è una sezione. Vedi sotto |
| `kind` | Disegno da usare quando il tag non basta: `button` per un link fatto a bottone, `image` per un blocco con un'immagine di sfondo |
| `tone` | `dark` se il blocco sta su un fondo scuro |

I contenitori che occupano quasi tutta la pagina, come `main`, non diventano blocchi: le loro sezioni compaiono direttamente al primo livello, dove si riordinano meglio.

Per una pagina nuova bastano `id`, `tag`, `label`, `x`, `y`, `w`, `h` e `status`. Usa altezze realistiche: da 2 a 4 righe per una barra, da 8 a 14 per una sezione.

## Il disegno dei blocchi

Un blocco senza `parts` si disegna dal tag: un `h1` mostra `label` come titolo, un `p` come prima riga seguita da scarabocchi, un `img` come una foto, un `button` come un bottone. Anche `input`, `video`, `ul` e `table` hanno il loro disegno, e gli altri tag mostrano `label` come titolo con delle righe di testo sotto. Con `repeat` e senza `parts` compaiono tante caselle quanti sono gli elementi.

Se il blocco contiene più elementi, descrivili con `parts`. Ogni parte è una lista `[tipo, x, y, w, h, testo]`, con le misure in percentuale del blocco, da 0 a 100. Il testo è facoltativo. Il formato è stretto perché questi dati passano da te al server.

| Tipo | Disegno |
|---|---|
| `heading` | Titolo |
| `text` | Prima riga vera, poi scarabocchi se c'è altezza |
| `link` | Testo sottolineato |
| `button` | Bottone |
| `input` | Campo, con il testo come segnaposto |
| `image` | Riquadro con una foto stilizzata |
| `video` | Riquadro con il tasto play |
| `box` | Riquadro grigio, per esempio una card, con il testo al centro |

Le parti si disegnano in ordine, quindi un `box` va prima di ciò che contiene. Il disegno serve solo a riconoscere il blocco e non cambia il risultato: `extract-dom.js` non legge il valore dei campi e taglia i testi lunghi.

## Regole del trascinamento

Servono per spiegare all'utente cosa vede.

- Un blocco entra in una sezione solo se è più stretto di lei, oppure se ci stava già. Così le sezioni a tutta larghezza si riordinano invece di annidarsi.
- Una sezione si allarga da sola per contenere ciò che riceve.
- I blocchi che si scontrano vengono spinti in basso.

## Risultato

`GET RESULT_URL` restituisce:

```json
{
  "opened": true,
  "page": "Home",
  "source": "http://localhost:3000/",
  "changed": true,
  "moves": [
    {
      "id": "button-7",
      "tag": "button",
      "label": "Inizia",
      "selector": "main > section:nth-of-type(1) > a",
      "touched": true,
      "kinds": ["parent", "position"],
      "from": { "parent": "section-4", "x": 0, "y": 5, "w": 3, "h": 2 },
      "to": { "parent": "section-9", "x": 5, "y": 0, "w": 3, "h": 2 }
    }
  ],
  "outline": "header \"Logo\" [12/12]\nsection \"Hero\" [12/12]\n  dentro section \"Hero\":\n    h1 \"Titolo\" / p \"Testo\" [7/12] | img \"Foto\" [5/12]",
  "final": []
}
```

| Campo | Significato |
|---|---|
| `opened` | `false` se l'editor non è mai stato aperto |
| `changed` | `true` se almeno un blocco è diverso dalla versione di partenza |
| `moves[].touched` | `true` se l'ha spostato l'utente, `false` se è stato spinto da un altro blocco |
| `moves[].kinds` | Cosa è cambiato: `parent` (contenitore), `position`, `size` |
| `moves[].from`, `to` | Prima e dopo. `parent: null` indica il livello della pagina |
| `outline` | Schema del layout: ogni riga è una fila, `\|` separa le colonne, `/` i blocchi impilati nella stessa colonna, `[n/12]` è la larghezza |
| `final` | Struttura finale, con lo stesso formato di `blocks` ma senza `parts` |

Se l'utente non ha mai aperto l'editor, il risultato contiene solo `opened: false`, `changed: false`, `moves: []` e `final`.
