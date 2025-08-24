import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { Node, NodeData, Edge } from './types';
import { icuasw_mmesp_project_template } from './code_templates/main/icuasw_mmesp_project_template';
import { edroomdeployment_h_template } from './code_templates/deployment/edroomdeployment_h_template';
import { edroomdeployment_cpp_template } from './code_templates/deployment/edroomdeployment_cpp_template'; // Nueva importación

export class CodeGenerator {
    /**
     * Genera un único archivo ZIP que contiene una carpeta por cada nodo lógico.
     * @param nodes Los nodos del diagrama.
     * @param edges Las conexiones entre los nodos.
     */
    public static async generateCodeAndDownload(nodes: Node<NodeData>[], edges: Edge[]): Promise<void> {

        const zip = new JSZip();

        const uniqueNodeNames = Array.from(new Set(nodes.map(c => c.data.node).filter(Boolean)));
        const nodesToGenerate = uniqueNodeNames.length > 0 ? uniqueNodeNames : ['default_node'];

        for (const nodeToGenerate of nodesToGenerate) {

            const nodeFolder = zip.folder(nodeToGenerate as string);

            if (nodeFolder) {
                const mainFileContent = icuasw_mmesp_project_template.generateMainFileContent(nodes, nodeToGenerate as string);
                nodeFolder.file("icuasw_mmesp_project.cpp", mainFileContent);

                const glueFolder = nodeFolder.folder("edroom_glue");
                if (glueFolder) {
                    const glueIncludeFolder = glueFolder.folder("include/edroom_glue");
                    if (glueIncludeFolder) {
                        const deploymentHeaderContent = edroomdeployment_h_template.generateHeaderFileContent(nodes, nodeToGenerate as string, edges);
                        glueIncludeFolder.file("edroomdeployment.h", deploymentHeaderContent);
                    }

                    const glueSrcFolder = glueFolder.folder("src");
                    if (glueSrcFolder) {
                        const deploymentCppContent = edroomdeployment_cpp_template.generateCppFileContent(nodes, nodeToGenerate as string, edges);
                        glueSrcFolder.file("edroomdeployment.cpp", deploymentCppContent);
                    }
                }
            }
        }

        await zip.generateAsync({ type: "blob" })
            .then(content => {
                saveAs(content, `edroom_projects_all.zip`);
            });
    }
}