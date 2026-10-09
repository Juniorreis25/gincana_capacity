export type ConnectionMode = 'loading' | 'live' | 'error';

export type RankingRow = {
  id: string;
  name: string;
  avatarUrl?: string;
  registrations: number;
  noteCount?: number;
};

export type EmploymentNoteRow = {
  id: string;
  participantId: string;
  participant: string;
  productId: string;
  product: string;
  date: string;
  quantity: number;
  publishedVersion?: string;
  pendingPublication?: boolean;
};

export type EnrollmentRow = {
  id: string;
  participantId: string;
  participant: string;
  participantAvatarUrl?: string;
  productId: string;
  product: string;
  quantity: number;
  date: string;
  notes?: string;
  status: string;
  createdBy?: string;
  publishedVersion?: string;
  pendingPublication?: boolean;
};

export type PreviewChange = {
  id: string;
  name: string;
  team?: string;
  initials?: string;
  previousPosition: number | null;
  newPosition: number | null;
  previousRegistrations: number;
  newRegistrations: number;
  movement: 'subida' | 'descida' | 'manutencao' | 'nova';
  positionDelta: number | null;
};

export type PreviewData = {
  game: { id: string; name: string };
  currentTotal: number;
  publishedTotal: number;
  pendingCount: number;
  publishedVersion: number;
  newLeader: string;
  leaderChanged: boolean;
  changes: PreviewChange[];
};

export type CampaignSummary = {
  id: string;
  name: string;
  slug?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  publishedVersion?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type BootstrapData = {
  campaign?: CampaignSummary | null;
  participants: RankingRow[];
  products: Array<{ id: string; name: string }>;
  history: EnrollmentRow[];
  employmentNotes?: EmploymentNoteRow[];
  totalNotes?: number;
};

export type ScoreboardData = {
  campaign?: CampaignSummary | null;
  ranking: RankingRow[];
  version: number;
  publishedAt?: string;
  published: boolean;
  totalNotes?: number;
};

export type ArchivedCampaign = {
  id: string;
  name: string;
  startDate?: string;
  endDate?: string;
  status: string;
  archivedAt?: string;
  participantCount: number;
  totalRegistrations: number;
};

export type AdminData = {
  participants: Array<{ id: string; name: string; avatarUrl?: string; active: boolean; historyCount: number }>;
  products: Array<{ id: string; name: string; category?: string; active: boolean; historyCount: number }>;
};

export type CampaignAssociationOption = { id: string; name: string; active: boolean; associated: boolean };
export type CampaignAssociations = { campaign: CampaignSummary; participants: CampaignAssociationOption[]; products: CampaignAssociationOption[] };

type IntegrationResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

async function postAction<T>(body: Record<string, unknown>, fallbackMessage: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch('/api/integration', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal,
  });
  const payload = (await response.json()) as IntegrationResponse<T>;
  if (!response.ok || !payload.ok || payload.data === undefined) {
    const error = new Error(payload.error?.message || fallbackMessage) as Error & { code?: string };
    error.code = payload.error?.code;
    throw error;
  }
  return payload.data;
}

export function loadBootstrap(signal?: AbortSignal): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'bootstrap' }, 'Não foi possível carregar os dados da planilha.', signal);
}

export function loadScoreboard(signal?: AbortSignal): Promise<ScoreboardData> {
  return postAction<ScoreboardData>({ action: 'scoreboard' }, 'Não foi possível carregar o placar publicado.', signal);
}

export function loadPreview(): Promise<PreviewData> {
  return postAction<PreviewData>({ action: 'preview' }, 'Não foi possível gerar a prévia do placar.');
}

export function publishScoreboard(): Promise<{ version: number; bootstrap: BootstrapData }> {
  return postAction<{ version: number; bootstrap: BootstrapData }>({ action: 'publish' }, 'Não foi possível publicar o placar. A versão anterior foi mantida.');
}

export function loadAdminData(signal?: AbortSignal): Promise<AdminData> {
  return postAction<AdminData>({ action: 'adminData' }, 'Não foi possível carregar os cadastros.', signal);
}

export function listCampaigns(signal?: AbortSignal): Promise<ArchivedCampaign[]> {
  return postAction<ArchivedCampaign[]>({ action: 'listCampaigns' }, 'Não foi possível carregar o arquivo de campanhas.', signal);
}

export function getCampaign(id: string, signal?: AbortSignal): Promise<{ campaign: CampaignSummary; ranking: RankingRow[] }> {
  return postAction<{ campaign: CampaignSummary; ranking: RankingRow[] }>({ action: 'getCampaign', id }, 'Não foi possível carregar a campanha arquivada.', signal);
}

export function getCampaignAssociations(signal?: AbortSignal): Promise<CampaignAssociations> {
  return postAction<CampaignAssociations>({ action: 'getCampaignAssociations' }, 'Não foi possível carregar as associações da campanha.', signal);
}

export function updateCampaignAssociations(input: { participantIds: string[]; productIds: string[] }): Promise<CampaignAssociations> {
  return postAction<CampaignAssociations>({ action: 'updateCampaignAssociations', ...input }, 'Não foi possível salvar as associações da campanha.');
}

export function startNewCampaign(input: { name: string; month: string; year: number; archiveCurrent: boolean }): Promise<{ campaign: CampaignSummary; archive: { campaign: CampaignSummary; ranking: RankingRow[] } | null; campaigns: ArchivedCampaign[]; bootstrap: BootstrapData; adminData: AdminData }> {
  return postAction<{ campaign: CampaignSummary; archive: { campaign: CampaignSummary; ranking: RankingRow[] } | null; campaigns: ArchivedCampaign[]; bootstrap: BootstrapData; adminData: AdminData }>({ action: 'startNewCampaign', ...input }, 'Não foi possível iniciar a nova campanha.');
}

export function createLaunch(input: { participantId: string; productId: string; quantity: number; date: string; notes?: string }): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'createLaunch', ...input }, 'Não foi possível registrar a inscrição.');
}

export function createEmploymentNote(input: { participantId: string; productId: string; quantity: number; date: string }): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'createEmploymentNote', ...input }, 'Não foi possível registrar a nota de empenho.');
}

export function updateEmploymentNote(input: { id: string; participantId: string; productId: string; quantity: number; date: string }): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'updateEmploymentNote', ...input }, 'Não foi possível editar a nota de empenho.');
}

export function deleteEmploymentNote(id: string): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'deleteEmploymentNote', id }, 'Não foi possível excluir a nota de empenho.');
}

export async function deleteEmploymentNotesForParticipant(participantId: string, noteIds: string[] = []): Promise<BootstrapData> {
  try {
    await postAction<{ participantId: string; deletedCount: number }>({ action: 'deleteEmploymentNotesForParticipant', participantId }, 'Não foi possível excluir as notas de empenho do participante.');
  } catch (error) {
    const code = (error as Error & { code?: string }).code;
    if (code === 'ACTION_NOT_ALLOWED' && noteIds.length) {
      for (const id of noteIds) await deleteEmploymentNote(id);
    } else if (code !== 'INVALID_UPSTREAM_RESPONSE' && code !== 'RECORD_NOT_FOUND') {
      throw error;
    }
  }
  // Confirm against persisted data, including after an ambiguous gateway error.
  const refreshed = await loadBootstrap();
  if ((refreshed.employmentNotes || []).some((note) => note.participantId === participantId && note.quantity > 0)) {
    throw new Error('A exclusão não foi confirmada pela planilha. Tente novamente.');
  }
  return refreshed;
}

export function updateLaunch(input: { id: string; participantId: string; productId: string; quantity: number; date: string; notes?: string }): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'updateLaunch', ...input }, 'Não foi possível editar a inscrição.');
}

export function deleteLaunch(id: string): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'deleteLaunch', id }, 'Não foi possível excluir a inscrição.');
}

export function adminMutation(action: string, input: Record<string, unknown> = {}): Promise<AdminData> {
  return postAction<AdminData>({ action, ...input }, 'Não foi possível concluir a operação.');
}
