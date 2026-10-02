# Arquitetura oficial do MVP

O Placar Comercial Capacity usa quatro camadas:

1. **Site privado:** frontend da gestão e do placar da TV.
2. **Proxy `/api/integration`:** intermediário seguro; mantém o segredo compartilhado apenas no runtime e encaminha chamadas ao backend.
3. **Google Apps Script:** backend de regras, validações, persistência, ranking e auditoria.
4. **Google Sheets:** base oficial de dados.

O Apps Script é publicado somente como Web App JSON. Ele não hospeda as telas do produto. O navegador chama o proxy do Site e nunca recebe `APPS_SCRIPT_SHARED_SECRET`.

## Fluxo oficial

`Participante` → `Produto` → `Inscrição pendente` → `Prévia do servidor` → `Publicação confirmada` → `PLACAR_PUBLICADO` → `TV atualizada automaticamente`.

O ranking é a soma das inscrições ativas por participante. Criar ou editar uma inscrição altera os dados pendentes da gestão; a TV permanece na última versão publicada até a confirmação manual. Excluir uma inscrição é uma exclusão lógica e a retira da próxima publicação. A TV lê somente `PLACAR_PUBLICADO`, preserva os últimos dados válidos em falhas transitórias e verifica atualizações a cada 15 segundos.

O MVP operacional trabalha com uma campanha ativa por vez. Somente campanhas explicitamente arquivadas são consultadas pelo menu Arquivo, a partir de snapshots em `PLACAR_PUBLICADO` e registros de arquivamento em `PUBLICACOES`; uma campanha apenas encerrada por opção do usuário não é listada. O Site continua sendo o frontend privado; o Apps Script permanece como backend de regras e persistência, sem hospedar as interfaces.

## Dados vazios e falhas

Uma resposta válida com listas vazias significa **base vazia**, não falha. O frontend mostra estados vazios e mantém o status conectado. Erro de rede, autorização ou backend é mostrado como **erro de conexão**. Não existe fallback com dados fictícios.

## Exclusões

- Participantes e produtos sem histórico podem ser excluídos fisicamente.
- Participantes e produtos com qualquer lançamento são desativados e preservados para auditoria.
- Inscrições são excluídas logicamente com `STATUS = EXCLUIDO`.
- Toda criação, edição, ativação, desativação ou exclusão gera registro em `AUDITORIA`.
