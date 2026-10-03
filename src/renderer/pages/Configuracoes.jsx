import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { Campo, PageHeader } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Configuracoes() {
  const toast = useToast();
  const { alterarSenha } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [senha, setSenha] = useState({ atual: '', nova: '' });

  useEffect(() => { api('configuracoes.obter').then(setCfg); }, []);

  const salvarCfg = async (e) => {
    e.preventDefault();
    try { setCfg(await api('configuracoes.salvar', cfg)); toast.sucesso('Configurações salvas.'); } catch (err) { toast.erro(err.message); }
  };

  const trocarSenha = async (e) => {
    e.preventDefault();
    try {
      await alterarSenha(senha.atual, senha.nova);
      setSenha({ atual: '', nova: '' });
      toast.sucesso('Senha alterada.');
    } catch (err) { toast.erro(err.message); }
  };

  if (!cfg) return null;
  const set = (k) => (e) => setCfg({ ...cfg, [k]: e.target.value });

  return (
    <>
      <PageHeader titulo="Configurações" />
      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={salvarCfg} className="card space-y-4 p-5">
          <h2 className="font-semibold dark:text-white">Escola e recebimento via Pix</h2>
          <Campo label="Nome da escola"><input className="input" value={cfg.escola_nome} onChange={set('escola_nome')} /></Campo>
          <Campo label="Chave Pix (CPF, CNPJ, e-mail, telefone ou aleatória)"><input className="input" value={cfg.pix_chave} onChange={set('pix_chave')} /></Campo>
          <Campo label="Nome do recebedor"><input className="input" value={cfg.pix_beneficiario} onChange={set('pix_beneficiario')} maxLength={25} /></Campo>
          <Campo label="Cidade"><input className="input" value={cfg.pix_cidade} onChange={set('pix_cidade')} maxLength={15} /></Campo>
          <button className="btn-primary">Salvar</button>
        </form>
        <form onSubmit={trocarSenha} className="card space-y-4 p-5">
          <h2 className="font-semibold dark:text-white">Alterar minha senha</h2>
          <Campo label="Senha atual"><input type="password" className="input" value={senha.atual} onChange={(e) => setSenha({ ...senha, atual: e.target.value })} required /></Campo>
          <Campo label="Nova senha (mínimo 8 caracteres)"><input type="password" className="input" value={senha.nova} onChange={(e) => setSenha({ ...senha, nova: e.target.value })} required /></Campo>
          <button className="btn-primary">Alterar senha</button>
        </form>
      </div>
    </>
  );
}
