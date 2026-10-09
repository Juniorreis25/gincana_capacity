import assert from 'node:assert/strict';
import { deleteEmploymentNotesForParticipant } from '../lib/integration.ts';

const participantId = 'selected';
const emptyBootstrap = { participants: [], products: [], history: [], employmentNotes: [], totalNotes: 0 };

for (const firstResponse of [
  { ok: true, data: { participantId, deletedCount: 1 } },
  { ok: false, error: { code: 'INVALID_UPSTREAM_RESPONSE', message: 'Resposta inválida' } },
  { ok: false, error: { code: 'RECORD_NOT_FOUND', message: 'Já excluída' } },
]) {
  const actions = [];
  globalThis.fetch = async (_url, options) => {
    const { action } = JSON.parse(options.body);
    actions.push(action);
    return Response.json(action === 'bootstrap' ? { ok: true, data: emptyBootstrap } : firstResponse, {
      status: action === 'bootstrap' || firstResponse.ok ? 200 : 502,
    });
  };
  const result = await deleteEmploymentNotesForParticipant(participantId);
  assert.equal(result.totalNotes, 0);
  assert.deepEqual(actions, ['deleteEmploymentNotesForParticipant', 'bootstrap']);
}

globalThis.fetch = async (_url, options) => Response.json(
  JSON.parse(options.body).action === 'bootstrap'
    ? { ok: true, data: { ...emptyBootstrap, employmentNotes: [{ id: 'note', participantId, quantity: 1 }] } }
    : { ok: true, data: { participantId, deletedCount: 1 } },
);
await assert.rejects(deleteEmploymentNotesForParticipant(participantId), /não foi confirmada/);
console.log('Delete confirmation and ambiguous-response reconciliation: OK');
