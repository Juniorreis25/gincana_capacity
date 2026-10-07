function bootstrap_() {
  ensureEmploymentNotesSheet_();
  var activeCampaign = typeof currentCampaign_ === 'function' ? currentCampaign_() : null;
  var activeCampaignId = activeCampaign ? text_(activeCampaign.ID) : '';
  var participantRows = rows_('PARTICIPANTES');
  var productRows = rows_('PRODUTOS');
  var launches = rows_('LANCAMENTOS');
  var scopedLaunches = launches.filter(function (launch) {
    return activeCampaignId ? text_(launch.GINCANA_ID) === activeCampaignId : true;
  });
  var participantById = indexBy_(participantRows, 'ID');
  var productById = indexBy_(productRows, 'ID');
  var campaignParticipantIds = activeCampaignParticipantIds_();
  var activeParticipantById = participantRows.reduce(function (result, row) {
    if (isActive_(row.ATIVO) && (campaignParticipantIds === null || campaignParticipantIds[text_(row.ID)])) result[text_(row.ID)] = true;
    return result;
  }, {});
  var campaignProductIds = activeCampaignProductIds_();
  var activeProductById = productRows.reduce(function (result, row) {
    if (isActive_(row.ATIVO) && (campaignProductIds === null || campaignProductIds[text_(row.ID)])) result[text_(row.ID)] = true;
    return result;
  }, {});

  var totals = scopedLaunches.filter(function (launch) {
    return text_(launch.STATUS).toUpperCase() === 'ATIVO'
      && activeParticipantById[text_(launch.PARTICIPANTE_ID)]
      && activeProductById[text_(launch.PRODUTO_ID)];
  }).reduce(function (result, launch) {
    var participantId = text_(launch.PARTICIPANTE_ID);
    result[participantId] = (result[participantId] || 0) + number_(launch.INSCRICOES_DELTA);
    return result;
  }, {});

  var ranking = participantRows.map(function (participant) {
    return {
      id: text_(participant.ID),
      name: text_(participant.NOME),
      avatarUrl: text_(participant.AVATAR_URL),
      registrations: totals[text_(participant.ID)] || 0
    };
  }).filter(function (participant) {
    return participant.registrations > 0;
  }).sort(function (a, b) {
    return b.registrations - a.registrations || a.name.localeCompare(b.name);
  });

  var noteTotals = activeCampaignId ? employmentNoteTotals_(activeCampaignId) : { byParticipant: {}, total: 0 };
  ranking = ranking.map(function (participant) {
    return Object.assign({}, participant, { noteCount: noteTotals.byParticipant[participant.id] || 0 });
  });
  var employmentNotes = activeCampaignId ? employmentNotesForCampaign_(activeCampaignId) : [];

  var history = scopedLaunches.map(function (launch) {
    var participant = participantById[text_(launch.PARTICIPANTE_ID)] || {};
    var product = productById[text_(launch.PRODUTO_ID)] || {};
    return {
      id: text_(launch.ID),
      participantId: text_(launch.PARTICIPANTE_ID),
      participant: text_(participant.NOME),
      participantAvatarUrl: text_(participant.AVATAR_URL),
      productId: text_(launch.PRODUTO_ID),
      product: text_(product.NOME),
      quantity: number_(launch.INSCRICOES_DELTA),
      date: dateText_(launch.DATA_OCORRENCIA || launch.CRIADO_EM),
      notes: text_(launch.OBSERVACAO),
      status: !activeParticipantById[text_(launch.PARTICIPANTE_ID)] || !activeProductById[text_(launch.PRODUTO_ID)] ? 'INATIVADO' : text_(launch.STATUS),
      createdBy: text_(launch.CRIADO_POR),
      publishedVersion: text_(launch.PUBLICADO_NA_VERSAO),
      pendingPublication: text_(launch.STATUS).toUpperCase() === 'ATIVO' && !text_(launch.PUBLICADO_NA_VERSAO)
    };
  }).sort(function (a, b) {
    return a.date < b.date ? 1 : -1;
  });

  return {
    campaign: typeof campaignPayload_ === 'function' ? campaignPayload_(activeCampaign) : null,
    participants: ranking,
    products: productRows.filter(function (product) { return isActive_(product.ATIVO) && (campaignProductIds === null || campaignProductIds[text_(product.ID)]); }).map(function (product) {
      return { id: text_(product.ID), name: text_(product.NOME) };
    }),
    history: history,
    employmentNotes: employmentNotes,
    totalNotes: noteTotals.total
  };
}

function indexBy_(rows, key) {
  return rows.reduce(function (result, row) {
    result[text_(row[key])] = row;
    return result;
  }, {});
}

function isActive_(value) {
  var normalized = text_(value).toUpperCase();
  return !normalized || normalized === 'TRUE' || normalized === 'SIM' || normalized === '1';
}

function initials_(name) {
  return text_(name).split(/\s+/).filter(Boolean).slice(0, 2).map(function (part) {
    return part.charAt(0).toUpperCase();
  }).join('');
}
