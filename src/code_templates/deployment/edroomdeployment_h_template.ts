// src/code_templates/deployment/edroomdeployment_h_template.ts

import type { Node, NodeData, Edge } from '../../types';

export class edroomdeployment_h_template {
    public static generateHeaderFileContent(nodes: Node<NodeData>[], localNodeName: string, edges: Edge[]): string {

        // Filtra los nodos y conexiones que pertenecen al nodo local
        const localNodes = nodes.filter(n => n.data.node === localNodeName);
        const localConnections = edges.filter(e => {
            const sourceNode = nodes.find(n => n.id === e.source);
            const targetNode = nodes.find(n => n.id === e.target);
            return sourceNode?.data.node === localNodeName && targetNode?.data.node === localNodeName;
        });

        // 1. Generar inclusiones de cabeceras
        const includes = localNodes.map(c => {
            const name = c.data.name.replace(/\s/g, '');
            return `#include <public/${name.toLowerCase()}_iface_v1.h>`;
        }).join('\n');

        // 2. Declaraciones de memoria de componentes
        const componentMemoryDeclarations = localNodes.map(c => {
            const instanceName = c.data.name.toLowerCase().replace(/\s/g, '');
            const maxMessages = c.data.maxMessages;
            const maxQueueNodes = c.data.maxMessages; 
            
            return `
    //!Messages Memory of component ${instanceName}
    CEDROOMMessage  ${instanceName}Messages[${maxMessages}];
    bool  ${instanceName}MessagesMarks[${maxMessages}];
    CEDROOMQueue::CQueueNode    ${instanceName}QueueNodes[${maxQueueNodes}];
    bool  ${instanceName}QueueNodesMarks[${maxQueueNodes}];
`;
        }).join('');

        // 3. Miembros de la clase CEDROOMSystemMemory
        const componentMemoryMembers = localNodes.map(c => {
            const instanceName = c.data.name.toLowerCase().replace(/\s/g, '');
            const componentClass = this.getComponentClass(c);
            return `    ${componentClass}::CEDROOMMemory ${instanceName}Memory;`;
        }).join('\n');

        // 4. Documentación de la función Connect
        let connectFunctionDoc = "";

        // Documentación de los parámetros de interfaz
        connectFunctionDoc += localNodes.map(c => {
            const name = c.data.name.toLowerCase().replace(/\s/g, '');
            return `\
    * \\param interface${name} reference to component ${c.data.componentId} interface`;
        }).join('\n');

        // Documentación de los parámetros del traductor de señales
        connectFunctionDoc += localConnections.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            const sourceName = sourceNode?.data.name.toLowerCase().replace(/\s/g, '');
            const targetName = targetNode?.data.name.toLowerCase().replace(/\s/g, '');

            return `\
    * \\param ${sourceName}To${targetName}SignalTranslator component${sourceNode?.data.componentId} to component${targetNode?.data.componentId} signal translator
    * \\param ${targetName}To${sourceName}SignalTranslator component${targetNode?.data.componentId} to component${sourceNode?.data.componentId} signal translator`;
        }).join('\n');
        
        // 5. Firma de la función Connect
        const connectFunctionSignature = localConnections.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            const sourceName = sourceNode?.data.name.toLowerCase().replace(/\s/g, '');
            const targetName = targetNode?.data.name.toLowerCase().replace(/\s/g, '');

            return `
                 ,CEDROOMInterface & interface${sourceName}
                 ,CEDROOMInterface & interface${targetName}
                 ,TEDROOMSignal  (${sourceName}To${targetName}SignalTranslator) (TEDROOMSignal)
                 ,TEDROOMSignal  (${targetName}To${sourceName}SignalTranslator) (TEDROOMSignal)`;
        }).join('');

        // 6. Generar las funciones de conversión de señales
        const signalConversions = localConnections.map(conn => {
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
        const systemCommSAPMembers = localNodes.map(c => {
            const componentClass = this.getComponentClass(c);
            const instanceName = c.data.name.toLowerCase().replace(/\s/g, '');
            return `    static ${componentClass}   * mp_${instanceName};`;
        }).join('\n');

        // 8. Parámetros para SetComponents
        const setComponentsParameters = localNodes.map(c => {
            const componentClass = this.getComponentClass(c);
            const instanceName = c.data.name.toLowerCase().replace(/\s/g, '');
            return `${componentClass}   *p_${instanceName}`;
        }).join(',\n                             ');
        
        // 9. Miembros de CEDROOMSystemDeployment
        const systemDeploymentMembers = localNodes.map(c => {
            const componentClass = this.getComponentClass(c);
            const instanceName = c.data.name.toLowerCase().replace(/\s/g, '');
            return `    ${componentClass}    * mp_${instanceName};`;
        }).join('\n');
        
        // 10. Parámetros para Deployment Configuration
        const deploymentConfigParameters = localNodes.map(c => {
            const componentClass = this.getComponentClass(c);
            const instanceName = c.data.name.toLowerCase().replace(/\s/g, '');
            return `${componentClass}    *p_${instanceName}`;
        }).join(',\n                             ');

        // 11. Funciones GetMemory
        const getMemoryFunctions = localNodes.map(c => {
            const componentClass = this.getComponentClass(c);
            const instanceName = c.data.name.toLowerCase().replace(/\s/g, '');
            return `    ${componentClass}::CEDROOMMemory       * Get${instanceName}Memory(){return &systemMemory.${instanceName}Memory;}`;
        }).join('\n');

        return `//##############################################################################
//###############     This file has been generated by EDROOM     ###############
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
                CEDROOMInterface & interfaceicuasw
                ,CEDROOMInterface & interfaceccepdmanager
                ,CEDROOMRemoteConnection &connection
                ${connectFunctionSignature});


};

class CEDROOMSystemCommSAP{

      friend class CEDROOMSystemDeployment;
//!Communication Service Access Point

    CEDROOMLocalCommSAP m_localCommSAP;
    CEDROOMRemoteCommSAP m_remoteCommSAP;

//!Conections

    CEDROOMLocalConnection connections[1];
    CEDROOMRemoteConnection remote_connections[4];

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
    
    private static getComponentClass(node: Node<NodeData>): string {
        const componentType = node.data.name;
        if (componentType === 'ICUASW') {
            return 'ICUASW';
        } else if (node.data.node === 'default_node') {
            return `CC${componentType.replace(/\s/g, '')}`;
        } else {
            return `RCC${componentType.replace(/\s/g, '')}`;
        }
    }
    
    private static portCounter: Record<string, number> = {};
    
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