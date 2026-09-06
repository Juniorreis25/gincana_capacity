function bootstrap_() {
  var games = rows_('GINCANAS');
  var active = games.find(function (game) { return text_(game.STATUS).toUpperCase() === 'ATIVA'; }) || null;
  var activeId = active ? text_(active.ID) : '';

  var participants = rows_('PARTICIPANTES').filter(function (participant) {
    return !participant.ATIVO || String(participant.ATIVO).toUpperCase() === 'TRUE' || String(participant.ATIVO).toUpperCase() === 'SIM';
  });
  var teams = rows_('EQUIPES');
  var products = rows_('PRODUTOS').filter(function (product) {
    return !product.ATIVO || String(product.ATIVO).toUpperCase() === 'TRUE' || String(product.ATIVO).toUpperCase() === 'SIM';
  });
  var launches = rows_('LANCAMENTOS');
  var pendingLaunches = launches.filter(function (launch) { return !text_(launch.PUBLICADO_NA_VERSAO); });
  var publishedRows = rows_('PLACAR_PUBLICADO');
  var published = publishedRows.length ? publishedSnapshot_(publishedRows) : null;

  var participantById = participants.reduce(function (result, participant) {
    result[text_(participant.ID)] = participant;
    return result;
  }, {});
  var teamById = teams.reduce(function (result, team) {
    result[text_(team.ID)] = team;
    return result;
  }, {});
  var totals = launches.filter(function (launch) {
    return text_(launch.STATUS).toUpperCase() === 'ATIVO' && (!activeId || text_(launch.GINCANA_ID) === activeId);
  }).reduce(function (result, launch) {
    var id = text_(launch.PARTICIPANTE_ID);
    result[id] = (result[id] || 0) + number_(launch.QUANTIDADE);
    return result;
  }, {});

  return {
    activeGame: active ? { id: activeId, name: text_(active.NOME), status: text_(active.STATUS) } : null,
    participants: participants.map(function (participant) {
      var name = text_(participant.NOME);
      var registrations = totals[text_(participant.ID)] || 0;
      return {
        id: text_(participant.ID),
        name: name,
        team: text_((teamById[text_(participant.EQUIPE_ID)] || {}).NOME),
        initials: initials_(name),
        registrations: registrations,
        progress: Math.min(100, registrations * 5)
      };
    }).sort(function (a, b) { return b.registrations - a.registrations; }),
    teams: teams.map(function (team) { return { id: text_(team.ID), name: text_(team.NOME) }; }),
    products: products.map(function (product) { return { id: text_(product.ID), name: text_(product.NOME), points: number_(product.PONTOS_POR_UNIDADE) }; }),
    pendingCount: pendingLaunches.length,
    unpublishedTotal: pendingLaunches.reduce(function (sum, launch) { return sum + number_(launch.INSCRICOES_DELTA); }, 0),
    published: published
  };
}

function publishedSnapshot_(rows) {
  var version = rows.reduce(function (max, row) { return Math.max(max, number_(row.VERSAO)); }, 0);
  var latestRows = rows.filter(function (row) { return number_(row.VERSAO) === version; });
  var publishedAt = latestRows.length ? dateText_(latestRows[0].PUBLICADO_EM) : '';
  var ranking = latestRows.map(function (row) {
    var name = text_(row.NOME_PARTICIPANTE);
    var registrations = number_(row.INSCRICOES);
    var progress = row.PERCENTUAL_META === undefined || row.PERCENTUAL_META === '' ? Math.min(100, registrations * 5) : number_(row.PERCENTUAL_META);
    return { id: text_(row.PARTICIPANTE_ID), name: name, team: text_(row.EQUIPE), initials: initials_(name), registrations: registrations, progress: progress };
  }).sort(function (a, b) { return b.registrations - a.registrations; });
  return { version: version, total: ranking.reduce(function (sum, row) { return sum + row.registrations; }, 0), publishedAt: publishedAt, ranking: ranking };
}

function initials_(name) {
  return text_(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join('');
}
