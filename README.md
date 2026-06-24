# FLOW Monitoring System

## Deskripsi
FLOW Monitoring System adalah aplikasi berbasis IoT yang digunakan untuk memantau data debit/aliran air secara real-time dari sensor lapangan. Data yang dikirim oleh perangkat IoT diterima melalui MQTT Broker, diproses oleh backend, disimpan ke database, dan ditampilkan melalui dashboard monitoring.

## Fitur
- Monitoring data debit air secara real-time
- Integrasi perangkat IoT menggunakan MQTT
- Penyimpanan data ke database
- Dashboard monitoring berbasis web
- API untuk akses data monitoring

## Arsitektur Sistem

Sensor FLOW
↓
MQTT Broker
↓
Backend API
↓
Database
↓
Web Dashboard

## Teknologi yang Digunakan
- IoT Sensor
- MQTT Broker
- Backend API
- Database
- Web Dashboard

## Alur Sistem
1. Sensor membaca nilai debit air.
2. Data dikirim ke MQTT Broker.
3. Backend menerima dan memproses data.
4. Data disimpan ke database.
5. Dashboard menampilkan data monitoring secara real-time.

## Tim
Kelompok FLOW Monitoring System
Teknologi Informasi - Universitas Brawijaya