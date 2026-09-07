function appendObject_(name, object) {
  var sheet = sheet_(name);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (header) { return String(header).trim(); });
  var row = headers.map(function (header) { return object[header] === undefined ? '' : object[header]; });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
}

function createLaunch_(input) {
  var values = validateLaunchInput_(input);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    assertActiveCatalogs_(values.participantId, values.productId);
    var now = new Date();
    var id = Utilities.getUuid();
    var launch = {
      ID: id, GINCANA_ID: '', PARTICIPANTE_ID: values.participantId, PRODUTO_ID: values.productId,
      TIPO: 'INSCRICAO', STATUS: 'ATIVO', INSCRICOES_DELTA: values.quantity,
      VALOR_CENTAVOS_DELTA: 0, PONTOS_DELTA: 0, DATA_OCORRENCIA: values.date,
      ORGAO_CLIENTE: '', OBSERVACAO: values.notes, LANCAMENTO_ORIGEM_ID: '',
      ALERTA_DUPLICIDADE: 'NAO', DUPLICIDADE_CONFIRMADA_POR: '', PUBLICADO_NA_VERSAO: '',
      CRIADO_POR: 'painel.supervisora', CRIADO_EM: now
    };
    appendObject_('LANCAMENTOS', launch);
    auditLaunch_('CRIAR', id, {}, launch);
    SpreadsheetApp.flush();
    return bootstrap_();
  } finally { lock.releaseLock(); }
}

function updateLaunch_(input) {
  var id = text_(input.id);
  if (!id) throw new Error('INVALID_LAUNCH: Identificador da inscrição obrigatório.');
  var values = validateLaunchInput_(input);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var current = rows_('LANCAMENTOS').find(function (launch) { return text_(launch.ID) === id; });
    if (!current) throw new Error('LAUNCH_NOT_FOUND: Inscrição não encontrada.');
    if (text_(current.STATUS).toUpperCase() !== 'ATIVO') throw new Error('LAUNCH_NOT_ACTIVE: Apenas inscrições ativas podem ser editadas.');
    assertActiveCatalogs_(values.participantId, values.productId);
    var changes = { PARTICIPANTE_ID: values.participantId, PRODUTO_ID: values.productId, INSCRICOES_DELTA: values.quantity, DATA_OCORRENCIA: values.date, OBSERVACAO: values.notes };
    updateObjectById_('LANCAMENTOS', id, changes);
    auditLaunch_('EDITAR', id, current, changes);
    SpreadsheetApp.flush();
    return bootstrap_();
  } finally { lock.releaseLock(); }
}

function deleteLaunch_(input) {
  var id = text_(input.id);
  if (!id) throw new Error('INVALID_LAUNCH: Identificador da inscrição obrigatório.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var current = rows_('LANCAMENTOS').find(function (launch) { return text_(launch.ID) === id; });
    if (!current) throw new Error('LAUNCH_NOT_FOUND: Inscrição não encontrada.');
    if (text_(current.STATUS).toUpperCase() !== 'ATIVO') throw new Error('LAUNCH_NOT_ACTIVE: A inscrição já foi excluída.');
    var changes = { STATUS: 'EXCLUIDO' };
    updateObjectById_('LANCAMENTOS', id, changes);
    auditLaunch_('EXCLUIR', id, current, changes);
    SpreadsheetApp.flush();
    return bootstrap_();
  } finally { lock.releaseLock(); }
}

function validateLaunchInput_(input) {
  var participantId = text_(input.participantId);
  var productId = text_(input.productId);
  var quantity = Number(input.quantity);
  if (!participantId || !productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) throw new Error('INVALID_LAUNCH: Participante, produto e quantidade entre 1 e 1000 são obrigatórios.');
  var date = text_(input.date);
  var occurredAt = date ? new Date(date + 'T12:00:00') : new Date();
  if (isNaN(occurredAt.getTime())) throw new Error('INVALID_LAUNCH_DATE: Data da inscrição inválida.');
  return { participantId: participantId, productId: productId, quantity: quantity, date: occurredAt, notes: text_(input.notes) };
}

function assertActiveCatalogs_(participantId, productId) {
  var participant = rows_('PARTICIPANTES').find(function (item) { return text_(item.ID) === participantId; });
  if (!participant || !isActive_(participant.ATIVO)) throw new Error('PARTICIPANT_NOT_FOUND: Participante não encontrada ou inativa.');
  var product = rows_('PRODUTOS').find(function (item) { return text_(item.ID) === productId; });
  if (!product || !isActive_(product.ATIVO)) throw new Error('PRODUCT_NOT_FOUND: Produto não encontrado ou inativo.');
}

function auditLaunch_(action, id, before, after) {
  appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: action, ENTIDADE: 'LANCAMENTO', ENTIDADE_ID: id, ANTES_JSON: JSON.stringify(before || {}), DEPOIS_JSON: JSON.stringify(after || {}), USUARIO: 'painel.supervisora', DATA_HORA: new Date() });
}
