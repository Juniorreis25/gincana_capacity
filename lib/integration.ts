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

export type BootstrapData = {
  participants: RankingRow[];
  products: Array<{ id: string; name: string }>;
  history: EnrollmentRow[];
};

export type AdminData = {
  participants: Array<{ id: string; name: string; avatarUrl?: string; active: boolean; historyCount: number }>;
  products: Array<{ id: string; name: string; category?: string; active: boolean; historyCount: number }>;
};

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
    throw new Error(payload.error?.message || fallbackMessage);
  }
  return payload.data;
}

export function loadBootstrap(signal?: AbortSignal): Promise<BootstrapData> {
  return postAction<BootstrapData>({ action: 'bootstrap' }, 'Não foi possível carregar os dados da planilha.', signal);
}

export function loadAdminData(signal?: AbortSignal): Promise<AdminData> {
  return postAction<AdminData>({ action: 'adminData' }, 'Não foi possível carregar os cadastros.', signal);
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
