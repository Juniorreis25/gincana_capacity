function bootstrap_() {
  var games = rows_('GINCANAS');
  var active = games.find(function (game) { return text_(game.STATUS).toUpperCase() === 'ATIVA'; }) || null;
  var activeId = active ? text_(active.ID) : '';
  var participants = rows_('PARTICIPANTES').filter(function (participant) { return isActive_(participant.ATIVO); });
  var teams = rows_('EQUIPES');
  var products = rows_('PRODUTOS').filter(function (product) { return isActive_(product.ATIVO); });
  var launches = rows_('LANCAMENTOS');
  var publishedRows = rows_('PLACAR_PUBLICADO');
  var published = activeId ? publishedSnapshotForGame_(publishedRows, activeId) : null;
  var participantById = indexBy_(participants, 'ID');
  var productById = indexBy_(products.concat(rows_('PRODUTOS')), 'ID');
  var pendingLaunches = launches.filter(function (launch) {
    return text_(launch.GINCANA_ID) === activeId && text_(launch.STATUS).toUpperCase() === 'ATIVO' && !text_(launch.PUBLICADO_NA_VERSAO);
  });
  var ranking = activeId ? rankingForGame_(activeId, participants, teams, launches) : [];
  var history = launches.filter(function (launch) { return !activeId || text_(launch.GINCANA_ID) === activeId; }).map(function (launch) {
    var participant = participantById[text_(launch.PARTICIPANTE_ID)] || {};
    var product = productById[text_(launch.PRODUTO_ID)] || {};
    return {
      id: text_(launch.ID), date: dateText_(launch.DATA_OCORRENCIA || launch.CRIADO_EM),
      participantId: text_(launch.PARTICIPANTE_ID), participant: text_(participant.NOME),
      productId: text_(launch.PRODUTO_ID), product: text_(product.NOME), quantity: number_(launch.INSCRICOES_DELTA),
      status: text_(launch.STATUS), type: text_(launch.TIPO), publishedVersion: text_(launch.PUBLICADO_NA_VERSAO),
      createdBy: text_(launch.CRIADO_POR), pendingPublication: !text_(launch.PUBLICADO_NA_VERSAO) && text_(launch.STATUS).toUpperCase() === 'ATIVO'
    };
  }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  var cancellationRows = rows_('CANCELAMENTOS');
  var cancellations = cancellationRows.filter(function (cancellation) {
    var launch = launches.find(function (item) { return text_(item.ID) === text_(cancellation.LANCAMENTO_ID); });
    return !activeId || (launch && text_(launch.GINCANA_ID) === activeId);
  }).map(function (cancellation) {
    var launch = launches.find(function (item) { return text_(item.ID) === text_(cancellation.LANCAMENTO_ID); }) || {};
    var participant = participantById[text_(launch.PARTICIPANTE_ID)] || {};
    var product = productById[text_(launch.PRODUTO_ID)] || {};
    return {
      id: text_(cancellation.ID), launchId: text_(cancellation.LANCAMENTO_ID), participant: text_(participant.NOME), product: text_(product.NOME),
      quantity: number_(launch.INSCRICOES_DELTA), reason: text_(cancellation.MOTIVO), status: text_(cancellation.STATUS),
      requestedBy: text_(cancellation.SOLICITADO_POR), requestedAt: dateText_(cancellation.SOLICITADO_EM),
      analyzedBy: text_(cancellation.ANALISADO_POR), analyzedAt: dateText_(cancellation.ANALISADO_EM),
      analysisJustification: text_(cancellation.JUSTIFICATIVA_ANALISE), reversalId: text_(cancellation.REVERSAO_ID)
    };
  }).sort(function (a, b) { return a.requestedAt < b.requestedAt ? 1 : -1; });

  return {
    activeGame: active ? { id: activeId, name: text_(active.NOME), status: text_(active.STATUS) } : null,
    participants: ranking,
    teams: teams.map(function (team) { return { id: text_(team.ID), name: text_(team.NOME) }; }),
    products: products.map(function (product) { return { id: text_(product.ID), name: text_(product.NOME), points: number_(product.PONTOS_POR_UNIDADE) }; }),
    history: history, cancellations: cancellations, pendingCount: pendingLaunches.length,
    unpublishedTotal: pendingLaunches.reduce(function (sum, launch) { return sum + number_(launch.INSCRICOES_DELTA); }, 0),
    pendingParticipants: pendingLaunches.reduce(function (result, launch) { result[text_(launch.PARTICIPANTE_ID)] = true; return result; }, {}),
    published: published
  };
}

function rankingForGame_(gameId, participants, teams, launches) {
  var participantRows = participants || rows_('PARTICIPANTES').filter(function (participant) { return isActive_(participant.ATIVO); });
  var teamRows = teams || rows_('EQUIPES');
  var launchRows = launches || rows_('LANCAMENTOS');
  var teamById = indexBy_(teamRows, 'ID');
  var totals = launchRows.filter(function (launch) {
    // Lançamentos revertidos continuam compondo o livro-caixa; a reversão
    // negativa compensa o original uma única vez no ranking.
    return text_(launch.GINCANA_ID) === text_(gameId) && ['ATIVO', 'REVERTIDO'].indexOf(text_(launch.STATUS).toUpperCase()) >= 0;
  }).reduce(function (result, launch) {
    var id = text_(launch.PARTICIPANTE_ID); result[id] = (result[id] || 0) + number_(launch.INSCRICOES_DELTA); return result;
  }, {});
  return participantRows.map(function (participant) {
    var name = text_(participant.NOME); var registrations = totals[text_(participant.ID)] || 0;
    return { id: text_(participant.ID), name: name, team: text_((teamById[text_(participant.EQUIPE_ID)] || {}).NOME), initials: initials_(name), registrations: registrations, progress: Math.min(100, registrations * 5) };
  }).sort(function (a, b) { return b.registrations - a.registrations || a.name.localeCompare(b.name); });
}

function publishedSnapshotForGame_(rows, gameId) {
  var gameRows = rows.filter(function (row) { return text_(row.GINCANA_ID) === text_(gameId); });
  return gameRows.length ? publishedSnapshot_(gameRows) : null;
}

function publishedSnapshot_(rows) {
  var version = rows.reduce(function (max, row) { return Math.max(max, number_(row.VERSAO)); }, 0);
  var latestRows = rows.filter(function (row) { return number_(row.VERSAO) === version; });
  var publishedAt = latestRows.length ? dateText_(latestRows[0].PUBLICADO_EM) : '';
  var ranking = latestRows.map(function (row) {
    var name = text_(row.NOME); var registrations = number_(row.INSCRICOES);
    var progress = row.PERCENTUAL_META === undefined || row.PERCENTUAL_META === '' ? Math.min(100, registrations * 5) : number_(row.PERCENTUAL_META);
    return { id: text_(row.PARTICIPANTE_ID), name: name, team: text_(row.EQUIPE), initials: initials_(name), registrations: registrations, progress: progress };
  }).sort(function (a, b) { return b.registrations - a.registrations || a.name.localeCompare(b.name); });
  return { version: version, total: ranking.reduce(function (sum, row) { return sum + row.registrations; }, 0), publishedAt: publishedAt, ranking: ranking };
}

function indexBy_(rows, key) { return rows.reduce(function (result, row) { result[text_(row[key])] = row; return result; }, {}); }
function isActive_(value) { var normalized = text_(value).toUpperCase(); return !normalized || normalized === 'TRUE' || normalized === 'SIM' || normalized === '1'; }
function initials_(name) { return text_(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join(''); }
