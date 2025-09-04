// MMI OSC Client
// Based on working Drum-E architecture for seamless integration with sonic-pi-receiver.rb

export default class OSCClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.connectionCallbacks = [];
    this.messageCallbacks = [];
    this.init();
  }
  
  init() {
    console.log('🔌 Initializing MMI OSC connection...');
    
    // Connect to our server's Socket.IO
    this.socket = io();
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to MMI server');
      this.isConnected = true;
      
      // Notify all connection callbacks
      this.connectionCallbacks.forEach(callback => callback(true));
      
      // Send initial configuration like Drum-E (compatibility with original bridge)
      this.socket.emit('config', {
        server: { port: 12004, host: '127.0.0.1' },
        client: { port: 4560, host: '127.0.0.1' }
      });
      
      // Initialize OSC sequence after connection
      setTimeout(() => {
        this.initializeOSCSequence();
      }, 100);
    });
    
    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from MMI server');
      this.isConnected = false;
      
      // Notify all connection callbacks
      this.connectionCallbacks.forEach(callback => callback(false));
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('💥 Connection error:', error);
    });
    
    // Handle incoming OSC messages from Sonic Pi (beat feedback)
    this.socket.on('message', (msg) => {
      // Sonic Pi sends messages like ["/druminfo", step, type]
      this.receiveOsc(msg[0], msg.slice(1));
      
      // Notify message callbacks
      this.messageCallbacks.forEach(callback => callback(msg));
    });
    
    this.socket.on('connected', (data) => {
      console.log('🎵 OSC bridge confirmed connection');
    });
  }
  
  // Send OSC message to Sonic Pi
  sendOSC(address, ...args) {
    if (!this.isConnected) {
      console.warn('⚠️ Cannot send OSC - not connected to server');
      return false;
    }
    
    const message = [address, ...args];
    this.socket.emit('message', message);
    
    // Log important messages
    if (address.includes('/wek')) {
      console.log('🎵 Sent to Sonic Pi:', address, args.length > 0 ? `(${args.length} items)` : '');
    }
    
    return true;
  }
  
  // Initialize OSC sequence for Sonic Pi startup (like Drum-E)
  initializeOSCSequence() {
    console.log('🔄 Initializing OSC sequence for Sonic Pi startup...');
    
    // Step 1: Send kit selection first (required for :playDrumPatterns sync)
    this.sendOSC('/wek6/outputs', 0);
    console.log('🥁 Sent kit selection (kit 0)');
    
    // Step 2: Initialize with empty original pattern (MMI is primary generator)
    this.sendPattern([], [], false);  // Original pattern (empty)
    this.setPlayMode(1);  // Play original only (MMI patterns as original)
    
    console.log('🎵 MMI initialized as original pattern source');
  }
  
  // Send pattern data - now supports dual patterns with filler flag
  sendPattern(notes, steps, isFillerPattern = false) {

    if (isFillerPattern) {
      // Send filler pattern to /wek3/outputs and /wek4/outputs
      console.log('📤 Sending filler pattern:', { notes, steps });
      this.sendOSC('/wek3/outputs', notes);
      this.sendOSC('/wek4/outputs', steps);
    } else {
      // Send original pattern to /wek/outputs and /wek2/outputs (existing behavior)
      console.log('📤 Sending original pattern:', { notes, steps });
      this.sendOSC('/wek/outputs', notes);
      this.sendOSC('/wek2/outputs', steps);
    }
  }
  
  // Set play mode (1 = original only, perfect for MMI as primary generator)
  setPlayMode(mode) {
    this.sendOSC('/wek5/outputs', mode);
  }
  
  // Set drum kit (0-5, matches original GUI)
  setKit(kitIndex) {
    console.log('🥁 Setting drum kit:', kitIndex);
    this.sendOSC('/wek6/outputs', kitIndex);
  }
  
  // OSC message handler (for beat feedback from Sonic Pi)
  receiveOsc(address, value) {
    if (address === '/druminfo') {
      let step = value[0];  // step position (0-15)
      let patternType = value[1];  // 0=original, 1=generated
      
      // console.log(`🎯 Beat feedback: step=${step}, type=${patternType}`);
      
      // Trigger visual updates for MMI
      this.messageCallbacks.forEach(callback => callback({
        type: 'beat',
        step: step,
        patternType: patternType,
        address: address,
        value: value
      }));
    } else {
      console.log("📡 Received OSC: " + address + ", " + value);
    }
  }
  
  // Callback registration
  onConnect(callback) {
    this.connectionCallbacks.push(callback);
    
    // If already connected, call immediately
    if (this.isConnected) {
      callback(true);
    }
  }
  
  onMessage(callback) {
    this.messageCallbacks.push(callback);
  }
  
  // Utility methods
  isReady() {
    return this.isConnected;
  }
  
  getConnectionStatus() {
    return {
      connected: this.isConnected,
      socket: this.socket ? this.socket.connected : false
    };
  }
}

// Note: This will be imported by app.js, no global instance needed like Drum-E