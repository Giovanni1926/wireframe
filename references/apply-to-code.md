# Dal mockup al codice

Il mockup descrive ordine, proporzioni, tipi, vincoli e requisiti, non pixel. Il codice deve restare responsive e usare il sistema che il progetto ha già.

Il suo aspetto non è il design. Il tema scelto, le linee a mano e le righe di testo finte servono a riconoscere i blocchi e non vanno portati nel codice. Anche i testi possono essere tagliati: riprendili dai sorgenti.

## Prima di scrivere

1. Guarda come il progetto gestisce il layout: Tailwind, CSS Modules, styled-components, CSS semplice, un sistema di griglia o i layout del framework. Usa quello, senza introdurne uno nuovo.
2. Trova ogni blocco nei sorgenti partendo da `selector`, `label`, `type` e `tag`. In un'app con componenti, il selettore porta all'HTML reso: risali al componente, al template o al descrittore che lo genera cercando il testo o le classi.
3. Tieni conto che il mockup non mostra i contenitori di pagina, come `main`: le loro sezioni compaiono al primo livello. Il `selector` dice dove stanno davvero, e un blocco che era dentro `main` resta dentro `main`.
4. Leggi tutte le note prima di cominciare: possono cambiare il modo di realizzare un blocco.

## Tipi

Il `type` dice quale componente serve, non come scriverlo. Per ogni tipo usa il componente che il progetto ha già: il campo data del framework per `input-date`, il suo campo di ricerca con lente per `lookup`, la sua griglia per `table`, la sua finestra per `modal`. Scrivi un `<input>` semplice solo se il progetto fa così.

Se un elemento in `edited` cambia `type`, sostituisci il componente, non solo l'aspetto, e ricollega dati e validazioni.

## Vincoli

Ogni voce di `constraints` del risultato va applicata due volte:

- **nel client**, con il meccanismo che il progetto usa già: attributi HTML (`required`, `maxlength`, `min`, `max`, `step`, `pattern`), le proprietà del componente, il validatore della maschera;
- **nel server**, con la validazione che il progetto usa già per quel dato: controlli nel controller, nel bean o nel servizio, regole del framework. Un vincolo solo nel client si aggira.

Regole:

- `required`: obbligatorio sia nella maschera sia nel salvataggio. Segnalo come il progetto segnala gli altri campi obbligatori.
- `readonly`: il campo si vede ma non si modifica. Il server non deve accettarne un valore diverso da quello che ha mandato.
- `disabled`: il campo o il bottone non si usa. Se non è scritto quando si abilita, chiedilo.
- `minLength`, `maxLength`: anche nella lunghezza della colonna a DB, se il campo è nuovo.
- `min`, `max`, `decimals`: per le date, i valori sono ISO. Converti nel formato che il progetto usa.
- `format`: usa il controllo che il progetto ha già per codice fiscale, partita IVA, IBAN, email, CAP, telefono. Con `regex` usa `pattern`.
- `default`: il valore con cui il campo si presenta in inserimento, non in modifica.
- `message`: è il testo dell'errore da mostrare all'utente. Se manca, usa i messaggi standard del progetto.

Tieni le regole che esistono già sui campi: un vincolo nuovo si aggiunge, non sostituisce quelli presenti, a meno che `edited` mostri che l'utente l'ha tolto.

## Note

Le note sono requisiti vincolanti dell'utente, non suggerimenti. Realizzale tutte. Se una nota non è chiara, è in conflitto con un'altra o con il codice esistente, chiedi prima di procedere. Nel riepilogo finale indica, per numero, come hai realizzato ogni nota.

## Elementi eliminati

Per ogni voce di `removed`, con i suoi `children`:

- togli il markup o il componente;
- togli i collegamenti ai dati: property del bean, campi del form, parametri della richiesta;
- togli gestori di eventi, azioni e mapping che servivano solo a lui;
- togli i messaggi e le traduzioni rimasti senza uso.

Non toccare colonne o tabelle del DB: se il dato non serve più, scrivilo nel piano e chiedi.

## Elementi aggiunti

Le voci di `added` e i blocchi con `status: "new"` non esistono ancora: realizzali nella posizione approvata, con il componente del loro `type`, i vincoli e la nota. Segui lo stile del progetto: nomi, struttura dei file, collegamento ai dati come negli elementi vicini. I `children` dicono cosa contiene una sezione nuova.

## Elementi modificati

Per ogni voce di `edited`, applica solo i campi in `fields`:

- `label`: cambia l'etichetta, anche nei file di traduzione se il progetto li usa;
- `type`: cambia il componente, vedi «Tipi»;
- `required`, `disabled`, `readonly`, `constraints`: vedi «Vincoli»;
- `repeat`: cambia il numero di elementi di un elenco solo se non viene dai dati.

## Regole di layout

- **Ordine:** l'ordine di lettura, dall'alto in basso e da sinistra a destra, diventa l'ordine nel DOM. Conta anche per l'accessibilità e per la tastiera, quindi non simularlo con `order` o con posizionamenti CSS.
- **Posizioni:** non usare `position: absolute` né valori in pixel presi dal mockup. Le coordinate indicano la relazione tra i blocchi, non una misura.
- **Colonne:** i blocchi sulla stessa fila diventano CSS Grid, flex o la griglia del framework. `[7/12]` e `[5/12]` indicano le proporzioni; con `elementi` la pagina ha 24 colonne, quindi `[8/24]` è un terzo. Dentro una sezione, `m` è la larghezza della sezione.
- **Altezze:** sono indicative, perché comanda il contenuto. Imposta un'altezza minima solo se l'utente ha ridimensionato il blocco di proposito, cioè se `kinds` contiene `size` e `touched` è `true`.
- **Spazi:** riusa gli spazi e i margini già presenti nel progetto. Non tradurre in margini i vuoti tra le righe del mockup, a meno che l'utente li abbia lasciati chiaramente di proposito.
- **Mobile:** sotto il breakpoint del progetto, impila i blocchi in ordine di lettura.
- **Blocchi fissi:** se un blocco ha `fixed: true`, mantieni il suo comportamento fisso o sticky anche se cambia posizione.
- **Blocchi con `repeat`:** rappresentano un elenco. Spostali come un'unità, senza cambiare il numero di elementi.

## Blocchi che cambiano contenitore

Se `kinds` contiene `parent`, sposta il markup o il componente nel suo nuovo contenitore. Controlla cosa gli serviva nel posto di prima:

- Dati e props: in un'app con componenti possono arrivare dal vecchio genitore.
- Stato condiviso, contesto o slot.
- Il form a cui appartiene: un campo portato fuori dal suo `<form>` non viene più inviato.
- Stili che dipendevano dal vecchio contenitore, per esempio selettori come `.hero .button`.

Se il ricollegamento non è banale, scrivilo nel piano prima di procedere.

## Elementi scomposti

Gli elementi con `derived: true` nascono da «Scomponi»: nel codice sono ancora dentro un unico componente, come un gruppo di bottoni o una barra di tab. Hanno lo stesso `selector` del gruppo, quindi ritrovali dal `label`.

- Se restano tutti nel loro gruppo, cambia solo l'ordine o le proporzioni dentro il componente.
- Se uno esce dal gruppo, dividi il componente: l'elemento spostato diventa un componente a sé nel nuovo contenitore, con il suo gestore e le sue regole di abilitazione, e il gruppo resta con gli altri.
- Se uno manca in `final` e compare in `removed`, toglilo dal gruppo.
