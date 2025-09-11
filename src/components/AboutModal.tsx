/**
 * @fileoverview Modal informativo sobre la aplicación Connectus.
 * Muestra información del desarrollador y el propósito de la herramienta.
 */

import React from 'react';
import '../types/AboutModal.css';

/**
 * Props para el componente AboutModal.
 * @interface AboutModalProps
 */
interface AboutModalProps {
    /** Función para cerrar el modal. */
    onClose: () => void;
}

/**
 * Componente que renderiza un modal con información sobre la aplicación.
 * @param {AboutModalProps} props - Las props del componente.
 * @returns {React.ReactElement} El modal informativo.
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