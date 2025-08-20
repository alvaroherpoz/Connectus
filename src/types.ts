// Importamos los tipos directamente de reactflow y los renombramos para evitar conflictos
import type {
    Node as RFNode,
    Edge as RFEdge,
    Connection as RFConnection,
    EdgeChange as RFEdgeChange,
    BackgroundVariant as RFBackgroundVariant,
    OnNodesChange as RFOnNodesChange,
    NodeProps as RFNodeProps,
    NodeChange as RFNodeChange
} from 'reactflow';

// Nuevo: Objeto que define un mensaje dentro de un puerto
export interface Message {
    signal: string;
    dataType: string;
    direction: 'entrada' | 'salida';
}

// Definiciones de interfaces específicas de tu aplicación
export interface PortData {
    id: string;
    name: string;
    type: 'comunicacion' | 'tiempo' | 'interrupcion';
    subtype?: 'nominal' | 'conjugado';
    // Ahora los puertos de comunicacion pueden tener multiples mensajes
    messages?: Message[];
    // Los puertos de interrupcion tienen un handler, como antes
    interruptHandler?: string; 
}

export interface NodeData {
    name: string;
    ports: PortData[];
    node?: string;
}

// Re-exportamos los tipos de React Flow, utilizando nuestras interfaces de datos
// Esto asegura que todos los componentes utilicen la misma definición de 'Node' y 'Edge'
export type Node<T = NodeData> = RFNode<T>;
export type Edge = RFEdge;
export type Connection = RFConnection;
export type EdgeChange = RFEdgeChange;
export type BackgroundVariant = RFBackgroundVariant;
export type OnNodesChange = RFOnNodesChange;
export type NodeProps<T = NodeData> = RFNodeProps<T>;
export type NodeChange = RFNodeChange;