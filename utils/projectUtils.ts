import { Project } from '../types';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// Keep a narrow set of node data keys to avoid bloated JSON exports
const pickNodeData = (data: any) => {
    const {
        label,
        content,
        assets,
        branches,
        jumpTargetId,
        jumpTargetLabel,
        text,
        color,
        date,
        arrowDirection
    } = data || {};

    // Always include required NodeData fields with safe fallbacks
    return {
        label: typeof label === 'string' ? label : '',
        content: typeof content === 'string' ? content : '',
        ...(Array.isArray(assets) ? { assets } : {}),
        ...(Array.isArray(branches) ? { branches } : {}),
        ...(jumpTargetId ? { jumpTargetId } : {}),
        ...(jumpTargetLabel ? { jumpTargetLabel } : {}),
        ...(text ? { text } : {}),
        ...(color ? { color } : {}),
        ...(date ? { date } : {}),
        ...(arrowDirection ? { arrowDirection } : {}),
    };
};

const sanitizeProjectForExport = (project: Project, includeAssets: boolean) => {
    // Shallow clone first
    const cloned: Project = JSON.parse(JSON.stringify(project));

    // Sanitize boards -> nodes
    cloned.boards = cloned.boards.map((board) => ({
        ...board,
        // Only keep minimal node fields required to restore the flow
        nodes: board.nodes.map((node) => {
            const width =
                typeof node.width === 'number'
                    ? node.width
                    : typeof (node as any)?.style?.width === 'number'
                        ? (node as any).style.width
                        : undefined;
            const height =
                typeof node.height === 'number'
                    ? node.height
                    : typeof (node as any)?.style?.height === 'number'
                        ? (node as any).style.height
                        : undefined;
            const zIndex =
                typeof (node as any).zIndex === 'number'
                    ? (node as any).zIndex
                    : typeof (node as any)?.style?.zIndex === 'number'
                        ? (node as any).style.zIndex
                        : undefined;

            const style: Record<string, number> = {};
            if (typeof width === 'number') style.width = width;
            if (typeof height === 'number') style.height = height;
            if (typeof zIndex === 'number') style.zIndex = zIndex;

            return {
                id: node.id,
                type: node.type,
                position: node.position,
                data: pickNodeData(node.data),
                // Preserve user sizing/z-order so layout stays intact after import
                ...(typeof width === 'number' ? { width } : {}),
                ...(typeof height === 'number' ? { height } : {}),
                ...(typeof zIndex === 'number' ? { zIndex } : {}),
                ...(Object.keys(style).length ? { style } : {}),
                // Keep parentNode to restore nesting; drop layout-calculated props
                ...(node.parentNode ? { parentNode: node.parentNode } : {}),
            };
        }),
        // Keep edges lean
        edges: board.edges.map((edge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            type: edge.type,
        })),
    }));

    // Assets: if not including assets, clear urls; otherwise they will be rewritten later
    cloned.assets = cloned.assets.map((asset) => ({
        ...asset,
        url: includeAssets ? asset.url : '',
    }));

    // Drop cover image in JSON (exporter handles file separately)
    if (!includeAssets && cloned.coverImage && cloned.coverImage.startsWith('data:')) {
        cloned.coverImage = '';
    }

    return cloned;
};

export const exportProject = (project: Project) => {
    const sanitized = sanitizeProjectForExport(project, false);
    const jsonString = JSON.stringify(sanitized); // no pretty print
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', url);
    downloadAnchorNode.setAttribute('download', project.name.replace(/\s+/g, '_') + '.json');
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    URL.revokeObjectURL(url);
};

export const exportProjectAsZip = async (project: Project, includeAssets: boolean) => {
    const zip = new JSZip();
    
    // Sanitize upfront to drop bulky or unused fields
    const projectToSave = sanitizeProjectForExport(project, includeAssets);
    
    // Helper to extract base64 data
    const extractBase64 = (dataUrl: string) => {
        if (!dataUrl?.startsWith('data:')) return null;
        const base64Index = dataUrl.indexOf(';base64,');
        if (base64Index === -1) return null;

        const meta = dataUrl.slice(5, base64Index); // strip leading "data:"
        const data = dataUrl.slice(base64Index + ';base64,'.length).replace(/\s/g, '');
        const type = meta.split(';')[0]; // drop any codecs or charset params

        if (!type || !data) return null;
        return { type, data };
    };

    // Helper to get extension from mime type
    const getExtension = (mimeType: string) => {
        switch (mimeType) {
            case 'image/jpeg': return 'jpg';
            case 'image/png': return 'png';
            case 'image/gif': return 'gif';
            case 'image/webp': return 'webp';
            case 'image/svg+xml': return 'svg';
            case 'audio/mpeg': return 'mp3';
            case 'audio/wav': return 'wav';
            case 'audio/ogg': return 'ogg';
            case 'audio/webm': return 'webm';
            case 'audio/opus': return 'opus';
            case 'audio/mp4': return 'm4a';
            case 'video/mp4': return 'mp4';
            case 'video/webm': return 'webm';
            case 'video/ogg': return 'ogv';
            case 'video/quicktime': return 'mov';
            default: return 'bin';
        }
    };

    // 1. Handle Cover Image (always strip from JSON, optionally export as file)
    if (projectToSave.coverImage && projectToSave.coverImage.startsWith('data:')) {
        if (includeAssets) {
            const extracted = extractBase64(projectToSave.coverImage);
            if (extracted) {
                const ext = getExtension(extracted.type);
                const coverFilename = `cover.${ext}`;
                zip.file(coverFilename, extracted.data, { base64: true });
                projectToSave.coverImage = coverFilename;
            } else {
                projectToSave.coverImage = '';
            }
        } else {
            projectToSave.coverImage = '';
        }
    }

    // 2. Handle Assets
    if (includeAssets) {
        // Helper to get folder path
        const getFolderPath = (folderId: string | null): string => {
            if (!folderId) return "";
            const folder = project.folders.find(f => f.id === folderId);
            if (!folder) return "";
            const parentPath = getFolderPath(folder.parentId);
            return parentPath ? `${parentPath}/${folder.name}` : folder.name;
        };

        // Process assets
        for (const asset of projectToSave.assets) {
            if (asset.url && asset.url.startsWith('data:')) {
                const extracted = extractBase64(asset.url);
                if (extracted) {
                    const folderPath = getFolderPath(asset.parentId);
                    const fileName = asset.name; 
                    const hasExt = fileName.includes('.');
                    const finalFileName = hasExt ? fileName : `${fileName}.${getExtension(extracted.type)}`;
                    const assetFolder = folderPath || asset.type; // fall back to type bucket for predictable grouping
                    const zipPath = assetFolder ? `assets/${assetFolder}/${finalFileName}` : `assets/${finalFileName}`;
                    zip.file(zipPath, extracted.data, { base64: true });
                    asset.url = zipPath; // Only keep the relative path in JSON
                } else {
                    asset.url = ''; // Clear invalid data
                }
            } else if (asset.url && asset.url.startsWith('blob:')) {
                // Blob URLs are not serializable; drop them to keep JSON lean
                asset.url = '';
            }
        }
    } else {
        // Strip asset data to reduce size
        projectToSave.assets = projectToSave.assets.map(a => ({
            ...a,
            url: '' // Clear data
        }));
    }

    // 3. Handle Embedded Images in Node Content (Rich Text)
    // This is a bit more complex as we need to parse HTML. 
    // We'll use a regex to find <img src="data:...">
    if (includeAssets) {
        projectToSave.boards.forEach(board => {
            board.nodes.forEach(node => {
                if (node.data.content && typeof node.data.content === 'string') {
                    let content = node.data.content;
                    // Regex to find data URI images
                    // Matches both single and double quoted src attributes
                    const imgRegex = /src=['"](data:image\/[^;]+;base64,[^'"\s]+)['"]/g;
                    let match;
                    let imgIndex = 0;
                    
                    // We need to replace matches, but string is immutable. 
                    // Let's build a list of replacements first.
                    const replacements: {original: string, replacement: string}[] = [];

                    while ((match = imgRegex.exec(content)) !== null) {
                        const fullMatch = match[0]; // src="data:..."
                        const dataUrl = match[1]; // data:..."
                        
                        const extracted = extractBase64(dataUrl);
                        if (extracted) {
                            const ext = getExtension(extracted.type);
                            const fileName = `embedded/${board.id}_${node.id}_${imgIndex}.${ext}`;
                            zip.file(fileName, extracted.data, { base64: true });
                            
                            replacements.push({
                                original: fullMatch,
                                replacement: `src="${fileName}"`
                            });
                            imgIndex++;
                        }
                    }

                    // Apply replacements
                    replacements.forEach(rep => {
                        content = content.replace(rep.original, rep.replacement);
                    });
                    
                    node.data.content = content;
                }
            });
        });
    } else {
        // Strip embedded images if not including assets
        projectToSave.boards.forEach(board => {
            board.nodes.forEach(node => {
                if (node.data.content && typeof node.data.content === 'string') {
                    // Replace data URI src with empty string or placeholder
                    node.data.content = node.data.content.replace(/src=["']data:[^"']+["']/g, 'src=""');
                }
            });
        });
    }

    // Final safety: strip any residual data URIs from the serialized JSON to avoid accidental bloat
    let projectJson = JSON.stringify(projectToSave); // no pretty print to keep small
    projectJson = projectJson.replace(/data:[^"']+;base64,[A-Za-z0-9+/=]+/g, '');

    // Add Project.json
    zip.file('Project.json', projectJson);

    // Generate ZIP
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
    saveAs(content, `${project.name.replace(/\s+/g, "_")}.zip`);
};

