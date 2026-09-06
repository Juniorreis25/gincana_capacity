function sheet_(name) {
  var spreadsheet = SpreadsheetApp.openById(APP_CONFIG.spreadsheetId);
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error('Aba não encontrada: ' + name);
  return sheet;
}

function rows_(name) {
  var values = sheet_(name).getDataRange().getValues();
  if (!values.length) return [];
  var headers = values.shift().map(function (header) { return String(header).trim(); });
  return values.filter(function (row) {
    return row.some(function (cell) { return cell !== '' && cell !== null; });
  }).map(function (row) {
    return headers.reduce(function (result, header, index) {
      result[header] = row[index];
      return result;
    }, {});
  });
}

function text_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function number_(value) {
  var parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateText_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, APP_CONFIG.timeZone, "yyyy-MM-dd'T'HH:mm:ssXXX");
  }
  return text_(value);
}
