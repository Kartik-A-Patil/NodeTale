import { Project } from '../models/story';
import { compactProject } from '../services/storageService';
import { EXTENSION_MIME } from '../services/projectImport';
import { getStorageAdapter } from '../services/storage';

const sanitizeProjectForExport = (project: Project, includeAssets: boolean): Project => {
    // Deep copy: the zip export rewrites asset urls and node content in place.
    const cloned: Project = structuredClone(compactProject(project));
    cloned.assets = cloned.assets.map((asset) => ({ ...asset, url: includeAssets ? asset.url : '' }));
    // The exporter writes the cover as its own file.
    if (!includeAssets && cloned.coverImage?.startsWith('data:')) cloned.coverImage = '';
    return cloned;
};

// A plain <a download>: every browser and Electron support it, no library needed.
const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const exportProject = (project: Project) => {
    const sanitized = sanitizeProjectForExport(project, false);
    const jsonString = JSON.stringify(sanitized); // no pretty print
    downloadBlob(new Blob([jsonString], { type: 'application/json' }), project.name.replace(/\s+/g, '_') + '.json');
};

export const exportProjectAsZip = async (project: Project, includeAssets: boolean) => {
    const { default: JSZip } = await import('jszip');
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

    const getExtension = (mimeType: string) =>
        Object.keys(EXTENSION_MIME).find((ext) => EXTENSION_MIME[ext] === mimeType.split(';')[0]) ?? 'bin';

    // 1. Handle Cover Image (always strip from JSON, optionally export as file)
    if (projectToSave.coverImage && projectToSave.coverImage.startsWith('data:')) {
        if (includeAssets) {
            const extracted = extractBase64(projectToSave.coverImage);
            if (extracted) {
                const ext = getExtension(extracted.type);
                const coverFilename = `cover.${ext}`;
                zip.file(coverFilename, extracted.data, { base64: true, compression: 'STORE' });
                projectToSave.coverImage = coverFilename;
            } else {
                projectToSave.coverImage = '';
            }
        } else {
            projectToSave.coverImage = '';
        }
    }

    const adapter = getStorageAdapter();

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

        // Process assets — in parallel; each is an independent storage read.
        await Promise.all(projectToSave.assets.map(async (asset) => {
            try {
                // If the asset has a data URL (Legacy Base64), extract it.
                // If it has NO url (modern), fetch via ID.
                // If it has a Blob URL (modern), fetch via ID.
                
                let blob: Blob | null = null;

                if (asset.url && asset.url.startsWith('data:')) {
                     // Fallback for non-migrated assets?
                     // Ideally we should have migrated. But let's handle "data:" just in case.
                     // Re-use logic or just fetch it.
                     const res = await fetch(asset.url);
                     blob = await res.blob();
                } else {
                     // Modern path: fetch from storage by ID
                     blob = await adapter.getAssetData(asset.id);
                }

                if (blob) {
                    const ext = getExtension(blob.type);
                    const folderPath = getFolderPath(asset.parentId);
                    const fileName = asset.name; 
                    const hasExt = fileName.includes('.');
                    const finalFileName = hasExt ? fileName : `${fileName}.${ext}`;
                    const assetFolder = folderPath || asset.type; // fall back to type bucket for predictable grouping
                    const zipPath = assetFolder ? `assets/${assetFolder}/${finalFileName}` : `assets/${finalFileName}`;
                    
                    // STORE, not DEFLATE: images/audio/video are already
                    // compressed, and re-deflating them at level 9 in pure JS
                    // was most of the export time for ~nothing saved.
                    zip.file(zipPath, blob, { compression: 'STORE' });
                    asset.url = zipPath; // Store relative path in JSON for export
                }
            } catch (err) {
                console.error(`Failed to export asset ${asset.id}`, err);
                asset.url = ''; 
            }
        }));
    } else {
        // Strip asset data to reduce size
        projectToSave.assets = projectToSave.assets.map(a => ({
            ...a,
            url: '' // Clear data
        }));
    }

    // Handle embedded images in node content.
    if (includeAssets) {
        projectToSave.boards.forEach(board => {
            board.nodes.forEach(node => {
                const nodeData = node.data as { content?: string };
                if (nodeData.content && typeof nodeData.content === 'string') {
                    let content = nodeData.content;
                    // Regex to find data URI images
                    // Matches both single and double quoted src attributes
                    const imgRegex = /src=['"](data:image\/[^;]+;base64,[^'"\s]+)['"]/g;
                    let match;
                    let imgIndex = 0;
                    
                    const replacements: {original: string, replacement: string}[] = [];

                    while ((match = imgRegex.exec(content)) !== null) {
                        const fullMatch = match[0]; // src="data:..."
                        const dataUrl = match[1]; // data:..."
                        
                        const extracted = extractBase64(dataUrl);
                        if (extracted) {
                            const ext = getExtension(extracted.type);
                            const fileName = `embedded/${board.id}_${node.id}_${imgIndex}.${ext}`;
                            zip.file(fileName, extracted.data, { base64: true, compression: 'STORE' });
                            
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
                    
                    nodeData.content = content;
                }
            });
        });
    } else {
        // Strip embedded images if not including assets
        projectToSave.boards.forEach(board => {
            board.nodes.forEach(node => {
                const nodeData = node.data as { content?: string };
                if (nodeData.content && typeof nodeData.content === 'string') {
                    // Replace data URI src with empty string or placeholder
                    nodeData.content = nodeData.content.replace(/src=["']data:[^"']+["']/g, 'src=""');
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
    const content = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    downloadBlob(content, `${project.name.replace(/\s+/g, '_')}.zip`);
};
