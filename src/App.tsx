/**
 * App.tsx
 * Componente principal de la aplicación Connectus.
 * Gestiona el estado global, renderiza el diagrama de componentes y coordina la interacción entre nodos, puertos y herramientas.
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Controls,
  MiniMap,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { saveAs } from 'file-saver';
import './App.css';

import type { Node, Edge, Connection, EdgeChange, OnNodesChange, NodeData, PortData, NodeProps, NodeChange, Message } from './types';

import ComponentNode from './ComponentNode';
import ContextMenu from './ContextMenu';
import PortInfoPanel from './PortInfoPanel';
import ComponentAttributesPanel from './ComponentAttributesPanel';
import { CodeGenerator } from './CodeGenerator';
import NotificationBar from './NotificationBar';
import AboutModal from './AboutModal';

/**
 * Estructura para las notificaciones mostradas al usuario.
 */
type Notification = {
  message: string;
  type: 'success' | 'error' | 'info';
};

/**
 * Nodos iniciales del diagrama.
 */
const initialNodes: Node<NodeData>[] = [
  { id: '1', type: 'componentNode', data: { name: 'Component', ports: [], node: 'Node', componentId: 1, maxMessages: 13, priority: 'EDROOMprioHigh', stackSize: 8192, isTop: true }, position: { x: 250, y: 50 }, selectable: true, style: { zIndex: 1 } }
];

/**
 * Conexiones iniciales del diagrama.
 */
const initialEdges: Edge[] = [];

/**
 * Componente principal que gestiona el diagrama y la interacción global.
 */
const App: React.FC = () => {
  // Estado principal de nodos, conexiones y utilidades de la interfaz
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const nodeIdCounter = useRef(4);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string; } | null>(null);
  const [nodeColors, setNodeColors] = useState<Record<string, string>>({
    'NodeA': '#e0f7fa',
    'NodeB': '#fff3e0',
  });
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('edroom_diagrama');
  const [selectedPort, setSelectedPort] = useState<PortData | null>(null);
  const [selectedNodeToEdit, setSelectedNodeToEdit] = useState<Node<NodeData> | null>(null);
  const [dataTypes, setDataTypes] = useState<string[]>([]);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [showAbout, setShowAbout] = useState(false);

  const { getNodes, getEdges } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Muestra notificaciones temporales en la barra de estado.
   */
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  /**
   * Añade un nuevo componente al diagrama.
   */
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

    const defaultNodeName = `Nodo ${newComponentId}`;
    const hue = Math.floor(Math.random() * 360);
    const newColor = `hsl(${hue}, 70%, 85%)`;

    const newNode: Node<NodeData> = {
      id: newId,
      type: 'componentNode',
      data: {
          name: `Componente${newComponentId}`,
          ports: [],
          node: defaultNodeName,
          componentId: newComponentId,
          maxMessages: 10,
          priority: 'EDROOMprioNormal',
          stackSize: 2048,
          isTop: false
      },
      position: { x: Math.random() * 250, y: Math.random() * 250 },
      selectable: true,
      style: { zIndex: 1, backgroundColor: newColor },
    };

    setNodes((nds) => nds.concat(newNode));
    nodeIdCounter.current++;
  }, [setNodes, nodes]);

  /**
   * Actualiza los nodos cuando hay cambios en el diagrama.
   */
  const onNodesChange: OnNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      if (menu) setMenu(null);
    }, [setNodes, menu]
  );

  /**
   * Actualiza las conexiones (edges) cuando hay cambios en el diagrama.
   */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  /**
   * Gestiona la conexión entre puertos de nodos, validando tipos y nombres.
   */
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
        setNotification({ message: 'Error: Solo se pueden conectar puertos de comunicación.', type: 'error' });
        return;
      }

      const isNominalToConjugado = sourcePort?.subtype === 'nominal' && targetPort?.subtype === 'conjugado';
      const areDataTypesMatching = sourcePort?.messages?.[0]?.dataType === targetPort?.messages?.[0]?.dataType;
      const arePortNamesMatching = sourcePort?.name === targetPort?.name;

      if (!arePortNamesMatching) {
        setNotification({ message: 'Error: Los puertos solo se pueden conectar si tienen el mismo nombre.', type: 'error' });
        return;
      }

      if (isNominalToConjugado && areDataTypesMatching && arePortNamesMatching) {
        setEdges((eds) => addEdge(params, eds));
      } else if (!isNominalToConjugado) {
        setNotification({ message: 'Error: Un puerto de comunicación Nominal (salida) solo se puede conectar a un puerto de comunicación Conjugado (entrada).', type: 'error' });
      } else if (!areDataTypesMatching) {
        setNotification({ message: `Error de tipo de dato: Los tipos no coinciden. Origen: '${sourcePort?.messages?.[0]?.dataType}', Destino: '${targetPort?.messages?.[0]?.dataType}'.`, type: 'error' });
      }
    }, [setEdges, nodes, setNotification]
  );

  /**
   * Elimina conexiones seleccionadas.
   */
  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    setEdges((eds) => eds.filter(edge => !edgesToDelete.includes(edge)));
  }, [setEdges]);

  /**
   * Muestra el menú contextual al hacer clic derecho sobre un nodo.
   */
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  /**
   * Añade un puerto a un nodo específico.
   */
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

  /**
   * Elimina un nodo y sus conexiones.
   */
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setMenu(null);
  }, [setNodes, setEdges]);

  /**
   * Actualiza los atributos de un nodo, validando duplicados.
   */
  const handleUpdateNodeAttributes = useCallback((nodeId: string, data: Partial<NodeData>): boolean => {
    const newComponentId = data.componentId;
    const newComponentName = data.name;

    if (newComponentId !== undefined) {
        const isDuplicate = nodes.some(
            node => node.id !== nodeId && node.data.componentId === newComponentId
        );
        if (isDuplicate) {
            setNotification({ message: `Error: Ya existe un componente con el ID ${newComponentId}. Por favor, elige un ID diferente.`, type: 'error' });
            return false;
        }
    }

    if (newComponentName !== undefined && newComponentName.trim() !== '') {
        const isDuplicateName = nodes.some(
            node => node.id !== nodeId && node.data.name === newComponentName
        );
        if (isDuplicateName) {
            setNotification({ message: `Error: Ya existe un componente con el nombre "${newComponentName}". Por favor, elige un nombre diferente.`, type: 'error' });
            return false;
        }
    }

    const existingNode = nodes.find(node => node.id === nodeId);
    let newColor = existingNode?.style?.backgroundColor;

    if (data.node !== undefined && data.node !== existingNode?.data.node) {
        if (data.node !== '') {
            const hue = Math.floor(Math.random() * 360);
            const colorToSet = nodeColors[data.node] || `hsl(${hue}, 70%, 85%)`;

            setNodeColors(prevColors => ({
                ...prevColors,
                [data.node!]: colorToSet,
            }));
            newColor = colorToSet;
        } else {
            setNodeColors(prevColors => {
                const updatedColors = { ...prevColors };
                if (existingNode?.data.node) {
                    delete updatedColors[existingNode.data.node];
                }
                return updatedColors;
            });
            newColor = undefined;
        }
    }
    
    setNodes(nds => nds.map(node => {
        if (node.id === nodeId) {
            const updatedNodeData = {
                ...node.data,
                ...data,
            };
            const updatedStyle = newColor ? { ...node.style, backgroundColor: newColor } : { ...node.style, backgroundColor: undefined };
            
            return {
                ...node,
                data: updatedNodeData,
                style: updatedStyle,
            };
        }
        return node;
    }));

    setNotification({ message: 'Atributos del componente actualizados con éxito.', type: 'success' });
    return true;
    
  }, [setNodes, nodes, setNotification, nodeColors]);
  
  /**
   * Marca un nodo como 'top' y desmarca los demás.
   */
  const handleUpdateIsTop = useCallback((nodeId: string, isTop: boolean) => {
    setNodes(nds =>
      nds.map(node => {
        if (isTop && node.id === nodeId) {
          return { ...node, data: { ...node.data, isTop: true } };
        } else {
          return { ...node, data: { ...node.data, isTop: false } };
        }
      })
    );
  }, [setNodes]);

  /**
   * Añade un puerto conjugado a partir de un puerto nominal.
   */
  const handleAddConjugatePort = useCallback((nodeId: string, nominalPortId: string) => {
    let nominalPort: PortData | undefined;
    nodes.forEach(node => {
        const foundPort = node.data.ports.find(p => p.id === nominalPortId);
        if (foundPort && foundPort.type === 'comunicacion' && foundPort.subtype === 'nominal') {
            nominalPort = foundPort;
        }
    });

    if (!nominalPort) {
      setNotification({ message: 'Error: No se encontró el puerto nominal de origen.', type: 'error' });
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
          setNotification({ message: 'Error: Ya existe un puerto con este nombre en el componente.', type: 'error' });
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
  }, [nodes, setNodes, setMenu, setNotification]);

  /**
   * Elimina un puerto y sus conexiones asociadas.
   */
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

  /**
   * Selecciona un puerto para mostrar su información.
   */
  const handlePortClick = useCallback((portData: PortData) => {
    setSelectedPort(portData);
  }, []);

  /**
   * Define los tipos de nodos para ReactFlow.
   */
  const nodeTypes = useMemo(() => ({
    componentNode: (props: NodeProps<NodeData>) => (
      <ComponentNode
        {...props}
        onDeletePort={handleDeletePort}
        onPortClick={handlePortClick}
      />
    ),
  }), [handleDeletePort, handlePortClick]);

  /**
   * Genera el código fuente y lo descarga como ZIP.
   */
  const handleGenerateCode = useCallback(() => {
    CodeGenerator.generateCodeAndDownload(nodes, edges);
    setNotification({ message: 'Código generado y listo para descargar.', type: 'success' });
    setShowToolsMenu(false);
  }, [nodes, edges, setNotification]);

  /**
   * Descarga el diagrama actual en formato JSON.
   */
  const handleDownload = useCallback(() => {
    const data = JSON.stringify({ nodes: getNodes(), edges: getEdges() }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const fileName = downloadFileName.trim() || 'edroom_diagrama';
    saveAs(blob, `${fileName}.json`);
    setNotification({ message: `Diagrama '${fileName}' descargado con éxito.`, type: 'success' });
    setShowToolsMenu(false);
  }, [getNodes, getEdges, downloadFileName, setNotification]);

  /**
   * Carga un diagrama desde un archivo JSON.
   */
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
              const color = node.style?.backgroundColor || `hsl(${Math.floor(Math.random() * 360)}, 70%, 85%)`;
              newColors[node.data.node] = color;
            }
        });

        const updatedLoadedNodes = loadedNodes.map((node: Node<NodeData>) => {
            if (node.data.node && newColors[node.data.node]) {
                return {
                    ...node,
                    style: {
                        ...node.style,
                        backgroundColor: newColors[node.data.node],
                    },
                };
            }
            return node;
        });

        setNodes(updatedLoadedNodes);
        setEdges(loadedEdges);
        setNodeColors(newColors);

        setNotification({ message: 'Diagrama cargado con éxito!', type: 'success' });
        setShowToolsMenu(false);
      } catch (error) {
        setNotification({ message: 'Error al cargar el archivo. Asegúrate de que sea un archivo JSON válido.', type: 'error' });
        console.error('Error loading diagram:', error);
      } finally {
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  }, [setNotification]);

  /**
   * Abre el selector de archivos para cargar un diagrama.
   */
  const handleLoadButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Añade un nuevo tipo de dato personalizado.
   */
  const handleAddDataType = useCallback((newType: string) => {
    setDataTypes(prevTypes => {
      if (!prevTypes.includes(newType)) {
        return [...prevTypes, newType];
      }
      return prevTypes;
    });
  }, []);

  // Renderizado principal de la aplicación y sus paneles
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
              <button className="dropdown-item" onClick={() => setShowAbout(true)}>Acerca de</button>
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
      </ReactFlow>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onAddPort={(...args) => handleAddPort(menu.nodeId, ...args)}
          onAddConjugatePort={handleAddConjugatePort}
          onClose={() => setMenu(null)}
          onDeleteNode={handleDeleteNode}
          onEditAttributes={() => {
            const node = nodes.find(n => n.id === menu.nodeId);
            if (node) {
              setSelectedNodeToEdit(node);
              setMenu(null);
            }
          }}
          nodes={nodes}
          nodeId={menu.nodeId}
          handleAddDataType={handleAddDataType}
          dataTypes={dataTypes}
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
              onUpdateIsTop={handleUpdateIsTop}
          />
      )}
      {notification && <NotificationBar notification={notification} />}
      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
};

export default App;