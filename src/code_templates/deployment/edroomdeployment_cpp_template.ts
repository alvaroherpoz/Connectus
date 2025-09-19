/**
 * @fileoverview Plantilla para generar el archivo fuente (.cpp) de despliegue EDROOM.
 * Contiene la lógica para la inicialización, conexión y traducción de señales entre componentes.
 */

import type { Node, NodeData, Edge, PortData } from '../../components/types';

/**
 * Genera el contenido del archivo `edroomdeployment.cpp`.
 */
export class edroomdeployment_cpp_template {
    /**
     * Genera el contenido del archivo .cpp para el despliegue de un nodo lógico.
     * @param {Node<NodeData>[]} nodes - Todos los nodos del diagrama.
     * @param {string} localNodeName - El nombre del nodo lógico para el que se genera el código.
     * @param {Edge[]} edges - Todas las conexiones del diagrama.
     * @returns {string} El contenido del archivo .cpp.
     */
    public static generateCppFileContent(nodes: Node<NodeData>[], localNodeName: string, edges: Edge[]): string {
        const allNodes = nodes;
        // Un componente es remoto si su propiedad 'node' es diferente a la del nodo local.
        const remoteNodes = nodes.filter(n => n.data.node !== localNodeName);

        // 2. Funcion MainWait
        const mainWaitParams = allNodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass} & ${instanceName}`;
        }).join(',\n\t\t');
        
        const mainWaitCheck = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            return `!${instanceName}.EDROOMIsComponentFinished()`;
        }).join('\n\t\t\t||');

        // 3. Funcion SetMemory
        const setMemoryContent = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            const maxMessages = c.data.maxMessages;
            const maxQueueNodes = this.calculateMaxQueueNodes(c);

            return `\
    ${instanceName}Memory.SetMemory(${maxMessages}, ${instanceName}Messages, &${instanceName}MessagesMarks[0]
                         ,${maxQueueNodes},${instanceName}QueueNodes, &${instanceName}QueueNodesMarks[0]);`;
        }).join('\n');

        // 4. Inicializacion de punteros de Componentes 
        const componentPointers = allNodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass} * CEDROOMSystemCommSAP::mp_${instanceName}=NULL;`;
        }).join('\n');

        // 5. Funcion RemoteCommIRQBottomHalfTask 
        const remoteCommSwitches = remoteNodes.map(remoteCmp => {
            const remoteCmpId = remoteCmp.data.componentId;

            const connectionsWithRemote = edges.filter(e => {
                const sourceNode = nodes.find(n => n.id === e.source);
                const targetNode = nodes.find(n => n.id === e.target);
                if (!sourceNode || !targetNode) return false;

                const sourceIsThisRemote = sourceNode.id === remoteCmp.id;
                const targetIsLocal = targetNode.data.node === localNodeName;

                const targetIsThisRemote = targetNode.id === remoteCmp.id;
                const sourceIsLocal = sourceNode.data.node === localNodeName;

                return (sourceIsThisRemote && targetIsLocal) || (targetIsThisRemote && sourceIsLocal);
            });

            if (connectionsWithRemote.length === 0) return '';

            const connectionsByRemotePort = connectionsWithRemote.reduce((acc, conn) => {
                const portId = conn.source === remoteCmp.id ? conn.sourceHandle : conn.targetHandle;
                if (portId) {
                    (acc[portId] = acc[portId] || []).push(conn);
                }
                return acc;
            }, {} as Record<string, Edge[]>);

            const interfaceCases = Object.entries(connectionsByRemotePort).map(([portId, portConnections]) => {
                const remotePort = remoteCmp.data.ports.find(p => p.id === portId);
                if (!remotePort) return '';

                const remotePortName = remotePort.name.replace(/\s/g, '');

                const signalCases = portConnections.map(conn => {
                    const localCmp = nodes.find(n => n.id === (conn.source === remoteCmp.id ? conn.target : conn.source))!;
                    return this.generateSignalCases(remoteCmp, localCmp, conn, localNodeName);
                }).join('\n');

                if (!signalCases.trim()) return '';

                return `
                        case(${portId}): // Interface ${remotePortName}
                            switch(msgSignal){
${signalCases}
                                default:
                                    //Error in Remote Msg Reception
                                break;
                            }
                            break;`;
            }).join('\n');

            if (!interfaceCases.trim()) return '';

            return `
            case(${remoteCmpId}): // ${remoteCmp.data.name} sent it
                switch(msgSenderCmpInterface){ // What interface was used?
${interfaceCases}
                }
                break;`;
        }).join('');

        // 6. Funcion SetComponents
        const allComponentsForSetComponents = allNodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass} *p_${instanceName}`;
        }).join(',\n\t\t');
        
        const setComponentsContent = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            return `mp_${instanceName}=p_${instanceName};`;
        }).join('\n\t');


        // 7. Funciones Signal Translation 
        const signalTranslations = edges.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source)!;
            const targetNode = nodes.find(n => n.id === conn.target)!;
            const sourceName = sourceNode.data.name.replace(/\s/g, '');
            const targetName = targetNode.data.name.replace(/\s/g, '');
            const sourcePortName = this.getPortNameFromEdge(nodes, conn, 'source');
            const targetPortName = this.getPortNameFromEdge(nodes, conn, 'target');
            
            const port_source_name = sourcePortName;
            const port_target_name = targetPortName;


            const sourcePortData = sourceNode.data.ports.filter(p => p.name.replace(/\s/g, '') === port_source_name);
            const targetPortData = targetNode.data.ports.filter(p => p.name.replace(/\s/g, '') === port_target_name);

            const sourceSignals = this.getComponentSignals(sourcePortData);
            const targetSignals = this.getComponentSignals(targetPortData);

            const forwardCases = sourceSignals.filter(s => s.type === 'OUT').map(s => {
                const signalName = s.name.replace(/\s/g, '');
                const targetSignal = targetSignals.find(ts => ts.type === 'IN' && ts.name === s.name);
                if (targetSignal) {
                    return `case(${this.getComponentClass(sourceNode, localNodeName)}::${signalName}): \
\n\t\t\t\tsignalIn=${this.getComponentClass(targetNode, localNodeName)}::${targetSignal.name.replace(/\s/g, '')}; break;`;
                }
                return '';
            }).join('\n\n\t');

            const reverseCases = targetSignals.filter(s => s.type === 'OUT').map(s => {
                const signalName = s.name.replace(/\s/g, '');
                const sourceSignal = sourceSignals.find(ss => ss.type === 'IN' && ss.name === s.name);
                if (sourceSignal) {
                    return `case(${this.getComponentClass(targetNode, localNodeName)}::${signalName}): \
\n\t\t\t\tsignalIn=${this.getComponentClass(sourceNode, localNodeName)}::${sourceSignal.name.replace(/\s/g, '')}; break;`;
                }
                return '';
            }).join('\n\n\t');

            return `
TEDROOMSignal CEDROOMSystemCommSAP::C${sourceNode.data.componentId}${sourceName}_P${port_source_name}__C${targetNode.data.componentId}${targetName}_P${port_target_name}(TEDROOMSignal signalOut){
    TEDROOMSignal signalIn;
    switch(signalOut){
    ${forwardCases.trim()}
        default: signalIn=(TEDROOMSignal)(-1); break;
    }
    return signalIn;
}

TEDROOMSignal CEDROOMSystemCommSAP::C${targetNode.data.componentId}${targetName}_P${port_target_name}__C${sourceNode.data.componentId}${sourceName}_P${port_source_name}(TEDROOMSignal signalOut){
    TEDROOMSignal signalIn;
    switch(signalOut){
    ${reverseCases.trim()}
        default: signalIn=(TEDROOMSignal)(-1); break;
    }
    return signalIn;
}
`;
        }).join('\n');
        
        // 9. Funcion SetLocalConnections
        const localConnections = edges.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode && targetNode && sourceNode.data.node === localNodeName && targetNode.data.node === localNodeName;
        });

        //const setLocalConnectionsContent = localConnections.filter(conn => conn.sourceHandle && conn.targetHandle).map((conn, index) => {
        const setLocalConnectionsContent = localConnections.map((conn, index) => {
            const sourceNode = nodes.find(n => n.id === conn.source)!;
            const targetNode = nodes.find(n => n.id === conn.target)!;
            const sourceInstance = this.getInstanceName(sourceNode, localNodeName);
            const targetInstance = this.getInstanceName(targetNode, localNodeName);
            const sourcePort = this.getPortNameFromEdge(nodes, conn, 'source');
            const targetPort = this.getPortNameFromEdge(nodes, conn, 'target');

            const sourceName = sourceNode.data.name.replace(/\s/g, '');
            const targetName = targetNode.data.name.replace(/\s/g, '');
            
            const port_source_name = sourcePort;
            const port_target_name = targetPort;


            return `\
    m_localCommSAP.Connect(mp_${sourceInstance}->${sourcePort}, mp_${targetInstance}->${targetPort}, connections[${index}],
                              C${sourceNode.data.componentId}${sourceName}_P${port_source_name}__C${targetNode.data.componentId}${targetName}_P${port_target_name},
                              C${targetNode.data.componentId}${targetName}_P${port_target_name}__C${sourceNode.data.componentId}${sourceName}_P${port_source_name});\n`;
        }).join('\n');

        // 10. Funcion SetRemoteConnections
        const remoteConnections = edges.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode && targetNode && sourceNode.data.node !== targetNode.data.node;
        });

        const setRemoteConnectionsContent = remoteConnections.filter(conn => conn.sourceHandle && conn.targetHandle).map((conn, index) => {
            const sourceNode = nodes.find(n => n.id === conn.source)!;
            const targetNode = nodes.find(n => n.id === conn.target)!;

            const localComponent = sourceNode.data.node === localNodeName ? sourceNode : targetNode;
            const remoteComponent = sourceNode.data.node !== localNodeName ? sourceNode : targetNode;

            const localInstance = this.getInstanceName(localComponent, localNodeName);

            const localInterfaceName = this.getPortNameFromEdge(nodes, conn, localComponent === sourceNode ? 'source' : 'target');
            const remoteInterfaceName = this.getPortNameFromEdge(nodes, conn, remoteComponent === sourceNode ? 'source' : 'target');

            const localName = localComponent.data.name.replace(/\s/g, '');
            const remoteName = remoteComponent.data.name.replace(/\s/g, '');

            const local_interface_name = localInterfaceName;
            const remote_interface_name = remoteInterfaceName;
            
            
            return `\
             m_remoteCommSAP.Connect(mp_${localInstance}->${localInterfaceName}, mp_${this.getInstanceName(remoteComponent, localNodeName)}->${remoteInterfaceName}, remote_connections[${index}],
                                             C${localComponent.data.componentId}${localName}_P${local_interface_name}__C${remoteComponent.data.componentId}${remoteName}_P${remote_interface_name},
                                             C${remoteComponent.data.componentId}${remoteName}_P${remote_interface_name}__C${localComponent.data.componentId}${localName}_P${local_interface_name});`;

        }).join('\n\n');

        // 11. Funcion StartComponents
        const startComponentsContent = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            return `      mp_${instanceName}->EDROOMStart();`;
        }).join('\n');

        // 12. MainWait en Start()
        const mainWaitCallParams = allNodes.map(c => `*mp_${this.getInstanceName(c, localNodeName)}`).join(',\n\t\t');

        // 13. MainWait en main_task()
        const mainTaskCallParams = allNodes.map(c => `*systemDeployment.mp_${this.getInstanceName(c, localNodeName)}`).join(',\n\t\t');

        return `//##############################################################################
//###############      This file has been generated by Connectus     ###############
//##############################################################################

#include <edroom_glue/edroomdeployment.h>


//*****************************************************************************
//Main Wait

void MainWait(${mainWaitParams}){

    Pr_Time waitTime(3, 0);

#ifdef _EDROOM_SYSTEM_CLOSE
    while(${mainWaitCheck})
#else
    while(true)
#endif


        Pr_DelayIn(waitTime);
}

//*****************************************************************************
//SetMemory

void CEDROOMSystemMemory::SetMemory(){

${setMemoryContent}
}


//*****************************************************************************
//CEDROOMSystemCommSAP
//*****************************************************************************

//Components
${componentPointers}

//! Event for trigger the bottom half associated to the IRQ
Pr_IRQEvent CEDROOMSystemCommSAP::RemoteCommEventIRQ(0x1D);

//! Binary Semaphore for signal the end of the bottom half of the IRQ
Pr_SemaphoreBin CEDROOMSystemCommSAP::RemoteCommSemEndIRQ(0);

//**************************************************************************************************
//**************Function to get the information of the msg with the most priority*******************
void GetMaxPrioMsgInfo(uint8_t* msgPrio, uint8_t* msgSenderCmp, uint8_t* msgSenderCmpInterface, uint8_t* msgSignal){
    uint8_t aux_prio;
    uint32_t ID_CANMSG = edroom_can_drv_get_id(&aux_prio);
    *msgPrio = aux_prio;
    *msgSenderCmp = (ID_CANMSG>>16) & 0x0000007F;
    *msgSenderCmpInterface = (ID_CANMSG>>10) & 0x0000003F;
    *msgSignal = ID_CANMSG & 0x000003FF;
}


//! IRQ Handler for the IRQ
Pr_IRQHandler_RetType   CEDROOMSystemCommSAP::RemoteCommIRQHandler(void)
{
    uint8_t msg_completed = 0;
    //IRQ Handler
    msg_completed = pi_free_can_irq_handler();
    
    if(msg_completed) RemoteCommEventIRQ.Signal();

}

//! Bottom Half Task Function for the IRQ
Pr_TaskRV_t     CEDROOMSystemCommSAP::RemoteCommIRQBottomHalfTask(Pr_TaskP_t){


    bool endTask=false;

    do
    {

        RemoteCommEventIRQ.Wait();

        if(!RemoteCommSemEndIRQ.WaitCond()){

            uint8_t msgPrio;
            uint8_t msgSenderCmp;
            uint8_t msgSenderCmpInterface;
            uint8_t msgSignal;
            uint8_t flush_edroom = 0; //=0 in case of error in msg, it wont be flushed

            GetMaxPrioMsgInfo(&msgPrio, &msgSenderCmp,&msgSenderCmpInterface,&msgSignal);

            switch (msgSenderCmp){//Who sent the message?
${remoteCommSwitches}
                default:
                    //Error in Remote Msg Reception
                    break;
            }

            Pr_IRQManager::EnableIRQ(0x1D);
            
            if (edroom_can_drv_pending_msg() != 0)
                RemoteCommEventIRQ.Signal();

        }else endTask=1;

    }while(!endTask);


}


//*****************************************************************************
//SetComponents

void CEDROOMSystemCommSAP::SetComponents(${allComponentsForSetComponents}){
    ${setComponentsContent}
}


//*****************************************************************************
//*****************************************************************************
//Signal Translation Functions
//*****************************************************************************
//*****************************************************************************

${signalTranslations}


//*****************************************************************************
//RegisterInterfaces

void CEDROOMSystemCommSAP::RegisterInterfaces(){

${this.generateRegisterInterfaces(allNodes, localNodeName)}
}


//*****************************************************************************
////SetLocalConnections

void CEDROOMSystemCommSAP::SetLocalConnections(){

${setLocalConnectionsContent}
}


//***************************************************************************
// ***************** Connect *******************************


//***************************************************************************
// ***************** RegisterInterface *******************************



TEDROOMInt32 CEDROOMRemoteCommSAP::RegisterInterface( TEDROOMInterfaceID id
        , CEDROOMInterface & interf
        , CEDROOMComponent * component){



    interf.m_IdInterface=id; //interface id

    interf.mp_Component=component;   // component pointer





    return(0);
}


void CEDROOMRemoteCommSAP::Connect(CEDROOMInterface &inter1
        ,CEDROOMInterface &inter2
        , CEDROOMRemoteConnection &connection
        , TEDROOMSignal (f1) (TEDROOMSignal )
        , TEDROOMSignal   (f2) (TEDROOMSignal )){

    //Connect ports


    connection.m_Channel1.mp_SenderPort=&inter1;     //puertos que la forman

    connection.m_Channel1.mp_ReceiverPort=&inter2;     //puertos que la forman

    connection.m_Channel2.mp_SenderPort=&inter2;     //puertos que la forman

    connection.m_Channel2.mp_ReceiverPort=&inter1;     //puertos que la forman

    // pointers to channels

    inter1.mp_Channel=&connection.m_Channel1;
    inter2.mp_Channel=&connection.m_Channel2;


    // pointer to components

    connection.m_Channel1.mp_SenderCmp=inter1.mp_Component;
    connection.m_Channel1.mp_ReceiverCmp=inter2.mp_Component;
    connection.m_Channel2.mp_SenderCmp=inter2.mp_Component;
    connection.m_Channel2.mp_ReceiverCmp=inter1.mp_Component;


    //Signal conversion

    connection.m_Channel1.mp_SenderToReceiverSignalTranslator=f1;
    connection.m_Channel2.mp_SenderToReceiverSignalTranslator=f2;
}

//*****************************************************************************
////SetRemoteConnections

void CEDROOMSystemCommSAP::SetRemoteConnections(){

    //Init CAN Configuration
    //edroom_can_drv_config();
${setRemoteConnectionsContent}
}

//*****************************************************************************
////SetConnections

void CEDROOMSystemCommSAP::SetConnections(){

    SetLocalConnections();
    SetRemoteConnections();

}

//*****************************************************************************
////CEDROOMSystemDeployment Constructor

CEDROOMSystemDeployment::CEDROOMSystemDeployment(){

#ifdef CONFIG_EDROOMSL_ADD_TRACE
#endif
    systemMemory.SetMemory();

}

//*****************************************************************************
////Config

void CEDROOMSystemDeployment::Config(${allComponentsForSetComponents}){

    ${allNodes.map(c => `     mp_${this.getInstanceName(c, localNodeName)}=p_${this.getInstanceName(c, localNodeName)};`).join('\n')}
    //Init CAN Configuration
    edroom_can_drv_config();
    systemCommSAP.SetComponents(${allNodes.map(c => `p_${this.getInstanceName(c, localNodeName)}`).join(', ')});
    systemCommSAP.RegisterInterfaces();
    systemCommSAP.SetConnections();
}

//*****************************************************************************
////StartComponents

void CEDROOMSystemDeployment::StartComponents(){
${startComponentsContent}
}

//*****************************************************************************
////Start

void CEDROOMSystemDeployment::Start(){

    //Install CAN IRQ HANDLER, Vector 0x1D;

    Pr_IRQManager::InstallIRQHandler(CEDROOMSystemCommSAP::RemoteCommIRQHandler,1,0x1D);

    Pr_Task RemoteComm(CEDROOMSystemCommSAP::RemoteCommIRQBottomHalfTask,EDROOMprioURGENT,1024*8);

#ifdef CONFIG_EDROOMBP_DEPLOYMENT_NEED_TASK

    Pr_Task MainTask(CEDROOMSystemDeployment::main_task,EDROOMprioMINIMUM,1024*16);

    kernel.Start();

#else

    StartComponents();

    kernel.Start();

    MainWait(${mainWaitCallParams});

#endif

}

#ifdef CONFIG_EDROOMBP_DEPLOYMENT_NEED_TASK

extern CEDROOMSystemDeployment systemDeployment;


//*****************************************************************************
////main_task


Pr_TaskRV_t CEDROOMSystemDeployment::main_task(Pr_TaskP_t){

    systemDeployment.StartComponents();
    MainWait(${mainTaskCallParams});
}
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
        const componentNameBase = node.data.name.replace(/\s/g, '');
        const prefix = isRemote ? 'r' : '';
        return `${prefix}${componentNameBase}_${node.id}`;
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
        if (isRemote) {
            return `R${componentType}`;
        }
        return componentType;
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

    /**
     * Extrae las señales de los puertos de un componente.
     * Determina si una señal es de entrada (IN) o salida (OUT) basándose en la
     * dirección del mensaje y si el puerto es conjugado.
     * @param {PortData[]} ports - La lista de puertos a analizar.
     * @returns {Array} Un array de objetos que representan las señales.
     */
    private static getComponentSignals(ports: PortData[]): Array<{ name: string; type: 'IN' | 'OUT'; portName: string; dataType: string; messageType: 'invoke' | 'async' | 'reply' }> {
        const signals: Array<{ name: string; type: 'IN' | 'OUT'; portName: string; dataType: string; messageType: 'invoke' | 'async' | 'reply' }> = [];
        ports.forEach(port => {
            if (port.messages) {
                port.messages.forEach(message => {
                    let directionType: 'IN' | 'OUT';
                    if (port.subtype === 'conjugado') {
                        directionType = message.direction === 'entrada' ? 'OUT' : 'IN';
                    } else {
                        directionType = message.direction === 'entrada' ? 'IN' : 'OUT';
                    }
                    signals.push({
                        name: message.signal,
                        type: directionType,
                        portName: port.name.replace(/\s/g, ''),
                        dataType: message.dataType,
                        messageType: message.type
                    });
                });
            }
        });
        return signals;
    }

    /**
     * Genera el código C++ para los `case` de un `switch` que maneja la recepción de señales
     * desde un componente remoto a uno local.
     * @param {Node<NodeData>} remoteNode - El nodo remoto que envía el mensaje.
     * @param {Node<NodeData>} localNode - El nodo local que recibe el mensaje.
     * @param {Edge} connection - La conexión específica entre los dos nodos.
     * @param {string} localNodeName - El nombre del nodo lógico para el que se genera el código.
     * @returns {string} El código C++ para los `case` de las señales.
     */
    private static generateSignalCases(remoteNode: Node<NodeData>, localNode: Node<NodeData>, connection: Edge, localNodeName: string): string {
        let cases = '';
        
        const remoteIsSource = connection.source === remoteNode.id;
        const remotePortHandle = remoteIsSource ? connection.sourceHandle : connection.targetHandle;
        const localPortHandle = remoteIsSource ? connection.targetHandle : connection.sourceHandle;

        const remotePort = remoteNode.data.ports.find(p => p.id === remotePortHandle);
        const localPort = localNode.data.ports.find(p => p.id === localPortHandle);

        if (!remotePort || !localPort) {
            return '';
        }

        const remoteSignals = this.getComponentSignals([remotePort]);
        const localSignals = this.getComponentSignals([localPort]);
        
        const matchingSignals = remoteSignals.filter(rs => rs.type === 'OUT').map(rs => {
            const correspondingLocalSignal = localSignals.find(ls => ls.type === 'IN' && ls.name === rs.name);
            if (correspondingLocalSignal) {
                return { remoteSignal: rs, localSignal: correspondingLocalSignal };
            }
            return null;
        }).filter(Boolean);

        matchingSignals.forEach(match => {
            if (!match) return;

            const remoteComponentClass = this.getComponentClass(remoteNode, localNodeName);
            const remoteProxyInstance = this.getInstanceName(remoteNode, localNodeName);

            const targetPortOnProxy = match.remoteSignal.portName;

            const remoteSignalName = match.remoteSignal.name.replace(/\s/g, '');
            const messageType = match.remoteSignal.messageType;
            const dataType = match.remoteSignal.dataType;
            const dataPoolName = `EDROOMPool${dataType}`;
            const isVoidData = dataType.toLowerCase() === 'null' || dataType.toLowerCase() === 'void' || dataType === '';

            let signalCode = '';

            switch (messageType) {
                case 'async': {
                    if (isVoidData) {
                        signalCode = `
                                    case(${remoteComponentClass}::${remoteSignalName}):{
                                        //Read the NULL data of the message (necessary to discard the message from the buffer)
                                        uint8_t * pDummy;
                                        int32_t msgSize = edroom_can_drv_read_edroom_message(msgPrio, pDummy, 0, flush_edroom);
                                        if(msgSize!=0) {
                                            printf("Error: Wrong msgSize from system bus\\n");
                                        }
                                        //Send the message but no data. (send)
                                        mp_${remoteProxyInstance}->${targetPortOnProxy}.send(msgSignal, NULL, NULL);
                                    }
                                    break;`;
                    } else {
                        signalCode = `
                                    case(${remoteComponentClass}::${remoteSignalName}):{
                                        //Read the data of the msg
                                        uint32_t elementsize = mp_${remoteProxyInstance}->${dataPoolName}.GetElementSize();
                                        ${dataType} * pData = mp_${remoteProxyInstance}->${dataPoolName}.AllocData();
                                        int32_t msgSize = edroom_can_drv_read_edroom_message(msgPrio, (uint8_t *) pData, elementsize, flush_edroom);
                                        if(msgSize<=0 || (uint32_t)msgSize != elementsize) {
                                            //Error case, msg size is wrong
                                            printf("Error: Wrong msgSize from system bus\\n");
                                            mp_${remoteProxyInstance}->${dataPoolName}.FreeData(pData);
                                        } else {
                                            //Send the message and the data. (send)
                                            mp_${remoteProxyInstance}->${targetPortOnProxy}.send(msgSignal, pData, &mp_${remoteProxyInstance}->${dataPoolName});
                                        }
                                    }
                                    break;`;
                    }
                    break;
                }
                case 'invoke': {
                    if (isVoidData) {
                        signalCode = `
                                    case(${remoteComponentClass}::${remoteSignalName}):{
                                        //Read the NULL data of the message (neccesary to discard the message from the buffer)
                                        uint8_t * pDummy;
                                        int32_t msgSize = edroom_can_drv_read_edroom_message(msgPrio, pDummy, 0, flush_edroom);
                                        if(msgSize!=0) {
                                            printf("Error: Wrong msgSize from system bus\\n");
                                        } else {
                                            mp_${remoteProxyInstance}->${targetPortOnProxy}.invoke_from_remote(msgSignal, NULL, NULL);
                                        }
                                    }
                                    break;`;
                    } else {
                        signalCode = `
                                    case(${remoteComponentClass}::${remoteSignalName}):{
                                        //Read the data of the msg
                                        uint32_t elementsize = mp_${remoteProxyInstance}->${dataPoolName}.GetElementSize();
                                        ${dataType} * pData = mp_${remoteProxyInstance}->${dataPoolName}.AllocData();
                                        int32_t msgSize = edroom_can_drv_read_edroom_message(msgPrio, (uint8_t *) pData, elementsize, flush_edroom);
                                        if(msgSize<=0 || (uint32_t)msgSize != elementsize) {
                                            //Error case, msgSize is wrong
                                            printf("Error: Wrong msgSize from system bus\\n");
                                            mp_${remoteProxyInstance}->${dataPoolName}.FreeData(pData);
                                        } else {
                                            //Send the message and the data. (invoke)
                                            mp_${remoteProxyInstance}->${targetPortOnProxy}.invoke_from_remote(msgSignal, pData, &mp_${remoteProxyInstance}->${dataPoolName});
                                        }
                                    }
                                    break;`;
                    }
                    break;
                }
                case 'reply': {
                    if (isVoidData) {
                        signalCode = `
                                    case(${remoteComponentClass}::${remoteSignalName}):{
                                        //Read the NULL data of the message (neccesary to discard the message from the buffer)
                                         uint8_t * pDummy;
                                        int32_t msgSize = edroom_can_drv_read_edroom_message(msgPrio, pDummy, 0, flush_edroom);
                                        if(msgSize!=0) {
                                            printf("Error:Wrong Msg Size for reply\\n");
                                        } else {
                                            mp_${remoteProxyInstance}->${targetPortOnProxy}.reply_from_remote(msgSignal);
                                        }
                                     }
                                     break;`;
                    } else {
                        signalCode = `
                                    case(${remoteComponentClass}::${remoteSignalName}):{
                                        //Read the data of the msg
                                        uint32_t elementsize = mp_${remoteProxyInstance}->${dataPoolName}.GetElementSize();
                                        ${dataType} * pData = mp_${remoteProxyInstance}->${dataPoolName}.AllocData();
                                        int32_t msgSize = edroom_can_drv_read_edroom_message(msgPrio, (uint8_t *) pData, elementsize, flush_edroom);
                                        if(msgSize<=0 || (uint32_t)msgSize != elementsize) {
                                            printf("Error: Wrong msgSize from system bus\\n");
                                            mp_${remoteProxyInstance}->${dataPoolName}.FreeData(pData);
                                        } else {
                                            mp_${remoteProxyInstance}->${targetPortOnProxy}.reply_from_remote(msgSignal, pData, &mp_${remoteProxyInstance}->${dataPoolName});
                                        }
                                    }
                                    break;`;
                    }
                    break;
                }
            }
            cases += signalCode;
        });

        return cases;
    }

    /**
     * Genera el código C++ para la función `RegisterInterfaces`.
     * @param {Node<NodeData>[]} nodes - Todos los nodos del diagrama.
     * @returns {string} El código C++ para el registro de interfaces.
     */
    private static generateRegisterInterfaces(nodes: Node<NodeData>[], localNodeName: string): string {
        return nodes.map(c => {
            let content = '';
            const instanceName = this.getInstanceName(c, localNodeName);
            const componentPorts = c.data.ports;
            const isLocalComponent = c.data.node === localNodeName;

            content += `	// Register Interfaces for Component ${c.data.componentId}//${c.data.name.replace(/\s/g, '')}\n`;

            componentPorts.forEach(port => {
                const portName = port.name.replace(/\s/g, '');
                const portId = port.id;
                let registrationLine = '';
                if (port.type === 'tiempo' || port.type === 'interrupcion') {
                    if(isLocalComponent)
                    {
                        registrationLine = `	m_localCommSAP.RegisterInterface(${portId}, mp_${instanceName}->${portName}, mp_${instanceName});`;
                    }
                } else {
                    registrationLine = `	m_localCommSAP.RegisterInterface(${portId}, mp_${instanceName}->${portName}, mp_${instanceName});`;
                }
                content += `${registrationLine}\n`;
            });
            return content;
        }).join('\n');
    }
}