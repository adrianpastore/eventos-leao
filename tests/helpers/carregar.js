'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const raiz = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
const script = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(m => !/\bsrc\s*=/.test(m[1])).map(m => m[2]).join('\n');

// O compilador reconhece o fim da declaração, inclusive templates, regex e
// chaves dentro de strings. Não executamos o script completo nem seus SDKs.
function extrair(nome) {
  const inicio = new RegExp(`^(?:async )?function ${nome}\\s*\\(|^const ${nome}\\s*=`, 'm').exec(script);
  if (!inicio) throw new Error(`Declaração ausente: ${nome}`);
  const linhas = script.slice(inicio.index).split('\n');
  let codigo = '';
  for (const linha of linhas) {
    codigo += linha + '\n';
    try { new vm.Script(codigo); return codigo; } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;
    }
  }
  throw new Error(`Declaração incompleta: ${nome}`);
}
function documento() {
  return { createElement(tag) {
    if (tag !== 'div') throw new Error(`Elemento sem stub: ${tag}`);
    // Serialização de nó de texto em innerHTML: navegador escapa & < > e
    // NBSP, mas NÃO aspas simples/duplas (não é escape de atributo HTML).
    return { textContent: '', get innerHTML() {
      return String(this.textContent).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;');
    } };
  } };
}
const nomes = ['STATUS', 'MESES_COMPLETOS', 'MODELO_CONTRATO_PADRAO', 'MARCADORES_CONTRATO',
  'HISTORICO_MAX', 'hojeStr', 'totalEvento', 'faltaReceber', 'custoEquipe', 'fmtMoeda',
  'ordemDataHora', 'statusInfo', 'dataBR', 'numeroBR', 'campoCsv', 'exportarPlanilha',
  'escapeHtml', 'fmtHoraCurta', 'outrosEventosNoDia', 'descreverEventos', 'textoModelo',
  'autorAtual', 'auditoria', 'htmlAuditoria', 'fmtDataHora', 'dataPorExtenso',
  'preencherModelo', 'gerarContrato'];
function carregar(stubs = {}, selecionar = nomes) {
  const contexto = vm.createContext({ document: documento(), hoje: new Date(2026, 9, 12),
    eventos: [], auth: null, usandoFirestore: false, modeloContrato: null, ...stubs });
  vm.runInContext(selecionar.map(extrair).join('\n'), contexto);
  return { contexto, valor: nome => vm.runInContext(nome, contexto) };
}
module.exports = { raiz, script, extrair, documento, carregar };
