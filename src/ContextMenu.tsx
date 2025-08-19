import React, { useState, useCallback, useRef, useEffect } from 'react';
import './ContextMenu.css';

interface ContextMenuProps {
    x: number;
    y: number;
    onAddPort: (name: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'nominal' | 'conjugado' | undefined, dataType: string) => void;
    onRename: (newName: string) => void;
    onClose: () => void;
    dataTypes: string[];
    onAssignNode: (nodeName: string) => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onAddPort, onRename, onClose, dataTypes, onAssignNode }) => {
    const [addPortVisible, setAddPortVisible] = useState(false);
    const [addNodeVisible, setAddNodeVisible] = useState(false);
    const [portName, setPortName] = useState('');
    const [portType, setPortType] = useState<'comunicacion' | 'tiempo' | 'interrupcion'>('comunicacion');
    const [portSubtype, setPortSubtype] = useState<'nominal' | 'conjugado' | undefined>('nominal');
    const [dataType, setDataType] = useState(dataTypes[0] || 'int');
    const [newDataType, setNewDataType] = useState('');
    const [componentName, setComponentName] = useState('');
    const [nodeName, setNodeName] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);

    const handleAddPortClick = () => {
        if (!portName || !dataType) {
            alert('Por favor, ingresa un nombre y tipo de dato para el puerto.');
            return;
        }
        onAddPort(portName, portType, portSubtype, dataType === 'other' && newDataType ? newDataType : dataType);
        resetMenu();
    };

    const handleRenameClick = () => {
        if (!componentName) return;
        onRename(componentName);
    };

    const handleAssignNodeClick = () => {
        if (!nodeName) return;
        onAssignNode(nodeName);
        resetMenu();
    };

    const resetMenu = () => {
        setAddPortVisible(false);
        setAddNodeVisible(false);
        setPortName('');
        setPortType('comunicacion');
        setPortSubtype('nominal');
        setDataType(dataTypes[0] || 'int');
        setNewDataType('');
        setComponentName('');
        setNodeName('');
        onClose();
    };

    const handleBackdropClick = useCallback((event: Event) => {
        if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
            onClose();
        }
    }, [onClose]);

    useEffect(() => {
        document.addEventListener('mousedown', handleBackdropClick);
        return () => {
            document.removeEventListener('mousedown', handleBackdropClick);
        };
    }, [handleBackdropClick]);

    return (
        <div className="context-menu-backdrop">
            <div ref={menuRef} className="context-menu" style={{ top: y, left: x }}>
                {!addPortVisible && !addNodeVisible ? (
                    <>
                        <h4>Acciones</h4>
                        <ul>
                            <li onClick={() => setAddPortVisible(true)}>Añadir Puerto</li>
                            <li onClick={() => setAddNodeVisible(true)}>Asignar Nodo</li>
                            <li>
                                <input
                                    type="text"
                                    placeholder="Renombrar componente"
                                    value={componentName}
                                    onChange={(e) => setComponentName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleRenameClick()}
                                />
                                <button onClick={handleRenameClick}>Renombrar</button>
                            </li>
                        </ul>
                    </>
                ) : null}

                {addPortVisible && (
                    <>
                        <h4>Añadir Puerto</h4>
                        <ul>
                            <li>
                                <input
                                    type="text"
                                    placeholder="Nombre del puerto"
                                    value={portName}
                                    onChange={(e) => setPortName(e.target.value)}
                                />
                            </li>
                            <li>
                                <label htmlFor="port-type-select" className="visually-hidden">Tipo de puerto</label>
                                <select 
                                    id="port-type-select" 
                                    value={portType} 
                                    onChange={(e) => {
                                        const newType = e.target.value as 'comunicacion' | 'tiempo' | 'interrupcion';
                                        setPortType(newType);
                                        if (newType !== 'comunicacion') {
                                            setPortSubtype(undefined);
                                        }
                                    }}
                                >
                                    <option value="comunicacion">Comunicación</option>
                                    <option value="tiempo">Tiempo</option>
                                    <option value="interrupcion">Interrupción</option>
                                </select>
                            </li>
                            {portType === 'comunicacion' && (
                                <li>
                                    <label htmlFor="port-subtype-select" className="visually-hidden">Subtipo de puerto</label>
                                    <select 
                                        id="port-subtype-select" 
                                        value={portSubtype} 
                                        onChange={(e) => setPortSubtype(e.target.value as 'nominal' | 'conjugado')}
                                    >
                                        <option value="nominal">Nominal (salida)</option>
                                        <option value="conjugado">Conjugado (entrada)</option>
                                    </select>
                                </li>
                            )}
                            <li>
                                <label htmlFor="port-data-type-select" className="visually-hidden">Tipo de dato</label>
                                <select 
                                    id="port-data-type-select" 
                                    value={dataType} 
                                    onChange={(e) => setDataType(e.target.value)}
                                >
                                    {dataTypes.map(dt => (
                                        <option key={dt} value={dt}>{dt}</option>
                                    ))}
                                    <option value="other">Otro...</option>
                                </select>
                            </li>
                            {dataType === 'other' && (
                                <li>
                                    <input
                                        type="text"
                                        placeholder="Nuevo tipo de dato"
                                        value={newDataType}
                                        onChange={(e) => setNewDataType(e.target.value)}
                                    />
                                </li>
                            )}
                            <li>
                                <button onClick={handleAddPortClick}>Confirmar</button>
                            </li>
                        </ul>
                    </>
                )}

                {addNodeVisible && (
                    <>
                        <h4>Asignar Nodo</h4>
                        <ul>
                            <li>
                                <input
                                    type="text"
                                    placeholder="Nombre del nodo"
                                    value={nodeName}
                                    onChange={(e) => setNodeName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAssignNodeClick()}
                                />
                            </li>
                            <li>
                                <button onClick={handleAssignNodeClick}>Confirmar</button>
                            </li>
                        </ul>
                    </>
                )}
            </div>
        </div>
    );
};

export default ContextMenu;