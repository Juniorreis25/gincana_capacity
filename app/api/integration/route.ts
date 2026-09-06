type RuntimeEnv = {
  APPS_SCRIPT_URL?: string;
  APPS_SCRIPT_SHARED_SECRET?: string;
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
    return Response.json(JSON.parse(text), { status: upstream.status });
  } catch {
    return Response.json({ ok: false, error: { code: 'INVALID_UPSTREAM_RESPONSE', message: 'O Apps Script retornou uma resposta inválida.' } }, { status: 502 });
  }
}
