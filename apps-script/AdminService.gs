function adminData_() {
  var teams = rows_('EQUIPES');
  var participants = rows_('PARTICIPANTES');
  var products = rows_('PRODUTOS');
  var games = rows_('GINCANAS');
  var launches = rows_('LANCAMENTOS');
  var participantLinks = rows_('GINCANA_PARTICIPANTES');
  var productLinks = rows_('GINCANA_PRODUTOS');
  return {
    teams: teams.map(function (row) { return { id: text_(row.ID), name: text_(row.NOME), color: text_(row.COR), active: isActive_(row.ATIVO), createdAt: dateText_(row.CRIADO_EM) }; }),
    participants: participants.map(function (row) { return { id: text_(row.ID), name: text_(row.NOME), teamId: text_(row.EQUIPE_ID), active: isActive_(row.ATIVO), createdAt: dateText_(row.CRIADO_EM), historyCount: launches.filter(function (item) { return text_(item.PARTICIPANTE_ID) === text_(row.ID); }).length }; }),
    products: products.map(function (row) { return { id: text_(row.ID), name: text_(row.NOME), category: text_(row.CATEGORIA), eventDate: dateText_(row.DATA_EVENTO), active: isActive_(row.ATIVO), points: number_(row.PONTOS_POR_UNIDADE), createdAt: dateText_(row.CRIADO_EM), historyCount: launches.filter(function (item) { return text_(item.PRODUTO_ID) === text_(row.ID); }).length }; }),
    games: games.map(function (row) { return { id: text_(row.ID), name: text_(row.NOME), slug: text_(row.SLUG), startDate: dateText_(row.DATA_INICIO), endDate: dateText_(row.DATA_FIM), status: text_(row.STATUS), criterion: text_(row.CRITERIO_PRINCIPAL), format: text_(row.FORMATO_RANKING), goal: number_(row.META_COLETIVA), publishedVersion: number_(row.VERSAO_PUBLICADA), participants: participantLinks.filter(function (link) { return text_(link.GINCANA_ID) === text_(row.ID) && isActive_(link.ATIVO); }).map(function (link) { return text_(link.PARTICIPANTE_ID); }), products: productLinks.filter(function (link) { return text_(link.GINCANA_ID) === text_(row.ID) && isActive_(link.ATIVO); }).map(function (link) { return text_(link.PRODUTO_ID); }) }; })
  };
}

function adminMutate_(kind, action, input) {
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var sheetName = kind === 'team' ? 'EQUIPES' : kind === 'participant' ? 'PARTICIPANTES' : kind === 'product' ? 'PRODUTOS' : 'GINCANAS';
    var id = text_(input.id);
    var now = new Date();
    if (action.indexOf('create') === 0) {
      var object = adminObject_(kind, input, now);
      appendObject_(sheetName, object);
      auditAdmin_('CRIAR', kind, object.ID, {}, object);
    } else {
      if (!id) throw new Error('INVALID_RECORD: Identificador obrigatório.');
      var rows = rows_(sheetName); var current = rows.find(function (row) { return text_(row.ID) === id; });
      if (!current) throw new Error('RECORD_NOT_FOUND: Registro não encontrado.');
      if (action.indexOf('delete') === 0) {
        assertUnreferenced_(kind, id);
        deleteObjectById_(sheetName, id);
        auditAdmin_('EXCLUIR', kind, id, current, {});
      } else if (action.indexOf('activate') === 0) {
        rows_('GINCANAS').filter(function (game) { return text_(game.STATUS).toUpperCase() === 'ATIVA' && text_(game.ID) !== id; }).forEach(function (game) { updateObjectById_('GINCANAS', text_(game.ID), { STATUS: 'ENCERRADA', ATUALIZADO_EM: now }); });
        updateObjectById_(sheetName, id, { STATUS: 'ATIVA', ATUALIZADO_EM: now });
        auditAdmin_('ATIVAR', kind, id, current, { STATUS: 'ATIVA' });
      } else if (action.indexOf('deactivate') === 0) {
        if (kind === 'game') updateObjectById_(sheetName, id, { STATUS: 'ENCERRADA', ATUALIZADO_EM: now });
        else updateObjectById_(sheetName, id, { ATIVO: 'NAO' });
        auditAdmin_('DESATIVAR', kind, id, current, { ATIVO: 'NAO' });
      } else {
        var changes = adminChanges_(kind, input, current, now);
        updateObjectById_(sheetName, id, changes);
        auditAdmin_('EDITAR', kind, id, current, changes);
      }
    }
    return adminData_();
  } finally { lock.releaseLock(); }
}

function adminChanges_(kind, input, current, now) {
  if (kind === 'team') return { NOME: text_(input.name) || text_(current.NOME), COR: input.color === undefined ? text_(current.COR) : text_(input.color) };
  if (kind === 'participant') return { NOME: text_(input.name) || text_(current.NOME), EQUIPE_ID: input.teamId === undefined ? text_(current.EQUIPE_ID) : text_(input.teamId), AVATAR_URL: input.avatarUrl === undefined ? text_(current.AVATAR_URL) : text_(input.avatarUrl) };
  if (kind === 'product') return { NOME: text_(input.name) || text_(current.NOME), CATEGORIA: input.category === undefined ? text_(current.CATEGORIA) : text_(input.category), DATA_EVENTO: input.eventDate === undefined ? text_(current.DATA_EVENTO) : text_(input.eventDate), PONTOS_POR_UNIDADE: input.points === undefined ? number_(current.PONTOS_POR_UNIDADE) : number_(input.points) };
  var changes = { NOME: text_(input.name) || text_(current.NOME), SLUG: input.slug === undefined ? text_(current.SLUG) : text_(input.slug), DATA_INICIO: input.startDate === undefined ? current.DATA_INICIO : input.startDate, DATA_FIM: input.endDate === undefined ? current.DATA_FIM : input.endDate, STATUS: input.status === undefined ? text_(current.STATUS) : text_(input.status), CRITERIO_PRINCIPAL: input.criterion === undefined ? text_(current.CRITERIO_PRINCIPAL) : text_(input.criterion), FORMATO_RANKING: input.format === undefined ? text_(current.FORMATO_RANKING) : text_(input.format), META_COLETIVA: input.goal === undefined ? number_(current.META_COLETIVA) : number_(input.goal), ATUALIZADO_EM: now };
  return changes;
}

function adminObject_(kind, input, now) {
  var id = text_(input.id) || Utilities.getUuid();
  var name = text_(input.name); if (!name) throw new Error('INVALID_RECORD: Nome obrigatório.');
  if (kind === 'team') return { ID: id, NOME: name, COR: text_(input.color), ATIVO: 'SIM', CRIADO_EM: now };
  if (kind === 'participant') return { ID: id, NOME: name, EQUIPE_ID: text_(input.teamId), AVATAR_URL: '', ATIVO: 'SIM', CRIADO_EM: now };
  if (kind === 'product') return { ID: id, NOME: name, CATEGORIA: text_(input.category) || 'OUTRO', DATA_EVENTO: text_(input.eventDate), ATIVO: 'SIM', PONTOS_POR_UNIDADE: number_(input.points), CRIADO_EM: now };
  var slug = text_(input.slug) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { ID: id, NOME: name, SLUG: slug, DATA_INICIO: text_(input.startDate), DATA_FIM: text_(input.endDate), STATUS: text_(input.status) || 'RASCUNHO', CRITERIO_PRINCIPAL: text_(input.criterion) || 'INSCRICOES', FORMATO_RANKING: text_(input.format) || 'GERAL', META_COLETIVA: number_(input.goal), EXIBIR_CRITERIO: 'SIM', VERSAO_PUBLICADA: 0, CRIADO_POR: 'painel.supervisora', CRIADO_EM: now, ATUALIZADO_EM: now };
}

function assertUnreferenced_(kind, id) {
  var refs = kind === 'team' ? [{ sheet: 'PARTICIPANTES', field: 'EQUIPE_ID' }, { sheet: 'GINCANA_PARTICIPANTES', field: 'EQUIPE_ID_SNAPSHOT' }] : kind === 'participant' ? [{ sheet: 'GINCANA_PARTICIPANTES', field: 'PARTICIPANTE_ID' }, { sheet: 'LANCAMENTOS', field: 'PARTICIPANTE_ID' }] : kind === 'product' ? [{ sheet: 'GINCANA_PRODUTOS', field: 'PRODUTO_ID' }, { sheet: 'LANCAMENTOS', field: 'PRODUTO_ID' }] : [{ sheet: 'GINCANA_PARTICIPANTES', field: 'GINCANA_ID' }, { sheet: 'GINCANA_PRODUTOS', field: 'GINCANA_ID' }, { sheet: 'LANCAMENTOS', field: 'GINCANA_ID' }, { sheet: 'PLACAR_PUBLICADO', field: 'GINCANA_ID' }, { sheet: 'PUBLICACOES', field: 'GINCANA_ID' }];
  var found = refs.some(function (ref) { return rows_(ref.sheet).some(function (row) { return text_(row[ref.field]) === id; }); });
  if (found) throw new Error('RECORD_HAS_RELATIONSHIPS: Registro possui relacionamentos ou histórico; desative-o em vez de excluir.');
}

function deleteObjectById_(name, id) {
  var sheet = sheet_(name); var range = sheet.getDataRange(); var values = range.getValues(); var headers = values.shift(); var index = headers.map(function (h) { return String(h).trim(); }).indexOf('ID');
  var kept = values.filter(function (row) { return text_(row[index]) !== id; });
  sheet.getRange(1, 1, sheet.getMaxRows(), Math.max(sheet.getMaxColumns(), headers.length)).clearContent();
  sheet.getRange(1, 1, kept.length + 1, headers.length).setValues([headers].concat(kept));
}

function setGameAssociations_(input) {
  var gameId = text_(input.gameId); if (!gameId) throw new Error('INVALID_GAME: Gincana obrigatória.');
  var lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    var game = rows_('GINCANAS').find(function (row) { return text_(row.ID) === gameId; });
    if (!game) throw new Error('INVALID_GAME: Gincana não encontrada.');
    var participantIds = normalizedIds_(input.participantIds); var productIds = normalizedIds_(input.productIds);
    var participants = rows_('PARTICIPANTES'); var products = rows_('PRODUTOS');
    participantIds.forEach(function (id) { if (!participants.some(function (row) { return text_(row.ID) === id && isActive_(row.ATIVO); })) throw new Error('INVALID_PARTICIPANT: Participante inválida ou inativa.'); });
    productIds.forEach(function (id) { if (!products.some(function (row) { return text_(row.ID) === id && isActive_(row.ATIVO); })) throw new Error('INVALID_PRODUCT: Produto inválido ou inativo.'); });
    rows_('GINCANA_PARTICIPANTES').filter(function (row) { return text_(row.GINCANA_ID) === gameId && isActive_(row.ATIVO); }).forEach(function (row) { updateObjectById_('GINCANA_PARTICIPANTES', text_(row.ID), { ATIVO: 'NAO' }); });
    rows_('GINCANA_PRODUTOS').filter(function (row) { return text_(row.GINCANA_ID) === gameId && isActive_(row.ATIVO); }).forEach(function (row) { updateObjectById_('GINCANA_PRODUTOS', text_(row.ID), { ATIVO: 'NAO' }); });
    participantIds.forEach(function (id) { var person = participants.find(function (row) { return text_(row.ID) === text_(id) && isActive_(row.ATIVO); }); if (person) appendObject_('GINCANA_PARTICIPANTES', { ID: Utilities.getUuid(), GINCANA_ID: gameId, PARTICIPANTE_ID: id, EQUIPE_ID_SNAPSHOT: text_(person.EQUIPE_ID), META_INDIVIDUAL: '', ATIVO: 'SIM' }); });
    productIds.forEach(function (id) { var product = products.find(function (row) { return text_(row.ID) === text_(id) && isActive_(row.ATIVO); }); if (product) appendObject_('GINCANA_PRODUTOS', { ID: Utilities.getUuid(), GINCANA_ID: gameId, PRODUTO_ID: id, PONTOS_POR_INSCRICAO: number_(product.PONTOS_POR_UNIDADE), ATIVO: 'SIM' }); });
    auditAdmin_('ASSOCIAR', 'game', gameId, {}, { participants: participantIds, products: productIds });
    SpreadsheetApp.flush();
    return adminData_();
  } finally { lock.releaseLock(); }
}

function normalizedIds_(value) {
  var values = Array.isArray(value) ? value : (value === null || value === undefined || value === '' ? [] : [value]);
  return values.map(function (item) { return text_(item); }).filter(Boolean).filter(function (item, index, all) { return all.indexOf(item) === index; });
}

function auditAdmin_(action, entity, id, before, after) { appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: action, ENTIDADE: entity, ENTIDADE_ID: id, ANTES_JSON: JSON.stringify(before || {}), DEPOIS_JSON: JSON.stringify(after || {}), USUARIO: 'painel.supervisora', DATA_HORA: new Date() }); }
