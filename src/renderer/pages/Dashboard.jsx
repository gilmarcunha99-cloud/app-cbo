import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BookOpen, DollarSign, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../lib/api';
import { moeda } from '../lib/format';
import { PageHeader } from '../components/ui';
import { useTheme } from '../context/ThemeContext';

function Indicador({ titulo, valor, detalhe, icon: Icon, destaque, to }) {
  return (
    <Link to={to} className="card flex items-start gap-4 p-5 transition hover:border-obra-500">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${destaque || 'bg-obra-100 text-obra-700 dark:bg-obra-500/15 dark:text-obra-400'}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <div className="text-sm text-grafite-500 dark:text-grafite-400">{titulo}</div>
        <div className="text-xl font-bold tabular-nums 2xl:text-2xl text-grafite-900 dark:text-white">{valor}</div>
        {detalhe && <div className="text-xs text-grafite-500 dark:text-grafite-400">{detalhe}</div>}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const { tema } = useTheme();

  useEffect(() => { api('dashboard.resumo').then(setDados).catch((e) => setErro(e.message)); }, []);

  if (erro) return <div className="card p-6 text-red-600">{erro}</div>;
  if (!dados) return <div className="p-6 text-grafite-500">Carregando…</div>;

  const { indicadores: i } = dados;
  const eixo = tema === 'dark' ? '#94A3B8' : '#64748B';
  const grade = tema === 'dark' ? '#1F2937' : '#E2E8F0';
  const dica = { contentStyle: { background: tema === 'dark' ? '#111827' : '#fff', border: `1px solid ${grade}`, borderRadius: 8 } };

  return (
    <>
      <PageHeader titulo="Painel" subtitulo="Resumo do curso neste mês" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador titulo="Alunos ativos" valor={i.alunosAtivos} icon={Users} to="/alunos" />
        <Indicador titulo="Cursos em andamento" valor={i.cursosEmAndamento} icon={BookOpen} to="/cursos" />
        <Indicador titulo="Receita do mês" valor={moeda(i.receitaMensal)} icon={DollarSign} to="/cobrancas"
          destaque="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400" />
        <Indicador titulo="Inadimplência" valor={moeda(i.inadimplencia)} icon={AlertTriangle} to="/cobrancas"
          detalhe={`${i.parcelasAtrasadas} parcela(s) · ${i.alunosInadimplentes} aluno(s)`}
          destaque="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-grafite-900 dark:text-white">Fluxo de caixa (6 meses)</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dados.fluxoCaixa}>
              <CartesianGrid vertical={false} stroke={grade} />
              <XAxis dataKey="mes" stroke={eixo} fontSize={12} tickLine={false} />
              <YAxis stroke={eixo} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v >= 1000 ? `${v / 1000}k` : v}`} />
              <Tooltip formatter={(v) => moeda(v)} {...dica} cursor={{ fill: grade }} />
              <Legend />
              <Bar dataKey="previsto" name="Previsto" fill="#94A3B8" radius={[4, 4, 0, 0]} />
              <Bar dataKey="recebido" name="Recebido" fill="#F59E0B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 font-semibold text-grafite-900 dark:text-white">Matrículas por mês</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={dados.matriculasPorMes}>
              <CartesianGrid vertical={false} stroke={grade} />
              <XAxis dataKey="mes" stroke={eixo} fontSize={12} tickLine={false} />
              <YAxis stroke={eixo} fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip {...dica} cursor={{ fill: grade }} />
              <Bar dataKey="matriculas" name="Matrículas" fill="#334155" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </>
  );
}
