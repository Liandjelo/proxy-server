const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    startProxy: (port) => ipcRenderer.invoke('start-proxy', port),
    stopProxy: () => ipcRenderer.invoke('stop-proxy'),
    
    // New Blocklist functions
    getBlocked: () => ipcRenderer.invoke('get-blocked'),
    addBlock: (site) => ipcRenderer.invoke('add-block', site),
    removeBlock: (site) => ipcRenderer.invoke('remove-block', site),

    onLog: (callback) => ipcRenderer.on('proxy-log', (event, data) => callback(data))
});