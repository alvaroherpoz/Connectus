/**
 * types.ts
 * Define los tipos y estructuras de datos utilizados en la aplicación Connectus.
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
 * Prioridad de los componentes.
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
 * Representa un mensaje asociado a un puerto de comunicación.
 */
export interface Message {
  signal: string;
  dataType: string;
  direction: 'entrada' | 'salida';
}

/**
 * Representa un puerto de un componente.
 */
export interface PortData {
  id: string;
  name: string;
  type: 'comunicacion' | 'tiempo' | 'interrupcion';
  subtype?: 'nominal' | 'conjugado';
  messages?: Message[];
  interruptHandler?: string;
}

/**
 * Representa un nodo (componente) del diagrama.
 */
export interface NodeData {
  name: string;
  ports: PortData[];
  node?: string;
  componentId: number;
  maxMessages: number;
  priority: ComponentPriority;
  stackSize: number;
  isTop?: boolean;
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