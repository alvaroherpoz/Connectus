/**
 * ContextMenu.tsx
 * Menú contextual para realizar acciones sobre nodos y puertos en el diagrama.
 * Permite añadir puertos, generar puertos conjugados, editar atributos y eliminar componentes.
 */

import React, { useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Message, Node, NodeData } from './types';
import '../types/ContextMenu.css';

/**
 * Props del componente ContextMenu.
 */
interface ContextMenuProps {
    x: number;
    y: number;
    onAddPort: (name: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'nominal' | 'conjugado' | undefined, messages: Message[], interruptHandler?: string) => void;
    onAddConjugatePort: (nodeId: string, nominalPortId: string) => void;
    onClose: () => void;
    handleAddDataType: (newType: string) => void;
    nodes: Node<NodeData>[];
    nodeId: string;
    onDeleteNode: (nodeId: string) => void;
    onEditAttributes: () => void;
    dataTypes: string[];
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
    nodes, nodeId, onDeleteNode, onEditAttributes, dataTypes
}) => {
    // Estado interno para la vista actual y datos de formularios
    const [view, setView] = useState<'main' | 'addPort' | 'generateConjugate'>('main');
    const [portName, setPortName] = useState('');
    const [portType, setPortType] = useState<'comunicacion' | 'tiempo' | 'interrupcion'>('comunicacion');
    const [portSubtype, setPortSubtype] = useState<'nominal' | 'conjugado' | undefined>('nominal');
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageSignal, setMessageSignal] = useState('');
    const [messageDataType, setMessageDataType] = useState('');
    const [messageDirection, setMessageDirection] = useState<'entrada' | 'salida'>('entrada');
    const [interruptHandler, setInterruptHandler] = useState('');
    const [selectedNominalPort, setSelectedNominalPort] = useState<string | null>(null);
    const [newDataTypeName, setNewDataTypeName] = useState('');
    const [showNewDataTypeInput, setShowNewDataTypeInput] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    /**
     * Añade un mensaje al puerto de comunicación.
     */
    const handleAddMessage = useCallback(() => {
        if (messageSignal && messageDataType) {
            setMessages((prevMessages) => [...prevMessages, { signal: messageSignal, dataType: messageDataType, direction: messageDirection }]);
            setMessageSignal('');
            setMessageDataType('');
        }
    }, [messageSignal, messageDataType, messageDirection]);

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
        const currentComponent = nodes.find(node => node.id === nodeId);
        if (currentComponent?.data.ports.some(p => p.name === portName)) {
            setErrorMessage(`Ya existe un puerto con el nombre "${portName}".`);
            return;
        }
        onAddPort(portName, portType, portSubtype, messages, interruptHandler);
        onClose();
    }, [onAddPort, portName, portType, portSubtype, messages, interruptHandler, onClose, nodes, nodeId]);

    /**
     * Genera un puerto conjugado a partir de un puerto nominal seleccionado.
     */
    const handleGenerateConjugate = useCallback(() => {
        if (!selectedNominalPort) {
            setErrorMessage('Por favor, selecciona un puerto nominal.');
            return;
        }

        const currentComponent = nodes.find(node => node.id === nodeId);
        const nominalPort = nodes.flatMap(node => node.data.ports).find(p => p.id === selectedNominalPort);
        
        if (currentComponent?.data.ports.some(p => p.name === nominalPort?.name)) {
            setErrorMessage(`Ya existe un puerto con el nombre "${nominalPort?.name}" en este componente.`);
            return;
        }

        onAddConjugatePort(nodeId, selectedNominalPort);
        onClose();
    }, [onAddConjugatePort, nodeId, selectedNominalPort, onClose, nodes]);

    /**
     * Renderiza la vista principal del menú.
     */
    const renderMainView = () => (
        <>
            <button onClick={() => { setErrorMessage(''); setView('addPort'); }}>Añadir Puerto</button>
            <button onClick={() => {
                const nominalPorts = nodes.flatMap(node =>
                    node.data.ports.filter(port => port.type === 'comunicacion' && port.subtype === 'nominal')
                );
                if (nominalPorts.length === 0) {
                    setErrorMessage('No hay puertos nominales para generar un puerto conjugado.');
                } else {
                    setErrorMessage('');
                    setView('generateConjugate');
                }
            }}>Generar Puerto Conjugado</button>
            <button onClick={() => { setErrorMessage(''); onEditAttributes(); }}>Editar Atributos</button>
            <button onClick={() => onDeleteNode(nodeId)}>Eliminar Componente</button>
        </>
    );

    /**
     * Renderiza el formulario para añadir un puerto.
     */
    const renderAddPortView = () => (
        <form onSubmit={handleSubmitPort}>
            <label>
                Nombre del Puerto:
                <input type="text" value={portName} onChange={(e: ChangeEvent<HTMLInputElement>) => { setPortName(e.target.value); setErrorMessage(''); }} required />
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
                    <label htmlFor="port-subtype">
                        Subtipo:
                        <select id="port-subtype" value={portSubtype} onChange={(e: ChangeEvent<HTMLSelectElement>) => setPortSubtype(e.target.value as 'nominal' | 'conjugado' | undefined)} required title="Subtipo de Puerto">
                            <option value="">Seleccionar...</option>
                            <option value="nominal">Nominal</option>
                            <option value="conjugado">Conjugado</option>
                        </select>
                    </label>
                    <div>
                        <h4>Mensajes</h4>
                        {messages.length > 0 && (
                            <div className="message-list">
                                {messages.map((msg, index) => (
                                    <div key={index} className="message-item">
                                        <span>{msg.signal} - {msg.dataType} ({msg.direction})</span>
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
            <button type="button" onClick={() => { setErrorMessage(''); setView('main'); }}>Volver</button>
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
                <h4>Seleccionar Puerto Nominal</h4>
                <select onChange={(e) => { setSelectedNominalPort(e.target.value); setErrorMessage(''); }} value={selectedNominalPort || ""} title="Seleccionar puerto nominal">
                    <option value="">Selecciona un puerto...</option>
                    {nominalPorts.map(port => (
                        <option key={port.id} value={port.id}>
                            {port.componentName} - {port.name}
                        </option>
                    ))}
                </select>
                <button onClick={handleGenerateConjugate} disabled={!selectedNominalPort}>Generar</button>
                <button onClick={() => { setErrorMessage(''); setView('main'); }}>Volver</button>
            </div>
        );
    };

    // Renderizado principal del menú contextual
    return (
        <div className="context-menu" style={{ top: y, left: x }}>
            {view === 'main' && renderMainView()}
            {view === 'addPort' && renderAddPortView()}
            {view === 'generateConjugate' && renderGenerateConjugateView()}
            {errorMessage && <div className="context-menu-error-message">{errorMessage}</div>}
            <button className="bottom-close-button" onClick={() => { setErrorMessage(''); onClose(); }}>Cerrar</button>
        </div>
    );
};

export default ContextMenu;