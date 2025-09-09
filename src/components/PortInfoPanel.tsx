/**
 * PortInfoPanel.tsx
 * Panel lateral para visualizar la información de un puerto seleccionado.
 * Ahora incluye una interfaz para editar el ID, el nombre y los mensajes de los puertos.
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
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
    onUpdatePortId: (nodeId: string, oldPortId: string, newPortId: string, newPortName: string) => void;
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

        // Validación para 'reply' basada en el protocolo
        if (messageType === 'reply') {
            if (!invokeMessageExistsInProtocol(messageSignal)) {
                setNotification({ message: 'Un mensaje de tipo "reply" requiere un mensaje "invoke" con la misma señal en el mismo protocolo.', type: 'error' });
                return;
            }
        }

        const newMessage: Message = {
            signal: messageSignal,
            dataType: messageDataType,
            direction: messageDirection,
            type: messageType
        };

        if (editingMessageIndex !== null) {
            const updatedMessages = [...messages];
            updatedMessages[editingMessageIndex] = newMessage;
            setMessages(updatedMessages);
        } else {
            const messageExists = messages.some(msg => msg.signal === messageSignal);
            if (messageExists) {
                setNotification({ message: 'Error: Ya existe un mensaje con esta señal en este puerto.', type: 'error' });
                return;
            }
            setMessages((prevMessages) => [...prevMessages, newMessage]);
        }
        
        resetMessageForm();
        setNotification({ message: 'Mensaje guardado con éxito.', type: 'success' });
    }, [messageSignal, messageDataType, messageDirection, messageType, messages, editingMessageIndex, setNotification, invokeMessageExistsInProtocol]);

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

        if (messageToDelete.type === 'invoke') {
            const replyIndex = updatedMessages.findIndex(
                (msg, i) => i !== index && msg.type === 'reply' && msg.signal === messageToDelete.signal
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
        setNotification({ message: 'Mensaje eliminado.', type: 'success' });
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

        // Obtener una lista de todos los demás puertos en el mismo protocolo, excluyendo el actual.
        const otherPortsInProtocol = nodes.flatMap(node => node.data.ports)
            .filter(p => p.protocolName === port.protocolName && p.id !== port.id);

        // Validación de unicidad del ID
        const isDuplicateIdInProtocol = otherPortsInProtocol.some(p => p.id === trimmedId);
        if (isDuplicateIdInProtocol) {
            setNotification({ message: `Ya existe un puerto con el ID "${trimmedId}" en el protocolo "${port.protocolName}".`, type: 'error' });
            return;
        }

        // Validación de unicidad del nombre
        const isDuplicateNameInProtocol = otherPortsInProtocol.some(p => p.name === trimmedName);
        if (isDuplicateNameInProtocol) {
            setNotification({ message: `Ya existe un puerto con el nombre "${trimmedName}" en el protocolo "${port.protocolName}".`, type: 'error' });
            return;
        }

        // Si todas las validaciones pasan, se procede a guardar los cambios
        onUpdatePortId(nodeId, port.id, trimmedId, trimmedName);
        onUpdatePortMessages(nodeId, trimmedId, messages);
        
        setNotification({ message: 'Cambios guardados con éxito.', type: 'success' });
        // No cerramos el panel para permitir más ediciones.
    }, [onUpdatePortId, onUpdatePortMessages, nodeId, port, editedPortId, editedPortName, messages, setNotification, nodes]);

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
            <div className="panel-header">
                {/* Ahora el nombre del puerto es un campo editable */}
                <input
                    type="text"
                    value={editedPortName}
                    onChange={(e) => setEditedPortName(e.target.value)}
                    className="port-name-input"
                    title="Nombre del puerto"
                />
                <button className="close-button" onClick={onClose}>&times;</button>
            </div>
            <div className="panel-content">
                <div className="port-details-section">
                    <div className="port-detail-row">
                        <span>ID:</span>
                        {/* Campo para editar el ID del puerto */}
                        <input
                            type="text"
                            value={editedPortId}
                            onChange={(e) => setEditedPortId(e.target.value)}
                            className="port-id-input"
                            title="ID único del puerto"
                        />
                    </div>
                </div>
                <p><strong>Tipo:</strong> {port.type}</p>
                {port.subtype && <p><strong>Subtipo:</strong> {port.subtype}</p>}
                {port.protocolName && <p><strong>Protocolo:</strong> {port.protocolName}</p>}
                {port.interruptHandler && (
                    <div className="interrupt-handler-display">
                        <strong>Handler:</strong>
                        <pre>{port.interruptHandler}</pre>
                    </div>
                )}
                
                {port.type === 'comunicacion' && (
                    <div className="messages-section">
                        <h4>Mensajes</h4>
                        <div className="message-list">
                            {messages.length > 0 ? (
                                messages.map((msg, index) => (
                                    <div key={index} className="message-item">
                                        <span>{msg.signal} - {msg.dataType} ({msg.direction}) [{msg.type}]</span>
                                        <div className="message-actions">
                                            <button onClick={() => handleEditMessage(index)}>Editar</button>
                                            <button onClick={() => handleDeleteMessage(index)}>Eliminar</button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p>No hay mensajes en este puerto.</p>
                            )}
                        </div>
                        <div className="add-message-container">
                            <h5>{editingMessageIndex !== null ? 'Editar Mensaje' : 'Añadir Nuevo Mensaje'}</h5>
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
                                <option value="reply" disabled={!invokeMessageExistsInProtocol(messageSignal)}>reply</option>
                            </select>
                            <button type="button" onClick={handleSaveMessage}>{editingMessageIndex !== null ? 'Guardar Cambios' : 'Añadir'}</button>
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
                )}
            </div>
            {port.type === 'comunicacion' && <button className="save-changes-button" onClick={handleSaveChanges}>Guardar Cambios del Puerto</button>}
        </div>
    );
};

export default PortInfoPanel;