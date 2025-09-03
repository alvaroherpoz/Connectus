/**
 * PortInfoPanel.tsx
 * Panel para mostrar y editar la información de un puerto seleccionado.
 */

import React from 'react';
import type { PortData } from './types';
import '../types/PortInfoPanel.css';

/**
 * Props del panel de información del puerto.
 */
interface PortInfoPanelProps {
  port: PortData;
  onClose: () => void;
}

/**
 * Componente visual para mostrar la información detallada de un puerto.
 */
const PortInfoPanel: React.FC<PortInfoPanelProps> = ({ port, onClose }) => {
  return (
    <div className="port-info-panel">
      <div className="port-info-header">
        <h3>Propiedades del Puerto: {port.name}</h3>
        <button className="close-button" onClick={onClose}>&times;</button>
      </div>
      <div className="port-info-body">
        <div className="info-table">
          <div className="info-row">
            <span className="info-label">ID:</span>
            <span className="info-value">{port.id}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Tipo:</span>
            <span className="info-value">{port.type}</span>
          </div>
          {port.subtype && (
            <div className="info-row">
              <span className="info-label">Subtipo:</span>
              <span className="info-value">{port.subtype}</span>
            </div>
          )}
          {port.interruptHandler && (
            <div className="info-row">
              <span className="info-label">Handler de interrupción:</span>
              <span className="info-value">{port.interruptHandler}</span>
            </div>
          )}
        </div>
        {port.messages && port.messages.length > 0 && (
          <div className="messages-section">
            <h4>Mensajes:</h4>
            <table className="messages-table">
              <thead>
                <tr>
                  <th>Señal</th>
                  <th>Tipo de Dato</th>
                  <th>Dirección</th>
                </tr>
              </thead>
              <tbody>
                {port.messages.map((msg, index) => (
                  <tr key={index}>
                    <td>{msg.signal}</td>
                    <td>{msg.dataType}</td>
                    <td>{msg.direction}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default PortInfoPanel;