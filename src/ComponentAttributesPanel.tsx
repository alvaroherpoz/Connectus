/**
 * ComponentAttributesPanel.tsx
 * Panel para editar los atributos de un componente seleccionado en el diagrama.
 * Permite modificar propiedades como ID, nombre, nodo, prioridad, stack y si es el componente top.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { NodeData, ComponentPriority } from './types';
import './ComponentAttributesPanel.css';

/**
 * Props del panel de atributos del componente.
 */
interface ComponentAttributesPanelProps {
  nodeId: string;
  nodeData: NodeData;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: Partial<NodeData>) => boolean;
  onUpdateIsTop: (nodeId: string, isTop: boolean) => void;
}

/**
 * Panel para editar los atributos de un componente.
 */
const ComponentAttributesPanel: React.FC<ComponentAttributesPanelProps> = ({
  nodeId,
  nodeData,
  onClose,
  onUpdateNode,
  onUpdateIsTop,
}) => {
  const [localData, setLocalData] = useState<NodeData>(nodeData);

  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });

  /**
   * Centra el panel en pantalla al montarse.
   */
  useEffect(() => {
    if (panelRef.current) {
      const panel = panelRef.current;
      const x = (window.innerWidth / 2) - (panel.offsetWidth / 2);
      const y = (window.innerHeight / 2) - (panel.offsetHeight / 2);
      setPosition({ x, y });
    }
  }, []);

  /**
   * Inicia el arrastre del panel.
   */
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  }, []);

  /**
   * Gestiona el movimiento del panel mientras se arrastra.
   */
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      
      setPosition(prevPos => ({
        x: prevPos.x + deltaX,
        y: prevPos.y + deltaY,
      }));

      setDragStart({ x: e.clientX, y: e.clientY });
    }
  }, [isDragging, dragStart]);

  /**
   * Finaliza el arrastre del panel.
   */
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Añade y elimina listeners de arrastre según el estado.
   */
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  /**
   * Guarda los cambios realizados en el panel.
   */
  const handleSave = () => {
    const success = onUpdateNode(nodeId, localData);
    if (success) {
      onClose();
    }
  };
  
  /**
   * Cambia el estado de "top component".
   */
  const handleIsTopChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isChecked = e.target.checked;
    setLocalData({ ...localData, isTop: isChecked });
    onUpdateIsTop(nodeId, isChecked);
  };

  // Renderizado del panel de atributos
  return (
    <div
      ref={panelRef}
      className="attributes-panel-container"
      style={{ top: position.y, left: position.x }}
    >
      <div className="attributes-panel-header-draggable" onMouseDown={handleMouseDown}>
        <h4>Propiedades del Componente</h4>
        <button onClick={onClose}>×</button>
      </div>
      <div className="attributes-panel-body">
        <div className="form-group">
          <label htmlFor="component-id">ID de Componente</label>
          <input
            id="component-id"
            type="number"
            value={localData.componentId}
            onChange={(e) => setLocalData({ ...localData, componentId: Number(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="component-name">Nombre</label>
          <input
            id="component-name"
            type="text"
            value={localData.name}
            onChange={(e) => setLocalData({ ...localData, name: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="node-name">Nodo</label>
          <input
            id="node-name"
            type="text"
            value={localData.node}
            onChange={(e) => setLocalData({ ...localData, node: e.target.value })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="max-messages">Máx. Mensajes</label>
          <input
            id="max-messages"
            type="number"
            value={localData.maxMessages}
            onChange={(e) => setLocalData({ ...localData, maxMessages: Number(e.target.value) })}
          />
        </div>
        <div className="form-group">
          <label htmlFor="priority">Prioridad</label>
          <select
            id="priority"
            value={localData.priority}
            onChange={(e) => setLocalData({ ...localData, priority: e.target.value as ComponentPriority })}
          >
            <option value="EDROOMprioURGENT">EDROOMprioURGENT</option>
            <option value="EDROOMprioVeryHigh">EDROOMprioVeryHigh</option>
            <option value="EDROOMprioHigh">EDROOMprioHigh</option>
            <option value="EDROOMprioNormal">EDROOMprioNormal</option>
            <option value="EDROOMprioLow">EDROOMprioLow</option>
            <option value="EDROOMprioVeryLow">EDROOMprioVeryLow</option>
            <option value="EDROOMprioMINIMUM">EDROOMprioMINIMUM</option>
            <option value="EDROOMprioIDLE">EDROOMprioIDLE</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="stack-size">Tamaño de Stack</label>
          <input
            id="stack-size"
            type="number"
            value={localData.stackSize}
            onChange={(e) => setLocalData({ ...localData, stackSize: Number(e.target.value) })}
          />
        </div>
        <div className="form-group checkbox-group">
          <input
            id="is-top"
            type="checkbox"
            checked={localData.isTop || false}
            onChange={handleIsTopChange}
          />
          <label htmlFor="is-top">Top Component</label>
        </div>
        <div className="button-group">
          <button onClick={handleSave}>Aceptar</button>
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default ComponentAttributesPanel;