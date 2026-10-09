# Backend Apps Script

Este diretório contém o backend JSON do MVP. O Site privado é o frontend oficial e o proxy `/api/integration` encaminha as chamadas sem expor o segredo no navegador.

## Implantação

1. Copie os arquivos `.gs` e `appsscript.json` para o projeto Apps Script ligado à planilha oficial.
2. Em **Configurações do projeto > Propriedades do script**, mantenha `APPS_SCRIPT_SHARED_SECRET` com um valor forte.
3. Crie uma versão e implante o projeto como aplicativo da Web.
4. No ambiente privado do Site, configure `APPS_SCRIPT_URL` com a URL terminada em `/exec` e `APPS_SCRIPT_SHARED_SECRET` com o mesmo segredo.

## Operações ativas

`bootstrap`, `scoreboard`, `preview`, `publish`, `adminData`, `listCampaigns`, `getCampaign`, `getCampaignAssociations`, `updateCampaignAssociations`, `startNewCampaign`, `createLaunch`, `updateLaunch`, `deleteLaunch`, `createEmploymentNote`, `updateEmploymentNote`, `deleteEmploymentNote`, `deleteEmploymentNotesForParticipant` e o CRUD/ativação de participantes e produtos.

O Site usa `bootstrap` para a gestão e `scoreboard` para a TV. A TV lê somente
`PLACAR_PUBLICADO`, nunca os lançamentos pendentes, e mostra a versão e a data
da última publicação.

As inscrições novas ficam pendentes até a gestão revisar a prévia e confirmar
`publish`. A publicação recalcula o ranking no servidor, grava
`PLACAR_PUBLICADO`/`PUBLICACOES`, preenche `PUBLICADO_NA_VERSAO` e registra a
auditoria. A TV só muda depois dessa confirmação.

As notas de empenho usam a aba dedicada `NOTAS_EMPENHO`, criada
automaticamente na primeira operação da versão que suporta o recurso. Seus
campos são `ID`, `GINCANA_ID`, `PARTICIPANTE_ID`, `PRODUTO_ID`, `DATA`,
`QUANTIDADE`, `PUBLICADO_NA_VERSAO`, `STATUS`, `CRIADO_EM` e `ATUALIZADO_EM`. Registros com status `EXCLUIDO` ou quantidade zero não aparecem na operação financeira. A soma é
feita por participante no Apps Script, somente com registros de participantes,
produtos e associações ativos. O snapshot publicado acrescenta
`NOTAS_EMPENHO` e `TOTAL_NOTAS_EMPENHO` à aba `PLACAR_PUBLICADO`, permitindo que
a TV continue consumindo apenas a camada publicada.

Na planilha oficial, uma duplicação histórica do cabeçalho `STATUS` foi
corrigida em 09/10/2026: a coluna J passou a se chamar `STATUS_LEGADO` e a
coluna K é o único `STATUS` operacional. Não renomeie J novamente para
`STATUS`; leituras e exclusões devem usar K. A exclusão em lote confirma a
gravação no Apps Script e o frontend consulta `bootstrap` em uma chamada
separada para verificar que as notas desapareceram.

As associações da campanha são salvas em uma operação protegida. Somente
participantes e produtos ativos e associados à campanha atual podem receber
novos lançamentos ou aparecer no ranking. A atualização das duas abas de
associação usa rollback se alguma etapa falhar.

O ranking é recalculado no Apps Script a cada leitura e considera somente inscrições ativas vinculadas a participantes e produtos ativos dentro da campanha ativa. Enquanto não houver campanha ativa, o backend mantém compatibilidade com os lançamentos legados sem `GINCANA_ID`. Ao iniciar uma nova campanha, o fluxo protegido pode arquivar o ranking anterior em `PLACAR_PUBLICADO`/`PUBLICACOES`, marcar a campanha anterior como `ARQUIVADA`, preservar os participantes e criar um novo contexto operacional. Se o usuário optar por não arquivar, a campanha anterior fica `ENCERRADA` e não aparece no menu Arquivo. Uma base vazia retorna listas vazias com sucesso; não há dados demonstrativos de fallback.

## Migração inicial da base legada

Antes de iniciar a primeira campanha mensal, a migração de lançamentos sem
`GINCANA_ID` deve ser feita manualmente no editor do Apps Script. As funções
`createOfficialBackup_`, `legacyMigrationPreview_` e
`migrateLegacyCampaign_` e `campaignIntegrityPreview_` terminam com `_` de propósito: não são ações aceitas
pelo proxy e não podem ser chamadas pelo Site.

1. Cole todos os arquivos deste diretório no projeto Apps Script e salve.
2. Execute `legacyMigrationPreview_()` e revise as quantidades retornadas.
3. Execute `campaignIntegrityPreview_()` antes e depois da migração para
   conferir lançamentos órfãos, associações, pendências e versão publicada.
4. Confirme que não existe campanha `ATIVA` e que a prévia identifica somente
   os lançamentos históricos esperados.
5. Execute `migrateLegacyCampaign_({ confirmation: 'MIGRATE_LEGACY', name: 'Campanha Setembro 2026', startDate: '2026-09-01', endDate: '2026-09-30', backupLabel: 'setembro-2026' })`.
6. Guarde o `backup.id` e o `backup.url` retornados. A rotina cria uma cópia
   no Google Drive antes de escrever na planilha.

A rotina cria a campanha histórica como `ARQUIVADA`, associa os lançamentos
ativos, participantes e produtos, grava o snapshot em `PLACAR_PUBLICADO`,
registra `PUBLICACOES` e `AUDITORIA`, e não cria uma campanha operacional nova.
Em caso de falha, as abas alteradas são restauradas e o erro é auditado. Depois
da validação, use o botão **Nova campanha** no Site para iniciar a campanha
seguinte.

Não execute a migração novamente se já existir uma campanha ativa ou se os
lançamentos já estiverem vinculados. O backup é uma cópia de recuperação e não
substitui a conferência manual do resultado arquivado.
