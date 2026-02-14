import React, { useState, useEffect, useCallback, useRef } from 'react';
import ToggleSwitch from './ToggleSwitch';
import BluetoothPanel, { sendBluetooth } from './BluetoothPanel';
import NotificationBar from './NotificationBar';
import './App.css';

// API_URL configuration for different environments
let API_URL = window.location.hostname === 'localhost' 
  ? 'http://localhost:5000/api'
  : `${window.location.origin}/api`;
  
// For local network, detect if backend is on same network and use local IP
if (window.location.hostname !== 'localhost' && !window.location.hostname.includes('vercel')) {
  // Local network access - try to use the same hostname
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  API_URL = `${protocol}//${hostname}:5000/api`;
}

// For manual override, uncomment and update:
// const API_URL = 'http://192.168.254.103:5000/api';
// For mobile testing via ngrok, use:
// const API_URL = 'https://YOUR-BACKEND-NGROK-URL.ngrok-free.app/api';

function askNotificationPermission() {
  if (!('Notification' in window)) {
    console.log('Notifications not supported');
    return { supported: false };
  }

  return Notification.requestPermission().then(permission => {
    console.log('Notification permission:', permission);
    if (permission === 'granted') {
      new Notification('✅ Enabled!', {
        body: 'Notifications are now allowed 🎉'
      });
      return { supported: true, enabled: true };
    } else {
      return { supported: true, enabled: false, reason: 'Permission denied' };
    }
  }).catch(err => {
    console.error('Permission request error:', err);
    return { supported: true, enabled: false, reason: err.message };
  });
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
    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered:', registration);
        })
        .catch(err => {
          console.error('Service Worker registration failed:', err);
        });
    }

    // Fetch initial state
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
    showBar('Requesting notification permission...');
    const result = await askNotificationPermission();
    setPushStatus(result);
    if (!result.enabled) {
      showBar('Failed: ' + (result.reason || 'Unknown error'));
    }
  };

  const sendNotification = useCallback((title, body) => {
    if (!('Notification' in window)) {
      console.log('Notifications not supported');
      return;
    }
    
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: "https://upload.wikimedia.org/wikipedia/commons/a/a7/React-icon.svg"
      });
    }
  }, []);

  const handleBluetoothMessage = useCallback(async (message) => {
    console.log('Received from HM-10:', message);
    if (message === 'ON') {
      setStatusOn(true);
      lastStateRef.current = { ...lastStateRef.current, status: true };
      showBar('Status Active (from device)');
      sendNotification('Status Update', 'Power source is connected, socket is now turned on');
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
      sendNotification('Status Update', 'Power source is disconnected, socket is now turned off');
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
          const newStatus = data.status ? 'Power source is connected, socket is now turned on' : 'Power source is disconnected, socket is now turned off';
          sendNotification('Status Changed', newStatus);
        }
        
        if (data.function !== lastStateRef.current.function) {
          setFunctionActive(data.function);
          const newFunction = data.function ? 'Active' : 'Inactive';
          sendNotification('Function Changed', `Function is now ${newFunction}`);
        }
        
        lastStateRef.current = { status: data.status, function: data.function };
      } catch (err) {
        console.error('Poll error:', err);
      }
    }, 500);

    return () => clearInterval(pollInterval);
  }, [sendNotification]);

  const handleToggle = async (name, setter, currentValue) => {
    const newValue = !currentValue;
    setter(newValue);
    
    const command = newValue ? 'ON' : 'OFF';
    const label = name === 'status' ? 'Status' : 'Function';
    
    lastStateRef.current = { ...lastStateRef.current, [name]: newValue };
    
    sendBluetooth(`${name.toUpperCase()}_${command}`);
    showBar(`${label}: Turned ${command}`);
    
    const notification = name === 'status' 
      ? (newValue ? 'Power source is connected, socket is now turned on' : 'Power source is disconnected, socket is now turned off')
      : `${label} is now ${command}`;
    sendNotification(`${label} Updated`, notification);
    
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
