# Dal mockup al codice

Il mockup descrive ordine e proporzioni, non pixel. Il suo scopo è far decidere all'utente come sono disposti i blocchi: il codice deve restare responsive e usare il sistema che il progetto ha già.

Il suo aspetto non è il design. Comic Sans, linee a mano e scarabocchi servono a riconoscere i blocchi e non vanno portati nel codice. Anche i testi possono essere tagliati: riprendili dai sorgenti.

## Prima di scrivere

1. Guarda come il progetto gestisce il layout: Tailwind, CSS Modules, styled-components, CSS semplice, un sistema di griglia già presente. Usa quello, senza introdurne uno nuovo.
2. Trova ogni blocco nei sorgenti partendo da `selector`, `label` e `tag`. In un'app con componenti, il selettore porta all'HTML reso: risali al componente che lo genera cercando il testo o le classi.

3. Tieni conto che il mockup non mostra i contenitori di pagina, come `main`: le loro sezioni compaiono al primo livello. Il `selector` dice dove stanno davvero, e un blocco che era dentro `main` resta dentro `main`.

## Regole

- **Ordine:** l'ordine di lettura, dall'alto in basso e da sinistra a destra, diventa l'ordine nel DOM. Conta anche per l'accessibilità e per la tastiera, quindi non simularlo con `order` o con posizionamenti CSS.
- **Posizioni:** non usare `position: absolute` né valori in pixel presi dal mockup. Le coordinate indicano la relazione tra i blocchi, non una misura.
- **Colonne:** i blocchi sulla stessa fila diventano CSS Grid o flex. `[7/12]` e `[5/12]` indicano le proporzioni. Se il progetto ha già una griglia a 12 colonne, usala direttamente.
- **Altezze:** sono indicative, perché comanda il contenuto. Imposta un'altezza minima solo se l'utente ha ridimensionato il blocco di proposito, cioè se `kinds` contiene `size` e `touched` è `true`.
- **Spazi:** riusa gli spazi e i margini già presenti nel progetto. Non tradurre in margini i vuoti tra le righe del mockup, a meno che l'utente li abbia lasciati chiaramente di proposito.
- **Mobile:** sotto il breakpoint del progetto, impila i blocchi in ordine di lettura.
- **Blocchi fissi:** se un blocco ha `fixed: true`, mantieni il suo comportamento fisso o sticky anche se cambia posizione.
- **Blocchi con `repeat`:** rappresentano un elenco. Spostali come un'unità, senza cambiare il numero di elementi.

## Blocchi che cambiano contenitore

Se `kinds` contiene `parent`, sposta il markup o il componente nel suo nuovo contenitore. Controlla cosa gli serviva nel posto di prima:

- Dati e props: in un'app con componenti possono arrivare dal vecchio genitore.
- Stato condiviso, contesto o slot.
- Stili che dipendevano dal vecchio contenitore, per esempio selettori come `.hero .button`.

Se il ricollegamento non è banale, scrivilo nel piano prima di procedere.

## Blocchi nuovi

I blocchi con `status: "new"` non esistono ancora: realizzali nella posizione approvata, seguendo lo stile del progetto.
