'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { raiz } = require('./helpers/carregar');
function worker(offline = false, nomes = []) {
  const handlers = {}, chamadas = [], gravacoes = [], adicionados = [], apagados = [];
  const resposta = { ok: true, clone: () => 'copia' };
  const cache = { put: async (...args) => { gravacoes.push(args); }, addAll: async a => { adicionados.push(...a); } };
  vm.runInNewContext(fs.readFileSync(path.join(raiz, 'sw.js'), 'utf8'), {
    URL, Response: { error: () => 'erro' },
    self: { location: { origin: 'https://x.github.io' }, addEventListener: (n, f) => { handlers[n] = f; },
      skipWaiting: async () => {}, clients: { claim: async () => {} } },
    caches: { open: async () => cache, match: async (chave) => { chamadas.push(chave); return 'casco'; },
      keys: async () => nomes, delete: async n => { apagados.push(n); return true; } },
    fetch: async () => { if (offline) throw new Error('offline simulado'); return resposta; }
  });
  return { handlers, chamadas, gravacoes, adicionados, resposta, apagados };
}
test('SW ignora Firebase e POST; GET do próprio domínio usa rede primeiro', async () => {
  const w = worker();
  for (const request of [{ url: 'https://firestore.googleapis.com/dados', method: 'GET' },
    { url: 'https://x.github.io/eventos', method: 'POST' }]) {
    w.handlers.fetch({ request, respondWith() { assert.fail('Não deve interceptar'); } });
  }
  let promessa;
  const req = { url: 'https://x.github.io/index.html', method: 'GET', mode: 'navigate' };
  w.handlers.fetch({ request: req, respondWith(p) { promessa = p; } });
  assert.ok(promessa); assert.equal(await promessa, w.resposta);
  assert.equal(w.chamadas.length, 0);
  assert.deepEqual(w.gravacoes, [['./index.html', 'copia']]);
});
test('SW offline navigate recupera ./index.html', async () => {
  const w = worker(true); let promessa;
  w.handlers.fetch({ request: { url: 'https://x.github.io/eventos/', method: 'GET', mode: 'navigate' },
    respondWith(p) { promessa = p; } });
  assert.equal(await promessa, 'casco');
  assert.deepEqual(w.chamadas, ['./index.html']);
});
test('SW instala somente arquivos locais do casco', async () => {
  const w = worker(); let promessa;
  w.handlers.install({ waitUntil(p) { promessa = p; } }); await promessa;
  assert.deepEqual(w.adicionados, ['./', './index.html', './manifest.webmanifest',
    './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png']);
});
test('manifest válido e dimensões PNG conferem com IHDR, incluindo Apple 180', () => {
  const m = JSON.parse(fs.readFileSync(path.join(raiz, 'manifest.webmanifest'), 'utf8'));
  assert.equal(m.start_url, './'); assert.equal(m.scope, './');
  for (const icone of [...m.icons, { src: 'icons/apple-touch-icon.png', sizes: '180x180' }]) {
    const b = fs.readFileSync(path.join(raiz, icone.src));
    assert.equal(b.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(b.toString('ascii', 12, 16), 'IHDR');
    assert.equal(`${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`, icone.sizes);
  }
});

test('SW remove somente caches antigos do prefixo eventos-leao-', async () => {
 const w = worker(false, ['eventos-leao-casco-v1', 'eventos-leao-casco-v2', 'outro-app-v1']);
 let promessa; w.handlers.activate({ waitUntil(p) { promessa = p; } }); await promessa;
 assert.deepEqual(w.apagados, ['eventos-leao-casco-v1']);
});
