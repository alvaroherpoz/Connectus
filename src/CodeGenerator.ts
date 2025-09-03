/**
 * CodeGenerator.ts
 * Clase responsable de generar el código fuente del proyecto a partir del diagrama y empaquetarlo en un archivo ZIP descargable.
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Node, NodeData, Edge } from './types';
import { icuasw_mmesp_project_template } from './code_templates/main/icuasw_mmesp_project_template';
import { edroomdeployment_h_template } from './code_templates/deployment/edroomdeployment_h_template';
import { edroomdeployment_cpp_template } from './code_templates/deployment/edroomdeployment_cpp_template';

/**
 * Clase estática para la generación y descarga de código fuente.
 */
export class CodeGenerator {
    /**
     * Genera un único archivo ZIP que contiene una carpeta por cada nodo lógico.
     * @param nodes Los nodos del diagrama.
     * @param edges Las conexiones entre los nodos.
     */
    public static async generateCodeAndDownload(nodes: Node<NodeData>[], edges: Edge[]): Promise<void> {
        const zip = new JSZip();

        // Obtiene los nombres únicos de los nodos lógicos
        const uniqueNodeNames = Array.from(new Set(nodes.map(c => c.data.node).filter(Boolean)));
        const nodesToGenerate = uniqueNodeNames.length > 0 ? uniqueNodeNames : ['default_node'];

        for (const nodeToGenerate of nodesToGenerate) {
            const nodeFolder = zip.folder(nodeToGenerate as string);

            if (nodeFolder) {
                // Genera el archivo principal del nodo
                const mainFileContent = icuasw_mmesp_project_template.generateMainFileContent(nodes, nodeToGenerate as string);
                nodeFolder.file("icuasw_mmesp_project.cpp", mainFileContent);

                // Carpeta para archivos glue
                const glueFolder = nodeFolder.folder("edroom_glue");
                if (glueFolder) {
                    // Carpeta include para el header de despliegue
                    const glueIncludeFolder = glueFolder.folder("include/edroom_glue");
                    if (glueIncludeFolder) {
                        const deploymentHeaderContent = edroomdeployment_h_template.generateHeaderFileContent(nodes, nodeToGenerate as string, edges);
                        glueIncludeFolder.file("edroomdeployment.h", deploymentHeaderContent);
                    }

                    // Carpeta src para el cpp de despliegue
                    const glueSrcFolder = glueFolder.folder("src");
                    if (glueSrcFolder) {
                        const deploymentCppContent = edroomdeployment_cpp_template.generateCppFileContent(nodes, nodeToGenerate as string, edges);
                        glueSrcFolder.file("edroomdeployment.cpp", deploymentCppContent);
                    }
                }
            }
        }

        // Genera y descarga el archivo ZIP
        await zip.generateAsync({ type: "blob" })
            .then(content => {
                saveAs(content, `edroom_projects_all.zip`);
            });
    }
}