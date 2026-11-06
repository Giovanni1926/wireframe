// Vincoli applicativi dei campi: obbligatorietà, lunghezze, intervalli, formati, messaggi.
// Modulo autonomo: l'editor lo usa per la sezione "Vincoli" dell'Inspector, il disegno,
// lo schema testuale e il risultato. Nessuna dipendenza, nessun modulo ES.
// Modello sul blocco: required, readonly, disabled (booleani) e constraints
// { minLength, maxLength, min, max, decimals, format, pattern, default, message }, solo chiavi non vuote.
window.WF_CONSTRAINTS = (() => {
  const FORMATS = [
    { id: 'codice-fiscale', name: 'Codice fiscale', short: 'CF', placeholder: 'RSSMRA80A01H501U', pattern: '^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$' },
    { id: 'partita-iva', name: 'Partita IVA', short: 'P.IVA', placeholder: 'IT00000000000', pattern: '^(IT)?[0-9]{11}$' },
    { id: 'iban', name: 'IBAN', short: 'IBAN', placeholder: 'IT60X0542811101000000123456', pattern: '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$' },
    { id: 'email', name: 'Email', short: 'email', placeholder: 'nome@dominio.it', pattern: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$' },
    { id: 'cap', name: 'CAP', short: 'CAP', placeholder: '00100', pattern: '^[0-9]{5}$' },
    { id: 'telefono', name: 'Telefono', short: 'tel.', placeholder: '+39 ...', pattern: '^\\+?[0-9 ]{6,20}$' },
    { id: 'cifre', name: 'Solo cifre', short: 'cifre', placeholder: '', pattern: '^[0-9]+$' },
    { id: 'regex', name: 'Personalizzato (regex)', short: 'regex', placeholder: '', pattern: '' },
  ];
  const formatOf = (id) => FORMATS.find((format) => format.id === id);

  const FLAGS = ['required', 'readonly', 'disabled'];
  const KEYS = ['minLength', 'maxLength', 'min', 'max', 'decimals', 'format', 'pattern', 'default', 'message'];
  const INTEGER_KEYS = new Set(['minLength', 'maxLength', 'decimals']);
  const TEXT = new Set(['input-text', 'input-search', 'input-tel', 'input-url', 'input-email', 'input-password', 'lookup', 'textarea']);
  const NUMERIC = new Set(['input-number', 'range']);
  // Tipo HTML del controllo per min/max: i valori restano nel formato ISO dell'input.
  const TEMPORAL = { 'input-date': 'date', 'input-time': 'time', 'input-datetime': 'datetime-local' };
  const CHOICE = new Set(['select', 'multiselect', 'checkbox', 'radio', 'toggle']);

  const BOUND_LABELS = {
    'input-date': ['Data minima', 'Data massima'],
    'input-time': ['Ora minima', 'Ora massima'],
    'input-datetime': ['Data e ora minima', 'Data e ora massima'],
  };
  const DATE_HINTS = { 'input-date': 'gg/mm/aaaa', 'input-time': 'hh:mm', 'input-datetime': 'gg/mm/aaaa hh:mm' };

  // Chiavi sensate per il tipo, flag compresi. Un tipo che non è un campo non ne ha.
  function applicable(type) {
    if (TEXT.has(type)) return [...FLAGS, 'minLength', 'maxLength', 'format', 'pattern', 'default', 'message'];
    if (NUMERIC.has(type)) return [...FLAGS, 'min', 'max', 'decimals', 'default', 'message'];
    if (TEMPORAL[type]) return [...FLAGS, 'min', 'max', 'default', 'message'];
    if (CHOICE.has(type)) return [...FLAGS, 'default', 'message'];
    // Un file non ha un valore predefinito.
    if (type === 'input-file') return [...FLAGS, 'message'];
    return [];
  }

  const isNumeric = (text) => /^-?\d+(\.\d+)?$/.test(text);

  function normalize(constraints) {
    if (!constraints || typeof constraints !== 'object') return undefined;
    const result = {};
    for (const key of KEYS) {
      let value = constraints[key];
      if (value === undefined || value === null) continue;
      if (INTEGER_KEYS.has(key)) {
        value = typeof value === 'number' ? value : String(value).trim() === '' ? NaN : Number(value);
        if (!Number.isFinite(value)) continue;
        value = Math.max(0, Math.round(value));
      } else if (key === 'min' || key === 'max') {
        if (typeof value === 'number') {
          if (!Number.isFinite(value)) continue;
        } else {
          value = String(value).trim();
          if (!value) continue;
          // Un numero scritto come testo torna numero; date e ore restano stringhe ISO.
          if (isNumeric(value)) value = Number(value);
        }
      } else {
        value = String(value);
        if (!value.trim()) continue;
        if (key === 'format' || key === 'pattern') value = value.trim();
      }
      result[key] = value;
    }
    // Il pattern vale solo con il formato personalizzato.
    if (result.format !== 'regex') delete result.pattern;
    if (result.format && !formatOf(result.format)) delete result.format;
    return Object.keys(result).length > 0 ? result : undefined;
  }

  const clip = (text, length) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);

  function summarize(block) {
    if (!block) return '';
    const items = [];
    if (block.required) items.push('obbl.');
    if (block.readonly) items.push('sola lettura');
    if (block.disabled) items.push('disab.');
    const c = normalize(block.constraints) ?? {};
    if (c.minLength !== undefined && c.maxLength !== undefined) items.push(`lung. ${c.minLength}–${c.maxLength}`);
    else if (c.maxLength !== undefined) items.push(`max ${c.maxLength}`);
    else if (c.minLength !== undefined) items.push(`min ${c.minLength} car.`);
    if (c.format) items.push(c.format === 'regex' && c.pattern ? `regex /${clip(c.pattern, 24)}/` : `formato ${formatOf(c.format)?.short ?? c.format}`);
    if (c.min !== undefined && c.max !== undefined) items.push(`${c.min}–${c.max}`);
    else if (c.min !== undefined) items.push(`≥ ${c.min}`);
    else if (c.max !== undefined) items.push(`≤ ${c.max}`);
    if (c.decimals !== undefined) items.push(`${c.decimals} dec.`);
    if (c.default !== undefined) items.push(`pred. "${clip(c.default, 20)}"`);
    if (c.message !== undefined) items.push('msg errore');
    return items.join(', ');
  }

  // Confronto stabile: stesso contenuto, stesso testo, a prescindere dall'ordine delle chiavi.
  const canonical = (value) => (value ? JSON.stringify(KEYS.filter((key) => key in value).map((key) => [key, value[key]])) : '');

  // required e disabled sono già confrontati dall'editor: qui solo readonly e constraints.
  function diff(before, after) {
    const result = {};
    const wasReadonly = Boolean(before?.readonly);
    const isReadonly = Boolean(after?.readonly);
    if (wasReadonly !== isReadonly) result.readonly = { from: wasReadonly || null, to: isReadonly || null };
    const from = normalize(before?.constraints) ?? null;
    const to = normalize(after?.constraints) ?? null;
    if (canonical(from) !== canonical(to)) result.constraints = { from, to };
    return Object.keys(result).length > 0 ? result : null;
  }

  function hints(info) {
    if (!info) return {};
    const c = normalize(info.constraints) ?? {};
    const result = {};
    const placeholder = c.format ? formatOf(c.format)?.placeholder : DATE_HINTS[info.type];
    if (placeholder) result.placeholder = placeholder;
    if (c.maxLength !== undefined && TEXT.has(info.type)) result.counter = `0/${c.maxLength}`;
    return result;
  }

  function describe(block) {
    if (!block) return null;
    const constraints = normalize(block.constraints);
    if (!block.required && !block.readonly && !block.disabled && !constraints) return null;
    const entry = { id: block.id, type: block.type ?? block.tag, label: block.label ?? '', selector: block.selector };
    if (entry.selector === undefined) delete entry.selector;
    for (const flag of FLAGS) if (block[flag]) entry[flag] = true;
    if (constraints) entry.constraints = constraints;
    return entry;
  }

  // ---------------------------------------------------------------- sezione dell'Inspector

  const CSS = `
  .c-section { margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--edge, #d0d4da); }
  .c-title { margin: 0 0 4px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--soft, #666); }
  .c-flags { display: flex; flex-wrap: wrap; gap: 4px 16px; }
  .c-pair { display: grid; grid-template-columns: 1fr 1fr; gap: 0 8px; }
  .c-pair > div { min-width: 0; }
  .c-section :is(input[type=date], input[type=time], input[type=datetime-local]) { width: 100%; min-width: 0; }
  `;

  // Stato per contenitore: la sezione si ricostruisce solo se cambia il tipo.
  const states = new WeakMap();

  function element(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (key === 'text') node.textContent = value;
      else if (key === 'for') node.htmlFor = value;
      else node[key] = value;
    }
    node.append(...children);
    return node;
  }

  function build(container, state, type) {
    const keys = new Set(applicable(type));
    const els = {};
    const emit = (patch, defer) => state.onChange?.(patch, { defer });

    // Il vincolo modificato si fonde con la copia locale, così un evento non perde gli altri.
    const update = (key, value, defer) => {
      state.constraints = normalize({ ...(state.constraints ?? {}), [key]: value });
      emit({ constraints: state.constraints }, defer);
    };

    const section = element('div', { className: 'c-section' });
    section.append(element('div', { className: 'c-title', text: 'Vincoli' }));

    const flags = element('div', { className: 'c-flags' });
    for (const [flag, text] of [['required', 'Obbligatorio'], ['readonly', 'Sola lettura'], ['disabled', 'Disabilitato']]) {
      const input = element('input', { type: 'checkbox', id: `c-${flag}` });
      input.addEventListener('change', () => emit({ [flag]: input.checked }, false));
      els[flag] = input;
      flags.append(element('label', { className: 'check', for: input.id }, [input, text]));
    }
    section.append(flags);

    // Campo con etichetta; i testi aggiornano in differita durante la digitazione e confermano al cambio.
    const field = (key, text, inputProps, read = (input) => input.value) => {
      const input = element('input', { id: `c-${key}`, ...inputProps });
      input.addEventListener('input', () => update(key, read(input), true));
      input.addEventListener('change', () => update(key, read(input), false));
      els[key] = input;
      return element('div', {}, [element('label', { for: input.id, text }), input]);
    };
    const pair = (...cells) => element('div', { className: 'c-pair' }, cells);
    const toNumber = (input) => (input.value === '' ? undefined : Number(input.value));

    if (keys.has('minLength')) {
      section.append(pair(
        field('minLength', 'Lunghezza min', { type: 'number', min: '0', step: '1' }, toNumber),
        field('maxLength', 'Lunghezza max', { type: 'number', min: '0', step: '1' }, toNumber),
      ));
    }

    if (keys.has('min')) {
      const numeric = NUMERIC.has(type);
      const [minText, maxText] = BOUND_LABELS[type] ?? ['Minimo', 'Massimo'];
      const props = numeric ? { type: 'number', step: 'any' } : { type: TEMPORAL[type] };
      // Per numero e cursore il valore è un numero; per date e ore la stringa ISO dell'input.
      const read = numeric ? toNumber : (input) => input.value;
      section.append(pair(field('min', minText, props, read), field('max', maxText, props, read)));
    }

    if (keys.has('decimals')) {
      section.append(pair(field('decimals', 'Decimali', { type: 'number', min: '0', max: '10', step: '1' }, toNumber), element('div')));
    }

    if (keys.has('format')) {
      const select = element('select', { id: 'c-format' });
      select.append(new Option('Nessuno', ''));
      for (const format of FORMATS) select.append(new Option(format.name, format.id));
      select.addEventListener('change', () => {
        els.patternRow.hidden = select.value !== 'regex';
        update('format', select.value, false);
      });
      els.format = select;
      section.append(element('div', {}, [element('label', { for: select.id, text: 'Formato' }), select]));
      const patternRow = field('pattern', 'Pattern (regex)', { type: 'text', placeholder: '^[A-Z]{3}[0-9]+$', spellcheck: false });
      els.patternRow = patternRow;
      section.append(patternRow);
    }

    if (keys.has('default')) {
      const placeholder = CHOICE.has(type) ? (['checkbox', 'toggle'].includes(type) ? 'sì / no' : 'opzione') : '';
      section.append(field('default', 'Valore predefinito', { type: 'text', placeholder }));
    }
    if (keys.has('message')) {
      section.append(field('message', 'Messaggio di errore', { type: 'text', placeholder: 'es. Inserire un codice fiscale valido' }));
    }

    container.replaceChildren(section);
    state.type = type;
    state.els = els;
  }

  function fill(state, info) {
    const { els } = state;
    const c = state.constraints ?? {};
    const focused = document.activeElement;
    for (const flag of FLAGS) els[flag].checked = Boolean(info[flag]);
    for (const key of KEYS) {
      const input = els[key];
      // Non si riscrive il campo in cui l'utente sta scrivendo.
      if (!input || input === focused) continue;
      input.value = c[key] === undefined ? '' : String(c[key]);
    }
    if (els.patternRow) els.patternRow.hidden = c.format !== 'regex';
  }

  // Ricostruisce o aggiorna la sezione per il blocco dato; richiamabile a ogni cambio di selezione.
  function renderSection(container, info, onChange) {
    if (!container) return;
    const type = info?.type;
    if (!info || applicable(type).length === 0) {
      container.replaceChildren();
      container.hidden = true;
      states.delete(container);
      return;
    }
    let state = states.get(container);
    if (!state) {
      state = {};
      states.set(container, state);
    }
    state.onChange = onChange;
    // Un altro blocco o il blocco cambiato fuori dalla sezione: la copia locale si rilegge.
    if (state.id !== info.id || document.activeElement?.closest?.('.c-section') !== container.firstElementChild) {
      state.constraints = normalize(info.constraints);
    }
    state.id = info.id;
    if (state.type !== type || !state.els) build(container, state, type);
    fill(state, info);
    container.hidden = false;
  }

  return { FORMATS, css: CSS, applicable, renderSection, normalize, summarize, diff, hints, describe };
})();
