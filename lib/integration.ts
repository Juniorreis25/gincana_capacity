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

export type BootstrapData = {
  activeGame: { id?: string; name: string; status?: string } | null;
  participants: LiveParticipant[];
  teams: Array<{ id?: string; name: string }>;
  products: Array<{ id?: string; name: string; points?: number }>;
  pendingCount: number;
  unpublishedTotal: number;
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
