import React from 'react';
import { Handle, Position } from 'reactflow';
import './ComponentNode.css'; 
import type { NodeProps, Edge, PortData } from './types'; 

interface ComponentNodeProps extends NodeProps {
    onDeletePort: (nodeId: string, portId: string) => void;
    onDeleteConnection: (edgeId: string) => void;
    nodeColors: Record<string, string>;
    edges: Edge[];
}

const ComponentNode: React.FC<ComponentNodeProps> = ({ id, data, onDeletePort, onDeleteConnection, nodeColors, edges }) => {
    const nodeColor = data.node ? nodeColors[data.node] : '#fff';
    const borderColor = data.node ? 'black' : '#ccc';

    const portHandleStyle = (type: string, subtype: string | undefined): React.CSSProperties => {
        let color = '#555';
        if (type === 'comunicacion') {
            color = subtype === 'nominal' ? '#ffc107' : '#007bff';
        } else if (type === 'tiempo') {
            color = '#ffaa00';
        } else if (type === 'interrupcion') {
            color = '#8e44ad';
        }
        return {
            background: color,
            borderColor: color,
        };
    };

    return (
        <div 
            className="component-node-container" 
            style={{ 
                border: `1px solid ${borderColor}`,
                backgroundColor: nodeColor 
            }}
        >
            <strong className="node-name">{data.name}</strong>
            {data.node && (
                <div className="node-label">
                    Nodo: {data.node}
                </div>
            )}
            <div className="ports-container">
                {data.ports.map((port: PortData) => {
                    const existingConnection = edges.find(
                        (edge) => edge.sourceHandle === port.id || edge.targetHandle === port.id
                    );

                    const handleClick = () => {
                        if (existingConnection) {
                            onDeleteConnection(existingConnection.id);
                        }
                    };

                    return (
                        <div key={port.id} className="port-item">
                            <span>{port.name} <em className="port-type-info">({port.dataType})</em></span>
                            <div className="port-actions">
                                <span className="port-subtype">
                                    {port.type === 'comunicacion' ? (port.subtype === 'nominal' ? 'Nominal' : 'Conjugado') : port.type}
                                </span>
                                <button
                                    onClick={() => onDeletePort(id, port.id)}
                                    className="delete-button"
                                >
                                    X
                                </button>
                            </div>
                            {port.subtype === 'nominal' && (
                                <Handle
                                    type="source"
                                    position={Position.Right}
                                    id={port.id}
                                    className="handle-style"
                                    style={portHandleStyle(port.type, port.subtype)}
                                    onClick={handleClick}
                                />
                            )}
                            {port.subtype === 'conjugado' && (
                                <Handle
                                    type="target"
                                    position={Position.Left}
                                    id={port.id}
                                    className="handle-style"
                                    style={portHandleStyle(port.type, port.subtype)}
                                    onClick={handleClick}
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default ComponentNode;