import React from 'react';
import './Modal.css';

function Modal({ title, children, actions, onClose, overlayClassName, modalClassName }) {
  return (
    <div className={overlayClassName ? `modal-overlay ${overlayClassName}` : "modal-overlay"} onClick={onClose}>
      <div className={modalClassName ? `modal ${modalClassName}` : "modal"} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
        </div>
        <div className="modal-body">
          {children}
        </div>
        {onClose && (
          <div className="modal-actions">
            {actions}
            <button type="button" className="btn btn-ghost" onClick={onClose}>Закрыть</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Modal;
