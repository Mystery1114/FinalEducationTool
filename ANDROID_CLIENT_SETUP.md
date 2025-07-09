
# Android Client Setup Guide

This document provides comprehensive instructions for creating an Android app that communicates with the Android Control Dashboard.

## Overview

The Android client app connects to Firebase Realtime Database to receive commands from the web dashboard and send back results. It uses Firebase SDK and requires specific permissions to execute various device functions.

## Prerequisites

- Android Studio 4.0+
- Android SDK API Level 21+ (Android 5.0)
- Firebase project (same as web dashboard)
- Device with debugging enabled

## Project Setup

### 1. Create New Android Project

1. Open Android Studio
2. Create new project with Empty Activity
3. Set minimum SDK to API 21
4. Choose Java or Kotlin (examples below use Java)

### 2. Add Firebase Dependencies

Add to `app/build.gradle`:

```gradle
dependencies {
    implementation 'com.google.firebase:firebase-database:20.3.0'
    implementation 'com.google.firebase:firebase-auth:22.3.0'
    implementation 'androidx.work:work-runtime:2.8.1'
    
    // For JSON parsing
    implementation 'com.google.code.gson:gson:2.10.1'
    
    // For HTTP requests
    implementation 'com.squareup.okhttp3:okhttp:4.12.0'
}
```

Add to project-level `build.gradle`:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

Add to `app/build.gradle` (bottom):

```gradle
apply plugin: 'com.google.gms.google-services'
```

### 3. Add Permissions

Add to `AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_SMS" />
<uses-permission android:name="android.permission.SEND_SMS" />
<uses-permission android:name="android.permission.READ_CALL_LOG" />
<uses-permission android:name="android.permission.READ_CONTACTS" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.RECORD_AUDIO" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.FLASHLIGHT" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
```

### 4. Firebase Configuration

Download `google-services.json` from Firebase Console and place in `app/` directory.

## Core Implementation

### 1. Main Activity (MainActivity.java)

```java
package com.yourpackage.androidcontrol;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.google.firebase.FirebaseApp;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;

public class MainActivity extends AppCompatActivity {
    private static final int PERMISSION_REQUEST_CODE = 100;
    private FirebaseAuth auth;
    private DatabaseReference database;
    private String deviceId;
    private CommandListener commandListener;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);
        
        // Initialize Firebase
        FirebaseApp.initializeApp(this);
        auth = FirebaseAuth.getInstance();
        database = FirebaseDatabase.getInstance().getReference();
        
        // Generate unique device ID
        deviceId = android.provider.Settings.Secure.getString(
            getContentResolver(), 
            android.provider.Settings.Secure.ANDROID_ID
        );
        
        // Request permissions
        requestPermissions();
        
        // Start command listener service
        startCommandListener();
    }

    private void requestPermissions() {
        String[] permissions = {
            Manifest.permission.READ_SMS,
            Manifest.permission.SEND_SMS,
            Manifest.permission.READ_CALL_LOG,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.CAMERA,
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.WRITE_EXTERNAL_STORAGE
        };
        
        ActivityCompat.requestPermissions(this, permissions, PERMISSION_REQUEST_CODE);
    }

    private void startCommandListener() {
        Intent serviceIntent = new Intent(this, CommandListenerService.class);
        serviceIntent.putExtra("deviceId", deviceId);
        startForegroundService(serviceIntent);
    }
}
```

### 2. Command Listener Service (CommandListenerService.java)

```java
package com.yourpackage.androidcontrol;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import com.google.firebase.database.*;

public class CommandListenerService extends Service {
    private static final String CHANNEL_ID = "AndroidControlChannel";
    private DatabaseReference commandsRef;
    private String deviceId;
    private CommandExecutor commandExecutor;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        commandExecutor = new CommandExecutor(this);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        deviceId = intent.getStringExtra("deviceId");
        
        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Android Control Active")
            .setContentText("Listening for commands...")
            .setSmallIcon(R.drawable.ic_notification)
            .build();
            
        startForeground(1, notification);
        
        // Listen for commands
        listenForCommands();
        
        return START_STICKY;
    }

    private void listenForCommands() {
        // Note: In production, you'd authenticate first
        commandsRef = FirebaseDatabase.getInstance()
            .getReference("devices")
            .child(deviceId)
            .child("commands");
            
        commandsRef.addChildEventListener(new ChildEventListener() {
            @Override
            public void onChildAdded(DataSnapshot snapshot, String previousChildName) {
                Command command = snapshot.getValue(Command.class);
                if (command != null && "pending".equals(command.status)) {
                    executeCommand(command, snapshot.getKey());
                }
            }
            
            @Override
            public void onChildChanged(DataSnapshot snapshot, String previousChildName) {}
            
            @Override
            public void onChildRemoved(DataSnapshot snapshot) {}
            
            @Override
            public void onChildMoved(DataSnapshot snapshot, String previousChildName) {}
            
            @Override
            public void onCancelled(DatabaseError error) {}
        });
    }

    private void executeCommand(Command command, String commandId) {
        commandExecutor.execute(command, commandId);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Android Control",
                NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(channel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
```

### 3. Command Data Model (Command.java)

```java
package com.yourpackage.androidcontrol;

import java.util.Map;

public class Command {
    public String command;
    public Map<String, Object> params;
    public long timestamp;
    public String status;
    public String userId;

    public Command() {}

    public Command(String command, Map<String, Object> params, long timestamp, String status) {
        this.command = command;
        this.params = params;
        this.timestamp = timestamp;
        this.status = status;
    }
}
```

### 4. Command Executor (CommandExecutor.java)

```java
package com.yourpackage.androidcontrol;

import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.camera2.CameraManager;
import android.location.Location;
import android.location.LocationManager;
import android.media.MediaRecorder;
import android.net.Uri;
import android.os.Vibrator;
import android.speech.tts.TextToSpeech;
import android.telephony.SmsManager;
import com.google.firebase.database.DatabaseReference;
import com.google.firebase.database.FirebaseDatabase;
import java.util.HashMap;
import java.util.Map;

public class CommandExecutor {
    private Context context;
    private DatabaseReference database;
    private String deviceId;
    private TextToSpeech tts;
    private CameraManager cameraManager;
    private String cameraId;

    public CommandExecutor(Context context) {
        this.context = context;
        this.database = FirebaseDatabase.getInstance().getReference();
        this.deviceId = android.provider.Settings.Secure.getString(
            context.getContentResolver(),
            android.provider.Settings.Secure.ANDROID_ID
        );
        
        initializeTTS();
        initializeCamera();
    }

    public void execute(Command command, String commandId) {
        try {
            Object result = null;
            
            switch (command.command) {
                case "vibrate":
                    result = executeVibrate(command.params);
                    break;
                case "tts":
                    result = executeTTS(command.params);
                    break;
                case "get_info":
                    result = getDeviceInfo();
                    break;
                case "get_location":
                    result = getLocation();
                    break;
                case "flash_on":
                    result = setFlashlight(true);
                    break;
                case "flash_off":
                    result = setFlashlight(false);
                    break;
                case "send_sms":
                    result = sendSMS(command.params);
                    break;
                case "open_url":
                    result = openURL(command.params);
                    break;
                // Add more commands...
                default:
                    throw new UnsupportedOperationException("Command not supported: " + command.command);
            }
            
            sendResult(commandId, command.command, result, "success", null);
            
        } catch (Exception e) {
            sendResult(commandId, command.command, null, "error", e.getMessage());
        }
    }

    private Object executeVibrate(Map<String, Object> params) {
        Vibrator vibrator = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
        long duration = params.containsKey("duration") ? 
            ((Number) params.get("duration")).longValue() : 1000;
        vibrator.vibrate(duration);
        return "Vibrated for " + duration + "ms";
    }

    private Object executeTTS(Map<String, Object> params) {
        String text = (String) params.get("text");
        if (tts != null && text != null) {
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, null);
            return "Speaking: " + text;
        }
        return "TTS not available";
    }

    private Object getDeviceInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("model", android.os.Build.MODEL);
        info.put("version", android.os.Build.VERSION.RELEASE);
        info.put("manufacturer", android.os.Build.MANUFACTURER);
        info.put("device", android.os.Build.DEVICE);
        return info;
    }

    private Object getLocation() {
        // Implement location retrieval
        // Note: This is simplified - you'd need proper location permissions and GPS handling
        Map<String, Object> location = new HashMap<>();
        location.put("latitude", "0.0");
        location.put("longitude", "0.0");
        location.put("address", "Location not available");
        return location;
    }

    private Object setFlashlight(boolean on) {
        try {
            if (cameraId != null) {
                cameraManager.setTorchMode(cameraId, on);
                return "Flashlight " + (on ? "on" : "off");
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to control flashlight: " + e.getMessage());
        }
        return "Flashlight not available";
    }

    private Object sendSMS(Map<String, Object> params) {
        String number = (String) params.get("number");
        String message = (String) params.get("message");
        
        SmsManager smsManager = SmsManager.getDefault();
        smsManager.sendTextMessage(number, null, message, null, null);
        return "SMS sent to " + number;
    }

    private Object openURL(Map<String, Object> params) {
        String url = (String) params.get("url");
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        return "Opened URL: " + url;
    }

    private void initializeTTS() {
        tts = new TextToSpeech(context, status -> {
            // TTS initialization complete
        });
    }

    private void initializeCamera() {
        cameraManager = (CameraManager) context.getSystemService(Context.CAMERA_SERVICE);
        try {
            String[] cameraIds = cameraManager.getCameraIdList();
            if (cameraIds.length > 0) {
                cameraId = cameraIds[0];
            }
        } catch (Exception e) {
            // Camera not available
        }
    }

    private void sendResult(String commandId, String command, Object data, String status, String error) {
        Map<String, Object> result = new HashMap<>();
        result.put("commandId", commandId);
        result.put("command", command);
        result.put("data", data);
        result.put("status", status);
        result.put("error", error);
        result.put("timestamp", System.currentTimeMillis());

        database.child("devices")
               .child(deviceId)
               .child("results")
               .push()
               .setValue(result);
    }
}
```

### 5. Layout (activity_main.xml)

```xml
<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="16dp">

    <TextView
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Android Control Client"
        android:textSize="24sp"
        android:textStyle="bold"
        android:gravity="center"
        android:layout_marginBottom="20dp"/>

    <TextView
        android:id="@+id/statusText"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Status: Starting..."
        android:textSize="16sp"
        android:layout_marginBottom="10dp"/>

    <TextView
        android:id="@+id/deviceIdText"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Device ID: Loading..."
        android:textSize="14sp"
        android:layout_marginBottom="20dp"/>

    <Button
        android:id="@+id/startServiceBtn"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Start Service"
        android:layout_marginBottom="10dp"/>

    <Button
        android:id="@+id/stopServiceBtn"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:text="Stop Service"/>

</LinearLayout>
```

## Security Considerations

### 1. Authentication
- Always authenticate users before processing commands
- Use Firebase Auth tokens for verification
- Implement device registration with user approval

### 2. Command Validation
- Validate all incoming commands
- Implement command whitelisting
- Check user permissions for sensitive operations

### 3. Data Protection
- Encrypt sensitive data before transmission
- Use HTTPS for all communications
- Implement proper session management

## Testing

### 1. Test Commands
Start with basic commands to verify connectivity:
- `vibrate`
- `get_info`
- `tts` with simple text

### 2. Debugging
- Check Firebase Console for real-time data
- Use Android Studio's Logcat for debugging
- Monitor network connectivity

### 3. Permission Testing
- Test on different Android versions
- Verify all required permissions are granted
- Handle permission denials gracefully

## Deployment

### 1. Release Build
- Generate signed APK
- Test on multiple devices
- Verify Firebase connectivity in production

### 2. Distribution
- Use Firebase App Distribution for testing
- Consider Play Store for wider distribution
- Implement update mechanisms

## Troubleshooting

### Common Issues:
1. **Firebase Connection Failed**: Check internet connectivity and Firebase config
2. **Permissions Denied**: Ensure all required permissions are granted
3. **Commands Not Received**: Verify device ID matches in Firebase
4. **Service Stops**: Check battery optimization settings

### Logs Location:
- Android Studio Logcat
- Firebase Console > Database
- Device system logs via ADB

## Legal Compliance

- Obtain proper user consent for monitoring
- Comply with local privacy laws
- Implement data retention policies
- Provide clear privacy documentation

---

**Note**: This is a basic implementation. For production use, implement proper error handling, security measures, and user consent mechanisms.
