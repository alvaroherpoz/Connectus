import type { Node, NodeData, Edge, PortData } from '../../types';

export class edroomdeployment_cpp_template {
    public static generateCppFileContent(nodes: Node<NodeData>[], localNodeName: string, edges: Edge[]): string {

        const allNodes = nodes;
        const remoteNodes = nodes.filter(n => n.data.node !== localNodeName);

        // 2. MainWait function
        const mainWaitParams = allNodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass} & ${instanceName}`;
        }).join(',\n\t\t');
        
        const mainWaitCheck = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            return `!${instanceName}.EDROOMIsComponentFinished()`;
        }).join('\n\t\t\t||');

        // 3. SetMemory
        const setMemoryContent = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            const maxMessages = c.data.maxMessages;
            const maxQueueNodes = c.data.maxMessages;

            return `\
    ${instanceName}Memory.SetMemory(${maxMessages}, ${instanceName}Messages, &${instanceName}MessagesMarks[0]
                         ,${maxQueueNodes},${instanceName}QueueNodes, &${instanceName}QueueNodesMarks[0]);`;
        }).join('\n');

        // 4. Component pointers initialization
        const componentPointers = allNodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass} * CEDROOMSystemCommSAP::mp_${instanceName}=NULL;`;
        }).join('\n');

        // 5. RemoteCommIRQBottomHalfTask logic
        const remoteCommSwitches = remoteNodes.map(remoteCmp => {
            const remoteCmpId = remoteCmp.data.componentId;

            const remoteConnections = edges.filter(e => {
                const sourceNode = nodes.find(n => n.id === e.source);
                const targetNode = nodes.find(n => n.id === e.target);
                return (sourceNode?.data.node !== targetNode?.data.node) &&
                    (sourceNode?.data.componentId === remoteCmpId || targetNode?.data.componentId === remoteCmpId);
            });

            const interfaceCases = remoteConnections.map(conn => {
                const sourceNode = nodes.find(n => n.id === conn.source)!;
                const targetNode = nodes.find(n => n.id === conn.target)!;
                const localNode = sourceNode.data.node === localNodeName ? sourceNode : targetNode;
                const remoteNode = sourceNode.data.node !== localNodeName ? sourceNode : targetNode;

                const remoteInterfaceId = this.getInterfaceIdFromEdge(remoteNode, conn);
                const remoteInterfaceName = this.getPortsFromEdge(conn, remoteNode === sourceNode ? 'source' : 'target');

                return `
                        case(${remoteInterfaceId}): // Port: ${remoteInterfaceName}
                            switch(msgSignal){
${this.generateSignalCases(remoteNode, localNode)}
                            }
                            break;`;
            }).join('\n');

            return `
            case(${remoteCmpId}): // ${remoteCmp.data.name} sent it
                switch(msgSenderCmpInterface){ // What interface was used?
${interfaceCases}
                }
                break;`;
        }).join('');

        // 6. SetComponents
        const allComponentsForSetComponents = allNodes.map(c => {
            const componentClass = this.getComponentClass(c, localNodeName);
            const instanceName = this.getInstanceName(c, localNodeName);
            return `${componentClass} *p_${instanceName}`;
        }).join(',\n\t\t');
        
        const setComponentsContent = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            return `mp_${instanceName}=p_${instanceName};`;
        }).join('\n\t');


        // 7. Signal Translation Functions
        const nonTopConnections = edges.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode && targetNode && !sourceNode.data.isTop && !targetNode.data.isTop;
        });
        
        const signalTranslations = nonTopConnections.map(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source)!;
            const targetNode = nodes.find(n => n.id === conn.target)!;
            const sourceName = sourceNode.data.name.replace(/\s/g, '');
            const targetName = targetNode.data.name.replace(/\s/g, '');
            const sourcePortName = this.getPortsFromEdge(conn, 'source');
            const targetPortName = this.getPortsFromEdge(conn, 'target');
            
            const port_source_name = sourcePortName;
            const port_target_name = targetPortName;


            // FIX: getComponentSignals must be called with the specific port data
            const sourcePortData = sourceNode.data.ports.filter(p => p.name.replace(/\s/g, '') === sourcePortName);
            const targetPortData = targetNode.data.ports.filter(p => p.name.replace(/\s/g, '') === targetPortName);

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
        
        // 9. SetLocalConnections
        const localConnections = edges.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode && targetNode && sourceNode.data.node === localNodeName && targetNode.data.node === localNodeName && !sourceNode.data.isTop && !targetNode.data.isTop;
        });

        const setLocalConnectionsContent = localConnections.map((conn, index) => {
            const sourceNode = nodes.find(n => n.id === conn.source)!;
            const targetNode = nodes.find(n => n.id === conn.target)!;
            const sourceInstance = this.getInstanceName(sourceNode, localNodeName);
            const targetInstance = this.getInstanceName(targetNode, localNodeName);
            const sourcePort = this.getPortsFromEdge(conn, 'source');
            const targetPort = this.getPortsFromEdge(conn, 'target');

            const sourceName = sourceNode.data.name.replace(/\s/g, '');
            const targetName = targetNode.data.name.replace(/\s/g, '');
            
            const port_source_name = sourcePort;
            const port_target_name = targetPort;


            return `\
    m_localCommSAP.Connect(mp_${sourceInstance}->${sourcePort}, mp_${targetInstance}->${targetPort}, connections[${index}],
                              C${sourceNode.data.componentId}${sourceName}_P${port_source_name}__C${targetNode.data.componentId}${targetName}_P${port_target_name},
                              C${targetNode.data.componentId}${targetName}_P${port_target_name}__C${sourceNode.data.componentId}${sourceName}_P${port_source_name});\n`;
        }).join('\n');

        // 10. SetRemoteConnections
        const remoteConnections = edges.filter(conn => {
            const sourceNode = nodes.find(n => n.id === conn.source);
            const targetNode = nodes.find(n => n.id === conn.target);
            return sourceNode && targetNode && sourceNode.data.node !== targetNode.data.node;
        });

        const setRemoteConnectionsContent = remoteConnections.map((conn, index) => {
            const sourceNode = nodes.find(n => n.id === conn.source)!;
            const targetNode = nodes.find(n => n.id === conn.target)!;

            const localComponent = sourceNode.data.node === localNodeName ? sourceNode : targetNode;
            const remoteComponent = sourceNode.data.node !== localNodeName ? sourceNode : targetNode;

            const localInstance = this.getInstanceName(localComponent, localNodeName);
            const remoteInstance = this.getInstanceName(remoteComponent, localNodeName);

            const localInterfaceName = this.getPortsFromEdge(conn, localComponent === sourceNode ? 'source' : 'target');
            const remoteInterfaceName = this.getPortsFromEdge(conn, remoteComponent === sourceNode ? 'source' : 'target');

            const localName = localComponent.data.name.replace(/\s/g, '');
            const remoteName = remoteComponent.data.name.replace(/\s/g, '');

            const local_interface_name = localInterfaceName;
            const remote_interface_name = remoteInterfaceName;
            
            // Cambiado: Ahora el segundo argumento apunta al puerto de la instancia remota
            return `\
             m_remoteCommSAP.Connect(mp_${localInstance}->${localInterfaceName}, mp_${remoteInstance}->${remoteInterfaceName}, remote_connections[${index}],
                                             C${localComponent.data.componentId}${localName}_P${local_interface_name}__C${remoteComponent.data.componentId}${remoteName}_P${remote_interface_name},
                                             C${remoteComponent.data.componentId}${remoteName}_P${remote_interface_name}__C${localComponent.data.componentId}${localName}_P${local_interface_name});`;

        }).join('\n\n');

        // 11. StartComponents
        const startComponentsContent = allNodes.map(c => {
            const instanceName = this.getInstanceName(c, localNodeName);
            return `      mp_${instanceName}->EDROOMStart();`;
        }).join('\n');

        // 12. MainWait call in Start()
        const mainWaitCallParams = allNodes.map(c => `*mp_${this.getInstanceName(c, localNodeName)}`).join(',\n\t\t');

        // 13. MainWait call in main_task()
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

${this.generateRegisterInterfaces(allNodes)}
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

    // --- Funciones auxiliares para la lógica de la plantilla ---

    private static getInstanceName(node: Node<NodeData>, localNodeName: string): string {
        const componentNameBase = node.data.name.replace(/\s/g, '').toLowerCase();

        if (node.data.node === localNodeName) {
            // Local node
            return componentNameBase;
        } else {
            // Remote node
            return `r${componentNameBase}`;
        }
    }

    private static getComponentClass(node: Node<NodeData>, localNodeName: string): string {
        const componentType = node.data.name.replace(/\s/g, '');

        if (node.data.node === localNodeName) {
            // Local node
            if (node.data.isTop) {
                return componentType;
            } else {
                return `CC${componentType}`;
            }
        } else {
            // Remote node
            if (node.data.isTop) {
                return `R${componentType}`;
            } else {
                return `RCC${componentType}`;
            }
        }
    }
    private static getPortsFromEdge(edge: Edge, type: 'source' | 'target'): string {
        const portHandle = type === 'source' ? edge.sourceHandle : edge.targetHandle;
        if (portHandle) {
            const parts = portHandle.split('-');
            return parts[1] || '';
        }
        return '';
    }

    private static getInterfaceIdFromEdge(node: Node<NodeData>, edge: Edge): string | number {
        const handle = node.id === edge.source ? edge.sourceHandle : edge.targetHandle;
        const portName = handle?.split('-')[1];
        const interfaceObj = node.data.ports.find(port => port.name.toLowerCase().replace(/\s/g, '') === portName?.toLowerCase());
        return interfaceObj?.id || -1;
    }

    private static getComponentSignals(ports: PortData[]): Array<{ name: string; type: 'IN' | 'OUT'; portName: string; dataType: string }> {
        const signals: Array<{ name: string; type: 'IN' | 'OUT'; portName: string; dataType: string }> = [];
        ports.forEach(port => {
            if (port.messages) {
                port.messages.forEach(message => {
                    signals.push({
                        name: message.signal,
                        type: message.direction === 'entrada' ? 'IN' : 'OUT',
                        portName: port.name.replace(/\s/g, ''),
                        dataType: message.dataType
                    });
                });
            }
        });
        return signals;
    }

    private static generateSignalCases(remoteNode: Node<NodeData>, localNode: Node<NodeData>): string {
        let cases = '';
        const remoteSignals = this.getComponentSignals(remoteNode.data.ports);
        const localSignals = this.getComponentSignals(localNode.data.ports);

        const matchingSignals = remoteSignals.filter(rs => rs.type === 'OUT').map(rs => {
            const correspondingLocalSignal = localSignals.find(ls => ls.type === 'IN' && ls.name === rs.name);
            if (correspondingLocalSignal) {
                return {
                    remoteSignal: rs,
                    localSignal: correspondingLocalSignal
                };
            }
            return null;
        }).filter(Boolean);

        matchingSignals.forEach(match => {
            if (!match) return;
            const remoteSignalName = match.remoteSignal.name.replace(/\s/g, '');
            const localComponentClass = this.getComponentClass(localNode, localNode.data.node!);
            const localComponentInstance = this.getInstanceName(localNode, localNode.data.node!);

            const isAsync = true;

            const dataPoolName = `EDROOMPoolC${match.remoteSignal.dataType}`;

            const signalCode = `
                                    case(${localComponentClass}::${remoteSignalName}):{
                                        uint32_t elementsize = mp_${localComponentInstance}->${dataPoolName}.GetElementSize();
                                        ${match.remoteSignal.dataType} * pData=mp_${localComponentInstance}->${dataPoolName}.AllocData();
                                        int32_t msgSize = edroom_can_drv_read_edroom_message(msgPrio, (uint8_t *) pData, elementsize, flush_edroom);
                                        if(msgSize<=0 || (uint32_t)msgSize != elementsize)
                                        {
                                            printf("Error: Wrong msgSize from system bus\\n");
                                            mp_${localComponentInstance}->${dataPoolName}.FreeData(pData);
                                        }
                                        ${isAsync ? `mp_${localComponentInstance}->${match.localSignal.portName}.send(msgSignal,pData,&mp_${localComponentInstance}->${dataPoolName});` :
                                                 `mp_${localComponentInstance}->${match.localSignal.portName}.invoke_from_remote(msgSignal,pData,&mp_${localComponentInstance}->${dataPoolName});`}
                                    }
                                    break;
            `;
            cases += signalCode;
        });

        return cases;
    }

    // Función modificada para manejar la lógica de registro de interfaces
    private static generateRegisterInterfaces(nodes: Node<NodeData>[]): string {
        let content = '';

        nodes.forEach(c => {
            let interfaceIdCounter = 0; // Reinicia el contador para cada componente
            const instanceName = this.getInstanceName(c, c.data.node!);
            const componentPorts = c.data.ports;

            content += `      // Register Interfaces for Component ${c.data.componentId}//${c.data.name.replace(/\s/g, '')}\n`;

            componentPorts.forEach(port => {
                let registrationLine = '';
                
                // Lógica para puertos de comunicación
                if (port.type === 'comunicacion') {
                    interfaceIdCounter++;
                    registrationLine = `m_localCommSAP.RegisterInterface(${interfaceIdCounter}, mp_${instanceName}->${port.name.replace(/\s/g, '')}, mp_${instanceName});`;
                } 
                // Lógica para puertos de tiempo e interrupción
                else if (port.type === 'tiempo' || port.type === 'interrupcion') {
                    // Estos puertos no se conectan a otros componentes, se registran como puertos de tarea
                    interfaceIdCounter++;
                    registrationLine = `m_localCommSAP.RegisterInterface(${interfaceIdCounter}, mp_${instanceName}->${port.name.replace(/\s/g, '')}, EDROOM::EDROOM_TASK_PORT);`;
                }
                
                if (registrationLine) {
                    content += `      ${registrationLine}\n`;
                }
            });
            content += `\n`;
        });
        return content;
    }
}