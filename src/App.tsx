import React, { useState, useCallback, useRef, useMemo } from 'react';
import ReactFlow, {
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  Controls,
  MiniMap,
  Background,
} from 'reactflow';
import type { Node, Edge, Connection, EdgeChange, BackgroundVariant, OnNodesChange, NodeProps } from 'reactflow';
import 'reactflow/dist/style.css'; 

import ComponentNode from './ComponentNode';
import ContextMenu from './ContextMenu';

import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface PortData {
  id: string;
  name: string;
  type: 'comunicacion' | 'tiempo' | 'interrupcion';
  dataType: string;
  subtype?: 'normal' | 'conjugado';
}

interface NodeData {
  name: string;
  ports: PortData[];
  node?: string;
}

const initialNodes: Node<NodeData>[] = [
  { id: '1', type: 'componentNode', data: { name: 'CPU', ports: [], node: 'NodeA' }, position: { x: 250, y: 50 } },
  { id: '2', type: 'componentNode', data: { name: 'Memoria', ports: [], node: 'NodeA' }, position: { x: 50, y: 200 } },
  { id: '3', type: 'componentNode', data: { name: 'GPIO', ports: [], node: 'NodeB' }, position: { x: 450, y: 300 } }
];
const initialEdges: Edge[] = [];

const App: React.FC = () => {
  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const nodeIdCounter = useRef(4);
  const [menu, setMenu] = useState<{ x: number; y: number; nodeId: string; } | null>(null);
  const [dataTypes, setDataTypes] = useState(['int', 'float', 'string', 'bool', 'char']);
  const [nodeColors, setNodeColors] = useState<Record<string, string>>({
    'NodeA': '#e0f7fa',
    'NodeB': '#fff3e0',
  });

  const onAddNode = useCallback(() => {
    const newId = nodeIdCounter.current.toString();
    const newNode: Node<NodeData> = {
      id: newId,
      type: 'componentNode',
      data: { name: `Componente ${newId}`, ports: [], node: '' },
      position: { x: Math.random() * 250, y: Math.random() * 250 },
    };
    setNodes((nds) => nds.concat(newNode));
    nodeIdCounter.current++;
  }, [setNodes]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
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
      
      const isNormalToConjugado = sourcePort?.subtype === 'normal' && targetPort?.subtype === 'conjugado';
      const areDataTypesMatching = sourcePort?.dataType === targetPort?.dataType;
      
      if (isNormalToConjugado && areDataTypesMatching) {
        setEdges((eds) => addEdge(params, eds));
      } else if (!isNormalToConjugado) {
        alert('Error: Un puerto de comunicación Normal (salida) solo se puede conectar a un puerto de comunicación Conjugado (entrada).');
      } else if (!areDataTypesMatching) {
        alert(`Error de tipo de dato: Los tipos no coinciden. Origen: '${sourcePort?.dataType}', Destino: '${targetPort?.dataType}'.`);
      }
    }, [setEdges, nodes]
  );

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setMenu({ x: event.clientX, y: event.clientY, nodeId: node.id });
  }, []);

  const handleAddPort = useCallback((name: string, type: 'comunicacion' | 'tiempo' | 'interrupcion', subtype: 'normal' | 'conjugado' | undefined, dataType: string) => {
    if (!menu) return;
    setNodes(nds => {
      return nds.map(node => {
        if (node.id === menu.nodeId) {
          const newPort: PortData = {
            id: `${node.id}-${name}-${Date.now()}`,
            name,
            type,
            subtype,
            dataType,
          };
          const newPorts = [...node.data.ports, newPort];
          return { ...node, data: { ...node.data, ports: newPorts } };
        }
        return node;
      });
    });
    setMenu(null);
    if (!dataTypes.includes(dataType)) {
      setDataTypes((prevDataTypes) => [...prevDataTypes, dataType]);
    }
  }, [menu, setNodes, dataTypes, setDataTypes]);

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
        return { ...node, data: { ...node.data, node: nodeName } };
      }
      return node;
    }));
    setMenu(null);
  }, [menu, setNodes, nodeColors, setNodeColors]);

  const handleDeletePort = useCallback((nodeId: string, portId: string) => {
    setEdges((eds) => eds.filter(edge => edge.sourceHandle !== portId && edge.targetHandle !== portId));

    setNodes((nds) => nds.map(node => {
      if (node.id === nodeId) {
        const updatedPorts = node.data.ports.filter(p => p.id !== portId);
        return { ...node, data: { ...node.data, ports: updatedPorts } };
      }
      return node;
    }));
  }, [setNodes, setEdges]);
  
  const nodeTypes = useMemo(() => ({
    componentNode: (props: NodeProps<NodeData>) => (
      <ComponentNode
        {...props}
        onDeletePort={handleDeletePort}
        nodeColors={nodeColors}
      />
    ),
  }), [handleDeletePort, nodeColors]);

  const handleGenerateCode = useCallback(() => {
    const mainZip = new JSZip();

    const components = nodes.map(node => ({
        id: node.id,
        name: node.data.name,
        nodeName: node.data.node,
        ports: node.data.ports,
    }));
    const connections = edges.map(edge => ({
        sourceId: edge.source,
        sourceHandle: edge.sourceHandle,
        targetId: edge.target,
        targetHandle: edge.targetHandle,
    }));

    const uniqueNodeNames = Array.from(new Set(components.map(c => c.nodeName).filter(name => typeof name === 'string')));
    
    uniqueNodeNames.forEach(localNodeName => {
        const nodeFolder = mainZip.folder(localNodeName);
        
        const localComponents = components.filter(c => c.nodeName === localNodeName);
        const remoteComponents = components.filter(c => c.nodeName !== localNodeName && c.nodeName);
        
        const srcFolder = nodeFolder?.folder("src");
        const localComponentsFolder = srcFolder?.folder("local/components");
        const remoteComponentsFolder = srcFolder?.folder("remote/components");
        const remoteNodesFolder = srcFolder?.folder("remote/nodes");

        const mainFileContent = `// main.c
// Archivo principal del sistema EDROOM para el nodo '${localNodeName}'
// Generado automáticamente por el editor de componentes.

#include "edroom_types.h"
#include "edroom_component.h"
${localComponents
    .map(c => `#include "local/components/${c.name.toLowerCase()}/${c.name.toLowerCase()}.h"`).join('\n')}
${remoteComponents
    .map(c => `#include "remote/components/${c.name.toLowerCase()}/${c.name.toLowerCase()}.h"`).join('\n')}

void setup_system() {
    ${components.map(c => `// edroom_comp_${c.name.toLowerCase()}_init();`).join('\n    ')}

    ${connections.map(conn => {
        const sourceComp = components.find(c => c.id === conn.sourceId);
        const targetComp = components.find(c => c.id === conn.targetId);
        const sourcePort = sourceComp?.ports.find(p => p.id === conn.sourceHandle);
        const targetPort = targetComp?.ports.find(p => p.id === conn.targetHandle);

        if (sourceComp && targetComp && sourcePort && targetPort) {
            return `    // Conexión: ${sourceComp.name}.${sourcePort.name} (${sourcePort.dataType}) -> ${targetComp.name}.${targetPort.name} (${targetPort.dataType})`;
        }
        return `    // Conexión no válida o incompleta: ${conn.sourceId}:${conn.sourceHandle} -> ${conn.targetId}:${conn.targetHandle}`;
    }).join('\n')}

    ${components.flatMap(c => c.ports.filter(p => p.type !== 'comunicacion').map(p => {
        if (p.type === 'tiempo') {
            return `    // Puerto de Tiempo: ${c.name}.${p.name} (${p.dataType})`;
        } else if (p.type === 'interrupcion') {
            return `    // Puerto de Interrupción: ${c.name}.${p.name} (${p.dataType})`;
        }
        return '';
    })).filter(Boolean).join('\n    ')}
}

int main() {
    setup_system();
    return 0;
}
    `;
    srcFolder?.file("main.c", mainFileContent);

    localComponents.forEach(component => {
        const folder = localComponentsFolder?.folder(component.name.toLowerCase());
        const headerContent = `// ${component.name.toLowerCase()}.h
#pragma once

#include "edroom_types.h"
#include "edroom_component.h"

// Este es un componente LOCAL para el nodo '${localNodeName}'.

// Definición de puertos para ${component.name}
${component.ports.filter(p => p.type === 'comunicacion' && p.subtype === 'normal')
    .map(p => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Normal (${p.dataType})`)
    .join('\n')}
${component.ports.filter(p => p.type === 'comunicacion' && p.subtype === 'conjugado')
    .map(p => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Conjugado (${p.dataType})`)
    .join('\n')}

${component.ports.filter(p => p.type === 'tiempo')
    .map(p => `// extern EDROOM_Timing_Port ${p.name}; // Puerto de Tiempo (${p.dataType})`)
    .join('\n')}

${component.ports.filter(p => p.type === 'interrupcion')
    .map(p => `// extern EDROOM_Interrupt_Port ${p.name}; // Puerto de Interrupción (${p.dataType})`)
    .join('\n')}
`;
        const sourceContent = `// ${component.name.toLowerCase()}.c
#include "${component.name.toLowerCase()}.h"
// Implementación de la lógica para el componente ${component.name}
`;
        folder?.file(`${component.name.toLowerCase()}.h`, headerContent);
        folder?.file(`${component.name.toLowerCase()}.c`, sourceContent);
    });

    remoteComponents.forEach(component => {
        const folder = remoteComponentsFolder?.folder(component.name.toLowerCase());
        const headerContent = `// ${component.name.toLowerCase()}.h
#pragma once

#include "edroom_types.h"
#include "edroom_component.h"

// Este es un componente REMOTO para el nodo '${localNodeName}'.

// Definición de puertos para ${component.name}
${component.ports.filter(p => p.type === 'comunicacion' && p.subtype === 'normal')
    .map(p => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Normal (${p.dataType})`)
    .join('\n')}
${component.ports.filter(p => p.type === 'comunicacion' && p.subtype === 'conjugado')
    .map(p => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Conjugado (${p.dataType})`)
    .join('\n')}

${component.ports.filter(p => p.type === 'tiempo')
    .map(p => `// extern EDROOM_Timing_Port ${p.name}; // Puerto de Tiempo (${p.dataType})`)
    .join('\n')}

${component.ports.filter(p => p.type === 'interrupcion')
    .map(p => `// extern EDROOM_Interrupt_Port ${p.name}; // Puerto de Interrupción (${p.dataType})`)
    .join('\n')}
`;
        const sourceContent = `// ${component.name.toLowerCase()}.c
#include "${component.name.toLowerCase()}.h"
// Implementación de la lógica para el componente ${component.name}
`;
        folder?.file(`${component.name.toLowerCase()}.h`, headerContent);
        folder?.file(`${component.name.toLowerCase()}.c`, sourceContent);
    });

    const remoteNodeNames = uniqueNodeNames.filter(n => n !== localNodeName);
    remoteNodeNames.forEach(remoteNodeName => {
        const folder = remoteNodesFolder?.folder(remoteNodeName?.toLowerCase());
        const nodeHeaderContent = `// ${remoteNodeName?.toLowerCase()}.h
#pragma once

// Este es el archivo de configuración para el nodo REMOTO: ${remoteNodeName}
`;
        const nodeSourceContent = `// ${remoteNodeName?.toLowerCase()}.c
#include "${remoteNodeName?.toLowerCase()}.h"

// Implementación de la lógica o configuración del nodo ${remoteNodeName}
`;
        folder?.file(`${remoteNodeName?.toLowerCase()}.h`, nodeHeaderContent);
        folder?.file(`${remoteNodeName?.toLowerCase()}.c`, nodeSourceContent);
    });

    });

    mainZip.generateAsync({ type: "blob" })
        .then(function(content) {
            saveAs(content, "edroom_project_all_nodes.zip");
        });

  }, [nodes, edges]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={onAddNode}
        style={{
          position: 'absolute', top: 10, left: 10, zIndex: 4, padding: '8px 12px',
          backgroundColor: '#007bff', color: 'white', border: 'none',
          borderRadius: '4px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        Añadir Componente
      </button>

      <button
        onClick={handleGenerateCode}
        style={{
          position: 'absolute', top: 10, left: 180, zIndex: 4, padding: '8px 12px',
          backgroundColor: '#28a745', color: 'white', border: 'none',
          borderRadius: '4px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
        }}
      >
        Generar Código
      </button>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeContextMenu={onNodeContextMenu}
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
          onAddPort={handleAddPort}
          onRename={handleRenameComponent}
          onClose={() => setMenu(null)}
          dataTypes={dataTypes}
          onAssignNode={handleAssignNode}
        />
      )}
    </div>
  );
};

export default App;