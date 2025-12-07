// DOM Elements
const toggleBtn = document.getElementById('toggleBtn');
const portInput = document.getElementById('portInput');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const logsDiv = document.getElementById('logs');
const blockListDiv = document.getElementById('blockList');
const blockInput = document.getElementById('blockInput');
const addBlockBtn = document.getElementById('addBlockBtn');
const clearLogsBtn = document.getElementById('clearLogs');

let isRunning = false;

// --- Initialization ---
(async () => {
    // Load saved blocked sites on startup
    const sites = await window.api.getBlocked();
    renderBlockList(sites);
})();

// --- Event Listeners ---

toggleBtn.addEventListener('click', async () => {
    if (!isRunning) {
        // Start
        const port = parseInt(portInput.value);
        const res = await window.api.startProxy(port);
        
        // Update UI
        isRunning = true;
        toggleBtn.textContent = "Stop Server";
        toggleBtn.classList.replace('bg-blue-600', 'bg-red-600');
        toggleBtn.classList.replace('hover:bg-blue-500', 'hover:bg-red-500');
        statusDot.classList.replace('bg-red-500', 'bg-green-500');
        statusDot.classList.replace('shadow-[0_0_8px_rgba(239,68,68,0.6)]', 'shadow-[0_0_8px_rgba(34,197,94,0.6)]');
        statusText.textContent = "Active";
        statusText.classList.replace('text-gray-400', 'text-green-400');
        portInput.disabled = true;
        addLog(res, 'system');
    } else {
        // Stop
        const res = await window.api.stopProxy();
        
        // Update UI
        isRunning = false;
        toggleBtn.textContent = "Start Server";
        toggleBtn.classList.replace('bg-red-600', 'bg-blue-600');
        toggleBtn.classList.replace('hover:bg-red-500', 'hover:bg-blue-500');
        statusDot.classList.replace('bg-green-500', 'bg-red-500');
        statusDot.classList.replace('shadow-[0_0_8px_rgba(34,197,94,0.6)]', 'shadow-[0_0_8px_rgba(239,68,68,0.6)]');
        statusText.textContent = "Stopped";
        statusText.classList.replace('text-green-400', 'text-gray-400');
        portInput.disabled = false;
        addLog(res, 'system');
    }
});

addBlockBtn.addEventListener('click', async () => {
    const site = blockInput.value.trim();
    if (site) {
        const newList = await window.api.addBlock(site);
        renderBlockList(newList);
        blockInput.value = '';
    }
});

clearLogsBtn.addEventListener('click', () => {
    logsDiv.innerHTML = '<div class="text-gray-600 italic">Logs cleared.</div>';
});

// --- Helper Functions ---

function renderBlockList(sites) {
    blockListDiv.innerHTML = '';
    sites.forEach(site => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center bg-gray-800 p-2 rounded border border-gray-700 group";
        div.innerHTML = `
            <span class="text-xs text-gray-300 truncate">${site}</span>
            <button class="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" onclick="removeSite('${site}')">
                &times;
            </button>
        `;
        blockListDiv.appendChild(div);
    });
}

// Global function for the onclick event in HTML
window.removeSite = async (site) => {
    const newList = await window.api.removeBlock(site);
    renderBlockList(newList);
};

function addLog(message, type) {
    const div = document.createElement('div');
    
    // Style based on log type
    let colorClass = 'text-gray-400';
    if (type === 'error') colorClass = 'text-red-400 font-bold'; // Blocked
    if (type === 'success') colorClass = 'text-green-400'; // HTTPS Tunnel
    if (type === 'info') colorClass = 'text-blue-300'; // Standard HTTP
    if (type === 'system') colorClass = 'text-yellow-500 font-bold'; 

    const time = new Date().toLocaleTimeString('en-US', { hour12: false });

    div.innerHTML = `<span class="text-gray-600 mr-2">[${time}]</span> <span class="${colorClass}">${message}</span>`;
    logsDiv.appendChild(div);
    logsDiv.scrollTop = logsDiv.scrollHeight;
}

window.api.onLog(({ message, type }) => {
    addLog(message, type);
});