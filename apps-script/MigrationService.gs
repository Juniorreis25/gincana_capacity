/**
 * Rotinas manuais para a primeira migração da base legada.
 *
 * Estas funções terminam com _ e não fazem parte do contrato público do
 * proxy. Devem ser executadas somente no editor do Apps Script, depois de
 * revisar a prévia e confirmar o backup retornado.
 */

function createOfficialBackup_(label) {
  var source = DriveApp.getFileById(APP_CONFIG.spreadsheetId);
  var now = new Date();
  var stamp = Utilities.formatDate(now, APP_CONFIG.timeZone, 'yyyyMMdd-HHmmss');
  var suffix = text_(label).replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
  var name = source.getName() + ' - backup ' + stamp + (suffix ? ' - ' + suffix : '');
  var parents = source.getParents();
  var copy = parents.hasNext() ? source.makeCopy(name, parents.next()) : source.makeCopy(name);
  return { id: copy.getId(), name: copy.getName(), url: copy.getUrl(), createdAt: dateText_(now) };
}

function legacyMigrationPreview_() {
  var launches = rows_('LANCAMENTOS');
  var legacy = launches.filter(function (launch) { return !text_(launch.GINCANA_ID); });
  var active = legacy.filter(function (launch) { return text_(launch.STATUS).toUpperCase() === 'ATIVO'; });
  var participantIds = {};
  var productIds = {};
  var dates = [];
  active.forEach(function (launch) {
    participantIds[text_(launch.PARTICIPANTE_ID)] = true;
    productIds[text_(launch.PRODUTO_ID)] = true;
    var date = migrationDate_(launch.DATA_OCORRENCIA || launch.CRIADO_EM);
    if (date) dates.push(date);
  });
  return {
    legacyLaunches: legacy.length,
    activeLaunches: active.length,
    activeParticipants: Object.keys(participantIds).length,
    activeProducts: Object.keys(productIds).length,
    totalRegistrations: active.reduce(function (sum, launch) { return sum + number_(launch.INSCRICOES_DELTA); }, 0),
    firstLaunch: dates.length ? dateText_(new Date(Math.min.apply(null, dates.map(function (date) { return date.getTime(); })))) : '',
    lastLaunch: dates.length ? dateText_(new Date(Math.max.apply(null, dates.map(function (date) { return date.getTime(); })))) : '',
    hasActiveCampaign: Boolean(currentCampaign_()),
    canMigrate: legacy.length > 0 && !currentCampaign_()
  };
}

function campaignIntegrityPreview_() {
  var campaigns = rows_('GINCANAS');
  var active = currentCampaign_();
  var campaignIds = campaigns.reduce(function (result, row) { result[text_(row.ID)] = true; return result; }, {});
  var launches = rows_('LANCAMENTOS');
  var activeId = active ? text_(active.ID) : '';
  var scoped = activeId ? launches.filter(function (launch) { return text_(launch.GINCANA_ID) === activeId; }) : [];
  var published = activeId ? latestPublishedRows_(activeId) : [];
  var warnings = [];
  var orphanCount = launches.filter(function (launch) { return !text_(launch.GINCANA_ID); }).length;
  var unknownCampaignCount = launches.filter(function (launch) { return text_(launch.GINCANA_ID) && !campaignIds[text_(launch.GINCANA_ID)]; }).length;
  if (campaigns.filter(function (row) { return text_(row.STATUS).toUpperCase() === 'ATIVA'; }).length > 1) warnings.push('Mais de uma campanha ativa.');
  if (orphanCount) warnings.push(orphanCount + ' lançamento(s) sem GINCANA_ID.');
  if (unknownCampaignCount) warnings.push(unknownCampaignCount + ' lançamento(s) apontam para campanha inexistente.');
  if (active && !rows_('GINCANA_PARTICIPANTES').some(function (row) { return text_(row.GINCANA_ID) === activeId && isActive_(row.ATIVO); })) warnings.push('A campanha ativa não possui participantes associados.');
  if (active && !rows_('GINCANA_PRODUTOS').some(function (row) { return text_(row.GINCANA_ID) === activeId && isActive_(row.ATIVO); })) warnings.push('A campanha ativa não possui produtos associados.');
  return {
    activeCampaign: campaignPayload_(active),
    campaignCount: campaigns.length,
    activeParticipantAssociations: activeId ? rows_('GINCANA_PARTICIPANTES').filter(function (row) { return text_(row.GINCANA_ID) === activeId && isActive_(row.ATIVO); }).length : 0,
    activeProductAssociations: activeId ? rows_('GINCANA_PRODUTOS').filter(function (row) { return text_(row.GINCANA_ID) === activeId && isActive_(row.ATIVO); }).length : 0,
    launches: { total: launches.length, activeCampaign: scoped.length, pending: scoped.filter(function (launch) { return text_(launch.STATUS).toUpperCase() === 'ATIVO' && !text_(launch.PUBLICADO_NA_VERSAO); }).length, withoutCampaign: orphanCount, unknownCampaign: unknownCampaignCount },
    published: { version: published.reduce(function (max, row) { return Math.max(max, number_(row.VERSAO)); }, 0), rows: published.length, totalRegistrations: published.reduce(function (sum, row) { return sum + number_(row.INSCRICOES); }, 0) },
    warnings: warnings,
    ready: warnings.length === 0
  };
}

function migrateLegacyCampaign_(input) {
  var values = validateMigrationInput_(input);
  var preview = legacyMigrationPreview_();
  if (!preview.legacyLaunches) throw new Error('NO_LEGACY_LAUNCHES: Não existem lançamentos legados para migrar.');
  if (preview.hasActiveCampaign) throw new Error('ACTIVE_CAMPAIGN_EXISTS: Encerre a campanha ativa antes da migração.');

  var backup = createOfficialBackup_(values.backupLabel || values.name);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var names = ['GINCANAS', 'GINCANA_PARTICIPANTES', 'GINCANA_PRODUTOS', 'LANCAMENTOS', 'PLACAR_PUBLICADO', 'PUBLICACOES', 'AUDITORIA'];
  var snapshots = {};
  var now = new Date();
  var campaignId = Utilities.getUuid();
  try {
    snapshots = names.reduce(function (result, name) { result[name] = captureSheet_(name); return result; }, {});
    var campaign = {
      ID: campaignId,
      NOME: values.name,
      SLUG: slugify_(values.name),
      DATA_INICIO: values.startDate,
      DATA_FIM: values.endDate,
      STATUS: 'ENCERRADA',
      VERSAO_PUBLICADA: 1,
      CRIADO_EM: now,
      ATUALIZADO_EM: now
    };
    appendObject_('GINCANAS', campaign);

    var legacy = rows_('LANCAMENTOS').filter(function (launch) { return !text_(launch.GINCANA_ID); });
    var active = legacy.filter(function (launch) { return text_(launch.STATUS).toUpperCase() === 'ATIVO'; });
    var participantIds = {};
    var productIds = {};
    legacy.forEach(function (launch) {
      participantIds[text_(launch.PARTICIPANTE_ID)] = true;
      productIds[text_(launch.PRODUTO_ID)] = true;
      updateObjectById_('LANCAMENTOS', text_(launch.ID), { GINCANA_ID: campaignId });
    });

    Object.keys(participantIds).forEach(function (participantId) {
      ensureMigrationAssociation_('GINCANA_PARTICIPANTES', campaignId, 'PARTICIPANTE_ID', participantId, now);
    });
    Object.keys(productIds).forEach(function (productId) {
      ensureMigrationAssociation_('GINCANA_PRODUTOS', campaignId, 'PRODUTO_ID', productId, now);
    });

    var ranking = rankingForLaunches_(active);
    replacePublishedRows_(campaignId, 1, ranking, now);
    appendObject_('PUBLICACOES', {
      ID: Utilities.getUuid(), GINCANA_ID: campaignId, VERSAO: 1, PUBLICADO_POR: 'migração manual', PUBLICADO_EM: now,
      QUANTIDADE_LANCAMENTOS: active.length,
      RESUMO_JSON: JSON.stringify({ total: ranking.reduce(function (sum, row) { return sum + row.registrations; }, 0), participantes: ranking.length, tipo: 'MIGRACAO_HISTORICA' }),
      OBSERVACAO: 'Snapshot histórico criado antes da primeira campanha mensal.'
    });
    appendObject_('AUDITORIA', {
      ID: Utilities.getUuid(), ACAO: 'MIGRAR_BASE_LEGADA', ENTIDADE: 'GINCANA', ENTIDADE_ID: campaignId,
      ANTES_JSON: JSON.stringify({ lancamentosLegados: legacy.length }),
      DEPOIS_JSON: JSON.stringify({ campanha: campaign, lancamentosAtivos: active.length, participantes: Object.keys(participantIds).length, produtos: Object.keys(productIds).length, backupId: backup.id }),
      USUARIO: 'migração manual', DATA_HORA: now
    });
    SpreadsheetApp.flush();
    return { backup: backup, campaign: campaignPayload_(campaign), launchCount: active.length, ranking: ranking };
  } catch (error) {
    if (Object.keys(snapshots).length === names.length) {
      names.forEach(function (name) { restoreSheet_(name, snapshots[name]); });
    }
    appendObject_('AUDITORIA', {
      ID: Utilities.getUuid(), ACAO: 'ERRO_MIGRAR_BASE_LEGADA', ENTIDADE: 'GINCANA', ENTIDADE_ID: campaignId,
      ANTES_JSON: '{}', DEPOIS_JSON: JSON.stringify({ mensagem: error && error.message ? error.message : String(error), backupId: backup.id }),
      USUARIO: 'migração manual', DATA_HORA: new Date()
    });
    throw new Error('LEGACY_MIGRATION_FAILED: A base original foi restaurada. Backup: ' + backup.id + '. ' + (error && error.message ? error.message : error));
  } finally {
    lock.releaseLock();
  }
}

function validateMigrationInput_(input) {
  if (text_(input && input.confirmation) !== 'MIGRATE_LEGACY') throw new Error('MIGRATION_CONFIRMATION_REQUIRED: Confirme a migração com MIGRATE_LEGACY.');
  var name = text_(input && input.name);
  var startDate = migrationDate_(input && input.startDate);
  var endDate = migrationDate_(input && input.endDate);
  if (name.length < 2 || name.length > 120) throw new Error('INVALID_MIGRATION_NAME: Informe o nome da campanha histórica.');
  if (!startDate || !endDate || startDate.getTime() > endDate.getTime()) throw new Error('INVALID_MIGRATION_PERIOD: Período histórico inválido.');
  return { name: name, startDate: startDate, endDate: endDate, backupLabel: text_(input && input.backupLabel) };
}

function ensureMigrationAssociation_(sheetName, campaignId, key, value, now) {
  var exists = rows_(sheetName).some(function (row) { return text_(row.GINCANA_ID) === campaignId && text_(row[key]) === value; });
  if (!exists) {
    var object = { ID: Utilities.getUuid(), GINCANA_ID: campaignId, ATIVO: 'SIM', CRIADO_EM: now };
    object[key] = value;
    appendObject_(sheetName, object);
  }
}

function migrationDate_(value) {
  if (!value) return null;
  var date = Object.prototype.toString.call(value) === '[object Date]' ? new Date(value.getTime()) : new Date(value);
  return isNaN(date.getTime()) ? null : date;
}
