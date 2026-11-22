/**
 * NeuroReflex Clinical Station - Application Controller
 * Project: Diabetic Neuropathy & Peripheral Ischemia Telemetry Workstation
 * PRBL Semester 5 Engineering Project
 *
 * Designed with clean biomedical ergonomics, WebSerial driver,
 * responsive charting, and official lab trial reporting.
 */

// ============================================================================
// 1. STATE MANAGEMENT & SYSTEM CONSTANTS
// ============================================================================
const CONFIG = {
  ISCHEMIA_THRESHOLD: 25.5,   // In °C, matching user's Arduino firmware
  TEMP_OFFSET: 7.0,           // Calibration room temp offset
  BAUD_RATE: 115200,
  EMG_WINDOW_SIZE: 75,
  TEMP_WINDOW_SIZE: 25
};

const state = {
  // Connection
  connMode: 'DISCONNECTED',   // 'SERIAL', 'WIFI', 'SIMULATOR', 'DISCONNECTED'
  port: null,
  reader: null,
  ws: null,
  simTimer: null,
  isPaused: false,

  // Patient / Subject Context
  subject: {
    id: 'PT-1042',
    site: 'Plantar Surface (Left Foot)'
  },

  // Telemetry Variables
  tempC: 27.2,
  emgRaw: 2048,
  electrodesConnected: true,
  motorActive: false,
  alarmActive: false,
  alarmAcknowledged: false,
  alarmStartTime: null,
  reflexDelay: null,
  nerveDamage: 0,

  // Audio & UI
  soundMuted: false,
  audioCtx: null,
  darkMode: false,

  // Historical Records
  trials: [],
  emgHistory: new Array(CONFIG.EMG_WINDOW_SIZE).fill(2048),
  tempHistory: new Array(CONFIG.TEMP_WINDOW_SIZE).fill(27.0)
};

// ============================================================================
// 2. DOM ELEMENT REFERENCES
// ============================================================================
const ui = {
  // Navigation & Connection
  statusDot: document.getElementById('statusDot'),
  statusLabel: document.getElementById('statusLabel'),
  btnConnectSerial: document.getElementById('btnConnectSerial'),
  connectBtnText: document.getElementById('connectBtnText'),
  btnSimulate: document.getElementById('btnSimulate'),
  simBtnLabel: document.getElementById('simBtnLabel'),
  btnToggleTheme: document.getElementById('btnToggleTheme'),
  themeIcon: document.getElementById('themeIcon'),
  btnToggleMute: document.getElementById('btnToggleMute'),
  soundIcon: document.getElementById('soundIcon'),
  btnOpenWifiModal: document.getElementById('btnOpenWifiModal'),

  // Subject details
  subjectNameDisplay: document.getElementById('subjectNameDisplay'),
  btnEditSubject: document.getElementById('btnEditSubject'),
  subjectModal: document.getElementById('subjectModal'),
  btnCloseSubjectModal: document.getElementById('btnCloseSubjectModal'),
  btnSaveSubject: document.getElementById('btnSaveSubject'),
  inputSubjectId: document.getElementById('inputSubjectId'),
  selectTestSite: document.getElementById('selectTestSite'),

  // Primary Metrics
  valTempC: document.getElementById('valTempC'),
  valTempF: document.getElementById('valTempF'),
  tempBadge: document.getElementById('tempBadge'),
  tempBar: document.getElementById('tempBar'),

  valEmgRaw: document.getElementById('valEmgRaw'),
  leadsStatusBadge: document.getElementById('leadsStatusBadge'),
  leadsContactText: document.getElementById('leadsContactText'),
  valEmgVoltage: document.getElementById('valEmgVoltage'),
  leadOffNotice: document.getElementById('leadOffNotice'),

  motorBadge: document.getElementById('motorBadge'),
  motorStatusText: document.getElementById('motorStatusText'),
  motorIconBox: document.getElementById('motorIconBox'),
  buttonStateBadge: document.getElementById('buttonStateBadge'),

  valNerveDamage: document.getElementById('valNerveDamage'),
  valReflexDelayText: document.getElementById('valReflexDelayText'),
  impairmentBadge: document.getElementById('impairmentBadge'),
  impairmentSeverityText: document.getElementById('impairmentSeverityText'),
  impairmentBar: document.getElementById('impairmentBar'),

  // Alarm Banner
  alarmBanner: document.getElementById('alarmBanner'),
  activeTestTimer: document.getElementById('activeTestTimer'),
  reArmStatusText: document.getElementById('reArmStatusText'),

  // Controls & Actions
  btnFreezeTrace: document.getElementById('btnFreezeTrace'),
  freezeBtnText: document.getElementById('freezeBtnText'),
  btnResetTrace: document.getElementById('btnResetTrace'),
  btnTriggerColdSim: document.getElementById('btnTriggerColdSim'),
  btnPressButtonSim: document.getElementById('btnPressButtonSim'),
  btnPrintReport: document.getElementById('btnPrintReport'),
  btnExportCsv: document.getElementById('btnExportCsv'),
  btnClearTable: document.getElementById('btnClearTable'),

  // Trial Table & Terminal
  trialTableBody: document.getElementById('trialTableBody'),
  recordBadge: document.getElementById('recordBadge'),
  serialConsoleBox: document.getElementById('serialConsoleBox'),
  btnToggleTerminal: document.getElementById('btnToggleTerminal'),
  terminalChevron: document.getElementById('terminalChevron'),

  // Modals & Containers
  wifiModal: document.getElementById('wifiModal'),
  btnCloseWifiModal: document.getElementById('btnCloseWifiModal'),
  btnConnectWifi: document.getElementById('btnConnectWifi'),
  inputEspIp: document.getElementById('inputEspIp'),
  toastContainer: document.getElementById('toastContainer'),

  // Print Header elements
  printDate: document.getElementById('printDate'),
  printSubjectId: document.getElementById('printSubjectId'),
  printTestSite: document.getElementById('printTestSite')
};

// ============================================================================
// 3. TOAST NOTIFICATION SYSTEM (Human & Non-intrusive)
// ============================================================================
function showToast(message, type = 'info', duration = 3500) {
  const toast = document.createElement('div');
  const typeStyles = {
    info: 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-slate-700',
    success: 'bg-emerald-600 text-white border-emerald-700',
    warning: 'bg-amber-600 text-white border-amber-700',
    error: 'bg-rose-600 text-white border-rose-700'
  };

  const icons = {
    info: 'info',
    success: 'check-circle',
    warning: 'alert-triangle',
    error: 'alert-circle'
  };

  toast.className = `toast-enter pointer-events-auto flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-xs font-medium shadow-lg border ${typeStyles[type] || typeStyles.info}`;
  toast.innerHTML = `
    <i data-lucide="${icons[type] || 'info'}" class="w-4 h-4 shrink-0"></i>
    <span>${message}</span>
  `;

  ui.toastContainer.appendChild(toast);
  if (window.lucide) lucide.createIcons();

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ============================================================================
// 4. MEDICAL AUDIO SYNTHESIZER (Web Audio API - Gentle clinical tones)
// ============================================================================
function playTone(type = 'chime') {
  if (state.soundMuted) return;

  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!state.audioCtx) {
      state.audioCtx = new AudioContext();
    }
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }

    const now = state.audioCtx.currentTime;
    const osc = state.audioCtx.createOscillator();
    const gain = state.audioCtx.createGain();
    osc.connect(gain);
    gain.connect(state.audioCtx.destination);

    if (type === 'alarm') {
      // Soft attention chime (gentle medical tone)
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(523.25, now + 0.12); // C5
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'button') {
      // Pleasant acknowledgment ping
      osc.type = 'sine';
      osc.frequency.setValueAtTime(783.99, now); // G5
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
    } else if (type === 'click') {
      // Subtle UI click
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1000, now);
      gain.gain.setValueAtTime(0.03, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    }
  } catch (err) {
    console.debug('Audio context notice:', err);
  }
}

// ============================================================================
// 5. CHART.JS INITIALIZATION WITH THEME AWARENESS
// ============================================================================
let emgChart, tempChart;

function initCharts() {
  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  // 1. EMG Muscle Waveform Chart
  const ctxEmg = document.getElementById('emgChart').getContext('2d');
  emgChart = new Chart(ctxEmg, {
    type: 'line',
    data: {
      labels: new Array(CONFIG.EMG_WINDOW_SIZE).fill(''),
      datasets: [{
        label: 'EMG Biopotential',
        data: [...state.emgHistory],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.06)',
        borderWidth: 1.8,
        pointRadius: 0,
        tension: 0.15,
        fill: true
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          min: 0,
          max: 4095,
          grid: { color: gridColor, lineWidth: 1 },
          ticks: {
            color: textColor,
            font: { family: 'JetBrains Mono', size: 10 },
            stepSize: 1024
          }
        },
        x: { display: false }
      },
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });

  // 2. Temperature History Trend
  const ctxTemp = document.getElementById('tempChart').getContext('2d');
  tempChart = new Chart(ctxTemp, {
    type: 'line',
    data: {
      labels: new Array(CONFIG.TEMP_WINDOW_SIZE).fill(''),
      datasets: [
        {
          label: 'Skin Temperature (°C)',
          data: [...state.tempHistory],
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          borderWidth: 2,
          pointRadius: 2,
          pointBackgroundColor: '#0284c7',
          tension: 0.25,
          fill: true
        },
        {
          label: 'Ischemia Threshold (25.5°C)',
          data: new Array(CONFIG.TEMP_WINDOW_SIZE).fill(CONFIG.ISCHEMIA_THRESHOLD),
          borderColor: '#e11d48',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        y: {
          min: 18,
          max: 38,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            font: { family: 'JetBrains Mono', size: 10 },
            stepSize: 4
          }
        },
        x: { display: false }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function updateChartTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  if (emgChart) {
    emgChart.options.scales.y.grid.color = gridColor;
    emgChart.options.scales.y.ticks.color = textColor;
    emgChart.update('none');
  }

  if (tempChart) {
    tempChart.options.scales.y.grid.color = gridColor;
    tempChart.options.scales.y.ticks.color = textColor;
    tempChart.update('none');
  }
}

// ============================================================================
// 6. CLINICAL NERVE DAMAGE CLASSIFICATION
// ============================================================================
function evaluateNerveFunction(damagePercent) {
  if (damagePercent === 0) {
    return {
      severity: 'Normal Conduction',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
      barColor: 'bg-emerald-500'
    };
  } else if (damagePercent <= 25) {
    return {
      severity: 'Mild Delay (Early Neuropathy)',
      badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
      barColor: 'bg-amber-400'
    };
  } else if (damagePercent <= 50) {
    return {
      severity: 'Moderate Sensory Delay',
      badgeClass: 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700',
      barColor: 'bg-amber-500'
    };
  } else if (damagePercent <= 80) {
    return {
      severity: 'Severe Neuropathy',
      badgeClass: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
      barColor: 'bg-rose-500'
    };
  } else {
    return {
      severity: 'Non-responsive / Complete Sensory Loss',
      badgeClass: 'bg-rose-600 text-white border border-rose-700',
      barColor: 'bg-rose-600'
    };
  }
}

// ============================================================================
// 7. TELEMETRY UI SYNC
// ============================================================================
function updateDashboardUI() {
  // 1. Skin Temperature
  ui.valTempC.textContent = state.tempC.toFixed(1);
  const tempF = ((state.tempC * 9 / 5) + 32).toFixed(1);
  ui.valTempF.textContent = `(${tempF} °F)`;

  const tempPercent = Math.min(100, Math.max(0, ((state.tempC - 15) / (35 - 15)) * 100));
  ui.tempBar.style.width = `${tempPercent}%`;

  if (state.tempC < CONFIG.ISCHEMIA_THRESHOLD && state.tempC > 0) {
    ui.tempBadge.textContent = 'ISCHEMIA ALERT';
    ui.tempBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 animate-pulse';
    ui.tempBar.className = 'bg-rose-500 h-2 rounded-full transition-all duration-300';
  } else {
    ui.tempBadge.textContent = 'NORMAL';
    ui.tempBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
    ui.tempBar.className = 'bg-clinicalBlue-500 h-2 rounded-full transition-all duration-300';
  }

  // 2. EMG & Lead-Off
  if (!state.electrodesConnected) {
    ui.valEmgRaw.textContent = 'OFF';
    ui.leadsStatusBadge.textContent = 'DISCONNECTED';
    ui.leadsStatusBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800';
    ui.leadsContactText.textContent = 'Lead-Off (LO+ / LO-)';
    ui.leadsContactText.className = 'font-mono text-amber-600 dark:text-amber-400 font-semibold';
    ui.valEmgVoltage.textContent = '-- mV';
    ui.leadOffNotice.classList.remove('hidden');
  } else {
    ui.valEmgRaw.textContent = state.emgRaw;
    ui.leadsStatusBadge.textContent = 'CONNECTED';
    ui.leadsStatusBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800';
    ui.leadsContactText.textContent = 'Contact Established';
    ui.leadsContactText.className = 'font-mono text-emerald-600 dark:text-emerald-400';

    // Approximate amplitude in mV
    const mv = ((state.emgRaw / 4095.0) * 3.3 * 1000).toFixed(0);
    ui.valEmgVoltage.textContent = `${mv} mV`;
    ui.leadOffNotice.classList.add('hidden');
  }

  // 3. Tactile Stimulator Motor
  if (state.motorActive) {
    ui.motorBadge.textContent = 'ACTIVE (VIBRATING)';
    ui.motorBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white border border-amber-600';
    ui.motorStatusText.textContent = 'Stimulating Plantar Nerve';
    ui.motorIconBox.className = 'w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-300 dark:border-amber-700 stimulus-vibrating';
  } else {
    ui.motorBadge.textContent = 'MOTOR OFF';
    ui.motorBadge.className = 'text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-labSlate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-labSlate-700';
    ui.motorStatusText.textContent = 'Idle / Awaiting Cold';
    ui.motorIconBox.className = 'w-10 h-10 rounded-lg bg-slate-100 dark:bg-labSlate-800 text-slate-500 flex items-center justify-center border border-slate-200 dark:border-labSlate-700';
  }

  // 4. Nerve Impairment Score
  ui.valNerveDamage.textContent = state.nerveDamage;
  ui.impairmentBar.style.width = `${state.nerveDamage}%`;

  if (state.reflexDelay !== null) {
    ui.valReflexDelayText.textContent = `Delay: ${state.reflexDelay} s`;
  } else {
    ui.valReflexDelayText.textContent = 'Delay: -- s';
  }

  const assessment = evaluateNerveFunction(state.nerveDamage);
  ui.impairmentBadge.textContent = `${assessment.severity} (${state.nerveDamage}%)`;
  ui.impairmentBadge.className = `text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${assessment.badgeClass}`;
  ui.impairmentSeverityText.textContent = assessment.severity;
  ui.impairmentBar.className = `${assessment.barColor} h-2 rounded-full transition-all duration-300`;

  // 5. Active Alarm & Re-arm Status
  if (state.alarmActive) {
    ui.alarmBanner.classList.remove('hidden');
    ui.reArmStatusText.textContent = 'TEST IN PROGRESS (AWAITING RESPONSE)';
    ui.reArmStatusText.className = 'font-mono font-bold text-rose-600 dark:text-rose-400 animate-pulse';

    if (state.alarmStartTime) {
      const elapsed = ((Date.now() - state.alarmStartTime) / 1000).toFixed(1);
      ui.activeTestTimer.textContent = `${elapsed}s`;
    }
  } else {
    ui.alarmBanner.classList.add('hidden');
    if (state.alarmAcknowledged) {
      ui.reArmStatusText.textContent = 'AWAITING RE-WARMING (≥25.5°C)';
      ui.reArmStatusText.className = 'font-mono font-medium text-amber-600 dark:text-amber-400';
    } else {
      ui.reArmStatusText.textContent = 'ARMED & MONITORING';
      ui.reArmStatusText.className = 'font-mono font-medium text-emerald-600 dark:text-emerald-400';
    }
  }
}

// Push data buffers to charts
function pushDataToCharts(emg, temp) {
  if (state.isPaused) return;

  if (emgChart) {
    state.emgHistory.push(state.electrodesConnected ? emg : 2048);
    if (state.emgHistory.length > CONFIG.EMG_WINDOW_SIZE) state.emgHistory.shift();
    emgChart.data.datasets[0].data = [...state.emgHistory];
    emgChart.update('none');
  }

  if (tempChart && temp !== undefined && !isNaN(temp)) {
    state.tempHistory.push(temp);
    if (state.tempHistory.length > CONFIG.TEMP_WINDOW_SIZE) state.tempHistory.shift();
    tempChart.data.datasets[0].data = [...state.tempHistory];
    tempChart.update('none');
  }
}

// Append log to collapsible console
function appendConsole(line) {
  const timestamp = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.textContent = `[${timestamp}] ${line}`;
  ui.serialConsoleBox.appendChild(entry);
  ui.serialConsoleBox.scrollTop = ui.serialConsoleBox.scrollHeight;

  while (ui.serialConsoleBox.childElementCount > 100) {
    ui.serialConsoleBox.removeChild(ui.serialConsoleBox.firstChild);
  }
}

// ============================================================================
// 8. TELEMETRY LINE PARSER (Seamlessly handles both Original Serial & JSON)
// ============================================================================
function parseIncomingLine(line) {
  line = line.trim();
  if (!line) return;

  appendConsole(line);

  // Check JSON format first
  if (line.startsWith('{') && line.endsWith('}')) {
    try {
      const data = JSON.parse(line);
      if (data.type === 'telemetry') {
        state.tempC = data.temp;
        state.electrodesConnected = data.connected;
        state.emgRaw = data.emg;
        state.motorActive = data.motor;
        state.alarmActive = data.alarm;
        pushDataToCharts(state.emgRaw, state.tempC);
        updateDashboardUI();
        return;
      }
    } catch (e) {
      // Fallback to regex
    }
  }

  // 1. Regular print: "EMG: <val|DISCONNECTED>  |  Skin Temp: <val> °C"
  const emgMatch = line.match(/EMG:\s*([0-9]+|DISCONNECTED)\s*\|\s*Skin Temp:\s*([0-9.-]+)\s*°C/i);
  if (emgMatch) {
    const rawVal = emgMatch[1];
    const rawTemp = parseFloat(emgMatch[2]);

    if (rawVal.toUpperCase() === 'DISCONNECTED') {
      state.electrodesConnected = false;
    } else {
      state.electrodesConnected = true;
      state.emgRaw = parseInt(rawVal, 10);
    }

    if (!isNaN(rawTemp)) {
      state.tempC = rawTemp;
    }

    pushDataToCharts(state.emgRaw, state.tempC);
    updateDashboardUI();
    return;
  }

  // 2. Alarm Trigger: "Warning: Low Temp! Motor ON. Waiting for patient reflex..."
  if (line.includes('Low Temp! Motor ON') || line.includes('Motor ON')) {
    state.alarmActive = true;
    state.motorActive = true;
    state.alarmStartTime = Date.now();
    playTone('alarm');
    showToast('Ischemia detected (<25.5°C): Vibration motor activated.', 'warning');
    updateDashboardUI();
    return;
  }

  // 3. Patient Response: "Patient Button Pressed!"
  if (line.includes('Patient Button Pressed')) {
    state.motorActive = false;
    state.alarmActive = false;
    state.alarmAcknowledged = true;
    playTone('button');
    ui.buttonStateBadge.textContent = 'GPIO 27 (Triggered)';
    ui.buttonStateBadge.className = 'px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-mono text-[11px] font-bold border border-emerald-300 dark:border-emerald-700';
    setTimeout(() => {
      ui.buttonStateBadge.textContent = 'GPIO 27 (Open)';
      ui.buttonStateBadge.className = 'px-2 py-0.5 rounded bg-slate-100 dark:bg-labSlate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] border border-slate-200 dark:border-labSlate-700';
    }, 2000);
    updateDashboardUI();
  }

  // 4. Reflex Delay: "Reflex Delay Time: X seconds"
  const delayMatch = line.match(/Reflex Delay Time:\s*([0-9]+)/i);
  if (delayMatch) {
    state.reflexDelay = parseInt(delayMatch[1], 10);
    updateDashboardUI();
  }

  // 5. Nerve Damage: "Calculated Nerve Damage: X%"
  const damageMatch = line.match(/Calculated Nerve Damage:\s*([0-9]+)%/i);
  if (damageMatch) {
    state.nerveDamage = parseInt(damageMatch[1], 10);
    recordTrial({
      temp: `${state.tempC.toFixed(1)} °C`,
      delay: `${state.reflexDelay || 0} s`,
      damage: `${state.nerveDamage}%`,
      assessment: evaluateNerveFunction(state.nerveDamage).severity
    });
    showToast(`Trial completed: Reflex delay ${state.reflexDelay}s (Damage: ${state.nerveDamage}%)`, 'success');
    updateDashboardUI();
  }

  // 6. Timeout: "TIMEOUT ALARM: No Patient Response"
  if (line.includes('TIMEOUT ALARM')) {
    state.motorActive = false;
    state.alarmActive = false;
    state.alarmAcknowledged = true;
    state.reflexDelay = 105;
    state.nerveDamage = 100;
    recordTrial({
      temp: `${state.tempC.toFixed(1)} °C`,
      delay: '105+ s (Timeout)',
      damage: '100%',
      assessment: 'Non-responsive / Complete Sensory Loss'
    });
    showToast('Timeout: No patient response within 105s.', 'error');
    updateDashboardUI();
  }

  // 7. Re-arming: "Temperature Normalized! System re-armed"
  if (line.includes('Temperature Normalized') || line.includes('re-armed')) {
    state.alarmAcknowledged = false;
    showToast('Skin temperature normalized (≥25.5°C). Ready for next trial.', 'info');
    updateDashboardUI();
  }
}

// ============================================================================
// 9. CLINICAL TRIAL RECORDS & EXPORTS
// ============================================================================
function recordTrial(trialData) {
  const item = {
    id: state.trials.length + 1,
    time: new Date().toLocaleTimeString(),
    ...trialData
  };
  state.trials.unshift(item);
  renderTrialTable();
}

function renderTrialTable() {
  ui.recordBadge.textContent = `${state.trials.length} Trials`;

  if (state.trials.length === 0) {
    ui.trialTableBody.innerHTML = `
      <tr id="emptyRow">
        <td colspan="6" class="py-6 text-center text-slate-400 font-sans">
          No trials recorded in current session. Trigger a reflex test to populate.
        </td>
      </tr>
    `;
    return;
  }

  ui.trialTableBody.innerHTML = state.trials.map(t => `
    <tr class="hover:bg-slate-50 dark:hover:bg-labSlate-800/50 transition">
      <td class="py-2 px-3 font-semibold text-slate-400">#${t.id}</td>
      <td class="py-2 px-3 text-slate-500 dark:text-slate-400">${t.time}</td>
      <td class="py-2 px-3 font-mono font-medium text-clinicalBlue-600 dark:text-clinicalBlue-400">${t.temp}</td>
      <td class="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">${t.delay}</td>
      <td class="py-2 px-3 font-mono font-bold text-rose-600 dark:text-rose-400">${t.damage}</td>
      <td class="py-2 px-3 text-[11px] font-medium text-slate-600 dark:text-slate-300">${t.assessment}</td>
    </tr>
  `).join('');
}

function exportCsv() {
  if (state.trials.length === 0) {
    showToast('No trial records to export. Please run a test first.', 'warning');
    return;
  }

  let csv = `Subject ID: ${state.subject.id}\nTest Site: ${state.subject.site}\nDate: ${new Date().toLocaleDateString()}\n\n`;
  csv += 'Trial #,Time,Trigger Temp,Reflex Delay,Nerve Impairment (%),Clinical Assessment\n';

  state.trials.forEach(t => {
    csv += `"${t.id}","${t.time}","${t.temp}","${t.delay}","${t.damage}","${t.assessment}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `NeuroReflex_Report_${state.subject.id}_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Trial records exported to CSV successfully.', 'success');
}

function printClinicalReport() {
  // Populate print header
  ui.printDate.textContent = new Date().toLocaleString();
  ui.printSubjectId.textContent = state.subject.id;
  ui.printTestSite.textContent = state.subject.site;

  window.print();
}

// ============================================================================
// 10. WEBSERIAL CONNECTION (PLUG-AND-PLAY USB)
// ============================================================================
async function handleSerialToggle() {
  if (state.connMode === 'SERIAL') {
    await disconnectSerial();
    return;
  }

  if (!('serial' in navigator)) {
    showToast('Web Serial API is not supported in this browser. Please open in Google Chrome or Microsoft Edge.', 'error', 5000);
    return;
  }

  try {
    const port = await navigator.serial.requestPort();
    await port.open({ baudRate: CONFIG.BAUD_RATE });

    state.port = port;
    state.connMode = 'SERIAL';
    updateConnectionPill(true, 'USB COM (115200)');
    showToast('ESP32 connected via USB Serial at 115200 baud.', 'success');

    listenSerialStream(port);
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      showToast(`Serial error: ${err.message}`, 'error');
    }
  }
}

async function listenSerialStream(port) {
  const textDecoder = new TextDecoderStream();
  port.readable.pipeTo(textDecoder.writable);
  state.reader = textDecoder.readable.getReader();

  let lineBuffer = '';

  try {
    while (true) {
      const { value, done } = await state.reader.read();
      if (done) break;

      lineBuffer += value;
      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop();

      for (const line of lines) {
        parseIncomingLine(line);
      }
    }
  } catch (err) {
    console.debug('Serial read end:', err);
  } finally {
    disconnectSerial();
  }
}

async function disconnectSerial() {
  try {
    if (state.reader) {
      await state.reader.cancel();
      state.reader = null;
    }
    if (state.port) {
      await state.port.close();
      state.port = null;
    }
  } catch (e) {
    console.debug('Port close notice:', e);
  }
  state.connMode = 'DISCONNECTED';
  updateConnectionPill(false);
  showToast('ESP32 Serial disconnected.', 'info');
}

function updateConnectionPill(connected, label = '') {
  if (connected) {
    ui.statusDot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-500 live-pulse';
    ui.statusLabel.textContent = label;
    ui.statusLabel.className = 'text-emerald-600 dark:text-emerald-400 font-semibold';
    ui.connectBtnText.textContent = 'Disconnect';
    ui.btnConnectSerial.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-sm transition-all';
  } else {
    ui.statusDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-400';
    ui.statusLabel.textContent = 'Port Disconnected';
    ui.statusLabel.className = 'text-slate-600 dark:text-slate-300 font-medium';
    ui.connectBtnText.textContent = 'Connect USB';
    ui.btnConnectSerial.className = 'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-clinicalBlue-600 hover:bg-clinicalBlue-700 text-white font-medium text-xs shadow-sm transition-all';
  }
}

// ============================================================================
// 11. DEMONSTRATION & VIVA TRIAL SIMULATOR
// ============================================================================
function toggleSimulation() {
  if (state.connMode === 'SIMULATOR') {
    stopSimulation();
  } else {
    if (state.connMode === 'SERIAL') disconnectSerial();
    startSimulation();
  }
}

function startSimulation() {
  state.connMode = 'SIMULATOR';
  updateConnectionPill(true, 'Demonstration Mode');
  ui.simBtnLabel.textContent = 'Stop Demo';
  ui.btnSimulate.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white font-semibold text-xs transition';
  showToast('Demonstration mode active. Ready for viva presentation.', 'info');

  appendConsole('System Initialized: Monitoring Neuropathy & Ischemia');
  appendConsole('----------------------------------------------');

  let tick = 0;
  state.simTimer = setInterval(() => {
    tick++;

    // Simulate biological baseline with minor noise
    if (state.electrodesConnected) {
      const base = 2048;
      const noise = (Math.random() - 0.5) * 60;
      const muscleTwitch = (tick % 7 === 0) ? (Math.random() * 600 - 300) : 0;
      state.emgRaw = Math.min(4095, Math.max(0, Math.round(base + noise + muscleTwitch)));
    }

    const simLine = `EMG: ${state.electrodesConnected ? state.emgRaw : 'DISCONNECTED'}  |  Skin Temp: ${state.tempC.toFixed(2)} °C`;
    parseIncomingLine(simLine);
  }, 1000);
}

function stopSimulation() {
  if (state.simTimer) {
    clearInterval(state.simTimer);
    state.simTimer = null;
  }
  state.connMode = 'DISCONNECTED';
  updateConnectionPill(false);
  ui.simBtnLabel.textContent = 'Simulate Trial';
  ui.btnSimulate.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-medium transition';
  showToast('Demonstration mode stopped.', 'info');
}

function simulateColdTrigger() {
  if (state.connMode !== 'SIMULATOR') {
    startSimulation();
  }
  state.tempC = 23.8;
  appendConsole('>> [SIMULATION] Cold stimulus applied. Temperature dropped to 23.8°C');
  parseIncomingLine('Warning: Low Temp! Motor ON. Waiting for patient reflex...');
}

function simulatePatientButton() {
  if (!state.alarmActive) {
    showToast('Alarm is not active. Click "Trigger Cold" first to start a trial.', 'warning');
    return;
  }

  const elapsedMs = Date.now() - state.alarmStartTime;
  const elapsedSec = Math.max(1, Math.floor(elapsedMs / 1000));

  // Compute damage using the exact formula from Arduino code
  let damage = 0;
  if (elapsedSec > 5) {
    const netDelay = elapsedSec - 5;
    damage = Math.floor(netDelay / 5) * 5;
  }
  if (damage > 100) damage = 100;

  appendConsole('====================================');
  appendConsole('Patient Button Pressed!');
  appendConsole(`Reflex Delay Time: ${elapsedSec} seconds`);
  appendConsole(`Calculated Nerve Damage: ${damage}%`);
  appendConsole('Motor Stopped. Waiting for temperature normalization to re-arm...');
  appendConsole('====================================');

  parseIncomingLine('Patient Button Pressed!');
  parseIncomingLine(`Reflex Delay Time: ${elapsedSec} seconds`);
  parseIncomingLine(`Calculated Nerve Damage: ${damage}%`);

  // Simulate physiological re-warming after 4 seconds
  setTimeout(() => {
    state.tempC = 27.4;
    parseIncomingLine('Temperature Normalized! System re-armed for next test.');
  }, 4000);
}

// ============================================================================
// 12. WI-FI & WEBSOCKET DRIVER
// ============================================================================
function connectWebSocket(ip) {
  try {
    const wsUrl = `ws://${ip}:81/`;
    showToast(`Attempting WebSocket connection to ${ip}...`, 'info');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      state.ws = ws;
      state.connMode = 'WIFI';
      updateConnectionPill(true, `Wi-Fi (${ip})`);
      showToast(`Connected to ESP32 over Wi-Fi (${ip})`, 'success');
    };

    ws.onmessage = (event) => {
      parseIncomingLine(event.data);
    };

    ws.onerror = (e) => {
      showToast(`Could not connect to WebSocket at ${ip}`, 'error');
    };

    ws.onclose = () => {
      if (state.connMode === 'WIFI') {
        state.connMode = 'DISCONNECTED';
        updateConnectionPill(false);
        showToast('Wi-Fi WebSocket disconnected.', 'info');
      }
    };
  } catch (err) {
    showToast(`Connection error: ${err.message}`, 'error');
  }
}

// ============================================================================
// 13. EVENT WIRING & INITIALIZATION
// ============================================================================
function setupEventListeners() {
  // Serial Connect
  ui.btnConnectSerial.addEventListener('click', handleSerialToggle);

  // Simulation
  ui.btnSimulate.addEventListener('click', toggleSimulation);
  ui.btnTriggerColdSim.addEventListener('click', simulateColdTrigger);
  ui.btnPressButtonSim.addEventListener('click', simulatePatientButton);

  // Trace Controls
  ui.btnFreezeTrace.addEventListener('click', () => {
    state.isPaused = !state.isPaused;
    ui.freezeBtnText.textContent = state.isPaused ? 'Resume Trace' : 'Freeze Trace';
    ui.btnFreezeTrace.className = state.isPaused
      ? 'px-2.5 py-1 text-xs rounded-md bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 flex items-center gap-1 transition'
      : 'px-2.5 py-1 text-xs rounded-md bg-slate-100 hover:bg-slate-200 dark:bg-labSlate-800 dark:hover:bg-labSlate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-labSlate-700 flex items-center gap-1 transition';
    playTone('click');
  });

  ui.btnResetTrace.addEventListener('click', () => {
    state.emgHistory = new Array(CONFIG.EMG_WINDOW_SIZE).fill(2048);
    state.tempHistory = new Array(CONFIG.TEMP_WINDOW_SIZE).fill(27.0);
    if (emgChart) {
      emgChart.data.datasets[0].data = [...state.emgHistory];
      emgChart.update();
    }
    if (tempChart) {
      tempChart.data.datasets[0].data = [...state.tempHistory];
      tempChart.update();
    }
    playTone('click');
    showToast('Trace buffers reset.', 'info');
  });

  // Theme Switcher (Clinical Light <-> Lab Dark)
  ui.btnToggleTheme.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark');
    state.darkMode = isDark;
    ui.themeIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
    if (window.lucide) lucide.createIcons();
    updateChartTheme();
    playTone('click');
  });

  // Sound Mute Toggle
  ui.btnToggleMute.addEventListener('click', () => {
    state.soundMuted = !state.soundMuted;
    ui.soundIcon.setAttribute('data-lucide', state.soundMuted ? 'volume-x' : 'volume-2');
    ui.btnToggleMute.className = state.soundMuted
      ? 'p-2 rounded-lg bg-slate-200 dark:bg-labSlate-700 text-slate-400 border border-slate-300 dark:border-labSlate-600 transition'
      : 'p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-labSlate-800 dark:hover:bg-labSlate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-labSlate-700 transition';
    if (window.lucide) lucide.createIcons();
    if (!state.soundMuted) playTone('click');
  });

  // Table & Report Actions
  ui.btnPrintReport.addEventListener('click', printClinicalReport);
  ui.btnExportCsv.addEventListener('click', exportCsv);
  ui.btnClearTable.addEventListener('click', () => {
    state.trials = [];
    renderTrialTable();
    showToast('Trial history cleared.', 'info');
  });

  // Terminal Toggle
  let terminalOpen = true;
  ui.btnToggleTerminal.addEventListener('click', () => {
    terminalOpen = !terminalOpen;
    ui.serialConsoleBox.classList.toggle('hidden', !terminalOpen);
    ui.terminalChevron.style.transform = terminalOpen ? 'rotate(0deg)' : 'rotate(180deg)';
  });

  // Subject Details Modal
  ui.btnEditSubject.addEventListener('click', () => {
    ui.inputSubjectId.value = state.subject.id;
    ui.selectTestSite.value = state.subject.site;
    ui.subjectModal.classList.remove('hidden');
  });
  ui.btnCloseSubjectModal.addEventListener('click', () => ui.subjectModal.classList.add('hidden'));
  ui.btnSaveSubject.addEventListener('click', () => {
    state.subject.id = ui.inputSubjectId.value.trim() || 'PT-1042';
    state.subject.site = ui.selectTestSite.value;
    ui.subjectNameDisplay.textContent = `${state.subject.id} (${state.subject.site.split(' ')[0]})`;
    ui.subjectModal.classList.add('hidden');
    showToast(`Subject updated to ${state.subject.id}`, 'info');
  });

  // Wi-Fi Modal
  ui.btnOpenWifiModal.addEventListener('click', () => ui.wifiModal.classList.remove('hidden'));
  ui.btnCloseWifiModal.addEventListener('click', () => ui.wifiModal.classList.add('hidden'));
  ui.btnConnectWifi.addEventListener('click', () => {
    const ip = ui.inputEspIp.value.trim();
    if (!ip) return;
    ui.wifiModal.classList.add('hidden');
    connectWebSocket(ip);
  });
}

// Kickoff
window.addEventListener('load', () => {
  initCharts();
  setupEventListeners();
  updateDashboardUI();
  if (window.lucide) lucide.createIcons();
});
