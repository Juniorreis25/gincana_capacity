type RuntimeEnv = {
  APPS_SCRIPT_URL?: string;
  APPS_SCRIPT_SHARED_SECRET?: string;
};

type BootstrapPayload = {
  participants: Array<{ id: string; name: string; avatarUrl?: string; registrations: number }>;
  history: Array<{ participantId: string; productId: string; quantity: number; status: string }>;
  products: Array<{ id: string; name: string }>;
};

type AdminPayload = {
  participants: Array<{ id: string; active: boolean }>;
  products: Array<{ id: string; active: boolean }>;
};

function getRuntimeEnv(): RuntimeEnv {
  // The secret is read only on the server/Worker. It is never bundled into the client.
  const env: Record<string, string | undefined> = typeof process !== 'undefined' && process.env
    ? process.env as Record<string, string | undefined>
    : {};
  return {
    APPS_SCRIPT_URL: env.APPS_SCRIPT_URL,
    APPS_SCRIPT_SHARED_SECRET: env.APPS_SCRIPT_SHARED_SECRET,
  };
}

export async function POST(request: Request) {
  const { APPS_SCRIPT_URL, APPS_SCRIPT_SHARED_SECRET } = getRuntimeEnv();

  if (!APPS_SCRIPT_URL) {
    return Response.json({
      ok: false,
      error: {
        code: 'INTEGRATION_NOT_CONFIGURED',
        message: 'A URL do Apps Script ainda não foi configurada no ambiente do painel.',
      },
    }, { status: 503 });
  }

  if (!APPS_SCRIPT_SHARED_SECRET) {
    return Response.json({
      ok: false,
      error: {
        code: 'INTEGRATION_SECRET_NOT_CONFIGURED',
        message: 'O segredo do Apps Script ainda não foi configurado no ambiente do painel.',
      },
    }, { status: 503 });
  }
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: { code: 'INVALID_JSON', message: 'Corpo da requisição inválido.' } }, { status: 400 });
  }

  const upstream = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, token: APPS_SCRIPT_SHARED_SECRET }),
  });
  const text = await upstream.text();

  try {
    const payload = JSON.parse(text) as { ok?: boolean; data?: BootstrapPayload };
    if (body.action === 'bootstrap' && payload.ok && payload.data) {
      const adminResponse = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'adminData', token: APPS_SCRIPT_SHARED_SECRET }),
      });
      if (adminResponse.ok) {
        const adminPayload = JSON.parse(await adminResponse.text()) as { ok?: boolean; data?: AdminPayload };
        if (adminPayload.ok && adminPayload.data) {
          const activeParticipants = new Set(adminPayload.data.participants.filter((item) => item.active).map((item) => item.id));
          const activeProducts = new Set(adminPayload.data.products.filter((item) => item.active).map((item) => item.id));
          payload.data.products = payload.data.products.filter((item) => activeProducts.has(item.id));
          payload.data.history = payload.data.history.map((item) => activeParticipants.has(item.participantId) && activeProducts.has(item.productId)
            ? item
            : { ...item, status: 'INATIVADO' });
          const totals = new Map<string, number>();
          payload.data.history.forEach((item) => {
            if (item.status !== 'ATIVO' || !activeParticipants.has(item.participantId) || !activeProducts.has(item.productId)) return;
            totals.set(item.participantId, (totals.get(item.participantId) || 0) + (Number(item.quantity) || 0));
          });
          payload.data.participants = payload.data.participants
            .filter((item) => activeParticipants.has(item.id))
            .map((item) => ({ ...item, registrations: totals.get(item.id) || 0 }))
            .filter((item) => item.registrations > 0)
            .sort((a, b) => b.registrations - a.registrations || a.name.localeCompare(b.name));
        }
      }
    }
    return Response.json(payload, { status: upstream.status });
  } catch {
    return Response.json({ ok: false, error: { code: 'INVALID_UPSTREAM_RESPONSE', message: 'O Apps Script retornou uma resposta inválida.' } }, { status: 502 });
  }
}
