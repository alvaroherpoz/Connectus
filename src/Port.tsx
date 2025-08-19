import React from 'react';
import { Handle, Position } from 'reactflow';
import type { HandleType } from 'reactflow';

interface PortProps {
  id: string;
  type: 'comunicacion' | 'tiempo' | 'interrupcion';
  label: string;
  dataType: string;
  onDelete?: (portId: string) => void;
  subtype?: 'normal' | 'conjugado';
}

const Port: React.FC<PortProps> = ({ id, type, label, dataType, onDelete, subtype }) => {
  const showHandle = type === 'comunicacion';
  const isSource = subtype === 'normal';

  // Si no es un puerto de comunicación, el estilo se mantiene simple.
  if (!showHandle) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          margin: '5px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: '10px', marginRight: '5px' }}>[{type.charAt(0).toUpperCase()}]</span>
          <span>{label} ({dataType})</span>
        </div>
        {onDelete && (
          <button
            onClick={() => onDelete(id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'red',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            &times;
          </button>
        )}
      </div>
    );
  }

  // Lógica para puertos de comunicación con 'handle'
  const position = isSource ? Position.Right : Position.Left;
  const handleType: HandleType = isSource ? 'source' : 'target';
  const handleStyle = { background: isSource ? '#555' : '#888' };
  
  const portContainerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    margin: '5px 0',
    position: 'relative',
    justifyContent: isSource ? 'flex-end' : 'flex-start',
    paddingLeft: isSource ? '0' : '10px',
    paddingRight: isSource ? '10px' : '0',
  };

  const handleWrapperStyle: React.CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    [isSource ? 'right' : 'left']: '-5px',
  };

  // Define la etiqueta del subtipo (N o C)
  const subtypeLabel = isSource ? '(N)' : '(C)';

  return (
    <div style={portContainerStyle}>
      {!isSource && <span style={{ marginRight: '8px' }}>{label} {subtypeLabel} ({dataType})</span>}
      <div style={handleWrapperStyle}>
        <Handle
          type={handleType}
          position={position}
          id={id}
          style={handleStyle}
        />
      </div>
      {isSource && <span style={{ marginLeft: '8px' }}>{label} {subtypeLabel} ({dataType})</span>}
      {onDelete && (
        <button
          onClick={() => onDelete(id)}
          style={{
            marginLeft: '10px',
            background: 'none',
            border: 'none',
            color: 'red',
            cursor: 'pointer',
            fontSize: '12px',
          }}
        >
          &times;
        </button>
      )}
    </div>
  );
};

export default Port;