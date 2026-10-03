import { useEffect, useState } from 'react';
import { Eye, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { moeda } from '../lib/format';
import { Badge, Campo, PageHeader, Tabela } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';

const VAZIO = { nome: '', carga_horaria: '', descricao: '', valor: '', instrutor: '', status: 'ATIVO' };

export default function Cursos() {
  const toast = useToast();
  const [cursos, setCursos] = useState([]);
  const [busca, setBusca] = useState('');
  const [form, setForm] = useState(null); // null = fechado
  const [visualizar, setVisualizar] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = () => api('cursos.listar', { busca }).then(setCursos).catch((e) => toast.erro(e.message));
  useEffect(() => { carregar(); }, [busca]);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (form.id) await api('cursos.atualizar', form.id, form);
      else await api('cursos.criar', form);
      toast.sucesso('Curso salvo.');
      setForm(null);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  };

  const confirmarExclusao = async () => {
    try {
      await api('cursos.excluir', excluir.id);
      toast.sucesso('Curso excluído.');
      carregar();
    } catch (err) {
      toast.erro(err.message);
    }
    setExcluir(null);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader titulo="Cursos" subtitulo="Cadastro dos cursos oferecidos">
        <button className="btn-primary" onClick={() => { setErro(''); setForm(VAZIO); }}><Plus size={16} /> Novo curso</button>
      </PageHeader>

      <div className="relative mb-4 max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-400" />
        <input className="input pl-9" placeholder="Buscar curso…" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <Tabela
        linhas={cursos}
        vazio="Nenhum curso cadastrado."
        colunas={[
          { titulo: 'Curso', campo: 'nome' },
          { titulo: 'Carga horária', render: (c) => `${c.carga_horaria} h` },
          { titulo: 'Instrutor', campo: 'instrutor' },
          { titulo: 'Alunos', campo: 'alunos_ativos' },
          { titulo: 'Valor', render: (c) => moeda(c.valor), alinhar: 'direita' },
          { titulo: 'Status', render: (c) => <Badge status={c.status} /> },
        ]}
        acoes={(c) => (
          <>
            <button className="btn-icon" title="Visualizar" onClick={() => setVisualizar(c)}><Eye size={16} /></button>
            <button className="btn-icon" title="Editar" onClick={() => { setErro(''); setForm(c); }}><Pencil size={16} /></button>
            <button className="btn-icon hover:!text-red-600" title="Excluir" onClick={() => setExcluir(c)}><Trash2 size={16} /></button>
          </>
        )}
      />

      <Modal
        aberto={!!form}
        titulo={form?.id ? 'Editar curso' : 'Novo curso'}
        onFechar={() => setForm(null)}
        rodape={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" form="form-curso">Salvar</button></>}
      >
        {form && (
          <form id="form-curso" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome do curso" className="sm:col-span-2">
              <input className="input" value={form.nome} onChange={set('nome')} placeholder="Ex.: Alvenaria Básica" required />
            </Campo>
            <Campo label="Carga horária (horas)">
              <input className="input" type="number" min="1" value={form.carga_horaria} onChange={set('carga_horaria')} required />
            </Campo>
            <Campo label="Valor do curso (R$)">
              <input className="input" type="number" min="0" step="0.01" value={form.valor} onChange={set('valor')} required />
            </Campo>
            <Campo label="Nome do instrutor">
              <input className="input" value={form.instrutor} onChange={set('instrutor')} required />
            </Campo>
            <Campo label="Status">
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </Campo>
            <Campo label="Descrição" className="sm:col-span-2">
              <textarea className="input min-h-24" value={form.descricao || ''} onChange={set('descricao')} />
            </Campo>
            {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
          </form>
        )}
      </Modal>

      <Modal aberto={!!visualizar} titulo={visualizar?.nome} onFechar={() => setVisualizar(null)} largura="max-w-lg">
        {visualizar && (
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div><dt className="text-grafite-500">Carga horária</dt><dd className="font-semibold dark:text-white">{visualizar.carga_horaria} horas</dd></div>
            <div><dt className="text-grafite-500">Valor</dt><dd className="font-semibold dark:text-white">{moeda(visualizar.valor)}</dd></div>
            <div><dt className="text-grafite-500">Instrutor</dt><dd className="font-semibold dark:text-white">{visualizar.instrutor}</dd></div>
            <div><dt className="text-grafite-500">Status</dt><dd><Badge status={visualizar.status} /></dd></div>
            <div className="col-span-2"><dt className="text-grafite-500">Descrição</dt><dd className="dark:text-grafite-200">{visualizar.descricao || '—'}</dd></div>
          </dl>
        )}
      </Modal>

      <ConfirmDialog
        aberto={!!excluir}
        mensagem={`Tem certeza que deseja excluir o curso "${excluir?.nome}"? Esta ação não pode ser desfeita.`}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluir(null)}
      />
    </>
  );
}
