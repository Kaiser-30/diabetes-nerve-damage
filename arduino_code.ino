// ==========================================
// PIN DEFINITIONS
// ==========================================
#define MOTOR_PIN 4        // NPN Transistor Base (Motor drive)
#define LO_MINUS_PIN 25    // AD8232 Lead Off -
#define LO_PLUS_PIN 26     // AD8232 Lead Off +
#define BUTTON_PIN 27      // 4-Leg Tactile Push Button
#define THERMISTOR_PIN 34  // KY-013 Thermistor Module Analog Out (AO)
#define EMG_OUTPUT_PIN 35  // AD8232 Analog Output

// ==========================================
// SYSTEM VARIABLES & CALIBRATION
// ==========================================
const float ISCHEMIA_THRESHOLD = 25.5; // Trigger threshold set to 25.5°C for water demo
const float TEMP_OFFSET = 7.0;         // Calibration offset to match room temperature (~27°C)

// State Machine Flags
bool alarmActive = false;
bool alarmAcknowledged = false;
unsigned long alarmStartTime = 0;
unsigned long lastTelemetryPrint = 0;

void setup() {
  // Initialize Serial Monitor (Ensure baud rate is set to 115200)
  Serial.begin(115200);

  // Configure AD8232 Pins
  pinMode(LO_PLUS_PIN, INPUT);
  pinMode(LO_MINUS_PIN, INPUT);
  
  // Configure Button (using ESP32 internal pull-up resistor)
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  
  // Configure Motor Pin
  pinMode(MOTOR_PIN, OUTPUT);
  digitalWrite(MOTOR_PIN, LOW); // Ensure motor is off at boot
  
  Serial.println("System Ready: Monitoring Neuropathy & Ischemia");
  Serial.println("----------------------------------------------");
}

void loop() {
  // ==========================================
  // 1. COMBINED TELEMETRY LOOP (1Hz - Every 1 Second)
  // ==========================================
  if (millis() - lastTelemetryPrint > 1000) {
    
    // Check if electrodes are physically connected
    bool electrodesConnected = true;
    if ((digitalRead(LO_PLUS_PIN) == 1) || (digitalRead(LO_MINUS_PIN) == 1)) {
      electrodesConnected = false;
    }

    int emgValue = 0;
    if (electrodesConnected) {
      // Take multiple fast samples over 50ms and average them to remove noise spikes
      long emgSum = 0;
      int validSamples = 0;
      for (int i = 0; i < 20; i++) {
        int rawVal = analogRead(EMG_OUTPUT_PIN);
        // Ignore rail saturation spikes (0 or 4095) caused by motion/noise
        if (rawVal > 10 && rawVal < 4085) {
          emgSum += rawVal;
          validSamples++;
        }
        delay(2);
      }
      
      if (validSamples > 0) {
        emgValue = emgSum / validSamples; // Clean averaged EMG value
      } else {
        emgValue = analogRead(EMG_OUTPUT_PIN); // Fallback if all samples hit rail
      }
    }

    // Read Temperature
    int adcTemp = analogRead(THERMISTOR_PIN);
    float voltage = adcTemp * (3.3 / 4095.0);
    float tempC = 0.0;
    
    if (voltage > 0) {
      float resistance = 10000.0 * voltage / (3.3 - voltage);
      float tempC_raw = resistance / 10000.0;
      tempC_raw = log(tempC_raw);
      tempC_raw /= 3950.0;
      tempC_raw += 1.0 / (25.0 + 273.15);
      tempC_raw = 1.0 / tempC_raw;
      tempC_raw -= 273.15; 
      tempC = tempC_raw - TEMP_OFFSET; // Apply calibration offset
    }

    // --- PRINT CLEAN TELEMETRY ---
    Serial.print("EMG: ");
    if (!electrodesConnected) {
      Serial.print("DISCONNECTED");
    } else {
      Serial.print(emgValue);
    }
    Serial.print("  |  Skin Temp: ");
    Serial.print(tempC);
    Serial.println(" °C");

    // --- SYSTEM RE-ARMING ---
    if (alarmAcknowledged) {
      if (tempC >= ISCHEMIA_THRESHOLD) {
        Serial.println("Temperature Normalized! System re-armed for next test.");
        alarmAcknowledged = false; 
      }
    }

    // --- TRIGGER ALARM: ISCHEMIA DETECTED ---
    if (tempC < ISCHEMIA_THRESHOLD && tempC > 0.0) {
      if (!alarmActive && !alarmAcknowledged) {
        alarmActive = true;
        alarmStartTime = millis();      
        digitalWrite(MOTOR_PIN, HIGH);  
        Serial.println("Warning: Low Temp! Motor ON. Waiting for patient reflex...");
      }
    }

    lastTelemetryPrint = millis();
  }

  // ==========================================
  // 2. REFLEX LATENCY & DAMAGE CALCULATION
  // ==========================================
  if (alarmActive) {
    unsigned long activeTimeMs = millis() - alarmStartTime;
    int activeTimeSec = activeTimeMs / 1000;

    if (digitalRead(BUTTON_PIN) == LOW) {
      int nerveDamage = 0; 
      if (activeTimeSec > 5) {
        int netDelaySec = activeTimeSec - 5;
        nerveDamage = (netDelaySec / 5) * 5; 
      }
      if (nerveDamage > 100) {
        nerveDamage = 100;
      }

      digitalWrite(MOTOR_PIN, LOW); 
      
      Serial.println("====================================");
      Serial.print("Patient Button Pressed!\n");
      Serial.print("Reflex Delay Time: ");
      Serial.print(activeTimeSec);
      Serial.println(" seconds");
      Serial.print("Calculated Nerve Damage: ");
      Serial.print(nerveDamage);
      Serial.println("%");
      Serial.println("Motor Stopped. Waiting for temperature normalization to re-arm...");
      Serial.println("====================================");

      alarmActive = false;
      alarmAcknowledged = true; 
      delay(1000);              
    }
    else if (activeTimeSec >= 105) {
      digitalWrite(MOTOR_PIN, LOW); 
      
      Serial.println("====================================");
      Serial.println("TIMEOUT ALARM: No Patient Response");
      Serial.println("Reflex Delay Time: 105+ seconds");
      Serial.println("Calculated Nerve Damage: 100% (Severe Sensory Loss)");
      Serial.println("Motor Auto-Stopped. Waiting for temperature normalization to re-arm...");
      Serial.println("====================================");

      alarmActive = false;
      alarmAcknowledged = true; 
    }
  }

  delay(10); 
}

