import React, { useState } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  onAddPort: (name: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'normal' | 'conjugado' | undefined, dataType: string) => void;
  onRename: (newName: string) => void;
  onClose: () => void;
  dataTypes: string[];
  onAssignNode: (nodeName: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onAddPort, onRename, onClose, dataTypes, onAssignNode }) => {
  const [portName, setPortName] = useState('');
  const [componentName, setComponentName] = useState('');
  const [selectedDataType, setSelectedDataType] = useState(dataTypes[0] || '');
  const [customDataType, setCustomDataType] = useState('');
  const [nodeName, setNodeName] = useState('');

  const menuStyle: React.CSSProperties = {
    position: 'absolute',
    top: y,
    left: x,
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '5px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
    padding: '10px',
    zIndex: 1000,
  };

  const getFinalDataType = () => {
    return customDataType || selectedDataType;
  };

  const handleAddPort = (type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'normal' | 'conjugado' | undefined) => {
    const finalDataType = getFinalDataType();
    if (!portName || !finalDataType) return;
    onAddPort(portName, type, subtype, finalDataType);
    setPortName('');
    setCustomDataType('');
    setSelectedDataType(dataTypes[0] || '');
  };

  return (
    <div style={menuStyle}>
      <h4>Configurar Componente</h4>
      <div>
        <input
          type="text"
          placeholder="Nuevo nombre"
          value={componentName}
          onChange={(e) => setComponentName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRename(componentName);
              setComponentName('');
            }
          }}
        />
        <button onClick={() => onRename(componentName)}>Renombrar</button>
      </div>
      <hr />
      <div>
        <input
          type="text"
          placeholder="Asignar a nodo"
          value={nodeName}
          onChange={(e) => setNodeName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onAssignNode(nodeName);
              setNodeName('');
            }
          }}
        />
        <button onClick={() => onAssignNode(nodeName)}>Asignar</button>
      </div>
      <hr />
      <h4>Añadir Puerto</h4>
      <input
        type="text"
        placeholder="Nombre del puerto"
        value={portName}
        onChange={(e) => setPortName(e.target.value)}
      />
      
      <div style={{ marginTop: '5px' }}>
        <label htmlFor="dataTypeSelect">Tipo de dato:</label>
        <select
          id="dataTypeSelect"
          value={selectedDataType}
          onChange={(e) => {
            setSelectedDataType(e.target.value);
            setCustomDataType('');
          }}
        >
          {dataTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        o
        <input
          type="text"
          placeholder="Personalizado"
          value={customDataType}
          onChange={(e) => {
            setCustomDataType(e.target.value);
            setSelectedDataType('');
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: '5px' }}>
        <button onClick={() => handleAddPort('comunicacion', 'conjugado')}>
          Puerto Comunicación (C)
        </button>
        <button onClick={() => handleAddPort('comunicacion', 'normal')}>
          Puerto Comunicación (N)
        </button>
        <button onClick={() => handleAddPort('tiempo', undefined)}>
          Puerto de Tiempo
        </button>
        <button onClick={() => handleAddPort('interrupcion', undefined)}>
          Puerto de Interrupción
        </button>
      </div>
      <button onClick={onClose} style={{ marginTop: '10px' }}>Cerrar</button>
    </div>
  );
};

export default ContextMenu;