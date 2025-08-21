// src/CodeGenerator.ts

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Node, NodeData } from './types';
import { icuasw_mmesp_project_template } from './code_templates/main/icuasw_mmesp_project_template';

export class CodeGenerator {
    /**
     * Genera un único archivo ZIP que contiene una carpeta por cada nodo lógico.
     * @param nodes Los nodos del diagrama.
     */
    public static async generateCodeAndDownload(nodes: Node<NodeData>[]): Promise<void> {

        const zip = new JSZip();

        // Obtener nombres de nodos únicos y válidos del diagrama.
        const uniqueNodeNames = Array.from(new Set(nodes.map(c => c.data.node).filter(Boolean)));

        // Si no hay nodos válidos, se genera un solo proyecto por defecto.
        const nodesToGenerate = uniqueNodeNames.length > 0 ? uniqueNodeNames : ['default_node'];

        // Generar una carpeta por cada nodo lógico dentro del único ZIP.
        for (const nodeToGenerate of nodesToGenerate) {

            // Se fuerza el tipo a `string` para satisfacer al compilador.
            const nodeFolder = zip.folder(nodeToGenerate as string);

            if (nodeFolder) {
                const mainFileContent = icuasw_mmesp_project_template.generateMainFileContent(nodes, nodeToGenerate as string);
                nodeFolder.file("icuasw_mmesp_project.cpp", mainFileContent);

                const glueFolder = nodeFolder.folder("edroom_glue");
                if (glueFolder) {
                    const glueIncludeFolder = glueFolder.folder("include/edroom_glue");
                    if (glueIncludeFolder) {
                        glueIncludeFolder.file("edroomdeployment.h", "");
                    }

                    const glueSrcFolder = glueFolder.folder("src");
                    if (glueSrcFolder) {
                        glueSrcFolder.file("edroomdeployment.c", "");
                    }
                }
            }
        }

        // Descargar el único archivo ZIP.
        await zip.generateAsync({ type: "blob" })
            .then(content => {
                saveAs(content, `edroom_projects_all.zip`);
            });
    }
}