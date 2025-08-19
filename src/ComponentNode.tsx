import React from 'react';
import type { NodeProps } from 'reactflow';
import Port from './Port';

interface PortData {
  id: string;
  name: string;
  type: 'comunicacion' | 'tiempo' | 'interrupcion';
  dataType: string;
  subtype?: 'normal' | 'conjugado';
}

interface NodeData {
  name: string;
  ports: PortData[];
  node?: string;
}

interface ComponentNodeProps extends NodeProps<NodeData> {
  onDeletePort: (nodeId: string, portId: string) => void;
  nodeColors: Record<string, string>;
}

const ComponentNode: React.FC<ComponentNodeProps> = ({ id, data, onDeletePort, nodeColors }) => {
  const normalPorts = data.ports.filter(p => p.type === 'comunicacion' && p.subtype === 'normal');
  const conjugatedPorts = data.ports.filter(p => p.type === 'comunicacion' && p.subtype === 'conjugado');
  const timePorts = data.ports.filter(p => p.type === 'tiempo');
  const interruptPorts = data.ports.filter(p => p.type === 'interrupcion');

  const backgroundColor = data.node ? nodeColors[data.node] || '#f5f5f5' : '#f5f5f5';

  return (
    <div
      style={{
        border: '2px solid #555',
        borderRadius: '8px',
        padding: '10px',
        backgroundColor: backgroundColor,
        textAlign: 'center',
        minWidth: '200px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>
        {data.name}
        {data.node && <div style={{ fontSize: '10px', color: '#666' }}>({data.node})</div>}
      </div>
      
      {/* Puertos de Comunicación */}
      <div style={{ borderBottom: '1px solid #ddd', paddingBottom: '10px', marginBottom: '10px' }}>
        {conjugatedPorts.map(p => (
          <Port key={p.id} id={p.id} type={p.type} subtype={p.subtype} label={p.name} dataType={p.dataType} onDelete={() => onDeletePort(id, p.id)} />
        ))}
        {normalPorts.map(p => (
          <Port key={p.id} id={p.id} type={p.type} subtype={p.subtype} label={p.name} dataType={p.dataType} onDelete={() => onDeletePort(id, p.id)} />
        ))}
      </div>

      {/* Puertos de Tiempo e Interrupción */}
      <div style={{ marginTop: '10px', borderTop: '1px solid #ddd', paddingTop: '10px' }}>
        {timePorts.map(p => (
          <Port key={p.id} id={p.id} type={p.type} label={p.name} dataType={p.dataType} onDelete={() => onDeletePort(id, p.id)} />
        ))}
        {interruptPorts.map(p => (
          <Port key={p.id} id={p.id} type={p.type} label={p.name} dataType={p.dataType} onDelete={() => onDeletePort(id, p.id)} />
        ))}
      </div>
    </div>
  );
};

export default ComponentNode;