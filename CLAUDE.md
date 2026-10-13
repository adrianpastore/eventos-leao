# Eventos · Leão do Parque

Agenda e controle de eventos do restaurante Leão do Parque. Página única: tudo (HTML, CSS e JS) fica em `index.html`, sem build e sem dependências locais.

- Repositório: https://github.com/adrianpastore/eventos-leao (branch `main`)
- Banco: Firebase Firestore, projeto `eventos-leao` (SDK *compat* 10.12.2 via CDN). A config fica em `firebaseConfig` no próprio `index.html`.
- Login por e-mail e senha (Firebase Auth). As contas são criadas só no console do Firebase; o app não tem cadastro. Todas as contas liberadas veem e editam tudo.

## Fluxo de trabalho combinado

- Falar em português, explicar as mudanças em linguagem simples.
- Commit ao fim de cada etapa. **Push só com o ok do usuário** (muda o site público).
- Custo zero: nada que exija o plano Blaze do Firebase.
- Antes de commitar: checar a sintaxe do `<script>` com `node --check` e testar o fluxo no Chrome headless numa cópia com `apiKey: "COLE_AQUI"` (modo local, com dados de exemplo e sem tocar no Firestore real).

## Telas

- **Quadro**: carrossel de meses (ano atual + próximo; meses passados bloqueados) e eventos do mês.
  - Celular: alterna Lista / Calendário (a preferência fica no `localStorage`).
  - Computador (≥ 860px): calendário em grade. Dia com vários eventos: um bloco por evento, empilhados por horário.
  - Calendário do celular: dia com vários eventos mostra listras (uma cor por evento) e a quantidade; tocar abre a lista do dia para escolher.
  - Ao abrir, o carrossel rola até o mês atual (no celular ele ficava escondido no fim). Depois disso, mantém a posição que o usuário deixou.
- **Filtros** (Quadro e Relatório): busca por cliente, sem diferenciar acentos, e filtro por tipo. "Outros" pega todo tipo fora de `TIPOS_FIXOS`. Valem só para o mês selecionado.
- **Pendentes**: aviso no topo do Quadro com os eventos de data passada que não estão como Concluído, com o botão "Marcar concluído" (pede confirmação se ainda falta receber). Como os meses passados ficam bloqueados no Quadro, esse aviso é o caminho para chegar neles.
- **Relatório**: totais do mês (eventos, faturamento, falta receber, custo da equipe, ticket médio, convidados) e detalhamento.
  - **Exportar planilha**: baixa `eventos-AAAA-MM.csv` com uma linha por evento do mês, respeitando os filtros. Formato do Excel em português: separador `;`, BOM UTF-8, vírgula decimal, datas dd/mm/aaaa. Campos com `;`, aspas ou quebra de linha vão entre aspas; texto começando com `= + - @` ganha um `'` na frente (para o Excel não tratar como fórmula, ex.: telefone `+55...`).
- **Modal do evento** (criar/editar, com "Excluir evento" ao editar, que também apaga o contrato) e **detalhes** (somente leitura, com Editar, Imprimir e Gerar contrato).
- **Detalhes**: total do evento, falta receber, custo da equipe e botão de WhatsApp (`wa.me`, com 55 na frente quando o número não tem DDI). No rodapé: "Criado por X em dd/mm/aaaa hh:mm · Última alteração por Y em ..." e "Ver histórico" (recolhível, mais recente primeiro). Evento antigo sem esses campos mostra "Sem registro de quem criou".
- **Imprimir**: folha para a cozinha e a equipe numa aba nova (data, horário, convidados, cardápio, checklist, equipe), **sem valores nem chaves Pix**.
- **Mais de um evento por dia** é permitido. Ao escolher uma data ocupada, o modal mostra um aviso (não bloqueia); ao salvar, pede uma confirmação ("Já existe evento neste dia: Fulano (19h). Salvar mesmo assim?"), só quando a data é nova para aquele evento. Lista, calendários, Pendentes, Relatório e planilha ordenam por data e horário (`ordemDataHora`; sem horário fica por último). A impressão mostra "Também neste dia" com os outros eventos da data (só nome e horário).
- **Gerar contrato** (nos detalhes, seção Contrato): abre numa aba nova uma folha A4 com o texto do modelo preenchido, com botão "Imprimir / salvar em PDF". É diferente do contrato em PDF anexado (que continua igual).
- **Modelo de contrato** (botão no cabeçalho): edita o texto do modelo, com a lista de marcadores (clicar insere no cursor) e "Restaurar modelo padrão" (só vale depois de "Salvar modelo"). Mostra quem salvou por último.

## Modelo de contrato (`config/modeloContrato`)

- `{ texto, alteradoPor, alteradoEm }` (e-mail de quem salvou e data ISO). Se o documento não existe, ou não pôde ser lido, vale o `MODELO_CONTRATO_PADRAO` do `index.html` (Churrascaria Leão do Parque: evento, valores, número de convidados, cancelamento, responsabilidades, assinaturas).
- Lido com `onSnapshot` depois do login. No modo local fica no `localStorage` (`eventosLeaoModeloContrato`).
- Marcadores: `{cliente}`, `{telefone}`, `{data}` (por extenso, ex.: 12 de outubro de 2026), `{hora}`, `{tipo}`, `{convidados}`, `{cardapio}`, `{valor_por_pessoa}`, `{total}`, `{sinal}`, `{falta_receber}`, `{hoje}`. Marcador desconhecido fica como está no contrato, para quem editou perceber.
- O texto é puro: linha em branco separa parágrafos, quebra simples vira `<br>`, o primeiro parágrafo vira o título e parágrafos que começam com `___` ganham espaço de assinatura. Tudo passa por `escapeHtml()`.

## Dados (`eventos/{id}`)

| Campo | Observação |
|---|---|
| `cliente`, `telefone` | `cliente` é obrigatório |
| `tipo` | Aniversário, Casamento, Corporativo, Formatura ou Outro. Em **Outro** abre um campo de texto e o tipo **é salvo com o texto digitado** (ex.: "Batizado"); vazio vira "Outro". O filtro "Outros" pega todo tipo fora de `TIPOS_FIXOS`. |
| `cardapio` | `""` (a definir), Galeto 1, Galeto 2, Galeto 3, Carreteiro, Chapa completa. Escolhido num select, como o tipo; **não** faz mais parte do checklist. |
| `data`, `hora` | `data` obrigatória (`AAAA-MM-DD`) |
| `convidados`, `valor` (por pessoa), `sinal` | total = `valor × convidados`; falta receber = total − `sinal` (só conta o sinal: o status "Pago" não zera o saldo) |
| `status` | orcado, confirmado, parcial, pago, concluido (cada um com sua cor) |
| `checklist` | `[{ texto, feito }]`; padrão: Equipe escalada, Decoração combinada, Restrições alimentares confirmadas, Som/música confirmado |
| `equipe` | `[{ nome, posicao, pix, valor }]`; nome, posição e Pix são obrigatórios para confirmar; custo da equipe = soma dos `valor` |
| `contrato` | ver abaixo |
| `criadoPor`, `criadoEm` | e-mail de quem criou e data ISO; gravados só na criação |
| `alteradoPor`, `alteradoEm` | última alteração (criar, editar, marcar concluído, anexar/substituir/excluir contrato) |
| `historico` | `[{ quem, quando, acao }]`, só os últimos 30 (`HISTORICO_MAX`). `acao`: "criou", "editou", "editou (status: Pago)", "marcou concluído", "anexou contrato", "substituiu contrato", "excluiu contrato" |

Eventos antigos ainda podem ter "Cardápio combinado" no checklist e não ter o campo `cardapio`, nem os campos de autoria (`criadoPor` etc.). Isso é esperado.

### Quem fez o quê

- `auditoria(ev, acao)` monta os campos e vai junto na mesma gravação (`set` com merge, `update` ou o lote do contrato). Autor = e-mail de `auth.currentUser`; no modo local, "modo local".
- As datas são texto ISO com o relógio do aparelho (não `serverTimestamp`), porque funcionam igual sem internet e com o `aguardarGravacao`. `fmtDataHora` também aceita Timestamp do Firestore.
- O `historico` é montado a partir da cópia local do evento e gravado inteiro (não dá para limitar a 30 com `arrayUnion`). Se duas pessoas alterarem o mesmo evento quase ao mesmo tempo, um registro pode se perder; os dados do evento não.
- Excluir o evento apaga também o histórico dele.

## Contrato (PDF)

- Só PDF, até 5 MB. Ações: Ver (abre em outra aba), Baixar, Substituir, Excluir.
- Fica no **próprio Firestore**, porque o Firebase Storage exige o plano Blaze: o PDF vira base64 picado em pedaços de 700 mil caracteres.
  - `eventos/{id}.contrato` = `{ nome, tamanho, versao, partes, enviadoEm }`
  - `eventos/{id}/contratoPartes/{versao}_{n}` = `{ dados }`
- Substituir grava a versão nova (em lote, junto com o `contrato`) **antes** de apagar a antiga.
- Num evento novo, o PDF escolhido fica pendente e é enviado logo depois do primeiro salvamento.
- Num evento existente, Substituir e Excluir valem na hora, mesmo que o modal seja cancelado.
- As regras do Firestore precisam liberar a subcoleção `contratoPartes` (testado no site publicado em 01/10/2026: salvar, excluir e anexar contrato funcionaram).

## Instalar no celular (PWA)

- `manifest.webmanifest` (nome "Eventos · Leão do Parque", curto "Eventos", `display: standalone`, cores do cabeçalho `#143327` e do fundo `#f6f5f1`) e ícones em `icons/` (192, 512 — também usado como *maskable* — e `apple-touch-icon` 180). Os ícones foram gerados com PowerShell/System.Drawing: folha de calendário com faixa bordô e "LP".
- Caminhos relativos (`start_url` e `scope` = `./`), porque o site fica em `/eventos-leao/` no GitHub Pages.
- `sw.js` guarda só o casco (página, manifesto, ícones). Sempre tenta a rede primeiro e só usa o cache sem internet, então nunca prende uma versão velha. **Não intercepta** nada de outro domínio (Firebase, googleapis, gstatic): os dados offline continuam com o `enablePersistence`. Ao mudar a lista de arquivos do casco, trocar o nome do cache (`eventos-leao-casco-vN`).
- iPhone: Safari > Compartilhar > "Adicionar à Tela de Início" (metas `apple-mobile-web-app-*`). Android: o Chrome oferece "Instalar app".
- O SW não é registrado em `file://`; para testar, servir a pasta por HTTP (localhost). No Chrome headless, usar um perfil (`--user-data-dir`) em caminho curto, senão o Cache API falha no Windows.

## Sem internet

- `enablePersistence` guarda os dados no aparelho. Sem internet, o app abre com o que já tinha e as gravações ficam na fila até a conexão voltar.
- Uma barra cinza avisa quando o aparelho está offline.
- Toda gravação passa por `aguardarGravacao()`. Erro (ex.: regra do Firestore negando) → alerta, e o modal continua aberto com os dados. Se depois de 8 s o servidor não respondeu → `'pendente'`: o app avisa que ficou guardado no aparelho e fecha.
- Evento novo usa `collection.doc()` + `set` (o id sai na hora, mesmo offline), não `add()`.
- Contrato não é enviado sem internet (seria grande demais para a fila). O app pede para anexar de novo depois.

## Cuidados no código

- Todo texto vindo do usuário passa por `escapeHtml()` antes de ir para `innerHTML`, inclusive o `tipo`, que agora pode ser digitado.
- `salvarEvento` usa `set(..., { merge: true })`, então campos que não estão no formulário (como `contrato`) são preservados ao editar.

## Login e regras

- Tela de login (e-mail e senha) antes do app; "Esqueci a senha" manda o e-mail de redefinição do Firebase. O login fica salvo no aparelho (persistência padrão do Auth).
- "Sair" no cabeçalho: desloga e apaga a cópia local do Firestore (`terminate` + `clearPersistence`).
- O `onSnapshot` só começa depois do login. No modo local (`apiKey: "COLE_AQUI"`) não há login.
- `firestore.rules` no repositório é a cópia versionada; o que vale é o publicado no console. Libera `eventos`, `contratoPartes` e `config` só para as UIDs da lista (`request.auth.uid in [...]`), porque com só `request.auth != null` qualquer pessoa poderia criar uma conta pela API pública.
- **Pendente no console:** publicar o `firestore.rules` com a regra nova `config/{doc}` (Firestore Database > Regras). Sem ela, "Salvar modelo" dá erro de permissão e o app usa o modelo padrão.
- No console: desmarcar "Enable create (sign-up)" em Authentication > Settings > User actions.
- Ordem: publicar o app com login **antes** de trocar as regras, senão o site para.
- Limitações: o histórico é informativo (gravado pelo próprio app; as regras não impedem alterá-lo); para tirar o acesso de alguém, apagar/desativar a conta ou tirar a UID das regras.

## Ideias para depois

- (nenhuma pendente)
