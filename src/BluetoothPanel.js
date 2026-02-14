import React, { useState } from 'react';
import './BluetoothPanel.css';

let bluetoothDevice = null;
let txCharacteristic = null;
let rxCharacteristic = null;

const isBluetoothSupported = () => {
  return 'bluetooth' in navigator;
};

function BluetoothPanel({ onMessageReceived }) {
  const [connected, setConnected] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [supported] = useState(isBluetoothSupported());


  const handleConnect = async () => {
    if (!isBluetoothSupported()) return;
    
    setLoading(true);
    setError('');
    
    try {
      // HM-10 BLE UART Service UUID
      const serviceUUID = '0000ffe0-0000-1000-8000-00805f9b34fb';
      const charUUID = '0000ffe1-0000-1000-8000-00805f9b34fb';
      
      bluetoothDevice = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [serviceUUID]
      });

      const server = await bluetoothDevice.gatt.connect();
      const service = await server.getPrimaryService(serviceUUID);
      
      // Get characteristic for both read/write
      txCharacteristic = await service.getCharacteristic(charUUID);
      rxCharacteristic = txCharacteristic;
      
      // Start notifications to receive data
      await rxCharacteristic.startNotifications();
      rxCharacteristic.addEventListener('characteristicvaluechanged', handleDataReceived);
      
      setConnected(true);
      setDeviceName(bluetoothDevice.name || 'HM-10');
      
      bluetoothDevice.addEventListener('gattserverdisconnected', () => {
        setConnected(false);
        setDeviceName('');
        txCharacteristic = null;
        rxCharacteristic = null;
      });
      
    } catch (err) {
      console.error('Bluetooth error:', err);
      setError(err.message || 'Connection failed');
    }
    setLoading(false);
  };

  const handleDataReceived = (event) => {
    const value = event.target.value;
    const decoder = new TextDecoder();
    let message = decoder.decode(value);
    
    // Remove any extra characters (carriage return, newline, spaces, etc.)
    message = message.replace(/[\r\n\s]/g, '').toUpperCase();
    
    console.log('Received from HM-10:', message);
    
    // Check for ON/OFF messages and notify parent
    if (message.includes('ON')) {
      if (onMessageReceived) {
        onMessageReceived('ON');
      }
    } else if (message.includes('OFF')) {
      if (onMessageReceived) {
        onMessageReceived('OFF');
      }
    }
  };

  const handleDisconnect = () => {
    if (rxCharacteristic) {
      rxCharacteristic.removeEventListener('characteristicvaluechanged', handleDataReceived);
    }
    if (bluetoothDevice && bluetoothDevice.gatt.connected) {
      bluetoothDevice.gatt.disconnect();
    }
    setConnected(false);
    setDeviceName('');
    txCharacteristic = null;
    rxCharacteristic = null;
  };

  if (!supported) {
    return (
      <div className="bluetooth-panel">
        <div className="status-indicator">
          Bluetooth not supported on this device/browser
        </div>
      </div>
    );
  }

  return (
    <div className="bluetooth-panel">
      <div className={`status-indicator ${connected ? 'connected' : ''} ${loading ? 'loading' : ''}`}>
        {loading ? 'Connecting...' : connected ? `Connected: ${deviceName}` : 'Disconnected'}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="controls">
        {connected ? (
          <button onClick={handleDisconnect} disabled={loading} className="disconnect">
            Disconnect
          </button>
        ) : (
          <button onClick={handleConnect} disabled={loading} className="connect">
            {loading ? 'Connecting...' : 'Connect Bluetooth'}
          </button>
        )}
      </div>
    </div>
  );
}

export const sendBluetooth = async (message) => {
  if (txCharacteristic) {
    try {
      const encoder = new TextEncoder();
      await txCharacteristic.writeValue(encoder.encode(message + '\n'));
      return true;
    } catch (err) {
      console.error('Send error:', err);
    }
  }
  return false;
};

export default BluetoothPanel;
