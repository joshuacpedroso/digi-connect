export class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

export async function api(action, data = {}) {
  let res;
  try {
    res = await fetch('/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ action, ...data }),
    });
  } catch {
    throw new ApiError('Sem conexão com o servidor.', 0);
  }
  let json = {};
  try { json = await res.json(); } catch { /* resposta vazia */ }
  if (!res.ok || !json.ok) throw new ApiError(json.error || `Erro ${res.status}`, res.status);
  return json;
}

export function beacon(action, data = {}) {
  try { navigator.sendBeacon('/api', new Blob([JSON.stringify({ action, ...data })], { type: 'text/plain' })); } catch { /* */ }
}
