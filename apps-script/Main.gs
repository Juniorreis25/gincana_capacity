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
    return json_(ok_(bootstrap_().published));
  } catch (error) {
    var message = error && error.message ? error.message : String(error);
    var parts = message.split(':');
    return json_(fail_(parts.length > 1 ? parts[0] : 'REQUEST_FAILED', parts.slice(1).join(':').trim() || message));
  }
}
