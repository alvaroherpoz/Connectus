/**
 * ComponentNode.tsx
 * Componente visual que representa un nodo en el diagrama.
 * Muestra los puertos, permite eliminarlos y acceder a su información.
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData, PortData } from './types';
import '../types/ComponentNode.css';

/**
 * Props del componente ComponentNode.
 */
interface ComponentNodeProps extends NodeProps<NodeData> {
    onDeletePort: (nodeId: string, portId: string) => void;
    onPortClick: (portData: PortData, nodeId: string) => void;
}

/**
 * Componente visual para un nodo del diagrama.
 */
const ComponentNode: React.FC<ComponentNodeProps> = memo(({ id, data, onDeletePort, onPortClick }) => {

    /**
     * Determina el tipo de handle para el puerto (source/target).
     */
    const getHandleType = useCallback((port: PortData) => {
        if (port.type === 'comunicacion' && port.subtype === 'nominal') {
            return 'source';
        } else if (port.type === 'comunicacion' && port.subtype === 'conjugado') {
            return 'target';
        }
        return undefined;
    }, []);

    // Renderizado del nodo y sus puertos
    return (
        <div className="component-node">
            <div className="component-node-header">
                {data.node && <span className="node-tag">{data.node} ::</span>}
                {data.isTop && <span className="top-component-tag">👑</span>}
                <span className="component-name-label">{data.name}</span>
            </div>
            <div className="component-node-ports-container">
                {data.ports.length > 0 && (
                    <div className="ports-list">
                        {data.ports.map((port) => (
                            <div key={port.id} className="port-item">
                                <div
                                    className="port-item-info"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onPortClick(port, id);
                                    }}
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