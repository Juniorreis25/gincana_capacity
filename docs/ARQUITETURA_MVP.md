# Arquitetura oficial do MVP

O Placar Comercial Capacity usa quatro camadas:

1. **Site privado:** frontend da gestão e do placar da TV.
2. **Proxy `/api/integration`:** intermediário seguro; mantém o segredo compartilhado apenas no runtime do Site e encaminha as chamadas ao backend.
3. **Google Apps Script:** backend e camada de regras, validações, cálculos, publicação e auditoria.
4. **Google Sheets:** base de dados oficial.

O Google Apps Script é implantado como Web App de backend. Ele não hospeda as interfaces HTML do produto. O navegador nunca recebe `APPS_SCRIPT_SHARED_SECRET`.

## Fluxo vertical entregue

`Registrar inscrição` → pendência → prévia calculada no servidor → publicação protegida por `LockService` → atualização de `PUBLICACOES`, `PLACAR_PUBLICADO` e `PUBLICADO_NA_VERSAO` → leitura da nova versão pela TV.

Cancelamentos mínimos também passam pelo backend: solicitação, aprovação/rejeição, reversão, auditoria e publicação posterior da reversão.

O fallback demonstrativo permanece disponível e é indicado visualmente quando a integração não estiver configurada ou falhar.
