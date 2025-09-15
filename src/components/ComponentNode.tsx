/**
 * @fileoverview Componente visual que representa un nodo (componente EDROOM) en el diagrama.
 * Muestra el nombre, el nodo lógico y los puertos del componente.
 */

import React, { memo, useCallback } from 'react';
import { Handle, Position } from 'reactflow';
import type { NodeProps } from 'reactflow';
import type { NodeData, PortData } from './types';
import '../types/ComponentNode.css';

/**
 * Props para el componente ComponentNode.
 * @interface ComponentNodeProps
 */
interface ComponentNodeProps extends NodeProps<NodeData> {
    /** Función para eliminar un puerto del nodo. */
    onDeletePort: (nodeId: string, portId: string) => void;
    /** Función que se ejecuta al hacer clic en un puerto. */
    onPortClick: (portData: PortData, nodeId: string) => void;
}

/**
 * Componente que renderiza la representación visual de un nodo en el diagrama.
 * @param {ComponentNodeProps} props - Las props del componente.
 * @returns {React.ReactElement} El elemento del nodo.
 */
const ComponentNode: React.FC<ComponentNodeProps> = memo(({ id, data, onDeletePort, onPortClick }) => {

    /**
     * Determina si un puerto de comunicación es de origen ('source') o de destino ('target')
     * para el handle de React Flow.
     * @param {PortData} port - El puerto a evaluar.
     * @returns {'source' | 'target' | undefined} El tipo de handle.
     */
    const getHandleType = useCallback((port: PortData) => {
        if (port.type === 'comunicacion' && port.subtype === 'nominal') {
            return 'source';
        } else if (port.type === 'comunicacion' && port.subtype === 'conjugado') {
            return 'target';
        }
        return undefined;
    }, []);

    return (
        <div className="component-node">
            <div className="component-node-header">
                {data.node && <span className="node-tag">{data.node} ::</span>}
                {data.isTop && <span className="top-component-tag">👑</span>}
                <span className="component-name-label">{data.name}</span>
                <span className="component-class-label">[{data.componentClass}]</span>
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