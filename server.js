// MMI-Muski-Drums Enhanced Server
// Express + Socket.io server serving webpack dist files
// Based on Drum-E server architecture

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { exec } = require('child_process');

// Server configuration
const PORT = 8080;

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

// Socket.io connection handling (ready for future OSC bridge)
io.on('connection', (socket) => {
  console.log('🔌 Browser connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('🔌 Browser disconnected:', socket.id);
  });
  
  // Future OSC bridge messages will be handled here
  socket.on('mmi-pattern', (data) => {
    console.log('📡 Pattern data received:', data);
    // TODO: Forward to OSC bridge in Phase 4
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`✅ MMI-Muski-Drums server running on http://localhost:${PORT}`);
  console.log('📋 Server features:');
  console.log('   • Express web server serving dist/ files');
  console.log('   • Socket.io WebSocket server ready');
  console.log('   • OSC bridge ports prepared for Phase 4');
  
  // Auto-open browser (like Drum-E)
  console.log('🌐 Auto-opening browser...');
  
  const platform = process.platform;
  let command;
  
  if (platform === 'darwin') {
    command = `open http://localhost:${PORT}`;
  } else if (platform === 'win32') {
    command = `start http://localhost:${PORT}`;
  } else {
    command = `xdg-open http://localhost:${PORT}`;
  }
  
  setTimeout(() => {
    exec(command, (error) => {
      if (error) {
        console.log('❌ Could not auto-open browser. Please visit: http://localhost:' + PORT);
      } else {
        console.log('✅ Browser opened automatically');
      }
    });
  }, 1000);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down MMI-Muski-Drums server...');
  server.close(() => {
    console.log('✅ Server shut down gracefully');
    process.exit(0);
  });
});

console.log('✅ Server initialized and ready');