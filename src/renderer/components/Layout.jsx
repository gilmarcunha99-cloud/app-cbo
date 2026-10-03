import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Users, CreditCard, Receipt, Settings, LogOut, Menu, X, Sun, Moon, HardHat,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import ConfirmDialog from './ConfirmDialog';

const MENU = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/cursos', label: 'Cursos', icon: BookOpen },
  { to: '/alunos', label: 'Alunos', icon: Users },
  { to: '/formas-pagamento', label: 'Formas de Pagamento', icon: CreditCard },
  { to: '/cobrancas', label: 'Cobranças e Relatórios', icon: Receipt },
  { to: '/configuracoes', label: 'Configurações', icon: Settings },
];

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-obra-500 text-grafite-900">
        <HardHat size={20} strokeWidth={2.5} />
      </span>
      <span className="text-xl font-extrabold tracking-tight text-white">
        App<span className="text-obra-500">.CBO</span>
      </span>
    </div>
  );
}

export default function Layout() {
  const { usuario, sair } = useAuth();
  const { tema, alternar } = useTheme();
  const [aberto, setAberto] = useState(false);
  const [apagar, setApagar] = useState(false);

  const menu = (
    <nav className="flex flex-1 flex-col gap-1 p-3">
      {MENU.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setAberto(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive ? 'bg-obra-500 text-grafite-900' : 'text-grafite-300 hover:bg-grafite-800 hover:text-white'
            }`}
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-grafite-50 dark:bg-grafite-950">
      {/* Menu lateral: fixo no desktop, gaveta no celular */}
      <div className={`fixed inset-0 z-30 bg-black/50 lg:hidden ${aberto ? '' : 'hidden'}`} onClick={() => setAberto(false)} />
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-grafite-900 transition-transform lg:static lg:translate-x-0 ${
          aberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-grafite-800 px-4">
          <Logo />
          <button className="text-grafite-400 lg:hidden" onClick={() => setAberto(false)} aria-label="Fechar menu"><X /></button>
        </div>
        {menu}
        <div className="border-t border-grafite-800 p-3">
          <div className="mb-2 px-3 text-xs text-grafite-400">
            <div className="font-semibold text-grafite-200">{usuario?.nome}</div>
            <div>{usuario?.email} · {usuario?.perfil}</div>
          </div>
          <button onClick={sair} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-grafite-300 hover:bg-grafite-800 hover:text-white">
            <LogOut size={18} /> Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-grafite-200 bg-white px-4 dark:border-grafite-800 dark:bg-grafite-900">
          <button className="btn-icon lg:hidden" onClick={() => setAberto(true)} aria-label="Abrir menu"><Menu /></button>
          {window.appcbo?.demo ? (
            <div className="flex min-w-0 items-center gap-2 px-2 text-xs text-grafite-600 dark:text-grafite-300">
              <span className="shrink-0 rounded-full bg-obra-100 px-2 py-0.5 font-semibold text-obra-700 dark:bg-obra-500/15 dark:text-obra-400">Versão de teste</span>
              <span className="hidden truncate sm:inline">Os dados ficam só neste navegador.</span>
              <button className="shrink-0 underline hover:text-obra-600" onClick={() => setApagar(true)}>Apagar dados</button>
            </div>
          ) : (
            <div className="truncate px-2 text-sm text-grafite-500 dark:text-grafite-400">Curso Básico de Obras e Construção Civil</div>
          )}
          <button className="btn-icon" onClick={alternar} title={tema === 'dark' ? 'Modo claro' : 'Modo escuro'}>
            {tema === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
        <ConfirmDialog
          aberto={apagar}
          titulo="Apagar dados de teste"
          textoConfirmar="Apagar tudo"
          mensagem="Todos os cursos, alunos e cobranças desta versão de teste serão apagados e o app volta ao início, com a senha padrão."
          onConfirmar={() => window.appcbo.apagarDados()}
          onCancelar={() => setApagar(false)}
        />
      </div>
    </div>
  );
}
