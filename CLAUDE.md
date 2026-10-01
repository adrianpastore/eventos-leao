# Eventos · Leão do Parque

Agenda e controle de eventos do restaurante Leão do Parque. Página única: tudo (HTML, CSS e JS) fica em `index.html`, sem build e sem dependências locais.

- Repositório: https://github.com/adrianpastore/eventos-leao (branch `main`)
- Banco: Firebase Firestore, projeto `eventos-leao` (SDK *compat* 10.12.2 via CDN). A config fica em `firebaseConfig` no próprio `index.html`.
- Sem login: quem tem o link vê e edita tudo, inclusive contratos, telefones e Pix da equipe.

## Fluxo de trabalho combinado

- Falar em português, explicar as mudanças em linguagem simples.
- Commit ao fim de cada etapa. **Push só com o ok do usuário** (muda o site público).
- Custo zero: nada que exija o plano Blaze do Firebase.
- Antes de commitar: checar a sintaxe do `<script>` com `node --check` e testar o fluxo no Chrome headless numa cópia com `apiKey: "COLE_AQUI"` (modo local, com dados de exemplo e sem tocar no Firestore real).

## Telas

- **Quadro**: carrossel de meses (ano atual + próximo; meses passados bloqueados) e eventos do mês.
  - Celular: alterna Lista / Calendário (a preferência fica no `localStorage`).
  - Computador (≥ 860px): calendário em grade.
  - Ao abrir, o carrossel rola até o mês atual (no celular ele ficava escondido no fim). Depois disso, mantém a posição que o usuário deixou.
- **Filtros** (Quadro e Relatório): busca por cliente, sem diferenciar acentos, e filtro por tipo. "Outros" pega todo tipo fora de `TIPOS_FIXOS`. Valem só para o mês selecionado.
- **Pendentes**: aviso no topo do Quadro com os eventos de data passada que não estão como Concluído, com o botão "Marcar concluído" (pede confirmação se ainda falta receber). Como os meses passados ficam bloqueados no Quadro, esse aviso é o caminho para chegar neles.
- **Relatório**: totais do mês (eventos, faturamento, falta receber, custo da equipe, ticket médio, convidados) e detalhamento.
- **Modal do evento** (criar/editar, com "Excluir evento" ao editar, que também apaga o contrato) e **detalhes** (somente leitura, com Editar e Imprimir).
- **Detalhes**: total do evento, falta receber, custo da equipe e botão de WhatsApp (`wa.me`, com 55 na frente quando o número não tem DDI).
- **Imprimir**: folha para a cozinha e a equipe numa aba nova (data, horário, convidados, cardápio, checklist, equipe), **sem valores nem chaves Pix**.
- Um evento por dia: o app avisa e bloqueia ao salvar outro evento numa data já ocupada.

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

Eventos antigos ainda podem ter "Cardápio combinado" no checklist e não ter o campo `cardapio`. Isso é esperado.

## Contrato (PDF)

- Só PDF, até 5 MB. Ações: Ver (abre em outra aba), Baixar, Substituir, Excluir.
- Fica no **próprio Firestore**, porque o Firebase Storage exige o plano Blaze: o PDF vira base64 picado em pedaços de 700 mil caracteres.
  - `eventos/{id}.contrato` = `{ nome, tamanho, versao, partes, enviadoEm }`
  - `eventos/{id}/contratoPartes/{versao}_{n}` = `{ dados }`
- Substituir grava a versão nova (em lote, junto com o `contrato`) **antes** de apagar a antiga.
- Num evento novo, o PDF escolhido fica pendente e é enviado logo depois do primeiro salvamento.
- Num evento existente, Substituir e Excluir valem na hora, mesmo que o modal seja cancelado.
- As regras do Firestore precisam liberar a subcoleção `contratoPartes` (testado no site publicado em 01/10/2026: salvar, excluir e anexar contrato funcionaram).

## Sem internet

- `enablePersistence` guarda os dados no aparelho. Sem internet, o app abre com o que já tinha e as gravações ficam na fila até a conexão voltar.
- Uma barra cinza avisa quando o aparelho está offline.
- Toda gravação passa por `aguardarGravacao()`. Erro (ex.: regra do Firestore negando) → alerta, e o modal continua aberto com os dados. Se depois de 8 s o servidor não respondeu → `'pendente'`: o app avisa que ficou guardado no aparelho e fecha.
- Evento novo usa `collection.doc()` + `set` (o id sai na hora, mesmo offline), não `add()`.
- Contrato não é enviado sem internet (seria grande demais para a fila). O app pede para anexar de novo depois.

## Cuidados no código

- Todo texto vindo do usuário passa por `escapeHtml()` antes de ir para `innerHTML`, inclusive o `tipo`, que agora pode ser digitado.
- `salvarEvento` usa `set(..., { merge: true })`, então campos que não estão no formulário (como `contrato`) são preservados ao editar.

## Próximo passo (prioridade, combinado em 01/10/2026 para 02/10)

**Login com PIN de verdade.** Um PIN conferido só na página não protege: o código e a config do Firebase são públicos, então dá para ler o Firestore direto. Plano aprovado em conversa:
- Usar o Firebase Auth (e-mail/senha, grátis) com **uma conta única do restaurante**. O usuário digita só o PIN, e o app faz `signInWithEmailAndPassword(EMAIL_FIXO, pin)`. O PIN fica só no Firebase, nunca no código.
- O PIN precisa de no mínimo 6 caracteres (exigência do Firebase). O Firebase já bloqueia quem erra muitas vezes.
- O login fica salvo no aparelho (persistência padrão do Auth). Botão "Sair" no cabeçalho.
- Regras do Firestore: `allow read, write: if request.auth != null;` em `eventos/{id}` e `eventos/{id}/contratoPartes/{parte}`.
- O usuário faz no console (guiar passo a passo): ativar o provedor E-mail/senha, criar o usuário com o PIN e colar as regras. A ordem importa: publicar o app com login **antes** de trocar as regras, senão o site atual para de funcionar.
- Limitações já explicadas ao usuário: PIN compartilhado (sem saber quem fez o quê) e, para revogar acesso, é preciso trocar o PIN.

## Ideias para depois

- Exportar o relatório para planilha.
- Instalar no celular como app (PWA).
- Mais de um evento por dia; gerar contrato a partir de um modelo.
