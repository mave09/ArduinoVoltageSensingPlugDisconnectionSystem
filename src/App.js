import React, { useState, useEffect, useCallback, useRef } from 'react';
import ToggleSwitch from './ToggleSwitch';
import BluetoothPanel, { sendBluetooth } from './BluetoothPanel';
import NotificationBar from './NotificationBar';
import './App.css';

// Update this with your ngrok backend URL when testing on mobile
const API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api'
  : 'http://192.168.254.103:5000/api';
  
// For mobile testing via ngrok, uncomment and update:
// const API_URL = 'https://YOUR-BACKEND-NGROK-URL.ngrok-free.app/api';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function setupPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported');
    return { supported: false };
  }

  try {
    // Register SW
    console.log('Registering service worker...');
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('SW registered:', registration);

    // Wait for SW to be ready
    await navigator.serviceWorker.ready;
    console.log('SW ready');

    // Request permission
    console.log('Requesting notification permission...');
    const permission = await Notification.requestPermission();
    console.log('Permission:', permission);
    
    if (permission !== 'granted') {
      return { supported: true, enabled: false, reason: 'Permission denied' };
    }

    // Get VAPID key
    console.log('Getting VAPID key...');
    const res = await fetch(`${API_URL}/vapid-public-key`);
    const { publicKey } = await res.json();
    console.log('VAPID key received');

    // Subscribe
    console.log('Subscribing to push...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });
    console.log('Subscription:', subscription);

    // Send to server
    console.log('Sending subscription to server...');
    await fetch(`${API_URL}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON())
    });
    console.log('Subscription sent to server');

    return { supported: true, enabled: true };
  } catch (err) {
    console.error('Push setup error:', err);
    return { supported: true, enabled: false, reason: err.message };
  }
}

function App() {
  const [statusOn, setStatusOn] = useState(false);
  const [functionActive, setFunctionActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [barMessage, setBarMessage] = useState('');
  const [barVisible, setBarVisible] = useState(false);
  const [pushStatus, setPushStatus] = useState({ supported: true, enabled: false });
  const lastStateRef = useRef({ status: false, function: true });

  useEffect(() => {
    fetch(`${API_URL}/state`)
      .then(res => res.json())
      .then(data => {
        setStatusOn(data.status);
        setFunctionActive(data.function);
        lastStateRef.current = { status: data.status, function: data.function };
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch state:', err);
        setLoading(false);
      });
  }, []);

  const showBar = useCallback((message) => {
    setBarMessage(message);
    setBarVisible(true);
  }, []);

  const handleEnablePush = async () => {
    showBar('Setting up notifications...');
    
    // Request notification permission first
    if ('Notification' in window && Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      console.log('Notification permission:', permission);
    }
    
    const result = await setupPushNotifications();
    setPushStatus(result);
    if (result.enabled) {
      showBar('Push notifications enabled!');
    } else {
      showBar('Failed: ' + (result.reason || 'Unknown error'));
    }
  };

  const sendNotification = useCallback(async (title, body) => {
    console.log('sendNotification called:', title, body);
    console.log('Notification in window:', 'Notification' in window);
    console.log('Notification.permission:', Notification.permission);
    
    try {
      if (!('Notification' in window)) {
        console.log('Notifications not supported');
        return;
      }
      
      if (Notification.permission === "granted") {
        // Try service worker notification first (works better in modern browsers)
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body: body,
            icon: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg"
          });
          console.log('Service worker notification sent');
        } else {
          // Fallback to regular notification
          new Notification(title, {
            body: body,
            icon: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg"
          });
          console.log('Regular notification sent');
        }
      } else {
        console.log('Notification permission not granted');
      }
    } catch (err) {
      console.error('Notification error:', err);
    }
  }, []);

  const handleBluetoothMessage = useCallback(async (message) => {
    console.log('Received from HM-10:', message);
    if (message === 'ON') {
      setStatusOn(true);
      lastStateRef.current = { ...lastStateRef.current, status: true };
      showBar('Status Active (from device)');
      sendNotification('Status Update', 'Status is now Active');
      // Update backend
      try {
        await fetch(`${API_URL}/set/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: true })
        });
      } catch (err) {
        console.error('Backend sync failed:', err);
      }
    } else if (message === 'OFF') {
      setStatusOn(false);
      lastStateRef.current = { ...lastStateRef.current, status: false };
      showBar('Status Inactive (from device)');
      sendNotification('Status Update', 'Status is now Inactive');
      // Update backend
      try {
        await fetch(`${API_URL}/set/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: false })
        });
      } catch (err) {
        console.error('Backend sync failed:', err);
      }
    }
  }, [showBar, sendNotification]);

  useEffect(() => {
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/state`);
        const data = await res.json();
        
        if (data.status !== lastStateRef.current.status) {
          setStatusOn(data.status);
        }
        
        lastStateRef.current = { status: data.status, function: data.function };
      } catch (err) {}
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [showBar]);

  const handleToggle = async (name, setter, currentValue) => {
    const newValue = !currentValue;
    setter(newValue);
    
    const command = newValue ? 'ON' : 'OFF';
    const label = name === 'status' ? 'Status' : 'Function';
    
    lastStateRef.current = { ...lastStateRef.current, [name]: newValue };
    
    sendBluetooth(`${name.toUpperCase()}_${command}`);
    showBar(`${label}: Turned ${command}`);
    
    try {
      await fetch(`${API_URL}/toggle/${name}`, { method: 'POST' });
    } catch (err) {
      console.error('Sync failed:', err);
    }
  };

  if (loading) return <div className="app">Loading...</div>;

  return (
    <div className="app">
      <NotificationBar 
        message={barMessage} 
        visible={barVisible} 
        onClose={() => setBarVisible(false)} 
      />
      
      <div className="content-box">
        <h1 className="app-title">Development of a Voltage sensing Arduino-based Automatic Device Plug Disconnection System</h1>
        
        <div className="notification-permission">
          {pushStatus.enabled ? (
            <span className="granted">✓ Push notifications enabled</span>
          ) : (
            <button onClick={handleEnablePush} className="permission-btn">
              Enable Push Notifications
            </button>
          )}
        </div>
        
        <BluetoothPanel onMessageReceived={handleBluetoothMessage} />
        <ToggleSwitch
          isOn={statusOn}
          onToggle={() => handleToggle('status', setStatusOn, statusOn)}
          icon="flag"
          label={statusOn ? 'On' : 'Off'}
        />
      </div>
      
      <div className="disclaimer">For capstone use only.</div>
    </div>
  );
}

export default App;
