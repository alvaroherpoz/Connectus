// src/code_templates/deployment/edroomdeployment_h_template.ts

import type { Node, NodeData, Edge } from '../../types';

export class edroomdeployment_h_template {
    public static generateHeaderFileContent(nodes: Node<NodeData>[], localNodeName: string, edges: Edge[]): string {

        // Filtra los nodos y conexiones que pertenecen al nodo local
        const allConnections = edges.filter(e => {
            const sourceNode = nodes.find(n => n.id === e.source);
            const targetNode = nodes.find(n => n.id === e.target);
            return sourceNode?.data.node === localNodeName || targetNode?.data.node === localNodeName;
        });

        // 1. Generar inclusiones de cabeceras para TODOS los componentes
        const includes = nodes.map(c => {
            const name = c.data.name.replace(/\s/g, '').toLowerCase();
            const prefix = this.getIncludePrefix(c, localNodeName);
            
            return `#include <public/${prefix}${name}_iface_v1.h>`;
        }).join('\n');

        // 2. Declaraciones de memoria de componentes
        const componentMemoryDeclarations = nodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            const maxMessages = c.data.maxMessages;
            const maxQueueNodes = c.data.maxMessages; 
            
            return `
    //!Messages Memory of component ${instanceName}
    CEDROOMMessage ${instanceName}Messages[${maxMessages}];
    bool ${instanceName}MessagesMarks[${maxMessages}];
    CEDROOMQueue::CQueueNode    ${instanceName}QueueNodes[${maxQueueNodes}];
    bool ${instanceName}QueueNodesMarks[${maxQueueNodes}];
`;
        }).join('');

        // 3. Miembros de la clase CEDROOMSystemMemory
        const componentMemoryMembers = nodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            const componentClass = this.getComponentClass(c, localNodeName);
            return `    ${componentClass}::CEDROOMMemory ${instanceName}Memory;`;
        }).join('\n');
        
        // Filtra las conexiones que tienen al componente Top como fuente o destino
        const topLocalConnections = allConnections.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            
            // Check if one node is the local Top and the other is any other component (local or remote)
            const isSourceTop = sourceNode?.data.isTop && sourceNode.data.node === localNodeName;
            const isTargetTop = targetNode?.data.isTop && targetNode.data.node === localNodeName;
            
            return isSourceTop || isTargetTop;
        });
        
        // Filtrar las conexiones que NO involucran al componente Top
        const nonTopConnections = allConnections.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            const isSourceTop = sourceNode?.data.isTop && sourceNode.data.node === localNodeName;
            const isTargetTop = targetNode?.data.isTop && targetNode.data.node === localNodeName;
            return !(isSourceTop || isTargetTop);
        });
        
        // 4. Documentación de la función Connect
        let connectFunctionDoc = "";

        // Collect all unique nodes connected to the local Top component
        const connectedNodes = new Set<Node<NodeData>>();
        topLocalConnections.forEach(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            if (sourceNode) connectedNodes.add(sourceNode);
            if (targetNode) connectedNodes.add(targetNode);
        });

        // Documentación de los parámetros de interfaz
        connectFunctionDoc += Array.from(connectedNodes).map(c => {
            const name = this.getInstanceName(c, localNodeName);
            return `\
    * \\param interface${name} reference to component ${c.data.componentId} interface`;
        }).join('\n');

        // Documentación de los parámetros del traductor de señales
        connectFunctionDoc += topLocalConnections.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            const sourceName = this.getInstanceName(sourceNode!, localNodeName);
            const targetName = this.getInstanceName(targetNode!, localNodeName);

            return `\
    * \\param ${sourceName}To${targetName}SignalTranslator component${sourceNode?.data.componentId} to component${targetNode?.data.componentId} signal translator
    * \\param ${targetName}To${sourceName}SignalTranslator component${targetNode?.data.componentId} to component${sourceNode?.data.componentId} signal translator`;
        }).join('\n');
        
        // 5. Firma de la función Connect
        let connectInterfaceSignature = Array.from(connectedNodes).map(c => {
            const name = this.getInstanceName(c, localNodeName);
            return `,CEDROOMInterface & interface${name}`;
        }).join('');
        
        const connectSignalTranslatorSignature = topLocalConnections.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            const sourceName = this.getInstanceName(sourceNode!, localNodeName);
            const targetName = this.getInstanceName(targetNode!, localNodeName);

            return `
                 ,TEDROOMSignal  (${sourceName}To${targetName}SignalTranslator) (TEDROOMSignal)
                 ,TEDROOMSignal  (${targetName}To${sourceName}SignalTranslator) (TEDROOMSignal)`;
        }).join('');

        // 6. Generar las funciones de conversión de señales
        this.resetPortCounter();
        const signalConversions = nonTopConnections.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            
            const sourceId = sourceNode?.data.componentId;
            const sourceName = sourceNode?.data.name.replace(/\s/g, '');
            const sourcePort = this.getPortsFromEdge(conn, 'source');
            
            const targetId = targetNode?.data.componentId;
            const targetName = targetNode?.data.name.replace(/\s/g, '');
            const targetPort = this.getPortsFromEdge(conn, 'target');

            const portSuffix = this.getPortSuffix(sourcePort);

            return `
//Signal Conversion
    static TEDROOMSignal C${sourceId}${sourceName}_P${sourcePort}__C${targetId}${targetName}_P${targetPort}${portSuffix}(TEDROOMSignal signal);
    static TEDROOMSignal C${targetId}${targetName}_P${targetPort}${portSuffix}__C${sourceId}${sourceName}_P${sourcePort}(TEDROOMSignal signal);
`;
        }).join('\n');
        
        // 7. Miembros de CEDROOMSystemCommSAP
        const systemCommSAPMembers = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `     static ${componentClass}  * mp_${instanceName};`;
        }).join('\n');

        // 8. Parámetros para SetComponents
        const setComponentsParameters = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass}  *p_${instanceName}`;
        }).join(',\n                         ');
        
        // 9. Miembros de CEDROOMSystemDeployment
        const systemDeploymentMembers = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `    ${componentClass}    * mp_${instanceName};`;
        }).join('\n');
        
        // 10. Parámetros para Deployment Configuration
        const deploymentConfigParameters = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass}    *p_${instanceName}`;
        }).join(',\n                         ');

        // 11. Funciones GetMemory
        const getMemoryFunctions = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `    ${componentClass}        * Get${instanceName}Memory(){return &systemMemory.${instanceName}Memory;}`;
        }).join('\n');

        // Contar las conexiones locales (sin el componente Top) y remotas
        const localConnectionCount = allConnections.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode?.data.node === localNodeName && targetNode?.data.node === localNodeName && !sourceNode.data.isTop && !targetNode.data.isTop;
        }).length;

        const remoteConnectionCount = allConnections.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode?.data.node !== targetNode?.data.node;
        }).length;

        return `//##############################################################################
//###############    This file has been generated by EDROOM    ###############
//##############################################################################

#ifndef EDROOMDEPLOYMENT_H_
#define EDROOMDEPLOYMENT_H_

#include <edroom_glue/edroomdf.h>
#include <public/edroomsl_iface_v1.h>
#include <edroom_glue/edroom_can_drv.h>


#include "public/pi_free_can_drv.h"
//******************************************************************************
// include deployment edroom components

${includes}

// ***********************************************************************
// class CEDROOMSystemMemory
// ***********************************************************************

class CEDROOMSystemMemory{

${componentMemoryDeclarations}

    public:

${componentMemoryMembers}

//!Set Memory
    void SetMemory();
};


// ***********************************************************************
// class CEDROOMRemoteConnection
// ***********************************************************************

class CEDROOMRemoteConnection{

friend class CEDROOMRemoteCommSAP;

    //! connection channel 1
    CEDROOMRemoteTXChannel m_Channel1;
    //! connection channel 2
    CEDROOMLocalTXChannel m_Channel2;


};


//******************************************************************************
/*!
 * \\class CEDROOMRemoteCommSAP
 * \\brief This class implements the EDROOM local communication service access
 * point
 *
 * \\author Oscar Rodriguez Polo
 */
//******************************************************************************

class CEDROOMRemoteCommSAP{


public:


    /*!
    * \\brief register the Interface
    * \\param id interface local identifier
    * \\param interface reference to the interface
    * \\param pComponent pointer to the component
    * \\return a value !=0 if there is an error
    */
    TEDROOMInt32 RegisterInterface( TEDROOMInterfaceID id
                             , CEDROOMInterface & interface
                             , CEDROOMComponent* pComponent);


    /*!
    * \\brief Connect the components interfaces
${connectFunctionDoc}
    * \\param connection reference to the object that handles the connection
    */
    void Connect(
                 ${connectInterfaceSignature}
                 ,CEDROOMRemoteConnection &connection
                 ${connectSignalTranslatorSignature});


};

class CEDROOMSystemCommSAP{

      friend class CEDROOMSystemDeployment;
//!Communication Service Access Point

    CEDROOMLocalCommSAP m_localCommSAP;
    CEDROOMRemoteCommSAP m_remoteCommSAP;

//!Conections

    CEDROOMLocalConnection connections[${localConnectionCount}];
    CEDROOMRemoteConnection remote_connections[${remoteConnectionCount}];

//!Components

${systemCommSAPMembers}


//!Set Components

    void SetComponents(${setComponentsParameters});


//Signal Conversion

${signalConversions}


//!Register Interfaces
    void RegisterInterfaces();

//!Set Local Connections
    void SetLocalConnections();

//!Set Remote Connections
    void SetRemoteConnections();

//!Set Connections
    void SetConnections();   
    
    // ********************************
    // Handling CAN IRQ vector 0x1C

    //! Event for trigger the bottom half associated to the IRQ
    static Pr_IRQEvent  RemoteCommEventIRQ;
    //! Binary Semaphore for signal the end of the bottom half of the IRQ
    static Pr_SemaphoreBin  RemoteCommSemEndIRQ;
        //! IRQ Handler for the IRQ
    static Pr_IRQHandler_RetType    RemoteCommIRQHandler(void);

    //! Bottom Half Task Function for the IRQ
    static Pr_TaskRV_t  RemoteCommIRQBottomHalfTask(Pr_TaskP_t);



};

class CEDROOMSystemDeployment{

//!Kernel
    Pr_Kernel  kernel;

#ifdef CONFIG_EDROOMDEPLOYMENT_NEED_TASK

//!Main Task
static Pr_TaskRV_t main_task(Pr_TaskP_t);

#endif
    CEDROOMSystemMemory  systemMemory;
    CEDROOMSystemCommSAP  systemCommSAP;

${systemDeploymentMembers}

    public:

    CEDROOMSystemDeployment();

//!Deployment Configuration
    void Config(${deploymentConfigParameters});

//!Deployment Start
    void Start();

//!StartComponents
    void StartComponents();
//!Config Components

${getMemoryFunctions}

};
#endif
`;
    }
    
    // --- Funciones auxiliares para la lógica de la plantilla ---
    
    private static getInstanceName(node: Node<NodeData>, localNodeName: string): string {
        const isRemote = node.data.node !== localNodeName;
        const componentNameBase = node.data.name.toLowerCase().replace(/\s/g, '');
        
        if (node.data.isTop && isRemote) {
            return `r${componentNameBase}`;
        } else if (node.data.isTop && !isRemote) {
            return componentNameBase;
        } else if (!node.data.isTop && isRemote) {
            return `rcc${componentNameBase}`;
        } else { // !node.data.isTop && !isRemote
            return `cc${componentNameBase}`;
        }
    }
    
    private static getComponentClass(node: Node<NodeData>, localNodeName: string): string {
        const isRemote = node.data.node !== localNodeName;
        const componentType = node.data.name.replace(/\s/g, '');

        if (node.data.isTop && isRemote) {
            return `R${componentType}`;
        } else if (node.data.isTop && !isRemote) {
            return componentType;
        } else if (!node.data.isTop && isRemote) {
            return `RCC${componentType}`;
        } else { // !node.data.isTop && !isRemote
            return `CC${componentType}`;
        }
    }
    
    private static getIncludePrefix(node: Node<NodeData>, localNodeName: string): string {
        const isRemote = node.data.node !== localNodeName;
        
        if (node.data.isTop && isRemote) {
            return 'r';
        } else if (node.data.isTop && !isRemote) {
            return '';
        } else if (!node.data.isTop && isRemote) {
            return 'rcc';
        } else { // !node.data.isTop && !isRemote
            return 'cc';
        }
    }
    
    private static portCounter: Record<string, number> = {};
    
    private static resetPortCounter(): void {
        this.portCounter = {};
    }

    private static getPortSuffix(portName: string): string {
        this.portCounter[portName] = (this.portCounter[portName] || 0) + 1;
        if (this.portCounter[portName] > 1) {
            return this.portCounter[portName].toString();
        }
        return '';
    }
    
    private static getPortsFromEdge(edge: Edge, type: 'source' | 'target'): string {
        const portHandle = type === 'source' ? edge.sourceHandle : edge.targetHandle;
        if (portHandle) {
            const parts = portHandle.split('-');
            return parts[1] || '';
        }
        return '';
    }
}