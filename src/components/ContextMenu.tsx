/**
 * ContextMenu.tsx
 * Menú contextual para realizar acciones sobre nodos y puertos en el diagrama.
 * Permite añadir puertos, generar puertos conjugados, editar atributos y eliminar componentes.
 */

import React, { useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Message, Node, NodeData, MessageType, PortData } from './types';
import '../types/ContextMenu.css';

/**
 * Props del componente ContextMenu.
 */
interface ContextMenuProps {
    x: number;
    y: number;
    // CORRECCIÓN: Ahora onAddPort acepta el nodeId como primer parámetro
    onAddPort: (nodeId: string, name: string, portId: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype?: 'nominal' | 'conjugado', protocolName?: string, messages?: Message[], interruptHandler?: string) => void;
    // Modificamos onAddConjugatePort para que acepte el 'id' y el 'name' del nuevo puerto conjugado
    onAddConjugatePort: (nodeId: string, nominalPortId: string, newConjugatePortId: string, newConjugatePortName: string) => void;
    onClose: () => void;
    handleAddDataType: (newType: string) => void;
    nodes: Node<NodeData>[];
    nodeId: string;
    onDeleteNode: (nodeId: string) => void;
    onEditAttributes: () => void;
    dataTypes: string[];
    setNotification: (notification: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

/**
 * Tipos de datos Basicos de EDROOM.
 */
const fixedDataTypesList = [
    'CDEventList', 'CDRecovAction', 'CDSensorTMBufferStatus', 'CDTCDescriptor', 'CDTMList',
    'CDTMMemory', 'Pr_Time', 'TEDROOMBool', 'TEDROOMByte', 'TEDROOMDouble', 'TEDROOMFloat', 'TEDROOMInt8',
    'TEDROOMInt16', 'TEDROOMInt32', 'TEDROOMInt64', 'TEDROOMUInt8', 'TEDROOMUInt16', 'TEDROOMUInt32',
    'TEDROOMUInt64', 'TEDROOMWord16', 'TEDROOMWord32', 'TEDROOMWord64'
];

/**
 * Menú contextual para acciones sobre nodos y puertos.
 */
const ContextMenu: React.FC<ContextMenuProps> = ({
    x, y, onAddPort, onAddConjugatePort, onClose, handleAddDataType,
    nodes, nodeId, onDeleteNode, onEditAttributes, dataTypes, setNotification
}) => {
    // Estado interno para la vista actual y datos de formularios
    const [view, setView] = useState<'main' | 'addPort' | 'generateConjugate'>('main');
    const [portId, setPortId] = useState(''); // Estado para el nuevo ID del puerto
    const [portName, setPortName] = useState('');
    const [portType, setPortType] = useState<'comunicacion' | 'tiempo' | 'interrupcion'>('comunicacion');
    const [protocolName, setProtocolName] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageSignal, setMessageSignal] = useState('');
    const [messageDataType, setMessageDataType] = useState('');
    const [messageDirection, setMessageDirection] = useState<'entrada' | 'salida'>('entrada');
    const [messageType, setMessageType] = useState<MessageType>('invoke');
    const [interruptHandler, setInterruptHandler] = useState('');
    const [selectedNominalPort, setSelectedNominalPort] = useState<string | null>(null);
    const [newConjugatePortName, setNewConjugatePortName] = useState('');
    const [newConjugatePortId, setNewConjugatePortId] = useState(''); // Estado para el ID del nuevo puerto conjugado
    const [newDataTypeName, setNewDataTypeName] = useState('');
    const [showNewDataTypeInput, setShowNewDataTypeInput] = useState(false);

    /**
     * Añade un mensaje al puerto de comunicación.
     */
    const handleAddMessage = useCallback(() => {
        // Si el tipo de mensaje es 'reply', validamos que exista un 'invoke' con la misma señal
        if (messageType === 'reply') {
            const invokeExists = messages.some(msg =>
                msg.type === 'invoke' && msg.signal === messageSignal
            );
            if (!invokeExists) {
                setNotification({ message: 'Un mensaje de tipo "reply" requiere un mensaje "invoke" con la misma señal.', type: 'error' });
                return;
            }
        }
    
        if (messageSignal && messageDataType) {
            setMessages((prevMessages) => [...prevMessages, { signal: messageSignal, dataType: messageDataType, direction: messageDirection, type: messageType }]);
            setMessageSignal('');
            setMessageDataType('');
            setNotification(null);
        }
    }, [messageSignal, messageDataType, messageDirection, messageType, messages, setNotification]);

    /**
     * Elimina un mensaje del listado.
     */
    const handleRemoveMessage = useCallback((index: number) => {
        setMessages((prevMessages) => prevMessages.filter((_, i) => i !== index));
    }, []);

    /**
     * Añade un nuevo tipo de dato personalizado.
     */
    const handleAddNewDataType = useCallback(() => {
        if (newDataTypeName.trim()) {
            handleAddDataType(newDataTypeName.trim());
            setMessageDataType(newDataTypeName.trim());
            setNewDataTypeName('');
            setShowNewDataTypeInput(false);
        }
    }, [newDataTypeName, handleAddDataType, setMessageDataType]);

    /**
     * Cambia el tipo de dato seleccionado para el mensaje.
     */
    const handleDataTypeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        const selectedType = e.target.value;
        if (selectedType === 'other') {
            setShowNewDataTypeInput(true);
            setMessageDataType('');
        } else {
            setShowNewDataTypeInput(false);
            setMessageDataType(selectedType);
        }
    }, []);

    /**
     * Envía el formulario para añadir un puerto.
     */
    const handleSubmitPort = useCallback((e: FormEvent) => {
        e.preventDefault();
        
        const trimmedId = portId.trim();
        const trimmedName = portName.trim();
        const trimmedProtocolName = protocolName.trim();

        // Validación 1: ID y nombre no vacíos y el ID solo contiene números
        if (!trimmedId || !/^\d+$/.test(trimmedId)) {
            setNotification({ message: 'El ID del puerto es obligatorio y debe contener solo números.', type: 'error' });
            return;
        }
        if (!trimmedName) {
            setNotification({ message: 'El nombre del puerto es obligatorio.', type: 'error' });
            return;
        }

        // Validación 2: El nombre del protocolo es obligatorio para puertos de comunicación
        if (portType === 'comunicacion' && !trimmedProtocolName) {
            setNotification({ message: 'El nombre del protocolo es obligatorio para puertos de comunicación.', type: 'error' });
            return;
        }

        // Validación 3: Unicidad del ID y nombre a nivel de PROTOCOLO
        const isDuplicateInProtocol = nodes.some(node =>
            node.data.ports.some(p =>
                (p.protocolName === trimmedProtocolName) && // Mismo protocolo
                (p.id === trimmedId) // Mismo ID
            )
        );

        if (isDuplicateInProtocol) {
            setNotification({ message: `Ya existe un puerto con el ID "${trimmedId}" en el protocolo "${trimmedProtocolName}".`, type: 'error' });
            return;
        }

        const isDuplicateName = nodes.some(node =>
            node.data.ports.some(p =>
                (p.protocolName === trimmedProtocolName) && // Mismo protocolo
                (p.name === trimmedName) // Mismo nombre
            )
        );

        if (isDuplicateName) {
            setNotification({ message: `Ya existe un puerto con el nombre "${trimmedName}" en el protocolo "${trimmedProtocolName}".`, type: 'error' });
            return;
        }
        
        // Si todas las validaciones pasan, se procede a añadir el puerto
        onAddPort(nodeId, trimmedName, trimmedId, portType, 'nominal', trimmedProtocolName, messages, interruptHandler);
        onClose();
    }, [onAddPort, portId, portName, portType, protocolName, messages, interruptHandler, onClose, nodes, nodeId, setNotification]);

    /**
     * Genera un puerto conjugado a partir de un puerto nominal seleccionado.
     */
    const handleGenerateConjugate = useCallback(() => {
        if (!selectedNominalPort) {
            setNotification({ message: 'Por favor, selecciona un puerto nominal.', type: 'error' });
            return;
        }
        
        const nominalPort = nodes.flatMap(n => n.data.ports).find(p => p.id === selectedNominalPort);
        if (!nominalPort) {
            setNotification({ message: 'No se encontró el puerto nominal seleccionado.', type: 'error' });
            return;
        }

        const trimmedId = newConjugatePortId.trim();
        const trimmedName = newConjugatePortName.trim();

        // Validación 1: ID y nombre no vacíos y el ID solo contiene números
        if (!trimmedId || !/^\d+$/.test(trimmedId)) {
            setNotification({ message: 'El ID del nuevo puerto debe contener solo números.', type: 'error' });
            return;
        }
        if (!trimmedName) {
            setNotification({ message: 'El nombre del nuevo puerto es obligatorio.', type: 'error' });
            return;
        }

        // Validación 2: Unicidad del ID y nombre a nivel de PROTOCOLO
        const isDuplicateInProtocol = nodes.some(node =>
            node.data.ports.some(p =>
                (p.protocolName === nominalPort.protocolName) && // Mismo protocolo que el nominal
                (p.id === trimmedId) // Mismo ID
            )
        );

        if (isDuplicateInProtocol) {
            setNotification({ message: `Ya existe un puerto con el ID "${trimmedId}" en el protocolo "${nominalPort.protocolName}".`, type: 'error' });
            return;
        }

        const isDuplicateName = nodes.some(node =>
            node.data.ports.some(p =>
                (p.protocolName === nominalPort.protocolName) && // Mismo protocolo que el nominal
                (p.name === trimmedName) // Mismo nombre
            )
        );

        if (isDuplicateName) {
            setNotification({ message: `Ya existe un puerto con el nombre "${trimmedName}" en el protocolo "${nominalPort.protocolName}".`, type: 'error' });
            return;
        }

        // Si todas las validaciones pasan, se procede a crear el puerto conjugado
        onAddConjugatePort(nodeId, selectedNominalPort, trimmedId, trimmedName);
        onClose();
    }, [onAddConjugatePort, nodeId, selectedNominalPort, onClose, nodes, setNotification, newConjugatePortId, newConjugatePortName]);

    /**
     * Renderiza la vista principal del menú.
     */
    const renderMainView = () => (
        <>
            <button onClick={() => { setNotification(null); setView('addPort'); }}>Añadir Puerto</button>
            <button onClick={() => {
                const nominalPorts = nodes.flatMap(node =>
                    node.data.ports.filter(port => port.type === 'comunicacion' && port.subtype === 'nominal')
                );
                if (nominalPorts.length === 0) {
                    setNotification({ message: 'No hay puertos nominales para crear un puerto conjugado.', type: 'error' });
                } else {
                    setNotification(null);
                    setView('generateConjugate');
                }
            }}>Crear Puerto Conjugado</button>
            <button onClick={() => { setNotification(null); onEditAttributes(); }}>Editar Atributos</button>
            <button onClick={() => onDeleteNode(nodeId)}>Eliminar Componente</button>
        </>
    );

    /**
     * Renderiza el formulario para añadir un puerto.
     */
    const renderAddPortView = () => (
        <form onSubmit={handleSubmitPort}>
            <label>
                ID del Puerto:
                <input
                    type="text"
                    value={portId}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => { setPortId(e.target.value); setNotification(null); }}
                    required
                />
            </label>
            <label>
                Nombre del Puerto:
                <input type="text" value={portName} onChange={(e: ChangeEvent<HTMLInputElement>) => { setPortName(e.target.value); setNotification(null); }} required />
            </label>
            <label htmlFor="port-type">
                Tipo de Puerto:
                <select id="port-type" value={portType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPortType(e.target.value as 'comunicacion' | 'tiempo' | 'interrupcion')} title="Tipo de Puerto">
                    <option value="comunicacion">Comunicación</option>
                    <option value="tiempo">Tiempo</option>
                    <option value="interrupcion">Interrupción</option>
                </select>
            </label>
            {portType === 'comunicacion' && (
                <>
                    <label>
                        Nombre del Protocolo:
                        <input
                            type="text"
                            value={protocolName}
                            onChange={(e: ChangeEvent<HTMLInputElement>) => { setProtocolName(e.target.value); setNotification(null); }}
                            required
                        />
                    </label>
                    <div>
                        <h4>Mensajes</h4>
                        {messages.length > 0 && (
                            <div className="message-list">
                                {messages.map((msg, index) => (
                                    <div key={index} className="message-item">
                                        <span>{msg.signal} - {msg.dataType} ({msg.direction}) [{msg.type}]</span>
                                        <button type="button" onClick={() => handleRemoveMessage(index)} className="delete-message-btn">X</button>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="add-message-container">
                            <input
                                id="message-signal"
                                type="text"
                                placeholder="Señal"
                                value={messageSignal}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setMessageSignal(e.target.value)}
                            />
                            <select id="message-data-type" value={messageDataType} onChange={handleDataTypeChange} title="Tipo de Dato">
                                <option value="">Tipo de Dato</option>
                                <option value="void">void (sin dato)</option>
                                {fixedDataTypesList.map((dt) => (
                                    <option key={dt} value={dt}>{dt}</option>
                                ))}
                                {dataTypes.map((dt) => (
                                    <option key={dt} value={dt}>{dt}</option>
                                ))}
                                <option value="other">Otro tipo de dato...</option>
                            </select>
                            <select id="message-direction" value={messageDirection} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageDirection(e.target.value as 'entrada' | 'salida')} title="Dirección del Mensaje">
                                <option value="entrada">Entrada</option>
                                <option value="salida">Salida</option>
                            </select>
                            <select id="message-type" value={messageType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageType(e.target.value as MessageType)} title="Tipo de Mensaje">
                                <option value="invoke">invoke</option>
                                <option value="async">async</option>
                                <option value="reply" disabled={!messages.some(msg => msg.type === 'invoke')}>reply</option>
                            </select>
                            <button type="button" onClick={handleAddMessage}>Añadir</button>
                        </div>
                        {showNewDataTypeInput && (
                            <div className="add-data-type-container">
                                <input
                                    type="text"
                                    placeholder="Nuevo Tipo de Dato"
                                    value={newDataTypeName}
                                    onChange={(e) => setNewDataTypeName(e.target.value)}
                                />
                                <button type="button" onClick={handleAddNewDataType}>Añadir Tipo</button>
                            </div>
                        )}
                    </div>
                </>
            )}
            {portType === 'interrupcion' && (
                <label htmlFor="interrupt-handler">
                    Handler:
                    <textarea id="interrupt-handler" value={interruptHandler} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setInterruptHandler(e.target.value)} />
                </label>
            )}
            <button type="submit">Añadir Puerto</button>
            <button type="button" onClick={() => { setNotification(null); setView('main'); }}>Volver</button>
        </form>
    );

    /**
     * Renderiza el formulario para generar un puerto conjugado.
     */
    const renderGenerateConjugateView = () => {
        const nominalPorts = nodes.flatMap(node =>
            node.data.ports
                .filter(port => port.type === 'comunicacion' && port.subtype === 'nominal')
                .map(port => ({ ...port, componentName: node.data.name }))
        );

        return (
            <div>
                <h4>Crear Puerto Conjugado</h4>
                <label htmlFor="nominal-port-select">Puerto Nominal de Origen:</label>
                <select id="nominal-port-select" onChange={(e) => { setSelectedNominalPort(e.target.value); setNewConjugatePortId(''); setNewConjugatePortName(''); setNotification(null); }} value={selectedNominalPort || ""} title="Seleccionar puerto nominal">
                    <option value="">Selecciona un puerto...</option>
                    {nominalPorts.map(port => (
                        <option key={port.id} value={port.id}>
                            {port.componentName} - {port.name} ({port.protocolName})
                        </option>
                    ))}
                </select>
                {selectedNominalPort && (
                    <>
                        <label htmlFor="new-conjugate-id">ID del Nuevo Puerto:</label>
                        <input
                            id="new-conjugate-id"
                            type="text"
                            value={newConjugatePortId}
                            onChange={(e) => setNewConjugatePortId(e.target.value)}
                            placeholder="Ej. 101"
                        />
                        <label htmlFor="new-conjugate-name">Nombre del Nuevo Puerto:</label>
                        <input
                            id="new-conjugate-name"
                            type="text"
                            value={newConjugatePortName}
                            onChange={(e) => setNewConjugatePortName(e.target.value)}
                            placeholder="Ej. PuertaDeEntrada"
                        />
                    </>
                )}
                <button onClick={handleGenerateConjugate} disabled={!selectedNominalPort || !newConjugatePortId.trim() || !newConjugatePortName.trim()}>Crear</button>
                <button onClick={() => { setNotification(null); setView('main'); }}>Volver</button>
            </div>
        );
    };

    // Renderizado principal del menú contextual
    return (
        <div className="context-menu" style={{ top: y, left: x }}>
            {view === 'main' && renderMainView()}
            {view === 'addPort' && renderAddPortView()}
            {view === 'generateConjugate' && renderGenerateConjugateView()}
            <button className="bottom-close-button" onClick={() => { setNotification(null); onClose(); }}>Cerrar</button>
        </div>
    );
};

export default ContextMenu;