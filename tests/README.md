# Testes sem dependências

Comando solicitado: `node --test tests/` (também disponível via `npm test`).
Se o sandbox bloquear processos filhos, use `node --test --test-isolation=none`.
No Node 24.20.0, se esse comando gerar `ERR_UNSUPPORTED_DIR_IMPORT`, use:

```powershell
node --test --test-isolation=none
```

O helper lê o código atual de produção e extrai declarações pelo nome usando
o compilador do Node para detectar seu término. Não inicializa Firebase,
não carrega CDN e não faz requisições de rede. Cada teste cria um contexto VM.
O DOM simulado serializa nós de texto como o navegador: escapa `&`, `<`, `>`
e espaço não separável; aspas simples e duplas permanecem literais em innerHTML.

A checagem de sintaxe tenta `node --check` via stdin. Se houver `spawn EPERM`,
compila o script inteiro com `vm.Script` e informa a alternativa no diagnóstico.
O navegador headless não faz parte desta suíte.

Observação coberta: `numeroBR(-5)` retorna `-5,00`, mas a exportação passa esse
texto por `campoCsv`, resultando em `'-5,00`. Portanto negativos monetários
são exportados como texto protegido contra fórmulas.
