import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Layout';

// Aparece no primeiro acesso: a senha padrão (admin123) não pode continuar valendo,
// principalmente com o app publicado na internet.
export default function TrocarSenha() {
  const { usuario, alterarSenha, sair } = useAuth();
  const [form, setForm] = useState({ atual: '', nova: '', confirma: '' });
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro('');
    if (form.nova !== form.confirma) return setErro('A confirmação não confere com a nova senha.');
    setSalvando(true);
    try {
      await alterarSenha(form.atual, form.nova);
    } catch (err) {
      setErro(err.message);
    } finally {
      setSalvando(false);
    }
  };

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="flex min-h-screen items-center justify-center bg-grafite-50 p-6 dark:bg-grafite-950">
      <form onSubmit={enviar} className="card w-full max-w-sm p-8">
        <div className="mb-6 rounded-lg bg-grafite-900 p-3"><Logo /></div>
        <div className="mb-1 flex items-center gap-2 text-obra-600"><KeyRound size={18} /><span className="text-sm font-semibold">Primeiro acesso</span></div>
        <h1 className="text-xl font-bold text-grafite-900 dark:text-white">Crie uma senha nova</h1>
        <p className="mb-6 mt-1 text-sm text-grafite-500 dark:text-grafite-400">
          Olá, {usuario?.nome}. Por segurança, troque a senha padrão antes de usar o sistema.
        </p>
        <label className="label" htmlFor="atual">Senha atual</label>
        <input id="atual" type="password" className="input mb-4" value={form.atual} onChange={set('atual')} required autoFocus />
        <label className="label" htmlFor="nova">Nova senha (mínimo 8 caracteres)</label>
        <input id="nova" type="password" className="input mb-4" value={form.nova} onChange={set('nova')} minLength={8} required />
        <label className="label" htmlFor="confirma">Repita a nova senha</label>
        <input id="confirma" type="password" className="input mb-4" value={form.confirma} onChange={set('confirma')} required />
        {erro && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{erro}</div>}
        <button className="btn-primary w-full" disabled={salvando}>{salvando && <Loader2 size={16} className="animate-spin" />} Salvar e entrar</button>
        <button type="button" className="mt-3 w-full text-sm text-grafite-500 hover:underline" onClick={sair}>Sair</button>
      </form>
    </div>
  );
}
