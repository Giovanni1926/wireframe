// Disegno dei blocchi del mockup: penne, scena e widget, uno per tipo del catalogo.
// Senza stato della griglia: l'editor passa tutto ciò che serve a ogni chiamata.
// Il tema decide la penna: "schizzo" traccia a mano, gli altri tracciano linee nette.
window.WF_SKETCH = (() => {
  const CATALOG = window.WF_CATALOG;

  const THEMES = ['pulito', 'pulito-scuro', 'schizzo', 'blueprint'];
  const DEFAULT_THEME = 'pulito';
  const HAND_THEMES = new Set(['schizzo']);

  const INSET = 3;
  const PADDING = 8;
  const SEGMENT = 64;
  const WOBBLE = 1.6;
  const WAVE = 14;
  const TEXT_ROW = 18;
  const MIN_FONT = 10;
  const BODY_FONT = 14;
  const LABEL_FONT = 13;
  // Oltre questa larghezza un'etichetta va a capo invece di chiedere un blocco più largo.
  const NEEDED_MAX_WIDTH = 360;
  const BUTTON_FONT = 14;
  const LINE_HEIGHT = 1.2;
  const CHROME_HEIGHT = 42;
  const STICKER_MIN_WIDTH = 120;
  const STICKER_MIN_HEIGHT = 40;
  // Nei temi puliti un paragrafo è una riga vera e poche barre: di più è solo rumore.
  const CLEAN_TEXT_ROWS = 3;
  const STICKERS = { new: 'nuovo', changed: 'modificato' };
  const HEADING_SIZES = { h1: 34, h2: 28, h3: 22, h4: 18, h5: 16, h6: 15 };
  // I campi si disegnano da soli: il bordo del blocco diventa una traccia leggera.
  const GHOSTED = new Set(['field', 'check', 'radio', 'toggle', 'range', 'label']);

  let theme = DEFAULT_THEME;
  // Scala dello zoom dell'editor: il disegno si calcola alla misura al 100% e poi si ingrandisce
  // (viewBox per l'svg, px moltiplicati per i testi), così corpi, righe e icone crescono insieme al blocco.
  let scale = 1;

  function setTheme(name) {
    theme = THEMES.includes(name) ? name : DEFAULT_THEME;
    fontFamily = null;
    return theme;
  }

  // Misura il testo con il font vero del tema: una stima per carattere tagliava etichette che ci stavano.
  const measurer = document.createElement('canvas').getContext('2d');
  let fontFamily = null;
  function measure(text, size, bold = false) {
    fontFamily ??= getComputedStyle(document.body).fontFamily || 'sans-serif';
    measurer.font = `${bold ? 700 : 400} ${size}px ${fontFamily}`;
    return measurer.measureText(text).width;
  }

  function setScale(value) {
    scale = Number.isFinite(value) && value > 0 ? value : 1;
    return scale;
  }

  const isHand = (name = theme) => HAND_THEMES.has(name);

  // ---------------------------------------------------------------- penne

  function hashOf(text) {
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
    }
    return hash >>> 0;
  }

  function randomFrom(seed) {
    let state = seed;
    return () => {
      state = (state + 0x6d2b79f5) | 0;
      let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    };
  }

  const tidy = (value) => Math.round(value * 10) / 10;
  const middle = ([ax, ay], [bx, by]) => [(ax + bx) / 2, (ay + by) / 2];

  // Una penna per blocco, con il seme preso dal suo id: ridisegnando un blocco
  // della stessa misura le linee restano uguali e non tremano a ogni aggiornamento.
  function createHandPen(seed) {
    const random = randomFrom(seed);
    const shake = (amount) => (random() - 0.5) * 2 * amount;

    // Curva tra i punti medi: gli spigoli si ammorbidiscono come in un tratto a mano.
    function curve(points, isClosed) {
      const [startX, startY] = isClosed ? middle(points.at(-1), points[0]) : points[0];
      const last = isClosed ? points.length : points.length - 1;
      let path = `M${tidy(startX)} ${tidy(startY)}`;
      for (let index = isClosed ? 0 : 1; index < last; index += 1) {
        const [controlX, controlY] = points[index];
        const [x, y] = middle(points[index], points[(index + 1) % points.length]);
        path += `Q${tidy(controlX)} ${tidy(controlY)} ${tidy(x)} ${tidy(y)}`;
      }
      if (isClosed) return `${path}Z`;
      const [endX, endY] = points.at(-1);
      return `${path}L${tidy(endX)} ${tidy(endY)}`;
    }

    function stroke(fromX, fromY, toX, toY) {
      const length = Math.hypot(toX - fromX, toY - fromY) || 1;
      const steps = Math.max(2, Math.round(length / SEGMENT));
      const normalX = (fromY - toY) / length;
      const normalY = (toX - fromX) / length;
      const points = [];
      for (let step = 0; step <= steps; step += 1) {
        const offset = step === 0 || step === steps ? 0 : shake(WOBBLE);
        points.push([
          fromX + ((toX - fromX) * step) / steps + normalX * offset,
          fromY + ((toY - fromY) * step) / steps + normalY * offset,
        ]);
      }
      return curve(points, false);
    }

    const trace = (points) => points.slice(1).map((point, index) => stroke(...points[index], ...point)).join('');

    function box({ x, y, w, h }, radius = 8) {
      const round = Math.min(radius, w / 3, h / 3);
      const corners = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
      const points = corners.flatMap(([cornerX, cornerY], index) => {
        const [nextX, nextY] = corners[(index + 1) % corners.length];
        const length = Math.hypot(nextX - cornerX, nextY - cornerY) || 1;
        const alongX = (nextX - cornerX) / length;
        const alongY = (nextY - cornerY) / length;
        const steps = Math.max(1, Math.round(length / SEGMENT));
        const side = [[cornerX + shake(0.8), cornerY + shake(0.8)]];
        for (let step = 0; step <= steps; step += 1) {
          const distance = round + ((length - round * 2) * step) / steps;
          const offset = shake(WOBBLE);
          side.push([cornerX + alongX * distance - alongY * offset, cornerY + alongY * distance + alongX * offset]);
        }
        return side;
      });
      return curve(points, true);
    }

    function ring(centerX, centerY, radius) {
      const steps = Math.max(8, Math.round(radius));
      const points = [];
      for (let step = 0; step < steps; step += 1) {
        const angle = (step / steps) * Math.PI * 2;
        const reach = radius + shake(Math.min(1, radius * 0.08));
        points.push([centerX + Math.cos(angle) * reach, centerY + Math.sin(angle) * reach]);
      }
      return curve(points, true);
    }

    function scribble(x, y, length) {
      let path = `M${tidy(x)} ${tidy(y)}`;
      let direction = -1;
      for (let done = 0; done < length; done += WAVE) {
        const step = Math.min(WAVE, length - done);
        path += `q${tidy(step / 2)} ${tidy(direction * (2.6 + shake(0.8)))} ${tidy(step)} ${tidy(shake(0.6))}`;
        direction = -direction;
      }
      return path;
    }

    return { hand: true, box, ring, scribble, stroke, trace, vary: (value, spread) => value + shake(spread) };
  }

  // Stessa interfaccia della penna a mano, con linee dritte e angoli regolari.
  // Il seme resta: le lunghezze delle barre di testo variano, ma sempre uguali per lo stesso blocco.
  function createCleanPen(seed) {
    const random = randomFrom(seed);
    const point = (x, y) => `${tidy(x)} ${tidy(y)}`;

    const stroke = (fromX, fromY, toX, toY) => `M${point(fromX, fromY)}L${point(toX, toY)}`;
    const trace = (points) => points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${point(x, y)}`).join('');

    function box({ x, y, w, h }, radius = 6) {
      const r = tidy(Math.max(0, Math.min(radius, w / 2, h / 2)));
      const right = x + w;
      const bottom = y + h;
      const arc = (toX, toY) => `A${r} ${r} 0 0 1 ${point(toX, toY)}`;
      return `M${point(x + r, y)}H${tidy(right - r)}${arc(right, y + r)}V${tidy(bottom - r)}${arc(right - r, bottom)}H${tidy(x + r)}${arc(x, bottom - r)}V${tidy(y + r)}${arc(x + r, y)}Z`;
    }

    function ring(centerX, centerY, radius) {
      const r = tidy(radius);
      return `M${point(centerX - radius, centerY)}a${r} ${r} 0 1 0 ${tidy(radius * 2)} 0a${r} ${r} 0 1 0 ${tidy(-radius * 2)} 0Z`;
    }

    const scribble = (x, y, length) => stroke(x, y, x + length, y);

    return { hand: false, box, ring, scribble, stroke, trace, vary: (value, spread) => value + (random() - 0.5) * 2 * spread };
  }

  const createPen = (seed, hand = isHand()) => (hand ? createHandPen(seed) : createCleanPen(seed));

  // ---------------------------------------------------------------- scena

  function pad(rect, x, y = x) {
    return { x: rect.x + x, y: rect.y + y, w: Math.max(1, rect.w - x * 2), h: Math.max(1, rect.h - y * 2) };
  }

  // Quante righe servono al testo, andando a capo tra le parole come farà il CSS.
  function linesFor(text, width, size, bold) {
    const words = text.split(' ');
    let lines = 1;
    let current = 0;
    const space = measure(' ', size, bold);
    for (const word of words) {
      const wordWidth = measure(word, size, bold);
      if (wordWidth > width) return Infinity;
      if (current > 0 && current + space + wordWidth > width) {
        lines += 1;
        current = wordWidth;
      } else {
        current += (current > 0 ? space : 0) + wordWidth;
      }
    }
    return lines;
  }

  // Sceglie il corpo più grande con cui il testo si legge per intero; solo se non basta il minimo, il CSS taglia.
  function fitText(text, rect, maxSize, minSize, bold) {
    for (let size = maxSize; size >= minSize; size -= 0.5) {
      const lines = linesFor(text, rect.w, size, bold);
      if (lines * size * LINE_HEIGHT <= rect.h + 1) return { size, lines, fits: true };
    }
    return { size: minSize, lines: 1, fits: false };
  }

  // I testi arrivano dalla pagina: restano sempre textContent, mai markup.
  // `zoom` moltiplica le misure dei testi; width e height sono quelle logiche, per il viewBox.
  function createScene(content, seed, hand, zoom = 1, width = 0, height = 0) {
    const paths = [];
    const labels = [];
    const px = (value) => tidy(value * zoom);
    // Solo i testi del blocco chiedono di allargarlo; quelli delle parti scalano con lui e non servirebbe.
    let measuring = true;

    function addSpan(className, text, style, extra = '') {
      const element = document.createElement('span');
      element.className = className;
      element.textContent = text;
      element.style.cssText = style;
      for (const [, key, value] of extra.matchAll(/data-([\w-]+)="([^"]*)"/g)) element.setAttribute(`data-${key}`, value);
      labels.push(element);
    }

    return {
      hand,
      pen: createPen(seed, hand),
      path(path, className = '') {
        paths.push(`<path class="${className}" d="${path}"/>`);
      },
      label(rect, text, className, maxSize, minSize = MIN_FONT) {
        if (!text || rect.w < 6 || rect.h < 6) return;
        // Meglio un corpo un po' più piccolo che un testo tagliato: si scende fino a MIN_FONT.
        const bold = /heading|strong|caption/.test(className);
        const fit = fitText(text, rect, maxSize, Math.max(MIN_FONT, Math.min(minSize, maxSize) - 3), bold);
        if (fit.fits) {
          const top = Math.max(rect.y, rect.y + (rect.h - fit.lines * fit.size * LINE_HEIGHT) / 2);
          addSpan(className, text, `left:${px(rect.x)}px;top:${px(top)}px;width:${px(rect.w)}px;font-size:${px(fit.size)}px;-webkit-line-clamp:${fit.lines}`);
          return;
        }
        // Non ci sta nemmeno al corpo minimo: resta dentro il blocco, tagliato, e segna quanto
        // spazio gli manca. L'editor lo legge per allargare il blocco quanto basta.
        const size = Math.max(MIN_FONT + 2, Math.min(maxSize, 13));
        const width = Math.max(rect.w, Math.min(measure(text, size, bold) + 6, NEEDED_MAX_WIDTH));
        const lines = Math.max(1, Math.min(linesFor(text, width, size, bold), 12));
        const clamp = Math.max(1, Math.floor(rect.h / (fit.size * LINE_HEIGHT)));
        const top = rect.y + (rect.h - clamp * fit.size * LINE_HEIGHT) / 2;
        const short = !measuring ? '' : `data-extra-x="${px(width - rect.w)}" data-extra-y="${px(Math.max(0, lines * size * LINE_HEIGHT - rect.h))}"`;
        addSpan(`${className} clipped`, text, `left:${px(rect.x)}px;top:${px(top)}px;width:${px(rect.w)}px;font-size:${px(fit.size)}px;-webkit-line-clamp:${clamp}`, short);
      },
      quietly(draw) {
        measuring = false;
        draw();
        measuring = true;
      },
      sticker(text) {
        addSpan('sticker', text, '');
      },
      paint() {
        const svg = content.querySelector(':scope > .sk');
        // Le proporzioni del viewBox sono quelle del blocco: "none" evita solo scarti di arrotondamento.
        svg.setAttribute('viewBox', `0 0 ${tidy(width)} ${tidy(height)}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.innerHTML = paths.join('');
        content.querySelector(':scope > .sk-text').replaceChildren(...labels);
      },
    };
  }

  // Larghezze di una fila di elementi (tab, bottoni) secondo il loro testo; se non ci stanno, si riducono in proporzione.
  function fitWidths(labels, total, size, padding) {
    const wanted = labels.map((label) => (label ? measure(label, size, true) + padding : 60));
    const sum = wanted.reduce((a, b) => a + b, 0);
    const ratio = sum > total ? total / sum : 1;
    return wanted.map((width) => Math.max(24, width * ratio));
  }

  // Disegni che riempiono il blocco fino al bordo.
  const FULL_BLEED = new Set(['table']);
  // Raggio degli angoli del bordo del blocco nei temi puliti (default di pen.box della penna pulita).
  const OUTLINE_RADIUS = 6;

  // Tipi che con le parti si disegnano comunque dal loro widget, leggendo i testi delle parti.
  const COMPOSITE = new Set(['tabs', 'button-group', 'nav', 'breadcrumb']);

  const splitItems = (text) => (text ?? '').split(/\s*[·|›>]\s*/).map((item) => item.trim()).filter(Boolean);

  // Riga di testo segnaposto: a mano un'onda, nei temi puliti una barra grigia.
  function textLine(scene, x, y, length) {
    scene.path(scene.pen.scribble(x, y, Math.max(4, length)), scene.hand ? 'scribble' : 'bar');
  }

  function magnifier(scene, x, y, size) {
    const radius = size * 0.28;
    scene.path(scene.pen.ring(x + size * 0.42, y + size * 0.42, radius), 'mark');
    scene.path(scene.pen.stroke(x + size * 0.62, y + size * 0.62, x + size * 0.9, y + size * 0.9), 'mark');
  }

  function chevron(scene, centerX, centerY, size, up = false) {
    const direction = up ? -1 : 1;
    scene.path(scene.pen.trace([
      [centerX - size * 0.35, centerY - direction * size * 0.15],
      [centerX, centerY + direction * size * 0.2],
      [centerX + size * 0.35, centerY - direction * size * 0.15],
    ]), 'mark');
  }

  function calendar(scene, x, y, size) {
    const { pen } = scene;
    scene.path(pen.box({ x, y: y + 1, w: size, h: size - 1 }, 2), 'mark');
    scene.path(pen.stroke(x, y + size * 0.36, x + size, y + size * 0.36), 'mark');
    scene.path(pen.stroke(x + size * 0.3, y - 1, x + size * 0.3, y + size * 0.2) + pen.stroke(x + size * 0.7, y - 1, x + size * 0.7, y + size * 0.2), 'mark');
  }

  function clock(scene, x, y, size) {
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    scene.path(scene.pen.ring(centerX, centerY, size * 0.45), 'mark');
    scene.path(scene.pen.trace([[centerX, centerY - size * 0.28], [centerX, centerY], [centerX + size * 0.22, centerY + size * 0.08]]), 'mark');
  }

  function lock(scene, x, y, size) {
    const bodyTop = y + size * 0.42;
    scene.path(scene.pen.trace([
      [x + size * 0.22, bodyTop],
      [x + size * 0.22, y + size * 0.18],
      [x + size * 0.5, y],
      [x + size * 0.78, y + size * 0.18],
      [x + size * 0.78, bodyTop],
    ]), 'mark');
    scene.path(scene.pen.box({ x, y: bodyTop, w: size, h: size - (bodyTop - y) }, 2), 'solid');
  }

  // Disegna dentro il riquadro del campo ciò che ne dice il tipo, e restituisce lo spazio occupato a destra.
  function adorn(scene, box, type) {
    const size = Math.max(8, Math.min(box.h - 6, 16));
    const x = box.x + box.w - size - 5;
    const y = box.y + (box.h - size) / 2;
    const centerX = x + size / 2;
    const centerY = y + size / 2;
    const glyph = (text) => scene.label({ x: x - 8, y: box.y, w: size + 12, h: box.h }, text, 'faint right', 12, 9);

    switch (type) {
      case 'input-date':
        calendar(scene, x, y, size);
        return size + 8;
      case 'input-datetime':
        calendar(scene, x - size - 4, y, size);
        clock(scene, x, y, size);
        return size * 2 + 12;
      case 'input-time':
        clock(scene, x, y, size);
        return size + 8;
      case 'input-number':
        chevron(scene, centerX, centerY - size * 0.25, size * 0.8, true);
        chevron(scene, centerX, centerY + size * 0.25, size * 0.8);
        return size + 8;
      case 'select':
      case 'multiselect':
        chevron(scene, centerX, centerY, size);
        return size + 8;
      case 'input-search':
        magnifier(scene, x, y, size);
        return size + 8;
      case 'input-email':
        glyph('@');
        return size + 8;
      case 'input-url':
        glyph('www');
        return size + 14;
      case 'input-tel':
        glyph('+39');
        return size + 14;
      default:
        return 4;
    }
  }

  // ---------------------------------------------------------------- widget

  // Con `framed` il disegno ha un bordo suo. Senza, è il blocco intero: il bordo è già il suo.
  const widgets = {
    heading(scene, rect, text, { size = 26 }) {
      scene.label(rect, text, 'heading', Math.min(size, Math.max(MIN_FONT, rect.h / LINE_HEIGHT - 2)));
    },

    text(scene, rect, text) {
      const fits = Math.max(1, Math.floor(rect.h / TEXT_ROW));
      const rows = scene.hand ? fits : Math.min(fits, text ? CLEAN_TEXT_ROWS : CLEAN_TEXT_ROWS - 1);
      // Con meno righe di quante ne stanno, il testo parte dall'alto invece di galleggiare al centro.
      const top = rows < fits ? rect.y + 2 : rect.y + (rect.h - rows * TEXT_ROW) / 2;
      for (let row = 0; row < rows; row += 1) {
        const y = top + row * TEXT_ROW;
        if (row === 0 && text) {
          scene.label({ ...rect, y, h: TEXT_ROW }, text, 'body', BODY_FONT, BODY_FONT);
        } else {
          const share = row === rows - 1 && rows > 1 ? scene.pen.vary(0.6, 0.12) : scene.pen.vary(0.93, 0.05);
          textLine(scene, rect.x + 1, y + TEXT_ROW / 2, rect.w * share);
        }
      }
    },

    label(scene, rect, text, { required }) {
      scene.label(rect, required ? `${text} *` : text, 'strong', 14, 13);
    },

    link(scene, rect, text) {
      scene.label(rect, text, 'link', 14, 13);
    },

    button(scene, rect, text, { framed }) {
      if (framed) scene.path(scene.pen.box(rect, scene.hand ? 7 : 5), 'button');
      scene.label(pad(rect, 4, 1), text, 'strong center', BUTTON_FONT, LABEL_FONT);
    },

    iconButton(scene, rect, text, { framed }) {
      if (framed) scene.path(scene.pen.box(rect, scene.hand ? 6 : 5), 'button');
      const size = Math.min(rect.w, rect.h) * 0.6;
      const x = rect.x + (rect.w - size) / 2;
      const y = rect.y + (rect.h - size) / 2;
      if (/cerca|search|lookup|lente/i.test(text)) magnifier(scene, x, y, size);
      else widgets.icon(scene, { x, y, w: size, h: size });
    },

    menu(scene, rect, text, { framed }) {
      if (framed) scene.path(scene.pen.box(rect, scene.hand ? 7 : 5), 'button');
      const arrow = Math.min(16, rect.h - 4);
      scene.label({ ...pad(rect, 4, 1), w: rect.w - arrow - 12 }, text, 'strong center', BUTTON_FONT, LABEL_FONT);
      chevron(scene, rect.x + rect.w - arrow / 2 - 6, rect.y + rect.h / 2, arrow);
    },

    buttonGroup(scene, rect, text) {
      const items = splitItems(text);
      const labels = items.length ? items : ['', '', ''];
      const gap = 6;
      // Bottoni larghi quanto il loro testo e alti come un bottone, non stirati sul blocco.
      const widths = fitWidths(labels, rect.w - gap * (labels.length - 1), 14, 30);
      const height = Math.min(rect.h - 2, 34);
      let x = rect.x;
      labels.forEach((item, index) => {
        widgets.button(scene, { x, y: rect.y + (rect.h - height) / 2, w: widths[index], h: height }, item, { framed: true });
        x += widths[index] + gap;
      });
    },

    nav(scene, rect, text) {
      const items = splitItems(text);
      if (items.length <= 1) return widgets.link(scene, rect, text);
      // Voci vicine, con lo spazio di un menu vero, invece che sparse su tutta la larghezza.
      let x = rect.x;
      for (const item of items) {
        const width = Math.min(measure(item, 14) + 4, rect.x + rect.w - x);
        if (width <= 4) break;
        scene.label({ x, y: rect.y, w: width, h: rect.h }, item, 'link', 14, 13);
        x += width + 20;
      }
      return undefined;
    },

    breadcrumb(scene, rect, text) {
      const items = splitItems(text);
      // Le voci stanno una accanto all'altra, separate da ›, come una breadcrumb vera: non distribuite sul blocco.
      const separator = 18;
      let x = rect.x;
      items.forEach((item, index) => {
        const last = index === items.length - 1;
        const width = Math.min(measure(item, 13, last) + 4, rect.x + rect.w - x);
        if (width <= 4) return;
        scene.label({ x, y: rect.y, w: width, h: rect.h }, item, last ? 'strong' : 'link', 13, 13);
        x += width;
        if (!last) {
          scene.label({ x, y: rect.y, w: separator, h: rect.h }, '›', 'faint center', 13, 13);
          x += separator;
        }
      });
    },

    pagination(scene, rect) {
      const labels = ['‹', '1', '2', '3', '›'];
      const size = Math.min(rect.h - 2, (rect.w - 4 * 4) / labels.length);
      const start = rect.x + (rect.w - (size + 4) * labels.length) / 2;
      labels.forEach((label, index) => {
        const box = { x: start + index * (size + 4), y: rect.y + (rect.h - size) / 2, w: size, h: size };
        scene.path(scene.pen.box(box, 4), index === 1 ? 'shade' : 'field');
        scene.label(box, label, 'strong center', 12, 9);
      });
    },

    tabs(scene, rect, text) {
      const { pen } = scene;
      const items = splitItems(text);
      const labels = items.length ? items : ['', '', ''];
      // Ogni scheda è larga quanto il suo testo e alta come una scheda vera, appoggiata in alto.
      const widths = fitWidths(labels, rect.w, 13, 28);
      const height = Math.min(rect.h - 3, 32);
      const base = rect.y + height + 1;
      scene.path(pen.stroke(rect.x, base, rect.x + rect.w, base), 'mark');
      let x = rect.x;
      labels.forEach((item, index) => {
        const tab = { x: x + 1, y: rect.y + 2, w: widths[index] - 2, h: height - 1 };
        scene.path(pen.box(tab, scene.hand ? 6 : 4), index === 0 ? 'field' : 'shade');
        scene.label(pad(tab, 4, 1), item, index === 0 ? 'strong center' : 'center', 13, 12);
        x += widths[index];
      });
    },

    separator(scene, rect) {
      const y = rect.y + rect.h / 2;
      scene.path(scene.pen.stroke(rect.x, y, rect.x + rect.w, y), 'mark');
    },

    // Opzioni dei vincoli: `readonly` (lucchetto e fondo grigio), `placeholder`
    // (testo tenue nel campo, se l'etichetta non ci sta già) e `counter` (es. "0/50").
    field(scene, rect, text, { type = 'input-text', required, readonly, placeholder: hint, counter }) {
      const { pen } = scene;
      const label = text ? `${text}${required ? ' *' : ''}` : '';
      const tall = type === 'textarea' || type === 'multiselect';
      let box = rect;
      let placeholder = '';

      const besideWidth = label ? measure(label, LABEL_FONT, true) + 10 : 0;
      const fitsBeside = label && rect.w >= 150 && besideWidth <= rect.w * 0.5;
      if (label && (tall || rect.h >= 44 || !fitsBeside) && rect.h >= 34) {
        scene.label({ x: rect.x, y: rect.y, w: rect.w, h: 16 }, label, 'strong', LABEL_FONT, LABEL_FONT);
        const height = tall ? rect.h - 18 : Math.min(rect.h - 18, 30);
        box = { x: rect.x, y: rect.y + 18, w: rect.w, h: Math.max(10, height) };
      } else if (label && rect.w >= 120) {
        const labelWidth = Math.max(60, Math.min(besideWidth, rect.w * 0.5));
        scene.label({ x: rect.x, y: rect.y, w: labelWidth - 4, h: rect.h }, label, 'strong', LABEL_FONT, LABEL_FONT);
        const height = Math.min(rect.h, 30);
        box = { x: rect.x + labelWidth + 4, y: rect.y + (rect.h - height) / 2, w: rect.w - labelWidth - 4, h: height };
      } else {
        placeholder = label;
      }

      if (type === 'lookup') {
        const size = Math.min(box.h, 30);
        const button = { x: box.x + box.w - size, y: box.y + (box.h - size) / 2, w: size, h: size };
        box = { ...box, w: Math.max(10, box.w - size - 4) };
        scene.path(pen.box(button, 4), 'button');
        magnifier(scene, button.x + size * 0.15, button.y + size * 0.15, size * 0.7);
      }

      const fill = readonly ? 'readonly' : 'field';
      const line = tall ? Math.min(box.h, 22) : box.h;
      scene.path(pen.box(box, 4), fill);

      // Il lucchetto sta in fondo a destra; le decorazioni del tipo si spostano alla sua sinistra.
      let end = 0;
      if (type === 'input-file') {
        const width = Math.min(70, box.w * 0.42);
        const button = { x: box.x + box.w - width, y: box.y, w: width, h: box.h };
        scene.path(pen.box(pad(button, 2), 4), 'button');
        scene.label(button, 'Sfoglia', 'strong center', 11, 9);
        end = width + 4;
      }
      if (readonly) {
        const size = Math.max(8, Math.min(line - 10, 12));
        lock(scene, box.x + box.w - end - size - 6, box.y + (line - size) / 2, size);
        end += size + 8;
      }
      const reserved = end + (type === 'input-file' ? 0 : adorn(scene, { ...box, w: Math.max(10, box.w - end) }, type));

      const inside = { x: box.x + 7, y: box.y, w: Math.max(4, box.w - 7 - reserved), h: line };
      const shown = placeholder || hint || '';
      if (type === 'input-password') {
        scene.label(inside, '••••••', 'faint', 13);
      } else if (shown) {
        scene.label(inside, shown, 'faint', BODY_FONT, LABEL_FONT);
      }

      if (type === 'textarea' && box.h >= 40) {
        const rows = [];
        for (let y = box.y + 26; y < box.y + box.h - 10; y += TEXT_ROW) rows.push(y);
        for (const y of scene.hand ? rows : rows.slice(0, CLEAN_TEXT_ROWS - 1)) {
          textLine(scene, box.x + 8, y, (box.w - 20) * pen.vary(0.8, 0.15));
        }
        const corner = { x: box.x + box.w - 4, y: box.y + box.h - 4 };
        scene.path(pen.stroke(corner.x - 10, corner.y, corner.x, corner.y - 10) + pen.stroke(corner.x - 5, corner.y, corner.x, corner.y - 5), 'scribble');
      }
      if (counter && tall && box.h >= 30) {
        scene.label({ x: box.x + box.w - 84, y: box.y + box.h - 17, w: 66, h: 14 }, String(counter), 'faint right', 11, 10);
      }
      if (type === 'multiselect' && box.h >= 26) {
        const chip = Math.min(18, box.h - 8);
        [0, 1].forEach((index) => scene.path(pen.box({ x: box.x + 6 + index * 52, y: box.y + 4, w: 46, h: chip }, 6), 'shade'));
      }
    },

    input(scene, rect, text, options) {
      widgets.field(scene, rect, text, { ...options, type: options.type?.startsWith('input') ? options.type : 'input-text' });
    },

    check(scene, rect, text, { required }) {
      const size = Math.min(14, rect.h - 2);
      const y = rect.y + (rect.h - size) / 2;
      scene.path(scene.pen.box({ x: rect.x + 1, y, w: size, h: size }, 2), 'field');
      scene.path(scene.pen.trace([[rect.x + size * 0.25, y + size * 0.5], [rect.x + size * 0.45, y + size * 0.75], [rect.x + size * 0.9, y + size * 0.2]]), 'mark');
      scene.label({ x: rect.x + size + 8, y: rect.y, w: rect.w - size - 8, h: rect.h }, required ? `${text} *` : text, 'body', BODY_FONT);
    },

    radio(scene, rect, text, { required }) {
      const radius = Math.min(7, (rect.h - 2) / 2);
      const centerY = rect.y + rect.h / 2;
      scene.path(scene.pen.ring(rect.x + radius + 1, centerY, radius), 'field');
      scene.path(scene.pen.ring(rect.x + radius + 1, centerY, radius * 0.45), 'solid');
      scene.label({ x: rect.x + radius * 2 + 8, y: rect.y, w: rect.w - radius * 2 - 8, h: rect.h }, required ? `${text} *` : text, 'body', BODY_FONT);
    },

    toggle(scene, rect, text, { required }) {
      const height = Math.min(16, rect.h - 2);
      const width = height * 2;
      const y = rect.y + (rect.h - height) / 2;
      scene.path(scene.pen.box({ x: rect.x + 1, y, w: width, h: height }, height / 2), 'shade');
      scene.path(scene.pen.ring(rect.x + width - height / 2 + 1, y + height / 2, height * 0.36), 'solid');
      scene.label({ x: rect.x + width + 8, y: rect.y, w: rect.w - width - 8, h: rect.h }, required ? `${text} *` : text, 'body', BODY_FONT);
    },

    range(scene, rect, text) {
      let track = rect;
      if (text && rect.w >= 150) {
        const labelWidth = Math.min(rect.w * 0.35, 150);
        scene.label({ ...rect, w: labelWidth - 6 }, text, 'strong', LABEL_FONT, LABEL_FONT);
        track = { ...rect, x: rect.x + labelWidth, w: rect.w - labelWidth };
      }
      const y = track.y + track.h / 2;
      scene.path(scene.pen.stroke(track.x + 2, y, track.x + track.w - 2, y), 'mark');
      scene.path(scene.pen.ring(track.x + track.w * 0.6, y, Math.min(7, track.h / 2 - 1)), 'field');
    },

    badge(scene, rect, text) {
      const height = Math.min(rect.h, 20);
      const box = { x: rect.x, y: rect.y + (rect.h - height) / 2, w: rect.w, h: height };
      scene.path(scene.pen.box(box, height / 2), 'shade');
      scene.label(pad(box, 4, 1), text, 'strong center', 12, 9);
    },

    alert(scene, rect, text, { framed }) {
      if (framed) scene.path(scene.pen.box(rect, 6), 'shade');
      const size = Math.min(18, rect.h - 4);
      const centerY = rect.y + rect.h / 2;
      scene.path(scene.pen.ring(rect.x + 6 + size / 2, centerY, size / 2), 'mark');
      scene.label({ x: rect.x + 6, y: centerY - size / 2, w: size, h: size }, '!', 'strong center', 12, 9);
      scene.label({ x: rect.x + size + 14, y: rect.y, w: rect.w - size - 18, h: rect.h }, text, 'body', BODY_FONT);
    },

    box(scene, rect, text) {
      scene.path(scene.pen.box(rect, 6), 'shade');
      scene.label(pad(rect, 6, 2), text, 'center', BODY_FONT);
    },

    card(scene, rect, text, { framed }) {
      if (framed) scene.path(scene.pen.box(rect, 6), 'shade');
      widgets.content(scene, pad(rect, framed ? 6 : 0, framed ? 4 : 0), text);
    },

    modal(scene, rect, text) {
      const { pen } = scene;
      const bar = Math.min(26, rect.h / 3);
      scene.label({ ...rect, w: rect.w - 24, h: bar }, text, 'strong', 15, 13);
      scene.label({ x: rect.x + rect.w - 18, y: rect.y, w: 16, h: bar }, '×', 'strong center', 16);
      scene.path(pen.stroke(rect.x, rect.y + bar, rect.x + rect.w, rect.y + bar), 'mark');
      if (rect.h > bar + 50) {
        widgets.text(scene, { ...rect, y: rect.y + bar + 6, h: rect.h - bar - 44 }, '');
        const button = { x: rect.x + rect.w - 86, y: rect.y + rect.h - 30, w: 84, h: 26 };
        widgets.button(scene, button, 'Conferma', { framed: true });
      }
    },

    image(scene, rect, text, { framed }) {
      const { pen } = scene;
      if (framed) scene.path(pen.box(rect, 5), 'shade');

      if (rect.w < 44 || rect.h < 30) {
        scene.path(pen.stroke(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h) + pen.stroke(rect.x + rect.w, rect.y, rect.x, rect.y + rect.h), 'mark');
        return;
      }

      const caption = text && rect.h >= 90 ? 20 : 0;
      const size = Math.min(rect.w * 0.5, (rect.h - caption) * 0.66);
      const centerX = rect.x + rect.w / 2;
      const centerY = rect.y + (rect.h - caption) / 2;
      const base = centerY + size * 0.42;
      scene.path(pen.trace([
        [centerX - size * 0.62, base],
        [centerX - size * 0.2, centerY - size * 0.26],
        [centerX + size * 0.05, centerY + size * 0.08],
        [centerX + size * 0.28, centerY - size * 0.1],
        [centerX + size * 0.62, base],
        [centerX - size * 0.62, base],
      ]), 'mark');
      scene.path(pen.ring(centerX + size * 0.38, centerY - size * 0.32, size * 0.11), 'mark');
      if (caption) scene.label({ ...rect, y: rect.y + rect.h - caption, h: caption - 2 }, text, 'faint center', 12);
    },

    icon(scene, rect) {
      const size = Math.min(rect.w, rect.h);
      const centerX = rect.x + rect.w / 2;
      const centerY = rect.y + rect.h / 2;
      const points = [];
      for (let index = 0; index <= 10; index += 1) {
        const angle = -Math.PI / 2 + (index * Math.PI) / 5;
        const reach = index % 2 === 0 ? size * 0.45 : size * 0.2;
        points.push([centerX + Math.cos(angle) * reach, centerY + Math.sin(angle) * reach]);
      }
      scene.path(scene.pen.trace(points), 'mark');
    },

    video(scene, rect, text, { framed }) {
      const { pen } = scene;
      if (framed) scene.path(pen.box(rect, 5), 'shade');
      const radius = Math.min(rect.w, rect.h) * 0.26;
      const centerX = rect.x + rect.w / 2;
      const centerY = rect.y + rect.h / 2;
      scene.path(pen.ring(centerX, centerY, radius), 'mark');
      scene.path(pen.trace([
        [centerX - radius * 0.32, centerY - radius * 0.46],
        [centerX + radius * 0.52, centerY],
        [centerX - radius * 0.32, centerY + radius * 0.46],
        [centerX - radius * 0.32, centerY - radius * 0.46],
      ]), 'solid');
    },

    list(scene, rect, text) {
      const rows = Math.max(1, Math.floor(rect.h / TEXT_ROW));
      for (let row = 0; row < rows; row += 1) {
        const y = rect.y + row * TEXT_ROW;
        scene.path(scene.pen.ring(rect.x + 4, y + TEXT_ROW / 2, 2.2), 'solid');
        if (row === 0 && text) {
          scene.label({ x: rect.x + 13, y, w: rect.w - 13, h: TEXT_ROW }, text, 'body', BODY_FONT, BODY_FONT);
        } else {
          textLine(scene, rect.x + 14, y + TEXT_ROW / 2, (rect.w - 14) * scene.pen.vary(0.7, 0.2));
        }
      }
    },

    tree(scene, rect, text) {
      const rows = Math.max(1, Math.floor(rect.h / TEXT_ROW));
      const indents = [0, 1, 2, 2, 1, 2, 0, 1];
      for (let row = 0; row < rows; row += 1) {
        const y = rect.y + row * TEXT_ROW;
        const x = rect.x + indents[row % indents.length] * 14;
        scene.path(scene.pen.box({ x, y: y + 5, w: 8, h: 8 }, 1), 'mark');
        if (row === 0 && text) scene.label({ x: x + 13, y, w: rect.w - (x - rect.x) - 13, h: TEXT_ROW }, text, 'body', BODY_FONT, BODY_FONT);
        else textLine(scene, x + 14, y + TEXT_ROW / 2, Math.max(10, (rect.w - (x - rect.x) - 14) * scene.pen.vary(0.5, 0.2)));
      }
    },

    table(scene, rect, text, { edge = false } = {}) {
      const { pen } = scene;
      const columnCount = Math.max(2, Math.min(5, Math.round(rect.w / 110)));
      const rows = Math.max(2, Math.min(8, Math.floor(rect.h / 22)));
      // Nei temi puliti la riga d'intestazione è velata, come in una tabella vera. Con `edge` la
      // tabella è il blocco stesso: il velo segue gli angoli arrotondati del bordo in alto.
      if (!scene.hand) {
        const { x, y, w } = rect;
        const h = rect.h / rows;
        const r = edge ? Math.min(OUTLINE_RADIUS, w / 3, h) : 0;
        const d = `M${tidy(x)} ${tidy(y + h)}L${tidy(x)} ${tidy(y + r)}Q${tidy(x)} ${tidy(y)} ${tidy(x + r)} ${tidy(y)}L${tidy(x + w - r)} ${tidy(y)}Q${tidy(x + w)} ${tidy(y)} ${tidy(x + w)} ${tidy(y + r)}L${tidy(x + w)} ${tidy(y + h)}Z`;
        scene.path(d, 'shade');
      }
      for (let row = 1; row < rows; row += 1) {
        const y = rect.y + (rect.h * row) / rows;
        scene.path(pen.stroke(rect.x, y, rect.x + rect.w, y), 'mark');
      }
      for (let column = 1; column < columnCount; column += 1) {
        const x = rect.x + (rect.w * column) / columnCount;
        scene.path(pen.stroke(x, rect.y, x, rect.y + rect.h), 'mark');
      }
      // Intestazioni solo da un elenco ("Codice | Descrizione"): un testo singolo è la didascalia della tabella.
      const headers = splitItems(text);
      if (headers.length < 2) return;
      headers.slice(0, columnCount).forEach((header, column) => {
        const w = rect.w / columnCount;
        scene.label({ x: rect.x + column * w + 4, y: rect.y, w: w - 8, h: rect.h / rows }, header, 'strong', 12, 10);
      });
    },

    gallery(scene, rect, count) {
      const columnCount = Math.min(count, Math.max(1, Math.round(Math.sqrt((count * rect.w) / rect.h))));
      const rows = Math.ceil(count / columnCount);
      const gap = 6;
      const w = (rect.w - gap * (columnCount - 1)) / columnCount;
      const h = (rect.h - gap * (rows - 1)) / rows;
      for (let index = 0; index < count; index += 1) {
        const x = rect.x + (index % columnCount) * (w + gap);
        const y = rect.y + Math.floor(index / columnCount) * (h + gap);
        scene.path(scene.pen.box({ x, y, w, h }, 5), 'shade');
      }
    },

    content(scene, rect, text) {
      const title = Math.min(22, rect.h);
      scene.label({ ...rect, h: title }, text, 'strong', 15, 13);
      if (rect.h >= title + TEXT_ROW) {
        widgets.text(scene, { ...rect, y: rect.y + title, h: rect.h - title }, '');
      }
    },
  };
  widgets.header = widgets.content;
  widgets.footer = widgets.content;
  widgets.sidebar = widgets.list;

  const drawOf = (type) => CATALOG.get(type)?.draw ?? 'content';
  const widgetOf = (type) => widgets[drawOf(type)] ?? widgets.content;

  // Disegna un blocco (o una tessera della libreria) nel suo contenitore, che deve avere
  // i figli `.sk` (svg) e `.sk-text`. Opzioni:
  //   section      è una sezione: solo bordo e, con `caption`, il titolo in alto
  //   caption      mostra il label della sezione (l'editor lo omette se è già dentro)
  //   hand         forza la penna (true a mano, false pulita); senza, decide il tema
  //   readonly, placeholder, counter   vincoli dei campi, vedi widgets.field
  //   scale        forza la scala (le tessere della libreria usano 1); senza, quella di setScale
  function sketch(content, info, kind, actualWidth, actualHeight, options = {}) {
    const { section = false, caption = false, hand = isHand(), readonly = false, placeholder = '', counter = '' } = options;
    const zoom = options.scale ?? scale;
    const width = actualWidth / zoom;
    const height = actualHeight / zoom;
    const frame = { x: INSET, y: INSET, w: width - INSET * 2, h: height - INSET * 2 };
    const ghost = !section && !info.parts?.length && GHOSTED.has(kind);
    const inner = ghost ? pad(frame, 4, 1) : pad(frame, PADDING, 1);
    const scene = createScene(content, hashOf(info.id ?? info.type ?? 'tessera'), hand, zoom, width, height);
    const label = info.label ?? '';
    const widgetOptions = { size: HEADING_SIZES[info.tag], type: info.type, required: info.required, readonly, placeholder, counter };

    scene.path(scene.pen.box(frame), ghost ? 'ghost' : 'outline');

    if (section) {
      if (caption) scene.label({ x: 11, y: 3, w: width - 22, h: 17 }, label, 'caption', 13, 12);
    } else if (info.parts?.length > 0 && COMPOSITE.has(info.type) && info.parts.some((part) => part[5])) {
      // Schede, gruppi di bottoni, navigazione: si disegnano come il loro tipo, con i testi
      // delle parti. Le misure prese dalla pagina darebbero schede alte quanto tutto il blocco.
      const text = info.parts.filter((part) => part[5] && !/^[›»/|·]$/.test(part[5])).map((part) => part[5]).join(' · ');
      (widgets[kind] ?? widgets.content)(scene, inner, text, widgetOptions);
    } else if (info.parts?.length > 0) {
      const rects = info.parts.map(([, x, y, w, h]) => ({
        x: frame.x + (x / 100) * frame.w,
        y: frame.y + (y / 100) * frame.h,
        w: Math.max(6, (w / 100) * frame.w),
        h: Math.max(6, (h / 100) * frame.h),
      }));
      scene.quietly(() => info.parts.forEach(([partType, , , , , text = ''], index) => {
        const rect = { ...rects[index] };
        // Il riquadro di un testo viene dalla pagina, con un altro font: lo si allarga fino
        // alla parte successiva sulla stessa riga, così il testo resta intero.
        if (text && ['text', 'heading', 'link', 'label'].includes(partType)) {
          const next = rects
            .filter((other, at) => at !== index && other.x > rect.x + 2 && other.y < rect.y + rect.h && other.y + other.h > rect.y)
            .reduce((edge, other) => Math.min(edge, other.x - 6), frame.x + frame.w - 4);
          rect.w = Math.max(rect.w, next - rect.x);
        }
        const entry = CATALOG.get(partType);
        widgetOf(partType)(scene, rect, text, { framed: true, type: entry?.type ?? partType });
      }));
    } else if (info.repeat) {
      widgets.gallery(scene, inner, info.repeat);
    } else {
      // La tabella occupa tutto il blocco: righe e colonne arrivano fino al bordo, senza margini ai lati.
      const area = FULL_BLEED.has(kind) ? frame : inner;
      (widgets[kind] ?? widgets.content)(scene, area, label, { ...widgetOptions, edge: FULL_BLEED.has(kind) });
    }

    const sticker = STICKERS[info.status];
    if (sticker && width >= STICKER_MIN_WIDTH && height >= STICKER_MIN_HEIGHT) scene.sticker(sticker);
    scene.paint();
  }

  // Il foglio imita una finestra del browser: bordo, barra con i tre pallini e indirizzo.
  function drawSheet(svg, width, height) {
    const pen = createPen(hashOf('pagina'));
    const paths = [
      ['outline', pen.box({ x: 2, y: 2, w: width - 4, h: height - 4 }, isHand() ? 12 : 8)],
      ['', pen.stroke(2, CHROME_HEIGHT, width - 2, CHROME_HEIGHT)],
      ['', pen.ring(22, 22, 6)],
      ['', pen.ring(41, 22, 6)],
      ['', pen.ring(60, 22, 6)],
      ['field', pen.box({ x: 82, y: 9, w: width - 104, h: 25 }, isHand() ? 9 : 6)],
    ];
    svg.innerHTML = paths.map(([className, path]) => `<path class="${className}" d="${path}"/>`).join('');
  }

  return {
    THEMES,
    DEFAULT_THEME,
    setTheme,
    getTheme: () => theme,
    setScale,
    getScale: () => scale,
    isHand,
    sketch,
    drawSheet,
    createPen,
    hashOf,
    splitItems,
    drawOf,
  };
})();
