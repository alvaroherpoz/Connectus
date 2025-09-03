/**
 * AboutModal.tsx
 * Modal informativo sobre la aplicación Connectus.
 * Muestra información del desarrollador y el propósito de la herramienta.
 */

import React from 'react';
import '../types/AboutModal.css';

/**
 * Props del modal informativo.
 */
interface AboutModalProps {
    onClose: () => void;
}

/**
 * Componente modal para mostrar información sobre la aplicación.
 */
const AboutModal: React.FC<AboutModalProps> = ({ onClose }) => {
    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <h2>Acerca de la Aplicación</h2>
                <p>
                    Esta aplicación ha sido diseñada para la gestión y generación automática de código de las comunicaciones de los componentes EDROOM
                </p>
                <hr />
                <div className="info-section">
                    <p>
                        <strong>Desarrollador:</strong> Álvaro López Pozo
                    </p>
                    <p>
                        <strong>Idea de:</strong> Óscar Rodríguez Polo
                    </p>
                </div>
                <button onClick={onClose}>Cerrar</button>
            </div>
        </div>
    );
};

export default AboutModal;