import React, { useState, useCallback } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import type { Message, Node, NodeData } from './types';
import './ContextMenu.css';

interface ContextMenuProps {
    x: number;
    y: number;
    onAddPort: (name: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'nominal' | 'conjugado' | undefined, messages: Message[], interruptHandler?: string) => void;
    onAddConjugatePort: (nodeId: string, nominalPortId: string) => void;
    onRename: (newName: string) => void;
    onClose: () => void;
    dataTypes: string[];
    onAssignNode: (nodeName: string) => void;
    handleAddDataType: (newType: string) => void;
    nodes: Node<NodeData>[];
    nodeId: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, onAddPort, onAddConjugatePort, onRename, onClose, dataTypes, onAssignNode, handleAddDataType, nodes, nodeId }) => {
    const [view, setView] = useState<'main' | 'addPort' | 'rename' | 'assignNode' | 'generateConjugate'>('main');
    const [portName, setPortName] = useState('');
    const [portType, setPortType] = useState<'comunicacion' | 'tiempo' | 'interrupcion'>('comunicacion');
    const [portSubtype, setPortSubtype] = useState<'nominal' | 'conjugado' | undefined>('nominal'); // eslint-disable-line @typescript-eslint/no-unused-vars
    const [messages, setMessages] = useState<Message[]>([]);
    const [messageSignal, setMessageSignal] = useState('');
    const [messageDataType, setMessageDataType] = useState('');
    const [messageDirection, setMessageDirection] = useState<'entrada' | 'salida'>('entrada');
    const [interruptHandler, setInterruptHandler] = useState('');
    const [newName, setNewName] = useState('');
    const [assignNodeName, setAssignNodeName] = useState('');
    const [selectedNominalPort, setSelectedNominalPort] = useState<string | null>(null);
    const [newDataTypeName, setNewDataTypeName] = useState('');
    const [showNewDataTypeInput, setShowNewDataTypeInput] = useState(false);

    const handleAddMessage = useCallback(() => {
        if (messageSignal && messageDataType) {
            setMessages((prevMessages) => [...prevMessages, { signal: messageSignal, dataType: messageDataType, direction: messageDirection }]);
            setMessageSignal('');
            setMessageDataType('');
        }
    }, [messageSignal, messageDataType, messageDirection]);

    const handleRemoveMessage = useCallback((index: number) => {
      setMessages((prevMessages) => prevMessages.filter((_, i) => i !== index));
    }, []);

    const handleAddNewDataType = useCallback(() => {
      if (newDataTypeName.trim()) {
        handleAddDataType(newDataTypeName.trim());
        setMessageDataType(newDataTypeName.trim());
        setNewDataTypeName('');
        setShowNewDataTypeInput(false);
      }
    }, [newDataTypeName, handleAddDataType, setMessageDataType]);

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

    const handleSubmitPort = useCallback((e: FormEvent) => {
        e.preventDefault();
        onAddPort(portName, portType, portSubtype, messages, interruptHandler);
        onClose();
    }, [onAddPort, portName, portType, portSubtype, messages, interruptHandler, onClose]);
    
    const handleGenerateConjugate = useCallback(() => {
        if (selectedNominalPort) {
            onAddConjugatePort(nodeId, selectedNominalPort);
            onClose();
        }
    }, [onAddConjugatePort, nodeId, selectedNominalPort, onClose]);

    const handleSubmitRename = useCallback((e: FormEvent) => {
        e.preventDefault();
        onRename(newName);
        onClose();
    }, [onRename, newName, onClose]);

    const handleSubmitAssignNode = useCallback((e: FormEvent) => {
        e.preventDefault();
        onAssignNode(assignNodeName);
        onClose();
    }, [onAssignNode, assignNodeName, onClose]);

    const renderMainView = () => (
        <>
            <button onClick={() => setView('addPort')}>Añadir Puerto</button>
            <button onClick={() => {
                const nominalPorts = nodes.flatMap(node =>
                    node.data.ports.filter(port => port.type === 'comunicacion' && port.subtype === 'nominal')
                );
                if (nominalPorts.length === 0) {
                    alert('No hay puertos nominales para generar un puerto conjugado.');
                } else {
                    setView('generateConjugate');
                }
            }}>Generar Puerto Conjugado</button>
            <button onClick={() => setView('rename')}>Renombrar Componente</button>
            <button onClick={() => setView('assignNode')}>Asignar Nodo</button>
        </>
    );

    const renderAddPortView = () => (
        <form onSubmit={handleSubmitPort}>
            <label>
                Nombre del Puerto:
                <input type="text" value={portName} onChange={(e: ChangeEvent<HTMLInputElement>) => setPortName(e.target.value)} required />
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
            <button type="button" onClick={() => setView('main')}>Volver</button>
        </form>
    );

    const renderGenerateConjugateView = () => {
        const nominalPorts = nodes.flatMap(node => 
            node.data.ports
                .filter(port => port.type === 'comunicacion' && port.subtype === 'nominal')
                .map(port => ({ ...port, componentName: node.data.name }))
        );

        return (
            <div>
                <h4>Seleccionar Puerto Nominal</h4>
                <select onChange={(e) => setSelectedNominalPort(e.target.value)} value={selectedNominalPort || ""} title="Seleccionar puerto nominal">
                    <option value="">Selecciona un puerto...</option>
                    {nominalPorts.map(port => (
                        <option key={port.id} value={port.id}>
                            {port.componentName} - {port.name}
                        </option>
                    ))}
                </select>
                <button onClick={handleGenerateConjugate} disabled={!selectedNominalPort}>Generar</button>
                <button onClick={() => setView('main')}>Volver</button>
            </div>
        );
    };

    const renderRenameView = () => (
        <form onSubmit={handleSubmitRename}>
            <label htmlFor="new-name">
                Nuevo Nombre:
                <input id="new-name" type="text" value={newName} onChange={(e: ChangeEvent<HTMLInputElement>) => setNewName(e.target.value)} required />
            </label>
            <button type="submit">Renombrar</button>
            <button type="button" onClick={() => setView('main')}>Volver</button>
        </form>
    );

    const renderAssignNodeView = () => (
        <form onSubmit={handleSubmitAssignNode}>
            <label htmlFor="assign-node-name">
                Asignar al Nodo:
                <input id="assign-node-name" type="text" value={assignNodeName} onChange={(e: ChangeEvent<HTMLInputElement>) => setAssignNodeName(e.target.value)} required />
            </label>
            <button type="submit">Asignar</button>
            <button type="button" onClick={() => setView('main')}>Volver</button>
        </form>
    );

    return (
        <div className="context-menu" style={{ top: y, left: x }}>
            {view === 'main' && renderMainView()}
            {view === 'addPort' && renderAddPortView()}
            {view === 'rename' && renderRenameView()}
            {view === 'assignNode' && renderAssignNodeView()}
            {view === 'generateConjugate' && renderGenerateConjugateView()}
            <button className="bottom-close-button" onClick={onClose}>Cerrar</button>
        </div>
    );
};

export default ContextMenu;