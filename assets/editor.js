// Editor del mockup: griglia trascinabile, libreria dei componenti, Inspector e note.
(() => {
  const CATALOG = window.WF_CATALOG;

  const CELL = 28;
  const MARGIN = 2;
  const FREE_ROWS = 8;
  const SAVE_DELAY = 150;
  const SETTLE_DELAY = 60;
  const NOTE_COMMIT_DELAY = 600;
  const PING_EVERY = 3000;
  const MAX_FAILED_PINGS = 3;
  const CLICK_TOLERANCE = 5;
  const QUICK_RESULTS = 8;

  const LABEL_MATCH_LENGTH = 20;
  const TILE_WIDTH = 282;
  const AUTO_WIDEN_PASSES = 4;
  const AUTO_GROW_ROWS = 2;
  // Altezza dell'anteprima secondo l'ingombro del componente: una riga per i campi, di più per tabelle e card.
  const tileHeight = (entry) => (entry.h >= 5 ? 120 : entry.h >= 3 ? 88 : entry.h >= 2 ? 64 : 48);

  const SKETCH = window.WF_SKETCH;
  // Vincoli dei campi: facoltativi, l'editor funziona anche senza constraints.js.
  const CONSTRAINTS = window.WF_CONSTRAINTS ?? null;

  // Zoom della vista: livelli dei pulsanti e delle scorciatoie; "Adatta" può dare valori intermedi.
  const ZOOM_LEVELS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  const MIN_ZOOM = ZOOM_LEVELS[0];
  const MAX_ZOOM = ZOOM_LEVELS.at(-1);
  // Larghezza massima di main al 100% e suo padding orizzontale, come nel CSS.
  const SHEET_MAX = 1440;
  const MAIN_PADDING = 16;
  // Rotella con Ctrl: un passo ogni tanto scorrimento, così il pinch del trackpad non salta livelli.
  const WHEEL_STEP = 40;
  const EXPORT_PIXEL_RATIO = 2;

  const $ = (id) => document.getElementById(id);
  const wf = $('wf');
  const sheet = $('sheet');
  const sheetSketch = $('sheet-sketch');
  const statusEl = $('status');
  const noticeEl = $('notice');
  const undoBtn = $('undo');
  const redoBtn = $('redo');
  const resetBtn = $('reset');
  const themeSelect = $('theme');
  const zoomOutBtn = $('zoom-out');
  const zoomInBtn = $('zoom-in');
  const zoomLevelBtn = $('zoom-level');
  const zoomFitBtn = $('zoom-fit');
  const exportBtn = $('export');

  const meta = new Map();
  const captioned = new Set();
  // Posizioni e proprietà di partenza, per id. Gli elementi nati da "Scomponi" vi entrano quando nascono.
  const baseline = new Map();
  let spec = null;
  let columns = 12;
  let grid = null;
  let initialTree = [];
  let history = [];
  let future = [];
  let touched = new Set();
  let selectedId = null;
  let activeId = null;
  let nextNew = 0;
  let saveTimer = null;
  let settleTimer = null;
  let noteTimer = null;
  let failedPings = 0;
  let unsaved = false;
  let closed = false;
  let pressPoint = null;
  let zoom = 1;
  let wheelDelta = 0;
  let exporting = false;
  // Trascinamento in corso di una tessera della libreria e ultimo punto del puntatore (vedi bindDragIn).
  let dragIn = null;
  let pointer = null;

  // Altezza di riga corrente: la griglia principale e le sezioni la seguono con lo zoom.
  const cellPx = () => Math.round(CELL * zoom);

  // ---------------------------------------------------------------- disegno e tema

  // Suggerimenti dei campi (segnaposto, contatore) da passare al disegno, ricavati dai vincoli.
  function fieldHints(info) {
    return CONSTRAINTS?.hints(info) ?? {};
  }

  function draw(content) {
    const info = meta.get(content.dataset.block);
    const { clientWidth: width, clientHeight: height } = content;
    if (!info || width < 12 || height < 12) return;
    const { kind } = content.parentElement.dataset;
    const section = kind === 'section';
    SKETCH.sketch(content, info, kind, width, height, {
      section,
      caption: section && captioned.has(info.id),
      readonly: Boolean(info.readonly),
      ...fieldHints(info),
    });
  }

  function drawSheet() {
    SKETCH.drawSheet(sheetSketch, sheet.clientWidth, sheet.clientHeight);
  }

  // Un blocco troppo stretto (o basso) per la sua etichetta si allarga finché il testo sta dentro:
  // la chiarezza viene prima delle proporzioni della pagina. Se l'utente stringe il blocco di
  // proposito non si riallarga: lì il testo resta tagliato dentro il blocco.
  // Le sezioni non si toccano: crescono già da sole con il contenuto.
  function autoWiden(onlyIds = null) {
    let changed = false;
    const grown = new Map();
    for (let pass = 0; pass < AUTO_WIDEN_PASSES; pass += 1) {
      let grew = false;
      for (const content of wf.querySelectorAll('.grid-stack-item-content[data-block]')) {
        const id = content.dataset.block;
        if (onlyIds && !onlyIds.has(id)) continue;
        const node = findNode(id);
        if (!node || node.subGrid) continue;
        draw(content);
        const clipped = content.querySelectorAll(':scope > .sk-text > .clipped');
        if (clipped.length === 0) continue;

        // Il disegno segna su ogni testo tagliato quanti px gli mancano in larghezza e in altezza.
        let extraX = 0;
        let extraY = 0;
        for (const span of clipped) {
          extraX = Math.max(extraX, Number(span.dataset.extraX) || 0);
          extraY = Math.max(extraY, Number(span.dataset.extraY) || 0);
        }
        const target = node.grid;
        const limit = target.getColumn();
        const w = extraX > 0 ? Math.min(limit, node.w + Math.ceil((extraX + 8) / target.cellWidth())) : node.w;
        // In larghezza prima; si alza solo quando la riga è già piena o il testo va comunque a capo.
        const wantedRows = w === node.w || extraY > 2 ? Math.max(1, Math.ceil(extraY / target.getCellHeight(true))) : 0;
        // Al massimo AUTO_GROW_ROWS righe in più per blocco: oltre, il testo è un paragrafo e va bene tagliato.
        const grownRows = grown.get(id) ?? 0;
        const rows = Math.min(wantedRows, AUTO_GROW_ROWS - grownRows);
        const h = node.h + Math.max(0, rows);
        grown.set(id, grownRows + Math.max(0, rows));
        if (w === node.w && h === node.h) continue;
        target.update(node.el, { x: Math.min(node.x, limit - w), w, h });
        draw(content);
        grew = true;
        changed = true;
      }
      if (!grew) break;
    }
    if (changed) {
      fitSections(grid);
      paintState();
    }
    return changed;
  }

  function drawBlocks() {
    for (const content of wf.querySelectorAll('.grid-stack-item-content[data-block]')) draw(content);
  }

  // Le tessere usano sempre la penna pulita: devono far riconoscere il componente, non lo stile.
  function drawTile(tile) {
    const entry = CATALOG.get(tile.dataset.type);
    if (!entry) return;
    const info = { type: entry.type, label: entry.sample ?? '', id: entry.type };
    const height = tileHeight(entry);
    tile.style.setProperty('--tile-height', `${height}px`);
    // Componenti stretti (bottone, badge, icona) restano proporzionati invece di allungarsi su tutta la riga.
    const width = Math.min(TILE_WIDTH, Math.max(110, (entry.w / 12) * TILE_WIDTH * 2.2));
    const sketchEl = tile.querySelector('.tile-sketch');
    sketchEl.style.width = `${width}px`;
    SKETCH.sketch(sketchEl, info, entry.draw, width, height, { hand: false, scale: 1 });
  }

  function drawLibrary() {
    for (const tile of document.querySelectorAll('#library .tile')) drawTile(tile);
  }

  // Il tema è una preferenza di vista: si salva con lo stato ma non entra nella cronologia.
  function applyTheme(name) {
    const applied = SKETCH.setTheme(name);
    document.body.dataset.theme = applied;
    themeSelect.value = applied;
    drawSheet();
    drawBlocks();
    drawLibrary();
    return applied;
  }

  // ---------------------------------------------------------------- zoom

  // Niente transform/zoom CSS sul foglio: falserebbero le coordinate del trascinamento di GridStack.
  // Si allarga davvero il foglio (--sheet-width), si alzano le righe e il disegno scala da sé.
  const dockWidth = () => parseFloat(getComputedStyle(document.body).getPropertyValue('--dock-left')) || 0;

  // Spazio per il foglio nella finestra e sua larghezza al 100% (main non supera SHEET_MAX).
  function sheetSpace() {
    const available = document.documentElement.clientWidth - MAIN_PADDING * 2 - dockWidth();
    return { available, base: Math.max(1, Math.min(SHEET_MAX - MAIN_PADDING * 2, available)) };
  }

  function layoutSheet() {
    const root = document.documentElement.style;
    root.setProperty('--zoom', String(zoom));
    document.body.classList.toggle('zoomed', zoom !== 1);
    if (zoom === 1) root.removeProperty('--sheet-width');
    else root.setProperty('--sheet-width', `${Math.round(sheetSpace().base * zoom)}px`);
  }

  function applyZoom(level) {
    const next = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(level) || 1)) * 100) / 100;
    zoom = next;
    SKETCH.setScale(zoom);
    layoutSheet();
    if (grid) {
      grid.cellHeight(cellPx());
      forEachSection(grid, (section) => section.subGrid.cellHeight(cellPx()));
    }
    zoomLevelBtn.textContent = `${Math.round(zoom * 100)}%`;
    zoomOutBtn.disabled = zoom <= MIN_ZOOM;
    zoomInBtn.disabled = zoom >= MAX_ZOOM;
    drawSheet();
    drawBlocks();
    return zoom;
  }

  // Lo zoom è una preferenza di vista, come il tema: si salva con lo stato ma non entra nella cronologia.
  function setZoom(level) {
    const applied = applyZoom(level);
    save();
    return applied;
  }

  // Livello successivo nella direzione data, anche partendo da un valore di "Adatta".
  function stepZoom(direction) {
    const next = direction > 0 ? ZOOM_LEVELS.find((level) => level > zoom + 0.001) : [...ZOOM_LEVELS].reverse().find((level) => level < zoom - 0.001);
    if (next !== undefined) setZoom(next);
  }

  // Al 100% il foglio già si stringe alla finestra: "Adatta" serve a riempire le finestre più larghe.
  function fitZoom() {
    const { available, base } = sheetSpace();
    setZoom(available / base);
  }

  // ---------------------------------------------------------------- esportazione PNG

  const slug = (text) => normalize(text ?? '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pagina';

  // Elementi dell'editor che non devono finire nell'immagine.
  const keepInImage = (node) => !node.classList?.contains('ui-resizable-handle') && !node.classList?.contains('grid-stack-placeholder');

  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = name;
      document.body.append(link);
      link.click();
      link.remove();
    } catch {
      // Browser integrati senza download: l'immagine si apre in una scheda, da salvare a mano.
      window.open(url, '_blank');
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function exportPng() {
    if (exporting || !grid) return false;
    if (!window.htmlToImage) {
      statusEl.textContent = 'Esportazione non disponibile';
      return false;
    }
    exporting = true;
    exportBtn.disabled = true;
    statusEl.textContent = 'Esportazione PNG…';
    // Selezione, maniglie e segnaposto si tolgono; post-it e cartellini di stato restano.
    document.body.classList.add('exporting');
    for (const item of wf.querySelectorAll('.grid-stack-item.selected')) item.classList.remove('selected');
    try {
      const background = getComputedStyle(document.body).getPropertyValue('--page').trim() || '#ffffff';
      const blob = await window.htmlToImage.toBlob(sheet, {
        pixelRatio: EXPORT_PIXEL_RATIO,
        backgroundColor: background,
        width: sheet.scrollWidth,
        height: sheet.scrollHeight,
        // Font di sistema: niente da incorporare, e si evitano richieste inutili.
        skipFonts: true,
        filter: keepInImage,
      });
      if (!blob) throw new Error('immagine vuota');
      downloadBlob(blob, `mockup-${slug(spec?.page)}.png`);
      statusEl.textContent = 'PNG esportato';
      return true;
    } catch (error) {
      console.error('Esportazione PNG non riuscita', error);
      statusEl.textContent = 'Esportazione non riuscita';
      return false;
    } finally {
      document.body.classList.remove('exporting');
      paintState();
      exporting = false;
      exportBtn.disabled = false;
    }
  }

  // Un blocco si ridisegna ogni volta che cambia misura, anche mentre lo si ridimensiona.
  const pens = new ResizeObserver((entries) => {
    for (const entry of entries) draw(entry.target);
  });

  // ---------------------------------------------------------------- dati dei blocchi

  // Il label di una sezione è quasi sempre il suo primo titolo: ripeterlo sopra sarebbe rumore.
  function isShownInside(block, label) {
    const opening = (text) => (text ?? '').slice(0, LABEL_MATCH_LENGTH);
    return (block.children ?? []).some(
      (child) =>
        opening(child.label) === opening(label) ||
        child.parts?.some((part) => opening(part[5]) === opening(label)) ||
        isShownInside(child, label),
    );
  }

  function registerBlocks(blocks) {
    for (const block of blocks) {
      const type = CATALOG.resolve(block);
      const { children, x, y, w, h, kind, container, ...info } = block;
      if (meta.has(block.id)) console.warn(`Blocco duplicato: ${block.id}`);
      meta.set(block.id, { ...info, type });
      if (block.label && !isShownInside(block, block.label)) captioned.add(block.id);
      registerBlocks(children ?? []);
    }
  }

  function loadTree(blocks) {
    meta.clear();
    captioned.clear();
    registerBlocks(blocks);
  }

  function findNode(id, target = grid) {
    for (const node of target.engine.nodes) {
      if (node.id === id) return node;
      const nested = node.subGrid && findNode(id, node.subGrid);
      if (nested) return nested;
    }
    return null;
  }

  function forEachSection(target, callback) {
    for (const node of target.engine.nodes) {
      if (!node.subGrid) continue;
      callback(node);
      forEachSection(node.subGrid, callback);
    }
  }

  // Un blocco entra in una sezione solo se è più stretto di lei o se ci stava
  // già: così le sezioni a tutta larghezza si riordinano invece di annidarsi.
  // I componenti della libreria entrano sempre.
  function canEnter(sectionId, element) {
    if (element.classList?.contains('tile')) return true;
    const block = element.gridstackNode;
    const section = findNode(sectionId);
    if (!block || !section) return false;
    return block.w < section.w || baseline.get(block.id)?.parent === sectionId;
  }

  // Durante il trascinamento una griglia annidata crescerebbe seguendo il mouse,
  // che così non uscirebbe mai dalla sezione: va bloccata fino al rilascio.
  // updateOptions({ maxRow: 0 }) compatterebbe la sezione: il limite va scritto a mano.
  function setRowLimit(subGrid, rows) {
    subGrid.opts.maxRow = rows;
    subGrid.engine.maxRow = rows;
  }

  // Il margine pari all'altezza del blocco lascia spazio per spingere gli altri.
  function capSections(activeNode) {
    forEachSection(grid, (section) => {
      setRowLimit(section.subGrid, Math.max(1, section.h - 1) + activeNode.h);
    });
  }

  function uncapSections() {
    forEachSection(grid, (section) => setRowLimit(section.subGrid, 0));
  }

  function toWidget(block) {
    const children = block.children ?? [];
    const widget = { id: block.id, x: block.x, y: block.y, w: block.w, h: block.h };
    if (children.length > 0 || block.container) {
      widget.subGridOpts = {
        column: 'auto',
        cellHeight: cellPx(),
        margin: MARGIN,
        float: true,
        acceptWidgets: (element) => canEnter(block.id, element),
        minRow: 0,
        children: children.map(toWidget),
      };
    }
    return widget;
  }

  function typeName(info) {
    const name = CATALOG.get(info.type)?.name ?? info.type ?? info.tag;
    return info.repeat ? `${name} ×${info.repeat}` : name;
  }

  function describe(content, info) {
    const tag = info.repeat ? `${info.tag} ×${info.repeat}` : info.tag;
    content.title = [typeName(info), info.label, tag, info.selector, info.note ? `Nota: ${info.note}` : ''].filter(Boolean).join(' · ');
  }

  function applyDataset(item, info, isSection) {
    item.dataset.tag = info.tag ?? '';
    item.dataset.type = info.type ?? '';
    item.dataset.status = info.status ?? 'existing';
    item.dataset.kind = isSection ? 'section' : SKETCH.drawOf(info.type);
    item.dataset.disabled = info.disabled ? 'true' : 'false';
    if (info.tone) item.dataset.tone = info.tone;
    else delete item.dataset.tone;
    item.classList.toggle('section', isSection);
  }

  GridStack.renderCB = (content, widget) => {
    const info = meta.get(widget.id);
    const item = content.parentElement;
    if (!info || !item) return;

    applyDataset(item, info, Boolean(widget.subGridOpts));
    content.dataset.block = widget.id;
    describe(content, info);
    content.insertAdjacentHTML('beforeend', '<svg class="sk" aria-hidden="true"></svg><div class="sk-text"></div><span class="wf-type"></span><span class="wf-note" hidden></span>');
    content.querySelector(':scope > .wf-type').textContent = typeName(info);
    pens.observe(content);
  };

  // Legge la griglia come albero di blocchi. Con `withParts` tiene i disegni, che servono
  // all'editor per annullare e riprendere ma nel risultato peserebbero senza servire a Claude.
  function readGrid(target, withParts = true) {
    return [...target.engine.nodes]
      .filter((node) => meta.has(node.id))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((node) => {
        const { parts, ...info } = meta.get(node.id);
        const block = { ...info, x: node.x, y: node.y, w: node.w, h: node.h };
        if (withParts && parts) block.parts = parts;
        if (node.subGrid) {
          block.container = true;
          block.children = readGrid(node.subGrid, withParts);
        }
        return block;
      });
  }

  function flatten(blocks, parent = null) {
    return blocks.flatMap((block) => {
      const { children, parts, ...rest } = block;
      return [{ ...rest, parent }, ...flatten(children ?? [], block.id)];
    });
  }

  const sameValue = (a, b) => (a ?? '') === (b ?? '') || (!a && !b);
  // readonly e constraints li confronta WF_CONSTRAINTS.diff.
  const EDITABLE = ['label', 'type', 'required', 'disabled', 'repeat'];

  function changeKinds(from, to) {
    const kinds = [];
    if (from.parent !== to.parent) kinds.push('parent');
    if (from.x !== to.x || from.y !== to.y) kinds.push('position');
    if (from.w !== to.w || from.h !== to.h) kinds.push('size');
    return kinds;
  }

  function summaryOf(block) {
    const { id, tag, type, label, selector } = block;
    return Object.fromEntries(Object.entries({ id, tag, type, label, selector }).filter(([, value]) => value !== undefined && value !== ''));
  }

  function noteNumbers(final) {
    const numbers = new Map();
    for (const block of flatten(final)) if (block.note?.trim()) numbers.set(block.id, numbers.size + 1);
    return numbers;
  }

  function computeChanges(final) {
    const current = flatten(final);
    const byId = new Map(current.map((block) => [block.id, block]));
    const moves = [];
    const edited = [];

    for (const block of current) {
      const before = baseline.get(block.id);
      if (!before) continue;
      const kinds = changeKinds(before, block);
      if (kinds.length > 0) {
        const pick = ({ parent, x, y, w, h }) => ({ parent, x, y, w, h });
        moves.push({ ...summaryOf(block), touched: touched.has(block.id), kinds, from: pick(before), to: pick(block) });
      }
      const fields = {};
      for (const key of EDITABLE) {
        if (!sameValue(before[key], block[key])) fields[key] = { from: before[key] ?? null, to: block[key] ?? null };
      }
      Object.assign(fields, CONSTRAINTS?.diff(before, block) ?? {});
      if (Object.keys(fields).length > 0) edited.push({ ...summaryOf(block), fields });
    }

    // Di un sottoalbero aggiunto o eliminato si riporta solo la radice, con ciò che contiene.
    const descendants = (id, list) => list.filter((block) => block.parent === id).flatMap((block) => [block, ...descendants(block.id, list)]);

    const added = current
      .filter((block) => !baseline.has(block.id) && (block.parent === null || baseline.has(block.parent)))
      .map((block) => {
        const entry = { ...summaryOf(block), parent: block.parent, x: block.x, y: block.y, w: block.w, h: block.h };
        if (block.note) entry.note = block.note;
        if (block.readonly) entry.readonly = true;
        if (block.constraints) entry.constraints = block.constraints;
        const inside = descendants(block.id, current);
        if (inside.length > 0) entry.children = inside.map(({ type, label }) => ({ type, label }));
        return entry;
      });

    const baselineList = [...baseline.values()];
    const removed = baselineList
      .filter((block) => !byId.has(block.id))
      .filter((block) => block.parent === null || byId.has(block.parent))
      // Un elemento nato da "Scomponi" manca davvero solo se il suo blocco è ancora scomposto.
      .filter((block) => !block.derived || byId.get(block.parent)?.exploded)
      .map((block) => {
        const entry = { ...summaryOf(block), parent: block.parent };
        const inside = descendants(block.id, baselineList).filter((child) => !byId.has(child.id));
        if (inside.length > 0) entry.children = inside.map(({ type, label }) => ({ type, label }));
        return entry;
      });

    const numbers = noteNumbers(final);
    const notes = current
      .filter((block) => numbers.has(block.id))
      .map((block) => ({ n: numbers.get(block.id), ...summaryOf(block), note: block.note.trim() }));

    return { moves, added, removed, edited, notes };
  }

  function bands(blocks, start, end) {
    const groups = [];
    let edge = -Infinity;
    for (const block of [...blocks].sort((a, b) => start(a) - start(b))) {
      if (start(block) >= edge) {
        groups.push([]);
        edge = -Infinity;
      }
      groups.at(-1).push(block);
      edge = Math.max(edge, end(block));
    }
    return groups;
  }

  function outline(blocks, numbers, total = columns, indent = '') {
    const name = (block) => {
      const note = numbers.has(block.id) ? ` [nota ${numbers.get(block.id)}]` : '';
      const rules = CONSTRAINTS?.summarize(block) ?? '';
      return `${block.type ?? block.tag}${block.required ? '*' : ''} "${block.label ?? ''}"${rules ? ` {${rules}}` : ''}${note}`;
    };
    const span = (column) => Math.max(...column.map((block) => block.x + block.w)) - Math.min(...column.map((block) => block.x));

    return bands(blocks, (block) => block.y, (block) => block.y + block.h).flatMap((row) => {
      const columnsInRow = bands(row, (block) => block.x, (block) => block.x + block.w);
      const line = columnsInRow
        .map((column) => {
          const stacked = column.sort((a, b) => a.y - b.y).map(name).join(' / ');
          return `${stacked} [${span(column)}/${total}]`;
        })
        .join(' | ');
      const nested = row
        .filter((block) => block.children?.length)
        .flatMap((block) => [`${indent}  dentro ${name(block)}:`, ...outline(block.children, numbers, block.w, `${indent}    `)]);
      return [indent + line, ...nested];
    });
  }

  function buildResult() {
    const final = readGrid(grid, false);
    const changes = computeChanges(final);
    const changed = Object.values(changes).some((list) => list.length > 0);
    // I vincoli descrivono lo stato, non le modifiche: restano fuori da `changed` (quelli cambiati sono in edited).
    const constraints = CONSTRAINTS ? flatten(final).map(CONSTRAINTS.describe).filter(Boolean) : [];
    return {
      opened: true,
      page: spec.page,
      source: spec.source,
      granularity: spec.granularity ?? 'blocchi',
      columns,
      changed,
      ...changes,
      constraints,
      outline: outline(final, noteNumbers(final)).join('\n'),
      final,
    };
  }

  function fitSections(target) {
    for (const node of target.engine.nodes) {
      if (!node.subGrid) continue;
      fitSections(node.subGrid);
      const needed = node.subGrid.engine.getRow() + 1;
      if (needed > node.h) target.update(node.el, { h: needed });
    }
  }

  // Solo le tessere della libreria: passando sopra una sezione hanno anche un nodo di
  // provenienza, quindi si riconoscono dalla classe e non da `previous`.
  function onDropped(event, previous, node) {
    if (!node?.el?.classList.contains('tile')) return;
    // Segnato subito: il ripiego di bindDragIn controlla questo flag dopo il rilascio.
    if (dragIn) dragIn.handled = true;
    const { type } = node.el.dataset;
    const parentId = node.grid?.parentGridNode?.id ?? null;
    const place = { parentId, x: node.x, y: node.y, w: node.w, h: node.h };
    setTimeout(() => addBlock(type, place), 0);
  }

  function mount(blocks) {
    pens.disconnect();
    if (grid) {
      grid.destroy(false);
      wf.replaceChildren();
    }
    loadTree(blocks);
    const lastRow = Math.max(0, ...blocks.map((block) => block.y + block.h));
    grid = GridStack.addGrid(wf, {
      column: columns,
      cellHeight: cellPx(),
      margin: MARGIN,
      float: true,
      // Con `true` GridStack accetta solo `.grid-stack-item`: le tessere della libreria (`.tile`)
      // venivano rifiutate dalla griglia principale e il rilascio fuori dalle sezioni non aggiungeva nulla.
      acceptWidgets: '.grid-stack-item, .tile',
      minRow: lastRow + FREE_ROWS,
      resizable: { handles: 'e,se,s' },
      children: blocks.map(toWidget),
    });
    grid.on('dropped', onDropped);
    forEachSection(grid, (section) => section.subGrid.on('dropped', onDropped));
    fitSections(grid);
    if (closed) grid.setStatic(true);
  }

  // ---------------------------------------------------------------- stato visibile

  function paintState() {
    const final = readGrid(grid, false);
    const numbers = noteNumbers(final);
    for (const item of wf.querySelectorAll('.grid-stack-item')) {
      const id = item.getAttribute('gs-id');
      const info = meta.get(id);
      if (!info) continue;
      item.classList.toggle('touched', touched.has(id));
      item.classList.toggle('selected', id === selectedId);
      item.classList.toggle('has-note', numbers.has(id));
      item.classList.toggle('tall', (item.gridstackNode?.h ?? 1) >= 3);
      const content = item.querySelector(':scope > .grid-stack-item-content');
      const note = content?.querySelector(':scope > .wf-note');
      if (note) {
        note.hidden = !numbers.has(id);
        note.textContent = numbers.get(id) ?? '';
      }
    }
  }

  function refreshItem(id) {
    const node = findNode(id);
    const info = meta.get(id);
    if (!node?.el || !info) return;
    const content = node.el.querySelector(':scope > .grid-stack-item-content');
    applyDataset(node.el, info, Boolean(node.subGrid));
    describe(content, info);
    content.querySelector(':scope > .wf-type').textContent = typeName(info);
    draw(content);
  }

  function snapshot() {
    return JSON.stringify({ blocks: readGrid(grid), touched: [...touched] });
  }

  function summaryText({ moves, added, removed, edited, notes }) {
    const parts = [];
    const moved = moves.filter((move) => move.touched).length;
    if (moved) parts.push(`${moved} spostati`);
    if (added.length) parts.push(`${added.length} aggiunti`);
    if (removed.length) parts.push(`${removed.length} eliminati`);
    if (edited.length) parts.push(`${edited.length} modificati`);
    if (notes.length) parts.push(`${notes.length} ${notes.length === 1 ? 'nota' : 'note'}`);
    return parts.length ? parts.join(' · ') : 'Nessuna modifica';
  }

  function refreshControls() {
    undoBtn.disabled = closed || history.length < 2;
    redoBtn.disabled = closed || future.length === 0;
    resetBtn.disabled = closed || history.length < 2;
    paintState();
  }

  function save() {
    if (closed) return;
    refreshControls();
    statusEl.textContent = 'Salvataggio';

    unsaved = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const result = buildResult();
        const state = {
          ...result,
          snapshot: {
            blocks: readGrid(grid),
            touched: [...touched],
            derived: [...baseline.values()].filter((block) => block.derived),
            nextNew,
            theme: SKETCH.getTheme(),
            zoom,
          },
        };
        const response = await fetch('/state', { method: 'POST', body: JSON.stringify(state) });
        if (!response.ok) throw new Error(`stato ${response.status}`);
        unsaved = false;
        statusEl.textContent = summaryText(result);
      } catch {
        statusEl.textContent = 'Non salvato';
      }
    }, SAVE_DELAY);
  }

  function commit() {
    clearTimeout(noteTimer);
    noteTimer = null;
    const current = snapshot();
    if (current === history.at(-1)) {
      refreshControls();
      return;
    }
    history.push(current);
    future = [];
    save();
  }

  function restore(serialized) {
    const state = JSON.parse(serialized);
    touched = new Set(state.touched);
    mount(state.blocks);
    if (selectedId && !meta.has(selectedId)) selectedId = null;
    renderInspector();
  }

  function flushPending() {
    if (noteTimer) commit();
  }

  function hasMoved(id) {
    const previous = JSON.parse(history.at(-1)).blocks;
    const from = flatten(previous).find((block) => block.id === id);
    const to = flatten(readGrid(grid)).find((block) => block.id === id);
    return Boolean(from && to && changeKinds(from, to).length > 0);
  }

  function settle() {
    if (!grid || closed) return;
    uncapSections();
    fitSections(grid);
    if (activeId && hasMoved(activeId)) touched.add(activeId);
    activeId = null;
    commit();
  }

  function undo() {
    flushPending();
    if (history.length < 2) return;
    future.push(history.pop());
    restore(history.at(-1));
    save();
  }

  function redo() {
    flushPending();
    if (future.length === 0) return;
    const next = future.pop();
    history.push(next);
    restore(next);
    save();
  }

  function reset() {
    flushPending();
    touched = new Set();
    selectedId = null;
    mount(initialTree);
    renderInspector();
    commit();
  }

  // ---------------------------------------------------------------- modifiche strutturali

  function locate(blocks, id, parent = null) {
    for (let index = 0; index < blocks.length; index += 1) {
      const block = blocks[index];
      if (block.id === id) return { block, list: blocks, index, parent };
      const nested = locate(block.children ?? [], id, block);
      if (nested) return nested;
    }
    return null;
  }

  // Ogni modifica strutturale riparte dall'albero: si legge, si cambia, si rimonta la griglia.
  function mutate(change, after) {
    if (closed) return;
    flushPending();
    const tree = readGrid(grid);
    const selection = change(tree);
    mount(tree);
    after?.();
    autoWiden();
    if (selection !== undefined) selectedId = selection;
    renderInspector();
    commit();
    if (selectedId) findNode(selectedId)?.el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const newId = () => {
    nextNew += 1;
    return `nuovo-${nextNew}`;
  };

  function scaled(entryWidth, limit) {
    return Math.max(1, Math.min(limit, Math.round((entryWidth * columns) / 12)));
  }

  function addBlock(type, place = {}) {
    const entry = CATALOG.get(type);
    if (!entry || closed) return;
    const id = newId();

    mutate((tree) => {
      let parentId = place.parentId;
      let x = place.x;
      let y = place.y;

      // Senza una posizione: dentro la sezione selezionata, oppure subito sotto il blocco selezionato.
      if (x === undefined) {
        const selected = selectedId && locate(tree, selectedId);
        if (selected?.block.container) {
          parentId = selected.block.id;
          x = 0;
          y = Math.max(0, ...(selected.block.children ?? []).map((child) => child.y + child.h));
        } else if (selected) {
          parentId = selected.parent?.id ?? null;
          x = selected.block.x;
          y = selected.block.y + selected.block.h;
        } else {
          parentId = null;
          x = 0;
          y = Math.max(0, ...tree.map((block) => block.y + block.h));
        }
      }

      const parent = parentId ? locate(tree, parentId)?.block : null;
      const limit = parent ? parent.w : columns;
      const w = place.w && place.parentId !== undefined ? Math.min(place.w, limit) : scaled(entry.w, limit);
      const block = {
        id,
        tag: CATALOG.tagOf(type),
        type,
        label: entry.text,
        status: 'new',
        x: Math.min(x, Math.max(0, limit - w)),
        y,
        w,
        h: place.h && place.parentId !== undefined ? place.h : entry.h,
      };
      if (entry.container) {
        block.container = true;
        block.children = [];
      }
      if (parent) {
        parent.children = [...(parent.children ?? []), block];
        parent.container = true;
      } else {
        tree.push(block);
      }
      return id;
    });
  }

  function removeBlock(id) {
    if (!id || !meta.has(id)) return;
    mutate((tree) => {
      const found = locate(tree, id);
      if (found) found.list.splice(found.index, 1);
      touched.delete(id);
      return null;
    });
  }

  function duplicateBlock(id) {
    if (!id || !meta.has(id)) return;
    let copyId = null;
    mutate((tree) => {
      const found = locate(tree, id);
      if (!found) return undefined;
      const clone = (block) => {
        const { note, derived, exploded, selector, ...rest } = block;
        // I vincoli si copiano: la copia di un campo ha le stesse regole, in un oggetto suo.
        if (rest.constraints) rest.constraints = { ...rest.constraints };
        return { ...rest, id: newId(), status: 'new', children: block.children?.map(clone) };
      };
      const copy = clone(found.block);
      copy.y = found.block.y + found.block.h;
      found.list.push(copy);
      copyId = copy.id;
      return copyId;
    });
  }

  // Elementi da ricavare dal testo quando un blocco nato nel mockup non ha parti.
  function virtualParts(info) {
    const entry = CATALOG.get(info.type);
    if (!entry?.split) return null;
    const items = SKETCH.splitItems(info.label);
    if (items.length === 0) return null;
    const share = 100 / items.length;
    const childType = entry.split === 'tab' ? 'button' : entry.split;
    return items.map((text, index) => [childType, Math.round(index * share) + 1, 5, Math.max(4, Math.round(share) - 2), 90, text]);
  }

  const canExplode = (info) => Boolean(info && !findNode(info.id)?.subGrid && (info.parts?.length || virtualParts(info)));

  // Le parti diventano blocchi figli: le misure passano da percentuali a celle del blocco,
  // e un riquadro che ne contiene altri diventa a sua volta una sezione.
  function partsToChildren(block, parts) {
    const items = parts.map(([kind, x, y, w, h, text = ''], index) => ({
      index, type: CATALOG.get(kind)?.type ?? 'box', x, y, w: Math.max(1, w), h: Math.max(1, h), text, kids: [],
    }));
    const contains = (outer, inner) => {
      const centerX = inner.x + inner.w / 2;
      const centerY = inner.y + inner.h / 2;
      return centerX >= outer.x && centerX <= outer.x + outer.w && centerY >= outer.y && centerY <= outer.y + outer.h;
    };
    const roots = [];
    for (const item of items) {
      const holders = items.filter((other) => other !== item && (other.type === 'box' || other.type === 'card') && other.w * other.h > item.w * item.h && contains(other, item));
      const holder = holders.sort((a, b) => a.w * a.h - b.w * b.h)[0];
      (holder ? holder.kids : roots).push(item);
    }

    const toChild = (item, frame, cells, rows) => {
      const ratioX = (item.x - frame.x) / frame.w;
      const ratioY = (item.y - frame.y) / frame.h;
      const x = Math.max(0, Math.min(cells - 1, Math.round(ratioX * cells)));
      const w = Math.max(1, Math.min(cells - x, Math.round((item.w / frame.w) * cells)));
      const y = Math.max(0, Math.round(ratioY * rows));
      const h = Math.max(1, Math.round((item.h / frame.h) * rows));
      const child = {
        id: `${block.id}.p${item.index}`,
        tag: CATALOG.tagOf(item.type),
        type: item.type,
        label: item.text,
        selector: block.selector,
        status: block.status ?? 'existing',
        derived: true,
        x, y, w, h,
      };
      if (block.tone) child.tone = block.tone;
      if (item.kids.length > 0) {
        child.container = true;
        child.children = item.kids.map((kid) => toChild(kid, item, w, h));
      }
      return child;
    };

    return roots.map((item) => toChild(item, { x: 0, y: 0, w: 100, h: 100 }, block.w, Math.max(block.h, roots.length > 1 ? 2 : 1)));
  }

  function explodeBlock(id) {
    const info = meta.get(id);
    if (!canExplode(info)) return;
    const parts = info.parts?.length ? info.parts : virtualParts(info);
    mutate(
      (tree) => {
        const found = locate(tree, id);
        if (!found) return undefined;
        found.block.children = partsToChildren(found.block, parts);
        found.block.container = true;
        found.block.exploded = true;
        delete found.block.parts;
        return id;
      },
      () => {
        // Le posizioni appena nate sono quelle di partenza: non contano come spostamenti.
        const exploded = locate(readGrid(grid, false), id);
        for (const child of flatten(exploded?.block.children ?? [], id)) {
          if (!baseline.has(child.id)) baseline.set(child.id, child);
        }
      },
    );
  }

  function setProps(id, props, { defer = false } = {}) {
    const info = meta.get(id);
    if (!info || closed) return;
    for (const [key, raw] of Object.entries(props)) {
      // I vincoli si salvano normalizzati: un oggetto vuoto diventa undefined e la chiave sparisce.
      const value = key === 'constraints' && CONSTRAINTS ? CONSTRAINTS.normalize(raw) : raw;
      if (value === '' || value === false || value === null || value === undefined || (key === 'repeat' && !value)) delete info[key];
      else info[key] = value;
    }
    // Un tipo nuovo è un disegno nuovo: quello ricavato dalla pagina non vale più.
    if ('type' in props) {
      delete info.parts;
      // Anche i vincoli che il nuovo tipo non ammette non valgono più.
      if (CONSTRAINTS) {
        const allowed = new Set(CONSTRAINTS.applicable(info.type));
        for (const flag of ['required', 'readonly', 'disabled']) if (!allowed.has(flag)) delete info[flag];
        const kept = info.constraints && Object.fromEntries(Object.entries(info.constraints).filter(([key]) => allowed.has(key)));
        const normalized = kept ? CONSTRAINTS.normalize(kept) : undefined;
        if (normalized) info.constraints = normalized;
        else delete info.constraints;
      }
    }
    refreshItem(id);
    if ('label' in props || 'type' in props || 'required' in props) autoWiden(new Set([id]));
    paintState();
    if (defer) {
      clearTimeout(noteTimer);
      noteTimer = setTimeout(commit, NOTE_COMMIT_DELAY);
    } else {
      commit();
    }
  }

  // ---------------------------------------------------------------- selezione e Inspector

  const inspector = {
    panel: $('inspector'),
    form: $('i-form'),
    empty: $('i-empty'),
    title: $('i-title'),
    type: $('i-type'),
    label: $('i-label'),
    constraints: $('i-constraints'),
    repeatRow: $('i-repeat-row'),
    repeat: $('i-repeat'),
    note: $('i-note'),
    hint: $('i-hint'),
    meta: $('i-meta'),
    duplicate: $('i-duplicate'),
    explode: $('i-explode'),
    remove: $('i-delete'),
  };

  function buildTypeOptions() {
    for (const category of CATALOG.CATEGORIES) {
      const group = document.createElement('optgroup');
      group.label = category.name;
      for (const entry of CATALOG.TYPES.filter((item) => item.category === category.id)) {
        group.append(new Option(entry.name, entry.type));
      }
      inspector.type.append(group);
    }
  }

  function renderInspector() {
    const info = selectedId && meta.get(selectedId);
    inspector.panel.hidden = !info;
    inspector.form.hidden = !info;
    inspector.empty.hidden = Boolean(info);
    paintState();
    renderConstraints(info);
    if (!info) {
      inspector.title.textContent = 'Proprietà';
      return;
    }
    const entry = CATALOG.get(info.type);
    inspector.title.textContent = entry?.name ?? 'Proprietà';
    inspector.type.value = info.type;
    if (document.activeElement !== inspector.label) inspector.label.value = info.label ?? '';
    if (document.activeElement !== inspector.note) inspector.note.value = info.note ?? '';
    inspector.repeatRow.hidden = !(info.repeat || ['list', 'tree', 'table', 'content', 'box', 'card'].includes(info.type));
    inspector.repeat.value = info.repeat ?? '';
    const explodable = canExplode(info);
    inspector.explode.disabled = !explodable;
    inspector.hint.hidden = !explodable;
    const origin = info.status === 'new' ? 'nuovo' : info.derived ? 'scomposto' : 'dalla pagina';
    inspector.meta.textContent = [`<${info.tag}>`, origin, info.selector].filter(Boolean).join(' · ');
  }

  // La sezione si nasconde da sola per i tipi senza vincoli e non riscrive il campo in cui si sta scrivendo.
  function renderConstraints(info) {
    if (!CONSTRAINTS) return;
    CONSTRAINTS.renderSection(inspector.constraints, info || null, (patch, { defer = false } = {}) => {
      if (selectedId) setProps(selectedId, patch, { defer });
    });
  }

  function select(id) {
    flushPending();
    selectedId = id && meta.has(id) ? id : null;
    renderInspector();
  }

  function bindInspector() {
    buildTypeOptions();
    // Un tipo nuovo può avere vincoli diversi (o nessuno): l'Inspector si ridisegna.
    inspector.type.addEventListener('change', () => {
      setProps(selectedId, { type: inspector.type.value });
      renderInspector();
    });
    inspector.label.addEventListener('input', () => setProps(selectedId, { label: inspector.label.value }, { defer: true }));
    inspector.label.addEventListener('change', () => commit());
    inspector.repeat.addEventListener('change', () => setProps(selectedId, { repeat: Math.max(0, Math.min(60, Number(inspector.repeat.value) || 0)) }));
    inspector.note.addEventListener('input', () => setProps(selectedId, { note: inspector.note.value }, { defer: true }));
    inspector.note.addEventListener('change', () => commit());
    inspector.duplicate.addEventListener('click', () => duplicateBlock(selectedId));
    inspector.explode.addEventListener('click', () => explodeBlock(selectedId));
    inspector.remove.addEventListener('click', () => removeBlock(selectedId));
  }

  function startInlineEdit(id) {
    const node = findNode(id);
    const info = meta.get(id);
    if (!node?.el || !info || closed) return;
    const content = node.el.querySelector(':scope > .grid-stack-item-content');
    const box = content.getBoundingClientRect();
    const input = document.createElement('input');
    input.className = 'inline-edit';
    input.value = info.label ?? '';
    input.style.left = `${box.left + 4}px`;
    input.style.top = `${Math.max(0, box.top + Math.min(box.height, 40) / 2 - 16)}px`;
    input.style.width = `${Math.max(140, box.width - 8)}px`;
    document.body.append(input);
    input.focus();
    input.select();

    let done = false;
    const finish = (keep) => {
      if (done) return;
      done = true;
      input.remove();
      if (keep && input.value !== (info.label ?? '')) setProps(id, { label: input.value });
      renderInspector();
    };
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') finish(true);
      if (event.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  // ---------------------------------------------------------------- libreria e aggiunta veloce

  const normalize = (text) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function matches(entry, query) {
    if (!query) return true;
    const category = CATALOG.CATEGORIES.find((item) => item.id === entry.category)?.name ?? '';
    return normalize(`${entry.name} ${entry.type} ${category}`).includes(normalize(query));
  }

  function buildLibrary() {
    const list = $('library-list');
    for (const [index, category] of CATALOG.CATEGORIES.entries()) {
      const details = document.createElement('details');
      details.open = index < 4;
      const summary = document.createElement('summary');
      summary.textContent = category.name;
      const tiles = document.createElement('div');
      tiles.className = 'tiles';
      for (const entry of CATALOG.TYPES.filter((item) => item.category === category.id)) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.type = entry.type;
        tile.title = `${entry.name}: trascinalo nel mockup o cliccalo`;
        tile.setAttribute('gs-w', String(scaled(entry.w, columns)));
        tile.setAttribute('gs-h', String(entry.h));
        tile.innerHTML = '<div class="tile-sketch"><svg class="sk" aria-hidden="true"></svg><div class="sk-text"></div></div><span class="tile-name"></span>';
        const name = tile.querySelector('.tile-name');
        name.textContent = entry.name;
        const id = document.createElement('small');
        id.textContent = entry.type;
        name.append(id);
        drawTile(tile);
        tile.addEventListener('click', () => addBlock(entry.type));
        tiles.append(tile);
      }
      details.append(summary, tiles);
      list.append(details);
    }
    GridStack.setupDragIn('#library .tile', { appendTo: 'body', helper: 'clone' });
    bindDragIn(list);

    $('library-search').addEventListener('input', (event) => {
      const query = event.target.value.trim();
      for (const details of list.querySelectorAll('details')) {
        let visible = 0;
        for (const tile of details.querySelectorAll('.tile')) {
          const show = matches(CATALOG.get(tile.dataset.type), query);
          tile.hidden = !show;
          visible += show ? 1 : 0;
        }
        details.hidden = visible === 0;
        if (query) details.open = visible > 0;
      }
    });
  }

  // Ripiego per il rilascio di una tessera: se GridStack non la fa cadere in nessuna griglia
  // (nessun 'dropped'), si aggiunge comunque nella griglia sotto il puntatore.
  // setupDragIn emette sulla tessera 'dragstart'/'dragstop' come CustomEvent; al rilascio GridStack
  // emette 'dragstop' e solo dopo, nello stesso giro, 'drop' → 'dropped': il controllo va rimandato.
  function bindDragIn(list) {
    const track = (event) => {
      const point = event.touches?.[0] ?? event;
      pointer = [point.clientX, point.clientY];
    };
    document.addEventListener('pointermove', track, { capture: true, passive: true });
    document.addEventListener('touchmove', track, { capture: true, passive: true });

    list.addEventListener('dragstart', (event) => {
      if (event instanceof CustomEvent && event.target.closest?.('.tile')) dragIn = { handled: false };
    });
    list.addEventListener('dragstop', (event) => {
      const tile = event instanceof CustomEvent && event.target.closest?.('.tile');
      const drag = dragIn;
      if (!tile || !drag) return;
      const point = pointer;
      setTimeout(() => {
        if (dragIn === drag) dragIn = null;
        if (!drag.handled) dropAtPoint(tile.dataset.type, point);
      }, 0);
    });
  }

  function dropAtPoint(type, point) {
    // Un segnaposto rimasto in una sezione dopo un rilascio non riuscito.
    for (const placeholder of wf.querySelectorAll('.grid-stack-placeholder')) placeholder.remove();
    if (closed || !point) return;
    const gridEl = document.elementFromPoint(...point)?.closest?.('.grid-stack');
    const target = gridEl && wf.contains(gridEl) ? gridEl.gridstack : null;
    if (!target) return;
    const box = gridEl.getBoundingClientRect();
    const x = Math.max(0, Math.floor((point[0] - box.left) / (box.width / target.getColumn())));
    const y = Math.max(0, Math.floor((point[1] - box.top) / target.getCellHeight()));
    addBlock(type, { parentId: target.parentGridNode?.id ?? null, x, y });
  }

  function bindQuickAdd() {
    const input = $('quick');
    const list = $('quick-list');
    let results = [];
    let active = 0;

    const close = () => {
      list.hidden = true;
      input.setAttribute('aria-expanded', 'false');
    };
    const render = () => {
      list.replaceChildren(
        ...results.map((entry, index) => {
          const item = document.createElement('li');
          item.setAttribute('role', 'option');
          item.setAttribute('aria-selected', String(index === active));
          item.innerHTML = '<span></span><small></small>';
          item.querySelector('span').textContent = entry.name;
          item.querySelector('small').textContent = CATALOG.CATEGORIES.find((category) => category.id === entry.category)?.name ?? '';
          item.addEventListener('mousedown', (event) => {
            event.preventDefault();
            choose(entry);
          });
          return item;
        }),
      );
      list.hidden = results.length === 0;
      input.setAttribute('aria-expanded', String(!list.hidden));
    };
    const choose = (entry) => {
      input.value = '';
      close();
      input.blur();
      addBlock(entry.type);
    };

    input.addEventListener('input', () => {
      const query = input.value.trim();
      results = query ? CATALOG.TYPES.filter((entry) => matches(entry, query)).slice(0, QUICK_RESULTS) : [];
      active = 0;
      render();
    });
    input.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (results.length === 0) return;
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        render();
      } else if (event.key === 'Enter' && results[active]) {
        event.preventDefault();
        choose(results[active]);
      } else if (event.key === 'Escape') {
        input.value = '';
        close();
        input.blur();
      }
    });
    input.addEventListener('blur', () => setTimeout(close, 100));
  }

  // Pannelli che si spostano dall'intestazione e si comprimono.
  function bindPanels() {
    for (const panel of document.querySelectorAll('.panel')) {
      const handle = panel.querySelector('[data-drag]');
      const toggle = panel.querySelector('[data-collapse]');
      toggle.addEventListener('click', () => {
        const collapsed = panel.classList.toggle('collapsed');
        if (panel.id === 'library') {
          document.body.classList.toggle('docked', !collapsed && !panel.style.left);
          layoutSheet();
        }
        toggle.textContent = collapsed ? '+' : '–';
        toggle.setAttribute('aria-expanded', String(!collapsed));
      });
      handle.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        const box = panel.getBoundingClientRect();
        const offsetX = event.clientX - box.left;
        const offsetY = event.clientY - box.top;
        handle.setPointerCapture(event.pointerId);
        const move = (moveEvent) => {
          // Una volta spostata, la libreria non è più agganciata e il foglio si riprende lo spazio.
          if (panel.id === 'library' && document.body.classList.contains('docked')) {
            document.body.classList.remove('docked');
            layoutSheet();
          }
          const left = Math.max(0, Math.min(window.innerWidth - 60, moveEvent.clientX - offsetX));
          const top = Math.max(0, Math.min(window.innerHeight - 30, moveEvent.clientY - offsetY));
          Object.assign(panel.style, { left: `${left}px`, top: `${top}px`, right: 'auto' });
        };
        const stop = () => {
          handle.removeEventListener('pointermove', move);
          handle.removeEventListener('pointerup', stop);
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', stop);
      });
    }
  }

  function bindTheme() {
    themeSelect.addEventListener('change', () => {
      applyTheme(themeSelect.value);
      // Un altro font, altre larghezze: ciò che allarga entra nella cronologia come ogni modifica.
      if (autoWiden()) commit();
      else save();
    });
  }

  function bindZoom() {
    zoomOutBtn.addEventListener('click', () => stepZoom(-1));
    zoomInBtn.addEventListener('click', () => stepZoom(1));
    zoomLevelBtn.addEventListener('click', () => setZoom(1));
    zoomFitBtn.addEventListener('click', fitZoom);
    // Ctrl+rotella sul foglio: zoom dell'editor invece di quello del browser.
    sheet.addEventListener('wheel', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      event.preventDefault();
      wheelDelta += event.deltaY;
      if (Math.abs(wheelDelta) < WHEEL_STEP) return;
      stepZoom(wheelDelta < 0 ? 1 : -1);
      wheelDelta = 0;
    }, { passive: false });
    // La larghezza del foglio zoomato dipende dalla finestra.
    window.addEventListener('resize', () => {
      if (zoom !== 1) layoutSheet();
    });
  }

  function bindToggles() {
    const pairs = [
      ['toggle-types', 'show-types', true],
      ['toggle-notes', 'hide-notes', false],
    ];
    for (const [id, className, addWhenOn] of pairs) {
      const button = $(id);
      button.addEventListener('click', () => {
        const on = button.getAttribute('aria-pressed') !== 'true';
        button.setAttribute('aria-pressed', String(on));
        document.body.classList.toggle(className, addWhenOn ? on : !on);
      });
    }
  }

  // ---------------------------------------------------------------- avvio e chiusura

  function markClosed() {
    if (closed) return;
    closed = true;
    clearTimeout(saveTimer);
    grid?.setStatic(true);
    document.body.classList.add('closed');
    undoBtn.disabled = true;
    redoBtn.disabled = true;
    resetBtn.disabled = true;
    statusEl.textContent = 'Chiuso';
    noticeEl.textContent = 'Il mockup è chiuso e non si può più modificare. Se non hai finito, chiedi a Claude di riaprirlo.';
    noticeEl.classList.add('done');
  }

  function showError(message) {
    statusEl.textContent = 'Errore';
    noticeEl.textContent = message;
    noticeEl.classList.add('error');
  }

  function highestNewId(blocks) {
    return Math.max(0, ...flatten(blocks).map((block) => Number(/^nuovo-(\d+)$/.exec(block.id)?.[1] ?? 0)));
  }

  async function start() {
    const response = await fetch('/spec').catch(() => null);
    if (!response?.ok) {
      showError('Non riesco a leggere il mockup: chiedi a Claude di riaprirlo.');
      return;
    }

    spec = await response.json();
    columns = Number(spec.columns) || 12;
    document.documentElement.style.setProperty('--columns', String(columns));
    document.title = `Mockup: ${spec.page ?? 'pagina'}`;
    $('page').textContent = spec.page ?? '';
    $('address').textContent = spec.source ?? '';

    // Lo stato salvato si legge prima di montare: il suo tema decide il font, e quindi
    // quanto vanno allargati i blocchi prima di fissare la versione di partenza.
    const stored = await fetch('/state').catch(() => null);
    const saved = stored?.status === 200 ? await stored.json() : null;
    applyTheme(saved?.snapshot?.theme ?? spec.theme ?? SKETCH.DEFAULT_THEME);

    mount(spec.blocks);
    autoWiden();
    initialTree = readGrid(grid);
    for (const block of flatten(readGrid(grid, false))) baseline.set(block.id, block);
    history = [snapshot()];
    nextNew = highestNewId(initialTree);

    buildLibrary();

    // Dopo un ricaricamento riparte dall'ultimo stato, per non perdere il lavoro.
    if (saved?.snapshot?.blocks) {
      for (const block of saved.snapshot.derived ?? []) baseline.set(block.id, block);
      touched = new Set(saved.snapshot.touched);
      mount(saved.snapshot.blocks);
      autoWiden();
      nextNew = Math.max(nextNew, saved.snapshot.nextNew ?? 0, highestNewId(saved.snapshot.blocks));
      history.push(snapshot());
    } else if (saved?.final) {
      touched = new Set(saved.moves.filter((move) => move.touched).map((move) => move.id));
      mount(saved.final);
      autoWiden();
      history.push(snapshot());
    }
    applyZoom(saved?.snapshot?.zoom ?? 1);
    renderInspector();
    save();

    setInterval(async () => {
      const ping = await fetch('/ping').catch(() => null);
      failedPings = ping?.ok ? 0 : failedPings + 1;
      if (failedPings >= MAX_FAILED_PINGS) markClosed();
      else if (ping?.ok && unsaved) save();
    }, PING_EVERY);
  }

  const itemIdAt = (target) => target.closest?.('#wf .grid-stack-item')?.getAttribute('gs-id') ?? null;

  const onPress = (event) => {
    const point = event.touches?.[0] ?? event;
    pressPoint = [point.clientX, point.clientY];
    activeId = itemIdAt(event.target);
    const node = activeId && findNode(activeId);
    if (node && !event.target.closest('.ui-resizable-handle')) capSections(node);
  };
  const onRelease = () => {
    clearTimeout(settleTimer);
    settleTimer = setTimeout(settle, SETTLE_DELAY);
  };

  const isTyping = (target) => target.closest?.('input, textarea, select, [contenteditable="true"]');

  document.addEventListener('mousedown', onPress, true);
  document.addEventListener('touchstart', onPress, true);
  document.addEventListener('mouseup', onRelease, true);
  document.addEventListener('touchend', onRelease, true);

  // Un clic senza trascinamento seleziona; sul foglio vuoto deseleziona.
  sheet.addEventListener('click', (event) => {
    if (closed || event.target.closest('.ui-resizable-handle')) return;
    if (pressPoint && Math.hypot(event.clientX - pressPoint[0], event.clientY - pressPoint[1]) > CLICK_TOLERANCE) return;
    select(itemIdAt(event.target));
  });
  sheet.addEventListener('dblclick', (event) => {
    const id = itemIdAt(event.target);
    if (id) startInlineEdit(id);
  });

  document.addEventListener('keydown', (event) => {
    const command = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    if (command && key === 'k') {
      event.preventDefault();
      $('quick').focus();
      return;
    }
    if (isTyping(event.target)) return;
    if (command && (key === '+' || key === '=')) {
      event.preventDefault();
      stepZoom(1);
    } else if (command && (key === '-' || key === '_')) {
      event.preventDefault();
      stepZoom(-1);
    } else if (command && key === '0') {
      event.preventDefault();
      setZoom(1);
    } else if (command && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    } else if (command && key === 'y') {
      event.preventDefault();
      redo();
    } else if (command && key === 'd' && selectedId) {
      event.preventDefault();
      duplicateBlock(selectedId);
    } else if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
      event.preventDefault();
      removeBlock(selectedId);
    } else if ((event.key === 'F2' || event.key === 'Enter') && selectedId) {
      event.preventDefault();
      startInlineEdit(selectedId);
    } else if (event.key === 'Escape') {
      select(null);
    }
  });

  new ResizeObserver(drawSheet).observe(sheet);
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  resetBtn.addEventListener('click', reset);
  exportBtn.addEventListener('click', exportPng);
  if (CONSTRAINTS?.css) {
    const style = document.createElement('style');
    style.textContent = CONSTRAINTS.css;
    document.head.append(style);
  }
  bindInspector();
  bindQuickAdd();
  bindPanels();
  bindToggles();
  bindTheme();
  bindZoom();
  applyTheme(SKETCH.DEFAULT_THEME);
  applyZoom(1);

  window.WF = {
    result: buildResult,
    settle,
    undo,
    redo,
    reset,
    grid: () => grid,
    add: addBlock,
    select,
    remove: removeBlock,
    duplicate: duplicateBlock,
    explode: explodeBlock,
    setProps,
    setNote: (id, note) => setProps(id, { note }),
    meta: (id) => meta.get(id),
    theme: (name) => (name === undefined ? SKETCH.getTheme() : applyTheme(name)),
    zoom: (level) => (level === undefined ? zoom : setZoom(level)),
    exportPng,
  };
  start();
})();
