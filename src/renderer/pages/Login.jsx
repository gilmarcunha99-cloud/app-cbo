import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Layout';

export default function Login() {
  const { usuario, carregando: verificando, entrar } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  if (verificando) return null;
  if (usuario) return <Navigate to="/" replace />;

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    setCarregando(true);
    try {
      await entrar(email, senha);
      navigate('/');
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-grafite-900 p-10 lg:flex">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #F59E0B 0 24px, transparent 24px 48px)' }} />
        <Logo className="relative" />
        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold text-white">Gestão do Curso Básico de Obras</h2>
          <p className="mt-3 text-grafite-300">Cursos, alunos, mensalidades e cobranças em um só lugar, do canteiro ao escritório.</p>
        </div>
        <div className="relative text-xs text-grafite-500">App.CBO · Construção Civil</div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-grafite-50 p-6 dark:bg-grafite-950">
        <form onSubmit={enviar} className="card w-full max-w-sm p-8">
          <div className="mb-6 rounded-lg bg-grafite-900 p-3 lg:hidden"><Logo /></div>
          <h1 className="text-2xl font-bold text-grafite-900 dark:text-white">Entrar no App.CBO</h1>
          <p className="mb-6 mt-1 text-sm text-grafite-500 dark:text-grafite-400">Use seu e-mail e senha de acesso.</p>

          <label className="label" htmlFor="email">E-mail</label>
          <div className="relative mb-4">
            <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-400" />
            <input id="email" type="email" className="input pl-9" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@appcbo.com" autoFocus required />
          </div>

          <label className="label" htmlFor="senha">Senha</label>
          <div className="relative mb-4">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-grafite-400" />
            <input id="senha" type="password" className="input pl-9" value={senha} onChange={(e) => setSenha(e.target.value)} required />
          </div>

          {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{erro}</div>}

          <button type="submit" className="btn-primary w-full" disabled={carregando}>
            {carregando && <Loader2 size={16} className="animate-spin" />} Entrar
          </button>
        </form>
      </div>
    </div>
  );
}
