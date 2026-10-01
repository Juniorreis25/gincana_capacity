export type ConnectionMode = 'loading' | 'live' | 'error';

export type RankingRow = {
  id: string;
  name: string;
  avatarUrl?: string;
  registrations: number;
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
};

export type ScoreboardData = {
  campaign?: CampaignSummary | null;
  ranking: RankingRow[];
  version: number;
  publishedAt?: string;
  published: boolean;
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

export function updateLaunch(input: { id: string; participantId: string; productId: string; quantity: number; date: string; notes?: string }): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'updateLaunch', ...input }, 'Não foi possível editar a inscrição.');
}

export function deleteLaunch(id: string): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'deleteLaunch', id }, 'Não foi possível excluir a inscrição.');
}

export function adminMutation(action: string, input: Record<string, unknown> = {}): Promise<AdminData> {
  return postAction<AdminData>({ action, ...input }, 'Não foi possível concluir a operação.');
}
