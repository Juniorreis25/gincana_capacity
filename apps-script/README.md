# Backend Apps Script

Este diretório contém o backend JSON do MVP. O Site privado é o frontend oficial e o proxy `/api/integration` encaminha as chamadas sem expor o segredo no navegador.

## Implantação

1. Copie os arquivos `.gs` e `appsscript.json` para o projeto Apps Script ligado à planilha oficial.
2. Em **Configurações do projeto > Propriedades do script**, mantenha `APPS_SCRIPT_SHARED_SECRET` com um valor forte.
3. Crie uma versão e implante o projeto como aplicativo da Web.
4. No ambiente privado do Site, configure `APPS_SCRIPT_URL` com a URL terminada em `/exec` e `APPS_SCRIPT_SHARED_SECRET` com o mesmo segredo.

## Operações ativas

`bootstrap`, `adminData`, `listCampaigns`, `getCampaign`, `startNewCampaign`, `createLaunch`, `updateLaunch`, `deleteLaunch` e o CRUD/ativação de participantes e produtos.

O ranking é recalculado no Apps Script a cada leitura e considera somente inscrições ativas vinculadas a participantes e produtos ativos dentro da campanha ativa. Enquanto não houver campanha ativa, o backend mantém compatibilidade com os lançamentos legados sem `GINCANA_ID`. Ao iniciar uma nova campanha, o fluxo protegido pode arquivar o ranking anterior em `PLACAR_PUBLICADO`/`PUBLICACOES`, encerrar a campanha anterior, preservar os participantes e criar um novo contexto operacional. Uma base vazia retorna listas vazias com sucesso; não há dados demonstrativos de fallback.
