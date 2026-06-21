// server/artnet-protocol.js
const dgram = require('dgram');
const EventEmitter = require('events');

const ARTNET_PORT = 6454;
const ARTNET_HEADER = Buffer.from([0x41, 0x72, 0x74, 0x2d, 0x4e, 0x65, 0x74, 0x00]); // "Art-Net\0"

// Op-Codes
const OpCodes = {
  OpPoll: 0x2000,
  OpPollReply: 0x2100,
  OpDmx: 0x5000,
  OpAddress: 0x6000,
  OpIpProg: 0xf800,
  OpIpProgReply: 0xf900,
  OpTodRequest: 0x8000,
  OpTodData: 0x8100,
  OpTodControl: 0x8200,
  OpRdm: 0x8300,
  OpCommand: 0x2400
};

// Merge-Modi
const MergeModes = {
  HTP: 0,
  LTP: 1
};

// Port-Typen
const PortTypes = {
  DMX512: 0x00,
  MIDI: 0x01,
  Avab: 0x02,
  ColortranCMX: 0x03,
  ADB625: 0x04,
  ArtNet: 0x05
};

function parseIpv4Address(value) {
  if (typeof value !== 'string') return null;

  const parts = value.split('.');
  if (parts.length !== 4) return null;

  const bytes = parts.map((part) => Number(part));
  if (bytes.some((byte) => !Number.isInteger(byte) || byte < 0 || byte > 255)) {
    return null;
  }

  return bytes;
}

class ArtNetProtocol extends EventEmitter {
  constructor() {
    super();
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.devices = new Map();
    this.sequence = 0;
    this.localIp = this.getLocalIp();
    
    this.socket.on('message', (msg, rinfo) => this.handleMessage(msg, rinfo));
    this.socket.on('error', (err) => this.emit('error', err));
  }

  getLocalIp() {
    const os = require('os');
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '0.0.0.0';
  }

  async start() {
    return new Promise((resolve, reject) => {
      const onError = (err) => {
        this.socket.off('listening', onListening);
        reject(err);
      };

      const onListening = () => {
        this.socket.off('error', onError);
        this.socket.setBroadcast(true);
        console.log(`Art-Net listening on port ${ARTNET_PORT}`);
        resolve();
      };

      this.socket.once('error', onError);
      this.socket.once('listening', onListening);
      this.socket.bind(ARTNET_PORT, '0.0.0.0', () => {
        // Handled by the listening event above.
      });
    });
  }

  handleMessage(msg, rinfo) {
    if (msg.length < 10) return;
    if (!msg.subarray(0, 8).equals(ARTNET_HEADER)) return;

    const opCode = msg.readUInt16LE(8);

    switch (opCode) {
      case OpCodes.OpPollReply:
        this.handlePollReply(msg, rinfo);
        break;
      case OpCodes.OpIpProgReply:
        this.handleIpProgReply(msg, rinfo);
        break;
      default:
        this.emit('packet', { opCode, data: msg, from: rinfo });
    }
  }

  handlePollReply(msg, rinfo) {
    if (msg.length < 207) return;

    const device = {
      ip: `${msg[10]}.${msg[11]}.${msg[12]}.${msg[13]}`,
      port: msg.readUInt16LE(14),
      versionInfo: msg.readUInt16BE(16),
      netSwitch: msg[18],
      subSwitch: msg[19],
      oem: msg.readUInt16BE(20),
      ubeaVersion: msg[22],
      status1: msg[23],
      estaMan: msg.readUInt16LE(24),
      shortName: msg.subarray(26, 44).toString('utf8').replace(/\0/g, '').trim(),
      longName: msg.subarray(44, 108).toString('utf8').replace(/\0/g, '').trim(),
      nodeReport: msg.subarray(108, 172).toString('utf8').replace(/\0/g, '').trim(),
      numPorts: msg.readUInt16BE(172),
      portTypes: [msg[174], msg[175], msg[176], msg[177]],
      goodInput: [msg[178], msg[179], msg[180], msg[181]],
      goodOutput: [msg[182], msg[183], msg[184], msg[185]],
      swIn: [msg[186], msg[187], msg[188], msg[189]],
      swOut: [msg[190], msg[191], msg[192], msg[193]],
      swVideo: msg[194],
      swMacro: msg[195],
      swRemote: msg[196],
      style: msg[200],
      mac: Array.from(msg.subarray(201, 207)).map(b => b.toString(16).padStart(2, '0')).join(':'),
      bindIp: msg.length >= 211 ? `${msg[207]}.${msg[208]}.${msg[209]}.${msg[210]}` : null,
      bindIndex: msg.length >= 212 ? msg[211] : 0,
      status2: msg.length >= 213 ? msg[212] : 0,
      lastSeen: Date.now()
    };

    // Merge-Mode und weitere Status-Flags dekodieren
    device.mergeMode = [];
    device.outputEnabled = [];
    device.rdmEnabled = [];
    
    for (let i = 0; i < 4; i++) {
      device.mergeMode[i] = (device.goodOutput[i] & 0x02) ? 'LTP' : 'HTP';
      device.outputEnabled[i] = !(device.goodOutput[i] & 0x80);
      device.rdmEnabled[i] = !!(device.goodOutput[i] & 0x08);
    }

    // DHCP Status
    device.dhcpEnabled = !!(device.status2 & 0x04);
    device.dhcpCapable = !!(device.status2 & 0x02);
    device.webConfigurable = !!(device.status2 & 0x01);
    device.artNet4Capable = !!(device.status2 & 0x08);

    const key = device.mac || device.ip;
    this.devices.set(key, device);
    this.emit('device', device);
  }

  handleIpProgReply(msg, rinfo) {
    if (msg.length < 34) return;

    const reply = {
      progIp: `${msg[16]}.${msg[17]}.${msg[18]}.${msg[19]}`,
      progSubnet: `${msg[20]}.${msg[21]}.${msg[22]}.${msg[23]}`,
      progPort: msg.readUInt16BE(24),
      status: msg[26],
      progGateway: `${msg[28]}.${msg[29]}.${msg[30]}.${msg[31]}`,
      dhcpEnabled: !!(msg[14] & 0x40)
    };

    this.emit('ipProgReply', reply);
  }

  // ArtPoll senden - Geräte entdecken
  sendPoll(targetIp = '255.255.255.255') {
    const packet = Buffer.alloc(14);
    ARTNET_HEADER.copy(packet);
    packet.writeUInt16LE(OpCodes.OpPoll, 8);
    packet.writeUInt16BE(14, 10); // Protocol Version
    packet[12] = 0x02; // TalkToMe - Send ArtPollReply on change
    packet[13] = 0x00; // Priority

    this.socket.send(packet, ARTNET_PORT, targetIp);
  }

  // ArtAddress senden - Gerätekonfiguration ändern
  sendAddress(deviceIp, config) {
    const packet = Buffer.alloc(107);
    ARTNET_HEADER.copy(packet);
    packet.writeUInt16LE(OpCodes.OpAddress, 8);
    packet.writeUInt16BE(14, 10); // Protocol Version

    // Net/Sub Switch
    packet[12] = config.netSwitch !== undefined ? (config.netSwitch | 0x80) : 0x7f;
    packet[13] = config.bindIndex || 0;

    // Short Name (18 bytes)
    if (config.shortName !== undefined) {
      const shortNameBuf = Buffer.from(config.shortName.substring(0, 17), 'utf8');
      shortNameBuf.copy(packet, 14);
    }

    // Long Name (64 bytes)
    if (config.longName !== undefined) {
      const longNameBuf = Buffer.from(config.longName.substring(0, 63), 'utf8');
      longNameBuf.copy(packet, 32);
    }

    // SwIn (4 bytes) - Input Universe
    for (let i = 0; i < 4; i++) {
      if (config.swIn && config.swIn[i] !== undefined) {
        packet[96 + i] = config.swIn[i] | 0x80;
      } else {
        packet[96 + i] = 0x7f;
      }
    }

    // SwOut (4 bytes) - Output Universe
    for (let i = 0; i < 4; i++) {
      if (config.swOut && config.swOut[i] !== undefined) {
        packet[100 + i] = config.swOut[i] | 0x80;
      } else {
        packet[100 + i] = 0x7f;
      }
    }

    // SubSwitch
    packet[104] = config.subSwitch !== undefined ? (config.subSwitch | 0x80) : 0x7f;

    // Command
    let command = 0x00;
    if (config.cancelMerge) command = 0x01;
    if (config.ledMute) command = 0x02;
    if (config.ledNormal) command = 0x03;
    if (config.ledLocate) command = 0x04;
    if (config.resetCounters) command = 0x05;
    
    // Merge Mode Commands
    if (config.mergeMode !== undefined) {
      for (let i = 0; i < 4; i++) {
        if (config.mergeMode[i] === 'LTP') {
          command = 0x10 + i; // MergeLtp0-3
        } else if (config.mergeMode[i] === 'HTP') {
          command = 0x50 + i; // MergeHtp0-3
        }
      }
    }

    // Direction Commands
    if (config.direction !== undefined) {
      for (let i = 0; i < 4; i++) {
        if (config.direction[i] === 'input') {
          command = 0x20 + i; // DirIn0-3
        } else if (config.direction[i] === 'output') {
          command = 0x30 + i; // DirOut0-3
        }
      }
    }

    packet[106] = command;

    this.socket.send(packet, ARTNET_PORT, deviceIp);
  }

  // ArtIpProg senden - IP-Konfiguration ändern
  sendIpProg(deviceIp, config) {
    const packet = Buffer.alloc(34);
    ARTNET_HEADER.copy(packet);
    packet.writeUInt16LE(OpCodes.OpIpProg, 8);
    packet.writeUInt16BE(14, 10); // Protocol Version

    let command = 0x00;
    
    if (config.enableProgramming) {
      command |= 0x80; // Enable programming

      if (config.enableDHCP !== undefined) {
        if (config.enableDHCP) {
          command |= 0x40; // DHCP on
        }
      }

      if (config.setDefault) {
        command |= 0x08; // Set defaults
      }

      if (config.ip) {
        command |= 0x04; // Program IP
        const ipParts = parseIpv4Address(config.ip);
        if (!ipParts) {
          throw new Error(`Invalid ArtIpProg IP address: ${config.ip}`);
        }
        packet[16] = ipParts[0];
        packet[17] = ipParts[1];
        packet[18] = ipParts[2];
        packet[19] = ipParts[3];
      }

      if (config.subnet) {
        command |= 0x02; // Program subnet
        const subnetParts = parseIpv4Address(config.subnet);
        if (!subnetParts) {
          throw new Error(`Invalid ArtIpProg subnet: ${config.subnet}`);
        }
        packet[20] = subnetParts[0];
        packet[21] = subnetParts[1];
        packet[22] = subnetParts[2];
        packet[23] = subnetParts[3];
      }

      if (config.gateway) {
        command |= 0x10; // Program gateway (Art-Net 4)
        const gatewayParts = parseIpv4Address(config.gateway);
        if (!gatewayParts) {
          throw new Error(`Invalid ArtIpProg gateway: ${config.gateway}`);
        }
        packet[28] = gatewayParts[0];
        packet[29] = gatewayParts[1];
        packet[30] = gatewayParts[2];
        packet[31] = gatewayParts[3];
      }
    }

    packet[14] = command;

    this.socket.send(packet, ARTNET_PORT, deviceIp);
  }

  // ArtDmx senden
  sendDmx(universe, data, subnet = 0, net = 0) {
    const packet = Buffer.alloc(18 + data.length);
    ARTNET_HEADER.copy(packet);
    packet.writeUInt16LE(OpCodes.OpDmx, 8);
    packet.writeUInt16BE(14, 10); // Protocol Version
    packet[12] = this.sequence++;
    if (this.sequence > 255) this.sequence = 1;
    packet[13] = 0; // Physical port
    packet[14] = (subnet << 4) | (universe & 0x0f); // SubUni
    packet[15] = net & 0x7f; // Net
    packet.writeUInt16BE(data.length, 16); // Length
    Buffer.from(data).copy(packet, 18);

    this.socket.send(packet, ARTNET_PORT, '255.255.255.255');
  }

  // ArtCommand senden (Text-Befehle)
  sendCommand(deviceIp, command) {
    const cmdBuffer = Buffer.from(command + '\0', 'utf8');
    const packet = Buffer.alloc(14 + cmdBuffer.length);
    ARTNET_HEADER.copy(packet);
    packet.writeUInt16LE(OpCodes.OpCommand, 8);
    packet.writeUInt16BE(14, 10); // Protocol Version
    packet.writeUInt16BE(cmdBuffer.length, 12);
    cmdBuffer.copy(packet, 14);

    this.socket.send(packet, ARTNET_PORT, deviceIp);
  }

  getDevices() {
    return Array.from(this.devices.values());
  }

  close() {
    this.socket.close();
  }
}

module.exports = { ArtNetProtocol, OpCodes, MergeModes, PortTypes };
