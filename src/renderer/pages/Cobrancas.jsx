import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Copy, FileSpreadsheet, FileText, Printer, QrCode, RotateCcw } from 'lucide-react';
import { api, salvarArquivo } from '../lib/api';
import { data, hoje, moeda } from '../lib/format';
import { Badge, Campo, PageHeader, Tabela } from '../components/ui';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../context/ToastContext';

const FILTROS_INICIAIS = { situacao: '', dataInicial: '', dataFinal: '', alunoId: '' };

function Total({ rotulo, valor, cor }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-grafite-500 dark:text-grafite-400">{rotulo}</div>
      <div className={`text-lg font-bold tabular-nums ${cor}`}>{valor}</div>
    </div>
  );
}

export default function Cobrancas() {
  const toast = useToast();
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);
  const [dados, setDados] = useState({ linhas: [], totais: {} });
  const [alunos, setAlunos] = useState([]);
  const [marcados, setMarcados] = useState(new Set());
  const [baixa, setBaixa] = useState(null);
  const [estorno, setEstorno] = useState(null);
  const [pix, setPix] = useState(null);

  const filtrosLimpos = useMemo(() => Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)), [filtros]);

  const carregar = () => api('cobrancas.listar', filtrosLimpos)
    .then((d) => { setDados(d); setMarcados(new Set()); })
    .catch((e) => toast.erro(e.message));

  useEffect(() => { carregar(); }, [filtrosLimpos]);
  useEffect(() => { api('alunos.listar').then(setAlunos); }, []);

  const set = (k) => (e) => setFiltros({ ...filtros, [k]: e.target.value });
  const abertas = dados.linhas.filter((c) => c.situacao === 'PENDENTE' || c.situacao === 'ATRASADO');

  const selecao = {
    marcados,
    todos: dados.linhas.length > 0 && marcados.size === dados.linhas.length,
    alternar: (id) => setMarcados((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }),
    alternarTodos: () => setMarcados((s) => (s.size === dados.linhas.length ? new Set() : new Set(dados.linhas.map((c) => c.id)))),
  };

  const gerar = async (tipo, ...args) => {
    try {
      const caminho = await salvarArquivo(tipo, ...args);
      if (caminho) toast.sucesso('Arquivo salvo.');
    } catch (e) { toast.erro(e.message); }
  };

  const emitirLote = () => {
    const ids = [...marcados].filter((id) => abertas.some((c) => c.id === id));
    if (!ids.length) return toast.erro('Selecione parcelas pendentes ou atrasadas para emitir.');
    gerar('cobrancas', ids);
  };

  const abrirPix = async (c) => {
    try {
      const codigo = await api('cobrancas.pixCopiaECola', c.id);
      setPix({ cobranca: c, codigo, imagem: await QRCode.toDataURL(codigo, { margin: 1, width: 260 }) });
    } catch (e) { toast.erro(e.message); }
  };

  const confirmarBaixa = async (e) => {
    e.preventDefault();
    try {
      await api('cobrancas.marcarComoPaga', baixa.id, { dataPagamento: baixa.dataPagamento, valorPago: baixa.valorPago, observacao: baixa.observacao });
      toast.sucesso('Parcela marcada como paga.');
      setBaixa(null);
      carregar();
    } catch (err) { toast.erro(err.message); }
  };

  const confirmarEstorno = async () => {
    try {
      await api('cobrancas.estornar', estorno.id);
      toast.sucesso('Pagamento estornado.');
      carregar();
    } catch (err) { toast.erro(err.message); }
    setEstorno(null);
  };

  return (
    <>
      <PageHeader titulo="Cobranças e Relatórios" subtitulo="Todas as parcelas geradas pelas matrículas">
        <button className="btn-secondary" onClick={() => gerar('relatorio', 'xlsx', filtrosLimpos)}><FileSpreadsheet size={16} /> Exportar XLS</button>
        <button className="btn-secondary" onClick={() => gerar('relatorio', 'pdf', filtrosLimpos)}><FileText size={16} /> Exportar PDF</button>
        <button className="btn-primary" onClick={emitirLote} disabled={!marcados.size}><Printer size={16} /> Emitir selecionadas ({marcados.size})</button>
      </PageHeader>

      <div className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <Campo label="Situação">
          <select className="input" value={filtros.situacao} onChange={set('situacao')}>
            <option value="">Todas</option>
            <option value="PAGO">Pago</option>
            <option value="PENDENTE">Pendente</option>
            <option value="ATRASADO">Atrasado</option>
          </select>
        </Campo>
        <Campo label="Vencimento de"><input type="date" className="input" value={filtros.dataInicial} onChange={set('dataInicial')} /></Campo>
        <Campo label="Até"><input type="date" className="input" value={filtros.dataFinal} onChange={set('dataFinal')} /></Campo>
        <Campo label="Aluno">
          <select className="input" value={filtros.alunoId} onChange={set('alunoId')}>
            <option value="">Todos</option>
            {alunos.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
          </select>
        </Campo>
        <div className="flex items-end">
          <button className="btn-secondary w-full" onClick={() => setFiltros(FILTROS_INICIAIS)}>Limpar filtros</button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Total rotulo="Cobranças" valor={dados.totais.quantidade ?? 0} cor="text-grafite-900 dark:text-white" />
        <Total rotulo="Recebido" valor={moeda(dados.totais.pago)} cor="text-emerald-600 dark:text-emerald-400" />
        <Total rotulo="Pendente" valor={moeda(dados.totais.pendente)} cor="text-amber-600 dark:text-amber-400" />
        <Total rotulo="Em atraso (atualizado)" valor={moeda(dados.totais.atrasado)} cor="text-red-600 dark:text-red-400" />
      </div>

      <Tabela
        linhas={dados.linhas}
        selecao={selecao}
        vazio="Nenhuma cobrança encontrada com esses filtros."
        colunas={[
          { titulo: 'Aluno', campo: 'aluno_nome' },
          { titulo: 'Curso', render: (c) => `${c.curso_nome} · ${c.numero_parcela}/${c.num_parcelas}` },
          { titulo: 'Vencimento', render: (c) => data(c.vencimento) },
          { titulo: 'Valor', render: (c) => (
            <span title={c.dias_atraso ? `Original ${moeda(c.valor)} + multa ${moeda(c.multa)} + juros ${moeda(c.juros)}` : ''}>
              {moeda(c.situacao === 'PAGO' ? c.valor_pago : c.valor_atualizado)}
            </span>
          ), alinhar: 'direita' },
          { titulo: 'Situação', render: (c) => <Badge status={c.situacao} /> },
        ]}
        acoes={(c) => (c.situacao === 'PAGO' ? (
          <button className="btn-icon" title="Estornar pagamento" onClick={() => setEstorno(c)}><RotateCcw size={16} /></button>
        ) : c.situacao === 'CANCELADO' ? null : (
          <>
            <button className="btn-icon" title="QR Pix" onClick={() => abrirPix(c)}><QrCode size={16} /></button>
            <button className="btn-icon" title="Emitir cobrança (PDF)" onClick={() => gerar('cobrancas', [c.id])}><Printer size={16} /></button>
            <button className="btn-icon hover:!text-emerald-600" title="Marcar como paga"
              onClick={() => setBaixa({ ...c, dataPagamento: hoje(), valorPago: c.valor_atualizado, observacao: '' })}><CheckCircle2 size={16} /></button>
          </>
        ))}
      />

      <Modal
        aberto={!!baixa}
        titulo="Marcar parcela como paga"
        onFechar={() => setBaixa(null)}
        largura="max-w-md"
        rodape={<><button className="btn-secondary" onClick={() => setBaixa(null)}>Cancelar</button><button className="btn-primary" form="form-baixa">Confirmar pagamento</button></>}
      >
        {baixa && (
          <form id="form-baixa" onSubmit={confirmarBaixa} className="space-y-4">
            <p className="text-sm text-grafite-600 dark:text-grafite-300">
              {baixa.aluno_nome} · {baixa.curso_nome} · parcela {baixa.numero_parcela}/{baixa.num_parcelas}
              {baixa.dias_atraso > 0 && <> · {baixa.dias_atraso} dia(s) de atraso</>}
            </p>
            <Campo label="Data do pagamento"><input type="date" className="input" value={baixa.dataPagamento} onChange={(e) => setBaixa({ ...baixa, dataPagamento: e.target.value })} required /></Campo>
            <Campo label="Valor pago (R$)"><input type="number" step="0.01" min="0.01" className="input" value={baixa.valorPago} onChange={(e) => setBaixa({ ...baixa, valorPago: e.target.value })} required /></Campo>
            <Campo label="Observação"><input className="input" value={baixa.observacao} onChange={(e) => setBaixa({ ...baixa, observacao: e.target.value })} placeholder="Ex.: pago em dinheiro na secretaria" /></Campo>
          </form>
        )}
      </Modal>

      <Modal aberto={!!pix} titulo="Pagamento via Pix" onFechar={() => setPix(null)} largura="max-w-sm">
        {pix && (
          <div className="flex flex-col items-center gap-3 text-center">
            <img src={pix.imagem} alt="QR Code Pix" className="rounded-lg bg-white p-2" />
            <div className="text-sm dark:text-grafite-200">{pix.cobranca.aluno_nome}</div>
            <div className="text-2xl font-bold text-obra-600">{moeda(pix.cobranca.valor_atualizado)}</div>
            <button className="btn-secondary w-full" onClick={() => { navigator.clipboard.writeText(pix.codigo); toast.sucesso('Pix Copia e Cola copiado.'); }}>
              <Copy size={16} /> Copiar Pix Copia e Cola
            </button>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        aberto={!!estorno}
        titulo="Estornar pagamento"
        textoConfirmar="Estornar"
        mensagem={`A parcela de ${estorno?.aluno_nome} voltará a ficar em aberto. Deseja continuar?`}
        onConfirmar={confirmarEstorno}
        onCancelar={() => setEstorno(null)}
      />
    </>
  );
}
