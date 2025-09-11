/**
 * @fileoverview Define las interfaces y tipos de datos principales utilizados en toda la aplicación,
 * como Nodos, Puertos, Mensajes y otros tipos de React Flow.
 */

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

/**
 * Define los niveles de prioridad para los componentes EDROOM.
 */
export type ComponentPriority =
  | 'EDROOMprioURGENT'
  | 'EDROOMprioVeryHigh'
  | 'EDROOMprioHigh'
  | 'EDROOMprioNormal'
  | 'EDROOMprioLow'
  | 'EDROOMprioVeryLow'
  | 'EDROOMprioIDLE'
  | 'EDROOMprioMINIMUM';

/**
 * Define el tipo de mensaje de comunicación.
 */
export type MessageType = 'invoke' | 'async' | 'reply';

/**
 * Representa un mensaje que puede ser enviado o recibido a través de un puerto de comunicación.
 * @interface Message
 */
export interface Message {
  /** Nombre único de la señal del mensaje dentro de un protocolo. */
  signal: string;
  /** Tipo de dato que transporta el mensaje. */
  dataType: string;
  /** Dirección del mensaje (desde la perspectiva del puerto nominal). */
  direction: 'entrada' | 'salida';
  /** Tipo de comunicación del mensaje. */
  type: MessageType;
  /** Para mensajes 'reply', almacena la señal del 'invoke' al que responde. */
  invokeSignal?: string;
}

/**
 * Representa un puerto de un componente EDROOM.
 * @interface PortData
 */
export interface PortData {
  /** ID numérico único del puerto dentro de su componente. */
  id: string;
  /** Nombre descriptivo del puerto. */
  name: string;
  /** Tipo de puerto. */
  type: 'comunicacion' | 'tiempo' | 'interrupcion';
  /** Subtipo para puertos de comunicación. */
  subtype?: 'nominal' | 'conjugado';
  /** Nombre del protocolo para puertos de comunicación. */
  protocolName?: string;
  /** Lista de mensajes asociados al puerto. */
  messages?: Message[];
}

/**
 * Representa los datos de un componente EDROOM en el diagrama.
 * @interface NodeData
 */
export interface NodeData {
  /** Nombre del componente. */
  name: string;
  /** Lista de puertos del componente. */
  ports: PortData[];
  /** Nombre del nodo lógico al que pertenece el componente. */
  node?: string;
  /** ID numérico único del componente en el sistema. */
  componentId: number;
  /** Número máximo de mensajes en la cola del componente. */
  maxMessages: number;
  /** Prioridad de ejecución del componente. */
  priority: ComponentPriority;
  /** Tamaño de la pila (stack) para el componente. */
  stackSize: number;
  /** Indica si es el componente 'top' del sistema. */
  isTop?: boolean;
  onPortClick?: (port: PortData, nodeId: string) => void;
  onDeletePort?: (nodeId: string, portId: string) => void;
}

/**
 * Tipos auxiliares para ReactFlow.
 */
export type Node<T = NodeData> = RFNode<T>;
export type Edge = RFEdge;
export type Connection = RFConnection;
export type EdgeChange = RFEdgeChange;
export type BackgroundVariant = RFBackgroundVariant;
export type OnNodesChange = RFOnNodesChange;
export type NodeProps<T = NodeData> = RFNodeProps<T>;
export type NodeChange = RFNodeChange;