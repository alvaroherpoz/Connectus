/**
 * @fileoverview Plantilla para generar el archivo header (.h) de despliegue EDROOM.
 * Contiene las declaraciones, estructuras y funciones para la inicialización y conexión de componentes.
 */
import type { Node, NodeData, Edge } from '../../components/types';

/**
 * Genera el contenido del archivo `edroomdeployment.h`.
 */
export class edroomdeployment_h_template {
    /**
     * Genera el contenido del archivo header para el despliegue de un nodo lógico específico.
     * @param {Node<NodeData>[]} nodes - Todos los nodos del diagrama.
     * @param {string} localNodeName - El nombre del nodo lógico para el que se genera el código.
     * @param {Edge[]} edges - Todas las conexiones del diagrama.
     * @returns {string} El contenido del archivo .h.
     */
    public static generateHeaderFileContent(nodes: Node<NodeData>[], localNodeName: string, edges: Edge[]): string {
        const allConnections = edges.filter(e => {
            const sourceNode = nodes.find(n => n.id === e.source);
            const targetNode = nodes.find(n => n.id === e.target);
            return sourceNode?.data.node === localNodeName || targetNode?.data.node === localNodeName;
        });

        // 1. Generar inclusiones de cabeceras para TODOS los componentes
        const includes = nodes.map(c => {
            const name = c.data.componentClass.replace(/\s/g, '').toLowerCase();
            const prefix = this.getIncludePrefix(c, localNodeName);
            
            return `#include <public/${prefix}${name}_iface_v1.h>`;
        }).join('\n');

        // 2. Declaraciones de memoria de componentes
        const componentMemoryDeclarations = nodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            const maxMessages = c.data.maxMessages;
            const maxQueueNodes = this.calculateMaxQueueNodes(c);

            return `
    //!Messages Memory of component ${instanceName}
    CEDROOMMessage ${instanceName}Messages[${maxMessages}];
    bool ${instanceName}MessagesMarks[${maxMessages}];
    CEDROOMQueue::CQueueNode     ${instanceName}QueueNodes[${maxQueueNodes}];
    bool ${instanceName}QueueNodesMarks[${maxQueueNodes}];
`;
        }).join('');

        // 3. Miembros de la clase CEDROOMSystemMemory
        const componentMemoryMembers = nodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            const componentClass = this.getComponentClass(c, localNodeName);
            return `     ${componentClass}::CEDROOMMemory ${instanceName}Memory;`;
        }).join('\n');
        
        
        // 5. Generar las funciones de conversión de señales
        this.resetPortCounter();
        const signalConversions = allConnections.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            
            const sourceId = sourceNode?.data.componentId;
            const sourceName = sourceNode?.data.name.replace(/\s/g, '');
            const sourcePort = this.getPortNameFromEdge(nodes, conn, 'source');
            
            const targetId = targetNode?.data.componentId;
            const targetName = targetNode?.data.name.replace(/\s/g, '');
            const targetPort = this.getPortNameFromEdge(nodes, conn, 'target');

            return `
//Signal Conversion
    static TEDROOMSignal C${sourceId}${sourceName}_P${sourcePort}__C${targetId}${targetName}_P${targetPort}(TEDROOMSignal signal);
    static TEDROOMSignal C${targetId}${targetName}_P${targetPort}__C${sourceId}${sourceName}_P${sourcePort}(TEDROOMSignal signal);
`;
        }).join('\n');
        
        // 6. Miembros de CEDROOMSystemCommSAP
        const systemCommSAPMembers = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `     static ${componentClass}  * mp_${instanceName};`;
        }).join('\n');

        // 7. Parámetros para SetComponents
        const setComponentsParameters = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass}  *p_${instanceName}`;
        }).join(',\n                      ');
        
        // 8. Miembros de CEDROOMSystemDeployment
        const systemDeploymentMembers = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `     ${componentClass}    * mp_${instanceName};`;
        }).join('\n');
        
        // 9. Parámetros para Deployment Configuration
        const deploymentConfigParameters = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass}    *p_${instanceName}`;
        }).join(',\n                      ');

        // 10. Funciones GetMemory
        const getMemoryFunctions = nodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `     ${componentClass}       * Get${instanceName}Memory(){return &systemMemory.${instanceName}Memory;}`;
        }).join('\n');

        // Contar las conexiones locales (sin el componente Top) y remotas
        const localConnectionCount = allConnections.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode?.data.node === localNodeName && targetNode?.data.node === localNodeName;
        }).length;

        const remoteConnectionCount = allConnections.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode?.data.node !== targetNode?.data.node;
        }).length;

        return `//##############################################################################
//###############     This file has been generated by Connectus     ###############
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
    * \\param comp1 reference to component 1 interface
    * \\param comp2 reference to component 2 interface
    * \\param connection reference to the object that handles the connection
    * \\param comp1Tocomp2SignalTranslator component1 to component2 signal
    * 			translator
    * \\param comp2Tocomp1SignalTranslator component2 to component1 signal
    * 			translator
    */
	void Connect(CEDROOMInterface & comp1
				,CEDROOMInterface & comp2
				,CEDROOMRemoteConnection &connection
				,TEDROOMSignal  (comp1Tocomp2SignalTranslator) (TEDROOMSignal)
				,TEDROOMSignal  (comp2Tocomp1SignalTranslator) (TEDROOMSignal));



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
    static Pr_IRQHandler_RetType     RemoteCommIRQHandler(void);

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
    
    /**
     * Calcula el número máximo de nodos de cola para un componente.
     * El cálculo es: `maxMessages` del componente + puertos con `invoke` de entrada + puertos de `tiempo`.
     * @param {Node<NodeData>} node - El nodo del componente.
     * @returns {number} El número de nodos de cola.
     */
    private static calculateMaxQueueNodes(node: Node<NodeData>): number {
        const asyncMessagesCount = node.data.maxMessages;
        let invokePortsCount = 0;
        let timerPortsCount = 0;

        node.data.ports.forEach(port => {
            if (port.type === 'tiempo') {
                timerPortsCount++;
            }

            if (port.type === 'comunicacion' && port.messages) {
                let hasEffectiveInvokeEntrada = false;
                port.messages.forEach(message => {
                    if (message.type === 'invoke') {
                        const isEntrada = message.direction === 'entrada';
                        const isConjugado = port.subtype === 'conjugado';
                        if ((isEntrada && !isConjugado) || (!isEntrada && isConjugado)) {
                            hasEffectiveInvokeEntrada = true;
                        }
                    }
                });
                if (hasEffectiveInvokeEntrada) {
                    invokePortsCount++;
                }
            }
        });
        
        if(timerPortsCount != 0)
        {
            timerPortsCount = timerPortsCount * 2 + 1;
        }
        return asyncMessagesCount + invokePortsCount + timerPortsCount;
    }
    
    /**
     * Obtiene el nombre de la instancia de un componente.
     * @param {Node<NodeData>} node - El nodo del componente.
     * @param {string} localNodeName - El nombre del nodo lógico actual.
     * @returns {string} El nombre de la instancia (p. ej., `rcomponente` o `componente`).
     */
    private static getInstanceName(node: Node<NodeData>, localNodeName: string): string {
        const isRemote = node.data.node !== localNodeName;
        const componentNameBase = node.data.name.toLowerCase().replace(/\s/g, '');
        
        if (isRemote) {
            return `r${componentNameBase}_${node.id}`;
        }
        return `${componentNameBase}_${node.id}`;
    }
    
    /**
     * Obtiene el nombre de la clase C++ para un componente.
     * @param {Node<NodeData>} node - El nodo del componente.
     * @param {string} localNodeName - El nombre del nodo lógico actual.
     * @returns {string} El nombre de la clase (p. ej., `RComponente`, `CCComponente`).
     */
    private static getComponentClass(node: Node<NodeData>, localNodeName: string): string {
        const isRemote = node.data.node !== localNodeName;
        const componentType = node.data.componentClass.replace(/\s/g, '');

        if (node.data.isTop && isRemote) {
            return `R${componentType}`;
        } else if (node.data.isTop && !isRemote) {
            return componentType;
        } else if (!node.data.isTop && isRemote) {
            return `RCC${componentType}`;
        } else {
            return `CC${componentType}`;
        }
    }

    /**
     * Obtiene el prefijo para la directiva `#include` de un componente.
     * @param {Node<NodeData>} node - El nodo del componente.
     * @param {string} localNodeName - El nombre del nodo lógico actual.
     * @returns {string} El prefijo del include (p. ej., `r`, `cc`).
     */
    private static getIncludePrefix(node: Node<NodeData>, localNodeName: string): string {
        const isRemote = node.data.node !== localNodeName;
        
        if (node.data.isTop && isRemote) {
            return 'r';
        } else if (node.data.isTop && !isRemote) {
            return '';
        } else if (!node.data.isTop && isRemote) {
            return 'rcc';
        } else {
            return 'cc';
        }
    }

    private static portCounter: Record<string, number> = {};

    /**
     * Reinicia el contador de sufijos de puertos.
     * @param {Node<NodeData>[]} nodes - Todos los nodos del diagrama.
     * @param {Edge} edge - La conexión.
     * @param {'source' | 'target'} type - Si se busca el puerto de origen o de destino.
     * @returns {string} El nombre del puerto sin espacios.
     */
    private static resetPortCounter(): void {
        for (const key in this.portCounter) {
            delete this.portCounter[key];
        }
    }

    /**
     * Obtiene el nombre de un puerto a partir de una conexión.
     * @param {Node<NodeData>[]} nodes - Todos los nodos del diagrama.
     * @param {Edge} edge - La conexión.
     * @param {'source' | 'target'} type - Si se busca el puerto de origen o de destino.
     * @returns {string} El nombre del puerto sin espacios.
     */
    private static getPortNameFromEdge(nodes: Node<NodeData>[], edge: Edge, type: 'source' | 'target'): string {
        const nodeId = type === 'source' ? edge.source : edge.target;
        const portId = type === 'source' ? edge.sourceHandle : edge.targetHandle;

        if (!nodeId || !portId) {
            return '';
        }
        const node = nodes.find(n => n.id === nodeId);
        const port = node?.data.ports.find(p => p.id === portId);
        
        return port ? port.name.replace(/\s/g, '') : '';
    }
}