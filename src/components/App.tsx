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
import '../types/App.css';

import type { Node, Edge, Connection, EdgeChange, OnNodesChange, NodeData, PortData, NodeProps, NodeChange, Message, ComponentPriority } from './types';

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
  // Se inicializa el contador de IDs para los nuevos nodos, asegurando que sean números.
  const nodeIdCounter = useRef(4);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string; } | null>(null);
  const [nodeColors, setNodeColors] = useState<Record<string, string>>({
    'NodeA': '#e0f7fa',
    'NodeB': '#fff3e0',
  });
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [downloadFileName, setDownloadFileName] = useState('edroom_diagrama');
  const [selectedPort, setSelectedPort] = useState<{ port: PortData, nodeId: string } | null>(null);
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
    // Genera un ID numérico y lo convierte a string, como requiere ReactFlow.
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
          priority: 'EDROOMprioNormal' as ComponentPriority,
          stackSize: 2048,
          isTop: false
      },
      position: { x: Math.random() * 250, y: Math.random() * 250 },
      selectable: true,
      style: { zIndex: 1, backgroundColor: newColor },
    };

    setNodes((nds) => nds.concat(newNode));
    nodeIdCounter.current++;
    setNotification({ message: `Componente "${newNode.data.name}" añadido con éxito.`, type: 'success' });
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
      const areProtocolNamesMatching = sourcePort?.protocolName === targetPort?.protocolName;

      // Se eliminó la validación areDataTypesMatching para simplificar la lógica de conexión.
      // La validación de tipos de mensajes ahora se realiza en el PortInfoPanel.
      
      if (!areProtocolNamesMatching) {
        setNotification({ message: 'Error: Los puertos solo se pueden conectar si tienen el mismo nombre de protocolo.', type: 'error' });
        return;
      }

      if (isNominalToConjugado && areProtocolNamesMatching) {
        setEdges((eds) => addEdge(params, eds));
        setNotification({ message: 'Conexión exitosa.', type: 'success' });
      } else if (!isNominalToConjugado) {
        setNotification({ message: 'Error: Un puerto de comunicación Nominal (salida) solo se puede conectar a un puerto de comunicación Conjugado (entrada).', type: 'error' });
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
   * Se ha modificado para devolver un booleano (true=éxito, false=error).
   */
  const handleAddPort = useCallback(
    (nodeId: string, name: string, portId: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'nominal' | 'conjugado' | undefined, protocolName?: string, messages?: Message[], interruptHandler?: string): boolean => {
      // Validación: El ID del puerto debe ser solo números
      if (!/^\d+$/.test(portId)) {
        setNotification({ message: 'Error: El ID del puerto debe contener solo números.', type: 'error' });
        return false;
      }

      setNodes((nds) =>
        nds.map((node) => {
          if (node.id === nodeId) {
            const newPort: PortData = {
              id: portId,
              name,
              type,
              subtype,
              protocolName,
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
      setNotification({ message: `Puerto "${name}" añadido con éxito.`, type: 'success' });
      return true;
    },
    [setNodes, setNotification]
  );

  /**
   * Elimina un nodo y sus conexiones.
   */
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setMenu(null);
    setNotification({ message: 'Componente eliminado.', type: 'success' });
  }, [setNodes, setEdges, setNotification]);

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
   * CORRECCIÓN: Se usa un ID compuesto para el puerto nominal para evitar ambigüedades.
   */
  const handleAddConjugatePort = useCallback((targetNodeId: string, compositeNominalPortId: string, newConjugatePortId: string, newConjugatePortName: string) => {
    const [sourceNodeId, sourcePortId] = compositeNominalPortId.split(':');

    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    const nominalPort = sourceNode?.data.ports.find((p: PortData) => 
        p.id === sourcePortId && 
        p.type === 'comunicacion' && 
        p.subtype === 'nominal'
    );

    if (!nominalPort) {
      setNotification({ message: 'Error: No se encontró el puerto nominal de origen.', type: 'error' });
      setMenu(null);
      return;
    }
    
    // Se crea el nuevo puerto conjugado con el ID y nombre proporcionados por el usuario
    const newPort: PortData = {
      id: newConjugatePortId,
      name: newConjugatePortName,
      type: 'comunicacion',
      subtype: 'conjugado',
      protocolName: nominalPort.protocolName,
      messages: nominalPort.messages?.map(msg => ({ ...msg })), // Las direcciones ya no se invierten
    };

    setNodes(nds => nds.map(node => {
      if (node.id === targetNodeId) {
        // La validación principal se hace en ContextMenu, pero esto sirve como salvaguarda.
        const portExists = node.data.ports.some(p => p.id === newPort.id);
        if (portExists) {
          setNotification({ message: `Error: Ya existe un puerto con el ID "${newPort.id}" en el componente.`, type: 'error' });
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
    setNotification({ message: `Puerto conjugado "${newPort.name}" añadido con éxito.`, type: 'success' });
    setMenu(null);
  }, [nodes, setNodes, setMenu, setNotification]);


  /**
   * Elimina un puerto y sus conexiones asociadas.
   */
   const handleDeletePort = useCallback((nodeId: string, portId: string) => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const nodeToDeleteFrom = currentNodes.find((n) => n.id === nodeId);
    const portToDelete = nodeToDeleteFrom?.data.ports.find((p: PortData) => p.id === portId);

    if (!portToDelete) return;

    // Caso 1: Borrar un puerto nominal conectado. Deberíamos borrar también su conjugado.
    if (portToDelete.type === 'comunicacion' && portToDelete.subtype === 'nominal') {
        const connection = currentEdges.find((edge) => edge.source === nodeId && edge.sourceHandle === portId);

        if (connection) {
            const confirmation = window.confirm("Este puerto nominal está conectado. ¿Estás seguro de que quieres eliminarlo junto con su puerto conjugado y la conexión?");
            if (!confirmation) return;

            const conjugateNodeId = connection.target;
            const conjugatePortId = connection.targetHandle;

            // Realizar el borrado en cascada
            setNodes((nds) =>
                nds.map((n) => {
                    let ports = n.data.ports;
                    if (n.id === nodeId) { // Borrar el puerto nominal
                        ports = ports.filter((p) => p.id !== portId);
                    }
                    if (n.id === conjugateNodeId) { // Borrar el puerto conjugado
                        ports = ports.filter((p) => p.id !== conjugatePortId);
                    }
                    return { ...n, data: { ...n.data, ports: ports } };
                })
            );
            setEdges((eds) => eds.filter((e) => e.id !== connection.id));
            setNotification({ message: 'Puerto nominal, conjugado y conexión eliminados.', type: 'success' });
            setSelectedPort(null);
            return;
        }
    }

    // Caso 2: Comportamiento por defecto para otros puertos (o nominales no conectados)
    const otherEdgesToDelete = currentEdges.filter(
        (edge) => (edge.source === nodeId && edge.sourceHandle === portId) || (edge.target === nodeId && edge.targetHandle === portId)
    );

    if (otherEdgesToDelete.length > 0) {
        if (!window.confirm("Este puerto está conectado. ¿Estás seguro de que quieres eliminar el puerto y todas sus conexiones?")) {
            return;
        }
    }

    setEdges((eds) => eds.filter((edge) => !otherEdgesToDelete.includes(edge)));
    setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ports: n.data.ports.filter((p) => p.id !== portId) } } : n))
    );
    
    setSelectedPort(null);
    setNotification({ message: 'Puerto eliminado.', type: 'success' });
  }, [getNodes, getEdges, setNodes, setEdges, setNotification, setSelectedPort]);

  /**
   * Selecciona un puerto para mostrar su información.
   */
  const handlePortClick = useCallback((portData: PortData, nodeId: string) => {
    setSelectedPort(currentSelected => {
        // Si el panel del mismo puerto (mismo ID y mismo nodo) ya está abierto, lo cierra.
        if (currentSelected && currentSelected.port.id === portData.id && currentSelected.nodeId === nodeId) {
            return null;
        }
        // Si no, abre el panel para el puerto clicado.
        return { port: portData, nodeId };
    });
  }, [setSelectedPort]);

  /**
   * Actualiza la lista de mensajes de un puerto.
   */
  const handleUpdatePortMessages = useCallback((nodeId: string, portId: string, newMessages: Message[]) => {
    setNodes(prevNodes => {
      // Buscar la conexión del puerto que se está editando
      const connection = edges.find(edge => 
        (edge.source === nodeId && edge.sourceHandle === portId) || 
        (edge.target === nodeId && edge.targetHandle === portId)
      );

      // Si no hay conexión, solo se actualiza el puerto actual
      if (!connection) {
        return prevNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ports: node.data.ports.map(p => (p.id === portId ? { ...p, messages: newMessages } : p)),
              },
            };
          }
          return node;
        });
      }

      // Si hay conexión, se sincronizan ambos puertos
      const isSource = connection.source === nodeId;
      const connectedNodeId = isSource ? connection.target : connection.source;
      const connectedPortId = isSource ? connection.targetHandle : connection.sourceHandle;

      // Los mensajes del puerto conectado se sincronizan para ser idénticos.
      const syncedMessages: Message[] = newMessages.map(msg => ({ ...msg }));

      // Actualizar ambos puertos en el estado de los nodos
      return prevNodes.map(node => {
        // Actualizar el puerto principal
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ports: node.data.ports.map(p => (p.id === portId ? { ...p, messages: newMessages } : p)),
            },
          };
        }
        // Actualizar el puerto conectado
        if (node.id === connectedNodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ports: node.data.ports.map(p => (p.id === connectedPortId ? { ...p, messages: syncedMessages } : p)),
            },
          };
        }
        return node;
      });
    });

    setNotification({ message: 'Mensajes del puerto actualizados y sincronizados con el puerto conectado.', type: 'success' });
  }, [setNodes, edges, setNotification]);
  
  /**
   * Actualiza el ID y el nombre de un puerto.
   */
  const handleUpdatePortId = useCallback((nodeId: string, oldPortId: string, newPortId: string, newPortName: string): boolean => {
    // Validación: El ID del puerto debe ser solo números
    if (!/^\d+$/.test(newPortId)) {
      setNotification({ message: 'Error: El ID del puerto debe contener solo números.', type: 'error' });
      return false;
    }
    
    // Validar si el nuevo ID ya existe en el mismo nodo
    const isDuplicateId = nodes.some(node =>
        node.id === nodeId && node.data.ports.some(p => p.id === newPortId && p.id !== oldPortId)
    );
    if (isDuplicateId) {
        setNotification({ message: `Error: Ya existe un puerto con el ID "${newPortId}" en este componente.`, type: 'error' });
        return false;
    }

    // Validar si el nuevo nombre ya existe en el mismo nodo
    const isDuplicateName = nodes.some(node =>
        node.id === nodeId && node.data.ports.some(p => p.name === newPortName && p.id !== oldPortId)
    );
    if (isDuplicateName) {
        setNotification({ message: `Error: Ya existe un puerto con el nombre "${newPortName}" en este componente.`, type: 'error' });
        return false;
    }

    // Actualizar los nodos
    setNodes(prevNodes => {
      let updatedNodes = [...prevNodes];

      // Buscar la conexión antes de realizar cambios
      const connection = edges.find(edge => 
        (edge.source === nodeId && edge.sourceHandle === oldPortId) || 
        (edge.target === nodeId && edge.targetHandle === oldPortId)
      );

      // Actualizar todos los nodos relevantes
      updatedNodes = updatedNodes.map(node => {
        // Actualizar el puerto principal
        if (node.id === nodeId) {
          const updatedPorts = node.data.ports.map(p => 
            p.id === oldPortId ? { ...p, id: newPortId, name: newPortName } : p
          );
          return { ...node, data: { ...node.data, ports: updatedPorts } };
        }

        // Actualizar el nombre del puerto conectado
        if (connection && node.id === (connection.source === nodeId ? connection.target : connection.source)) {
          const connectedPortId = connection.source === nodeId ? connection.targetHandle : connection.sourceHandle;
          const updatedPorts = node.data.ports.map(p => 
            p.id === connectedPortId ? { ...p, name: newPortName } : p
          );
          return { ...node, data: { ...node.data, ports: updatedPorts } };
        }

        return node;
      });

      return updatedNodes;
    });

    // Actualizar las conexiones si el ID del puerto ha cambiado
    if (oldPortId !== newPortId) {
      setEdges(prevEdges => prevEdges.map(edge => {
          if (edge.source === nodeId && edge.sourceHandle === oldPortId) {
              return { ...edge, sourceHandle: newPortId };
          }
          if (edge.target === nodeId && edge.targetHandle === oldPortId) {
              return { ...edge, targetHandle: newPortId };
          }
          return edge;
      }));
    }

    return true;
  }, [setNodes, setEdges, nodes, edges, setNotification]);


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
          // Pasa la función de añadir puerto que ahora devuelve un booleano
          onAddPort={handleAddPort}
          // Pasa la función para añadir puerto conjugado
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
          setNotification={setNotification}
        />
      )}
      {selectedPort && (
        <PortInfoPanel
          port={selectedPort.port}
          nodeId={selectedPort.nodeId}
          onClose={() => setSelectedPort(null)}
          onUpdatePortMessages={handleUpdatePortMessages}
          onUpdatePortId={handleUpdatePortId} // Se agregó la nueva prop
          dataTypes={dataTypes}
          setNotification={setNotification}
          handleAddDataType={handleAddDataType}
          nodes={nodes}
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