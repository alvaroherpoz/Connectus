/**
 * @fileoverview Panel lateral para visualizar y editar la información de un puerto seleccionado.
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import type { Message, MessageType, PortData, Node, NodeData } from './types';
import '../types/PortInfoPanel.css';

/**
 * Props para el componente PortInfoPanel.
 * @interface PortInfoPanelProps
 */
interface PortInfoPanelProps {
    /** Los datos del puerto a mostrar/editar. */
    port: PortData;
    /** El ID del nodo al que pertenece el puerto. */
    nodeId: string;
    /** Función para cerrar el panel. */
    onClose: () => void;
    /** Función para actualizar los mensajes del puerto. */
    onUpdatePortMessages: (nodeId: string, portId: string, newMessages: Message[]) => void;
    /** Función para actualizar el ID y el nombre del puerto. */
    onUpdatePortId: (nodeId: string, oldPortId: string, newPortId: string, newPortName: string) => boolean;
    /** Lista de tipos de datos personalizados. */
    dataTypes: string[];
    /** Función para mostrar notificaciones. */
    setNotification: (notification: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
    /** Función para añadir un nuevo tipo de dato personalizado. */
    handleAddDataType: (newType: string) => void;
    /** Array de todos los nodos del diagrama. */
    nodes: Node<NodeData>[];
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
 * Componente que renderiza un panel para mostrar y editar los detalles de un puerto.
 * @param {PortInfoPanelProps} props - Las props del componente.
 * @returns {React.ReactElement} El panel de información del puerto.
 */
const PortInfoPanel: React.FC<PortInfoPanelProps> = ({
    port, nodeId, onClose, onUpdatePortMessages, onUpdatePortId, dataTypes, setNotification, handleAddDataType, nodes
}) => {
    const [messages, setMessages] = useState<Message[]>(port.messages || []);
    const [editedPortId, setEditedPortId] = useState(port.id);
    const [editedPortName, setEditedPortName] = useState(port.name);
    const [messageSignal, setMessageSignal] = useState('');
    const [messageDataType, setMessageDataType] = useState('');
    const [messageDirection, setMessageDirection] = useState<'entrada' | 'salida'>('entrada');
    const [messageType, setMessageType] = useState<MessageType>('invoke');
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [selectedInvokeSignal, setSelectedInvokeSignal] = useState('');
    const [newDataTypeName, setNewDataTypeName] = useState('');
    const [showNewDataTypeInput, setShowNewDataTypeInput] = useState(false);

    /**
     * Sincroniza el estado local del panel con los datos del puerto seleccionado
     * cada vez que este cambia.
     * @effect
     */
    useEffect(() => {
        setEditedPortId(port.id);
        setEditedPortName(port.name);
        setMessages(port.messages || []);
        setEditingMessageIndex(null);
        resetMessageForm();
    }, [port]);
    
    /**
     * Resetea los campos del formulario de añadir/editar mensajes a su estado inicial.
     */
    const resetMessageForm = () => {
        setMessageSignal('');
        setMessageDataType('');
        setMessageDirection('entrada');
        setMessageType('invoke');
        setEditingMessageIndex(null);
        setSelectedInvokeSignal('');
    };

    /**
     * Recopila todos los mensajes de tipo 'invoke' que existen en el protocolo del puerto actual.
     * @returns {Message[]} Una lista de mensajes 'invoke'.
     */
    const getAllInvokeMessagesInProtocol = useCallback((): Message[] => {
        const invokes: Message[] = [];
        const invokeSignals = new Set<string>();

        // 1. Revisa los mensajes que se están editando en el panel local
        messages.forEach(msg => {
            if (msg.type === 'invoke') {
                invokes.push(msg);
                invokeSignals.add(msg.signal);
            }
        });

        // 2. Revisa los mensajes en otros puertos del mismo protocolo
        nodes.forEach(node => {
            node.data.ports.forEach(p => {
                if (node.id === nodeId && p.id === port.id) {
                    return;
                }

                if (p.protocolName === port.protocolName && p.messages) {
                    p.messages.forEach(msg => {
                        if (msg.type === 'invoke' && !invokeSignals.has(msg.signal)) {
                            invokes.push(msg);
                            invokeSignals.add(msg.signal);
                        }
                    });
                }
            });
        });

        return invokes;
    }, [nodes, port.protocolName, messages, nodeId, port.id]);
    
    /**
     * Guarda un mensaje nuevo o uno editado en el estado local del panel.
     * Realiza validaciones de unicidad y consistencia.
     */
    const handleSaveMessage = useCallback(() => {
         if (!messageSignal || !messageDataType) {
             setNotification({ message: 'La señal y el tipo de dato son obligatorios.', type: 'error' });
             return;
         }
 
        const isEditing = editingMessageIndex !== null;
        const originalSignal = isEditing ? messages[editingMessageIndex!].signal : null;
 
         if (!isEditing || (isEditing && originalSignal !== messageSignal)) {
             const isSignalDuplicateInProtocol = nodes.some(node =>
                 node.data.ports.some(p =>
                     p.protocolName === port.protocolName &&
                     p.messages?.some(msg => msg.signal === messageSignal)
                 )
             );
 
             if (isSignalDuplicateInProtocol) {
                 setNotification({ message: `Error: Ya existe un mensaje con la señal "${messageSignal}" en este protocolo.`, type: 'error' });
                 return;
             }
         }
 
         if (messageType === 'reply') {
            if (!selectedInvokeSignal) {
                setNotification({ message: 'Error: Debe seleccionar a qué mensaje "invoke" responde este "reply".', type: 'error' });
                return;
            }
            const invokeMessage = getAllInvokeMessagesInProtocol().find(m => m.signal === selectedInvokeSignal);

             if (!invokeMessage) {
                 setNotification({ message: 'Error: No se encontró el "invoke" seleccionado.', type: 'error' });
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
         } else {
             setMessages((prevMessages) => [...prevMessages, newMessage]);
         }
         
         resetMessageForm();
         setNotification({ message: 'Mensaje guardado. Recuerde guardar los cambios del puerto.', type: 'info' });
     }, [messageSignal, messageDataType, messageDirection, messageType, messages, editingMessageIndex, setNotification, getAllInvokeMessagesInProtocol, selectedInvokeSignal, nodes, port.protocolName, nodeId, port.id]);

    /**
     * Prepara el formulario para editar un mensaje existente, rellenando los campos
     * con los datos del mensaje seleccionado.
     * @param {number} index - El índice del mensaje a editar.
     */
    const handleEditMessage = useCallback((index: number) => {
        const messageToEdit = messages[index];
        setMessageSignal(messageToEdit.signal);
        setMessageDataType(messageToEdit.dataType);
        setMessageDirection(messageToEdit.direction);
        setMessageType(messageToEdit.type);
        setEditingMessageIndex(index);
        if (messageToEdit.type === 'reply') {
            setSelectedInvokeSignal(messageToEdit.invokeSignal || '');
        } else {
            setSelectedInvokeSignal('');
        }
    }, [messages]);

    /**
     * Elimina un mensaje de la lista local. Si el mensaje es de tipo 'invoke',
     * intenta eliminar también el 'reply' asociado (basado en la coincidencia de señal).
     * @param {number} index - El índice del mensaje a eliminar.
     */
    const handleDeleteMessage = useCallback((index: number) => {
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
        setNotification({ message: 'Mensaje eliminado. Guarde los cambios para aplicar la sincronización de los mensajes en el protocolo.', type: 'info' });
        resetMessageForm();
    }, [messages, setNotification]);

    /**
     * Valida y guarda todos los cambios realizados en el panel (ID, nombre y mensajes),
     * llamando a las funciones de actualización del componente padre.
     */
    const handleSaveChanges = useCallback(() => {
        const trimmedId = editedPortId.trim();
        if (!trimmedId) {
            setNotification({ message: 'El ID del puerto no puede estar vacío.', type: 'error' });
            return;
        }
        if (!/^\d+$/.test(trimmedId)) {
            setNotification({ message: 'El ID del puerto debe contener solo números.', type: 'error' });
            return;
        }

        const trimmedName = editedPortName.trim();
        if (!trimmedName) {
            setNotification({ message: 'El nombre del puerto no puede estar vacío.', type: 'error' });
            return;
        }

        const success = onUpdatePortId(nodeId, port.id, trimmedId, trimmedName);

        if (success) {
            if (port.type === 'comunicacion') {
                onUpdatePortMessages(nodeId, trimmedId, messages);
            }
            setNotification({ message: 'Cambios guardados con éxito.', type: 'success' });
            onClose();
        }
    }, [onUpdatePortId, onUpdatePortMessages, nodeId, port, editedPortId, editedPortName, messages, setNotification, onClose]);

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
     * Añade un nuevo tipo de dato a la lista global de tipos de datos personalizados.
     */
    const handleAddNewDataType = useCallback(() => {
        if (newDataTypeName.trim()) {
            handleAddDataType(newDataTypeName.trim());
            setMessageDataType(newDataTypeName.trim());
            setNewDataTypeName('');
            setShowNewDataTypeInput(false);
        }
    }, [newDataTypeName, handleAddDataType]);

    return (
        <div className="port-info-panel">
            <div className="port-info-header">
                <h4>Detalles del Puerto</h4>
            </div>
            <div className="port-info-body">
                <div className="port-details-section">
                    <div className="form-row">
                        <label htmlFor="port-name-input">Nombre del Puerto</label>
                        <input
                            id="port-name-input"
                            type="text"
                            value={editedPortName}
                            onChange={(e) => setEditedPortName(e.target.value)}
                            className="port-info-name-input"
                            title="Nombre descriptivo del puerto"
                        />
                        <small className="form-help-text">Nombre descriptivo para identificar la funcionalidad del puerto.</small>
                    </div>
                    <div className="form-row">
                        <label htmlFor="port-id-input">ID del Puerto</label>
                        <input
                            id="port-id-input"
                            type="text"
                            value={editedPortId}
                            onChange={(e) => setEditedPortId(e.target.value)}
                            className="port-info-id-input"
                            title="ID único del puerto en este componente"
                        />
                        <small className="form-help-text">ID numérico único dentro de este componente.</small>
                    </div>
                </div>
                <div className="port-static-details">
                    <div className="form-row">
                        <label>Tipo</label>
                        <span>{port.type}</span>
                    </div>
                    {port.type === 'comunicacion' && port.subtype && <div className="form-row"><label>Subtipo</label><span>{port.subtype}</span></div>}
                    {port.protocolName && <div className="form-row"><label>Protocolo</label><span>{port.protocolName}</span></div>}
                </div>
 
                {port.type === 'comunicacion' && (
                    <div className="messages-section">
                        <h4>Mensajes</h4>
                        <div className="message-list-container">
                            {messages.length > 0 ? (
                                messages.map((msg, index) => (
                                    <div key={index} className="message-item">
                                        <span className="message-details">
                                            {msg.signal} - {msg.dataType} ({msg.direction}) [{msg.type}]
                                            {msg.type === 'reply' && msg.invokeSignal && ` (reply a ${msg.invokeSignal})`}
                                        </span>
                                        <div className="message-actions">
                                            <button onClick={() => handleEditMessage(index)}>Editar</button>
                                            <button onClick={() => handleDeleteMessage(index)}>Eliminar</button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="no-messages-notice">No hay mensajes en este puerto.</p>
                            )}
                        </div>
                        <div className="message-form-container">
                            <h5>{editingMessageIndex !== null ? 'Editar Mensaje' : 'Añadir Nuevo Mensaje'}</h5>
                            <div className="form-grid">
                                <div className="form-field"><label htmlFor="message-type">Tipo</label><select id="message-type" value={messageType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageType(e.target.value as MessageType)} title="Tipo de Mensaje"><option value="invoke">invoke</option><option value="async">async</option><option value="reply" disabled={getAllInvokeMessagesInProtocol().length === 0}>reply</option></select></div>
                                {messageType === 'reply' && (
                                    <div className="form-field">
                                        <label htmlFor="invoke-signal-select">Responde a (Invoke)</label>
                                        <select id="invoke-signal-select" value={selectedInvokeSignal} onChange={(e) => setSelectedInvokeSignal(e.target.value)} title="Invoke al que responde">
                                            <option value="">Seleccionar...</option>
                                            {getAllInvokeMessagesInProtocol().map(invoke => (
                                                <option key={invoke.signal} value={invoke.signal}>{invoke.signal}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div className="form-field"><label htmlFor="message-signal">Señal</label><input id="message-signal" type="text" placeholder="Ej: S_Data" value={messageSignal} onChange={(e: ChangeEvent<HTMLInputElement>) => setMessageSignal(e.target.value)} /></div>
                                <div className="form-field"><label htmlFor="message-data-type">Tipo de Dato</label><select id="message-data-type" value={messageDataType} onChange={handleDataTypeChange} title="Tipo de Dato"><option value="">Seleccionar...</option><option value="NULL">null </option>{fixedDataTypesList.map((dt) => (<option key={dt} value={dt}>{dt}</option>))}{dataTypes.map((dt) => (<option key={dt} value={dt}>{dt}</option>))}<option value="other">Otro tipo de dato...</option></select></div>
                                <div className="form-field"><label htmlFor="message-direction">Dirección</label><select id="message-direction" value={messageDirection} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageDirection(e.target.value as 'entrada' | 'salida')} title="Dirección del Mensaje"><option value="entrada">Entrada</option><option value="salida">Salida</option></select></div>
                            </div>
                            {showNewDataTypeInput && (
                                <div className="add-data-type-container">
                                    <input type="text" placeholder="Nuevo Tipo de Dato" value={newDataTypeName} onChange={(e) => setNewDataTypeName(e.target.value)} />
                                    <button type="button" onClick={handleAddNewDataType}>Añadir Tipo</button>
                                </div>
                            )}
                            <div className="message-form-actions">
                                <button type="button" onClick={handleSaveMessage}>{editingMessageIndex !== null ? 'Guardar Cambios' : 'Añadir Mensaje'}</button>
                                {editingMessageIndex !== null && <button type="button" className="cancel-edit-button" onClick={resetMessageForm}>Cancelar Edición</button>}
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="panel-footer">
                <button className="save-changes-button" onClick={handleSaveChanges}>Guardar</button>
                <button className="cancel-button" onClick={onClose}>Cancelar</button>
            </div>
        </div>
    );
};

export default PortInfoPanel;