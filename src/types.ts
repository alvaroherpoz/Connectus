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

export type ComponentPriority = 'EDROOMprioURGENT' | 'EDROOMprioVeryHigh' | 'EDROOMprioHigh' | 'EDROOMprioNormal' | 'EDROOMprioLow' | 'EDROOMprioVeryLow' | 'EDROOMprioIDLE' | 'EDROOMprioMINIMUM';

export interface Message {
  signal: string;
  dataType: string;
  direction: 'entrada' | 'salida';
}

export interface PortData {
  id: string;
  name: string;
  type: 'comunicacion' | 'tiempo' | 'interrupcion';
  subtype?: 'nominal' | 'conjugado';
  messages?: Message[];
  interruptHandler?: string;
}

export interface NodeData {
  name: string;
  ports: PortData[];
  node?: string;
  componentId: number;
  maxMessages: number;
  priority: ComponentPriority;
  stackSize: number;
  isTop?: boolean; // ¡Atributo añadido aquí!
}

export type Node<T = NodeData> = RFNode<T>;
export type Edge = RFEdge;
export type Connection = RFConnection;
export type EdgeChange = RFEdgeChange;
export type BackgroundVariant = RFBackgroundVariant;
export type OnNodesChange = RFOnNodesChange;
export type NodeProps<T = NodeData> = RFNodeProps<T>;
export type NodeChange = RFNodeChange;