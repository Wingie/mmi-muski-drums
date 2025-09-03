// MMI-Muski-Drums Enhanced Server
// Express + Socket.io + OSC bridge server
// Based on working Drum-E server architecture

const osc = require('node-osc');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { exec } = require('child_process');

// Server configuration
const WEB_PORT = 8080;
const OSC_OUT_PORT = 4560;  // TO Sonic Pi (where sonic-pi-receiver.rb receives commands)
const OSC_IN_PORT = 12004;  // FROM Sonic Pi (where sonic-pi-receiver.rb sends feedback)

console.log('🎵 Starting MMI-Muski-Drums Enhanced Server...');

// Create Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Main route - serves the MMI interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// OSC setup
let oscServer, oscClient;
let isOSCConnected = false;

// Socket.IO connection handling (copied from working Drum-E)
io.on('connection', (socket) => {
  console.log('🔌 MMI browser connected');
  
  // Initialize OSC connection (like Drum-E)
  if (!isOSCConnected) {
    try {
      // Listen for feedback FROM Sonic Pi on port 12004
      oscServer = new osc.Server(OSC_IN_PORT, '127.0.0.1');
      // Send commands TO Sonic Pi on port 4560 
      oscClient = new osc.Client('127.0.0.1', OSC_OUT_PORT);
      
      oscServer.on('message', (msg, rinfo) => {
        socket.emit('message', msg);
        
        if (msg[0] === '/druminfo') {
          // Beat position feedback - don't spam console
        } else {
          console.log('📡 OSC received:', msg[0]);
        }
      });
      
      oscClient.send('/status', 'MMI connected');
      isOSCConnected = true;
      
      console.log('🎛️  OSC bridge active:');
      console.log(`   Outgoing to Sonic Pi: port ${OSC_OUT_PORT}`);
      console.log(`   Incoming from Sonic Pi: port ${OSC_IN_PORT}`);
      
    } catch (error) {
      console.error('❌ OSC setup error:', error.message);
    }
  }
  
  // Handle messages from browser to Sonic Pi (like Drum-E)
  socket.on('message', (msg) => {
    if (oscClient && isOSCConnected) {
      oscClient.send.apply(oscClient, msg);
      
      // Log pattern messages for debugging
      if (msg[0].includes('/wek')) {
        console.log('🎵 Pattern sent:', msg[0], `(${msg[1]?.length || 0} hits)`);
      }
    }
  });
  
  // Handle client configuration (compatibility with original GUI)
  socket.on('config', (config) => {
    console.log('⚙️  MMI client config received');
    socket.emit('connected', 1);
  });
  
  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('🔌 MMI browser disconnected');
  });
});

// Start server
server.listen(WEB_PORT, () => {
  console.log(`✅ MMI-Muski-Drums server running on http://localhost:${WEB_PORT}`);
  console.log('📋 Server features:');
  console.log('   • Express web server serving dist/ files');
  console.log('   • Socket.io WebSocket server ready');
  console.log(`   • OSC bridge: ${OSC_OUT_PORT} → Sonic Pi → ${OSC_IN_PORT}`);
  
  // Auto-open browser (like Drum-E)
  console.log('🌐 Auto-opening browser...');
  
  const platform = process.platform;
  let command;
  
  if (platform === 'darwin') {
    command = `open http://localhost:${WEB_PORT}`;
  } else if (platform === 'win32') {
    command = `start http://localhost:${WEB_PORT}`;
  } else {
    command = `xdg-open http://localhost:${WEB_PORT}`;
  }
  
  setTimeout(() => {
    exec(command, (error) => {
      if (error) {
        console.log('❌ Could not auto-open browser. Please visit: http://localhost:' + WEB_PORT);
      } else {
        console.log('✅ Browser opened automatically');
      }
    });
  }, 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MMI-Muski-Drums server...');
  
  if (isOSCConnected && oscServer) {
    try {
      oscServer.kill();
      oscClient.kill();
      console.log('✅ OSC bridge shut down');
    } catch (error) {
      console.log('OSC cleanup error:', error.message);
    }
  }
  
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
});

console.log('🥁 MMI-Muski-Drums Server Starting...');
console.log('========================');
console.log(`Web interface: http://localhost:${WEB_PORT}`);
console.log(`OSC Bridge: ${OSC_OUT_PORT} → Sonic Pi → ${OSC_IN_PORT}`);
console.log('========================');
console.log('Ready for connections!');