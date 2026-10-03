// Pequenos componentes de interface reaproveitados pelas telas.
const CORES = {
  ATIVO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  ATIVA: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  PAGO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  INATIVO: 'bg-grafite-200 text-grafite-700 dark:bg-grafite-700 dark:text-grafite-300',
  CANCELADO: 'bg-grafite-200 text-grafite-700 dark:bg-grafite-700 dark:text-grafite-300',
  CANCELADA: 'bg-grafite-200 text-grafite-700 dark:bg-grafite-700 dark:text-grafite-300',
  CONCLUIDA: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  PENDENTE: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  ATRASADO: 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300',
};
const TEXTOS = {
  ATIVO: 'Ativo', INATIVO: 'Inativo', ATIVA: 'Ativa', CANCELADA: 'Cancelada', CONCLUIDA: 'Concluída',
  PAGO: 'Pago', PENDENTE: 'Pendente', ATRASADO: 'Atrasado', CANCELADO: 'Cancelado',
};

export function Badge({ status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${CORES[status] || CORES.INATIVO}`}>
      {TEXTOS[status] || status}
    </span>
  );
}

export function PageHeader({ titulo, subtitulo, children }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-grafite-900 dark:text-white">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-sm text-grafite-500 dark:text-grafite-400">{subtitulo}</p>}
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function Campo({ label, erro, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {erro && <span className="mt-1 block text-xs text-red-600">{erro}</span>}
    </label>
  );
}

export function Vazio({ texto }) {
  return <div className="p-10 text-center text-sm text-grafite-500 dark:text-grafite-400">{texto}</div>;
}

// Tabela no desktop; vira lista de cartões em telas pequenas.
export function Tabela({ colunas, linhas, chave = 'id', vazio = 'Nenhum registro encontrado.', acoes, selecao }) {
  if (!linhas.length) return <div className="card"><Vazio texto={vazio} /></div>;
  return (
    <div className="card overflow-hidden">
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-grafite-200 dark:divide-grafite-800">
          <thead className="bg-grafite-50 dark:bg-grafite-800/50">
            <tr>
              {selecao && <th className="th w-10"><input type="checkbox" checked={selecao.todos} onChange={selecao.alternarTodos} className="accent-obra-500" /></th>}
              {colunas.map((c) => <th key={c.titulo} className={`th ${c.alinhar === 'direita' ? 'text-right' : ''}`}>{c.titulo}</th>)}
              {acoes && <th className="th text-right">Ações</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-grafite-100 dark:divide-grafite-800">
            {linhas.map((l) => (
              <tr key={l[chave]} className="hover:bg-grafite-50 dark:hover:bg-grafite-800/40">
                {selecao && <td className="td"><input type="checkbox" checked={selecao.marcados.has(l[chave])} onChange={() => selecao.alternar(l[chave])} className="accent-obra-500" /></td>}
                {colunas.map((c) => <td key={c.titulo} className={`td ${c.alinhar === 'direita' ? 'text-right tabular-nums' : ''}`}>{c.render ? c.render(l) : l[c.campo]}</td>)}
                {acoes && <td className="td"><div className="flex justify-end gap-1">{acoes(l)}</div></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-grafite-100 dark:divide-grafite-800 md:hidden">
        {linhas.map((l) => (
          <li key={l[chave]} className="flex gap-3 p-4">
            {selecao && <input type="checkbox" checked={selecao.marcados.has(l[chave])} onChange={() => selecao.alternar(l[chave])} className="mt-1 accent-obra-500" />}
            <div className="min-w-0 flex-1 space-y-1">
              {colunas.map((c, i) => (
                <div key={c.titulo} className={i === 0 ? 'font-semibold text-grafite-900 dark:text-white' : 'text-sm text-grafite-600 dark:text-grafite-300'}>
                  {i > 0 && <span className="text-grafite-400">{c.titulo}: </span>}
                  {c.render ? c.render(l) : l[c.campo]}
                </div>
              ))}
              {acoes && <div className="flex gap-1 pt-1">{acoes(l)}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
