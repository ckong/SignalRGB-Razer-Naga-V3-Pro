// Razer Naga V3 Pro — wired SignalRGB plugin.
// Onboard DPI and polling settings are the default. No software-mode command.
export function Name() { return 'Razer Naga V3 Pro Wired'; }
export function Publisher() { return 'Community plugin'; }
export function VendorId() { return 0x1532; }
export function ProductId() { return 0x00E7; }
export function Type() { return 'Hid'; }
export function DeviceType() { return 'mouse'; }
export function SupportsSubdevices() { return true; }
export function ImageUrl() { return 'https://assets.signalrgb.com/devices/brands/razer/mice/naga-v3-pro.png'; }
export function Size() { return [1, 1]; } // Parent controller; three movable subdevices supply the lighting
export function DefaultPosition() { return [225, 120]; }
export function DefaultScale() { return 15; }

const DPI_OPTIONS = [
  '100', '200', '400', '600', '800', '1000', '1200', '1600',
  '2000', '2400', '3200', '4000', '4800', '6400', '8000',
  '10000', '12800', '16000', '20000', '25600', '30000', '50000'
];

export function ControllableParameters() {
  return [
    { property: 'dpiControl', group: 'settings', label: 'DPI Control', type: 'combobox', values: ['Onboard Profile', ...DPI_OPTIONS], default: 'Onboard Profile' },
    { property: 'pollingControl', group: 'settings', label: 'Polling Rate Control', type: 'combobox', values: ['Onboard Profile', '125Hz', '500Hz', '1000Hz'], default: 'Onboard Profile' }
  ];
}

export function Validate(endpoint) {
  return (endpoint.interface === 3 && endpoint.usage === 0x0003 && endpoint.usage_page === 0x0001 && endpoint.collection === 0)
    || (endpoint.interface === 0 && endpoint.usage === 0x0002 && endpoint.usage_page === 0x0001);
}

export function LedNames() { return []; } // LEDs belong to independent subdevices
export function LedPositions() { return []; } // See SUBDEVICES below

// One physical HID controller with three independently movable lighting zones.
// Hardware packet order is Logo, Scroll Wheel, Side Panel. Do not reorder this list.
const SUBDEVICES = [
  { id: 'naga-logo', name: 'Naga Logo' },
  { id: 'naga-scroll', name: 'Naga Scroll Wheel' },
  { id: 'naga-side', name: 'Naga Side Panel' }
];
let isWireless = false;
function initializeSubdevices() {
  // Reuse stable IDs so layout positions can persist between plugin restarts.
  for (const zone of SUBDEVICES) {
    device.createSubdevice(zone.id);
    device.setSubdeviceName(zone.id, zone.name);
    device.setSubdeviceSize(zone.id, 1, 1);
    device.setSubdeviceLeds(zone.id, [zone.name], [[0, 0]]);
  }
}

let lastSent = '';
let lastTime = 0;
let lastBatteryTime = 0;
let lastKeepAliveTime = 0;
let sendFailures = 0;
let disabled = false;
let retryAfter = 0;
let lastRenderTime = 0;
const RGB_RETRY_DELAY_MS = 5000;
const WAKE_GAP_MS = 10000;

const BATTERY_POLL_INTERVAL_MS = 30000;
const KEEPALIVE_REFRESH_INTERVAL_MS = 3000;

const POLLING_RATE_MAP = {
  '125Hz': 0x08,
  '500Hz': 0x02,
  '1000Hz': 0x01
};

function buildRazerReport(transactionId, dataSize, commandClass, commandId, args = []) {
  const report = new Array(91).fill(0);
  report[2] = transactionId;
  report[6] = dataSize;
  report[7] = commandClass;
  report[8] = commandId;

  for (let i = 0; i < args.length; i++) {
    report[9 + i] = args[i];
  }

  let crc = 0;
  for (let i = 3; i < 89; i++) {
    crc ^= report[i];
  }
  report[89] = crc;

  return report;
}

function sendRazerCommand(dataSize, commandClass, commandId, args = []) {
  const report = buildRazerReport(0x1F, dataSize, commandClass, commandId, args);
  device.send_report(report, 91);
  device.pause(15);

  let response = device.get_report(report, 91);

  if (!response || response.length < 11 || response[1] !== 0x02) {
    const fallbackReport = buildRazerReport(0x3F, dataSize, commandClass, commandId, args);
    device.send_report(fallbackReport, 91);
    device.pause(15);
    response = device.get_report(fallbackReport, 91);
  }

  return response;
}

function selectLightingEndpoint() {
  try {
    // Select lighting HID endpoints; this does not guarantee reopening a HID handle
    device.set_endpoint(0, 0x0002, 0x0001);
    device.set_endpoint(3, 0x0003, 0x0001, 0x0000);

    // Do not send Set Device Mode (0x00/0x04): it can lock onboard profiles.
  } catch (err) {
    device.log('Naga V3 Pro: endpoint selection error: ' + String(err));
  }
}

function updateBatteryStatus() {
  try {
    const levelResp = sendRazerCommand(0x02, 0x07, 0x80, [0x00, 0x00]);
    if (levelResp && levelResp.length >= 11 && levelResp[1] === 0x02) {
      const rawLevel = levelResp[10];
      const percentage = Math.max(0, Math.min(100, Math.round((rawLevel / 255) * 100)));
      battery.setBatteryLevel(percentage);
    }

    const chargeResp = sendRazerCommand(0x02, 0x07, 0x84, [0x00, 0x00]);
    if (chargeResp && chargeResp.length >= 11 && chargeResp[1] === 0x02) {
      const isCharging = chargeResp[10] === 0x01;
      battery.setBatteryState(isCharging ? battery.charging : battery.draining);
    }
  } catch (err) {
    device.log('Battery poll error: ' + String(err));
  }
}

// Overrides affect the active device settings only; they are never written to onboard storage.
// Switching back to Onboard Profile stops sending overrides; a power-cycle/profile
// reselect may be needed to restore the actual device setting.
function applyDpiOverride() {
  if (typeof dpiControl === 'undefined' || dpiControl === 'Onboard Profile') return;
  const dpi = parseInt(dpiControl, 10);
  if (!Number.isFinite(dpi) || dpi < 100 || dpi > 50000) return;
  try {
    // Preserve the five-stage packet format, but use
    // the chosen DPI for all five stages, selecting stage 1.
    const args = [0x01, 0x01, 0x05];
    for (let idx = 0; idx < 5; idx++) {
      const hi = (dpi >> 8) & 0xFF;
      const lo = dpi & 0xFF;
      args.push(idx + 1, hi, lo, hi, lo, 0x00, 0x00);
    }
    sendRazerCommand(0x26, 0x04, 0x06, args);
    device.log('Naga V3 Pro: explicit DPI override: ' + dpi);
  } catch (err) { device.log('Naga V3 Pro: DPI override error: ' + String(err)); }
}

function applyPollingOverride() {
  if (typeof pollingControl === 'undefined' || pollingControl === 'Onboard Profile') return;
  const code = POLLING_RATE_MAP[pollingControl];
  if (typeof code === 'undefined') return;
  try {
    sendRazerCommand(0x01, 0x00, 0x05, [code]);
    device.log('Naga V3 Pro: explicit polling override: ' + pollingControl);
  } catch (err) { device.log('Naga V3 Pro: polling override error: ' + String(err)); }
}

export function ondpiControlChanged() { applyDpiOverride(); }
export function onpollingControlChanged() { applyPollingOverride(); }

function sendColors(colors) {
  const ledCount = 3;
  const payload = [(ledCount * 3 + 5), 0x0F, 0x03, 0, 0, 0, 0, ledCount - 1, ...colors];
  const report = new Array(91).fill(0);
  report[2] = 0x1F;
  for (let i = 0; i < payload.length; i++) report[6 + i] = payload[i];
  let crc = 0;
  for (let i = 3; i < 89; i++) crc ^= report[i];
  report[89] = crc;
  return device.send_report(report, 91);
}

export function Initialize() {
  lastSent = '';
  lastTime = 0;
  lastKeepAliveTime = 0;
  sendFailures = 0;
  disabled = false;
  retryAfter = 0;
  lastRenderTime = 0;

  isWireless = false;
  if (isWireless) device.addFeature('battery');
  initializeSubdevices();
  selectLightingEndpoint();
  device.log('Naga V3 Pro: ' + (isWireless ? 'wireless' : 'wired') + ' connection; onboard performance settings preserved unless overridden.');

  if (isWireless) updateBatteryStatus();
  lastBatteryTime = Date.now();
  applyDpiOverride();
  applyPollingOverride();
}

export function Render() {
  const now = Date.now();
  // Wake recovery: reselect endpoint without changing device mode
  if (lastRenderTime && (now - lastRenderTime > WAKE_GAP_MS || now < lastRenderTime)) {
    device.log('Naga V3 Pro: render gap detected; reselecting endpoint.');
    selectLightingEndpoint();
    lastSent = '';
    lastTime = 0;
    lastKeepAliveTime = now;
    sendFailures = 0;
    disabled = false;
    retryAfter = 0;
  }
  lastRenderTime = now;

  // Retry recovery after transient HID failures
  if (disabled && now >= retryAfter) {
    disabled = false;
    sendFailures = 0;
    lastSent = '';
    lastKeepAliveTime = now;
    selectLightingEndpoint();
    device.log('Naga V3 Pro: retrying RGB after temporary HID failure.');
  }

  if (isWireless && now - lastBatteryTime >= BATTERY_POLL_INTERVAL_MS) {
    lastBatteryTime = now;
    updateBatteryStatus();
  }

  if (disabled) return;
  if (now - lastTime < 50) return;

  // Read each movable zone's own canvas position, in the hardware packet order.
  const colors = [];
  for (const zone of SUBDEVICES) {
    const rgb = device.subdeviceColor(zone.id, 0, 0);
    for (let i = 0; i < 3; i++) colors.push(Math.max(0, Math.min(255, Math.round((Number(rgb[i]) || 0)))));
  }

  const signature = colors.join(',');
  const forceRefresh = (now - lastKeepAliveTime >= KEEPALIVE_REFRESH_INTERVAL_MS);
  if (signature === lastSent && !forceRefresh) return;
  lastTime = now;

  // Periodically refresh RGB without changing device mode.

  try {
    const result = sendColors(colors);
    if (result === -1 || result === false) {
      sendFailures++;
      if (sendFailures === 1) device.log('Naga V3 Pro: RGB feature report returned failure.');
      if (sendFailures >= 3) {
        disabled = true;
        retryAfter = now + RGB_RETRY_DELAY_MS;
        device.log('Naga V3 Pro: RGB paused after three failures; retrying in 5 seconds.');
      }
    } else {
      sendFailures = 0;
      lastSent = signature;
      lastKeepAliveTime = now;
    }
  } catch (err) {
    disabled = true;
    retryAfter = now + RGB_RETRY_DELAY_MS;
    device.log('Naga V3 Pro: RGB exception; retrying in 5 seconds: ' + String(err));
  }
}

export function Shutdown() { /* Leave lighting state; do not alter profiles or device mode. */ }
