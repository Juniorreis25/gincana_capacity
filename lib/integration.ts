export type IntegrationMode = 'demo' | 'loading' | 'live' | 'error';

export type LiveParticipant = {
  id?: string;
  name: string;
  team: string;
  initials?: string;
  registrations: number;
  progress?: number;
};

export type PublishedSnapshot = {
  version: number;
  total: number;
  publishedAt: string;
  ranking: LiveParticipant[];
};

export type LiveHistoryRow = {
  id: string;
  date: string;
  participantId: string;
  participant: string;
  productId: string;
  product: string;
  quantity: number;
  status: string;
  type: string;
  publishedVersion: string;
  createdBy: string;
  pendingPublication: boolean;
};

export type LiveCancellation = {
  id: string;
  launchId: string;
  participant: string;
  product: string;
  quantity: number;
  reason: string;
  status: string;
  requestedBy: string;
  requestedAt: string;
  analyzedBy?: string;
  analyzedAt?: string;
  analysisJustification?: string;
  reversalId?: string;
};

export type PreviewChange = {
  id: string;
  name: string;
  team: string;
  initials: string;
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

export type BootstrapData = {
  activeGame: { id?: string; name: string; status?: string } | null;
  participants: LiveParticipant[];
  teams: Array<{ id?: string; name: string }>;
  products: Array<{ id?: string; name: string; points?: number }>;
  pendingCount: number;
  unpublishedTotal: number;
  pendingParticipants: Record<string, boolean>;
  history: LiveHistoryRow[];
  cancellations: LiveCancellation[];
  published: PublishedSnapshot | null;
};

export type IntegrationResponse<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
};

export async function loadBootstrap(signal?: AbortSignal): Promise<BootstrapData | null> {
  const response = await fetch('/api/integration', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'bootstrap' }),
    signal,
    cache: 'no-store',
  });

  if (!response.ok) return null;
  const payload = (await response.json()) as IntegrationResponse<BootstrapData>;
  return payload.ok && payload.data ? payload.data : null;
}

export async function createLaunch(input: {
  participantId: string;
  productId: string;
  quantity: number;
  client?: string;
  notes?: string;
}): Promise<BootstrapData> {
  const response = await fetch('/api/integration', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'createLaunch', ...input }),
    cache: 'no-store',
  });
  const payload = (await response.json()) as IntegrationResponse<BootstrapData>;
  if (!response.ok || !payload.ok || !payload.data) {
    throw new Error(payload.error?.message || 'Não foi possível persistir a inscrição.');
  }
  return payload.data;
}

async function postAction<T>(body: Record<string, unknown>, fallbackMessage: string): Promise<T> {
  const response = await fetch('/api/integration', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store',
  });
  const payload = (await response.json()) as IntegrationResponse<T>;
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error?.message || fallbackMessage);
  return payload.data;
}

export function loadPreview(): Promise<PreviewData> {
  return postAction<PreviewData>({ action: 'preview' }, 'Não foi possível gerar a prévia.');
}

export function publishScoreboard(): Promise<{ version: number; bootstrap: BootstrapData }> {
  return postAction<{ version: number; bootstrap: BootstrapData }>({ action: 'publish' }, 'Não foi possível publicar o placar anterior foi mantido.');
}

export function requestCancellation(input: { launchId: string; reason: string }): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'requestCancellation', ...input }, 'Não foi possível solicitar o cancelamento.');
}

export function approveCancellation(cancellationId: string): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'approveCancellation', cancellationId }, 'Não foi possível aprovar o cancelamento.');
}

export function rejectCancellation(cancellationId: string, justification: string): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'rejectCancellation', cancellationId, justification }, 'Não foi possível rejeitar o cancelamento.');
}
