function requestCancellation_(input) {
  var launchId = text_(input.launchId);
  var reason = text_(input.reason);
  if (!launchId || !reason) throw new Error('INVALID_CANCELLATION: Informe o lançamento e o motivo do cancelamento.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var launch = rows_('LANCAMENTOS').find(function (item) { return text_(item.ID) === launchId; });
    if (!launch || text_(launch.STATUS).toUpperCase() !== 'ATIVO') throw new Error('LAUNCH_NOT_ACTIVE: O lançamento não está ativo.');
    var existing = rows_('CANCELAMENTOS').some(function (item) { return text_(item.LANCAMENTO_ID) === launchId && text_(item.STATUS).toUpperCase() === 'PENDENTE'; });
    if (existing) throw new Error('CANCELLATION_ALREADY_PENDING: Este lançamento já aguarda análise.');
    var now = new Date();
    var id = Utilities.getUuid();
    var user = text_(input.createdBy) || 'painel.supervisora';
    appendObject_('CANCELAMENTOS', { ID: id, LANCAMENTO_ID: launchId, MOTIVO: reason, STATUS: 'PENDENTE', SOLICITADO_POR: user, SOLICITADO_EM: now, ANALISADO_POR: '', ANALISADO_EM: '', JUSTIFICATIVA_ANALISE: '', REVERSAO_ID: '' });
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'SOLICITAR_CANCELAMENTO', ENTIDADE: 'CANCELAMENTO', ENTIDADE_ID: id, ANTES_JSON: '{}', DEPOIS_JSON: JSON.stringify({ lancamentoId: launchId, motivo: reason }), USUARIO: user, DATA_HORA: now });
    return bootstrap_();
  } finally { lock.releaseLock(); }
}

function approveCancellation_(input) {
  var cancellationId = text_(input.cancellationId);
  if (!cancellationId) throw new Error('INVALID_CANCELLATION: Solicitação de cancelamento não informada.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var cancellation = rows_('CANCELAMENTOS').find(function (item) { return text_(item.ID) === cancellationId; });
    if (!cancellation || text_(cancellation.STATUS).toUpperCase() !== 'PENDENTE') throw new Error('CANCELLATION_ALREADY_ANALYZED: A solicitação já foi analisada.');
    var launch = rows_('LANCAMENTOS').find(function (item) { return text_(item.ID) === text_(cancellation.LANCAMENTO_ID); });
    if (!launch || text_(launch.STATUS).toUpperCase() !== 'ATIVO') throw new Error('LAUNCH_NOT_ACTIVE: O lançamento original não está ativo.');
    var now = new Date(); var user = text_(input.analyzedBy) || 'painel.supervisora'; var reversalId = Utilities.getUuid();
    appendObject_('LANCAMENTOS', {
      ID: reversalId, GINCANA_ID: text_(launch.GINCANA_ID), PARTICIPANTE_ID: text_(launch.PARTICIPANTE_ID), PRODUTO_ID: text_(launch.PRODUTO_ID), TIPO: 'REVERSAO', STATUS: 'ATIVO',
      INSCRICOES_DELTA: -number_(launch.INSCRICOES_DELTA), VALOR_CENTAVOS_DELTA: -number_(launch.VALOR_CENTAVOS_DELTA), PONTOS_DELTA: -number_(launch.PONTOS_DELTA),
      DATA_OCORRENCIA: now, ORGAO_CLIENTE: '', OBSERVACAO: 'Reversão do lançamento ' + text_(launch.ID), LANCAMENTO_ORIGEM_ID: text_(launch.ID), ALERTA_DUPLICIDADE: 'NAO', DUPLICIDADE_CONFIRMADA_POR: '', PUBLICADO_NA_VERSAO: '', CRIADO_POR: user, CRIADO_EM: now
    });
    updateObjectById_('LANCAMENTOS', text_(launch.ID), { STATUS: 'REVERTIDO' });
    updateObjectById_('CANCELAMENTOS', cancellationId, { STATUS: 'APROVADO', ANALISADO_POR: user, ANALISADO_EM: now, JUSTIFICATIVA_ANALISE: '', REVERSAO_ID: reversalId });
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'APROVAR_CANCELAMENTO', ENTIDADE: 'CANCELAMENTO', ENTIDADE_ID: cancellationId, ANTES_JSON: JSON.stringify({ status: 'PENDENTE' }), DEPOIS_JSON: JSON.stringify({ status: 'APROVADO', reversaoId: reversalId }), USUARIO: user, DATA_HORA: now });
    return bootstrap_();
  } finally { lock.releaseLock(); }
}

function rejectCancellation_(input) {
  var cancellationId = text_(input.cancellationId); var justification = text_(input.justification);
  if (!cancellationId || !justification) throw new Error('INVALID_JUSTIFICATION: Informe a justificativa da rejeição.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var cancellation = rows_('CANCELAMENTOS').find(function (item) { return text_(item.ID) === cancellationId; });
    if (!cancellation || text_(cancellation.STATUS).toUpperCase() !== 'PENDENTE') throw new Error('CANCELLATION_ALREADY_ANALYZED: A solicitação já foi analisada.');
    var now = new Date(); var user = text_(input.analyzedBy) || 'painel.supervisora';
    updateObjectById_('CANCELAMENTOS', cancellationId, { STATUS: 'REJEITADO', ANALISADO_POR: user, ANALISADO_EM: now, JUSTIFICATIVA_ANALISE: justification });
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'REJEITAR_CANCELAMENTO', ENTIDADE: 'CANCELAMENTO', ENTIDADE_ID: cancellationId, ANTES_JSON: JSON.stringify({ status: 'PENDENTE' }), DEPOIS_JSON: JSON.stringify({ status: 'REJEITADO', justificativa: justification }), USUARIO: user, DATA_HORA: now });
    return bootstrap_();
  } finally { lock.releaseLock(); }
}
