# Planejamento da evolução para campanhas mensais

## 1. Objetivo

Permitir o encerramento de uma campanha e o início de uma nova campanha mensal sem misturar resultados, preservando o histórico geral para consulta e mantendo os participantes cadastrados.

Esta evolução não transforma o sistema em uma plataforma de campanhas simultâneas. O escopo aprovado é de uma campanha operacional por vez, com campanhas anteriores arquivadas.

## 2. Decisões aprovadas

- A base Google Sheets continuará única e histórica.
- A interface usará o termo **campanha**.
- Os nomes técnicos legados das abas, como `GINCANAS`, podem ser mantidos para evitar uma migração estrutural desnecessária.
- A campanha atual será o único contexto operacional da gestão.
- O botão **Nova campanha** iniciará o fluxo de arquivamento e reset operacional.
- O arquivo armazenará somente o placar geral em formato tabular:
  - posição;
  - participante;
  - equipe, quando existir;
  - inscrições;
  - data do arquivamento.
- Participantes permanecerão na base mestre.
- Produtos e inscrições antigas não serão apagados fisicamente durante o fluxo normal. Serão arquivados ou ocultados dos menus operacionais.
- A TV da nova campanha começará sem placar publicado.

## 3. Situação de referência: campanha de setembro

Levantamento realizado na planilha oficial:

| Indicador | Quantidade |
|---|---:|
| Participantes | 9 |
| Produtos | 11 |
| Lançamentos | 42 |
| Lançamentos ativos | 37 |
| Lançamentos excluídos | 5 |
| Inscrições líquidas ativas | 102 |
| Dias com movimentação | 15 |
| Registros de auditoria | 88 |

O período de movimentação foi de 03/09/2026 a 30/09/2026. As abas de campanhas, associações, publicações e placar publicado ainda não possuem registros operacionais, e os lançamentos atuais estão com `GINCANA_ID` vazio.

Antes de iniciar outubro, será necessária uma migração inicial para vincular os lançamentos de setembro a uma campanha histórica.

## 4. Modelo de dados e uso das abas existentes

Não será criada uma planilha mensal nova.

### `GINCANAS`

Será o índice das campanhas e do período de cada campanha.

Estados previstos:

- `RASCUNHO`;
- `ATIVA`;
- `ENCERRADA`;
- `ARQUIVADA`.

Campos relevantes: `ID`, `NOME`, `SLUG`, `DATA_INICIO`, `DATA_FIM`, `STATUS`, `VERSAO_PUBLICADA`, `CRIADO_EM` e `ATUALIZADO_EM`.

Regra de ciclo de vida: `ATIVA` é a campanha operacional atual; `ARQUIVADA` identifica somente uma campanha cujo resultado foi explicitamente preservado no Arquivo; `ENCERRADA` identifica uma campanha finalizada sem arquivamento e, portanto, não listada no menu Arquivo.

### `GINCANA_PARTICIPANTES`

Representará quais participantes fazem parte da campanha. O participante continua sendo um cadastro mestre reutilizável.

### `GINCANA_PRODUTOS`

Representará quais produtos aparecem na campanha. O produto continua preservado no cadastro mestre, mas somente produtos associados à campanha atual serão exibidos no menu operacional.

### `LANCAMENTOS`

Todo lançamento novo deverá ter `GINCANA_ID` obrigatório. Lançamentos de campanhas encerradas permanecerão preservados e não serão considerados na campanha atual.

### `PLACAR_PUBLICADO`

Armazenará o snapshot geral arquivado. Cada linha representa um participante em uma campanha e versão.

### `PUBLICACOES`

Registrará o arquivamento, a versão, o usuário, a data e a quantidade de linhas do snapshot.

### `AUDITORIA`

Registrará a criação da campanha, o arquivamento, o reset operacional e eventuais reativações. A operação deve incluir o `GINCANA_ID` no conteúdo auditado.

## 5. Fluxo de criação de campanha

### 5.1 Abertura do modal

O botão **Nova campanha** abre um modal com:

- nome da campanha;
- mês e ano;
- opção **Arquivar resultados atuais**;
- ações **Cancelar**, **Não arquivar** e **Arquivar e iniciar**.

Se o usuário escolher não arquivar, deve existir uma confirmação adicional informando que o resultado atual não ficará disponível no menu Arquivo. A opção recomendada será arquivar.

### 5.2 Operação transacional no Apps Script

Criar uma operação única, por exemplo `startNewCampaign`, que:

1. valida nome, período e usuário;
2. adquire `LockService.getScriptLock()`;
3. identifica a campanha operacional atual;
4. calcula o ranking atual no servidor;
5. grava o snapshot geral no `PLACAR_PUBLICADO`;
6. grava o registro correspondente em `PUBLICACOES`;
7. marca a campanha anterior como `ARQUIVADA` quando o usuário confirmou o arquivamento, ou como `ENCERRADA` quando optou por não arquivar;
8. cria a nova campanha como `ATIVA`;
9. atualiza a configuração da campanha operacional;
10. mantém os participantes no cadastro mestre;
11. marca lançamentos e produtos anteriores como arquivados/fora do contexto atual;
12. registra a operação em `AUDITORIA`;
13. libera o lock em `finally`.

Se qualquer etapa falhar, o sistema não deve informar sucesso. O estado anterior deve ser restaurado ou mantido, e o erro deve ser auditado.

## 6. Comportamento da interface

### Menu Arquivo

Adicionar um item **Arquivo** na navegação. A tela deverá:

- listar campanhas arquivadas;
- permitir filtro por mês e ano;
- mostrar nome, período, data do arquivamento e quantidade de participantes;
- abrir uma tabela com posição, participante e inscrições;
- informar quando uma campanha não possui placar arquivado.

### Menu Produtos

Exibir somente produtos associados à campanha atual. Produtos antigos permanecem preservados, mas não aparecem como opções para novos lançamentos.

### Menu Inscrições

Exibir somente lançamentos da campanha atual. O histórico de campanhas encerradas ficará disponível pelo Arquivo, sem misturar registros operacionais.

### Dashboard

Exibir claramente:

- nome da campanha atual;
- período;
- quantidade de participantes;
- produtos associados;
- inscrições da campanha atual;
- estado do placar publicado.

### Placar da TV

Após a criação de uma nova campanha, mostrar `Placar ainda não publicado`. A TV não deve exibir automaticamente o snapshot arquivado da campanha anterior.

## 7. Contrato mínimo de integração

Adicionar ao proxy e ao Apps Script operações equivalentes a:

- `listCampaigns`;
- `getCampaign`;
- `createCampaign`;
- `startNewCampaign`;
- `archiveScoreboard`;
- `getArchive`;
- `bootstrap` com `campaignId`;
- `adminData` com `campaignId`.

O `campaignId` deve ser validado no Apps Script. Não será suficiente confiar no ID enviado pelo frontend.

O segredo continuará somente no proxy e nas propriedades privadas do Apps Script.

## 8. Migração inicial de setembro

Executar antes de liberar o botão para o usuário:

1. Criar backup da planilha oficial.
2. Criar uma campanha histórica para setembro.
3. Associar os 42 lançamentos atuais ao ID dessa campanha.
4. Criar associações dos 9 participantes usados.
5. Criar associações dos 11 produtos usados.
6. Recalcular o ranking final de setembro.
7. Gravar o snapshot arquivado, identificando-o como migração histórica.
8. Marcar setembro como `ARQUIVADA`.
9. Criar outubro como `RASCUNHO`.
10. Ativar outubro somente após validação da gestão.

Não inventar uma data de publicação retroativa. Caso o snapshot de setembro seja criado após a migração, registrar a operação como arquivamento histórico.

## 9. Fases de implementação

### Fase 1 — Isolamento e migração

- tornar `GINCANA_ID` obrigatório em novos lançamentos;
- implementar o contexto da campanha atual;
- migrar setembro;
- impedir mistura de lançamentos entre campanhas;
- criar backup e rotina de rollback.

### Fase 2 — Nova campanha

- botão e modal;
- operação transacional `startNewCampaign`;
- criação do registro de campanha;
- reset visual dos menus Produtos e Inscrições;
- manutenção dos participantes.

### Fase 3 — Arquivo

- menu Arquivo;
- filtro mês/ano;
- consulta do snapshot;
- estado vazio quando não houver campanha arquivada;
- auditoria da consulta e do arquivamento, sem expor segredos.

### Fase 4 — TV e publicação

- vincular a TV à campanha atual;
- mostrar `Placar ainda não publicado` no início da campanha;
- manter o snapshot antigo somente no Arquivo;
- validar atualização após o primeiro lançamento de outubro.

## 10. Validação obrigatória

1. Arquivar setembro.
2. Confirmar uma tabela com 9 participantes e seus resultados.
3. Confirmar setembro no menu Arquivo.
4. Criar outubro.
5. Confirmar que Produtos e Inscrições exibem estado vazio ou somente dados de outubro.
6. Confirmar que Participantes continuam cadastrados.
7. Registrar uma nova inscrição em outubro.
8. Confirmar que o ranking de outubro começa do zero e recebe somente o novo lançamento.
9. Confirmar que a TV não exibe o resultado de setembro.
10. Reabrir o Arquivo e confirmar que setembro não foi alterado.
11. Simular falha durante o arquivamento e confirmar rollback.
12. Confirmar auditoria, backup e ausência de exposição do segredo.

## 11. Critérios de aceite

A evolução será considerada pronta quando:

- for possível iniciar uma nova campanha pela interface;
- o arquivamento exigir confirmação;
- o placar geral anterior puder ser consultado por mês/ano;
- participantes forem preservados;
- produtos e inscrições antigas não aparecerem na operação da nova campanha;
- nenhum lançamento de outubro for somado ao resultado de setembro;
- a TV começar a nova campanha sem placar publicado;
- o histórico arquivado permanecer íntegro;
- uma falha não apagar dados nem criar uma campanha parcialmente configurada;
- os acessos compartilhados do Site permanecerem inalterados.

## 12. Fora do escopo desta evolução

- campanhas simultâneas em operação;
- rankings por equipe no Arquivo;
- exportação avançada;
- edição de campanhas arquivadas;
- exclusão física automática de histórico;
- migração para banco SQL;
- critérios de pontos, valor, bônus e penalidades.
