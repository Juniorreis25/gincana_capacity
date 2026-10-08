var EMPLOYMENT_NOTE_HEADERS = ['ID', 'GINCANA_ID', 'PARTICIPANTE_ID', 'PRODUTO_ID', 'DATA', 'QUANTIDADE', 'PUBLICADO_NA_VERSAO', 'STATUS', 'CRIADO_EM', 'ATUALIZADO_EM'];

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
  return rows_('NOTAS_EMPENHO').filter(function (row) {
    return text_(row.GINCANA_ID) === text_(campaignId) && text_(row.STATUS).toUpperCase() !== 'EXCLUIDO' && number_(row.QUANTIDADE) > 0;
  }).map(function (row) {
    var participant = participantById[text_(row.PARTICIPANTE_ID)] || {};
    var product = productById[text_(row.PRODUTO_ID)] || {};
    return {
      id: text_(row.ID), participantId: text_(row.PARTICIPANTE_ID), participant: text_(participant.NOME),
      productId: text_(row.PRODUTO_ID), product: text_(product.NOME), date: dateText_(row.DATA || row.CRIADO_EM),
      quantity: Math.max(0, Math.round(number_(row.QUANTIDADE))), publishedVersion: text_(row.PUBLICADO_NA_VERSAO),
      pendingPublication: false
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
  if (!Number.isInteger(quantity) || quantity < 1) throw new Error('INVALID_EMPLOYMENT_NOTE_QUANTITY: Informe uma quantidade inteira maior que zero.');
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
    var id = Utilities.getUuid();
    appendObject_('NOTAS_EMPENHO', { ID: id, GINCANA_ID: values.campaignId, PARTICIPANTE_ID: values.participantId, PRODUTO_ID: values.productId, DATA: values.date, QUANTIDADE: values.quantity, PUBLICADO_NA_VERSAO: '0', STATUS: 'ATIVO', CRIADO_EM: now, ATUALIZADO_EM: now });
    var publishedVersion = syncPublishedNoteTotals_(values.campaignId);
    if (publishedVersion) updateObjectById_('NOTAS_EMPENHO', id, { PUBLICADO_NA_VERSAO: publishedVersion });
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'CRIAR_NOTA_EMPENHO', ENTIDADE: 'NOTA_EMPENHO', ENTIDADE_ID: id, ANTES_JSON: '{}', DEPOIS_JSON: JSON.stringify(values), USUARIO: 'painel.supervisora', DATA_HORA: now });
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
    updateObjectById_('NOTAS_EMPENHO', id, { PARTICIPANTE_ID: values.participantId, PRODUTO_ID: values.productId, DATA: values.date, QUANTIDADE: values.quantity, ATUALIZADO_EM: now });
    syncPublishedNoteTotals_(campaign.ID);
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'EDITAR_NOTA_EMPENHO', ENTIDADE: 'NOTA_EMPENHO', ENTIDADE_ID: id, ANTES_JSON: JSON.stringify(current), DEPOIS_JSON: JSON.stringify(values), USUARIO: 'painel.supervisora', DATA_HORA: now });
    SpreadsheetApp.flush();
    return bootstrap_();
  } finally { lock.releaseLock(); }
}

function deleteEmploymentNote_(input) {
  ensureEmploymentNotesSheet_();
  var id = text_(input && input.id);
  var campaign = currentCampaign_();
  if (!id || !campaign) throw new Error('INVALID_EMPLOYMENT_NOTE: Registro ou campanha inválida.');
  var current = rows_('NOTAS_EMPENHO').find(function (row) { return text_(row.ID) === id && text_(row.GINCANA_ID) === text_(campaign.ID); });
  if (!current || text_(current.STATUS).toUpperCase() === 'EXCLUIDO') throw new Error('RECORD_NOT_FOUND: Nota de empenho não encontrada na campanha atual.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = new Date();
    markEmploymentNotesDeleted_([id], now);
    SpreadsheetApp.flush();
    syncPublishedNoteTotals_(campaign.ID);
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'EXCLUIR_NOTA_EMPENHO', ENTIDADE: 'NOTA_EMPENHO', ENTIDADE_ID: id, ANTES_JSON: JSON.stringify(current), DEPOIS_JSON: JSON.stringify({ STATUS: 'EXCLUIDO' }), USUARIO: 'painel.supervisora', DATA_HORA: now });
    SpreadsheetApp.flush();
    var result = bootstrap_();
    if ((result.employmentNotes || []).some(function (row) { return row.id === id; })) {
      throw new Error('EMPLOYMENT_NOTE_DELETE_FAILED: A nota continua ativa após a exclusão.');
    }
    return result;
  } finally { lock.releaseLock(); }
}

function deleteEmploymentNotesForParticipant_(input) {
  ensureEmploymentNotesSheet_();
  var participantId = text_(input && input.participantId);
  var campaign = currentCampaign_();
  if (!participantId || !campaign) throw new Error('INVALID_EMPLOYMENT_NOTE: Participante ou campanha inválida.');
  var current = rows_('NOTAS_EMPENHO').filter(function (row) {
    return text_(row.GINCANA_ID) === text_(campaign.ID) && text_(row.PARTICIPANTE_ID) === participantId && text_(row.STATUS).toUpperCase() !== 'EXCLUIDO' && number_(row.QUANTIDADE) > 0;
  });
  if (!current.length) throw new Error('RECORD_NOT_FOUND: Não existem notas de empenho ativas para este participante na campanha atual.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var now = new Date();
    var ids = current.map(function (row) { return text_(row.ID); });
    markEmploymentNotesDeleted_(ids, now);
    current.forEach(function (row) {
      appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'EXCLUIR_NOTA_EMPENHO', ENTIDADE: 'NOTA_EMPENHO', ENTIDADE_ID: text_(row.ID), ANTES_JSON: JSON.stringify(row), DEPOIS_JSON: JSON.stringify({ STATUS: 'EXCLUIDO' }), USUARIO: 'painel.supervisora', DATA_HORA: now });
    });
    SpreadsheetApp.flush();
    syncPublishedNoteTotals_(campaign.ID);
    SpreadsheetApp.flush();
    var result = bootstrap_();
    if ((result.employmentNotes || []).some(function (row) { return row.participantId === participantId; })) {
      throw new Error('EMPLOYMENT_NOTE_DELETE_FAILED: Ainda existem notas ativas do participante após a exclusão.');
    }
    return result;
  } finally { lock.releaseLock(); }
}

function markEmploymentNoteDeleted_(id, updatedAt) {
  return markEmploymentNotesDeleted_([id], updatedAt);
}

function markEmploymentNotesDeleted_(ids, updatedAt) {
  var sheet = ensureEmploymentNotesSheet_();
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (!values.length || values.length < 2) throw new Error('RECORD_NOT_FOUND: Nota de empenho não encontrada.');
  var headers = values[0].map(function (value) { return text_(value); });
  var idIndex = headers.indexOf('ID');
  var statusIndex = headers.indexOf('STATUS');
  var updatedIndex = headers.indexOf('ATUALIZADO_EM');
  if (idIndex < 0 || statusIndex < 0) throw new Error('EMPLOYMENT_NOTE_SCHEMA_INVALID: A aba de notas não possui as colunas ID e STATUS.');
  var requested = ids.reduce(function (result, id) { result[text_(id)] = true; return result; }, {});
  var found = {};
  var statusValues = values.slice(1).map(function (row) { return [row[statusIndex] || '']; });
  var updatedValues = updatedIndex >= 0 ? values.slice(1).map(function (row) { return [row[updatedIndex] || '']; }) : null;
  for (var index = 1; index < values.length; index += 1) {
    var rowId = text_(values[index][idIndex]);
    if (!requested[rowId]) continue;
    statusValues[index - 1][0] = 'EXCLUIDO';
    if (updatedValues) updatedValues[index - 1][0] = updatedAt;
    found[rowId] = true;
  }
  var missing = Object.keys(requested).filter(function (id) { return !found[id]; });
  if (missing.length) throw new Error('RECORD_NOT_FOUND: Nota de empenho não encontrada.');

  sheet.getRange(2, statusIndex + 1, statusValues.length, 1).setValues(statusValues);
  if (updatedValues) sheet.getRange(2, updatedIndex + 1, updatedValues.length, 1).setValues(updatedValues);
  SpreadsheetApp.flush();

  var idsByRow = sheet.getRange(2, idIndex + 1, values.length - 1, 1).getValues();
  var statusesByRow = sheet.getRange(2, statusIndex + 1, values.length - 1, 1).getValues();
  var confirmed = {};
  for (var rowIndex = 0; rowIndex < idsByRow.length; rowIndex += 1) {
    var confirmedId = text_(idsByRow[rowIndex][0]);
    if (requested[confirmedId] && text_(statusesByRow[rowIndex][0]).toUpperCase() === 'EXCLUIDO') confirmed[confirmedId] = true;
  }
  if (Object.keys(requested).some(function (id) { return !confirmed[id]; })) {
    throw new Error('EMPLOYMENT_NOTE_DELETE_FAILED: A planilha não confirmou a exclusão das notas.');
  }
  return true;
}

function syncPublishedNoteTotals_(campaignId) {
  ensurePublishedNoteColumns_();
  var publishedRows = latestPublishedRows_(campaignId);
  if (!publishedRows.length) return 0;
  var totals = employmentNoteTotals_(campaignId);
  var sheet = sheet_('PLACAR_PUBLICADO');
  var range = sheet.getDataRange();
  var values = range.getValues();
  var headers = values[0].map(function (header) { return String(header).trim(); });
  var campaignIndex = headers.indexOf('GINCANA_ID');
  var versionIndex = headers.indexOf('VERSAO');
  var participantIndex = headers.indexOf('PARTICIPANTE_ID');
  var noteIndexes = [];
  var totalIndexes = [];
  headers.forEach(function (header, index) {
    if (header === 'NOTAS_EMPENHO') noteIndexes.push(index);
    if (header === 'TOTAL_NOTAS_EMPENHO') totalIndexes.push(index);
  });
  var publishedAtIndex = headers.indexOf('PUBLICADO_EM');
  var version = number_(publishedRows[0].VERSAO);
  var changed = false;
  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (text_(values[rowIndex][campaignIndex]) !== text_(campaignId) || number_(values[rowIndex][versionIndex]) !== version) continue;
    var participantId = text_(values[rowIndex][participantIndex]);
    var noteCount = totals.byParticipant[participantId] || 0;
    noteIndexes.forEach(function (index) {
      if (number_(values[rowIndex][index]) !== noteCount) { values[rowIndex][index] = noteCount; changed = true; }
    });
    totalIndexes.forEach(function (index) {
      if (number_(values[rowIndex][index]) !== totals.total) { values[rowIndex][index] = totals.total; changed = true; }
    });
  }
  if (changed && publishedAtIndex >= 0) {
    var now = new Date();
    for (var publishedRowIndex = 1; publishedRowIndex < values.length; publishedRowIndex += 1) {
      if (text_(values[publishedRowIndex][campaignIndex]) === text_(campaignId) && number_(values[publishedRowIndex][versionIndex]) === version) values[publishedRowIndex][publishedAtIndex] = now;
    }
  }
  if (changed) range.setValues(values);
  return version;
}
