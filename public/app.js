// public/app.js
class ArtNetConfig {
  constructor() {
    this.ws = null;
    this.devices = new Map();
    this.selectedDevice = null;
    this.dmxValues = new Array(512).fill(0);
    
    this.init();
  }

  init() {
    this.connect();
    this.bindEvents();
    this.createDmxSliders();
  }

  connect() {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.ws = new WebSocket(`${protocol}//${location.host}`);

    this.ws.onopen = () => {
      this.setConnectionStatus(true);
    };

    this.ws.onclose = () => {
      this.setConnectionStatus(false);
      setTimeout(() => this.connect(), 3000);
    };

    this.ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      this.handleMessage(msg);
    };
  }

  setConnectionStatus(connected) {
    const status = document.getElementById('connection-status');
    status.textContent = connected ? 'Connected' : 'Disconnected';
    status.className = `status ${connected ? 'connected' : 'disconnected'}`;
  }

  handleMessage(msg) {
    switch (msg.type) {
      case 'deviceList':
        this.devices.clear();
        msg.data.forEach(d => this.devices.set(d.mac || d.ip, d));
        this.renderDevices();
        break;

      case 'device':
        this.devices.set(msg.data.mac || msg.data.ip, msg.data);
        this.renderDevices();
        if (this.selectedDevice && 
            (this.selectedDevice.mac === msg.data.mac || 
             this.selectedDevice.ip === msg.data.ip)) {
          this.selectedDevice = msg.data;
          this.renderDeviceInfo(msg.data);
        }
        break;

      case 'deviceRemoved':
        this.devices.delete(msg.data.mac || msg.data.ip);
        this.renderDevices();
        break;

      case 'ipProgReply':
        console.log('IP Programming Reply:', msg.data);
        break;
    }
  }

  send(type, data = {}) {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...data }));
    }
  }

  createElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  appendInfoItem(container, label, value) {
    const item = this.createElement('div', 'info-item');
    item.appendChild(this.createElement('span', 'label', label));
    item.appendChild(this.createElement('span', 'value', value));
    container.appendChild(item);
  }

  createOption(value, label, selected) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
  }

  renderDevices() {
    const container = document.getElementById('devices');
    const count = document.getElementById('device-count');
    count.textContent = `(${this.devices.size})`;

    container.innerHTML = '';
    
    const sorted = Array.from(this.devices.values()).sort((a, b) => 
      (a.shortName || a.ip).localeCompare(b.shortName || b.ip)
    );

    sorted.forEach(device => {
      const div = document.createElement('div');
      div.className = 'device-item';
      if (this.selectedDevice?.mac === device.mac && 
          this.selectedDevice?.ip === device.ip) {
        div.classList.add('selected');
      }

      const ports = [];
      for (let i = 0; i < device.numPorts && i < 4; i++) {
        if (device.portTypes[i] & 0x80) {
          ports.push(`Out ${device.swOut[i]}`);
        }
        if (device.portTypes[i] & 0x40) {
          ports.push(`In ${device.swIn[i]}`);
        }
      }

      div.appendChild(this.createElement('div', 'device-name', device.shortName || 'Unknown'));
      div.appendChild(this.createElement('div', 'device-ip', device.ip));

      const portsDiv = this.createElement('div', 'device-ports');
      ports.forEach((port) => {
        portsDiv.appendChild(this.createElement('span', 'port-badge', port));
      });
      div.appendChild(portsDiv);

      div.onclick = () => this.selectDevice(device);
      container.appendChild(div);
    });
  }

  selectDevice(device) {
    this.selectedDevice = device;
    
    document.querySelectorAll('.device-item').forEach(el => 
      el.classList.remove('selected')
    );

    document.getElementById('no-selection').classList.add('hidden');
    document.getElementById('device-panel').classList.remove('hidden');

    this.renderDeviceInfo(device);
    this.renderDevices();
  }

  renderDeviceInfo(device) {
    // Info Grid
    const infoGrid = document.getElementById('device-info');
    infoGrid.innerHTML = '';
    this.appendInfoItem(infoGrid, 'IP Address', device.ip);
    this.appendInfoItem(infoGrid, 'MAC Address', device.mac);
    this.appendInfoItem(infoGrid, 'Firmware', device.versionInfo);
    this.appendInfoItem(infoGrid, 'OEM', `0x${device.oem.toString(16).padStart(4, '0')}`);
    this.appendInfoItem(infoGrid, 'Net/Subnet', `${device.netSwitch}/${device.subSwitch}`);
    this.appendInfoItem(infoGrid, 'Ports', device.numPorts);
    this.appendInfoItem(infoGrid, 'DHCP', device.dhcpEnabled ? 'Enabled' : 'Disabled');
    this.appendInfoItem(infoGrid, 'Art-Net 4', device.artNet4Capable ? 'Yes' : 'No');

    // Names
    document.getElementById('short-name').value = device.shortName || '';
    document.getElementById('long-name').value = device.longName || '';

    // Addressing Config
    document.getElementById('net-switch').value = device.netSwitch;
    document.getElementById('sub-switch').value = device.subSwitch;

    // Port Config
    const portConfig = document.getElementById('port-config');
    portConfig.innerHTML = '';
    
    for (let i = 0; i < Math.min(device.numPorts, 4); i++) {
      const isOutput = device.portTypes[i] & 0x80;
      const isInput = device.portTypes[i] & 0x40;
      
      const row = document.createElement('div');
      row.className = 'port-row';
      row.appendChild(this.createElement('span', 'port-label', `Port ${i + 1}`));

      const inGroup = this.createElement('div', 'form-group');
      inGroup.style.margin = '0';
      const inLabel = document.createElement('label');
      inLabel.style.fontSize = '0.75rem';
      inLabel.textContent = 'Input Universe';
      const inInput = document.createElement('input');
      inInput.type = 'number';
      inInput.className = 'sw-in';
      inInput.dataset.port = i;
      inInput.value = device.swIn[i];
      inInput.min = 0;
      inInput.max = 15;
      inInput.disabled = !isInput;
      inGroup.append(inLabel, inInput);
      row.appendChild(inGroup);

      const outGroup = this.createElement('div', 'form-group');
      outGroup.style.margin = '0';
      const outLabel = document.createElement('label');
      outLabel.style.fontSize = '0.75rem';
      outLabel.textContent = 'Output Universe';
      const outInput = document.createElement('input');
      outInput.type = 'number';
      outInput.className = 'sw-out';
      outInput.dataset.port = i;
      outInput.value = device.swOut[i];
      outInput.min = 0;
      outInput.max = 15;
      outInput.disabled = !isOutput;
      outGroup.append(outLabel, outInput);
      row.appendChild(outGroup);

      const directionSelect = document.createElement('select');
      directionSelect.className = 'port-direction';
      directionSelect.dataset.port = i;
      directionSelect.append(
        this.createOption('output', 'Output', isOutput),
        this.createOption('input', 'Input', isInput)
      );
      row.appendChild(directionSelect);
      portConfig.appendChild(row);
    }

    // Merge Config
    const mergeConfig = document.getElementById('merge-config');
    mergeConfig.innerHTML = '';
    
    for (let i = 0; i < Math.min(device.numPorts, 4); i++) {
      if (!(device.portTypes[i] & 0x80)) continue;
      
      const row = document.createElement('div');
      row.className = 'merge-row';
      row.appendChild(this.createElement('span', null, `Port ${i + 1}:`));

      const mergeSelect = document.createElement('select');
      mergeSelect.className = 'merge-mode';
      mergeSelect.dataset.port = i;
      mergeSelect.append(
        this.createOption('HTP', 'HTP', device.mergeMode[i] === 'HTP'),
        this.createOption('LTP', 'LTP', device.mergeMode[i] === 'LTP')
      );
      row.appendChild(mergeSelect);

      const rdm = this.createElement('span', null, device.rdmEnabled[i] ? '✓ RDM' : '');
      rdm.style.color = 'var(--text-secondary)';
      row.appendChild(rdm);
      mergeConfig.appendChild(row);
    }

    // IP Config
    document.getElementById('dhcp-enabled').checked = device.dhcpEnabled;
    document.getElementById('ip-address').value = device.ip;
    document.getElementById('static-ip-config').style.opacity = 
      device.dhcpEnabled ? '0.5' : '1';
  }

  createDmxSliders() {
    const container = document.getElementById('dmx-sliders');
    for (let i = 0; i < 16; i++) {
      const div = document.createElement('div');
      div.className = 'dmx-channel';
      div.innerHTML = `
        <input type="range" min="0" max="255" value="0" data-channel="${i}">
        <span class="channel-val">0</span>
        <span class="channel-num">${i + 1}</span>
      `;
      container.appendChild(div);
    }
  }

  bindEvents() {
    // Refresh all
    document.getElementById('refresh-btn').onclick = () => {
      this.send('refresh');
    };

    // Refresh device
    document.getElementById('refresh-device-btn').onclick = () => {
      if (this.selectedDevice) {
        this.send('refreshDevice', { ip: this.selectedDevice.ip });
      }
    };

    // Identify
    document.getElementById('identify-btn').onclick = () => {
      if (this.selectedDevice) {
        this.send('identify', { ip: this.selectedDevice.ip });
      }
    };

    // Save names
    document.getElementById('save-names-btn').onclick = () => {
      if (this.selectedDevice) {
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: {
            shortName: document.getElementById('short-name').value,
            longName: document.getElementById('long-name').value
          }
        });
      }
    };

    // Save universe settings
    document.getElementById('save-universe-btn').onclick = () => {
      if (!this.selectedDevice) return;

      const swIn = [], swOut = [];
      document.querySelectorAll('.sw-in').forEach(el => {
        swIn[parseInt(el.dataset.port)] = parseInt(el.value);
      });
      document.querySelectorAll('.sw-out').forEach(el => {
        swOut[parseInt(el.dataset.port)] = parseInt(el.value);
      });

      this.send('configure', {
        ip: this.selectedDevice.ip,
        config: {
          netSwitch: parseInt(document.getElementById('net-switch').value),
          subSwitch: parseInt(document.getElementById('sub-switch').value),
          swIn,
          swOut
        }
      });

      document.querySelectorAll('.port-direction').forEach(el => {
        const port = parseInt(el.dataset.port);
        const currentDirection = this.selectedDevice.portTypes[port] & 0x40 ? 'input' : 'output';
        if (el.value === currentDirection) return;

        const direction = [];
        direction[port] = el.value;
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: { direction }
        });
      });
    };

    // Merge mode change
    document.getElementById('merge-config').onclick = (e) => {
      if (e.target.classList.contains('merge-mode')) {
        const port = parseInt(e.target.dataset.port);
        const mode = e.target.value;
        const mergeMode = [];
        mergeMode[port] = mode;
        
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: { mergeMode }
        });
      }
    };

    // DHCP toggle
    document.getElementById('dhcp-enabled').onchange = (e) => {
      document.getElementById('static-ip-config').style.opacity = 
        e.target.checked ? '0.5' : '1';
    };

    // Save IP
    document.getElementById('save-ip-btn').onclick = () => {
      if (!this.selectedDevice) return;

      const dhcp = document.getElementById('dhcp-enabled').checked;
      const config = {
        enableProgramming: true,
        enableDHCP: dhcp
      };

      if (!dhcp) {
        config.ip = document.getElementById('ip-address').value;
        config.subnet = document.getElementById('subnet-mask').value || '255.0.0.0';
        config.gateway = document.getElementById('gateway').value;
      }

      this.send('configureIp', {
        ip: this.selectedDevice.ip,
        config
      });
    };

    // Reset IP
    document.getElementById('reset-ip-btn').onclick = () => {
      if (!this.selectedDevice) return;
      if (!confirm('Wirklich auf Werkseinstellungen zurücksetzen?')) return;

      this.send('configureIp', {
        ip: this.selectedDevice.ip,
        config: {
          enableProgramming: true,
          setDefault: true
        }
      });
    };

    // DMX Sliders
    document.getElementById('dmx-sliders').oninput = (e) => {
      if (e.target.type === 'range') {
        const ch = parseInt(e.target.dataset.channel);
        const val = parseInt(e.target.value);
        this.dmxValues[ch] = val;
        e.target.nextElementSibling.textContent = val;
        
        const universe = parseInt(document.getElementById('test-universe').value);
        this.send('sendDmx', {
          universe,
          data: this.dmxValues.slice(0, 16),
          subnet: this.selectedDevice?.subSwitch || 0,
          net: this.selectedDevice?.netSwitch || 0
        });
      }
    };

    // All off / all full
    document.getElementById('dmx-all-zero').onclick = () => {
      this.setAllDmx(0);
    };

    document.getElementById('dmx-all-full').onclick = () => {
      this.setAllDmx(255);
    };

    // Advanced commands
    document.getElementById('cancel-merge-btn').onclick = () => {
      if (this.selectedDevice) {
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: { cancelMerge: true }
        });
      }
    };

    document.getElementById('reset-counters-btn').onclick = () => {
      if (this.selectedDevice) {
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: { resetCounters: true }
        });
      }
    };

    document.getElementById('led-mute-btn').onclick = () => {
      if (this.selectedDevice) {
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: { ledMute: true }
        });
      }
    };

    document.getElementById('led-normal-btn').onclick = () => {
      if (this.selectedDevice) {
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: { ledNormal: true }
        });
      }
    };
  }

  setAllDmx(value) {
    this.dmxValues.fill(value, 0, 16);
    document.querySelectorAll('#dmx-sliders input[type="range"]').forEach(el => {
      el.value = value;
      el.nextElementSibling.textContent = value;
    });

    const universe = parseInt(document.getElementById('test-universe').value);
    this.send('sendDmx', {
      universe,
      data: this.dmxValues.slice(0, 16),
      subnet: this.selectedDevice?.subSwitch || 0,
      net: this.selectedDevice?.netSwitch || 0
    });
  }
}

// Start
const app = new ArtNetConfig();
