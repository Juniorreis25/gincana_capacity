function adminData_() {
  var participants = rows_('PARTICIPANTES');
  var products = rows_('PRODUTOS');
  var launches = rows_('LANCAMENTOS');
  return {
    participants: participants.map(function (row) {
      return {
        id: text_(row.ID), name: text_(row.NOME), avatarUrl: text_(row.AVATAR_URL),
        active: isActive_(row.ATIVO), createdAt: dateText_(row.CRIADO_EM),
        historyCount: launches.filter(function (item) { return text_(item.PARTICIPANTE_ID) === text_(row.ID); }).length
      };
    }),
    products: products.map(function (row) {
      return {
        id: text_(row.ID), name: text_(row.NOME), category: text_(row.CATEGORIA),
        active: isActive_(row.ATIVO), createdAt: dateText_(row.CRIADO_EM),
        historyCount: launches.filter(function (item) { return text_(item.PRODUTO_ID) === text_(row.ID); }).length
      };
    })
  };
}

function adminMutate_(kind, action, input) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var sheetName = kind === 'participant' ? 'PARTICIPANTES' : 'PRODUTOS';
    var id = text_(input.id);
    var now = new Date();
    if (action.indexOf('create') === 0) {
      var object = adminObject_(kind, input, now);
      appendObject_(sheetName, object);
      auditAdmin_('CRIAR', kind, object.ID, {}, object);
    } else {
      if (!id) throw new Error('INVALID_RECORD: Identificador obrigatório.');
      var current = rows_(sheetName).find(function (row) { return text_(row.ID) === id; });
      if (!current) throw new Error('RECORD_NOT_FOUND: Registro não encontrado.');
      if (action.indexOf('delete') === 0) {
        assertUnreferenced_(kind, id);
        deactivateLegacyLinks_(kind, id);
        deleteObjectById_(sheetName, id);
        auditAdmin_('EXCLUIR', kind, id, current, {});
      } else if (action.indexOf('deactivate') === 0) {
        updateObjectById_(sheetName, id, { ATIVO: 'NAO' });
        auditAdmin_('DESATIVAR', kind, id, current, { ATIVO: 'NAO' });
      } else if (action.indexOf('activate') === 0) {
        updateObjectById_(sheetName, id, { ATIVO: 'SIM' });
        auditAdmin_('ATIVAR', kind, id, current, { ATIVO: 'SIM' });
      } else {
        var changes = adminChanges_(kind, input, current);
        updateObjectById_(sheetName, id, changes);
        auditAdmin_('EDITAR', kind, id, current, changes);
      }
    }
    SpreadsheetApp.flush();
    return adminData_();
  } finally { lock.releaseLock(); }
}

function adminChanges_(kind, input, current) {
  if (kind === 'participant') {
    return {
      NOME: text_(input.name) || text_(current.NOME),
      AVATAR_URL: input.avatarUrl === undefined ? text_(current.AVATAR_URL) : text_(input.avatarUrl)
    };
  }
  return {
    NOME: text_(input.name) || text_(current.NOME),
    CATEGORIA: input.category === undefined ? text_(current.CATEGORIA) : text_(input.category)
  };
}

function adminObject_(kind, input, now) {
  var id = text_(input.id) || Utilities.getUuid();
  var name = text_(input.name);
  if (!name) throw new Error('INVALID_RECORD: Nome obrigatório.');
  if (kind === 'participant') {
    return { ID: id, NOME: name, EQUIPE_ID: '', AVATAR_URL: text_(input.avatarUrl), ATIVO: 'SIM', CRIADO_EM: now };
  }
  return { ID: id, NOME: name, CATEGORIA: text_(input.category) || 'OUTRO', DATA_EVENTO: '', ATIVO: 'SIM', PONTOS_POR_UNIDADE: 0, CRIADO_EM: now };
}

function assertUnreferenced_(kind, id) {
  var field = kind === 'participant' ? 'PARTICIPANTE_ID' : 'PRODUTO_ID';
  var found = rows_('LANCAMENTOS').some(function (row) { return text_(row[field]) === id; });
  if (found) throw new Error('RECORD_HAS_RELATIONSHIPS: Registro possui histórico; desative-o em vez de excluir.');
}

function deactivateLegacyLinks_(kind, id) {
  var sheetName = kind === 'participant' ? 'GINCANA_PARTICIPANTES' : 'GINCANA_PRODUTOS';
  var field = kind === 'participant' ? 'PARTICIPANTE_ID' : 'PRODUTO_ID';
  rows_(sheetName).filter(function (row) { return text_(row[field]) === id && isActive_(row.ATIVO); }).forEach(function (row) {
    updateObjectById_(sheetName, text_(row.ID), { ATIVO: 'NAO' });
  });
}

function deleteObjectById_(name, id) {
  var sheet = sheet_(name);
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(function (header) { return String(header).trim(); });
  var idColumn = headers.indexOf('ID');
  for (var rowIndex = values.length - 1; rowIndex >= 1; rowIndex -= 1) {
    if (text_(values[rowIndex][idColumn]) === id) sheet.deleteRow(rowIndex + 1);
  }
}

function auditAdmin_(action, entity, id, before, after) {
  appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: action, ENTIDADE: entity.toUpperCase(), ENTIDADE_ID: id, ANTES_JSON: JSON.stringify(before || {}), DEPOIS_JSON: JSON.stringify(after || {}), USUARIO: 'painel.supervisora', DATA_HORA: new Date() });
}
