const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const headers = ['ID', 'GINCANA_ID', 'PARTICIPANTE_ID', 'PRODUTO_ID', 'DATA', 'QUANTIDADE', 'PUBLICADO_NA_VERSAO', 'CRIADO_EM', 'ATUALIZADO_EM', 'STATUS', 'STATUS'];
const values = [
  headers,
  ['legacy', 'campaign', 'other', 'product', '', 1, '', '', '', 'EXCLUIDO', ''],
  ['target', 'campaign', 'selected', 'product', '', 1, '', '', '', 'ATIVO', 'ATIVO'],
  ['unrelated', 'campaign', 'other', 'product', '', 1, '', '', '', 'ATIVO', 'ATIVO'],
];
const sheet = {
  getDataRange() { return { getValues: () => values.map((row) => [...row]) }; },
  getRange(row, column, rowCount) {
    return {
      getValues: () => values.slice(row - 1, row - 1 + rowCount).map((item) => [item[column - 1]]),
      setValues: (input) => input.forEach((item, index) => { values[row - 1 + index][column - 1] = item[0]; }),
    };
  },
};
const context = {
  ensureEmploymentNotesSheet_: () => sheet,
  text_: (value) => value == null ? '' : String(value).trim(),
  SpreadsheetApp: { flush() {} },
};
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../apps-script/EmploymentNoteService.gs'), 'utf8'), context);
context.ensureEmploymentNotesSheet_ = () => sheet;
assert.equal(context.markEmploymentNotesDeleted_(['target'], new Date()), true);
assert.deepEqual(values.slice(1).map((row) => row.slice(9, 11)), [
  ['EXCLUIDO', ''],
  ['ATIVO', 'EXCLUIDO'],
  ['ATIVO', 'ATIVO'],
]);
assert.throws(() => context.markEmploymentNotesDeleted_(['missing'], new Date()), /RECORD_NOT_FOUND/);
values[0][9] = 'STATUS_LEGADO';
values[2][10] = 'ATIVO';
assert.equal(context.markEmploymentNotesDeleted_(['target'], new Date()), true);
assert.equal(values[2][10], 'EXCLUIDO');
console.log('Duplicate STATUS columns: authoritative last column updated and confirmed');
