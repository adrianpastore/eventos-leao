// Service worker do Eventos · Leão do Parque.
// Só guarda o "casco" do app (a página, o manifesto e os ícones) para ele abrir sem internet.
// Sempre tenta a rede primeiro: com internet, a versão nova do site entra na hora.
// Os dados (Firebase/Google) NÃO passam por aqui: o próprio Firestore cuida do modo offline.

const CACHE = 'eventos-leao-casco-v1';
const CASCO = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', evento => {
  evento.waitUntil(caches.open(CACHE).then(c => c.addAll(CASCO)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', evento => {
  const req = evento.request;
  // só arquivos do próprio site; Firebase, googleapis e gstatic seguem direto para a internet
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  const ehPagina = req.mode === 'navigate';
  evento.respondWith(
    fetch(req)
      .then(resp => {
        if (resp.ok) {
          const copia = resp.clone();
          caches.open(CACHE).then(c => c.put(ehPagina ? './index.html' : req, copia));
        }
        return resp;
      })
      .catch(() =>
        caches.match(ehPagina ? './index.html' : req, { ignoreSearch: true })
          .then(r => r || (ehPagina ? caches.match('./') : undefined))
          .then(r => r || Response.error())
      )
  );
});
