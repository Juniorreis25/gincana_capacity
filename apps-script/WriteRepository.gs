function appendObject_(name, object) {
  var sheet = sheet_(name);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function (header) { return String(header).trim(); });
  var row = headers.map(function (header) { return object[header] === undefined ? '' : object[header]; });
  sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
}

function createLaunch_(input) {
  var participantId = text_(input.participantId);
  var productId = text_(input.productId);
  var quantity = Number(input.quantity);
  if (!participantId || !productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
    throw new Error('INVALID_LAUNCH: Participante, produto e quantidade válida são obrigatórios.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var games = rows_('GINCANAS');
    var game = games.find(function (item) { return text_(item.STATUS).toUpperCase() === 'ATIVA'; });
    if (!game) throw new Error('NO_ACTIVE_GAME: Não há uma gincana ativa para receber lançamentos.');

    var participant = rows_('PARTICIPANTES').find(function (item) { return text_(item.ID) === participantId; });
    if (!participant) throw new Error('PARTICIPANT_NOT_FOUND: Participante não encontrada.');
    var product = rows_('PRODUTOS').find(function (item) { return text_(item.ID) === productId; });
    if (!product) throw new Error('PRODUCT_NOT_FOUND: Produto não encontrado.');

    var launches = rows_('LANCAMENTOS');
    var duplicate = launches.some(function (launch) {
      return text_(launch.GINCANA_ID) === text_(game.ID) && text_(launch.PARTICIPANTE_ID) === participantId && text_(launch.PRODUTO_ID) === productId && text_(launch.STATUS).toUpperCase() === 'ATIVO';
    });
    var now = new Date();
    var id = Utilities.getUuid();
    appendObject_('LANCAMENTOS', {
      ID: id,
      GINCANA_ID: text_(game.ID),
      PARTICIPANTE_ID: participantId,
      PRODUTO_ID: productId,
      TIPO: 'INSCRICAO',
      STATUS: 'ATIVO',
      INSCRICOES_DELTA: quantity,
      VALOR_CENTAVOS_DELTA: 0,
      PONTOS_DELTA: quantity,
      DATA_OCORRENCIA: now,
      ORGAO_CLIENTE: text_(input.client),
      OBSERVACAO: text_(input.notes),
      LANCAMENTO_ORIGEM_ID: '',
      ALERTA_DUPLICIDADE: duplicate ? 'SIM' : 'NAO',
      DUPLICIDADE_CONFIRMADA_POR: '',
      PUBLICADO_NA_VERSAO: '',
      CRIADO_POR: text_(input.createdBy) || 'painel.supervisora',
      CRIADO_EM: now
    });
    appendObject_('AUDITORIA', {
      ID: Utilities.getUuid(),
      ACAO: 'CRIAR',
      ENTIDADE: 'LANCAMENTO',
      ENTIDADE_ID: id,
      ANTES_JSON: '{}',
      DEPOIS_JSON: JSON.stringify({ id: id, participanteId: participantId, produtoId: productId, quantidade: quantity }),
      USUARIO: text_(input.createdBy) || 'painel.supervisora',
      DATA_HORA: now
    });
    return bootstrap_();
  } finally {
    lock.releaseLock();
  }
}
