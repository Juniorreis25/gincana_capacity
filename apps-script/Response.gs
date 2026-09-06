function ok_(data) {
  return { ok: true, data: data };
}

function fail_(code, message, details) {
  return { ok: false, error: { code: code, message: message, details: details || null } };
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
