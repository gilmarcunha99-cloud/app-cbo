import { AlertTriangle } from 'lucide-react';
import Modal from './Modal';

export default function ConfirmDialog({ aberto, titulo = 'Confirmar exclusão', mensagem, textoConfirmar = 'Excluir', onConfirmar, onCancelar }) {
  return (
    <Modal
      aberto={aberto}
      titulo={titulo}
      onFechar={onCancelar}
      largura="max-w-md"
      rodape={
        <>
          <button className="btn-secondary" onClick={onCancelar}>Cancelar</button>
          <button className="btn-danger" onClick={onConfirmar}>{textoConfirmar}</button>
        </>
      }
    >
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 shrink-0 text-obra-500" />
        <p className="text-sm text-grafite-600 dark:text-grafite-300">{mensagem}</p>
      </div>
    </Modal>
  );
}
