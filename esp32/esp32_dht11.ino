/*
  Stasiun Suhu — ESP32 + DHT11
  - Baca suhu & kelembaban tiap 1 jam, kirim ke API custom (POST /api/readings)
  - Kirim heartbeat tiap 2 menit (POST /api/heartbeat) biar indikator "online"
    di web UI real-time, terpisah dari data jam-an
  - Butuh library: "DHT sensor library" by Adafruit (+ "Adafruit Unified Sensor")

  Pasang di Library Manager Arduino IDE:
    - DHT sensor library
    - Adafruit Unified Sensor
*/

#include <WiFi.h>
#include <HTTPClient.h>
#include <DHT.h>

// ---------- KONFIGURASI — ganti sesuai punya lu ----------
const char* WIFI_SSID     = "NAMA_WIFI";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

const char* API_BASE   = "https://nama-project-lu.vercel.app"; // tanpa trailing slash
const char* API_KEY    = "ganti-dengan-secret-acak-yang-panjang"; // sama dgn DEVICE_API_KEY di Vercel
const char* DEVICE_ID  = "esp32-dht11-01";

#define DHTPIN  4        // pin data DHT11 (sesuaikan wiring)
#define DHTTYPE DHT11

const unsigned long READING_INTERVAL_MS   = 60UL * 60UL * 1000UL; // 1 jam
const unsigned long HEARTBEAT_INTERVAL_MS = 2UL * 60UL * 1000UL;  // 2 menit
// -----------------------------------------------------------

DHT dht(DHTPIN, DHTTYPE);

unsigned long lastReadingMs   = 0;
unsigned long lastHeartbeatMs = 0;
bool sentFirstReading = false;

void connectWiFi() {
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Menyambung ke WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.println("\nTersambung, IP: " + WiFi.localIP().toString());
}

bool postJson(const String& path, const String& jsonBody) {
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
  }

  HTTPClient http;
  String url = String(API_BASE) + path;
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", API_KEY);

  int code = http.POST(jsonBody);
  Serial.printf("POST %s -> %d\n", path.c_str(), code);
  if (code > 0) {
    Serial.println(http.getString());
  }
  http.end();
  return code >= 200 && code < 300;
}

void sendHeartbeat() {
  String body = String("{\"device_id\":\"") + DEVICE_ID + "\"}";
  postJson("/api/heartbeat", body);
}

void sendReading() {
  float suhu = dht.readTemperature();
  float kelembaban = dht.readHumidity();

  if (isnan(suhu) || isnan(kelembaban)) {
    Serial.println("Gagal baca sensor DHT11, coba lagi nanti.");
    return;
  }

  String body = String("{\"device_id\":\"") + DEVICE_ID +
                "\",\"suhu\":" + String(suhu, 1) +
                ",\"kelembaban\":" + String(kelembaban, 1) + "}";

  if (postJson("/api/readings", body)) {
    Serial.println("Data terkirim.");
  }
}

void setup() {
  Serial.begin(115200);
  dht.begin();
  connectWiFi();

  // Kirim pembacaan pertama begitu nyala, setelah itu ikut jadwal 1 jam
  delay(2000);
  sendReading();
  sendHeartbeat();
  lastReadingMs = millis();
  lastHeartbeatMs = millis();
}

void loop() {
  unsigned long now = millis();

  if (now - lastHeartbeatMs >= HEARTBEAT_INTERVAL_MS) {
    sendHeartbeat();
    lastHeartbeatMs = now;
  }

  if (now - lastReadingMs >= READING_INTERVAL_MS) {
    sendReading();
    lastReadingMs = now;
  }

  delay(1000);
}
