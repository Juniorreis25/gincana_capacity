# Especificação técnica do MVP

## Contrato do backend

Todas as operações usam `POST` pelo proxy `/api/integration` e exigem o segredo compartilhado no servidor.

- `bootstrap`: retorna `participants` (ranking), `products` ativos e `history`.
- `adminData`: retorna participantes e produtos, incluindo situação e quantidade de lançamentos relacionados.
- `createLaunch`, `updateLaunch`, `deleteLaunch`: persistem inscrições e retornam o novo `bootstrap`.
- `createParticipant`, `updateParticipant`, `deleteParticipant`, `deactivateParticipant`, `activateParticipant`.
- `createProduct`, `updateProduct`, `deleteProduct`, `deactivateProduct`, `activateProduct`.

O frontend não calcula o ranking. O Apps Script lê `LANCAMENTOS`, soma `INSCRICOES_DELTA` apenas onde `STATUS = ATIVO` e ordena por total decrescente e nome.

## Concorrência e segurança

Mutações usam `LockService.getScriptLock()`. O segredo existe somente nas propriedades do Apps Script e nas variáveis privadas do Site. A URL do Apps Script e o segredo não são enviados ao cliente nem versionados.

## Compatibilidade da planilha

O MVP usa diretamente `PARTICIPANTES`, `PRODUTOS`, `LANCAMENTOS` e `AUDITORIA`. Colunas e abas legadas são preservadas. Novas inscrições deixam `GINCANA_ID` e `PUBLICADO_NA_VERSAO` vazios porque versões e publicação manual não pertencem ao fluxo atual.
