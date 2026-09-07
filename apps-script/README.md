# Backend Apps Script

Este diretório contém o backend JSON do MVP. O Site privado é o frontend oficial e o proxy `/api/integration` encaminha as chamadas sem expor o segredo no navegador.

## Implantação

1. Copie os arquivos `.gs` e `appsscript.json` para o projeto Apps Script ligado à planilha oficial.
2. Em **Configurações do projeto > Propriedades do script**, mantenha `APPS_SCRIPT_SHARED_SECRET` com um valor forte.
3. Crie uma versão e implante o projeto como aplicativo da Web.
4. No ambiente privado do Site, configure `APPS_SCRIPT_URL` com a URL terminada em `/exec` e `APPS_SCRIPT_SHARED_SECRET` com o mesmo segredo.

## Operações ativas

`bootstrap`, `adminData`, `createLaunch`, `updateLaunch`, `deleteLaunch` e o CRUD/ativação de participantes e produtos.

O ranking é recalculado no Apps Script a cada leitura e considera somente inscrições ativas vinculadas a participantes e produtos ativos. Ao desativar um participante ou produto, os lançamentos relacionados permanecem no histórico com situação `INATIVADO`, mas deixam de contabilizar no ranking e no placar. O backend não depende de gincana ativa, associações, prévia, versão publicada ou `PLACAR_PUBLICADO`. Uma base vazia retorna listas vazias com sucesso; não há dados demonstrativos de fallback.
