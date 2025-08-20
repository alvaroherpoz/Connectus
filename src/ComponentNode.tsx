import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData, PortData } from './types';
import './ComponentNode.css';

interface ComponentNodeProps extends NodeProps<NodeData> {
  onDeletePort: (nodeId: string, portId: string) => void;
  onPortClick: (portData: PortData) => void;
  nodeColors: Record<string, string>;
}

const ComponentNode: React.FC<ComponentNodeProps> = memo(({ id, data, onDeletePort, onPortClick, nodeColors }) => {

  const getColor = (nodeName: string) => {
    return nodeColors[nodeName] || '#999';
  };

  const nodeStyle = data.node ? { backgroundColor: getColor(data.node) } : {};

  const getHandleType = useCallback((port: PortData) => {
    if (port.type === 'comunicacion' && port.subtype === 'nominal') {
      return 'source';
    } else if (port.type === 'comunicacion' && port.subtype === 'conjugado') {
      return 'target';
    }
    return undefined;
  }, []);

  const handlePortClick = useCallback((portData: PortData) => {
    onPortClick(portData);
  }, [onPortClick]);
  
  return (
    <div className="component-node" style={nodeStyle}>
      <div className="component-node-header">
        {data.node && <span className="node-tag">{data.node} ::</span>}
        <span className="component-name-label">{data.name}</span>
      </div>
      <div className="component-node-ports-container">
        {data.ports.length > 0 && (
          <div className="ports-list">
            {data.ports.map((port) => (
              <div key={port.id} className="port-item">
                <div 
                  className="port-item-info"
                  onClick={() => handlePortClick(port)}
                >
                  <span className="port-name">{port.name}</span>
                  <span className="port-type-tag">({port.type})</span>
                </div>
                {getHandleType(port) && (
                  <Handle
                    type={getHandleType(port) as "source" | "target"}
                    position={getHandleType(port) === 'source' ? Position.Right : Position.Left}
                    id={port.id}
                    className={`custom-handle ${getHandleType(port)}`}
                  />
                )}
                <button className="delete-port-button" onClick={() => onDeletePort(id, port.id)}>
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ComponentNode;