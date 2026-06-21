// server/index.js
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');
const DeviceManager = require('./device-manager');

function createAppServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const deviceManager = new DeviceManager();

  // Static files
  app.use(express.static(path.join(__dirname, '../public')));
  app.use(express.json());

  // WebSocket handling
  wss.on('connection', (ws) => {
    console.log('Client connected');

    // Aktuelle Geräteliste senden
    const devices = deviceManager.getDevices();
    ws.send(JSON.stringify({ type: 'deviceList', data: devices }));

    // Listener für neue Geräte
    const listener = (event, data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({ type: event, data }));
      }
    };
    deviceManager.addListener(listener);

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message);
        handleMessage(deviceManager, msg);
      } catch (err) {
        console.error('Invalid message:', err);
      }
    });

    ws.on('close', () => {
      deviceManager.removeListener(listener);
      console.log('Client disconnected');
    });
  });

  return { app, server, wss, deviceManager };
}

function handleMessage(deviceManager, msg) {
  switch (msg.type) {
    case 'refresh':
      deviceManager.refreshAll();
      break;

    case 'refreshDevice':
      deviceManager.refreshDevice(msg.ip);
      break;

    case 'configure':
      deviceManager.configureDevice(msg.ip, msg.config);
      break;

    case 'configureIp':
      deviceManager.configureIp(msg.ip, msg.config);
      break;

    case 'sendDmx':
      deviceManager.sendDmx(msg.universe, msg.data, msg.subnet, msg.net);
      break;

    case 'sendCommand':
      deviceManager.sendCommand(msg.ip, msg.command);
      break;

    case 'identify':
      // LED Locate aktivieren
      deviceManager.configureDevice(msg.ip, { ledLocate: true });
      // Nach 3 Sekunden wieder normal
      setTimeout(() => {
        deviceManager.configureDevice(msg.ip, { ledNormal: true });
      }, 3000);
      break;

    default:
      console.log('Unknown message type:', msg.type);
  }
}

async function startServer(options = {}) {
  const port = options.port ?? process.env.PORT ?? 3000;
  const host = options.host;
  const appServer = createAppServer();
  const { server, deviceManager } = appServer;

  await deviceManager.start();

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolve();
    });
  });

  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  return {
    ...appServer,
    port: actualPort,
    url: `http://localhost:${actualPort}`,
    close() {
      deviceManager.close();
      wssClose(appServer.wss);
      server.close();
    }
  };
}

function wssClose(wss) {
  for (const client of wss.clients) {
    client.close();
  }
  wss.close();
}

if (require.main === module) {
  startServer()
    .then(({ url, close }) => {
      console.log(`Art-Net Config running on ${url}`);

      process.on('SIGINT', () => {
        console.log('\nShutting down...');
        close();
        process.exit(0);
      });
    })
    .catch((err) => {
      console.error('Failed to start Art-Net Config:', err);
      process.exit(1);
    });
}

module.exports = { createAppServer, startServer };
