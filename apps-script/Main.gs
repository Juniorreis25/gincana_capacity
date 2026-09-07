function doGet(e) {
  var action = e && e.parameter && e.parameter.action ? e.parameter.action : 'publishedScoreboard';
  if (action !== 'publishedScoreboard') return json_(fail_('ACTION_NOT_ALLOWED', 'Use POST para operações administrativas.'));
  try {
    return json_(ok_(bootstrap_().published));
  } catch (error) {
    return json_(fail_('READ_FAILED', error.message));
  }
}

function doPost(e) {
  var body = {};
  try { body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {}; } catch (error) { return json_(fail_('INVALID_JSON', 'Corpo da requisição inválido.')); }
  var action = text_(body.action);
  if (!APP_CONFIG.allowedActions.includes(action)) return json_(fail_('ACTION_NOT_ALLOWED', 'Operação não disponível.'));
  if (!isAuthorized_(body.token, action)) return json_(fail_('UNAUTHORIZED', 'Token de integração inválido.'));
  try {
    if (action === 'bootstrap') return json_(ok_(bootstrap_()));
    if (action === 'createLaunch') return json_(ok_(createLaunch_(body)));
    if (action === 'preview') return json_(ok_(preview_()));
    if (action === 'publish') return json_(ok_(publish_()));
    if (action === 'requestCancellation') return json_(ok_(requestCancellation_(body)));
    if (action === 'approveCancellation') return json_(ok_(approveCancellation_(body)));
    if (action === 'rejectCancellation') return json_(ok_(rejectCancellation_(body)));
    if (action === 'adminData') return json_(ok_(adminData_()));
    if (action === 'createTeam' || action === 'updateTeam' || action === 'deleteTeam' || action === 'deactivateTeam') return json_(ok_(adminMutate_('team', action, body)));
    if (action === 'createParticipant' || action === 'updateParticipant' || action === 'deleteParticipant' || action === 'deactivateParticipant') return json_(ok_(adminMutate_('participant', action, body)));
    if (action === 'createProduct' || action === 'updateProduct' || action === 'deleteProduct' || action === 'deactivateProduct') return json_(ok_(adminMutate_('product', action, body)));
    if (action === 'createGame' || action === 'updateGame' || action === 'deleteGame' || action === 'activateGame' || action === 'deactivateGame') return json_(ok_(adminMutate_('game', action, body)));
    if (action === 'setGameAssociations') return json_(ok_(setGameAssociations_(body)));
    return json_(ok_(bootstrap_().published));
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    var parts = message.split(':');
    return json_(fail_(parts.length > 1 ? parts[0] : 'REQUEST_FAILED', parts.slice(1).join(':').trim() || message));
  }
}
