/**
 * @fileoverview Menú contextual para realizar acciones sobre los nodos del diagrama.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Message, Node, NodeData, MessageType} from './types';
import '../types/ContextMenu.css';

/**
 * Props para el componente ContextMenu.
 * @interface ContextMenuProps
 */
interface ContextMenuProps {
    /** Coordenada X para posicionar el menú. */
    x: number;
    /** Coordenada Y para posicionar el menú. */
    y: number;
    /** Función para añadir un puerto al nodo. */
    onAddPort: (nodeId: string, name: string, portId: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype?: 'nominal' | 'conjugado', protocolName?: string, messages?: Message[]) => void;
    /** Función para añadir un puerto conjugado a partir de uno nominal. */
    onAddConjugatePort: (targetNodeId: string, compositeNominalPortId: string, newConjugatePortId: string, newConjugatePortName: string) => void;
    /** Función para cerrar el menú. */
    onClose: () => void;
    /** Función para añadir un nuevo tipo de dato personalizado. */
    handleAddDataType: (newType: string) => void;
    /** Array de todos los nodos del diagrama. */
    nodes: Node<NodeData>[];
    /** ID del nodo sobre el que se ha abierto el menú. */
    nodeId: string;
    /** Función para eliminar el nodo. */
    onDeleteNode: (nodeId: string) => void;
    /** Función para abrir el panel de edición de atributos del nodo. */
    onEditAttributes: () => void;
    /** Lista de tipos de datos personalizados. */
    dataTypes: string[];
    /** Función para mostrar notificaciones. */
    setNotification: (notification: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
}

/**
 * Lista de tipos de datos fijos y predefinidos en EDROOM.
 */
const fixedDataTypesList = [
    'CDEventList', 'CDRecovAction', 'CDSensorTMBufferStatus', 'CDTCDescriptor', 'CDTMList',
    'CDTMMemory', 'Pr_Time', 'TEDROOMBool', 'TEDROOMByte', 'TEDROOMDouble', 'TEDROOMFloat', 'TEDROOMInt8',
    'TEDROOMInt16', 'TEDROOMInt32', 'TEDROOMInt64', 'TEDROOMUInt8', 'TEDROOMUInt16', 'TEDROOMUInt32',
    'TEDROOMUInt64', 'TEDROOMWord16', 'TEDROOMWord32', 'TEDROOMWord64'
];

/**
 * Componente que renderiza un menú contextual con opciones para un nodo.
 * @param {ContextMenuProps} props - Las props del componente.
 * @returns {React.ReactElement} El menú contextual.
 */
const ContextMenu: React.FC<ContextMenuProps> = ({
    x, y, onAddPort, onAddConjugatePort, onClose, handleAddDataType,
    nodes, nodeId, onDeleteNode, onEditAttributes, dataTypes, setNotification
}) => {
    const [view, setView] = useState<'main' | 'addPort' | 'generateConjugate'>('main');
    const [portId, setPortId] = useState('');
    const [portName, setPortName] = useState('');
    const [portType, setPortType] = useState<'comunicacion' | 'tiempo' | 'interrupcion'>('comunicacion');
    const [selectedProtocol, setSelectedProtocol] = useState('');
    const [newProtocolName, setNewProtocolName] = useState('');
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageSignal, setMessageSignal] = useState('');
    const [messageDataType, setMessageDataType] = useState('');
    const [messageDirection, setMessageDirection] = useState<'entrada' | 'salida'>('entrada');
    const [messageType, setMessageType] = useState<MessageType>('invoke');
    const [selectedInvokeSignal, setSelectedInvokeSignal] = useState('');
    const [selectedNominalPort, setSelectedNominalPort] = useState<string | null>(null);
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [newConjugatePortName, setNewConjugatePortName] = useState('');
    const [newConjugatePortId, setNewConjugatePortId] = useState('');
    const [newDataTypeName, setNewDataTypeName] = useState('');
    const [showNewDataTypeInput, setShowNewDataTypeInput] = useState(false);

    const existingProtocols = useMemo(() => {
        const protocols = new Set<string>();
        nodes.forEach(node => {
            node.data.ports.forEach(port => {
                if (port.type === 'comunicacion' && port.protocolName) {
                    protocols.add(port.protocolName);
                }
            });
        });
        return Array.from(protocols).sort();
    }, [nodes]);

    const handleProtocolChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
        const protocol = e.target.value;
        setSelectedProtocol(protocol);
        setNotification(null);

        if (protocol && protocol !== 'new') { 
            const allMessages: Message[] = [];
            const signalNames = new Set<string>();
            nodes.forEach(node => {
                node.data.ports.forEach(port => {
                    if (port.protocolName === protocol && port.messages) {
                        port.messages.forEach(msg => {
                            if (!signalNames.has(msg.signal)) {
                                allMessages.push(msg);
                                signalNames.add(msg.signal);
                            }
                        });
                    }
                });
            });
            setMessages(allMessages); 
        } else {
            setMessages([]); 
        }
    }, [nodes, setNotification]);

    /**
     * Recopila todos los mensajes de tipo 'invoke' que existen en el protocolo actual,
     * tanto en el puerto que se está creando como en otros puertos del diagrama.
     * @returns {Message[]} Una lista de mensajes 'invoke'.
     */
    const getInvokeMessagesInProtocol = useCallback((): Message[] => {
        const invokes: Message[] = [];
        const invokeSignals = new Set<string>();

        messages.filter(m => m.type === 'invoke').forEach(m => {
            if (!invokeSignals.has(m.signal)) {
                invokes.push(m);
                invokeSignals.add(m.signal);
            }
        });
        return invokes;
    }, [messages]);

    /**
     * Añade un nuevo mensaje a la lista de mensajes del puerto que se está creando.
     * Realiza validaciones de unicidad y consistencia para los mensajes.
     */
    const handleAddMessage = useCallback(() => {
         if (!messageSignal || !messageDataType) {
             return;
         }
 
         const finalProtocolName = selectedProtocol === 'new' ? newProtocolName.trim() : selectedProtocol;
         const isSignalDuplicate = messages.some((m, index) => m.signal === messageSignal && index !== editingMessageIndex);

         if (isSignalDuplicate) {
            setNotification({ message: `Error: Ya existe un mensaje con la señal "${messageSignal}" en el protocolo "${finalProtocolName}".`, type: 'error' });
            return;
         }
 
         if (messageType === 'reply') {
            if (!selectedInvokeSignal) {
                setNotification({ message: 'Error: Debe seleccionar a qué mensaje "invoke" responde este "reply".', type: 'error' });
                return;
            }

            const invokeMessage = getInvokeMessagesInProtocol().find(m => m.signal === selectedInvokeSignal);
 
             if (!invokeMessage) {
                 setNotification({ message: `Error: No se encontró el "invoke" seleccionado.`, type: 'error' });
                 return;
             }
 
            if (invokeMessage.direction === messageDirection) {
                setNotification({ message: `Error: La dirección del "reply" (${messageDirection}) debe ser opuesta a la del "invoke" (${invokeMessage.direction}).`, type: 'error' });
                return;
            }
         }
 
         const newMessage: Message = { signal: messageSignal, dataType: messageDataType, direction: messageDirection, type: messageType };
         if (messageType === 'reply') {
            newMessage.invokeSignal = selectedInvokeSignal;
         }

         if (editingMessageIndex !== null) {
            const updatedMessages = [...messages];
            updatedMessages[editingMessageIndex] = newMessage;
            setMessages(updatedMessages);
            setNotification({ message: 'Mensaje actualizado.', type: 'info' });
         } else {
            setMessages(prev => [...prev, newMessage]);
            setNotification({ message: `Mensaje "${messageSignal}" listo para ser añadido.`, type: 'info' });
         }
         resetMessageForm();
     }, [messageSignal, messageDataType, messageDirection, messageType, messages, editingMessageIndex, selectedProtocol, newProtocolName, setNotification, getInvokeMessagesInProtocol, selectedInvokeSignal]);

    const resetMessageForm = () => {
        setMessageSignal('');
        setMessageDataType('');
        setMessageDirection('entrada');
        setMessageType('invoke');
        setSelectedInvokeSignal('');
        setEditingMessageIndex(null);
    };

    const handleEditMessage = useCallback((index: number) => {
        const messageToEdit = messages[index];
        setEditingMessageIndex(index);
        setMessageSignal(messageToEdit.signal);
        setMessageDataType(messageToEdit.dataType);
        setMessageDirection(messageToEdit.direction);
        setMessageType(messageToEdit.type);
        setSelectedInvokeSignal(messageToEdit.invokeSignal || '');
    }, [messages]);

    /**
     * Elimina un mensaje de la lista de mensajes del puerto.
     * @param {number} index - El índice del mensaje a eliminar.
     */
    const handleRemoveMessage = useCallback((index: number) => {
        const messageToDelete = messages[index];
        let updatedMessages = [...messages];

        if (messageToDelete.type === 'invoke') {
            const replyIndex = updatedMessages.findIndex(
                (msg, i) => i !== index && msg.type === 'reply' && msg.invokeSignal === messageToDelete.signal
            );

            if (replyIndex !== -1) {
                updatedMessages = updatedMessages.filter((_, i) => i !== index && i !== replyIndex);
            } else {
                updatedMessages = updatedMessages.filter((_, i) => i !== index);
            }
        } else {
            updatedMessages = updatedMessages.filter((_, i) => i !== index);
        }

        setMessages(updatedMessages);
        setNotification({ message: 'Mensaje eliminado de la lista.', type: 'info' });
        resetMessageForm();
    }, [messages, setNotification]);

    /**
     * Añade un nuevo tipo de dato a la lista global de tipos de datos personalizados.
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
     * Maneja el cambio en el selector de tipo de dato, mostrando un campo de texto
     * si se selecciona la opción "Otro tipo de dato...".
     * @param {ChangeEvent<HTMLSelectElement>} e - El evento de cambio.
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
     * Procesa y valida los datos del formulario para añadir un nuevo puerto.
     * @param {FormEvent} e - El evento del formulario.
     */
    const handleSubmitPort = useCallback((e: FormEvent) => {
        e.preventDefault();
        
        const trimmedId = portId.trim();
        const trimmedName = portName.trim();
        const finalProtocolName = (selectedProtocol === 'new' ? newProtocolName.trim() : selectedProtocol);

        if (!trimmedId || !/^\d+$/.test(trimmedId)) {
            setNotification({ message: 'El ID del puerto es obligatorio y debe contener solo números.', type: 'error' });
            return;
        }
        if (!trimmedName) {
            setNotification({ message: 'El nombre del puerto es obligatorio.', type: 'error' });
            return;
        }

        if (portType === 'comunicacion' && !finalProtocolName) {
            setNotification({ message: 'El nombre del protocolo es obligatorio para puertos de comunicación.', type: 'error' });
            return;
        }

        const targetNode = nodes.find(node => node.id === nodeId);
        if (!targetNode) return;

        const isDuplicateId = targetNode.data.ports.some(p => p.id === trimmedId);
        if (isDuplicateId) {
            setNotification({ message: `Ya existe un puerto con el ID "${trimmedId}" en este componente.`, type: 'error' });
            return;
        }

        const isDuplicateName = targetNode.data.ports.some(p => p.name === trimmedName);
        if (isDuplicateName) {
            setNotification({ message: `Ya existe un puerto con el nombre "${trimmedName}" en este componente.`, type: 'error' });
            return;
        }
        
        onAddPort(nodeId, trimmedName, trimmedId, portType, 'nominal', finalProtocolName, messages);
        onClose();
    }, [onAddPort, portId, portName, portType, selectedProtocol, newProtocolName, messages, onClose, nodes, nodeId, setNotification]);

    /**
     * Procesa y valida los datos para crear un puerto conjugado a partir de un
     * puerto nominal seleccionado.
     */
    const handleGenerateConjugate = useCallback(() => {
        if (!selectedNominalPort) {
            setNotification({ message: 'Por favor, selecciona un puerto nominal.', type: 'error' });
            return;
        }
        
        const [nominalNodeId, nominalPortId] = selectedNominalPort.split(':');
        const nominalNode = nodes.find(n => n.id === nominalNodeId);
        const nominalPort = nominalNode?.data.ports.find(p => p.id === nominalPortId);

        if (!nominalPort) {
            setNotification({ message: 'No se encontró el puerto nominal seleccionado.', type: 'error' });
            return;
        }

        const trimmedId = newConjugatePortId.trim();
        const trimmedName = newConjugatePortName.trim();

        if (!trimmedId || !/^\d+$/.test(trimmedId)) {
            setNotification({ message: 'El ID del nuevo puerto debe contener solo números.', type: 'error' });
            return;
        }
        if (!trimmedName) {
            setNotification({ message: 'El nombre del nuevo puerto es obligatorio.', type: 'error' });
            return;
        }

        const targetNode = nodes.find(node => node.id === nodeId);
        if (!targetNode) return;

        const isDuplicateId = targetNode.data.ports.some(p => p.id === trimmedId);
        if (isDuplicateId) {
            setNotification({ message: `Ya existe un puerto con el ID "${trimmedId}" en este componente.`, type: 'error' });
            return;
        }

        const isDuplicateName = targetNode.data.ports.some(p => p.name === trimmedName);
        if (isDuplicateName) {
            setNotification({ message: `Ya existe un puerto con el nombre "${trimmedName}" en este componente.`, type: 'error' });
            return;
        }

        onAddConjugatePort(nodeId, selectedNominalPort, trimmedId, trimmedName);
        onClose();
    }, [onAddConjugatePort, nodeId, selectedNominalPort, onClose, nodes, setNotification, newConjugatePortId, newConjugatePortName]);

    /**
     * Renderiza la vista principal del menú contextual con las acciones generales.
     * @returns {React.ReactElement}
     */
    const renderMainView = () => (
        <>
            <button onClick={() => { setNotification(null); setView('addPort'); }}>Crear Puerto</button>
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
            <button onClick={() => { setNotification(null); onEditAttributes(); }}>Propiedades</button>
            <button className="button-danger" onClick={() => onDeleteNode(nodeId)}>Eliminar Componente</button>
        </>
    );

    /**
     * Renderiza el formulario para añadir un nuevo puerto.
     * @returns {React.ReactElement}
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
                    <label htmlFor="protocol-select">
                        Protocolo:
                        <select id="protocol-select" value={selectedProtocol} onChange={handleProtocolChange} required>
                            <option value="" disabled>Seleccionar Protocolo</option>
                            {existingProtocols.map(p => <option key={p} value={p}>{p}</option>)}
                            <option value="new">Nuevo Protocolo...</option>
                        </select>
                    </label>
                    {selectedProtocol === 'new' && (
                        <label>
                            Nombre del Nuevo Protocolo:
                            <input type="text" value={newProtocolName} onChange={(e) => setNewProtocolName(e.target.value)} required />
                        </label>
                    )}
                    <div>
                        <h4>{editingMessageIndex !== null ? 'Editar Mensaje' : 'Mensajes del Protocolo'}</h4>
                        {messages.length > 0 && (
                            <div className="message-list">
                                {messages.map((msg, index) => (
                                    <div key={index} className="message-item">
                                        <span>
                                            {msg.signal} - {msg.dataType} ({msg.direction}) [{msg.type}]
                                            {msg.type === 'reply' && msg.invokeSignal && ` (reply a ${msg.invokeSignal})`}
                                        </span>
                                        <div className="message-actions">
                                            <button type="button" onClick={() => handleEditMessage(index)} className="edit-message-btn">Editar</button>
                                            <button type="button" onClick={() => handleRemoveMessage(index)} className="delete-message-btn">&times;</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="add-message-container">
                            <select id="message-type" value={messageType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageType(e.target.value as MessageType)} title="Tipo de Mensaje">
                                <option value="invoke">invoke</option>
                                <option value="async">async</option>
                                <option value="reply" disabled={getInvokeMessagesInProtocol().length === 0}>reply</option>
                            </select>
                            {messageType === 'reply' && (
                                <select value={selectedInvokeSignal} onChange={(e) => setSelectedInvokeSignal(e.target.value)} title="Invoke al que responde">
                                    <option value="">Responde a...</option>
                                    {getInvokeMessagesInProtocol().map(invoke => (
                                        <option key={invoke.signal} value={invoke.signal}>{invoke.signal}</option>
                                    ))}
                                </select>
                            )}
                            <input
                                id="message-signal"
                                type="text"
                                placeholder="Señal"
                                value={messageSignal}
                                onChange={(e: ChangeEvent<HTMLInputElement>) => setMessageSignal(e.target.value)}
                            />
                            <select id="message-data-type" value={messageDataType} onChange={handleDataTypeChange} title="Tipo de Dato">
                                <option value="">Tipo de Dato</option>
                                <option value="NULL">null </option>
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
                            <button type="button" onClick={handleAddMessage}>{editingMessageIndex !== null ? 'Guardar' : 'Añadir'}</button>
                            {editingMessageIndex !== null && <button type="button" onClick={resetMessageForm}>Cancelar</button>}
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
            <button type="submit" className="button-success">Crear Puerto</button>
            <button type="button" className="button-secondary" onClick={() => { setNotification(null); setView('main'); }}>Volver</button>
        </form>
    );

    /**
     * Renderiza el formulario para generar un puerto conjugado.
     * @returns {React.ReactElement}
     */
    const renderGenerateConjugateView = () => {
        const nominalPorts = nodes.flatMap(node =>
            node.data.ports
                .filter(port => port.type === 'comunicacion' && port.subtype === 'nominal')
                .map(port => ({ ...port, componentName: node.data.name, nodeId: node.id }))
        );

        return (
            <div className="generate-conjugate-view">
                <h4>Crear Puerto Conjugado</h4>
                <label htmlFor="nominal-port-select">Puerto Nominal de Origen:</label>
                <select id="nominal-port-select" onChange={(e) => { setSelectedNominalPort(e.target.value); setNewConjugatePortId(''); setNewConjugatePortName(''); setNotification(null); }} value={selectedNominalPort || ""} title="Seleccionar puerto nominal">
                    <option value="">Selecciona un puerto...</option>
                    {nominalPorts.map(port => (
                        <option key={`${port.nodeId}:${port.id}`} value={`${port.nodeId}:${port.id}`}>
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
                <button className="button-success" onClick={handleGenerateConjugate} disabled={!selectedNominalPort || !newConjugatePortId.trim() || !newConjugatePortName.trim()}>Crear</button>
                <button type="button" className="button-secondary" onClick={() => { setNotification(null); setView('main'); }}>Volver</button>
            </div>
        );
    };

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