// server/device-manager.js
const { ArtNetProtocol } = require('./artnet-protocol');

class DeviceManager {
  constructor() {
    this.artnet = new ArtNetProtocol();
    this.pollInterval = null;
    this.cleanupInterval = null;
    this.listeners = new Set();
  }

  async start() {
    this.artnet.on('error', (err) => {
      console.error('Art-Net error:', err);
    });

    await this.artnet.start();

    this.artnet.on('device', (device) => {
      this.broadcast('device', device);
    });

    this.artnet.on('ipProgReply', (reply) => {
      this.broadcast('ipProgReply', reply);
    });

    // Periodisch nach Geräten suchen
    this.startPolling(3000);

    // Alte Geräte entfernen
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, device] of this.artnet.devices) {
        if (now - device.lastSeen > 15000) {
          this.artnet.devices.delete(key);
          this.broadcast('deviceRemoved', { ip: device.ip, mac: device.mac });
        }
      }
    }, 5000);
  }

  startPolling(interval = 3000) {
    this.artnet.sendPoll();
    this.pollInterval = setInterval(() => {
      this.artnet.sendPoll();
    }, interval);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  addListener(callback) {
    this.listeners.add(callback);
  }

  removeListener(callback) {
    this.listeners.delete(callback);
  }

  broadcast(event, data) {
    for (const listener of this.listeners) {
      listener(event, data);
    }
  }

  getDevices() {
    return this.artnet.getDevices();
  }

  configureDevice(deviceIp, config) {
    this.artnet.sendAddress(deviceIp, config);
    // Nach kurzer Verzögerung Poll senden um aktualisierte Daten zu erhalten
    setTimeout(() => this.artnet.sendPoll(deviceIp), 100);
  }

  configureIp(deviceIp, config) {
    this.artnet.sendIpProg(deviceIp, config);
    setTimeout(() => this.artnet.sendPoll(), 500);
  }

  sendDmx(universe, data, subnet = 0, net = 0) {
    this.artnet.sendDmx(universe, data, subnet, net);
  }

  sendCommand(deviceIp, command) {
    this.artnet.sendCommand(deviceIp, command);
  }

  refreshDevice(deviceIp) {
    this.artnet.sendPoll(deviceIp);
  }

  refreshAll() {
    this.artnet.sendPoll();
  }

  close() {
    this.stopPolling();
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    this.artnet.close();
  }
}

module.exports = DeviceManager;
