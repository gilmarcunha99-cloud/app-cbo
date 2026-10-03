import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);
const CHAVE = 'appcbo-tema';

export function ThemeProvider({ children }) {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem(CHAVE) || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch {
      return 'light';
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', tema === 'dark');
    try { localStorage.setItem(CHAVE, tema); } catch { /* sem armazenamento: segue sem lembrar */ }
  }, [tema]);

  const alternar = () => setTema((t) => (t === 'dark' ? 'light' : 'dark'));
  return <ThemeContext.Provider value={{ tema, alternar }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
