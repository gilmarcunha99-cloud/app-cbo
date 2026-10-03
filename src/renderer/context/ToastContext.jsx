import { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [itens, setItens] = useState([]);

  const mostrar = useCallback((texto, tipo = 'sucesso') => {
    const id = Math.random();
    setItens((l) => [...l, { id, texto, tipo }]);
    setTimeout(() => setItens((l) => l.filter((i) => i.id !== id)), 4000);
  }, []);

  const toast = { sucesso: (t) => mostrar(t, 'sucesso'), erro: (t) => mostrar(t, 'erro') };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {itens.map((i) => (
          <div key={i.id} className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${i.tipo === 'erro' ? 'bg-red-600' : 'bg-grafite-800'}`}>
            {i.tipo === 'erro' ? <XCircle size={18} /> : <CheckCircle2 size={18} className="text-obra-400" />}
            {i.texto}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
