function isAuthorized_(token, action) {
  if (action === 'publishedScoreboard') return true;
  var expected = PropertiesService.getScriptProperties().getProperty(APP_CONFIG.sharedSecretProperty);
  return Boolean(expected && token && token === expected);
}
