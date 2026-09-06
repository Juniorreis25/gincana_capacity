# Integração com a planilha oficial

Este diretório contém a primeira fatia do backend Apps Script do painel. Ele lê a planilha oficial pelo ID configurado em `Config.gs` e expõe apenas respostas JSON padronizadas.

1. Crie um projeto Apps Script vinculado à planilha oficial e copie os arquivos `.gs` e `appsscript.json`.
2. Em **Configurações do projeto > Propriedades do script**, crie `APPS_SCRIPT_SHARED_SECRET` com um valor forte. O segredo não deve ser commitado nem inserido em uma célula da planilha.
3. Publique como aplicativo da Web, executando como a pessoa que publica. Restrinja o acesso conforme a política da organização; a autorização administrativa é feita pelo segredo recebido no corpo da requisição.
4. Configure no ambiente do Worker do painel `APPS_SCRIPT_URL` com a URL `/exec` da implantação e `APPS_SCRIPT_SHARED_SECRET` com o mesmo valor da propriedade do script.

As operações disponíveis nesta etapa são `bootstrap` (leitura administrativa sanitizada), `publishedScoreboard` (somente a última versão publicada) e `createLaunch` (grava uma inscrição pendente em `LANCAMENTOS`, com auditoria e bloqueio concorrente). `createLaunch` exige uma gincana com `STATUS=ATIVA`. Sem essas variáveis no ambiente, o painel mantém os dados de demonstração para não interromper o protótipo.
