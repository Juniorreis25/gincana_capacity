function doGet(e) {
  return json_(fail_('ACTION_NOT_ALLOWED', 'Use o proxy privado do painel para acessar a integração.'));
}

function doPost(e) {
  var body = {};
  try { body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}; } catch (error) { return json_(fail_('INVALID_JSON', 'Corpo da requisição inválido.')); }
  var action = text_(body.action);
  // Mantém a ação de exclusão disponível mesmo em implantações que ainda
  // estejam usando uma cópia anterior de Config.gs durante a atualização.
  if (!APP_CONFIG.allowedActions.includes(action) && action !== 'deleteEmploymentNote') return json_(fail_('ACTION_NOT_ALLOWED', 'Operação não disponível.'));
  if (!isAuthorized_(body.token, action)) return json_(fail_('UNAUTHORIZED', 'Token de integração inválido.'));
  try {
    if (action === 'bootstrap') return json_(ok_(bootstrap_()));
    if (action === 'scoreboard') return json_(ok_(scoreboard_()));
    if (action === 'preview') return json_(ok_(preview_()));
    if (action === 'publish') return json_(ok_(publish_()));
    if (action === 'listCampaigns') return json_(ok_(listCampaigns_()));
    if (action === 'getCampaign') return json_(ok_(getCampaign_(body)));
    if (action === 'getCampaignAssociations') return json_(ok_(campaignAssociations_(body)));
    if (action === 'updateCampaignAssociations') return json_(ok_(updateCampaignAssociations_(body)));
    if (action === 'startNewCampaign') return json_(ok_(startNewCampaign_(body)));
    if (action === 'createLaunch') return json_(ok_(createLaunch_(body)));
    if (action === 'updateLaunch') return json_(ok_(updateLaunch_(body)));
    if (action === 'deleteLaunch') return json_(ok_(deleteLaunch_(body)));
    if (action === 'createEmploymentNote') return json_(ok_(createEmploymentNote_(body)));
    if (action === 'updateEmploymentNote') return json_(ok_(updateEmploymentNote_(body)));
    if (action === 'deleteEmploymentNote') return json_(ok_(deleteEmploymentNote_(body)));
    if (action === 'deleteEmploymentNotesForParticipant') return json_(ok_(deleteEmploymentNotesForParticipant_(body)));
    if (action === 'adminData') return json_(ok_(adminData_()));
    if (action === 'createParticipant' || action === 'updateParticipant' || action === 'deleteParticipant' || action === 'deactivateParticipant' || action === 'activateParticipant') return json_(ok_(adminMutate_('participant', action, body)));
    if (action === 'createProduct' || action === 'updateProduct' || action === 'deleteProduct' || action === 'deactivateProduct' || action === 'activateProduct') return json_(ok_(adminMutate_('product', action, body)));
    return json_(fail_('ACTION_NOT_ALLOWED', 'Operação não disponível.'));
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    var parts = message.split(':');
    return json_(fail_(parts.length > 1 ? parts[0] : 'REQUEST_FAILED', parts.slice(1).join(':').trim() || message));
  }
}
