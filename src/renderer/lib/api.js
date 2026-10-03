// Cliente da interface. No desktop fala com o Electron (window.appcbo);
// no navegador (Vercel) chama a API /api. As telas não precisam saber qual.
const desktop = typeof window !== 'undefined' && !!window.appcbo;

async function postar(url, corpo) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(corpo),
  });
  return r;
}

export async function api(canal, ...args) {
  let r;
  if (desktop) {
    r = await window.appcbo.invoke(canal, args);
  } else {
    const resp = await postar('/api/rpc', { canal, args });
    r = await resp.json().catch(() => ({ ok: false, erro: 'Sem resposta do servidor.' }));
  }
  if (!r.ok) throw new Error(r.erro);
  return r.data;
}

// Gera PDF/XLSX. Desktop: janela "Salvar como". Navegador/celular: download.
export async function salvarArquivo(tipo, ...args) {
  if (desktop) {
    const r = await window.appcbo.salvarArquivo(tipo, args);
    if (!r.ok) throw new Error(r.erro);
    return r.data;
  }
  const resp = await postar('/api/arquivo', { tipo, args });
  if (!resp.ok) {
    const r = await resp.json().catch(() => ({}));
    throw new Error(r.erro || 'Não foi possível gerar o arquivo.');
  }
  const nome = /filename="([^"]+)"/.exec(resp.headers.get('Content-Disposition') || '')?.[1] || 'arquivo';
  const url = URL.createObjectURL(await resp.blob());
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return nome;
}

export const logout = () => (desktop ? window.appcbo.logout() : api('auth.logout'));
