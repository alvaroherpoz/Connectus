// src/CodeGenerator.ts

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Edge } from 'reactflow';

export class CodeGenerator {
  // 1. Declara la propiedad de la clase explícitamente
  private edges: Edge[];

  // 2. Asigna la propiedad en el constructor
  constructor(edges: Edge[]) {
    this.edges = edges;
  }

  private generateConnectionsCode(): string {
    let connectionCode = '';
    this.edges.forEach(edge => {
      connectionCode += `    // Conexión del componente ${edge.source} a ${edge.target}\n`;
      connectionCode += `    bus_can_connect(component_${edge.source}, component_${edge.target});\n`;
    });
    return connectionCode;
  }

  private getCodeTemplate(connections: string): string {
    return `
// Archivo generado automáticamente para las interconexiones del bus CAN

#include "can_bus.h"
#include "edroom_component.h"

void setup_can_connections() {
    // Conexiones de componentes a través del bus CAN
${connections}
}
    `;
  }

  public async generateAndDownload(): Promise<void> {
    const connectionsCode = this.generateConnectionsCode();
    const finalCode = this.getCodeTemplate(connectionsCode);

    const zip = new JSZip();
    zip.file('can_interconnections.c', finalCode);

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, 'edroom_connections.zip');
  }
}