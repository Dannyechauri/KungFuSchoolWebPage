import type { ReactNode } from 'react';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <section className="modal-card">
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="ghost-action" type="button" onClick={onClose} aria-label="Cerrar">
            ✕
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
