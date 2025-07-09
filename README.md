
# Android Control Dashboard

A modern, ethical Android device management dashboard built with Firebase and Material Design. This tool provides real-time device monitoring and control capabilities through a clean web interface.

![Dashboard Preview](https://via.placeholder.com/800x400/667eea/ffffff?text=Android+Control+Dashboard)

## ⚠️ Legal Disclaimer

**FOR EDUCATIONAL AND AUTHORIZED USE ONLY**

This tool is designed for:
- Personal device management
- Parental control applications
- Corporate device administration
- Security research and education

**You must have explicit authorization to monitor any device. Unauthorized use is illegal and unethical.**

## 🌟 Features

### Modern UI/UX
- Clean Material Design interface
- Responsive design for all devices
- Real-time status indicators
- Toast notifications and loading states
- Dark theme support (coming soon)

### Device Management
- **Communication**: SMS, call logs, contacts
- **File System**: Browse, download files
- **Media Control**: Audio recording, photo capture
- **System Control**: Device info, location, apps
- **Remote Actions**: Vibrate, flashlight, TTS
- **Shell Access**: Execute system commands

### Security & Authentication
- Firebase Authentication (email/password)
- Secure real-time database
- Command logging and audit trail
- Multi-device support

## 🚀 Quick Start

### Prerequisites
- Firebase account
- Web hosting (Replit recommended)
- Target Android device with companion app

### 1. Firebase Setup

1. Create a new Firebase project at [firebase.google.com](https://firebase.google.com)

2. Enable the following services:
   - **Authentication** (Email/Password)
   - **Realtime Database**
   - **Storage** (optional)

3. Configure Realtime Database rules:
```json
{
  "rules": {
    "devices": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    },
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

4. Get your Firebase configuration from Project Settings

### 2. Dashboard Deployment

#### Using Replit (Recommended)

1. Fork this repository to Replit
2. Open `WEB PANEL/firebase-config.js`
3. Replace the placeholder config with your Firebase config:

```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com/",
    projectId: "your-project-id",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "your-app-id"
};
```

4. The project is configured to run automatically. Just click the Run button or use:
```bash
cd "WEB PANEL" && npx http-server -p 5000 -a 0.0.0.0
```

5. Run the project and access via the provided URL

#### Using Firebase Hosting

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Initialize hosting: `firebase init hosting`
4. Deploy: `firebase deploy`

### 3. Create User Account

1. Access your deployed dashboard
2. Since there's no registration UI, manually create a user in Firebase Auth console
3. Or implement registration (see Advanced Setup)

### 4. Android Client Setup

The dashboard expects commands to be sent to Firebase paths like:
```
/devices/{device_id}/commands/{command_id}
```

And results to be written to:
```
/devices/{device_id}/results/{result_id}
```

## 📱 Supported Commands

### Communication
```javascript
// Get SMS messages
{ command: "get_sms", params: {} }

// Send SMS
{ command: "send_sms", params: { number: "+1234567890", message: "Hello" } }

// Get call logs
{ command: "get_call_logs", params: {} }

// Get contacts
{ command: "get_contacts", params: {} }
```

### File Management
```javascript
// Browse files
{ command: "get_files", params: { path: "/sdcard/Download" } }

// Download file
{ command: "download_file", params: { path: "/sdcard/file.txt" } }
```

### Media Control
```javascript
// Record audio
{ command: "record_audio", params: { duration: 5000 } }

// Take photo
{ command: "take_photo", params: {} }

// Play sound
{ command: "play_sound", params: { url: "https://example.com/sound.mp3" } }
```

### System Control
```javascript
// Get device info
{ command: "get_info", params: {} }

// Get location
{ command: "get_location", params: {} }

// Text to speech
{ command: "tts", params: { text: "Hello World" } }

// Vibrate device
{ command: "vibrate", params: { duration: 1000 } }

// Control flashlight
{ command: "flash_on", params: {} }
{ command: "flash_off", params: {} }

// Get clipboard
{ command: "get_clipboard", params: {} }

// Open URL
{ command: "open_url", params: { url: "https://example.com" } }

// List apps
{ command: "get_apps", params: {} }

// Open app
{ command: "open_app", params: { package: "com.android.chrome" } }

// Execute shell command
{ command: "shell", params: { command: "ls -la" } }
```

## 🛠️ Advanced Configuration

### Custom Authentication

To add user registration:

```javascript
// Add to app.js
async signUp(email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await database.ref(`users/${userCredential.user.uid}`).set({
            email: email,
            createdAt: Date.now()
        });
    } catch (error) {
        this.showToast(this.getErrorMessage(error), 'error');
    }
}
```

### Multi-Device Support

The dashboard already supports multiple devices. Device selection UI can be added:

```javascript
// Add device selector to the UI
selectDevice(deviceId) {
    this.currentDevice = deviceId;
    this.updateDeviceStatus();
}
```

### Custom Commands

Add new commands by extending the `executeCommand` method:

```javascript
// In app.js
handleCommandResult(result) {
    const { command, data, status, error } = result;
    
    switch (command) {
        case 'your_custom_command':
            this.handleCustomCommand(data);
            break;
        // ... existing cases
    }
}
```

## 🔧 Development

### Project Structure
```
WEB PANEL/
├── index.html          # Main dashboard interface
├── styles.css          # Material Design styles
├── app.js              # Core application logic
└── firebase-config.js  # Firebase configuration
```

### Key Components

1. **Authentication** - Firebase Auth with email/password
2. **Real-time Database** - Command queue and results
3. **UI Framework** - Custom Material Design implementation
4. **Command System** - Structured command/response pattern

### Adding New Features

1. Add UI elements to `index.html`
2. Style with Material Design in `styles.css`
3. Implement logic in `app.js`
4. Update Firebase database structure if needed

## 🐛 Troubleshooting

### Common Issues

**Firebase Connection Failed**
- Check Firebase configuration in `firebase-config.js`
- Verify project ID and API keys
- Check database rules

**Commands Not Working**
- Ensure device is connected and online
- Check Firebase database for command structure
- Verify Android client is listening to correct paths

**Authentication Issues**
- Check if Email/Password auth is enabled in Firebase
- Verify user exists in Firebase Auth console
- Check browser console for detailed errors

### Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## 📊 Monitoring

### Database Structure
```
/devices
  /{device_id}
    /info: { model, version, battery, etc. }
    /commands: { command queue }
    /results: { command results }
    /status: { online, lastSeen }
```

### Logs
All commands and results are logged in the dashboard's log panel for debugging and audit purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Material Design Guidelines
- Firebase Team
- Open source community

---

**Remember**: Always ensure you have proper authorization before monitoring any device. Use responsibly and ethically.
