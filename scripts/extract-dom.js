// Gira dentro la pagina: va passato intero a javascript_tool.
// Legge l'HTML reso, senza conoscere il framework, e restituisce i dati del wireframe.
// Apre sempre il blocco più grande finché non esaurisce il limite di blocchi.
// Dei campi riporta anche required, disabled, readonly e i vincoli dichiarati negli
// attributi (minlength, maxlength, min, max, step, pattern), mai il loro valore.
//
// Granularità: anteporre al testo dello script
//   window.WF_OPTIONS = { granularity: 'sezioni' | 'blocchi' | 'elementi' };
// Senza, vale 'blocchi'.
(async () => {
  const GRANULARITY = ['sezioni', 'blocchi', 'elementi'].includes(globalThis.WF_OPTIONS?.granularity)
    ? globalThis.WF_OPTIONS.granularity
    : 'blocchi';
  const FINE = GRANULARITY === 'elementi';
  const COARSE = GRANULARITY === 'sezioni';

  const COLUMNS = FINE ? 24 : 12;
  const BLOCK_LIMIT = FINE ? 220 : 40;
  const MAX_ROWS = FINE ? 220 : 80;
  const MIN_ROW_PX = FINE ? 16 : 24;
  const MIN_WIDTH = FINE ? 12 : 24;
  const MIN_HEIGHT = FINE ? 10 : 12;
  const MIN_OPEN_HEIGHT = 64;
  const REPEAT_FROM = 6;
  const PAGE_CONTAINER_RATIO = 0.6;
  const LABEL_LENGTH = 80;
  const SCROLL_STEPS = 24;
  const SCROLL_PAUSE_MS = 40;
  const PARTS_PER_BLOCK = COARSE ? 30 : 14;
  const PARTS_TOTAL = COARSE ? 220 : 140;
  const PART_TEXT_LENGTH = 60;
  const MIN_PART_PX = 4;
  const DARK_BELOW = 0.4;
  const LIGHT_ABOVE = 0.7;
  const ICON_MAX_PX = 40;
  const LABEL_REACH_PX = 240;

  const SKIPPED = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'base', 'title', 'head', 'br', 'hr', 'wbr']);
  const WRAPPERS = new Set(['div', 'span', 'body', 'center']);
  const MEDIA = new Set(['img', 'picture', 'video', 'audio', 'canvas', 'iframe', 'svg']);
  const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  const FIELD_TAGS = new Set(['input', 'select', 'textarea']);
  const LEAVES = new Set([...MEDIA, ...HEADINGS, 'p', 'button', 'a', 'input', 'textarea', 'select', 'label', 'table', 'figure', 'blockquote', 'pre', 'nav']);
  // Alla massima granularità si apre anche la navigazione: ogni link diventa un blocco.
  const FINE_LEAVES = new Set([...MEDIA, ...HEADINGS, 'p', 'button', 'a', 'input', 'textarea', 'select', 'table', 'blockquote', 'pre']);
  const BUTTON_INPUTS = new Set(['button', 'submit', 'reset', 'image']);
  const RICH_CONTENT = 'img, picture, video, h1, h2, h3, h4, h5, h6, p';
  const FIELDS = 'input, select, textarea, button, img, picture, video, canvas, iframe, svg';
  const INPUT_TYPES = {
    text: 'input-text', password: 'input-password', email: 'input-email', number: 'input-number',
    date: 'input-date', month: 'input-date', week: 'input-date', time: 'input-time', 'datetime-local': 'input-datetime',
    tel: 'input-tel', url: 'input-url', search: 'input-search', file: 'input-file', range: 'range',
    checkbox: 'checkbox', radio: 'radio', color: 'input-text',
  };
  const TEXT_INPUTS = new Set(['input-text', 'input-number', 'input-search', 'input-tel']);
  const LOOKUP_WORDS = /cerca|ricerca|search|lookup|seleziona|scegli|find|zoom|lente|elenco|^\s*(\.\.\.|…)\s*$/i;
  // Questi tipi si disegnano da soli: non serve descriverne il contenuto con `parts`.
  const ATOMIC = new Set([
    'heading', 'text', 'label', 'link', 'button', 'icon-button', 'image', 'video', 'icon', 'table',
    'input-text', 'input-password', 'input-email', 'input-number', 'input-date', 'input-time', 'input-datetime',
    'input-tel', 'input-url', 'input-search', 'input-file', 'range', 'textarea', 'select', 'multiselect',
    'checkbox', 'radio', 'toggle', 'lookup',
  ]);
  const CONTAINER_TYPES = { form: 'form', fieldset: 'fieldset', nav: 'nav', header: 'header', footer: 'footer', aside: 'sidebar', dialog: 'modal', ul: 'list', ol: 'list' };

  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const clean = (text) => (text ?? '').replace(/\s+/g, ' ').trim();
  const shorten = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);
  const scrollToY = (top) => window.scrollTo({ top, behavior: 'instant' });

  // Scorre la pagina una volta, per far comparire i contenuti caricati allo scroll.
  const startY = window.scrollY;
  const scrollableHeight = document.documentElement.scrollHeight;
  for (let step = 1; step <= SCROLL_STEPS; step += 1) {
    scrollToY((scrollableHeight * step) / SCROLL_STEPS);
    await pause(SCROLL_PAUSE_MS);
  }
  scrollToY(0);
  await pause(SCROLL_PAUSE_MS * 3);

  const pageWidth = document.documentElement.clientWidth;

  function plainRect(element) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return null;

    const box = element.getBoundingClientRect();
    const left = Math.max(0, box.left);
    const right = Math.min(pageWidth, box.right);
    const top = box.top + window.scrollY;
    const bottom = box.bottom + window.scrollY;
    if (right - left < MIN_WIDTH || box.height < MIN_HEIGHT || bottom <= 0) return null;

    return { left, right, top, bottom, width: right - left, height: box.height };
  }

  function union(rects) {
    const left = Math.min(...rects.map((rect) => rect.left));
    const right = Math.max(...rects.map((rect) => rect.right));
    const top = Math.min(...rects.map((rect) => rect.top));
    const bottom = Math.max(...rects.map((rect) => rect.bottom));
    return { left, right, top, bottom, width: right - left, height: bottom - top };
  }

  // Un campo e ciò che lo accompagna (etichetta esterna, bottone del lookup) sono un'unità sola.
  const companions = new Map();
  const absorbed = new Set();

  // Visibile anche se piccolo, come una casella di spunta: conta con la sua etichetta.
  function visibleBox(element) {
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    const box = element.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;
    const top = box.top + window.scrollY;
    return { left: box.left, right: box.right, top, bottom: top + box.height, width: box.width, height: box.height };
  }

  function rectOf(element) {
    if (!companions.has(element)) return plainRect(element);
    const own = visibleBox(element);
    if (!own) return null;
    const whole = union([own, ...companions.get(element).map(visibleBox).filter(Boolean)]);
    return whole.width >= MIN_WIDTH && whole.height >= MIN_HEIGHT ? whole : null;
  }

  function isSkipLink(element) {
    if (element.localName !== 'a') return false;
    const href = element.getAttribute('href') ?? '';
    return href.startsWith('#') && /skip|salta|vai al|jump to/i.test(element.textContent);
  }

  function isDecorative(element, style) {
    if (element.getAttribute('aria-hidden') === 'true') return true;
    if (style.position !== 'absolute' && style.position !== 'fixed') return false;
    const hasMedia = MEDIA.has(element.localName) || element.querySelector('img, picture, video, canvas, svg, iframe');
    return !clean(element.textContent) && !hasMedia;
  }

  function visibleChildren(element) {
    const shadow = element.shadowRoot ? [...element.shadowRoot.children] : [];
    return [...shadow, ...element.children].flatMap((child) => {
      if (SKIPPED.has(child.localName) || absorbed.has(child)) return [];
      if (child.localName === 'input' && child.type === 'hidden') return [];
      const style = getComputedStyle(child);
      if (style.display === 'contents') return visibleChildren(child);
      if (isSkipLink(child) || isDecorative(child, style)) return [];
      return rectOf(child) ? [child] : [];
    });
  }

  const isWrapper = (element) => WRAPPERS.has(element.localName) || element.localName.includes('-');
  const leaves = FINE ? FINE_LEAVES : LEAVES;

  // Salta i contenitori anonimi con un solo figlio, come #root o #__next.
  function unwrap(element) {
    let current = element;
    while (isWrapper(current) && !isUnit(current)) {
      const children = visibleChildren(current);
      if (children.length !== 1) break;
      [current] = children;
    }
    return current;
  }

  function childrenOf(element) {
    let children = visibleChildren(element);
    while (children.length === 1 && !leaves.has(children[0].localName) && !isUnit(children[0])) {
      children = visibleChildren(children[0]);
    }
    return children;
  }

  const fieldIn = (element) => (FIELD_TAGS.has(element.localName) ? element : element.querySelector('input:not([type=hidden]), select, textarea'));

  function fieldLabel(field) {
    const label = field.labels?.[0];
    if (!label) return '';
    // Il testo dell'etichetta senza il valore dei campi che contiene.
    const copy = label.cloneNode(true);
    copy.querySelectorAll('input, select, textarea, option').forEach((node) => node.remove());
    return clean(copy.textContent);
  }

  function labelOf(element) {
    const field = FIELD_TAGS.has(element.localName) ? element : element.localName === 'label' ? fieldIn(element) : null;
    const heading = element.matches('h1, h2, h3, h4, h5, h6') ? null : element.querySelector('h1, h2, h3, h4');
    const firstLine = element.innerText?.split('\n').find((line) => clean(line));
    const text = [
      field ? fieldLabel(field) : '',
      element.getAttribute('aria-label'),
      field?.getAttribute('aria-label'),
      heading?.innerText,
      element.getAttribute('alt'),
      element.getAttribute('title'),
      element.getAttribute('placeholder'),
      field?.getAttribute('placeholder'),
      field ? '' : firstLine,
      element.localName === 'input' && BUTTON_INPUTS.has(element.type) ? element.value : '',
    ].map(clean).find(Boolean) ?? '';
    return shorten(text, LABEL_LENGTH);
  }

  function selectorOf(element) {
    const parts = [];
    for (let node = element; node && node !== document.body && parts.length < 5; node = node.parentElement) {
      const hasStableId = node.id && !/\d{3,}|:/.test(node.id);
      if (hasStableId && document.querySelectorAll(`#${CSS.escape(node.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(node.id)}`);
        break;
      }
      const sameTag = [...(node.parentElement?.children ?? [])].filter((item) => item.localName === node.localName);
      parts.unshift(sameTag.length > 1 ? `${node.localName}:nth-of-type(${sameTag.indexOf(node) + 1})` : node.localName);
    }
    return parts.join(' > ');
  }

  const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

  // Passa dal canvas per leggere qualsiasi colore CSS, anche oklch.
  function rgbaOf(color) {
    probe.clearRect(0, 0, 1, 1);
    probe.fillStyle = color;
    probe.fillRect(0, 0, 1, 1);
    return probe.getImageData(0, 0, 1, 1).data;
  }

  const isOpaque = (color) => rgbaOf(color)[3] >= 128;
  const brightnessOf = (color) => {
    const [red, green, blue] = rgbaOf(color);
    return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  };
  const parentOf = (node) => node.parentElement ?? node.getRootNode().host ?? null;

  // Il blocco è scuro se lo è la prima superficie dietro di lui. Il fondo di
  // un'immagine o di una sfumatura non si può leggere: lì decide il colore del testo.
  function isOnDark(element) {
    for (let node = element; node; node = parentOf(node)) {
      const { backgroundColor, backgroundImage } = getComputedStyle(node);
      if (isOpaque(backgroundColor)) return brightnessOf(backgroundColor) < DARK_BELOW;
      if (backgroundImage !== 'none') return brightnessOf(getComputedStyle(element).color) > LIGHT_ABOVE;
    }
    return false;
  }

  function backdropOf(element) {
    for (let node = parentOf(element); node; node = parentOf(node)) {
      const { backgroundColor } = getComputedStyle(node);
      if (isOpaque(backgroundColor)) return backgroundColor;
    }
    return 'rgb(255, 255, 255)';
  }

  // Un fondo uguale a quello dietro non si vede: disegnarlo aggiungerebbe un riquadro finto.
  function hasSurface(element) {
    const style = getComputedStyle(element);
    const framed = parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderLeftWidth) > 0 && isOpaque(style.borderTopColor);
    return framed || (isOpaque(style.backgroundColor) && style.backgroundColor !== backdropOf(element));
  }

  const ownText = (element) =>
    [...element.childNodes].filter((node) => node.nodeType === Node.TEXT_NODE && clean(node.textContent));

  // Solo icona: nessun testo, o un simbolo come ‹ o 🔍. Un numero di pagina è testo.
  const isIconOnly = (element) => {
    const text = clean(element.innerText ?? element.value ?? '');
    return text.length === 0 || (text.length <= 2 && !/[\p{L}\p{N}]/u.test(text));
  };

  function isAction(element) {
    const tag = element.localName;
    if (tag === 'button' || element.getAttribute('role') === 'button') return true;
    if (tag === 'input') return BUTTON_INPUTS.has(element.type);
    return tag === 'a' && !element.querySelector(RICH_CONTENT) && hasSurface(element);
  }

  // Il bottone del lookup: subito dopo il campo, solo icona o con un testo come "cerca".
  function lookupButtonOf(field) {
    const candidates = [field.nextElementSibling, field.nextElementSibling?.nextElementSibling, field.parentElement?.nextElementSibling];
    for (const candidate of candidates) {
      if (!candidate || !plainRect(candidate)) continue;
      const isControl = candidate.matches('button, a, [role=button], input[type=button], input[type=image], img, svg');
      const wrapsControl = candidate.children.length === 1 && candidate.firstElementChild.matches('button, a, [role=button], img, svg');
      if (!isControl && !wrapsControl) continue;
      const hint = [candidate.getAttribute('title'), candidate.getAttribute('aria-label'), candidate.getAttribute('alt'), candidate.innerText, candidate.value, candidate.querySelector('[title], [alt]')?.getAttribute('title') ?? candidate.querySelector('[alt]')?.getAttribute('alt')]
        .map(clean)
        .join(' ');
      if (isIconOnly(candidate) || LOOKUP_WORDS.test(hint)) return candidate;
    }
    return null;
  }

  function baseFieldType(field) {
    if (field.getAttribute('role') === 'switch') return 'toggle';
    if (field.localName === 'select') return field.multiple ? 'multiselect' : 'select';
    if (field.localName === 'textarea') return 'textarea';
    if (BUTTON_INPUTS.has(field.type)) return 'button';
    return INPUT_TYPES[field.type] ?? 'input-text';
  }

  function fieldType(field) {
    const base = baseFieldType(field);
    return TEXT_INPUTS.has(base) && companions.get(field)?.some((item) => !item.matches('label')) ? 'lookup' : base;
  }

  // Prepara le unità: etichette esterne e bottoni dei lookup diventano parte del loro campo.
  for (const field of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
    if (!visibleBox(field)) continue;
    const extra = [];
    const base = baseFieldType(field);
    if (TEXT_INPUTS.has(base)) {
      const button = lookupButtonOf(field);
      if (button) extra.push(button);
    }
    const label = field.labels?.[0];
    if (label && !label.contains(field) && visibleBox(label)) {
      const labelRect = visibleBox(label);
      const fieldRect = visibleBox(field);
      const distance = Math.max(0, labelRect.left - fieldRect.right, fieldRect.left - labelRect.right, labelRect.top - fieldRect.bottom, fieldRect.top - labelRect.bottom);
      if (distance <= LABEL_REACH_PX && !label.querySelector('input, select, textarea, button')) extra.push(label);
    }
    if (extra.length === 0) continue;
    // Un'etichetta che avvolge il campo è già l'unità: il bottone del lookup si aggancia a lei.
    const host = field.closest('label') ?? field;
    companions.set(host, extra.filter((item) => item !== host));
    if (host !== field) companions.set(field, extra);
    extra.forEach((item) => absorbed.add(item));
  }

  function isButtonGroup(element) {
    const role = element.getAttribute('role');
    const children = [...element.children].filter((child) => plainRect(child));
    const actions = children.filter(isAction);
    if ((role === 'group' || role === 'toolbar' || /btn-group|button-group|toolbar|buttons|pulsanti|azioni/i.test(element.className)) && actions.length >= 2) return true;
    return children.length >= 2 && actions.length === children.length;
  }

  // Il tipo di un elemento secondo il catalogo. Null se è un contenitore da aprire.
  function typeOf(element, { containers = true } = {}) {
    const tag = element.localName;
    const role = element.getAttribute('role');

    if (HEADINGS.has(tag) || role === 'heading') return 'heading';
    if (role === 'switch') return 'toggle';
    if (role === 'checkbox') return 'checkbox';
    if (role === 'radio') return 'radio';
    if (role === 'combobox' || role === 'listbox') return 'select';
    if (FIELD_TAGS.has(tag)) return fieldType(element);
    if (tag === 'label') {
      const field = fieldIn(element);
      if (field) return fieldType(field);
    }
    if (tag === 'video' || tag === 'iframe' || tag === 'audio') return 'video';
    if (MEDIA.has(tag)) {
      const rect = plainRect(element);
      return rect && rect.width <= ICON_MAX_PX && rect.height <= ICON_MAX_PX ? 'icon' : 'image';
    }
    if (tag === 'button' || role === 'button' || role === 'tab' || role === 'menuitem') return isIconOnly(element) ? 'icon-button' : 'button';
    if (tag === 'a' && !element.querySelector(RICH_CONTENT)) {
      if (!hasSurface(element)) return 'link';
      return isIconOnly(element) ? 'icon-button' : 'button';
    }
    if (tag === 'table' || role === 'grid' || role === 'table') return 'table';
    if (role === 'tree') return 'tree';
    if (role === 'alert' || role === 'status') return 'alert';
    if (containers) {
      if (role === 'tablist') return 'tabs';
      if (role === 'dialog' || role === 'alertdialog') return 'modal';
      if (tag === 'nav' || role === 'navigation') {
        const hint = `${element.getAttribute('aria-label') ?? ''} ${element.className}`;
        if (/pagin|pager|pagine/i.test(hint)) return 'pagination';
        if (/breadcrumb|percorso|briciole/i.test(hint) || /[›»]/.test(element.textContent)) return 'breadcrumb';
        return 'nav';
      }
      if (/pagination|pager/i.test(element.className)) return 'pagination';
      if (CONTAINER_TYPES[tag]) return CONTAINER_TYPES[tag];
      if (isButtonGroup(element)) return 'button-group';
    }
    if (getComputedStyle(element).backgroundImage.includes('url(') && !clean(element.textContent)) return 'image';
    if (ownText(element).length > 0 && !element.querySelector(FIELDS)) return hasSurface(element) ? 'box' : 'text';
    return null;
  }

  // Un'unità non si apre: un campo con la sua etichetta, un bottone, un link.
  // Il testo semplice non conta: un div con testo e figli va ancora aperto.
  const isUnit = (element) => {
    const type = typeOf(element, { containers: false });
    return Boolean(type) && type !== 'text' && ATOMIC.has(type);
  };

  // Le parti sono solo elementi atomici: i contenitori si aprono per mostrarne il contenuto.
  function partKind(element) {
    const type = typeOf(element, { containers: false });
    return type && (ATOMIC.has(type) || type === 'box' || type === 'alert') ? type : null;
  }

  function textRect(node) {
    const range = document.createRange();
    range.selectNodeContents(node);
    const box = range.getBoundingClientRect();
    return { left: box.left, right: box.right, top: box.top + window.scrollY, bottom: box.bottom + window.scrollY };
  }

  // Descrive cosa si vede dentro un blocco: [tipo, x, y, w, h, testo], in percentuale
  // del blocco. Il formato è stretto perché Claude riscrive questi dati nel passo 4.
  // Non legge il valore dei campi, che può contenere dati dell'utente.
  function partsOf({ element, rect }, limit) {
    const parts = [];
    const percent = (px, size) => Math.round((px / size) * 100);

    function add(kind, box, text) {
      if (!box) return;
      const left = Math.max(box.left, rect.left);
      const top = Math.max(box.top, rect.top);
      const width = Math.min(box.right, rect.right) - left;
      const height = Math.min(box.bottom, rect.bottom) - top;
      if (width < MIN_PART_PX || height < MIN_PART_PX) return;

      const part = [kind, percent(left - rect.left, rect.width), percent(top - rect.top, rect.height), percent(width, rect.width), percent(height, rect.height)];
      parts.push(text ? [...part, shorten(text, PART_TEXT_LENGTH)] : part);
    }

    // Scende per livelli: se il limite arriva prima, ogni card ha almeno il suo riquadro.
    const queue = [element];
    while (queue.length > 0 && parts.length < limit) {
      const current = queue.shift();
      const kind = current === element ? null : partKind(current);
      if (kind) {
        add(kind, rectOf(current), kind === 'image' || kind === 'video' || kind === 'icon' ? '' : labelOf(current));
        continue;
      }
      if (current !== element && hasSurface(current)) add('box', rectOf(current));
      for (const node of ownText(current)) add('text', textRect(node), clean(node.textContent));
      queue.push(...visibleChildren(current));
    }
    return parts;
  }

  const signature = (element) => `${element.localName}.${[...element.classList].sort().join('.')}`;

  function isRepeated(children) {
    if (children.length < REPEAT_FROM) return false;
    // Una barra di bottoni resta apribile: ogni tasto si deve poter spostare.
    if (FINE && children.every(isAction)) return false;
    const counts = new Map();
    for (const child of children) {
      const key = signature(child);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Math.max(...counts.values()) >= children.length * 0.8;
  }

  const isInlineOnly = (element, children) => {
    // Alla massima granularità si aprono anche bottoni e campi in linea, salvo il testo misto.
    if (FINE) return ownText(element).length > 0;
    return children.every((child) => getComputedStyle(child).display.startsWith('inline') && !MEDIA.has(child.localName));
  };

  // Un elemento fisso resta nel wireframe solo se è una barra in alto o una colonna laterale.
  function isOverlay(element, rect) {
    if (getComputedStyle(element).position !== 'fixed') return false;
    const isTopBar = rect.top <= 8 && rect.width >= pageWidth / 2;
    const isSideColumn = rect.height >= window.innerHeight * 0.6;
    return !isTopBar && !isSideColumn;
  }

  function makeNode(element) {
    const target = unwrap(element);
    const rect = rectOf(target);
    if (!rect) return null;
    return { element: target, rect, area: rect.width * rect.height, children: [], repeat: 0 };
  }

  const overlays = [];

  function withoutOverlays(nodes) {
    return nodes.filter((node) => {
      if (!isOverlay(node.element, node.rect)) return true;
      overlays.push({ tag: node.element.localName, label: labelOf(node.element), selector: selectorOf(node.element) });
      return false;
    });
  }

  const nodesIn = (element) => withoutOverlays(childrenOf(element).map(makeNode).filter(Boolean));

  // Un blocco piccolo è un'unità di contenuto, come una card: si sposta tutto insieme.
  const isSmall = (rect) =>
    !FINE && (rect.height < MIN_OPEN_HEIGHT || (rect.height < window.innerHeight * 0.3 && rect.width < pageWidth / 2));

  // Un blocco che occupa quasi tutta la pagina, come main, è un contenitore e non
  // una sezione: si parte dai suoi figli, così le sezioni si riordinano al primo livello.
  function openPageContainers(nodes) {
    const pageHeight = Math.max(...nodes.map((node) => node.rect.bottom));
    return nodes.flatMap((node) => {
      const isContainer = node.rect.height > pageHeight * PAGE_CONTAINER_RATIO && !LEAVES.has(node.element.localName);
      if (!isContainer || isRepeated(childrenOf(node.element))) return [node];
      const inner = nodesIn(node.element);
      return inner.length >= 2 ? openPageContainers(inner) : [node];
    });
  }

  const topLevel = openPageContainers(nodesIn(document.body));

  let total = topLevel.length;
  let truncated = false;
  // Con 'sezioni' si resta al primo livello: il contenuto è tutto disegno.
  const queue = COARSE ? [] : [...topLevel];

  while (queue.length > 0) {
    queue.sort((a, b) => b.area - a.area);
    const node = queue.shift();
    if (leaves.has(node.element.localName) || isUnit(node.element) || isSmall(node.rect)) continue;

    const children = childrenOf(node.element);
    if (children.length < (FINE ? 1 : 2) || isInlineOnly(node.element, children)) continue;
    if (isRepeated(children)) {
      node.repeat = children.length;
      continue;
    }

    const nodes = children.map(makeNode).filter(Boolean);
    if (nodes.length < (FINE ? 1 : 2)) continue;
    if (total + nodes.length > BLOCK_LIMIT) {
      truncated = true;
      continue;
    }

    node.children = nodes;
    total += nodes.length;
    queue.push(...nodes);
  }

  const allNodes = (nodes) => nodes.flatMap((node) => [node, ...allNodes(node.children)]);
  const lastPixel = Math.max(...allNodes(topLevel).map((node) => node.rect.bottom));
  const rowPx = Math.max(MIN_ROW_PX, Math.ceil(lastPixel / MAX_ROWS));
  const toColumn = (px) => Math.min(COLUMNS, Math.round((px / pageWidth) * COLUMNS));
  const toRow = (px) => Math.round(px / rowPx);

  const typeOfNode = (node) => typeOf(node.element) ?? undefined;
  // Un div con testo e altri elementi dentro va descritto con le parti, un paragrafo no.
  const drawnByType = (type, element) =>
    ATOMIC.has(type) && !(type === 'text' && !['p', 'blockquote', 'pre'].includes(element.localName) && element.children.length > 0);

  // Il limite si divide tra i blocchi, così anche quelli in fondo alla pagina hanno il disegno.
  const drawnBlocks = allNodes(topLevel).filter((node) => node.children.length === 0 && !drawnByType(typeOfNode(node), node.element));
  const partLimit = Math.min(PARTS_PER_BLOCK, Math.floor(PARTS_TOTAL / Math.max(1, drawnBlocks.length)));

  // Vincoli dichiarati nell'HTML: solo attributi, mai value o defaultValue, che possono contenere dati dell'utente.
  const CONSTRAINED = new Set([
    'input-text', 'input-password', 'input-email', 'input-number', 'input-date', 'input-time', 'input-datetime',
    'input-tel', 'input-url', 'input-search', 'input-file', 'range', 'textarea', 'select', 'multiselect',
    'checkbox', 'radio', 'toggle', 'lookup',
  ]);
  const NUMERIC_TYPES = new Set(['input-number', 'range']);
  const TEMPORAL_TYPES = new Set(['input-date', 'input-time', 'input-datetime']);

  function constraintsOf(field, type) {
    const constraints = {};
    const attribute = (name) => clean(field.getAttribute(name));
    // Il browser riporta -1 quando la lunghezza non è impostata: si legge l'attributo.
    for (const [name, key] of [['minlength', 'minLength'], ['maxlength', 'maxLength']]) {
      const value = Number(attribute(name));
      if (attribute(name) && Number.isInteger(value) && value >= 0) constraints[key] = value;
    }
    for (const key of ['min', 'max']) {
      const text = attribute(key);
      if (!text) continue;
      if (NUMERIC_TYPES.has(type) && Number.isFinite(Number(text))) constraints[key] = Number(text);
      else if (TEMPORAL_TYPES.has(type)) constraints[key] = text;
    }
    // Uno step decimale dice quante cifre dopo la virgola accetta il campo.
    const step = Number(attribute('step'));
    if (NUMERIC_TYPES.has(type) && attribute('step') && attribute('step') !== 'any' && step > 0 && step < 1) {
      let decimals = 0;
      while (decimals < 10 && Math.abs(Math.round(step * 10 ** decimals) - step * 10 ** decimals) > 1e-9) decimals += 1;
      constraints.decimals = decimals;
    }
    const pattern = field.getAttribute('pattern');
    if (pattern) {
      constraints.format = 'regex';
      constraints.pattern = pattern;
    }
    return Object.keys(constraints).length > 0 ? constraints : undefined;
  }

  let nextId = 0;

  function toBlock(node, parent) {
    const { element, rect } = node;
    const left = Math.min(toColumn(rect.left), COLUMNS - 1);
    const right = Math.max(left + 1, toColumn(rect.right));
    const top = toRow(rect.top);
    const bottom = Math.max(top + 1, toRow(rect.bottom));
    const origin = { left: parent?.left ?? 0, top: parent?.top ?? 0, right: parent?.right ?? COLUMNS };

    nextId += 1;
    const tag = element.localName;
    const type = typeOfNode(node);
    const x = Math.max(0, left - origin.left);
    const block = {
      id: `${tag}-${nextId}`,
      tag,
      label: labelOf(element),
      selector: selectorOf(element),
      x,
      y: Math.max(0, top - origin.top),
      w: Math.max(1, Math.min(right, origin.right) - Math.max(left, origin.left)),
      h: bottom - top,
      status: 'existing',
    };
    if (type) block.type = type;

    const field = type && ATOMIC.has(type) ? fieldIn(element) : null;
    if (field?.required || field?.getAttribute('aria-required') === 'true') block.required = true;
    if (field?.disabled || element.disabled || element.getAttribute('aria-disabled') === 'true') block.disabled = true;
    if (field && CONSTRAINED.has(type)) {
      if (field.hasAttribute('readonly') || field.getAttribute('aria-readonly') === 'true' || element.getAttribute('aria-readonly') === 'true') block.readonly = true;
      const constraints = constraintsOf(field, type);
      if (constraints) block.constraints = constraints;
    }

    const { position } = getComputedStyle(element);
    if (position === 'fixed' || position === 'sticky') block.fixed = true;
    if (node.repeat) block.repeat = node.repeat;
    if (isOnDark(element)) block.tone = 'dark';

    if (node.children.length > 0) {
      block.children = node.children.map((child) => toBlock(child, { left, top, right }));
    } else if (!drawnByType(type, element) && type !== 'link') {
      // Un elenco più lungo del limite resterebbe disegnato a metà: meglio la sua griglia di caselle.
      if (node.repeat <= partLimit) {
        const parts = partsOf(node, partLimit);
        if (parts.length > 0) block.parts = parts;
      }
    }
    return block;
  }

  const blocks = topLevel.map((node) => toBlock(node, null));
  scrollToY(startY);

  return {
    page: clean(document.title) || location.pathname,
    source: location.href,
    granularity: GRANULARITY,
    width: pageWidth,
    columns: COLUMNS,
    rowPx,
    count: total,
    truncated,
    overlays,
    blocks,
  };
})();
