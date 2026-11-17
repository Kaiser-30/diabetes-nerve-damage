# 🩺 NeuroScan IoT — Real-Time Telemetry Dashboard
### Diabetic Neuropathy & Peripheral Ischemia Diagnostic Monitoring System
**PRBL Semester 5 Engineering Project**

---

## 🌟 Overview
This web application provides a real-time clinical monitoring dashboard for your ESP32 system. It connects directly to your ESP32 via **USB Web Serial** (in Chrome/Edge) or **Wi-Fi / WebSockets**, visualizing:

1. **Skin Temperature & Ischemia Alert** (KY-013 Thermistor on GPIO 34)
   - Real-time °C and °F gauge
   - Visual alarm banner when temperature drops below **25.5°C**
2. **Real-Time EMG Muscle Activity Oscilloscope** (AD8232 on GPIO 35)
   - Continuous waveform display on a biomedical ECG grid
   - Lead-Off detection (LO+ on GPIO 26, LO- on GPIO 25)
3. **Stimulator Motor Status** (NPN Transistor on GPIO 4)
   - Pulsing / vibrating indicator when ischemia stimulus is active
4. **Reflex Latency & Nerve Damage Assessment** (Push Button on GPIO 27)
   - Stopwatch tracking patient response time
   - Automatic percentage nerve damage computation (`0%` to `100%`)
   - Clinical severity classification (Normal, Mild, Moderate, Severe, Critical Loss)
5. **Live ESP32 Serial Terminal** (115200 Baud)
6. **Clinical Record Keeping & CSV Export**
7. **Offline Demo / Simulation Mode** (For viva, presentations, or testing without hardware)

---

## 🚀 How to Run the Website

### Method 1: Instant Browser Launch (Recommended)
1. Open Google Chrome, Microsoft Edge, or Opera.
2. Double-click `index.html` (or right-click `index.html` > **Open with Google Chrome**).
3. Connect your ESP32 to your PC via USB.
4. Click the cyan **"Connect ESP32 (USB)"** button in the top navigation bar.
5. In the browser popup, select your ESP32 COM port and click **Connect**.
6. The dashboard will immediately start plotting live telemetry!

> **Note:** Web Serial API is natively supported in Chromium-based desktop browsers (Chrome, Edge, Opera, Brave).

### Method 2: Local HTTP Server (Optional)
If you prefer running a local server:
```powershell
# Using Python:
python -m http.server 3000
# Then open http://localhost:3000 in Chrome/Edge

# OR using Node.js:
npx serve .
```

---

## 🔌 Hardware Pinout Reference (ESP32 38-Pin)

| Hardware Component | ESP32 Pin | Mode | Purpose |
| :--- | :--- | :--- | :--- |
| **Vibration Motor (NPN Base)** | `GPIO 4` | `OUTPUT` | Tactile stimulus upon cold/ischemia detection |
| **AD8232 Lead-Off Minus (LO-)** | `GPIO 25` | `INPUT` | Electrode disconnection check |
| **AD8232 Lead-Off Plus (LO+)** | `GPIO 26` | `INPUT` | Electrode disconnection check |
| **Patient Tactile Push Button** | `GPIO 27` | `INPUT_PULLUP` | Patient response trigger (Active LOW) |
| **KY-013 Thermistor (AO)** | `GPIO 34` | `ANALOG INPUT` | Skin temperature measurement |
| **AD8232 EMG Analog Out** | `GPIO 35` | `ANALOG INPUT` | Muscle biopotential measurement |

---

## 🧮 Nerve Damage Calculation Formula
As programmed in your Arduino firmware:
- If reflex delay is $\le 5$ seconds: **$0\%$ Damage (Normal)**
- If reflex delay is $> 5$ seconds:
  $$\text{Nerve Damage (\%)} = \left(\frac{\text{Delay} - 5}{5}\right) \times 5\%$$
- If delay $\ge 105$ seconds (Timeout): **$100\%$ Sensory Loss**

---

## 🧪 Demonstration / Viva Features
- **Demo Simulation Button**: Lets you preview the entire clinical workflow without plugging in any hardware.
- **Trigger Cold/Ischemia Button**: Simulates temperature dropping below 25.5°C, turning on the motor and starting the reflex timer.
- **Press Patient Button**: Simulates patient pressing the switch, calculates delay and nerve damage, and records the test to the table.
- **Export CSV Button**: Downloads a clinical test report spreadsheet for lab records and semester 5 documentation.

