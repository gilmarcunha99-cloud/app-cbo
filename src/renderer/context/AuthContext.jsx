import { createContext, useContext, useEffect, useState } from 'react';
import { api, logout } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Ao abrir (ou recarregar a página na web), recupera a sessão, se houver.
  useEffect(() => {
    api('auth.sessao').then(setUsuario).catch(() => setUsuario(null)).finally(() => setCarregando(false));
  }, []);

  const entrar = async (email, senha) => setUsuario(await api('auth.login', email, senha));
  const alterarSenha = async (atual, nova) => setUsuario(await api('auth.alterarSenha', atual, nova));
  const sair = async () => {
    await logout();
    setUsuario(null);
  };

  return (
    <AuthContext.Provider value={{ usuario, carregando, entrar, sair, alterarSenha }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
