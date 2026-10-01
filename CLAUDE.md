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
- **Relatório**: totais do mês (eventos, faturamento, ticket médio, convidados) e detalhamento.
- **Modal do evento** (criar/editar) e **detalhes** (somente leitura, com botão Editar).
- Um evento por dia: o app avisa e bloqueia ao salvar outro evento numa data já ocupada.

## Dados (`eventos/{id}`)

| Campo | Observação |
|---|---|
| `cliente`, `telefone` | `cliente` é obrigatório |
| `tipo` | Aniversário, Casamento, Corporativo, Formatura ou Outro. Em **Outro** abre um campo de texto e o tipo **é salvo com o texto digitado** (ex.: "Batizado"); vazio vira "Outro". Um filtro futuro deve tratar como "Outro" todo tipo fora de `TIPOS_FIXOS`. |
| `cardapio` | `""` (a definir), Galeto 1, Galeto 2, Galeto 3, Carreteiro, Chapa completa. Escolhido num select, como o tipo; **não** faz mais parte do checklist. |
| `data`, `hora` | `data` obrigatória (`AAAA-MM-DD`) |
| `convidados`, `valor` (por pessoa), `sinal` | faturamento do evento = `valor × convidados` |
| `status` | orcado, confirmado, parcial, pago, concluido (cada um com sua cor) |
| `checklist` | `[{ texto, feito }]`; padrão: Equipe escalada, Decoração combinada, Restrições alimentares confirmadas, Som/música confirmado |
| `equipe` | `[{ nome, posicao, pix, valor }]`; nome, posição e Pix são obrigatórios para confirmar |
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
- As regras do Firestore precisam liberar a subcoleção `contratoPartes`. Ainda não foi testado com o banco real.

## Cuidados no código

- Todo texto vindo do usuário passa por `escapeHtml()` antes de ir para `innerHTML`, inclusive o `tipo`, que agora pode ser digitado.
- `salvarEvento` usa `set(..., { merge: true })`, então campos que não estão no formulário (como `contrato`) são preservados ao editar.

## Ideias para depois

- Filtro por tipo de evento.
- Login, se os contratos e os dados da equipe precisarem ficar privados.
