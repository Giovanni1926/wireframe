// Gira dentro la pagina: va passato intero a javascript_tool.
// Legge l'HTML reso, senza conoscere il framework, e restituisce i dati del wireframe.
// Apre sempre il blocco più grande finché non esaurisce il limite di blocchi.
(async () => {
  const COLUMNS = 12;
  const BLOCK_LIMIT = 40;
  const MAX_ROWS = 80;
  const MIN_ROW_PX = 24;
  const MIN_WIDTH = 24;
  const MIN_HEIGHT = 12;
  const MIN_OPEN_HEIGHT = 64;
  const REPEAT_FROM = 6;
  const PAGE_CONTAINER_RATIO = 0.6;
  const LABEL_LENGTH = 40;
  const SCROLL_STEPS = 24;
  const SCROLL_PAUSE_MS = 40;
  const PARTS_PER_BLOCK = 14;
  const PARTS_TOTAL = 140;
  const PART_TEXT_LENGTH = 32;
  const MIN_PART_PX = 4;
  const DARK_BELOW = 0.4;
  const LIGHT_ABOVE = 0.7;

  const SKIPPED = new Set(['script', 'style', 'noscript', 'template', 'link', 'meta', 'base', 'title', 'head', 'br', 'hr', 'wbr']);
  const WRAPPERS = new Set(['div', 'span', 'body', 'center']);
  const MEDIA = new Set(['img', 'picture', 'video', 'audio', 'canvas', 'iframe', 'svg']);
  const HEADINGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']);
  const LEAVES = new Set([...MEDIA, ...HEADINGS, 'p', 'button', 'a', 'input', 'textarea', 'select', 'label', 'table', 'figure', 'blockquote', 'pre', 'nav']);
  // Questi blocchi si disegnano dal solo tag: non serve descriverne il contenuto.
  const DRAWN_FROM_TAG = new Set([...MEDIA, ...HEADINGS, 'p', 'button', 'input', 'textarea', 'select', 'table', 'blockquote', 'pre']);
  const BUTTON_INPUTS = new Set(['button', 'submit', 'reset']);
  const RICH_CONTENT = 'img, picture, video, h1, h2, h3, h4, h5, h6, p';
  const FIELDS = 'input, select, textarea, button, img, picture, video, canvas, iframe, svg';

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

  function rectOf(element) {
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
      if (SKIPPED.has(child.localName)) return [];
      const style = getComputedStyle(child);
      if (style.display === 'contents') return visibleChildren(child);
      if (isSkipLink(child) || isDecorative(child, style)) return [];
      return rectOf(child) ? [child] : [];
    });
  }

  const isWrapper = (element) => WRAPPERS.has(element.localName) || element.localName.includes('-');

  // Salta i contenitori anonimi con un solo figlio, come #root o #__next.
  function unwrap(element) {
    let current = element;
    while (isWrapper(current)) {
      const children = visibleChildren(current);
      if (children.length !== 1) break;
      [current] = children;
    }
    return current;
  }

  function childrenOf(element) {
    let children = visibleChildren(element);
    while (children.length === 1 && !LEAVES.has(children[0].localName)) {
      children = visibleChildren(children[0]);
    }
    return children;
  }

  function labelOf(element) {
    const heading = element.matches('h1, h2, h3, h4, h5, h6') ? null : element.querySelector('h1, h2, h3, h4');
    const firstLine = element.innerText?.split('\n').find((line) => clean(line));
    const text = [
      element.getAttribute('aria-label'),
      heading?.innerText,
      element.getAttribute('alt'),
      element.getAttribute('title'),
      element.getAttribute('placeholder'),
      firstLine,
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

  function partKind(element) {
    const tag = element.localName;
    const role = element.getAttribute('role');

    if (HEADINGS.has(tag) || role === 'heading') return 'heading';
    if (tag === 'video' || tag === 'iframe' || tag === 'audio') return 'video';
    if (MEDIA.has(tag)) return 'image';
    if (tag === 'button' || role === 'button') return 'button';
    if (tag === 'input') return BUTTON_INPUTS.has(element.type) ? 'button' : 'input';
    if (tag === 'textarea' || tag === 'select') return 'input';
    if (tag === 'a' && !element.querySelector(RICH_CONTENT)) return hasSurface(element) ? 'button' : 'link';
    if (getComputedStyle(element).backgroundImage.includes('url(') && !clean(element.textContent)) return 'image';
    if (ownText(element).length > 0 && !element.querySelector(FIELDS)) return hasSurface(element) ? 'box' : 'text';
    return null;
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
        add(kind, rectOf(current), kind === 'image' || kind === 'video' ? '' : labelOf(current));
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
    const counts = new Map();
    for (const child of children) {
      const key = signature(child);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Math.max(...counts.values()) >= children.length * 0.8;
  }

  const isInlineOnly = (children) =>
    children.every((child) => getComputedStyle(child).display.startsWith('inline') && !MEDIA.has(child.localName));

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
    rect.height < MIN_OPEN_HEIGHT || (rect.height < window.innerHeight * 0.3 && rect.width < pageWidth / 2);

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
  const queue = [...topLevel];

  while (queue.length > 0) {
    queue.sort((a, b) => b.area - a.area);
    const node = queue.shift();
    if (LEAVES.has(node.element.localName) || isSmall(node.rect)) continue;

    const children = childrenOf(node.element);
    if (children.length < 2 || isInlineOnly(children)) continue;
    if (isRepeated(children)) {
      node.repeat = children.length;
      continue;
    }

    const nodes = children.map(makeNode).filter(Boolean);
    if (nodes.length < 2) continue;
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

  // Il limite si divide tra i blocchi, così anche quelli in fondo alla pagina hanno il disegno.
  const drawnBlocks = allNodes(topLevel).filter((node) => node.children.length === 0 && !DRAWN_FROM_TAG.has(node.element.localName));
  const partLimit = Math.min(PARTS_PER_BLOCK, Math.floor(PARTS_TOTAL / Math.max(1, drawnBlocks.length)));

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

    const { position } = getComputedStyle(element);
    if (position === 'fixed' || position === 'sticky') block.fixed = true;
    if (node.repeat) block.repeat = node.repeat;
    if (isOnDark(element)) block.tone = 'dark';

    if (node.children.length > 0) {
      block.children = node.children.map((child) => toBlock(child, { left, top, right }));
    } else if (!DRAWN_FROM_TAG.has(tag)) {
      const kind = partKind(element);
      if (kind === 'button' || kind === 'image') block.kind = kind;
      // Un elenco più lungo del limite resterebbe disegnato a metà: meglio la sua griglia di caselle.
      else if (kind !== 'link' && node.repeat <= partLimit) {
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
    width: pageWidth,
    rowPx,
    count: total,
    truncated,
    overlays,
    blocks,
  };
})();
