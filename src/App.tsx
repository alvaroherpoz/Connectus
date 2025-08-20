import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Controls,
  MiniMap,
  Background,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { saveAs } from 'file-saver';
import './App.css';

import type { Node, Edge, Connection, EdgeChange, BackgroundVariant, OnNodesChange, NodeData, PortData, NodeProps, NodeChange, Message } from './types';

import ComponentNode from './ComponentNode';
import ContextMenu from './ContextMenu';
import PortInfoPanel from './PortInfoPanel';
import ComponentAttributesPanel from './ComponentAttributesPanel';
import { CodeGenerator } from './CodeGenerator';

const initialNodes: Node<NodeData>[] = [
  { id: '1', type: 'componentNode', data: { name: 'ICUASW', ports: [], node: 'NodeA', componentId: 1, maxMessages: 10, priority: 'EDROOMprioNormal', stackSize: 2048 }, position: { x: 250, y: 50 }, selectable: true, style: { zIndex: 1 } },
  { id: '2', type: 'componentNode', data: { name: 'ccbkgtcexec', ports: [], node: 'NodeA', componentId: 2, maxMessages: 10, priority: 'EDROOMprioNormal', stackSize: 2048 }, position: { x: 50, y: 200 }, selectable: true, style: { zIndex: 1 } },
  { id: '3', type: 'componentNode', data: { name: 'cctm_channelctrl', ports: [], node: 'NodeB', componentId: 3, maxMessages: 10, priority: 'EDROOMprioNormal', stackSize: 2048 }, position: { x: 450, y: 300 }, selectable: true, style: { zIndex: 1 } }
];
const initialEdges: Edge[] = [];

const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const nodeIdCounter = useRef(4);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string; } | null>(null);
  const [dataTypes, setDataTypes] = useState(['int', 'float', 'string', 'bool', 'char', 'CDRecovAction', 'CDTMList']);
  const [nodeColors, setNodeColors] = useState<Record<string, string>>({
    'NodeA': '#e0f7fa',
    'NodeB': '#fff3e0',
  });
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('edroom_diagrama');
  const [selectedPort, setSelectedPort] = useState<PortData | null>(null);
  const [selectedNodeToEdit, setSelectedNodeToEdit] = useState<Node<NodeData> | null>(null);

  const { getNodes, getEdges } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onAddNode = useCallback(() => {
    const newId = nodeIdCounter.current.toString();
    const existingComponentIds = nodes.map(node => node.data.componentId).sort((a, b) => a - b);
    let newComponentId = 1;
    for (let i = 0; i < existingComponentIds.length; i++) {
        if (existingComponentIds[i] > newComponentId) {
            break;
        }
        newComponentId++;
    }

    const newNode: Node<NodeData> = {
      id: newId,
      type: 'componentNode',
      data: { 
          name: `Componente${newComponentId}`, 
          ports: [], 
          node: '',
          componentId: newComponentId,
          maxMessages: 10,
          priority: 'EDROOMprioNormal',
          stackSize: 2048
      },
      position: { x: Math.random() * 250, y: Math.random() * 250 },
      selectable: true,
      style: { zIndex: 1 },
    };
    
    setNodes((nds) => nds.concat(newNode));
    nodeIdCounter.current++;
  }, [setNodes, nodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => { 
      setNodes((nds) => applyNodeChanges(changes, nds));
      if (menu) setMenu(null);
    }, [setNodes, menu]
  );
  
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );
  
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => 
        eds.filter(
          (edge) => !(edge.sourceHandle === params.sourceHandle || edge.targetHandle === params.targetHandle)
        )
      );

      const sourceNode = nodes.find(n => n.id === params.source);
      const targetNode = nodes.find(n => n.id === params.target);

      if (!sourceNode || !targetNode || !sourceNode.data || !targetNode.data) {
          return;
      }
      
      const sourcePort = sourceNode.data.ports.find(p => p.id === params.sourceHandle);
      const targetPort = targetNode.data.ports.find(p => p.id === params.targetHandle);
      
      const isCommunicationPort = sourcePort?.type === 'comunicacion' && targetPort?.type === 'comunicacion';
      
      if (!isCommunicationPort) {
        alert('Error: Solo se pueden conectar puertos de comunicación.');
        return;
      }
      
      const isNominalToConjugado = sourcePort?.subtype === 'nominal' && targetPort?.subtype === 'conjugado';
      const areDataTypesMatching = sourcePort?.messages?.[0]?.dataType === targetPort?.messages?.[0]?.dataType;
      const arePortNamesMatching = sourcePort?.name === targetPort?.name;

      if (!arePortNamesMatching) {
        alert('Error: Los puertos solo se pueden conectar si tienen el mismo nombre.');
        return;
      }

      if (isNominalToConjugado && areDataTypesMatching && arePortNamesMatching) {
        setEdges((eds) => addEdge(params, eds));
      } else if (!isNominalToConjugado) {
        alert('Error: Un puerto de comunicación Nominal (salida) solo se puede conectar a un puerto de comunicación Conjugado (entrada).');
      } else if (!areDataTypesMatching) {
        alert(`Error de tipo de dato: Los tipos no coinciden. Origen: '${sourcePort?.messages?.[0]?.dataType}', Destino: '${targetPort?.messages?.[0]?.dataType}'.`);
      }
    }, [setEdges, nodes]
  );

  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    setEdges((eds) => eds.filter(edge => !edgesToDelete.includes(edge)));
  }, [setEdges]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const handleAddPort = useCallback(
      (nodeId: string, name: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'nominal' | 'conjugado' | undefined, messages: Message[], interruptHandler?: string) => {
          setNodes((nds) =>
              nds.map((node) => {
                  if (node.id === nodeId) {
                      const newPort: PortData = {
                          id: `${node.id}-${name}`,
                          name,
                          type,
                          subtype,
                          messages,
                          interruptHandler,
                      };
                      return {
                          ...node,
                          data: {
                              ...node.data,
                              ports: [...node.data.ports, newPort],
                          },
                      };
                  }
                  return node;
              })
          );
          setMenu(null);
      },
      [setNodes, setMenu]
  );
  
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setMenu(null);
  }, [setNodes, setEdges]);
  
  const handleUpdateNodeAttributes = useCallback((nodeId: string, data: Partial<NodeData>) => {
    setNodes(nds => nds.map(node => {
      if (node.id === nodeId) {
        return {
          ...node,
          data: {
            ...node.data,
            ...data
          }
        };
      }
      return node;
    }));
    setSelectedNodeToEdit(null);
  }, [setNodes]);

  const handleAddDataType = useCallback((newType: string) => {
    if (newType && !dataTypes.includes(newType)) {
      setDataTypes((prevTypes) => [...prevTypes, newType]);
    }
  }, [dataTypes, setDataTypes]);

  const handleAddConjugatePort = useCallback((nodeId: string, nominalPortId: string) => {
    let nominalPort: PortData | undefined;
    nodes.forEach(node => {
        const foundPort = node.data.ports.find(p => p.id === nominalPortId);
        if (foundPort && foundPort.type === 'comunicacion' && foundPort.subtype === 'nominal') {
            nominalPort = foundPort;
        }
    });

    if (!nominalPort) {
        alert('Error: No se encontró el puerto nominal de origen.');
        setMenu(null);
        return;
    }

    const conjugatedMessages = nominalPort.messages?.map(msg => ({
        ...msg,
        direction: msg.direction === 'entrada' ? 'salida' : 'entrada',
    }));

    const newPort: PortData = {
        id: `${nodeId}-${nominalPort.name}`,
        name: nominalPort.name,
        type: 'comunicacion',
        subtype: 'conjugado',
        messages: conjugatedMessages as Message[],
    };
    
    setNodes(nds => nds.map(node => {
        if (node.id === nodeId) {
            const portExists = node.data.ports.some(p => p.id === newPort.id);
            if (portExists) {
                alert('Error: Ya existe un puerto con este nombre en el componente.');
                return node;
            }
            return {
                ...node,
                data: {
                    ...node.data,
                    ports: [...node.data.ports, newPort],
                },
            };
        }
        return node;
    }));
    setMenu(null);
  }, [nodes, setNodes, setMenu]);
  
  const handleRenameComponent = useCallback((newName: string) => {
    if (!menu || !newName) return;
    setNodes(nds => nds.map(node => {
      if (node.id === menu.nodeId) {
        return { ...node, data: { ...node.data, name: newName } };
      }
      return node;
    }));
    setMenu(null);
  }, [menu, setNodes]);

  const handleAssignNode = useCallback((nodeName: string) => {
    if (!menu || !nodeName) return;

    let color = nodeColors[nodeName];
    if (!color) {
      const hue = Math.floor(Math.random() * 360);
      color = `hsl(${hue}, 70%, 85%)`;
      setNodeColors(prevColors => ({ ...prevColors, [nodeName]: color }));
    }

    setNodes(nds => nds.map(node => {
      if (node.id === menu.nodeId) {
        return { 
            ...node, 
            data: { ...node.data, node: nodeName },
            style: { ...node.style, zIndex: 1 } 
        };
      }
      return node;
    }));
    setMenu(null);
  }, [menu, setNodes, nodeColors, setNodeColors]);

  const handleDeletePort = useCallback((nodeId: string, portId: string) => {
    const edgesToDelete = edges.filter(edge => edge.sourceHandle === portId || edge.targetHandle === portId);
    
    if (edgesToDelete.length > 0) {
      const confirmation = window.confirm("Este puerto está conectado. ¿Estás seguro de que quieres eliminar el puerto y todas sus conexiones?");
      if (!confirmation) {
          return;
      }
      setEdges((eds) => eds.filter(edge => !edgesToDelete.includes(edge)));
    }
    setNodes((nds) => nds.map(node => {
      if (node.id === nodeId) {
        const updatedPorts = node.data.ports.filter(p => p.id !== portId);
        return { ...node, data: { ...node.data, ports: updatedPorts } };
      }
      return node;
    }));
    setSelectedPort(null);
  }, [setNodes, setEdges, edges, setSelectedPort]);
  
  const handlePortClick = useCallback((portData: PortData) => {
    setSelectedPort(portData);
  }, []);

  const nodeTypes = useMemo(() => ({
    componentNode: (props: NodeProps<NodeData>) => (
      <ComponentNode
        {...props}
        onDeletePort={handleDeletePort}
        onPortClick={handlePortClick}
        nodeColors={nodeColors}
      />
    ),
  }), [handleDeletePort, handlePortClick, nodeColors]);

  const handleGenerateCode = useCallback(() => {
    CodeGenerator.generateCodeAndDownload(nodes, edges);
    setShowToolsMenu(false);
  }, [nodes, edges]);

  const handleDownload = useCallback(() => {
    const data = JSON.stringify({ nodes: getNodes(), edges: getEdges() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const fileName = downloadFileName.trim() || 'edroom_diagrama';
    saveAs(blob, `${fileName}.json`);
    setShowToolsMenu(false);
  }, [getNodes, getEdges, downloadFileName]);

  const handleLoad = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsedData = JSON.parse(content);
        
        const loadedNodes = parsedData.nodes;
        const loadedEdges = parsedData.edges;

        const newColors: Record<string, string> = {};
        loadedNodes.forEach((node: Node<NodeData>) => {
            if (node.data.node) {
                if (node.style && node.style.backgroundColor) {
                    newColors[node.data.node] = node.style.backgroundColor;
                } else if (!newColors[node.data.node]) {
                    const hue = Math.floor(Math.random() * 360);
                    newColors[node.data.node] = `hsl(${hue}, 70%, 85%)`;
                }
            }
        });
        
        setNodes(loadedNodes);
        setEdges(loadedEdges);
        setNodeColors(newColors);

        alert('Diagrama cargado con éxito!');
        setShowToolsMenu(false);
      } catch (error) {
        alert('Error al cargar el archivo. Asegúrate de que sea un archivo JSON válido.');
        console.error('Error loading diagram:', error);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  }, []);

  const handleLoadButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="app-container">
      <div className="toolbar">
        <button className="toolbar-button" onClick={onAddNode}>
          Añadir Componente
        </button>
        <div className="tools-dropdown">
          <button className="toolbar-button toolbar-button-tools" onClick={() => setShowToolsMenu(!showToolsMenu)}>Herramientas</button>
          {showToolsMenu && (
            <div className="dropdown-menu">
              <div className="dropdown-item file-input-container">
                <input
                  type="text"
                  placeholder="Nombre del archivo"
                  value={downloadFileName}
                  onChange={(e) => setDownloadFileName(e.target.value)}
                />
                <button onClick={handleDownload}>Descargar Diagrama</button>
              </div>
              <button className="dropdown-item" onClick={handleLoadButtonClick}>Cargar Diagrama</button>
              <button className="dropdown-item" onClick={handleGenerateCode}>Generar Código</button>
            </div>
          )}
        </div>
      </div>
      
      <label htmlFor="file-upload" className="hidden-input-label">Cargar Archivo</label>
      <input
        id="file-upload"
        type="file"
        ref={fileInputRef}
        onChange={handleLoad}
        className="hidden-input"
        accept=".json,.edroom"
      />

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
        onEdgesDelete={onEdgesDelete}
        fitView
        nodeTypes={nodeTypes}
      >
        <Controls />
        <MiniMap />
        <Background variant={"dots" as BackgroundVariant} gap={12} size={1} />
      </ReactFlow>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onAddPort={(...args) => handleAddPort(menu.nodeId, ...args)}
          onAddConjugatePort={handleAddConjugatePort}
          onRename={handleRenameComponent}
          onClose={() => setMenu(null)}
          onDeleteNode={handleDeleteNode}
          onEditAttributes={() => {
            const node = nodes.find(n => n.id === menu.nodeId);
            if (node) {
              setSelectedNodeToEdit(node);
              setMenu(null);
            }
          }}
          dataTypes={dataTypes}
          onAssignNode={handleAssignNode}
          handleAddDataType={handleAddDataType}
          nodes={nodes}
          nodeId={menu.nodeId}
        />
      )}
      {selectedPort && (
        <PortInfoPanel
          port={selectedPort}
          onClose={() => setSelectedPort(null)}
        />
      )}
      {selectedNodeToEdit && (
          <ComponentAttributesPanel
              nodeId={selectedNodeToEdit.id}
              nodeData={selectedNodeToEdit.data}
              onClose={() => setSelectedNodeToEdit(null)}
              onUpdateNode={handleUpdateNodeAttributes}
          />
      )}
    </div>
  );
};

export default App;