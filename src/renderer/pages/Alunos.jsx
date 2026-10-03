import { useEffect, useState } from 'react';
import { FileText, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { data, hoje, mascaraCpf, mascaraTelefone, moeda } from '../lib/format';
import { Badge, Campo, PageHeader, Tabela } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';

const VAZIO = { nome: '', cpf: '', telefone: '', email: '', endereco: '' };
const MATRICULA_VAZIA = { curso_id: '', forma_pagamento_id: '', num_parcelas: 1, primeiro_vencimento: hoje() };

// Campos de matrícula (curso + forma de pagamento + parcelas), usados no
// cadastro do aluno e na ficha, para matricular em um novo curso.
function CamposMatricula({ valor, onChange, cursos, formas }) {
  const forma = formas.find((f) => String(f.id) === String(valor.forma_pagamento_id));
  const curso = cursos.find((c) => String(c.id) === String(valor.curso_id));
  const set = (k) => (e) => onChange({ ...valor, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo label="Curso matriculado" className="sm:col-span-2">
        <select className="input" value={valor.curso_id} onChange={set('curso_id')}>
          <option value="">Sem matrícula por enquanto</option>
          {cursos.map((c) => <option key={c.id} value={c.id}>{c.nome} · {moeda(c.valor)}</option>)}
        </select>
      </Campo>
      {valor.curso_id && (
        <>
          <Campo label="Forma de pagamento">
            <select className="input" value={valor.forma_pagamento_id} onChange={(e) => onChange({ ...valor, forma_pagamento_id: e.target.value, num_parcelas: 1 })} required>
              <option value="">Selecione…</option>
              {formas.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Parcelas">
            <select className="input" value={valor.num_parcelas} onChange={set('num_parcelas')} disabled={!forma}>
              {Array.from({ length: forma?.max_parcelas || 1 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}x {curso ? `de ${moeda(curso.valor / n)}` : ''}</option>
              ))}
            </select>
          </Campo>
          <Campo label="1º vencimento">
            <input className="input" type="date" value={valor.primeiro_vencimento} onChange={set('primeiro_vencimento')} required />
          </Campo>
        </>
      )}
    </div>
  );
}

function Ficha({ alunoId, cursos, formas, onFechar, onAlterou }) {
  const toast = useToast();
  const [ficha, setFicha] = useState(null);
  const [novaMatricula, setNovaMatricula] = useState(null);

  const carregar = () => api('alunos.ficha', alunoId).then(setFicha).catch((e) => toast.erro(e.message));
  useEffect(() => { carregar(); }, [alunoId]);

  const pagar = async (c) => {
    try {
      await api('cobrancas.marcarComoPaga', c.id, {});
      toast.sucesso(`Parcela ${c.numero_parcela} marcada como paga.`);
      carregar(); onAlterou();
    } catch (e) { toast.erro(e.message); }
  };

  const matricular = async () => {
    try {
      await api('alunos.matricular', alunoId, novaMatricula);
      toast.sucesso('Matrícula realizada.');
      setNovaMatricula(null); carregar(); onAlterou();
    } catch (e) { toast.erro(e.message); }
  };

  if (!ficha) return null;
  const { aluno } = ficha;
  return (
    <Modal aberto titulo={aluno.nome} onFechar={onFechar} largura="max-w-4xl">
      <div className="grid gap-2 text-sm text-grafite-600 dark:text-grafite-300 sm:grid-cols-3">
        <div><span className="text-grafite-400">CPF:</span> {mascaraCpf(aluno.cpf)}</div>
        <div><span className="text-grafite-400">Telefone:</span> {mascaraTelefone(aluno.telefone) || '—'}</div>
        <div><span className="text-grafite-400">E-mail:</span> {aluno.email || '—'}</div>
        <div className="sm:col-span-3"><span className="text-grafite-400">Endereço:</span> {aluno.endereco || '—'}</div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h3 className="font-semibold dark:text-white">Matrículas</h3>
        {!novaMatricula && <button className="btn-secondary !py-1.5" onClick={() => setNovaMatricula(MATRICULA_VAZIA)}><Plus size={14} /> Matricular em curso</button>}
      </div>
      {novaMatricula && (
        <div className="mt-2 rounded-lg border border-obra-500/40 p-4">
          <CamposMatricula valor={novaMatricula} onChange={setNovaMatricula} cursos={cursos} formas={formas} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setNovaMatricula(null)}>Cancelar</button>
            <button className="btn-primary" onClick={matricular} disabled={!novaMatricula.curso_id}>Confirmar matrícula</button>
          </div>
        </div>
      )}
      <ul className="mt-2 space-y-1 text-sm">
        {ficha.matriculas.length === 0 && <li className="text-grafite-500">Nenhuma matrícula.</li>}
        {ficha.matriculas.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-2 dark:text-grafite-200">
            <Badge status={m.status} /> <strong>{m.curso_nome}</strong>
            <span className="text-grafite-500">· {data(m.data_matricula)} · {m.num_parcelas}x no {m.forma_nome} · {moeda(m.valor_total)}</span>
          </li>
        ))}
      </ul>

      <h3 className="mt-6 font-semibold dark:text-white">
        Parcelas em aberto <span className="font-normal text-grafite-500">· total atualizado {moeda(ficha.totalEmAberto)}</span>
      </h3>
      <div className="mt-2">
        <Tabela
          linhas={ficha.emAberto}
          vazio="Nenhuma parcela em aberto."
          colunas={[
            { titulo: 'Parcela', render: (c) => `${c.numero_parcela}ª · ${c.curso_nome}` },
            { titulo: 'Vencimento', render: (c) => data(c.vencimento) },
            { titulo: 'Valor atualizado', render: (c) => moeda(c.valor_atualizado), alinhar: 'direita' },
            { titulo: 'Situação', render: (c) => <Badge status={c.situacao} /> },
          ]}
          acoes={(c) => <button className="btn-secondary !px-3 !py-1 text-xs" onClick={() => pagar(c)}>Marcar paga</button>}
        />
      </div>

      <h3 className="mt-6 font-semibold dark:text-white">Histórico de pagamentos</h3>
      <div className="mt-2">
        <Tabela
          linhas={ficha.pagamentos}
          vazio="Nenhum pagamento registrado."
          colunas={[
            { titulo: 'Parcela', render: (c) => `${c.numero_parcela}ª · ${c.curso_nome}` },
            { titulo: 'Vencimento', render: (c) => data(c.vencimento) },
            { titulo: 'Pago em', render: (c) => data(c.data_pagamento) },
            { titulo: 'Valor pago', render: (c) => moeda(c.valor_pago), alinhar: 'direita' },
          ]}
        />
      </div>
    </Modal>
  );
}

export default function Alunos() {
  const toast = useToast();
  const [alunos, setAlunos] = useState([]);
  const [cursos, setCursos] = useState([]);
  const [formas, setFormas] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null);
  const [fichaId, setFichaId] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = () => api('alunos.listar', { busca }).then(setAlunos).catch((e) => toast.erro(e.message));
  useEffect(() => { carregar(); }, [busca]);
  useEffect(() => {
    api('cursos.listar', { status: 'ATIVO' }).then(setCursos);
    api('formasPagamento.listar', { status: 'ATIVO' }).then(setFormas);
  }, []);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (form.id) await api('alunos.atualizar', form.id, form);
      else await api('alunos.criar', form);
      toast.sucesso('Aluno salvo.');
      setForm(null);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  };

  const confirmarExclusao = async () => {
    try {
      await api('alunos.excluir', excluir.id);
      toast.sucesso('Aluno excluído.');
      carregar();
    } catch (err) {
      toast.erro(err.message);
    }
    setExcluir(null);
  };

  const set = (k, mascara) => (e) => setForm({ ...form, [k]: mascara ? mascara(e.target.value) : e.target.value });

  return (
    <>
      <PageHeader titulo="Alunos" subtitulo="Cadastro, matrícula e situação financeira">
        <button className="btn-primary" onClick={() => { setErro(''); setForm({ ...VAZIO, matricula: MATRICULA_VAZIA }); }}><Plus size={16} /> Novo aluno</button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-400" />
        <input className="input pl-9" placeholder="Buscar por nome ou CPF…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <Tabela
        linhas={alunos}
        vazio="Nenhum aluno cadastrado."
        colunas={[
          { titulo: 'Nome', campo: 'nome' },
          { titulo: 'CPF', render: (a) => mascaraCpf(a.cpf) },
          { titulo: 'Telefone', render: (a) => mascaraTelefone(a.telefone) || '—' },
          { titulo: 'Curso', render: (a) => a.curso_atual || '—' },
          { titulo: 'Financeiro', render: (a) => (a.parcelas_atrasadas > 0 ? <Badge status="ATRASADO" /> : <Badge status="PAGO" />) },
        ]}
        acoes={(a) => (
          <>
            <button className="btn-icon" title="Ficha e financeiro" onClick={() => setFichaId(a.id)}><FileText size={16} /></button>
            <button className="btn-icon" title="Editar" onClick={() => { setErro(''); setForm({ ...a, cpf: mascaraCpf(a.cpf), telefone: mascaraTelefone(a.telefone) }); }}><Pencil size={16} /></button>
            <button className="btn-icon hover:!text-red-600" title="Excluir" onClick={() => setExcluir(a)}><Trash2 size={16} /></button>
          </>
        )}
      />

      <Modal
        aberto={!!form}
        titulo={form?.id ? 'Editar aluno' : 'Novo aluno'}
        onFechar={() => setForm(null)}
        rodape={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" form="form-aluno">Salvar</button></>}
      >
        {form && (
          <form id="form-aluno" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome completo" className="sm:col-span-2">
              <input className="input" value={form.nome} onChange={set('nome')} required />
            </Campo>
            <Campo label="CPF"><input className="input" value={form.cpf} onChange={set('cpf', mascaraCpf)} placeholder="000.000.000-00" required /></Campo>
            <Campo label="Telefone"><input className="input" value={form.telefone} onChange={set('telefone', mascaraTelefone)} placeholder="(00) 00000-0000" /></Campo>
            <Campo label="E-mail" className="sm:col-span-2"><input className="input" type="email" value={form.email} onChange={set('email')} /></Campo>
            <Campo label="Endereço" className="sm:col-span-2"><input className="input" value={form.endereco} onChange={set('endereco')} /></Campo>
            {!form.id && (
              <div className="border-t border-grafite-200 pt-4 dark:border-grafite-800 sm:col-span-2">
                <CamposMatricula valor={form.matricula} onChange={(m) => setForm({ ...form, matricula: m })} cursos={cursos} formas={formas} />
              </div>
            )}
            {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
          </form>
        )}
      </Modal>

      {fichaId && <Ficha alunoId={fichaId} cursos={cursos} formas={formas} onFechar={() => setFichaId(null)} onAlterou={carregar} />}

      <ConfirmDialog
        aberto={!!excluir}
        mensagem={`Tem certeza que deseja excluir o aluno "${excluir?.nome}"? As matrículas e parcelas em aberto também serão apagadas.`}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluir(null)}
      />
    </>
  );
}
