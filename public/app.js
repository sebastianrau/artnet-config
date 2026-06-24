// public/app.js
class ArtNetConfig {
  constructor() {
    this.ws = null;
    this.devices = new Map();
    this.selectedDevice = null;
    this.selectedDmxTarget = null;
    this.refreshSelectedDetails = false;
    this.refreshSelectedDetailsTimer = null;
    this.refreshButtonTimers = new Map();
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
        if (this.refreshSelectedDetails) {
          this.refreshSelectedDeviceFromList(msg.data);
        }
        this.renderDevices();
        break;

      case 'device':
        this.devices.set(msg.data.mac || msg.data.ip, msg.data);
        this.renderDevices();
        if (this.refreshSelectedDetails && this.isSameDevice(this.selectedDevice, msg.data)) {
          this.selectedDevice = msg.data;
          this.renderDeviceInfo(msg.data);
          this.completeSelectedDetailsRefresh();
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

  isSameDevice(left, right) {
    if (!left || !right) return false;
    if (left.mac && right.mac && left.mac === right.mac) return true;
    return !!(left.ip && right.ip && left.ip === right.ip);
  }

  refreshSelectedDeviceFromList(devices) {
    if (!this.selectedDevice) return;

    const refreshedDevice = devices.find((device) => this.isSameDevice(this.selectedDevice, device));
    if (!refreshedDevice) return;

    this.selectedDevice = refreshedDevice;
    this.renderDeviceInfo(refreshedDevice);
    this.completeSelectedDetailsRefresh();
  }

  requestSelectedDetailsRefresh() {
    if (!this.selectedDevice) return;

    this.refreshSelectedDetails = true;
    if (this.refreshSelectedDetailsTimer) clearTimeout(this.refreshSelectedDetailsTimer);
    this.refreshSelectedDetailsTimer = setTimeout(() => {
      this.refreshSelectedDetails = false;
      this.refreshSelectedDetailsTimer = null;
      this.stopRefreshEffect('refresh-btn');
      this.stopRefreshEffect('refresh-device-btn');
    }, 5000);
  }

  completeSelectedDetailsRefresh() {
    this.refreshSelectedDetails = false;
    if (this.refreshSelectedDetailsTimer) {
      clearTimeout(this.refreshSelectedDetailsTimer);
      this.refreshSelectedDetailsTimer = null;
    }
    this.stopRefreshEffect('refresh-btn');
    this.stopRefreshEffect('refresh-device-btn');
  }

  startRefreshEffect(buttonId, timeout = 5000) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.classList.add('refreshing');
    button.setAttribute('aria-busy', 'true');
    button.dataset.refreshStartedAt = Date.now().toString();

    const existingTimer = this.refreshButtonTimers.get(buttonId);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => this.stopRefreshEffect(buttonId), timeout);
    this.refreshButtonTimers.set(buttonId, timer);
  }

  stopRefreshEffect(buttonId) {
    const button = document.getElementById(buttonId);
    const startedAt = button ? this.asNumber(button.dataset.refreshStartedAt, 0) : 0;
    const elapsed = startedAt ? Date.now() - startedAt : 0;
    const minDuration = 700;

    if (button && elapsed > 0 && elapsed < minDuration) {
      const existingTimer = this.refreshButtonTimers.get(buttonId);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => this.stopRefreshEffect(buttonId), minDuration - elapsed);
      this.refreshButtonTimers.set(buttonId, timer);
      return;
    }

    if (button) {
      button.classList.remove('refreshing');
      button.removeAttribute('aria-busy');
      delete button.dataset.refreshStartedAt;
    }

    const timer = this.refreshButtonTimers.get(buttonId);
    if (timer) clearTimeout(timer);
    this.refreshButtonTimers.delete(buttonId);
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

  asNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  getDevicePortCount(device) {
    if (!device) return 0;
    return Math.min(this.asNumber(device.numPorts, 0), 4);
  }

  getPortValue(device, field, portIndex, fallback = 0) {
    return device && Array.isArray(device[field]) ? this.asNumber(device[field][portIndex], fallback) : fallback;
  }

  calculateGlobalUniverse(net, subnet, portUniverse) {
    const safeNet = this.asNumber(net, 0);
    const safeSubnet = this.asNumber(subnet, 0);
    const universe = this.asNumber(portUniverse, 0);
    return (safeNet * 256) + (safeSubnet * 16) + universe;
  }

  getGlobalUniverse(device, portUniverse) {
    return this.calculateGlobalUniverse(device.netSwitch, device.subSwitch, portUniverse);
  }

  createUniverseSummary(device, portIndex, direction, portUniverse) {
    const row = this.createElement('div', 'universe-row');
    row.appendChild(this.createElement('span', 'universe-port', `Port ${portIndex + 1}`));
    row.appendChild(this.createElement('span', `universe-direction ${direction.toLowerCase()}`, direction));
    row.appendChild(this.createElement('span', 'universe-chip', `U ${this.getGlobalUniverse(device, portUniverse)}`));
    return row;
  }

  createGlobalUniverseHint(device, portIndex, source) {
    const portUniverse = this.getPortValue(device, source, portIndex);
    const hint = this.createElement('span', 'universe-hint', `U ${this.getGlobalUniverse(device, portUniverse)}`);
    hint.dataset.port = portIndex;
    hint.dataset.source = source;
    return hint;
  }

  getDmxTargets(device) {
    const targets = [];

    for (let i = 0; i < this.getDevicePortCount(device); i++) {
      const portType = this.getPortValue(device, 'portTypes', i);
      if (portType & 0x80) {
        targets.push({
          portIndex: i,
          direction: 'Out',
          universe: this.getPortValue(device, 'swOut', i),
          subnet: this.asNumber(device.subSwitch),
          net: this.asNumber(device.netSwitch)
        });
      }
      if (portType & 0x40) {
        targets.push({
          portIndex: i,
          direction: 'In',
          universe: this.getPortValue(device, 'swIn', i),
          subnet: this.asNumber(device.subSwitch),
          net: this.asNumber(device.netSwitch)
        });
      }
    }

    return targets;
  }

  getDmxTargetKey(target) {
    return `${target.portIndex}:${target.direction}:${target.net}:${target.subnet}:${target.universe}`;
  }

  renderDmxTargets(device) {
    const container = document.getElementById('dmx-targets');
    container.innerHTML = '';

    const targets = this.getDmxTargets(device);
    if (targets.length === 0) {
      this.selectedDmxTarget = null;
      container.appendChild(this.createElement('div', 'empty-state', 'No addressable ports for DMX test'));
      return;
    }

    const selectedStillAvailable = this.selectedDmxTarget
      ? targets.find((target) => this.getDmxTargetKey(target) === this.getDmxTargetKey(this.selectedDmxTarget))
      : null;
    this.selectedDmxTarget = selectedStillAvailable || targets[0];

    targets.forEach((target) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'dmx-target-btn';
      if (this.getDmxTargetKey(target) === this.getDmxTargetKey(this.selectedDmxTarget)) {
        button.classList.add('selected');
      }
      button.textContent = `Port ${target.portIndex + 1} ${target.direction} · Global U ${this.calculateGlobalUniverse(target.net, target.subnet, target.universe)}`;
      button.onclick = () => {
        this.selectedDmxTarget = target;
        this.renderDmxTargets(this.selectedDevice);
      };
      container.appendChild(button);
    });
  }

  sendDmxToSelectedTarget() {
    if (!this.selectedDmxTarget) return;

    this.send('sendDmx', {
      universe: this.selectedDmxTarget.universe,
      data: this.dmxValues.slice(0, 16),
      subnet: this.selectedDmxTarget.subnet,
      net: this.selectedDmxTarget.net
    });
  }

  updateGlobalUniverseHints() {
    const net = this.asNumber(document.getElementById('net-switch').value);
    const subnet = this.asNumber(document.getElementById('sub-switch').value);

    document.querySelectorAll('.universe-hint').forEach((hint) => {
      const port = this.asNumber(hint.dataset.port);
      const inputClass = hint.dataset.source === 'swIn' ? 'sw-in' : 'sw-out';
      const input = document.querySelector(`.${inputClass}[data-port="${port}"]`);
      const portUniverse = input ? this.asNumber(input.value) : 0;
      hint.textContent = `U ${this.calculateGlobalUniverse(net, subnet, portUniverse)}`;
    });
  }

  renderDevices() {
    const container = document.getElementById('devices');
    const count = document.getElementById('device-count');
    count.textContent = `(${this.devices.size})`;

    container.innerHTML = '';
    
    const sorted = Array.from(this.devices.values()).sort((a, b) => 
      String(a.shortName || a.ip || '').localeCompare(String(b.shortName || b.ip || ''))
    );

    sorted.forEach(device => {
      const div = document.createElement('div');
      div.className = 'device-item';
      if (this.selectedDevice?.mac === device.mac && 
          this.selectedDevice?.ip === device.ip) {
        div.classList.add('selected');
      }

      const universes = [];
      for (let i = 0; i < this.getDevicePortCount(device); i++) {
        const portType = this.getPortValue(device, 'portTypes', i);
        if (portType & 0x80) {
          universes.push({ portIndex: i, direction: 'Out', universe: this.getPortValue(device, 'swOut', i) });
        }
        if (portType & 0x40) {
          universes.push({ portIndex: i, direction: 'In', universe: this.getPortValue(device, 'swIn', i) });
        }
      }

      div.appendChild(this.createElement('div', 'device-name', device.shortName || 'Unknown'));
      div.appendChild(this.createElement('div', 'device-ip', device.ip || 'No IP'));

      const universesDiv = this.createElement('div', 'device-universes');
      universes.forEach((universe) => {
        universesDiv.appendChild(this.createUniverseSummary(
          device,
          universe.portIndex,
          universe.direction,
          universe.universe
        ));
      });
      if (universes.length === 0) {
        universesDiv.appendChild(this.createElement('div', 'universe-row empty', 'No active ports'));
      }
      div.appendChild(universesDiv);

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
    
    for (let i = 0; i < this.getDevicePortCount(device); i++) {
      const portType = this.getPortValue(device, 'portTypes', i);
      const isOutput = portType & 0x80;
      const isInput = portType & 0x40;
      
      const row = document.createElement('div');
      row.className = 'port-row';
      row.appendChild(this.createElement('span', 'port-label', `Port ${i + 1}`));

      const inGroup = this.createElement('div', 'form-group');
      inGroup.style.margin = '0';
      const inLabel = document.createElement('label');
      inLabel.style.fontSize = '0.75rem';
      inLabel.textContent = 'Input Universe (Port)';
      const inInput = document.createElement('input');
      inInput.type = 'number';
      inInput.className = 'sw-in';
      inInput.dataset.port = i;
      inInput.value = this.getPortValue(device, 'swIn', i);
      inInput.min = 0;
      inInput.max = 15;
      inInput.disabled = !isInput;
      inGroup.append(inLabel, inInput, this.createGlobalUniverseHint(device, i, 'swIn'));
      row.appendChild(inGroup);

      const outGroup = this.createElement('div', 'form-group');
      outGroup.style.margin = '0';
      const outLabel = document.createElement('label');
      outLabel.style.fontSize = '0.75rem';
      outLabel.textContent = 'Output Universe (Port)';
      const outInput = document.createElement('input');
      outInput.type = 'number';
      outInput.className = 'sw-out';
      outInput.dataset.port = i;
      outInput.value = this.getPortValue(device, 'swOut', i);
      outInput.min = 0;
      outInput.max = 15;
      outInput.disabled = !isOutput;
      outGroup.append(outLabel, outInput, this.createGlobalUniverseHint(device, i, 'swOut'));
      row.appendChild(outGroup);

      const directionGroup = this.createElement('div', 'form-group');
      directionGroup.style.margin = '0';
      const directionLabel = document.createElement('label');
      directionLabel.style.fontSize = '0.75rem';
      directionLabel.textContent = 'Direction';

      const directionSelect = document.createElement('select');
      directionSelect.className = 'port-direction';
      directionSelect.dataset.port = i;
      directionSelect.append(
        this.createOption('output', 'Output', isOutput),
        this.createOption('input', 'Input', isInput)
      );
      directionGroup.append(directionLabel, directionSelect);
      row.appendChild(directionGroup);
      portConfig.appendChild(row);
    }

    // Merge Config
    const mergeConfig = document.getElementById('merge-config');
    mergeConfig.innerHTML = '';
    let renderedMergePorts = 0;
    
    for (let i = 0; i < this.getDevicePortCount(device); i++) {
      if (!(this.getPortValue(device, 'portTypes', i) & 0x80)) continue;
      
      const row = document.createElement('div');
      row.className = 'merge-row';
      row.appendChild(this.createElement('span', null, `Port ${i + 1}:`));

      const mergeSelect = document.createElement('select');
      mergeSelect.className = 'merge-mode';
      mergeSelect.dataset.port = i;
      mergeSelect.append(
        this.createOption('HTP', 'HTP', this.getPortValue(device, 'mergeMode', i, 'HTP') === 'HTP'),
        this.createOption('LTP', 'LTP', this.getPortValue(device, 'mergeMode', i, 'HTP') === 'LTP')
      );
      row.appendChild(mergeSelect);

      const rdm = this.createElement('span', null, this.getPortValue(device, 'rdmEnabled', i, false) ? '✓ RDM' : '');
      rdm.style.color = 'var(--text-secondary)';
      row.appendChild(rdm);
      mergeConfig.appendChild(row);
      renderedMergePorts++;
    }

    if (renderedMergePorts === 0) {
      mergeConfig.appendChild(this.createElement('div', 'empty-state', 'No output ports for merge mode'));
    }

    // IP Config
    document.getElementById('dhcp-enabled').checked = device.dhcpEnabled;
    document.getElementById('ip-address').value = device.ip;
    document.getElementById('static-ip-config').style.opacity = 
      device.dhcpEnabled ? '0.5' : '1';

    this.renderDmxTargets(device);
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
      this.startRefreshEffect('refresh-btn');
      this.requestSelectedDetailsRefresh();
      this.send('refresh');
    };

    // Refresh device
    document.getElementById('refresh-device-btn').onclick = () => {
      if (this.selectedDevice) {
        this.startRefreshEffect('refresh-device-btn');
        this.requestSelectedDetailsRefresh();
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

    document.getElementById('net-switch').oninput = () => this.updateGlobalUniverseHints();
    document.getElementById('sub-switch').oninput = () => this.updateGlobalUniverseHints();
    document.getElementById('port-config').oninput = (e) => {
      if (e.target.classList.contains('sw-in') || e.target.classList.contains('sw-out')) {
        this.updateGlobalUniverseHints();
      }
    };

    // Save universe settings
    document.getElementById('save-universe-btn').onclick = () => {
      if (!this.selectedDevice) return;

      const swIn = [], swOut = [];
      const netSwitch = parseInt(document.getElementById('net-switch').value);
      const subSwitch = parseInt(document.getElementById('sub-switch').value);
      document.querySelectorAll('.sw-in').forEach(el => {
        swIn[parseInt(el.dataset.port)] = parseInt(el.value);
      });
      document.querySelectorAll('.sw-out').forEach(el => {
        swOut[parseInt(el.dataset.port)] = parseInt(el.value);
      });

      this.send('configure', {
        ip: this.selectedDevice.ip,
        config: {
          netSwitch,
          subSwitch,
          swIn,
          swOut
        }
      });

      if (!Array.isArray(this.selectedDevice.swIn)) this.selectedDevice.swIn = [];
      if (!Array.isArray(this.selectedDevice.swOut)) this.selectedDevice.swOut = [];

      this.selectedDevice.netSwitch = netSwitch;
      this.selectedDevice.subSwitch = subSwitch;
      swIn.forEach((value, port) => {
        if (value !== undefined) this.selectedDevice.swIn[port] = value;
      });
      swOut.forEach((value, port) => {
        if (value !== undefined) this.selectedDevice.swOut[port] = value;
      });

      this.devices.set(this.selectedDevice.mac || this.selectedDevice.ip, this.selectedDevice);
      this.renderDevices();
      this.renderDmxTargets(this.selectedDevice);

      document.querySelectorAll('.port-direction').forEach(el => {
        const port = parseInt(el.dataset.port);
        const currentDirection = this.getPortValue(this.selectedDevice, 'portTypes', port) & 0x40 ? 'input' : 'output';
        if (el.value === currentDirection) return;

        const direction = [];
        direction[port] = el.value;
        this.send('configure', {
          ip: this.selectedDevice.ip,
          config: { direction }
        });

        if (!Array.isArray(this.selectedDevice.portTypes)) this.selectedDevice.portTypes = [];
        this.selectedDevice.portTypes[port] = el.value === 'input' ? 0x40 : 0x80;
      });

      this.devices.set(this.selectedDevice.mac || this.selectedDevice.ip, this.selectedDevice);
      this.renderDevices();
      this.renderDmxTargets(this.selectedDevice);
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
        this.sendDmxToSelectedTarget();
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

    this.sendDmxToSelectedTarget();
  }
}

// Start
const app = new ArtNetConfig();
