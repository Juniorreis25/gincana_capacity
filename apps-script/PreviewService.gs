function preview_() {
  var active = rows_('GINCANAS').find(function (game) { return text_(game.STATUS).toUpperCase() === 'ATIVA'; });
  if (!active) throw new Error('NO_ACTIVE_GAME: Não há uma gincana ativa.');
  var gameId = text_(active.ID);
  var current = rankingForGame_(gameId);
  var published = publishedSnapshotForGame_(rows_('PLACAR_PUBLICADO'), gameId);
  var previousById = (published ? published.ranking : []).reduce(function (result, row, index) {
    result[text_(row.id)] = { position: index + 1, registrations: row.registrations, name: row.name, team: row.team, initials: row.initials }; return result;
  }, {});
  var currentById = current.reduce(function (result, row, index) {
    result[text_(row.id)] = { position: index + 1, registrations: row.registrations, name: row.name, team: row.team, initials: row.initials }; return result;
  }, {});
  var changes = current.map(function (row, index) {
    var previous = previousById[text_(row.id)] || { position: null, registrations: 0 };
    var delta = previous.position === null ? null : previous.position - (index + 1);
    return { id: row.id, name: row.name, team: row.team, initials: row.initials, previousPosition: previous.position, newPosition: index + 1, previousRegistrations: previous.registrations, newRegistrations: row.registrations, movement: delta === null ? 'nova' : delta > 0 ? 'subida' : delta < 0 ? 'descida' : 'manutencao', positionDelta: delta || 0 };
  });
  Object.keys(previousById).forEach(function (id) {
    if (currentById[id]) return;
    var previous = previousById[id];
    changes.push({ id: id, name: previous.name, team: previous.team, initials: previous.initials, previousPosition: previous.position, newPosition: null, previousRegistrations: previous.registrations, newRegistrations: 0, movement: 'descida', positionDelta: null });
  });
  return {
    game: { id: gameId, name: text_(active.NOME) },
    currentTotal: current.reduce(function (sum, row) { return sum + row.registrations; }, 0),
    publishedTotal: published ? published.total : 0,
    pendingCount: rows_('LANCAMENTOS').filter(function (launch) { return text_(launch.GINCANA_ID) === gameId && text_(launch.STATUS).toUpperCase() === 'ATIVO' && !text_(launch.PUBLICADO_NA_VERSAO); }).length,
    publishedVersion: published ? published.version : 0,
    newLeader: current.length ? current[0].name : '',
    leaderChanged: Boolean(current.length && (!published || !published.ranking.length || current[0].id !== published.ranking[0].id)),
    changes: changes
  };
}
