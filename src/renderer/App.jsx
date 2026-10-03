import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Cursos from './pages/Cursos';
import Alunos from './pages/Alunos';
import FormasPagamento from './pages/FormasPagamento';
import Cobrancas from './pages/Cobrancas';
import Configuracoes from './pages/Configuracoes';
import TrocarSenha from './pages/TrocarSenha';

function RotaProtegida({ children }) {
  const { usuario, carregando } = useAuth();
  if (carregando) return null;
  if (!usuario) return <Navigate to="/login" replace />;
  if (usuario.trocarSenha) return <TrocarSenha />;
  return children;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <HashRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<RotaProtegida><Layout /></RotaProtegida>}>
                <Route index element={<Dashboard />} />
                <Route path="cursos" element={<Cursos />} />
                <Route path="alunos" element={<Alunos />} />
                <Route path="formas-pagamento" element={<FormasPagamento />} />
                <Route path="cobrancas" element={<Cobrancas />} />
                <Route path="configuracoes" element={<Configuracoes />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </HashRouter>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
