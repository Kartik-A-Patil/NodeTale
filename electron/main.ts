import { app, shell, BrowserWindow, ipcMain, protocol, net } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import fs from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// GPU: Let Chromium use hardware acceleration by default.
// Only fall back to software rendering if GPU actually crashes at runtime.
app.on('gpu-info-update', () => {
  console.log('[Main] GPU info updated');
});

// Disable sandbox for development on Linux (avoids SUID sandbox permission issues)
// NOTE: For production, configure chrome-sandbox permissions properly instead
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
}

// Register the asset:// protocol as privileged BEFORE app is ready.
// This is required for <audio> and <video> elements to stream from custom protocols.
// Without this, only <img> works (it doesn't require streaming).
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'asset',
    privileges: {
      standard: true,       // Proper URL parsing (host, path, query)
      secure: true,         // Treat as secure origin
      supportFetchAPI: true, // Allow net.fetch in handler
      corsEnabled: true,    // Allow cross-origin from renderer
      stream: true,         // CRITICAL: Enable streaming for <audio>/<video>
    },
  },
]);

function createWindow(): void {
  console.log('[Main] Creating window...');
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: true, // Force show immediately for debugging
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon: path.join(__dirname, '../../build/icon.png') } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    console.log('[Main] Window ready to show');
    mainWindow.show()
    // Open DevTools in dev mode or if explicitly requested
    if (is.dev || process.env.DEBUG) {
        // Delay opening devTools slightly to prevent race condition in renderer initialization
        setTimeout(() => {
            mainWindow.webContents.openDevTools();
        }, 500);
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    console.log('[Main] Loading dev URL:', process.env['ELECTRON_RENDERER_URL']);
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    const filePath = join(__dirname, '../renderer/index.html');
    console.log('[Main] Loading file:', filePath);
    mainWindow.loadFile(filePath).catch(e => console.error('[Main] Failed to load file:', e));
  }
}

app.whenReady().then(() => {
  console.log('[Main] App Ready');
  electronApp.setAppUserModelId('com.electron')

  // MIME type map for asset types
  const ASSET_MIME: Record<string, string> = {
    image: 'image/png',
    audio: 'audio/mpeg',
    video: 'video/mp4',
    'image/jpeg': 'image/jpeg',
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp',
    'image/svg+xml': 'image/svg+xml',
    'audio/mpeg': 'audio/mpeg',
    'audio/wav': 'audio/wav',
    'audio/ogg': 'audio/ogg',
    'audio/mp4': 'audio/mp4',
    'audio/webm': 'audio/webm',
    'video/mp4': 'video/mp4',
    'video/webm': 'video/webm',
    'video/ogg': 'video/ogg',
    'video/quicktime': 'video/quicktime',
  };

  // Register custom protocol for loading local assets
  protocol.handle('asset', async (request) => {
    // Chromium normalizes custom protocols: asset://uuid -> host="uuid", path="/"
    const url = new URL(request.url);
    const rawId = url.hostname || url.pathname.replace(/^\//, '');
    const safeId = path.basename(decodeURIComponent(rawId.replace(/\/+$/, '')));
    const assetPath = path.join(app.getPath('userData'), 'assets', safeId);

    // Determine MIME type from query param, sidecar .meta file, or extension
    let mimeType = '';
    const typeParam = url.searchParams.get('type');
    if (typeParam && ASSET_MIME[typeParam]) {
      mimeType = ASSET_MIME[typeParam];
    } else {
      // Try reading sidecar .meta file
      try {
        const meta = await fs.readFile(assetPath + '.meta', 'utf-8');
        mimeType = meta.trim();
      } catch {
        // No meta file — let Chromium try content sniffing
      }
    }

    // Use net.fetch for the file, then override headers if we know MIME
    const response = await net.fetch('file://' + assetPath);
    if (mimeType) {
      // Return a new Response with correct Content-Type
      const body = await response.arrayBuffer();
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': mimeType },
      });
    }
    return response;
  });

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Storage Setup
  const userDataPath = app.getPath('userData');
  const projectsDir = path.join(userDataPath, 'projects');
  const assetsDir = path.join(userDataPath, 'assets');

  if (!existsSync(projectsDir)) mkdirSync(projectsDir, { recursive: true });
  if (!existsSync(assetsDir)) mkdirSync(assetsDir, { recursive: true });

  // IPC Handlers
  
  ipcMain.handle('storage:save-asset', async (_, buffer: ArrayBuffer, name: string, preferredId?: string, mimeType?: string) => {
    const id = preferredId ? path.basename(preferredId) : randomUUID();
    const safeId = path.basename(id);
    
    // Write asset data
    await fs.writeFile(path.join(assetsDir, safeId), Buffer.from(buffer));
    
    // Write MIME sidecar for the asset:// protocol handler
    // Infer from explicit mimeType, file extension, or default
    const ext = path.extname(name).toLowerCase().replace('.', '');
    const EXT_MIME: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
      webp: 'image/webp', svg: 'image/svg+xml',
      mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4',
      mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
    };
    const resolvedMime = mimeType || EXT_MIME[ext] || 'application/octet-stream';
    await fs.writeFile(path.join(assetsDir, safeId + '.meta'), resolvedMime);
    
    return safeId;
  });

  ipcMain.handle('storage:load-asset', async (_, id: string) => {
     const safeId = path.basename(id);
     return path.join(assetsDir, safeId);
  });

  ipcMain.handle('storage:delete-asset', async (_, id: string) => {
     const safeId = path.basename(id);
     const target = path.join(assetsDir, safeId);
     try {
        await fs.unlink(target);
     } catch (e) {
        // ignore if missing
     }
  });

  ipcMain.handle('storage:get-asset-data', async (_, id: string) => {
     const safeId = path.basename(id);
     return await fs.readFile(path.join(assetsDir, safeId));
  });

  // Project Handlers
  ipcMain.handle('storage:save-project', async (_, project: any) => {
     const safeId = path.basename(project.id);
     const target = path.join(projectsDir, safeId + '.json');
     const temp = target + '.' + randomUUID() + '.tmp';
     await fs.writeFile(temp, JSON.stringify(project));
     await fs.rename(temp, target);
  });

  ipcMain.handle('storage:load-project', async (_, idOrName: string) => {
     // 1. Try loading as ID (filename = idOrName + .json)
     let safeId = path.basename(idOrName); 
     // Check if idOrName ends with .json (unlikely from ID but possible if name passed)
     if (safeId.endsWith('.json')) safeId = safeId.replace('.json', '');
     
     const idPath = path.join(projectsDir, safeId + '.json');

     try {
         const content = await fs.readFile(idPath, 'utf-8');
         return JSON.parse(content);
     } catch (e) {
         // 2. Not found by ID, try scanning for Name
         // This is O(N) but acceptable for number of projects usually < 100 on desktop
         try {
             const files = await fs.readdir(projectsDir);
             for (const file of files) {
                  if (file.endsWith('.json')) {
                      try {
                          const content = await fs.readFile(path.join(projectsDir, file), 'utf-8');
                          const project = JSON.parse(content);
                          if (project.name === idOrName) {
                              return project;
                          }
                      } catch (err) {
                          // skip corrupt
                      }
                  }
             }
         } catch (dirErr) {
             return null;
         }
         return null;
     }
  });

  ipcMain.handle('storage:get-all-projects', async () => {
      try {
          const files = await fs.readdir(projectsDir);
          const projects = [];
          for (const file of files) {
              if (file.endsWith('.json')) {
                  try {
                      const content = await fs.readFile(path.join(projectsDir, file), 'utf-8');
                      projects.push(JSON.parse(content));
                  } catch (e) {
                      // skip corrupted
                  }
              }
          }
          return projects;
      } catch (e) {
          return [];
      }
  });

  ipcMain.handle('storage:delete-project', async (_, id: string) => {
      const safeId = path.basename(id);
      try {
          await fs.unlink(path.join(projectsDir, safeId + '.json'));
      } catch (e) {
          // ignore
      }
  });


  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
