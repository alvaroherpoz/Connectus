/**
 * @fileoverview Componente principal de la aplicación Connectus.
 * Gestiona el estado global, renderiza el diagrama de componentes y coordina las interacciones.
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

import type { Node, Edge, Connection, EdgeChange, OnNodesChange, NodeData, PortData, NodeProps, Message, ComponentPriority } from './types';

import ComponentNode from './ComponentNode';
import ContextMenu from './ContextMenu';
import PortInfoPanel from './PortInfoPanel';
import ComponentAttributesPanel from './ComponentAttributesPanel';
import { CodeGenerator } from './CodeGenerator';
import NotificationBar from './NotificationBar';
import AboutModal from './AboutModal';

/**
 * Define la estructura para las notificaciones mostradas al usuario.
 */
type Notification = {
  message: string;
  type: 'success' | 'error' | 'info';
};

const initialEdges: Edge[] = [];

/**
 * Componente principal que gestiona el diagrama y la interacción global.
 */
const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
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
  const edgeUpdateSuccessful = useRef(true);

  /**
   * Establece el título de la página.
   * @effect
   */
  useEffect(() => {
    document.title = 'Connectus';
  }, []);

  /**
   * Gestiona la visibilidad de las notificaciones, ocultándolas después de 3 segundos.
   * @effect
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
   * Añade un nuevo componente al lienzo.
   * Genera un ID único para el componente y el nodo, y lo añade al estado.
   * Asigna un color aleatorio para la visualización del nodo lógico.
   */
  const onAddNode = useCallback(() => {
    const existingNodeIds = nodes.map(node => parseInt(node.id, 10)).filter(id => !isNaN(id)).sort((a, b) => a - b);
    let newNodeIdNum = 1;
    for (const id of existingNodeIds) {
        if (id > newNodeIdNum) {
            break;
        }
        newNodeIdNum++;
    }
    const newId = newNodeIdNum.toString();
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
          componentClass: `Clase${newComponentId}`,
          name: `Nombre${newComponentId}`,
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
    setNotification({ message: `Componente "${newNode.data.name}" añadido con éxito.`, type: 'success' });
  }, [setNodes, nodes]);

  /**
   * Callback para manejar los cambios en los nodos (movimiento, selección).
   * Cierra el menú contextual si está abierto.
   * @param {NodeChange[]} changes - Array de cambios aplicados a los nodos.
   */
  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      setMenu(null);
    }, [setNodes]
  );

  /**
   * Callback para manejar los cambios en las conexiones (edges).
   * @param {EdgeChange[]} changes - Array de cambios aplicados a las conexiones.
   */
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [setEdges]
  );

  /**
   * Callback que se ejecuta al intentar conectar dos puertos.
   * Valida que la conexión sea lógica (comunicación, nominal a conjugado, mismo protocolo).
   * @param {Connection} connection - El objeto de conexión propuesto.
   */
  const onConnect = useCallback(
    (connection: Connection) => {
      const sourceNode = getNodes().find(n => n.id === connection.source);
      const targetNode = getNodes().find(n => n.id === connection.target);

      if (!sourceNode || !targetNode || !sourceNode.data || !targetNode.data) {
          return;
      }

      const sourcePort = sourceNode.data.ports.find((p: PortData) => p.id === connection.sourceHandle);
      const targetPort = targetNode.data.ports.find((p: PortData) => p.id === connection.targetHandle);

      const isCommunicationPort = sourcePort?.type === 'comunicacion' && targetPort?.type === 'comunicacion';

      if (!isCommunicationPort) {
        setNotification({ message: 'Error: Solo se pueden conectar puertos de comunicación.', type: 'error' });
        return;
      }

      const isNominalToConjugado = sourcePort?.subtype === 'nominal' && targetPort?.subtype === 'conjugado';
      const areProtocolNamesMatching = sourcePort?.protocolName === targetPort?.protocolName;

      if (!areProtocolNamesMatching) {
        setNotification({ message: 'Error: Los puertos solo se pueden conectar si tienen el mismo nombre de protocolo.', type: 'error' });
        return;
      }

      if (isNominalToConjugado && areProtocolNamesMatching) {
        setEdges((eds) => addEdge(connection, eds));
        setNotification({ message: 'Conexión exitosa.', type: 'success' });
      } else if (!isNominalToConjugado) {
        setNotification({ message: 'Error: Un puerto de comunicación Nominal (salida) solo se puede conectar a un puerto de comunicación Conjugado (entrada).', type: 'error' });
      }
    }, [getNodes, setEdges, setNotification]
  );

  /**
   * Callback que se ejecuta al eliminar conexiones.
   * @param {Edge[]} edgesToDelete - Array de conexiones a eliminar.
   */
  const onEdgesDelete = useCallback((edgesToDelete: Edge[]) => {
    setEdges((eds) => eds.filter(edge => !edgesToDelete.includes(edge)));
  }, [setEdges]);

  /**
   * Se invoca al iniciar la actualización de una conexión (arrastrar un handle).
   * Marca la actualización como no exitosa inicialmente.
   */
  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false;
  }, []);

  /**
   * Se invoca cuando una conexión se actualiza a un nuevo handle válido.
   * Marca la actualización como exitosa y actualiza la conexión en el estado.
   * @param {Edge} oldEdge - La conexión antigua.
   * @param {Connection} newConnection - La nueva conexión propuesta.
   */
  const onEdgeUpdate = useCallback((oldEdge: Edge, newConnection: Connection) => {
    edgeUpdateSuccessful.current = true;
    setEdges((els) => addEdge(newConnection, els.filter((edge) => edge.id !== oldEdge.id)));
  }, [setEdges]);

  /**
   * Se invoca al soltar el handle de una conexión. Si no fue una actualización
   * exitosa (por ejemplo, un simple clic), se elimina la conexión.
   * @param {MouseEvent | TouchEvent} _ - El evento del ratón o táctil.
   * @param {Edge} edge - La conexión que se estaba actualizando.
   */
  const onEdgeUpdateEnd = useCallback((_: MouseEvent | TouchEvent, edge: Edge) => {
    if (!edgeUpdateSuccessful.current) {
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      setNotification({ message: 'Conexión eliminada.', type: 'success' });
    }
    edgeUpdateSuccessful.current = true;
  }, [setEdges, setNotification]);

  /**
   * Muestra el menú contextual en la posición del clic derecho sobre un nodo.
   * @param {React.MouseEvent} event - El evento del ratón.
   * @param {Node} node - El nodo sobre el que se hizo clic.
   */
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  /**
   * Añade un nuevo puerto a un nodo específico.
   * @param {string} nodeId - ID del nodo al que se añadirá el puerto.
   * @param {string} name - Nombre del nuevo puerto.
   * @param {string} portId - ID numérico del nuevo puerto.
   * @param {'comunicacion' | 'tiempo' | 'interrupcion'} type - Tipo del puerto.
   * @param {'nominal' | 'conjugado' | undefined} subtype - Subtipo para puertos de comunicación.
   * @param {string} [protocolName] - Nombre del protocolo para puertos de comunicación.
   * @param {Message[]} [messages] - Mensajes asociados para puertos de comunicación.
   * @returns {boolean} `true` si el puerto se añadió con éxito, `false` en caso de error.
   */
  const handleAddPort = useCallback(
    (nodeId: string, name: string, portId: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'nominal' | 'conjugado' | undefined, protocolName?: string, messages?: Message[]): void => {
      if (!/^\d+$/.test(portId)) {
        setNotification({ message: 'Error: El ID del puerto debe contener solo números.', type: 'error' });
        return;
      }

      setNodes((prevNodes) => {
        // Paso 1: Añadir el nuevo puerto al nodo de destino.
        const nodesWithNewPort = prevNodes.map((node) => {
          if (node.id === nodeId) {
            const newPort: PortData = {
              id: portId,
              name,
              type,
              subtype,
              protocolName,
              messages: messages?.map(msg => ({ ...msg })),
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
        });

        // Paso 2: Si es un puerto de comunicación, sincronizar los mensajes en todos los puertos con el mismo protocolo.
        if (type === 'comunicacion' && protocolName && messages) {
          return nodesWithNewPort.map(node => ({
            ...node,
            data: {
              ...node.data,
              ports: node.data.ports.map(p =>
                p.protocolName === protocolName ? { ...p, messages: messages.map(msg => ({ ...msg })) } : p
              ),
            },
          }));
        }

        return nodesWithNewPort;
      });
      setNotification({ message: `Puerto "${name}" añadido y protocolo sincronizado.`, type: 'success' });
    },
    [setNodes, setNotification]
  );

  /**
   * Elimina un nodo del lienzo y todas las conexiones asociadas a él.
   * @param {string} nodeId - El ID del nodo a eliminar.
   */
  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setMenu(null);
    setNotification({ message: 'Componente eliminado.', type: 'success' });
  }, [setNodes, setEdges, setNotification]);

  /**
   * Actualiza los atributos de un nodo específico.
   * Valida que el ID y el nombre del componente no estén duplicados.
   * @param {string} nodeId - El ID del nodo a actualizar.
   * @param {Partial<NodeData>} data - Un objeto con los datos del nodo a actualizar.
   * @returns {boolean} `true` si la actualización fue exitosa, `false` si hubo un error de validación.
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
   * Marca un nodo como el componente 'top' del sistema.
   * Solo puede haber un componente 'top' a la vez.
   * @param {string} nodeId - El ID del nodo a marcar como 'top'.
   * @param {boolean} isTop - El nuevo estado 'top'.
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
   * Añade un puerto conjugado a un nodo, basándose en un puerto nominal existente.
   * @param {string} targetNodeId - El ID del nodo donde se creará el puerto conjugado.
   * @param {string} compositeNominalPortId - ID compuesto del puerto nominal de origen (`nodeId:portId`).
   * @param {string} newConjugatePortId - El ID para el nuevo puerto conjugado.
   * @param {string} newConjugatePortName - El nombre para el nuevo puerto conjugado.
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
    
    const newPort: PortData = {
      id: newConjugatePortId,
      name: newConjugatePortName,
      type: 'comunicacion',
      subtype: 'conjugado',
      protocolName: nominalPort.protocolName,
      messages: nominalPort.messages?.map(msg => ({ ...msg })),
    };

    setNodes(nds => nds.map(node => {
      if (node.id === targetNodeId) {
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
   * Elimina un puerto de un nodo y sus conexiones asociadas.
   * @param {string} nodeId - El ID del nodo del que se eliminará el puerto.
   * @param {string} portId - El ID del puerto a eliminar.
   */
  const handleDeletePort = useCallback((nodeId: string, portId: string) => {
    const currentEdges = getEdges();
    const edgesToDelete = currentEdges.filter(
        (edge) => (edge.source === nodeId && edge.sourceHandle === portId) || (edge.target === nodeId && edge.targetHandle === portId)
    );

    if (edgesToDelete.length > 0) {
        if (!window.confirm("Este puerto está conectado. ¿Estás seguro de que quieres eliminar el puerto y todas sus conexiones?")) {
            return;
        }
    }

    setEdges((eds) => eds.filter((edge) => !edgesToDelete.includes(edge)));
    setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ports: n.data.ports.filter((p) => p.id !== portId) } } : n))
    );
    
    setSelectedPort(null);
    setNotification({ message: 'Puerto eliminado.', type: 'success' });
  }, [getEdges, setNodes, setEdges, setNotification, setSelectedPort]);

  /**
   * Gestiona el clic en un puerto, abriendo o cerrando su panel de información.
   * @param {PortData} portData - Los datos del puerto seleccionado.
   * @param {string} nodeId - El ID del nodo al que pertenece el puerto.
   */
  const handlePortClick = useCallback((portData: PortData, nodeId: string) => {
    setSelectedPort(currentSelected => {
        if (currentSelected && currentSelected.port.id === portData.id && currentSelected.nodeId === nodeId) {
            return null;
        }
        return { port: portData, nodeId };
    });
  }, [setSelectedPort]);

  /**
   * Actualiza la lista de mensajes de un puerto y sincroniza con el puerto conectado si existe.
   * @param {string} nodeId - ID del nodo del puerto a actualizar.
   * @param {string} portId - ID del puerto a actualizar.
   * @param {Message[]} newMessages - La nueva lista de mensajes.
   */
  const handleUpdatePortMessages = useCallback((nodeId: string, portId: string, newMessages: Message[]) => {
    setNodes(prevNodes => {
      const portToUpdate = prevNodes.find(n => n.id === nodeId)?.data.ports.find(p => p.id === portId);
      if (!portToUpdate || !portToUpdate.protocolName) {
        return prevNodes.map(node => {
          if (node.id === nodeId) {
            return {
              ...node,
              data: {
                ...node.data,
                ports: node.data.ports.map(p => (p.id === portId ? { ...p, messages: newMessages.map(msg => ({ ...msg })) } : p)),
              },
            };
          }
          return node;
        });
      }
      
      const protocolToUpdate = portToUpdate.protocolName;

      // Actualizar todos los puertos que comparten este protocolo.
      return prevNodes.map(node => {
        const needsUpdate = node.data.ports.some(p => p.protocolName === protocolToUpdate);
        if (!needsUpdate) return node;

        return {
          ...node,
          data: {
            ...node.data,
            ports: node.data.ports.map(p => 
              p.protocolName === protocolToUpdate ? { ...p, messages: newMessages.map(msg => ({ ...msg })) } : p
            ),
          },
        };
      });
    });

    setNotification({ message: 'Mensajes del protocolo actualizados en todos los puertos.', type: 'success' });
  }, [setNodes, setNotification]);
  
  /**
   * Actualiza el ID y el nombre de un puerto, validando duplicados y actualizando conexiones.
   * @param {string} nodeId - ID del nodo del puerto.
   * @param {string} oldPortId - ID antiguo del puerto.
   * @param {string} newPortId - Nuevo ID para el puerto.
   * @param {string} newPortName - Nuevo nombre para el puerto.
   * @returns {boolean} `true` si la actualización fue exitosa, `false` si hubo un error.
   */
  const handleUpdatePortId = useCallback((nodeId: string, oldPortId: string, newPortId: string, newPortName: string): boolean => {
    if (!/^\d+$/.test(newPortId)) {
      setNotification({ message: 'Error: El ID del puerto debe contener solo números.', type: 'error' });
      return false;
    }
    
    const isDuplicateId = nodes.some(node =>
        node.id === nodeId && node.data.ports.some(p => p.id === newPortId && p.id !== oldPortId)
    );
    if (isDuplicateId) {
        setNotification({ message: `Error: Ya existe un puerto con el ID "${newPortId}" en este componente.`, type: 'error' });
        return false;
    }

    const isDuplicateName = nodes.some(node =>
        node.id === nodeId && node.data.ports.some(p => p.name === newPortName && p.id !== oldPortId)
    );
    if (isDuplicateName) {
        setNotification({ message: `Error: Ya existe un puerto con el nombre "${newPortName}" en este componente.`, type: 'error' });
        return false;
    }

    setNodes(prevNodes =>
      prevNodes.map(node => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ports: node.data.ports.map(p =>
                p.id === oldPortId ? { ...p, id: newPortId, name: newPortName } : p
              ),
            },
          };
        }

        return node;
      })
    );

    if (oldPortId !== newPortId) {
      setEdges(prevEdges =>
        prevEdges.map(edge => {
          if (edge.source === nodeId && edge.sourceHandle === oldPortId) {
            return { ...edge, sourceHandle: newPortId };
          }
          if (edge.target === nodeId && edge.targetHandle === oldPortId) {
            return { ...edge, targetHandle: newPortId };
          }
          return edge;
        })
      );
    }

    return true;
  }, [setNodes, setEdges, nodes, setNotification]);


  /**
   * Memoiza los tipos de nodos personalizados para ReactFlow,
   * pasando las funciones de callback necesarias al `ComponentNode`.
   * @returns {object} Un objeto con los tipos de nodos personalizados.
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
   * Inicia la generación del código fuente y su descarga como un archivo ZIP.
   */
  const handleGenerateCode = useCallback(() => {
    CodeGenerator.generateCodeAndDownload(nodes, edges);
    setNotification({ message: 'Código generado y listo para descargar.', type: 'success' });
    setShowToolsMenu(false);
  }, [nodes, edges, setNotification]);

  /**
   * Guarda el estado actual del diagrama (nodos y conexiones) en un archivo JSON.
   */
  const handleDownload = useCallback(() => {
    const data = JSON.stringify({ nodes: nodes, edges: edges }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const fileName = downloadFileName.trim() || 'edroom_diagrama';
    saveAs(blob, `${fileName}.json`);
    setNotification({ message: `Diagrama '${fileName}' descargado con éxito.`, type: 'success' });
    setShowToolsMenu(false);
  }, [nodes, edges, downloadFileName, setNotification]);

  /**
   * Carga un diagrama desde un archivo JSON seleccionado por el usuario.
   * @param {React.ChangeEvent<HTMLInputElement>} event - El evento del input de archivo.
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
   * Simula un clic en el input de archivo oculto para abrir el diálogo de carga.
   */
  const handleLoadButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /**
   * Añade un nuevo tipo de dato a la lista de tipos de datos personalizados.
   * @param {string} newType - El nuevo tipo de dato a añadir.
   */
  const handleAddDataType = useCallback((newType: string) => {
    setDataTypes(prevTypes => {
      if (!prevTypes.includes(newType)) {
        return [...prevTypes, newType];
      }
      return prevTypes;
    });
  }, []);

  return (
    <div className="app-container">
      <div className="toolbar">
        <div className="toolbar-left">
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
        <h1 className="logo">Connectus</h1>
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
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
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
          onAddPort={handleAddPort}
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
          onUpdatePortId={handleUpdatePortId}
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