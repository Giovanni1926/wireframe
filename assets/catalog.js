// Catalogo dei tipi del mockup: unico riferimento per libreria, Inspector e disegno.
// I tipi seguono l'HTML (input type, select, textarea, ...) più alcuni composti
// che nelle maschere gestionali si riconoscono a colpo d'occhio: lookup e gruppo di bottoni.
// Le misure w e h sono in colonne su 12 e in righe: l'editor le scala sulle colonne della pagina.
window.WF_CATALOG = (() => {
  const CATEGORIES = [
    { id: 'layout', name: 'Layout' },
    { id: 'text', name: 'Testo' },
    { id: 'actions', name: 'Azioni' },
    { id: 'fields', name: 'Campi' },
    { id: 'data', name: 'Dati' },
    { id: 'media', name: 'Media' },
  ];

  // I nomi dei componenti d'interfaccia restano nell'inglese corrente (Card, Tabs, Select...),
  // quelli generici in italiano: sono le parole che si usano davvero parlando di maschere.
  // [tipo, categoria, nome, disegno, w, h, testo predefinito, opzioni]
  const ROWS = [
    ['section', 'layout', 'Sezione', 'content', 12, 6, 'Sezione', { container: true }],
    ['form', 'layout', 'Form', 'content', 8, 6, 'Form', { container: true }],
    ['fieldset', 'layout', 'Gruppo di campi', 'content', 6, 5, 'Gruppo di campi', { container: true }],
    ['card', 'layout', 'Card', 'card', 4, 5, 'Titolo della card'],
    ['box', 'layout', 'Riquadro', 'box', 3, 3, 'Riquadro'],
    ['header', 'layout', 'Header', 'header', 12, 2, 'Intestazione', { container: true }],
    ['footer', 'layout', 'Footer', 'footer', 12, 2, 'Piè di pagina', { container: true }],
    ['nav', 'layout', 'Navbar', 'nav', 8, 1, 'Home · Archivio · Report', { split: 'link' }],
    ['sidebar', 'layout', 'Sidebar', 'sidebar', 3, 10, 'Menu', { container: true }],
    ['modal', 'layout', 'Modal', 'modal', 6, 8, 'Titolo della finestra', { container: true }],
    ['tabs', 'layout', 'Tabs', 'tabs', 8, 1, 'Dati generali · Dettaglio · Allegati', { split: 'tab' }],
    ['separator', 'layout', 'Separator', 'separator', 12, 1, ''],
    ['content', 'layout', 'Blocco generico', 'content', 4, 3, 'Blocco'],

    ['heading', 'text', 'Titolo', 'heading', 6, 2, 'Titolo'],
    ['text', 'text', 'Paragrafo', 'text', 6, 2, 'Testo del paragrafo'],
    ['label', 'text', 'Etichetta', 'label', 2, 1, 'Etichetta'],
    ['link', 'text', 'Link', 'link', 2, 1, 'Link', { clickable: true }],
    ['list', 'text', 'Elenco', 'list', 4, 3, 'Voce dell\'elenco'],
    ['badge', 'text', 'Badge', 'badge', 1, 1, 'Nuovo'],
    ['alert', 'text', 'Alert', 'alert', 8, 2, 'Messaggio per l\'utente'],

    ['button', 'actions', 'Button', 'button', 2, 1, 'Conferma', { clickable: true }],
    ['icon-button', 'actions', 'Icon button', 'iconButton', 1, 1, '', { clickable: true }],
    ['button-group', 'actions', 'Button group', 'buttonGroup', 5, 1, 'Salva · Annulla · Elimina', { split: 'button' }],
    ['menu', 'actions', 'Dropdown menu', 'menu', 2, 1, 'Azioni', { clickable: true }],
    ['breadcrumb', 'actions', 'Breadcrumb', 'breadcrumb', 6, 1, 'Home › Archivio › Dettaglio', { split: 'link' }],
    ['pagination', 'actions', 'Pagination', 'pagination', 4, 1, '', { clickable: true }],

    ['input-text', 'fields', 'Campo testo', 'field', 4, 1, 'Descrizione', { field: true }],
    ['input-number', 'fields', 'Campo numero', 'field', 3, 1, 'Importo', { field: true }],
    ['input-date', 'fields', 'Campo data', 'field', 3, 1, 'Data', { field: true }],
    ['input-time', 'fields', 'Campo ora', 'field', 3, 1, 'Ora', { field: true }],
    ['input-datetime', 'fields', 'Campo data e ora', 'field', 4, 1, 'Data e ora', { field: true }],
    ['input-email', 'fields', 'Campo email', 'field', 4, 1, 'Email', { field: true }],
    ['input-password', 'fields', 'Campo password', 'field', 4, 1, 'Password', { field: true }],
    ['input-tel', 'fields', 'Campo telefono', 'field', 3, 1, 'Telefono', { field: true }],
    ['input-url', 'fields', 'Campo URL', 'field', 4, 1, 'Sito web', { field: true }],
    ['input-search', 'fields', 'Campo ricerca', 'field', 4, 1, 'Cerca', { field: true }],
    ['input-file', 'fields', 'Caricamento file', 'field', 4, 1, 'Allegato', { field: true }],
    ['lookup', 'fields', 'Lookup', 'field', 4, 1, 'Codice', { field: true }],
    ['select', 'fields', 'Select', 'field', 3, 1, 'Tipo', { field: true }],
    ['multiselect', 'fields', 'Multiselect', 'field', 4, 2, 'Categorie', { field: true }],
    ['textarea', 'fields', 'Textarea', 'field', 6, 3, 'Note', { field: true }],
    ['checkbox', 'fields', 'Checkbox', 'check', 3, 1, 'Attivo', { field: true }],
    ['radio', 'fields', 'Radio button', 'radio', 3, 1, 'Opzione', { field: true }],
    ['toggle', 'fields', 'Toggle', 'toggle', 3, 1, 'Abilitato', { field: true }],
    ['range', 'fields', 'Slider', 'range', 4, 1, 'Valore', { field: true }],

    ['table', 'data', 'Tabella', 'table', 12, 6, ''],
    ['tree', 'data', 'Tree', 'tree', 4, 6, 'Nodo'],

    ['image', 'media', 'Immagine', 'image', 3, 4, ''],
    ['video', 'media', 'Video', 'video', 4, 4, ''],
    ['icon', 'media', 'Icona', 'icon', 1, 1, ''],
  ];

  // Testo d'esempio delle tessere della libreria: breve, da riconoscere il componente a colpo d'occhio.
  // Nei campi è il segnaposto dentro il riquadro.
  const SAMPLES = {
    section: 'Sezione', form: 'Form', fieldset: 'Gruppo di campi', card: 'Card', box: 'Riquadro',
    header: 'Header', footer: 'Footer', nav: 'Home · Ordini', sidebar: 'Menu', modal: 'Titolo',
    tabs: 'Tab 1 · Tab 2', separator: '', content: 'Blocco',
    heading: 'Titolo', text: 'Testo', label: 'Etichetta', link: 'Link', list: 'Voce', badge: 'Nuovo', alert: 'Attenzione',
    button: 'Salva', 'icon-button': '', 'button-group': 'Salva · Annulla', menu: 'Azioni',
    breadcrumb: 'Home › Ordini', pagination: '',
    'input-text': 'Testo', 'input-number': '0,00', 'input-date': 'gg/mm/aaaa', 'input-time': 'hh:mm',
    'input-datetime': 'gg/mm hh:mm', 'input-email': 'nome@ente.it', 'input-password': '', 'input-tel': '070…',
    'input-url': 'https://…', 'input-search': 'Cerca…', 'input-file': '', lookup: 'Codice',
    select: 'Seleziona…', multiselect: '', textarea: '', checkbox: 'Attivo', radio: 'Opzione', toggle: 'Attivo',
    range: '', table: 'Codice · Descrizione', tree: 'Nodo', image: '', video: '', icon: '',
  };

  const TYPES = ROWS.map(([type, category, name, draw, w, h, text, options = {}]) => ({ type, category, name, draw, w, h, text, sample: SAMPLES[type] ?? '', ...options }));
  const BY_TYPE = Object.fromEntries(TYPES.map((entry) => [entry.type, entry]));

  // Tipo predefinito dal tag, per i blocchi senza `type` (per esempio quelli scritti da Claude).
  const TAG_TYPES = {
    h1: 'heading', h2: 'heading', h3: 'heading', h4: 'heading', h5: 'heading', h6: 'heading',
    p: 'text', blockquote: 'text', pre: 'text', span: 'text', label: 'label',
    a: 'link', button: 'button', input: 'input-text', textarea: 'textarea', select: 'select',
    img: 'image', picture: 'image', svg: 'image', canvas: 'image', figure: 'image',
    video: 'video', iframe: 'video', audio: 'video',
    ul: 'list', ol: 'list', table: 'table', nav: 'nav', form: 'form', fieldset: 'fieldset',
    header: 'header', footer: 'footer', aside: 'sidebar', dialog: 'modal', section: 'section',
  };

  // Il vecchio campo `kind` e le parti della prima versione.
  const ALIASES = { input: 'input-text', button: 'button', image: 'image', video: 'video', heading: 'heading', text: 'text', link: 'link', box: 'box' };

  // Tag HTML da usare per un elemento che nasce nel mockup.
  const TYPE_TAGS = {
    heading: 'h3', text: 'p', label: 'label', link: 'a', list: 'ul', badge: 'span', alert: 'div',
    button: 'button', 'icon-button': 'button', 'button-group': 'div', menu: 'button', breadcrumb: 'nav', pagination: 'nav',
    textarea: 'textarea', select: 'select', multiselect: 'select', lookup: 'input',
    table: 'table', tree: 'ul', image: 'img', video: 'video', icon: 'svg',
    section: 'section', form: 'form', fieldset: 'fieldset', card: 'article', box: 'div', header: 'header', footer: 'footer',
    nav: 'nav', sidebar: 'aside', modal: 'dialog', tabs: 'div', separator: 'hr', content: 'div',
  };

  const get = (type) => BY_TYPE[type] ?? BY_TYPE[ALIASES[type]] ?? null;

  function resolve(block) {
    if (block.type && BY_TYPE[block.type]) return block.type;
    if (block.type && ALIASES[block.type]) return ALIASES[block.type];
    if (block.kind && ALIASES[block.kind]) return ALIASES[block.kind];
    if (block.children?.length || block.container) return TAG_TYPES[block.tag] && get(TAG_TYPES[block.tag])?.container ? TAG_TYPES[block.tag] : 'section';
    return TAG_TYPES[block.tag] ?? 'content';
  }

  const tagOf = (type) => TYPE_TAGS[type] ?? (type.startsWith('input-') ? 'input' : type === 'checkbox' || type === 'radio' || type === 'toggle' || type === 'range' ? 'input' : 'div');

  return { CATEGORIES, TYPES, get, resolve, tagOf };
})();
