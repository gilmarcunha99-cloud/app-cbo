import { X } from 'lucide-react';

export default function Modal({ titulo, aberto, onFechar, children, rodape, largura = 'max-w-2xl' }) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onMouseDown={onFechar}>
      <div
        className={`flex max-h-[92vh] w-full ${largura} flex-col rounded-t-2xl bg-white shadow-xl dark:bg-grafite-900 sm:rounded-2xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-grafite-200 px-5 py-4 dark:border-grafite-800">
          <h2 className="text-lg font-bold text-grafite-900 dark:text-white">{titulo}</h2>
          <button className="btn-icon" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <div className="flex justify-end gap-2 border-t border-grafite-200 px-5 py-3 dark:border-grafite-800">{rodape}</div>}
      </div>
    </div>
  );
}
