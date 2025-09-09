/**
 * PortInfoPanel.tsx
 * Panel lateral para visualizar la información de un puerto seleccionado.
 * Ahora incluye una interfaz para editar el ID, el nombre y los mensajes de los puertos.
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent } from 'react';
import type { Message, MessageType, PortData, Node, NodeData } from './types';
import '../types/PortInfoPanel.css';

/**
 * Props del componente PortInfoPanel.
 */
interface PortInfoPanelProps {
    port: PortData;
    nodeId: string;
    onClose: () => void;
    onUpdatePortMessages: (nodeId: string, portId: string, newMessages: Message[]) => void;
    // Nueva función para actualizar el ID y el nombre del puerto
    onUpdatePortId: (nodeId: string, oldPortId: string, newPortId: string, newPortName: string) => boolean;
    dataTypes: string[];
    setNotification: (notification: { message: string; type: 'success' | 'error' | 'info' } | null) => void;
    handleAddDataType: (newType: string) => void;
    nodes: Node<NodeData>[];
}

/**
 * Tipos de datos básicos de EDROOM.
 */
const fixedDataTypesList = [
    'CDEventList', 'CDRecovAction', 'CDSensorTMBufferStatus', 'CDTCDescriptor', 'CDTMList',
    'CDTMMemory', 'Pr_Time', 'TEDROOMBool', 'TEDROOMByte', 'TEDROOMDouble', 'TEDROOMFloat', 'TEDROOMInt8',
    'TEDROOMInt16', 'TEDROOMInt32', 'TEDROOMInt64', 'TEDROOMUInt8', 'TEDROOMUInt16', 'TEDROOMUInt32',
    'TEDROOMUInt64', 'TEDROOMWord16', 'TEDROOMWord32', 'TEDROOMWord64'
];

/**
 * Panel para mostrar y editar la información de un puerto.
 */
const PortInfoPanel: React.FC<PortInfoPanelProps> = ({
    port, nodeId, onClose, onUpdatePortMessages, onUpdatePortId, dataTypes, setNotification, handleAddDataType, nodes
}) => {
    // Estado local para los mensajes del puerto
    const [messages, setMessages] = useState<Message[]>(port.messages || []);
    // Nuevos estados para el ID y el nombre editables
    const [editedPortId, setEditedPortId] = useState(port.id);
    const [editedPortName, setEditedPortName] = useState(port.name);
    // Estado para el formulario de mensajes
    const [messageSignal, setMessageSignal] = useState('');
    const [messageDataType, setMessageDataType] = useState('');
    const [messageDirection, setMessageDirection] = useState<'entrada' | 'salida'>('entrada');
    const [messageType, setMessageType] = useState<MessageType>('invoke');
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [newDataTypeName, setNewDataTypeName] = useState('');
    const [showNewDataTypeInput, setShowNewDataTypeInput] = useState(false);

    /**
     * Sincroniza el estado local de mensajes, ID y nombre con el prop 'port'
     * cuando el puerto seleccionado cambia.
     */
    useEffect(() => {
        setEditedPortId(port.id);
        setEditedPortName(port.name);
        setMessages(port.messages || []);
        setEditingMessageIndex(null);
        resetMessageForm();
    }, [port]);
    
    /**
     * Resetea los campos del formulario de mensajes.
     */
    const resetMessageForm = () => {
        setMessageSignal('');
        setMessageDataType('');
        setMessageDirection('entrada');
        setMessageType('invoke');
        setEditingMessageIndex(null);
    };

    /**
     * Valida si un mensaje 'invoke' con la misma señal existe en el protocolo.
     * Itera sobre todos los puertos en todos los nodos.
     */
    const invokeMessageExistsInProtocol = useCallback((signal: string) => {
        // Itera sobre todos los nodos y puertos para encontrar un 'invoke' en el mismo protocolo
        for (const node of nodes) {
            for (const p of node.data.ports) {
                if (p.protocolName === port.protocolName && p.messages) {
                    if (p.messages.some(msg => msg.type === 'invoke' && msg.signal === signal)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }, [nodes, port.protocolName]);
    
    /**
     * Añade un nuevo mensaje o actualiza uno existente.
     */
    const handleSaveMessage = useCallback(() => {
         if (!messageSignal || !messageDataType) {
             setNotification({ message: 'La señal y el tipo de dato son obligatorios.', type: 'error' });
             return;
         }
 
         // --- VALIDATION ---
         // Check for duplicates across the entire protocol.
         for (const node of nodes) {
             for (const p of node.data.ports) {
                 // Only check ports within the same protocol
                 if (p.protocolName === port.protocolName && p.messages) {
                     for (let i = 0; i < p.messages.length; i++) {
                         const msg = p.messages[i];
                         
                         // Skip the message we are currently editing
                         const isEditingThisMessage = (node.id === nodeId && p.id === port.id && i === editingMessageIndex);
                         if (isEditingThisMessage) {
                             continue;
                         }
 
                         // If the signal name is the same...
                         if (msg.signal === messageSignal) {
                             // It's a duplicate if we are adding an invoke/async and any other message already exists with that signal.
                             if (messageType === 'invoke' || messageType === 'async') {
                                 setNotification({ message: `Error: Ya existe un mensaje con la señal "${messageSignal}" en este protocolo.`, type: 'error' });
                                 return;
                             }
                             // It's a duplicate if we are adding a reply and a reply already exists.
                             if (messageType === 'reply' && msg.type === 'reply') {
                                 setNotification({ message: `Error: Ya existe un "reply" para la señal "${messageSignal}" en este protocolo.`, type: 'error' });
                                 return;
                             }
                         }
                     }
                 }
             }
         }
 
         // If the message is a 'reply', ensure a corresponding 'invoke' exists.
         if (messageType === 'reply') {
             if (!invokeMessageExistsInProtocol(messageSignal)) {
                 setNotification({ message: 'Un mensaje de tipo "reply" requiere un mensaje "invoke" con la misma señal en el mismo protocolo.', type: 'error' });
                 return;
             }
         }
 
         const newMessage: Message = { signal: messageSignal, dataType: messageDataType, direction: messageDirection, type: messageType };
 
         if (editingMessageIndex !== null) {
             const updatedMessages = [...messages];
             updatedMessages[editingMessageIndex] = newMessage;
             setMessages(updatedMessages);
         } else {
             setMessages((prevMessages) => [...prevMessages, newMessage]);
         }
         
         resetMessageForm();
         setNotification({ message: 'Mensaje guardado con éxito.', type: 'success' });
     }, [messageSignal, messageDataType, messageDirection, messageType, messages, editingMessageIndex, setNotification, invokeMessageExistsInProtocol, nodes, port.protocolName, nodeId, port.id]);

    /**
     * Rellena el formulario con los datos de un mensaje para editarlo.
     */
    const handleEditMessage = useCallback((index: number) => {
        const messageToEdit = messages[index];
        setMessageSignal(messageToEdit.signal);
        setMessageDataType(messageToEdit.dataType);
        setMessageDirection(messageToEdit.direction);
        setMessageType(messageToEdit.type);
        setEditingMessageIndex(index);
    }, [messages]);

    /**
     * Elimina un mensaje del listado. Si el mensaje es de tipo 'invoke', también elimina el 'reply' asociado si existe.
     */
    const handleDeleteMessage = useCallback((index: number) => {
        const messageToDelete = messages[index];
        let updatedMessages = [...messages];

        // Si se elimina un mensaje 'invoke', también se debe eliminar su 'reply' correspondiente.
        if (messageToDelete.type === 'invoke') {
            const replyIndex = updatedMessages.findIndex(
                (msg, i) => i !== index && msg.type === 'reply' && msg.signal === messageToDelete.signal
            );

            if (replyIndex !== -1) {
                // Filtra tanto el 'invoke' como el 'reply'.
                updatedMessages = updatedMessages.filter((_, i) => i !== index && i !== replyIndex);
            } else {
                // Si no se encuentra 'reply', solo elimina el 'invoke'.
                updatedMessages = updatedMessages.filter((_, i) => i !== index);
            }
        } else {
            // Para 'async' o 'reply', solo elimina el mensaje seleccionado.
            updatedMessages = updatedMessages.filter((_, i) => i !== index);
        }

        setMessages(updatedMessages);
        // Notificar al usuario que debe guardar para aplicar los cambios y sincronizar
        setNotification({ message: 'Mensaje eliminado. Guarde los cambios para aplicar la sincronización de los mensajes en el protocolo.', type: 'info' });
        resetMessageForm();
    }, [messages, setNotification]);

    /**
     * Envía los mensajes y los atributos actualizados al componente padre (App.tsx).
     */
    const handleSaveChanges = useCallback(() => {
        // Validación para el ID: no vacío y solo números
        const trimmedId = editedPortId.trim();
        if (!trimmedId) {
            setNotification({ message: 'El ID del puerto no puede estar vacío.', type: 'error' });
            return;
        }
        if (!/^\d+$/.test(trimmedId)) {
            setNotification({ message: 'El ID del puerto debe contener solo números.', type: 'error' });
            return;
        }

        // Validación para el nombre: no vacío
        const trimmedName = editedPortName.trim();
        if (!trimmedName) {
            setNotification({ message: 'El nombre del puerto no puede estar vacío.', type: 'error' });
            return;
        }

        // Llamar a la función de actualización que ahora devuelve un booleano
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
     * Maneja el cambio del tipo de dato y muestra el campo de entrada si es "other".
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
     * Añade un nuevo tipo de dato personalizado.
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
                    {port.subtype && <div className="form-row"><label>Subtipo</label><span>{port.subtype}</span></div>}
                    {port.protocolName && <div className="form-row"><label>Protocolo</label><span>{port.protocolName}</span></div>}
                </div>
 
                {port.interruptHandler && (
                    <div className="interrupt-handler-display">
                        <label>Handler</label>
                        <pre>{port.interruptHandler}</pre>
                    </div>
                )}
                
                {port.type === 'comunicacion' && (
                    <div className="messages-section">
                        <h4>Mensajes</h4>
                        <div className="message-list-container">
                            {messages.length > 0 ? (
                                messages.map((msg, index) => (
                                    <div key={index} className="message-item">
                                        <span className="message-details">{msg.signal} - {msg.dataType} ({msg.direction}) [{msg.type}]</span>
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
                                <div className="form-field"><label htmlFor="message-signal">Señal</label><input id="message-signal" type="text" placeholder="Ej: S_Data" value={messageSignal} onChange={(e: ChangeEvent<HTMLInputElement>) => setMessageSignal(e.target.value)} /></div>
                                <div className="form-field"><label htmlFor="message-data-type">Tipo de Dato</label><select id="message-data-type" value={messageDataType} onChange={handleDataTypeChange} title="Tipo de Dato"><option value="">Seleccionar...</option><option value="void">void (sin dato)</option>{fixedDataTypesList.map((dt) => (<option key={dt} value={dt}>{dt}</option>))}{dataTypes.map((dt) => (<option key={dt} value={dt}>{dt}</option>))}<option value="other">Otro tipo de dato...</option></select></div>
                                <div className="form-field"><label htmlFor="message-direction">Dirección</label><select id="message-direction" value={messageDirection} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageDirection(e.target.value as 'entrada' | 'salida')} title="Dirección del Mensaje"><option value="entrada">Entrada</option><option value="salida">Salida</option></select></div>
                                <div className="form-field"><label htmlFor="message-type">Tipo</label><select id="message-type" value={messageType} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMessageType(e.target.value as MessageType)} title="Tipo de Mensaje"><option value="invoke">invoke</option><option value="async">async</option><option value="reply" disabled={!invokeMessageExistsInProtocol(messageSignal)}>reply</option></select></div>
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