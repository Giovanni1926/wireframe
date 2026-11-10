#!/usr/bin/env node
// Server locale della skill wireframe.
// Tiene tutto in memoria, non scrive su disco e ascolta solo su 127.0.0.1.
//
//   node serve.mjs [--open] < spec.json    wireframe trascinabile
//   node serve.mjs --site <cartella>       file statici in sola lettura

import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'assets');
const IDLE_MS = 60 * 60 * 1000;
const MAX_BODY = 8 * 1024 * 1024;
const EDITOR_FILES = new Set(['/editor.js', '/catalog.js', '/sketch.js', '/themes.css', '/constraints.js']);
const TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const args = process.argv.slice(2);
const siteFlag = args.indexOf('--site');
const shouldOpen = args.includes('--open');
const token = randomBytes(16).toString('hex');

let spec = null;
let state = null;
let idleTimer = null;

function fail(message) {
  console.error(`WIREFRAME_ERROR ${message}`);
  process.exit(1);
}

function send(res, status, body = '', type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function sendJson(res, status, value) {
  send(res, status, JSON.stringify(value), TYPES['.json']);
}

async function sendFile(res, root, pathname) {
  const hidden = pathname.split('/').some((part) => part.startsWith('.'));
  if (hidden) return send(res, 404, 'Non trovato');

  try {
    let file = resolve(root, `.${pathname}`);
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
    const real = await realpath(file);
    if (!real.startsWith(root + sep)) return send(res, 404, 'Non trovato');
    send(res, 200, await readFile(real), TYPES[extname(real).toLowerCase()] ?? 'application/octet-stream');
  } catch {
    send(res, 404, 'Non trovato');
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error('corpo troppo grande');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function shutdown(res, reason) {
  const stop = () => {
    console.log(`WIREFRAME_CLOSED ${reason}`);
    process.exit(0);
  };
  if (res) res.on('finish', stop);
  else stop();
}

function touch() {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => shutdown(null, 'inattivita'), IDLE_MS);
}

async function handleWireframe(req, res, url) {
  const { pathname } = url;
  if (req.method === 'GET' && pathname === '/') return sendFile(res, ASSETS, '/editor.html');
  if (req.method === 'GET' && (pathname.startsWith('/vendor/') || EDITOR_FILES.has(pathname))) return sendFile(res, ASSETS, pathname);
  if (req.method === 'GET' && pathname === '/spec') return sendJson(res, 200, spec);
  if (req.method === 'GET' && pathname === '/ping') return send(res, 204);
  if (req.method === 'GET' && pathname === '/state') return state ? sendJson(res, 200, state) : send(res, 204);

  if (req.method === 'POST' && pathname === '/state') {
    try {
      state = JSON.parse(await readBody(req));
      return send(res, 204);
    } catch {
      return send(res, 400, 'Stato non valido');
    }
  }

  if (req.method === 'GET' && pathname === '/result') {
    // Lo snapshot serve solo all'editor per riprendere dopo un ricaricamento.
    const { snapshot, ...saved } = state ?? {};
    const result = state
      ? saved
      : { opened: false, changed: false, moves: [], added: [], removed: [], edited: [], notes: [], final: spec.blocks };
    if (url.searchParams.get('close') === '1') shutdown(res, 'risultato letto');
    return sendJson(res, 200, result);
  }

  send(res, 404, 'Non trovato');
}

async function handle(req, res, root) {
  // L'host blocca il DNS rebinding, l'origine blocca le richieste di altri siti.
  const host = `127.0.0.1:${server.address().port}`;
  if (req.headers.host !== host) return send(res, 403, 'Host non valido');
  if (req.headers.origin && req.headers.origin !== `http://${host}`) return send(res, 403, 'Origine non valida');

  let url;
  let pathname;
  try {
    url = new URL(req.url, 'http://127.0.0.1');
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return send(res, 400, 'Indirizzo non valido');
  }

  // Il token protegge solo ciò che usa Claude: l'indirizzo per l'utente resta semplice.
  const needsToken = pathname === '/__close' || (!root && pathname === '/result');
  if (needsToken && url.searchParams.get('t') !== token) return send(res, 403, 'Token non valido');

  touch();

  if (pathname === '/__close') {
    shutdown(res, 'chiuso');
    return send(res, 204);
  }

  if (root) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Metodo non permesso');
    return sendFile(res, root, pathname);
  }

  return handleWireframe(req, res, url);
}

async function readSpec() {
  if (process.stdin.isTTY) fail('passa i dati del wireframe su stdin');

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);

  try {
    spec = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch (error) {
    fail(`JSON non valido: ${error.message}`);
  }
  if (!Array.isArray(spec?.blocks) || spec.blocks.length === 0) fail('il campo "blocks" deve avere almeno un blocco');
}

function openBrowser(url) {
  const [command, ...prefix] =
    process.platform === 'darwin' ? ['open'] : process.platform === 'win32' ? ['cmd', '/c', 'start', ''] : ['xdg-open'];
  const child = spawn(command, [...prefix, url], { stdio: 'ignore', detached: true });
  child.on('error', () => console.log('WIREFRAME_OPEN_FAILED'));
  child.unref();
}

let siteRoot = null;
if (siteFlag >= 0) {
  if (!args[siteFlag + 1]) fail('--site richiede una cartella');
  siteRoot = await realpath(args[siteFlag + 1]).catch(() => fail(`cartella non trovata: ${args[siteFlag + 1]}`));
} else {
  await readSpec();
}

const server = createServer((req, res) => {
  handle(req, res, siteRoot).catch(() => send(res, 500, 'Errore del server'));
});

server.listen(0, '127.0.0.1', () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  touch();

  if (siteRoot) {
    console.log(`SITE_URL=${base}/`);
    console.log(`CLOSE_URL=${base}/__close?t=${token}`);
    return;
  }

  const url = `${base}/`;
  console.log(`WIREFRAME_URL=${url}`);
  console.log(`RESULT_URL=${base}/result?t=${token}&close=1`);
  if (shouldOpen) openBrowser(url);
});
