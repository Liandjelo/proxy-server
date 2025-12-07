const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const net = require('net');
const url = require('url');
const Store = require('electron-store');

const store = new Store();
let mainWindow;
let proxyServer;

// Load blocked sites from storage (default to empty array)
let blockedSites = store.get('blockedSites', []);

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 900,
        height: 700,
        titleBarStyle: 'hidden', // Modern look
        titleBarOverlay: {
            color: '#111827',
            symbolColor: '#ffffff'
        },
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// --- Helper: Check if site is blocked ---
function isBlocked(hostname) {
    if (!hostname) return false;
    return blockedSites.some(site => hostname.includes(site));
}

// --- IPC Handlers for UI ---
ipcMain.handle('get-blocked', () => blockedSites);

ipcMain.handle('add-block', (event, site) => {
    if (!blockedSites.includes(site)) {
        blockedSites.push(site);
        store.set('blockedSites', blockedSites); // Save to disk
    }
    return blockedSites;
});

ipcMain.handle('remove-block', (event, site) => {
    blockedSites = blockedSites.filter(s => s !== site);
    store.set('blockedSites', blockedSites); // Save to disk
    return blockedSites;
});

ipcMain.handle('start-proxy', async (event, port) => {
    if (proxyServer) return "Server already running";

    return new Promise((resolve, reject) => {
        try {
            proxyServer = http.createServer((clientReq, clientRes) => {
                const reqUrl = url.parse(clientReq.url);

                // 1. BLOCK CHECK (HTTP)
                if (isBlocked(reqUrl.hostname)) {
                    logToUI(`[BLOCKED] HTTP request to ${reqUrl.hostname}`, 'error');
                    clientRes.writeHead(403, { 'Content-Type': 'text/plain' });
                    clientRes.end('Access Denied by Electron Proxy');
                    return;
                }

                logToUI(`[HTTP] ${reqUrl.hostname}`, 'info');

                const options = {
                    hostname: reqUrl.hostname,
                    port: reqUrl.port || 80,
                    path: reqUrl.path,
                    method: clientReq.method,
                    headers: clientReq.headers
                };

                const proxyReq = http.request(options, (proxyRes) => {
                    clientRes.writeHead(proxyRes.statusCode, proxyRes.headers);
                    proxyRes.pipe(clientRes, { end: true });
                });

                proxyReq.on('error', (e) => {
                    // Suppress minor connection errors
                });

                clientReq.pipe(proxyReq, { end: true });
            });

            // 2. BLOCK CHECK (HTTPS Tunnel)
            proxyServer.on('connect', (req, clientSocket, head) => {
                const { port, hostname } = url.parse(`//${req.url}`, false, true);

                if (isBlocked(hostname)) {
                    logToUI(`[BLOCKED] HTTPS tunnel to ${hostname}`, 'error');
                    clientSocket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    clientSocket.end();
                    return;
                }

                logToUI(`[HTTPS] ${hostname}`, 'success');

                const serverSocket = net.connect(port || 443, hostname, () => {
                    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                    serverSocket.write(head);
                    serverSocket.pipe(clientSocket);
                    clientSocket.pipe(serverSocket);
                });

                serverSocket.on('error', () => clientSocket.end());
                clientSocket.on('error', () => serverSocket.end());
            });

            proxyServer.listen(port, '0.0.0.0', () => {
                logToUI(`Proxy started on port ${port} (All Interfaces)`);
                resolve(`Running on ${port}`);
            });

        } catch (error) {
            reject(error.message);
        }
    });
});

ipcMain.handle('stop-proxy', async () => {
    if (proxyServer) {
        proxyServer.close();
        proxyServer = null;
    }
    return "Proxy stopped";
});

function logToUI(message, type) {
    if (mainWindow) mainWindow.webContents.send('proxy-log', { message, type });
}