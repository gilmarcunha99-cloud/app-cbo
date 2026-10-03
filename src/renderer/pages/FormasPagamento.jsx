import { useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../lib/api';
import { Badge, Campo, PageHeader, Tabela } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';

const VAZIO = { nome: '', max_parcelas: 1, multa_percentual: 2, juros_mes_percentual: 1, status: 'ATIVO' };
const pct = (v) => `${Number(v).toLocaleString('pt-BR')}%`;

export default function FormasPagamento() {
  const toast = useToast();
  const [formas, setFormas] = useState([]);
  const [form, setForm] = useState(null);
  const [excluir, setExcluir] = useState(null);
  const [erro, setErro] = useState('');

  const carregar = () => api('formasPagamento.listar').then(setFormas).catch((e) => toast.erro(e.message));
  useEffect(() => { carregar(); }, []);

  const salvar = async (e) => {
    e.preventDefault();
    setErro('');
    try {
      if (form.id) await api('formasPagamento.atualizar', form.id, form);
      else await api('formasPagamento.criar', form);
      toast.sucesso('Forma de pagamento salva.');
      setForm(null);
      carregar();
    } catch (err) {
      setErro(err.message);
    }
  };

  const confirmarExclusao = async () => {
    try {
      await api('formasPagamento.excluir', excluir.id);
      toast.sucesso('Forma de pagamento excluída.');
      carregar();
    } catch (err) {
      toast.erro(err.message);
    }
    setExcluir(null);
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <>
      <PageHeader titulo="Formas de Pagamento" subtitulo="Parcelamento, multa e juros por atraso">
        <button className="btn-primary" onClick={() => { setErro(''); setForm(VAZIO); }}><Plus size={16} /> Nova forma</button>
      </PageHeader>

      <Tabela
        linhas={formas}
        colunas={[
          { titulo: 'Forma', campo: 'nome' },
          { titulo: 'Parcelas permitidas', render: (f) => `até ${f.max_parcelas}x` },
          { titulo: 'Multa por atraso', render: (f) => pct(f.multa_percentual) },
          { titulo: 'Juros ao mês', render: (f) => pct(f.juros_mes_percentual) },
          { titulo: 'Status', render: (f) => <Badge status={f.status} /> },
        ]}
        acoes={(f) => (
          <>
            <button className="btn-icon" title="Editar" onClick={() => { setErro(''); setForm(f); }}><Pencil size={16} /></button>
            <button className="btn-icon hover:!text-red-600" title="Excluir" onClick={() => setExcluir(f)}><Trash2 size={16} /></button>
          </>
        )}
      />

      <Modal
        aberto={!!form}
        titulo={form?.id ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
        onFechar={() => setForm(null)}
        largura="max-w-lg"
        rodape={<><button className="btn-secondary" onClick={() => setForm(null)}>Cancelar</button><button className="btn-primary" form="form-forma">Salvar</button></>}
      >
        {form && (
          <form id="form-forma" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
            <Campo label="Nome da forma" className="sm:col-span-2">
              <input className="input" value={form.nome} onChange={set('nome')} placeholder="Ex.: Pix" required />
            </Campo>
            <Campo label="Nº de parcelas permitidas">
              <input className="input" type="number" min="1" max="48" value={form.max_parcelas} onChange={set('max_parcelas')} required />
            </Campo>
            <Campo label="Status">
              <select className="input" value={form.status} onChange={set('status')}>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </Campo>
            <Campo label="Multa por atraso (%)">
              <input className="input" type="number" min="0" max="2" step="0.01" value={form.multa_percentual} onChange={set('multa_percentual')} />
            </Campo>
            <Campo label="Juros por atraso (% ao mês)">
              <input className="input" type="number" min="0" step="0.01" value={form.juros_mes_percentual} onChange={set('juros_mes_percentual')} />
            </Campo>
            <p className="text-xs text-grafite-500 sm:col-span-2">A multa é cobrada uma vez; os juros são proporcionais aos dias de atraso.</p>
            {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
          </form>
        )}
      </Modal>

      <ConfirmDialog
        aberto={!!excluir}
        mensagem={`Tem certeza que deseja excluir a forma de pagamento "${excluir?.nome}"?`}
        onConfirmar={confirmarExclusao}
        onCancelar={() => setExcluir(null)}
      />
    </>
  );
}
