# Integração com a planilha oficial

Este diretório contém o backend Apps Script do painel. O Site privado é o frontend oficial; o proxy `/api/integration` encaminha as chamadas administrativas para este Web App sem expor o segredo no navegador. O Apps Script lê e grava a planilha oficial pelo ID configurado em `Config.gs` e expõe respostas JSON padronizadas.

1. Crie um projeto Apps Script vinculado à planilha oficial e copie os arquivos `.gs` e `appsscript.json`.
2. Em **Configurações do projeto > Propriedades do script**, crie `APPS_SCRIPT_SHARED_SECRET` com um valor forte. O segredo não deve ser commitado nem inserido em uma célula da planilha.
3. Publique como aplicativo da Web, executando como a pessoa que publica. Restrinja o acesso conforme a política da organização; a autorização administrativa é feita pelo segredo recebido no corpo da requisição.
4. Configure no ambiente do Worker do painel `APPS_SCRIPT_URL` com a URL `/exec` da implantação e `APPS_SCRIPT_SHARED_SECRET` com o mesmo valor da propriedade do script.

As operações disponíveis são `bootstrap`, `publishedScoreboard`, `createLaunch`, `preview`, `publish`, `requestCancellation`, `approveCancellation` e `rejectCancellation`. `preview` não grava dados; `publish` recalcula e grava o snapshot publicado com lock, auditoria e rollback; cancelamentos aprovados criam reversões ainda pendentes de publicação. Sem as variáveis de ambiente, o painel mantém os dados de demonstração para não interromper o protótipo.
