# Arquitetura oficial do MVP

O Placar Comercial Capacity usa quatro camadas:

1. **Site privado:** frontend da gestão e do placar da TV.
2. **Proxy `/api/integration`:** intermediário seguro; mantém o segredo compartilhado apenas no runtime e encaminha chamadas ao backend.
3. **Google Apps Script:** backend de regras, validações, persistência, ranking e auditoria.
4. **Google Sheets:** base oficial de dados.

O Apps Script é publicado somente como Web App JSON. Ele não hospeda as telas do produto. O navegador chama o proxy do Site e nunca recebe `APPS_SCRIPT_SHARED_SECRET`.

## Fluxo oficial

`Participante` → `Produto` → `Inscrição` → `Ranking recalculado no servidor` → `TV atualizada automaticamente`.

O ranking é a soma das inscrições ativas por participante. Criar ou editar uma inscrição altera o ranking imediatamente; excluir uma inscrição é uma exclusão lógica e a retira do total. A TV lê apenas o `bootstrap` calculado pelo servidor, preserva os últimos dados válidos em falhas transitórias e verifica atualizações a cada 15 segundos.

Não fazem parte do MVP as telas ou regras de equipes, gincanas, associações, aprovação, prévia, publicação manual, versões ou snapshot em `PLACAR_PUBLICADO`. As abas antigas permanecem na planilha apenas como legado estrutural e não participam do fluxo ativo.

## Dados vazios e falhas

Uma resposta válida com listas vazias significa **base vazia**, não falha. O frontend mostra estados vazios e mantém o status conectado. Erro de rede, autorização ou backend é mostrado como **erro de conexão**. Não existe fallback com dados fictícios.

## Exclusões

- Participantes e produtos sem histórico podem ser excluídos fisicamente.
- Participantes e produtos com qualquer lançamento são desativados e preservados para auditoria.
- Inscrições são excluídas logicamente com `STATUS = EXCLUIDO`.
- Toda criação, edição, ativação, desativação ou exclusão gera registro em `AUDITORIA`.
