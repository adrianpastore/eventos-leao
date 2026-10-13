'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { carregar, documento } = require('./helpers/carregar');
const { extrair } = require('./helpers/carregar');
const vm = require('node:vm');

test('salvarEvento confirma apenas criação ou troca para data ocupada', async () => {
  for (const caso of [
    { id: null, anterior: null, aceita: true, confirma: 1, quantidade: 2 },
    { id: null, anterior: null, aceita: false, confirma: 1, quantidade: 1 },
    { id: 'editado', anterior: '2026-10-12', aceita: false, confirma: 0, quantidade: 2 },
    { id: 'editado', anterior: '2026-10-11', aceita: true, confirma: 1, quantidade: 2 }
  ]) {
    const eventos = [{ id: 'outro', cliente: 'Outro', data: '2026-10-12', hora: '19:00' }];
    if (caso.id) eventos.push({ id: caso.id, data: caso.anterior, status: 'orcado' });
    let confirmou = 0, fechou = false;
    const campos = { fCliente: ' Novo ', fData: '2026-10-12', fHora: '20:00' };
    const { contexto: c } = carregar({ eventos, editandoId: caso.id, equipe: [], checklist: [],
      statusEscolhido: 'orcado', contratoPendente: null,
      document: { getElementById: id => ({ value: campos[id] || '' }) },
      tipoEscolhido: () => 'Festa', renderTudo() {}, fecharModal() { fechou = true; },
      confirm(s) { confirmou++; assert.match(s, /Outro \(19h\)/); return caso.aceita; },
      alert(s) { assert.fail(s); } });
    vm.runInContext(extrair('salvarEvento'), c);
    await c.salvarEvento();
    assert.equal(confirmou, caso.confirma);
    assert.equal(eventos.length, caso.quantidade);
    assert.equal(fechou, caso.confirma === 0 || caso.aceita);
    if (fechou) assert.equal(eventos.at(-1).data, '2026-10-12');
  }
});

test('CSV: escape, fórmulas, números, datas e valores ausentes', () => {
  const { contexto: c } = carregar();
  for (const [entrada, saida] of [['a;b', '"a;b"'], ['a"b', '"a""b"'],
    ['a\nb', '"a\nb"'], ['a\r\nb', '"a\r\nb"'], [12, '12'], [-5, '-5'],
    [null, ''], [undefined, '']]) assert.equal(c.campoCsv(entrada), saida);
  for (const prefixo of ['=', '+', '-', '@']) {
    assert.equal(c.campoCsv(prefixo + 'abc'), "'" + prefixo + 'abc');
    assert.equal(c.campoCsv(prefixo + 'a;b'), '"\'' + prefixo + 'a;b"');
  }
  assert.equal(c.numeroBR(1234.5), '1234,50');
  assert.equal(c.numeroBR('abc'), '0,00');
  assert.equal(c.campoCsv(c.numeroBR(-5)), '-5,00'); // número negativo continua número
  assert.equal(c.campoCsv('-x'), "'-x");
  assert.equal(c.dataBR('2026-10-12'), '12/10/2026');
  assert.equal(c.dataBR(''), '');
});

test('CSV completo: BOM, cabeçalho, CRLF, ordenação, download e limpeza', async () => {
  let blob, timer, clicou = false, removeu = false, revogado;
  const a = { click() { clicou = true; }, remove() { removeu = true; } };
  const evs = [{ data: '2026-10-13', cliente: 'D' },
    { data: '2026-10-12', cliente: 'C' }, { data: '2026-10-12', hora: '19:30', cliente: 'B' },
    { data: '2026-10-12', hora: '19:00', cliente: 'A', valor: -5, convidados: 1 }];
  const { contexto: c } = carregar({ Blob,
    URL: { createObjectURL(b) { blob = b; return 'blob:teste'; }, revokeObjectURL(u) { revogado = u; } },
    document: { createElement: () => a, body: { appendChild(el) { assert.equal(el, a); } } },
    eventosDoMes: () => evs.slice(), filtroAtivo: () => false, anoAtivo: 2026, mesAtivo: 9,
    setTimeout(fn, ms) { assert.equal(ms, 60000); timer = fn; } });
  c.exportarPlanilha();
  // Blob.text remove BOM na decodificação; inspecionamos bytes e decodificamos preservando-o.
  const bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes.subarray(0, 3).toString('hex'), 'efbbbf');
  const csv = bytes.toString('utf8');
  assert.equal(csv[0], '\uFEFF');
  const linhas = csv.slice(1).split('\r\n');
  assert.equal(linhas[0], 'Data;Hora;Cliente;Telefone;Tipo;Cardápio;Convidados;Valor por pessoa;Total;Sinal;Falta receber;Custo da equipe;Status');
  assert.deepEqual(linhas.slice(1, -1).map(l => l.split(';')[2]), ['A', 'B', 'C', 'D']);
  assert.ok(linhas[1].includes(';-5,00;'));
  assert.equal(csv.replace(/\r\n/g, '').includes('\n'), false);
  assert.equal(linhas.at(-1), '');
  assert.equal(a.download, 'eventos-2026-10.csv');
  assert.equal(a.href, 'blob:teste');
  assert.ok(clicou && removeu); timer(); assert.equal(revogado, 'blob:teste');
});

test('CSV vazio informa ausência conforme filtro e não cria arquivo', () => {
  for (const ativo of [true, false]) {
    let aviso;
    const { contexto: c } = carregar({ eventosDoMes: () => [], filtroAtivo: () => ativo,
      alert: s => { aviso = s; } });
    c.exportarPlanilha();
    assert.equal(aviso, ativo ? 'Nenhum evento neste mês com esse filtro.' : 'Nenhum evento neste mês.');
  }
});

test('eventos: data, hora, ausência de hora/data e exclusão do próprio id', () => {
  const eventos = [{ id: 'c', data: '2026-10-12', cliente: 'C' },
    { id: 'b', data: '2026-10-12', hora: '19:30', cliente: 'B' },
    { id: 'a', data: '2026-10-12', hora: '19:00', cliente: 'A' },
    { id: 'd', data: '2026-10-13' }];
  const { contexto: c } = carregar({ eventos });
  assert.deepEqual(eventos.slice().sort(c.ordemDataHora).map(e => e.id), ['a', 'b', 'c', 'd']);
  assert.equal(c.ordemDataHora({}, {}), 0);
  assert.ok(Number.isFinite(c.ordemDataHora({}, eventos[0])));
  assert.deepEqual(Array.from(c.outrosEventosNoDia('2026-10-12', 'a'), e => e.id), ['b', 'c']);
  assert.equal(c.descreverEventos(c.outrosEventosNoDia('2026-10-12', 'a')), 'B (19h30), C (sem horário)');
  assert.equal(c.fmtHoraCurta('19:00'), '19h');
  assert.equal(c.fmtHoraCurta('19:30'), '19h30');
  assert.equal(c.fmtHoraCurta(''), 'sem horário');
});

test('contrato: os 12 marcadores, desconhecidos e padrões', () => {
  const { contexto: c, valor } = carregar();
  const ev = { cliente: 'Ana', telefone: '123', data: '2026-10-12', hora: '19:30',
    tipo: 'Festa', convidados: 2, cardapio: 'Galeto', valor: 100, sinal: 50 };
  const esperado = ['Ana', '123', '12 de outubro de 2026', '19:30', 'Festa', '2', 'Galeto',
    'R$ 100,00', 'R$ 200,00', 'R$ 50,00', 'R$ 150,00', '12 de outubro de 2026'];
  Array.from(valor('MARCADORES_CONTRATO')).forEach((m, i) => {
    assert.equal(c.preencherModelo('{' + m + '}', ev), esperado[i]);
  });
  assert.doesNotMatch(c.preencherModelo(valor('MODELO_CONTRATO_PADRAO'), ev), /\{\w+\}/);
  assert.equal(c.preencherModelo('{desconhecido}', ev), '{desconhecido}');
  assert.equal(c.preencherModelo('{telefone}|{hora}|{data}|{cardapio}', {}),
    'não informado|horário a combinar|a definir|a definir');
});

test('contrato gerado escapa texto e preserva parágrafos, linhas e assinaturas', () => {
  let saida = '', fechou = false;
  const { contexto: c } = carregar({ eventos: [{ id: '1', cliente: '<script>alert(1)</script> &' }],
    viewId: '1', modeloContrato: { texto: 'Título\n\n{cliente}\nlinha\n\n___ assinatura' },
    window: { open: () => ({ document: { open() {}, write(s) { saida += s; }, close() { fechou = true; } } }) } });
  c.gerarContrato();
  assert.doesNotMatch(saida, /<script>alert/);
  assert.ok(saida.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp;'));
  assert.ok(saida.includes('<h1>Título</h1>'));
  assert.ok(saida.includes('<br>linha'));
  assert.ok(saida.includes('<p class="assinatura">___ assinatura</p>'));
  assert.ok(fechou);
});

test('stub de innerHTML segue serialização de texto do navegador', () => {
  const div = documento().createElement('div'); div.textContent = '&<>"\'\u00a0';
  assert.equal(div.innerHTML, '&amp;&lt;&gt;"\'&nbsp;');
});

test('auditoria: criação, legado, gravação sem corte, imutabilidade e histórico inválido', () => {
  const { contexto: c } = carregar();
  const novo = c.auditoria(null, 'criou');
  assert.equal(novo.criadoPor, 'modo local');
  assert.equal(novo.criadoEm, novo.alteradoEm);
  assert.ok(!isNaN(Date.parse(novo.criadoEm)));
  assert.equal(novo.historico.length, 1);
  for (const ev of [{}, { historico: 'inválido' }]) {
    const editado = c.auditoria(ev, 'editou');
    assert.equal(editado.historico.length, 1);
    assert.equal(editado.criadoPor, undefined);
  }
  const hist = Array.from({ length: 30 }, (_, i) => ({ acao: String(i) }));
  const editado = c.auditoria({ historico: hist }, 'nova');
  assert.equal(editado.historico.length, 31);
  assert.equal(editado.historico[0].acao, '0');
  assert.equal(editado.historico.at(-1).acao, 'nova');
  assert.equal(hist.length, 30);
});

test('autorAtual usa login ou padrões', () => {
  const { contexto: c } = carregar({ usandoFirestore: true, auth: { currentUser: { email: 'teste@local' } } });
  assert.equal(c.autorAtual(), 'teste@local'); c.auth = null;
  assert.equal(c.autorAtual(), 'desconhecido'); c.usandoFirestore = false;
  assert.equal(c.autorAtual(), 'modo local');
});

test('HTML da auditoria: legado, escape e mais recente primeiro', () => {
  const { contexto: c } = carregar();
  assert.match(c.htmlAuditoria({}), /Sem registro de quem criou/);
  assert.match(c.htmlAuditoria({ historico: 'ruim' }), /Sem registro de quem criou/);
  const html = c.htmlAuditoria({ criadoPor: '<b>&', criadoEm: '2026-10-12T12:00:00Z',
    historico: [{ quem: 'antigo', acao: 'primeira' }, { quem: '<script>&', acao: '<img>&' }] });
  assert.ok(html.includes('&lt;b&gt;&amp;'));
  assert.ok(html.includes('&lt;script&gt;&amp; &lt;img&gt;&amp;'));
  assert.ok(html.indexOf('&lt;script&gt;') < html.indexOf('antigo'));
});

test('fmtDataHora: vazio, inválido, ISO e Timestamp sem depender do fuso', () => {
  const { contexto: c } = carregar();
  assert.equal(c.fmtDataHora(''), ''); assert.equal(c.fmtDataHora('inválido'), '');
  const d = new Date('2026-10-12T12:34:00Z');
  const esperado = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  assert.equal(c.fmtDataHora(d.toISOString()), esperado);
  assert.equal(c.fmtDataHora({ toDate: () => d }), esperado);
});

 test('escapeHtml protege atributos e mantém valores ausentes', () => {
  const { contexto: c } = carregar();
  const html = c.escapeHtml('" autofocus onfocus="alert(1)');
  assert.doesNotMatch(html, /"/); assert.match(html, /&quot;/);
  assert.equal(c.escapeHtml("'"), '&#39;');
  assert.equal(c.escapeHtml(null), ''); assert.equal(c.escapeHtml(undefined), '');
  assert.equal(c.escapeHtml(0), '0');
 });
 test('auditoria Firestore acrescenta a entrada com arrayUnion inclusive na criação', () => {
  const entradas = [], sentinela = {};
  const { contexto: c } = carregar({ usandoFirestore: true, auth: { currentUser: { email: 'teste@local' } },
    firebase: { firestore: { FieldValue: { arrayUnion(e) { entradas.push(e); return sentinela; } } } } });
  for (const ev of [null, { historico: [{ acao: 'antiga' }] }]) {
    const dados = c.auditoria(ev, 'nova');
    assert.equal(dados.historico, sentinela);
    assert.equal(entradas.at(-1).quem, 'teste@local');
    assert.equal(entradas.at(-1).quando, dados.alteradoEm);
    assert.match(entradas.at(-1).quando, /\.\d{3}Z$/);
    assert.equal(entradas.at(-1).acao, 'nova');
  }
  assert.equal(entradas.length, 2);
 });
 test('htmlAuditoria mostra só as 30 entradas mais recentes', () => {
  const { contexto: c } = carregar();
  const historico = Array.from({ length: 35 }, (_, i) => ({ quem: 'local', acao: 'registro-' + i }));
  const html = c.htmlAuditoria({ historico });
  assert.equal((html.match(/<li>/g) || []).length, 30);
  assert.match(html, /Ver histórico \(30\)/);
  assert.doesNotMatch(html, /registro-0<|registro-4</);
  assert.ok(html.indexOf('registro-34<') < html.indexOf('registro-5<'));
  assert.equal(historico.length, 35);
 });

test('falha do SDK bloqueia o app sem carregar exemplos nem iniciar login', () => {
  const { script } = require('./helpers/carregar');
  for (const firebase of [undefined, { initializeApp() { throw new Error('falha simulada'); } }]) {
    let tela, renderizou = false;
    const c = vm.createContext({ firebase, console: { error() {} }, document: { getElementById() { assert.fail('Não deve mostrar aviso local'); } },
      mostrarTela(e) { tela = e; }, renderTudo() { renderizou = true; } });
    vm.runInContext(script.slice(0, script.indexOf('const STATUS')), c);
    vm.runInContext(script.slice(script.lastIndexOf('let pararLeitura = null;')), c);
    assert.equal(tela, 'semConexao'); assert.equal(renderizou, false);
    assert.equal(vm.runInContext('eventos.length', c), 0);
    assert.equal(vm.runInContext('auth', c), null); assert.equal(vm.runInContext('db', c), null);
  }
});
