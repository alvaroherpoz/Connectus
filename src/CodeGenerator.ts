// src/CodeGenerator.ts

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
// Importamos los tipos desde nuestro nuevo archivo centralizado
import type { Node, Edge, PortData, NodeData } from './types'; 

// Las interfaces PortData y NodeData se definen ahora en src/types.ts
// Las interfaces internas ComponentData y ConnectionData no necesitan cambiar si ya son consistentes.
interface ComponentData {
    id: string;
    name: string;
    nodeName?: string;
    ports: PortData[]; // PortData se importa de types.ts
}

interface ConnectionData {
    sourceId: string;
    sourceHandle: string;
    targetId: string;
    targetHandle: string;
}

export class CodeGenerator {
    /**
     * Genera un archivo ZIP con el código fuente para cada nodo lógico del diagrama.
     * @param nodes Los nodos (componentes) del diagrama.
     * @param edges Las aristas (conexiones) del diagrama.
     */
    public static async generateCodeAndDownload(nodes: Node<NodeData>[], edges: Edge[]): Promise<void> {
        // Mapea los nodos y aristas a un formato interno de componentes y conexiones
        const components: ComponentData[] = nodes.map((node: Node<NodeData>) => ({
            id: node.id,
            name: node.data.name,
            nodeName: node.data.node,
            ports: node.data.ports,
        }));
        const connections: ConnectionData[] = edges.map((edge: Edge) => ({
            sourceId: edge.source,
            sourceHandle: edge.sourceHandle || '', 
            targetId: edge.target,
            targetHandle: edge.targetHandle || '', 
        }));

        const mainZip = new JSZip();

        const uniqueNodeNames = Array.from(new Set(components.map((c: ComponentData) => c.nodeName).filter((name: string | undefined): name is string => typeof name === 'string')));
        
        uniqueNodeNames.forEach((localNodeName: string) => {
            const nodeFolder = mainZip.folder(localNodeName);
            
            const localComponents = components.filter((c: ComponentData) => c.nodeName === localNodeName);
            const remoteComponents = components.filter((c: ComponentData) => c.nodeName !== localNodeName && c.nodeName);
            
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
    .map((c: ComponentData) => `#include "local/components/${c.name.toLowerCase()}/${c.name.toLowerCase()}.h"`).join('\n')}
${remoteComponents
    .map((c: ComponentData) => `#include "remote/components/${c.name.toLowerCase()}/${c.name.toLowerCase()}.h"`).join('\n')}

void setup_system() {
    ${components.map((c: ComponentData) => `// edroom_comp_${c.name.toLowerCase()}_init();`).join('\n     ')}

    ${connections.map((conn: ConnectionData) => {
        const sourceComp = components.find((c: ComponentData) => c.id === conn.sourceId);
        const targetComp = components.find((c: ComponentData) => c.id === conn.targetId);
        const sourcePort = sourceComp?.ports.find((p: PortData) => p.id === conn.sourceHandle);
        const targetPort = targetComp?.ports.find((p: PortData) => p.id === conn.targetHandle);

        if (sourceComp && targetComp && sourcePort && targetPort) {
            return `     // Conexión: ${sourceComp.name}.${sourcePort.name} (${sourcePort.dataType}) -> ${targetComp.name}.${targetPort.name} (${targetPort.dataType})`;
        }
        return `     // Conexión no válida o incompleta: ${conn.sourceId}:${conn.sourceHandle} -> ${conn.targetId}:${conn.targetHandle}`;
    }).join('\n')}

    ${components.flatMap((c: ComponentData) => c.ports.filter((p: PortData) => p.type !== 'comunicacion').map((p: PortData) => {
        if (p.type === 'tiempo') {
            return `     // Puerto de Tiempo: ${c.name}.${p.name} (${p.dataType})`;
        } else if (p.type === 'interrupcion') {
            return `     // Puerto de Interrupción: ${c.name}.${p.name} (${p.dataType})`;
        }
        return '';
    })).filter(Boolean).join('\n     ')}
}

int main() {
    setup_system();
    return 0;
}
    `;
    srcFolder?.file("main.c", mainFileContent);

    localComponents.forEach((component: ComponentData) => {
        const folder = localComponentsFolder?.folder(component.name.toLowerCase());
        const headerContent = `// ${component.name.toLowerCase()}.h
#pragma once

#include "edroom_types.h"
#include "edroom_component.h"

// Este es un componente LOCAL para el nodo '${localNodeName}'.

// Definición de puertos para ${component.name}
${component.ports.filter((p: PortData) => p.type === 'comunicacion' && p.subtype === 'nominal')
    .map((p: PortData) => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Nominal (${p.dataType})`)
    .join('\n')}
${component.ports.filter((p: PortData) => p.type === 'comunicacion' && p.subtype === 'conjugado')
    .map((p: PortData) => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Conjugado (${p.dataType})`)
    .join('\n')}

${component.ports.filter((p: PortData) => p.type === 'tiempo')
    .map((p: PortData) => `// extern EDROOM_Timing_Port ${p.name}; // Puerto de Tiempo (${p.dataType})`)
    .join('\n')}

${component.ports.filter((p: PortData) => p.type === 'interrupcion')
    .map((p: PortData) => `// extern EDROOM_Interrupt_Port ${p.name}; // Puerto de Interrupción (${p.dataType})`)
    .join('\n')}
`;
        const sourceContent = `// ${component.name.toLowerCase()}.c
#include "${component.name.toLowerCase()}.h"
// Implementación de la lógica para el componente ${component.name}
`;
        folder?.file(`${component.name.toLowerCase()}.h`, headerContent);
        folder?.file(`${component.name.toLowerCase()}.c`, sourceContent);
    });

    remoteComponents.forEach((component: ComponentData) => {
        const folder = remoteComponentsFolder?.folder(component.name.toLowerCase());
        const headerContent = `// ${component.name.toLowerCase()}.h
#pragma once

#include "edroom_types.h"
#include "edroom_component.h"

// Este es un componente REMOTO para el nodo '${localNodeName}'.

// Definición de puertos para ${component.name}
${component.ports.filter((p: PortData) => p.type === 'comunicacion' && p.subtype === 'nominal')
    .map((p: PortData) => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Nominal (${p.dataType})`)
    .join('\n')}
${component.ports.filter((p: PortData) => p.type === 'comunicacion' && p.subtype === 'conjugado')
    .map((p: PortData) => `// extern EDROOM_CAN_Port ${p.name}; // Puerto Conjugado (${p.dataType})`)
    .join('\n')}

${component.ports.filter((p: PortData) => p.type === 'tiempo')
    .map((p: PortData) => `// extern EDROOM_Timing_Port ${p.name}; // Puerto de Tiempo (${p.dataType})`)
    .join('\n')}

${component.ports.filter((p: PortData) => p.type === 'interrupcion')
    .map((p: PortData) => `// extern EDROOM_Interrupt_Port ${p.name}; // Puerto de Interrupción (${p.dataType})`)
    .join('\n')}
`;
        const sourceContent = `// ${component.name.toLowerCase()}.c
#include "${component.name.toLowerCase()}.h"
// Implementación de la lógica para el componente ${component.name}
`;
        folder?.file(`${component.name.toLowerCase()}.h`, headerContent);
        folder?.file(`${component.name.toLowerCase()}.c`, sourceContent);
    });

    const remoteNodeNames = uniqueNodeNames.filter((n: string) => n !== localNodeName);
    remoteNodeNames.forEach((remoteNodeName: string) => {
        const folder = remoteNodesFolder?.folder(remoteNodeName.toLowerCase());
        const nodeHeaderContent = `// ${remoteNodeName.toLowerCase()}.h
#pragma once

// Este es el archivo de configuración para el nodo REMOTO: ${remoteNodeName}
`;
        const nodeSourceContent = `// ${remoteNodeName.toLowerCase()}.c
#include "${remoteNodeName.toLowerCase()}.h"

// Implementación de la lógica o configuración del nodo ${remoteNodeName}
`;
        folder?.file(`${remoteNodeName.toLowerCase()}.h`, nodeHeaderContent);
        folder?.file(`${remoteNodeName.toLowerCase()}.c`, nodeSourceContent);
    });

    });

    return new Promise((resolve) => {
        mainZip.generateAsync({ type: "blob" })
            .then(function(content) {
                saveAs(content, "edroom_project_all_nodes.zip");
                resolve();
            });
    });
    }
}