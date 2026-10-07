var EMPLOYMENT_NOTE_HEADERS = ['ID', 'GINCANA_ID', 'PARTICIPANTE_ID', 'PRODUTO_ID', 'DATA', 'QUANTIDADE', 'PUBLICADO_NA_VERSAO', 'CRIADO_EM', 'ATUALIZADO_EM'];

function ensureEmploymentNotesSheet_() {
  var spreadsheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
  var sheet = spreadsheet.getSheetByName('NOTAS_EMPENHO');
  if (!sheet) {
    sheet = spreadsheet.insertSheet('NOTAS_EMPENHO');
    sheet.getRange(1, 1, 1, EMPLOYMENT_NOTE_HEADERS.length).setValues([EMPLOYMENT_NOTE_HEADERS]);
    sheet.setFrozenRows(1);
  } else {
    var headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), EMPLOYMENT_NOTE_HEADERS.length)).getValues()[0].map(function (value) { return text_(value); });
    EMPLOYMENT_NOTE_HEADERS.forEach(function (header) {
      if (headers.indexOf(header) >= 0) return;
      var column = sheet.getLastColumn() + 1;
      sheet.getRange(1, column).setValue(header);
      headers.push(header);
    });
  }
  return sheet;
}

function employmentNotesForCampaign_(campaignId) {
  ensureEmploymentNotesSheet_();
  var participantById = indexBy_(rows_('PARTICIPANTES'), 'ID');
  var productById = indexBy_(rows_('PRODUTOS'), 'ID');
  return rows_('NOTAS_EMPENHO').filter(function (row) { return text_(row.GINCANA_ID) === text_(campaignId); }).map(function (row) {
    var participant = participantById[text_(row.PARTICIPANTE_ID)] || {};
    var product = productById[text_(row.PRODUTO_ID)] || {};
    return {
      id: text_(row.ID), participantId: text_(row.PARTICIPANTE_ID), participant: text_(participant.NOME),
      productId: text_(row.PRODUTO_ID), product: text_(product.NOME), date: dateText_(row.DATA || row.CRIADO_EM),
      quantity: Math.max(0, Math.round(number_(row.QUANTIDADE))), publishedVersion: text_(row.PUBLICADO_NA_VERSAO),
      pendingPublication: !text_(row.PUBLICADO_NA_VERSAO)
    };
  }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
}

function employmentNoteTotals_(campaignId) {
  var participantRows = rows_('PARTICIPANTES');
  var productRows = rows_('PRODUTOS');
  var participantIds = activeCampaignParticipantIds_();
  var productIds = activeCampaignProductIds_();
  var activeParticipants = participantRows.reduce(function (result, row) {
    if (isActive_(row.ATIVO) && (participantIds === null || participantIds[text_(row.ID)])) result[text_(row.ID)] = true;
    return result;
  }, {});
  var activeProducts = productRows.reduce(function (result, row) {
    if (isActive_(row.ATIVO) && (productIds === null || productIds[text_(row.ID)])) result[text_(row.ID)] = true;
    return result;
  }, {});
  return employmentNotesForCampaign_(campaignId).filter(function (row) {
    return activeParticipants[row.participantId] && activeProducts[row.productId];
  }).reduce(function (result, row) {
    result.byParticipant[row.participantId] = (result.byParticipant[row.participantId] || 0) + row.quantity;
    result.total += row.quantity;
    return result;
  }, { byParticipant: {}, total: 0 });
}

function validateEmploymentNoteInput_(input, campaignId) {
  var participantId = text_(input && input.participantId);
  var productId = text_(input && input.productId);
  var quantity = Number(input && input.quantity);
  var date = input && input.date ? new Date(input.date + 'T12:00:00') : new Date();
  if (!participantId || !productId) throw new Error('INVALID_EMPLOYMENT_NOTE: Selecione o participante e o produto.');
  if (!Number.isInteger(quantity) || quantity < 0) throw new Error('INVALID_EMPLOYMENT_NOTE_QUANTITY: Informe uma quantidade inteira maior ou igual a zero.');
  if (isNaN(date.getTime())) throw new Error('INVALID_EMPLOYMENT_NOTE_DATE: Informe uma data válida.');
  var participant = rows_('PARTICIPANTES').find(function (row) { return text_(row.ID) === participantId; });
  var product = rows_('PRODUTOS').find(function (row) { return text_(row.ID) === productId; });
  var participants = activeCampaignParticipantIds_();
  var products = activeCampaignProductIds_();
  if (!participant || !isActive_(participant.ATIVO) || (participants !== null && !participants[participantId])) throw new Error('EMPLOYMENT_NOTE_PARTICIPANT_INACTIVE: O participante não está ativo ou associado à campanha.');
  if (!product || !isActive_(product.ATIVO) || (products !== null && !products[productId])) throw new Error('EMPLOYMENT_NOTE_PRODUCT_INACTIVE: O produto não está ativo ou associado à campanha.');
  return { participantId: participantId, productId: productId, quantity: quantity, date: date, campaignId: text_(campaignId) };
}

function createEmploymentNote_(input) {
  ensureEmploymentNotesSheet_();
  var campaign = currentCampaign_();
  if (!campaign) throw new Error('NO_ACTIVE_GAME: Não há uma campanha ativa.');
  var values = validateEmploymentNoteInput_(input, campaign.ID);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = new Date();
    appendObject_('NOTAS_EMPENHO', { ID: Utilities.getUuid(), GINCANA_ID: values.campaignId, PARTICIPANTE_ID: values.participantId, PRODUTO_ID: values.productId, DATA: values.date, QUANTIDADE: values.quantity, PUBLICADO_NA_VERSAO: '', CRIADO_EM: now, ATUALIZADO_EM: now });
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'CRIAR_NOTA_EMPENHO', ENTIDADE: 'NOTA_EMPENHO', ENTIDADE_ID: values.campaignId, ANTES_JSON: '{}', DEPOIS_JSON: JSON.stringify(values), USUARIO: 'painel.supervisora', DATA_HORA: now });
    SpreadsheetApp.flush();
    return bootstrap_();
  } finally { lock.releaseLock(); }
}

function updateEmploymentNote_(input) {
  ensureEmploymentNotesSheet_();
  var id = text_(input && input.id);
  var campaign = currentCampaign_();
  if (!id || !campaign) throw new Error('INVALID_EMPLOYMENT_NOTE: Registro ou campanha inválida.');
  var current = rows_('NOTAS_EMPENHO').find(function (row) { return text_(row.ID) === id; });
  if (!current || text_(current.GINCANA_ID) !== text_(campaign.ID)) throw new Error('RECORD_NOT_FOUND: Nota de empenho não encontrada na campanha atual.');
  var values = validateEmploymentNoteInput_(input, campaign.ID);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = new Date();
    updateObjectById_('NOTAS_EMPENHO', id, { PARTICIPANTE_ID: values.participantId, PRODUTO_ID: values.productId, DATA: values.date, QUANTIDADE: values.quantity, PUBLICADO_NA_VERSAO: '', ATUALIZADO_EM: now });
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'EDITAR_NOTA_EMPENHO', ENTIDADE: 'NOTA_EMPENHO', ENTIDADE_ID: id, ANTES_JSON: JSON.stringify(current), DEPOIS_JSON: JSON.stringify(values), USUARIO: 'painel.supervisora', DATA_HORA: now });
    SpreadsheetApp.flush();
    return bootstrap_();
  } finally { lock.releaseLock(); }
}
