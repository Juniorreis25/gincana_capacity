function publish_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var names = ['PLACAR_PUBLICADO', 'PUBLICACOES', 'LANCAMENTOS', 'GINCANAS', 'AUDITORIA'];
  var backups = names.reduce(function (result, name) { result[name] = captureSheet_(name); return result; }, {});
  try {
    var active = rows_('GINCANAS').find(function (game) { return text_(game.STATUS).toUpperCase() === 'ATIVA'; });
    if (!active) throw new Error('NO_ACTIVE_GAME: Não há uma gincana ativa.');
    var gameId = text_(active.ID);
    var launches = rows_('LANCAMENTOS');
    var pending = launches.filter(function (launch) { return text_(launch.GINCANA_ID) === gameId && text_(launch.STATUS).toUpperCase() === 'ATIVO' && !text_(launch.PUBLICADO_NA_VERSAO); });
    if (!pending.length) throw new Error('NOTHING_TO_PUBLISH: Não existem alterações pendentes de publicação.');
    var ranking = rankingForGame_(gameId);
    if (!ranking.length) throw new Error('EMPTY_PUBLICATION: Não foi possível gerar um ranking vazio.');
    var existing = rows_('PLACAR_PUBLICADO').filter(function (row) { return text_(row.GINCANA_ID) === gameId; });
    var currentVersion = existing.reduce(function (max, row) { return Math.max(max, number_(row.VERSAO)); }, number_(active.VERSAO_PUBLICADA));
    var version = currentVersion + 1;
    var now = new Date();
    replacePublishedRows_(gameId, version, ranking, now);
    appendObject_('PUBLICACOES', {
      ID: Utilities.getUuid(), GINCANA_ID: gameId, VERSAO: version, PUBLICADO_POR: 'painel.supervisora', PUBLICADO_EM: now,
      QUANTIDADE_LANCAMENTOS: pending.length, RESUMO_JSON: JSON.stringify({ total: ranking.reduce(function (sum, row) { return sum + row.registrations; }, 0), participantes: ranking.length }), OBSERVACAO: ''
    });
    pending.forEach(function (launch) { updateObjectById_('LANCAMENTOS', text_(launch.ID), { PUBLICADO_NA_VERSAO: version }); });
    updateObjectById_('GINCANAS', gameId, { VERSAO_PUBLICADA: version, ATUALIZADO_EM: now });
    appendObject_('AUDITORIA', {
      ID: Utilities.getUuid(), ACAO: 'PUBLICAR', ENTIDADE: 'PLACAR', ENTIDADE_ID: gameId, ANTES_JSON: JSON.stringify({ versao: currentVersion }),
      DEPOIS_JSON: JSON.stringify({ versao: version, lancamentos: pending.length }), USUARIO: 'painel.supervisora', DATA_HORA: now
    });
    return { version: version, bootstrap: bootstrap_() };
  } catch (error) {
    names.forEach(function (name) { restoreSheet_(name, backups[name]); });
    throw new Error('PUBLICATION_FAILED: O placar anterior foi mantido. ' + (error && error.message ? error.message : error));
  } finally {
    lock.releaseLock();
  }
}

function replacePublishedRows_(gameId, version, ranking, publishedAt) {
  var sheet = sheet_('PLACAR_PUBLICADO');
  var values = sheet.getDataRange().getValues();
  var headers = values.shift().map(function (header) { return String(header).trim(); });
  var kept = values.filter(function (row) { return text_(row[headers.indexOf('GINCANA_ID')]) !== text_(gameId); });
  var rows = ranking.map(function (person, index) {
    var object = { GINCANA_ID: gameId, VERSAO: version, TIPO_RANKING: 'GERAL', EQUIPE_ID: '', POSICAO: index + 1, PARTICIPANTE_ID: person.id, NOME: person.name, EQUIPE: person.team, AVATAR_URL: '', INSCRICOES: person.registrations, PUBLICADO_EM: publishedAt };
    return headers.map(function (header) { return object[header] === undefined ? '' : object[header]; });
  });
  var output = [headers].concat(kept).concat(rows);
  sheet.getRange(1, 1, sheet.getMaxRows(), Math.max(sheet.getMaxColumns(), headers.length)).clearContent();
  sheet.getRange(1, 1, output.length, headers.length).setValues(output);
}

function updateObjectById_(name, id, changes) {
  var sheet = sheet_(name);
  var range = sheet.getDataRange();
  var values = range.getValues();
  if (!values.length) throw new Error('RECORD_NOT_FOUND: Registro não encontrado em ' + name + '.');
  var headers = values[0].map(function (header) { return String(header).trim(); });
  var idIndex = headers.indexOf('ID');
  for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (text_(values[rowIndex][idIndex]) !== text_(id)) continue;
    Object.keys(changes).forEach(function (key) { var column = headers.indexOf(key); if (column >= 0) values[rowIndex][column] = changes[key]; });
    range.setValues(values);
    return true;
  }
  throw new Error('RECORD_NOT_FOUND: Registro não encontrado em ' + name + '.');
}

function captureSheet_(name) { return sheet_(name).getDataRange().getValues(); }
function restoreSheet_(name, values) {
  var sheet = sheet_(name);
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearContent();
  if (values && values.length && values[0].length) sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
}
