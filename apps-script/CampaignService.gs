function currentCampaign_() {
  var campaigns = rows_('GINCANAS').filter(function (row) { return text_(row.STATUS).toUpperCase() === 'ATIVA'; });
  if (campaigns.length > 1) throw new Error('MULTIPLE_ACTIVE_CAMPAIGNS: A planilha possui mais de uma campanha ativa.');
  return campaigns[0] || null;
}

function activeCampaignProductIds_() {
  var campaign = currentCampaign_();
  if (!campaign) return null;
  return rows_('GINCANA_PRODUTOS').filter(function (row) {
    return text_(row.GINCANA_ID) === text_(campaign.ID) && isActive_(row.ATIVO);
  }).reduce(function (result, row) {
    result[text_(row.PRODUTO_ID)] = true;
    return result;
  }, {});
}

function activeCampaignParticipantIds_() {
  var campaign = currentCampaign_();
  if (!campaign) return null;
  return rows_('GINCANA_PARTICIPANTES').filter(function (row) {
    return text_(row.GINCANA_ID) === text_(campaign.ID) && isActive_(row.ATIVO);
  }).reduce(function (result, row) {
    result[text_(row.PARTICIPANTE_ID)] = true;
    return result;
  }, {});
}

function productInActiveCampaign_(productId) {
  var ids = activeCampaignProductIds_();
  return ids === null || Boolean(ids[text_(productId)]);
}

function ensureCampaignProductLink_(campaignId, productId, now) {
  if (!campaignId) return;
  var current = rows_('GINCANA_PRODUTOS').find(function (row) {
    return text_(row.GINCANA_ID) === text_(campaignId) && text_(row.PRODUTO_ID) === text_(productId);
  });
  if (current) {
    updateObjectById_('GINCANA_PRODUTOS', text_(current.ID), { ATIVO: 'SIM' });
    return;
  }
  appendObject_('GINCANA_PRODUTOS', { ID: Utilities.getUuid(), GINCANA_ID: campaignId, PRODUTO_ID: productId, ATIVO: 'SIM', CRIADO_EM: now });
}

function ensureCampaignParticipantLink_(campaignId, participantId, now) {
  if (!campaignId) return;
  var current = rows_('GINCANA_PARTICIPANTES').find(function (row) {
    return text_(row.GINCANA_ID) === text_(campaignId) && text_(row.PARTICIPANTE_ID) === text_(participantId);
  });
  if (current) {
    updateObjectById_('GINCANA_PARTICIPANTES', text_(current.ID), { ATIVO: 'SIM' });
    return;
  }
  appendObject_('GINCANA_PARTICIPANTES', { ID: Utilities.getUuid(), GINCANA_ID: campaignId, PARTICIPANTE_ID: participantId, ATIVO: 'SIM', CRIADO_EM: now });
}

function updateCampaignProductLinks_(productId, active) {
  rows_('GINCANA_PRODUTOS').filter(function (row) { return text_(row.PRODUTO_ID) === text_(productId); }).forEach(function (row) {
    updateObjectById_('GINCANA_PRODUTOS', text_(row.ID), { ATIVO: active ? 'SIM' : 'NAO' });
  });
}

function updateCampaignParticipantLinks_(participantId, active) {
  rows_('GINCANA_PARTICIPANTES').filter(function (row) { return text_(row.PARTICIPANTE_ID) === text_(participantId); }).forEach(function (row) {
    updateObjectById_('GINCANA_PARTICIPANTES', text_(row.ID), { ATIVO: active ? 'SIM' : 'NAO' });
  });
}

function campaignAssociations_(input) {
  var campaignId = text_(input && input.campaignId);
  var campaign = campaignId ? rows_('GINCANAS').find(function (row) { return text_(row.ID) === campaignId; }) : currentCampaign_();
  if (!campaign) throw new Error('CAMPAIGN_NOT_FOUND: Campanha não encontrada.');
  var participantLinks = rows_('GINCANA_PARTICIPANTES').filter(function (row) { return text_(row.GINCANA_ID) === text_(campaign.ID) && isActive_(row.ATIVO); });
  var productLinks = rows_('GINCANA_PRODUTOS').filter(function (row) { return text_(row.GINCANA_ID) === text_(campaign.ID) && isActive_(row.ATIVO); });
  var participantIds = participantLinks.reduce(function (result, row) { result[text_(row.PARTICIPANTE_ID)] = true; return result; }, {});
  var productIds = productLinks.reduce(function (result, row) { result[text_(row.PRODUTO_ID)] = true; return result; }, {});
  return {
    campaign: campaignPayload_(campaign),
    participants: rows_('PARTICIPANTES').map(function (row) { return { id: text_(row.ID), name: text_(row.NOME), active: isActive_(row.ATIVO), associated: Boolean(participantIds[text_(row.ID)]) }; }),
    products: rows_('PRODUTOS').map(function (row) { return { id: text_(row.ID), name: text_(row.NOME), active: isActive_(row.ATIVO), associated: Boolean(productIds[text_(row.ID)]) }; })
  };
}

function updateCampaignAssociations_(input) {
  var campaign = currentCampaign_();
  if (!campaign) throw new Error('NO_ACTIVE_CAMPAIGN: Crie uma campanha ativa antes de configurar associações.');
  var participantIds = uniqueIds_(input && input.participantIds);
  var productIds = uniqueIds_(input && input.productIds);
  var participants = rows_('PARTICIPANTES');
  var products = rows_('PRODUTOS');
  if (participantIds.some(function (id) { return !participants.some(function (row) { return text_(row.ID) === id && isActive_(row.ATIVO); }); })) throw new Error('INVALID_PARTICIPANT_ASSOCIATION: Participante inválido ou inativo.');
  if (productIds.some(function (id) { return !products.some(function (row) { return text_(row.ID) === id && isActive_(row.ATIVO); }); })) throw new Error('INVALID_PRODUCT_ASSOCIATION: Produto inválido ou inativo.');
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var participantSnapshot = null;
  var productSnapshot = null;
  try {
    participantSnapshot = captureSheet_('GINCANA_PARTICIPANTES');
    productSnapshot = captureSheet_('GINCANA_PRODUTOS');
    syncCampaignLinks_('GINCANA_PARTICIPANTES', text_(campaign.ID), 'PARTICIPANTE_ID', participantIds);
    syncCampaignLinks_('GINCANA_PRODUTOS', text_(campaign.ID), 'PRODUTO_ID', productIds);
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'ATUALIZAR_ASSOCIACOES', ENTIDADE: 'GINCANA', ENTIDADE_ID: text_(campaign.ID), ANTES_JSON: '{}', DEPOIS_JSON: JSON.stringify({ participantes: participantIds, produtos: productIds }), USUARIO: 'painel.supervisora', DATA_HORA: new Date() });
    SpreadsheetApp.flush();
    return campaignAssociations_({ campaignId: text_(campaign.ID) });
  } catch (error) {
    if (participantSnapshot && productSnapshot) {
      restoreSheet_('GINCANA_PARTICIPANTES', participantSnapshot);
      restoreSheet_('GINCANA_PRODUTOS', productSnapshot);
    }
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'ERRO_ATUALIZAR_ASSOCIACOES', ENTIDADE: 'GINCANA', ENTIDADE_ID: text_(campaign.ID), ANTES_JSON: '{}', DEPOIS_JSON: JSON.stringify({ mensagem: error && error.message ? error.message : String(error) }), USUARIO: 'painel.supervisora', DATA_HORA: new Date() });
    throw new Error('ASSOCIATION_UPDATE_FAILED: As associações anteriores foram mantidas. ' + (error && error.message ? error.message : error));
  } finally { lock.releaseLock(); }
}

function uniqueIds_(values) {
  return Array.isArray(values) ? values.map(function (value) { return text_(value); }).filter(Boolean).filter(function (value, index, list) { return list.indexOf(value) === index; }) : [];
}

function syncCampaignLinks_(sheetName, campaignId, key, selectedIds) {
  var selected = selectedIds.reduce(function (result, id) { result[id] = true; return result; }, {});
  rows_(sheetName).filter(function (row) { return text_(row.GINCANA_ID) === campaignId; }).forEach(function (row) {
    updateObjectById_(sheetName, text_(row.ID), { ATIVO: selected[text_(row[key])] ? 'SIM' : 'NAO' });
  });
  var existing = rows_(sheetName);
  selectedIds.forEach(function (id) {
    if (existing.some(function (row) { return text_(row.GINCANA_ID) === campaignId && text_(row[key]) === id; })) return;
    var object = { ID: Utilities.getUuid(), GINCANA_ID: campaignId, ATIVO: 'SIM', CRIADO_EM: new Date() };
    object[key] = id;
    appendObject_(sheetName, object);
  });
}

function campaignPayload_(row) {
  if (!row) return null;
  return {
    id: text_(row.ID), name: text_(row.NOME), slug: text_(row.SLUG),
    startDate: dateText_(row.DATA_INICIO), endDate: dateText_(row.DATA_FIM),
    status: text_(row.STATUS), publishedVersion: number_(row.VERSAO_PUBLICADA),
    createdAt: dateText_(row.CRIADO_EM), updatedAt: dateText_(row.ATUALIZADO_EM)
  };
}

function listCampaigns_() {
  return rows_('GINCANAS').filter(function (row) {
    var status = text_(row.STATUS).toUpperCase();
    return status === 'ENCERRADA' || status === 'ARQUIVADA';
  }).map(function (row) {
    var id = text_(row.ID);
    var snapshot = rows_('PLACAR_PUBLICADO').filter(function (item) { return text_(item.GINCANA_ID) === id; });
    return {
      id: id, name: text_(row.NOME), startDate: dateText_(row.DATA_INICIO), endDate: dateText_(row.DATA_FIM),
      status: text_(row.STATUS), archivedAt: dateText_(row.ATUALIZADO_EM || row.CRIADO_EM),
      participantCount: snapshot.length,
      totalRegistrations: snapshot.reduce(function (sum, item) { return sum + number_(item.INSCRICOES); }, 0)
    };
  }).sort(function (a, b) { return a.startDate < b.startDate ? 1 : -1; });
}

function getCampaign_(input) {
  var id = text_(input && input.id);
  if (!id) return campaignPayload_(currentCampaign_());
  var row = rows_('GINCANAS').find(function (item) { return text_(item.ID) === id; });
  if (!row) throw new Error('CAMPAIGN_NOT_FOUND: Campanha não encontrada.');
  var ranking = publishedRanking_(id);
  return { campaign: campaignPayload_(row), ranking: ranking };
}

function scoreboard_() {
  var active = currentCampaign_();
  if (!active) return { campaign: null, ranking: [], version: 0, publishedAt: '', published: false };
  var campaignId = text_(active.ID);
  var rows = rows_('PLACAR_PUBLICADO').filter(function (row) { return text_(row.GINCANA_ID) === campaignId; });
  var version = rows.reduce(function (max, row) { return Math.max(max, number_(row.VERSAO)); }, number_(active.VERSAO_PUBLICADA));
  var publishedRows = rows.filter(function (row) { return number_(row.VERSAO) === version; }).sort(function (a, b) { return number_(a.POSICAO) - number_(b.POSICAO); });
  return {
    campaign: campaignPayload_(active),
    ranking: publishedRows.map(function (row) { return { id: text_(row.PARTICIPANTE_ID), name: text_(row.NOME), avatarUrl: text_(row.AVATAR_URL), registrations: number_(row.INSCRICOES) }; }),
    version: version,
    publishedAt: publishedRows.length ? dateText_(publishedRows[0].PUBLICADO_EM) : '',
    published: publishedRows.length > 0
  };
}

function startNewCampaign_(input) {
  var values = validateCampaignInput_(input);
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  var names = ['GINCANAS', 'GINCANA_PARTICIPANTES', 'GINCANA_PRODUTOS', 'LANCAMENTOS', 'PLACAR_PUBLICADO', 'PUBLICACOES'];
  var backups = names.reduce(function (result, name) { result[name] = captureSheet_(name); return result; }, {});
  var now = new Date();
  try {
    var previous = currentCampaign_();
    var previousId = previous ? text_(previous.ID) : '';
    var launches = rows_('LANCAMENTOS');
    var previousLaunches = launches.filter(function (launch) {
      return text_(launch.STATUS).toUpperCase() === 'ATIVO' && (previousId ? text_(launch.GINCANA_ID) === previousId : !text_(launch.GINCANA_ID));
    });
    var archive = null;
    if (values.archiveCurrent && (previous || previousLaunches.length)) {
      var archiveId = previousId || Utilities.getUuid();
      if (!previous) {
        appendObject_('GINCANAS', legacyCampaignObject_(archiveId, values, previousLaunches, now));
        previous = rows_('GINCANAS').find(function (row) { return text_(row.ID) === archiveId; });
      }
      var ranking = rankingForLaunches_(previousLaunches);
      var existingSnapshot = rows_('PLACAR_PUBLICADO').filter(function (row) { return text_(row.GINCANA_ID) === archiveId; });
      var version = existingSnapshot.reduce(function (max, row) { return Math.max(max, number_(row.VERSAO)); }, number_(previous && previous.VERSAO_PUBLICADA));
      version = version || 1;
      replacePublishedRows_(archiveId, version, ranking, now);
      appendObject_('PUBLICACOES', {
        ID: Utilities.getUuid(), GINCANA_ID: archiveId, VERSAO: version, PUBLICADO_POR: 'painel.supervisora', PUBLICADO_EM: now,
        QUANTIDADE_LANCAMENTOS: previousLaunches.length, RESUMO_JSON: JSON.stringify({ total: ranking.reduce(function (sum, row) { return sum + row.registrations; }, 0), participantes: ranking.length, tipo: 'ARQUIVAMENTO' }), OBSERVACAO: 'Arquivamento da campanha anterior.'
      });
      previousLaunches.forEach(function (launch) {
        if (!text_(launch.GINCANA_ID)) updateObjectById_('LANCAMENTOS', text_(launch.ID), { GINCANA_ID: archiveId });
      });
      updateObjectById_('GINCANAS', archiveId, { STATUS: 'ENCERRADA', VERSAO_PUBLICADA: version, ATUALIZADO_EM: now });
      archive = { campaign: campaignPayload_(rows_('GINCANAS').find(function (row) { return text_(row.ID) === archiveId; })), ranking: ranking };
    } else if (previous) {
      updateObjectById_('GINCANAS', previousId, { STATUS: 'ENCERRADA', ATUALIZADO_EM: now });
    }

    var newCampaignId = Utilities.getUuid();
    var campaign = { ID: newCampaignId, NOME: values.name, SLUG: slugify_(values.name), DATA_INICIO: values.startDate, DATA_FIM: values.endDate, STATUS: 'ATIVA', VERSAO_PUBLICADA: 0, CRIADO_EM: now, ATUALIZADO_EM: now };
    appendObject_('GINCANAS', campaign);
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'INICIAR_CAMPANHA', ENTIDADE: 'GINCANA', ENTIDADE_ID: newCampaignId, ANTES_JSON: JSON.stringify({ campanhaAnterior: previousId }), DEPOIS_JSON: JSON.stringify({ campanha: campaign, arquivada: Boolean(archive) }), USUARIO: 'painel.supervisora', DATA_HORA: now });
    SpreadsheetApp.flush();
    return { campaign: campaignPayload_(campaign), archive: archive, campaigns: listCampaigns_(), bootstrap: bootstrap_(), adminData: adminData_() };
  } catch (error) {
    names.forEach(function (name) { restoreSheet_(name, backups[name]); });
    appendObject_('AUDITORIA', { ID: Utilities.getUuid(), ACAO: 'ERRO_INICIAR_CAMPANHA', ENTIDADE: 'GINCANA', ENTIDADE_ID: '', ANTES_JSON: '{}', DEPOIS_JSON: JSON.stringify({ mensagem: error && error.message ? error.message : String(error) }), USUARIO: 'painel.supervisora', DATA_HORA: new Date() });
    throw new Error('CAMPAIGN_START_FAILED: A campanha anterior foi mantida. ' + (error && error.message ? error.message : error));
  } finally { lock.releaseLock(); }
}

function validateCampaignInput_(input) {
  var name = text_(input && input.name);
  var month = text_(input && input.month);
  var year = Number(input && input.year);
  if (name.length < 2 || name.length > 120) throw new Error('INVALID_CAMPAIGN: Informe um nome de campanha entre 2 e 120 caracteres.');
  if (!/^([0][1-9]|1[0-2])$/.test(month) || !Number.isInteger(year) || year < 2020 || year > 2100) throw new Error('INVALID_CAMPAIGN_PERIOD: Mês ou ano da campanha inválido.');
  var startDate = new Date(year, Number(month) - 1, 1, 12, 0, 0);
  var endDate = new Date(year, Number(month), 0, 12, 0, 0);
  return { name: name, month: month, year: year, archiveCurrent: input && input.archiveCurrent !== false, startDate: startDate, endDate: endDate };
}

function legacyCampaignObject_(id, values, launches, now) {
  var dates = launches.map(function (launch) { return launch.DATA_OCORRENCIA instanceof Date ? launch.DATA_OCORRENCIA : new Date(launch.DATA_OCORRENCIA); }).filter(function (date) { return !isNaN(date.getTime()); });
  var start = dates.length ? new Date(Math.min.apply(null, dates)) : new Date(values.year, Number(values.month) - 2, 1, 12, 0, 0);
  var end = dates.length ? new Date(Math.max.apply(null, dates)) : new Date(values.year, Number(values.month) - 1, 0, 12, 0, 0);
  return { ID: id, NOME: previousCampaignName_(values.month, values.year), SLUG: slugify_(previousCampaignName_(values.month, values.year)), DATA_INICIO: start, DATA_FIM: end, STATUS: 'ARQUIVADA', VERSAO_PUBLICADA: 0, CRIADO_EM: now, ATUALIZADO_EM: now };
}

function previousCampaignName_(month, year) {
  var date = new Date(Number(year), Number(month) - 2, 1);
  return 'Campanha ' + date.toLocaleDateString('pt-BR', { month: 'long' }) + ' ' + date.getFullYear();
}

function slugify_(value) {
  return text_(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function rankingForLaunches_(launches, participantFilter, productFilter) {
  var participants = rows_('PARTICIPANTES');
  var products = rows_('PRODUTOS');
  var participantById = indexBy_(participants, 'ID');
  var activeProducts = products.reduce(function (result, row) { if (isActive_(row.ATIVO) && (!productFilter || productFilter[text_(row.ID)])) result[text_(row.ID)] = true; return result; }, {});
  var totals = launches.filter(function (launch) {
    return text_(launch.STATUS).toUpperCase() === 'ATIVO'
      && activeProducts[text_(launch.PRODUTO_ID)]
      && isActiveParticipantId_(participantById, launch.PARTICIPANTE_ID)
      && (!participantFilter || participantFilter[text_(launch.PARTICIPANTE_ID)]);
  }).reduce(function (result, launch) {
    var id = text_(launch.PARTICIPANTE_ID); result[id] = (result[id] || 0) + number_(launch.INSCRICOES_DELTA); return result;
  }, {});
  return participants.map(function (participant) { return { id: text_(participant.ID), name: text_(participant.NOME), team: text_(participant.EQUIPE_ID), initials: initials_(participant.NOME), registrations: totals[text_(participant.ID)] || 0 }; }).filter(function (row) { return row.registrations > 0; }).sort(function (a, b) { return b.registrations - a.registrations || a.name.localeCompare(b.name); });
}

function rankingForGame_(gameId) {
  var launches = rows_('LANCAMENTOS').filter(function (launch) { return text_(launch.GINCANA_ID) === text_(gameId); });
  var campaign = currentCampaign_();
  var participantFilter = campaign && text_(campaign.ID) === text_(gameId) ? activeCampaignParticipantIds_() : null;
  var productFilter = campaign && text_(campaign.ID) === text_(gameId) ? activeCampaignProductIds_() : null;
  return rankingForLaunches_(launches, participantFilter, productFilter);
}

function isActiveParticipantId_(participantById, id) {
  var participant = participantById[text_(id)];
  return participant && isActive_(participant.ATIVO);
}

function publishedRanking_(campaignId) {
  return rows_('PLACAR_PUBLICADO').filter(function (row) { return text_(row.GINCANA_ID) === text_(campaignId); }).sort(function (a, b) { return number_(a.POSICAO) - number_(b.POSICAO); }).map(function (row) {
    return { id: text_(row.PARTICIPANTE_ID), name: text_(row.NOME), team: text_(row.EQUIPE), registrations: number_(row.INSCRICOES) };
  });
}
