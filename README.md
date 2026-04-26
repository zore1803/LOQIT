---
title: LOQIT
emoji: 🛡️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# <div align="center">LOQIT: Next-Gen Phone Recovery Protocol</div>

<div align="center">
  <img src="./assets/icon.png" alt="LOQIT logo" width="140" />
</div>

<div align="center">

![Platform](https://img.shields.io/badge/Platform-Mobile%20%2B%20Web-2563eb?style=for-the-badge)
![Backend](https://img.shields.io/badge/Backend-Supabase-16a34a?style=for-the-badge)
![Security](https://img.shields.io/badge/Security-Android%2014%2B%20Lockdown-7c3aed?style=for-the-badge)
![Stealth](https://img.shields.io/badge/Stealth-Ghost%20Rotation-ec4899?style=for-the-badge)

</div>

<p align="center">
  <b>LOQIT</b> is an enterprise-grade, anti-theft and recovery ecosystem. It transforms devices into resilient "Ghost Beacons" that can be recovered even when offline, while proactively preventing unauthorized factory resets and power-offs.
</p>

---

## 🛡️ Core Security Architecture

### 1. Persistent Hardware Lockdown (Resilience Suite)
LOQIT integrates directly with the Android **Device Policy Manager** to secure hardware:
- **Anti-Reset Protocol**: Grays out and disables the "Factory Reset" option in system settings.
- **Power Block**: Custom background service that intercepts the power menu, preventing thieves from turning off the device to hide its location.
- **Tamper Detection**: Triggers immediate GPS snapshots and owner alerts if an attempt to remove the SIM or enter Recovery Mode is detected.

### 2. Stealth "Ghost" Beacons (Privacy-First Recovery)
When marked as `lost`, a device becomes a "Moving Target":
- **15-Minute Token Rotation**: The BLE advertising ID (UUID) changes every 15 minutes using a time-based cryptographic hash.
- **Tracker-Proof**: Unauthorized BLE scanners cannot track the device, but the **LOQIT Scout Network** can instantly "De-Scramble" the ID to identify the owner.
- **Offline Mesh**: Nearby LOQIT users (Scouts) act as anonymous relays, reporting the encrypted sighting to Supabase without needing the lost device to have active internet.

### 3. Android 14+ Intelligence
Full compatibility with modern Android foreground service requirements:
- **Service Types**: Optimized usage of `connectedDevice`, `location`, and `specialUse` tags.
- **Background Persistence**: High-priority foreground services ensure LOQIT stays alive even during extreme battery saving or system idle states.

---

## 🚀 Key Features

- **Passive Mesh Tracking**: Every LOQIT user is part of a global recovery mesh.
- **Police Intelligence Terminal**: A web-based command center for law enforcement with real-time "Red Alert" GPS tracking.
- **Hardware Identification**: Link devices via Serial Number with Aadhaar-backed ownership.
- **Anonymous Recovery Chat**: Coordinated, end-to-end encrypted chat between finders and owners.

---

## 🛠 Tech Stack

### Frontend & Mobile
- **Mobile**: Expo SDK 55 + React Native (Native Android Hooks)
- **Web Portal**: Vite 5 + React 18 (Real-time Dashboard)
- **Native Logic**: Kotlin-based Security Modules (`ADMIN_RECEIVER`).

### Backend Engineering
- **Engine**: Supabase (Postgres + Realtime + RLS).
- **Communication**: N8N Automation + Twilio SMS.
- **Security**: Row-Level Security (RLS) policies for all device data.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- Android Studio (for Native Builds)
- **Device Owner Access**: Required for full reset protection.
  ```bash
  adb shell dpm set-device-owner com.loqit.app/.AdminReceiver
  ```

### 1. Installation
```bash
git clone https://github.com/zore1803/LOQIT.git
cd LOQIT
npm install
cd web && npm install
```

### 2. Deployment
- **Web**: `cd web && npm run dev`
- **Mobile**: `npm run android` (Requires Development Build for Native Modules)

---

## 🔐 Privacy Policy
LOQIT leverages "Privacy by Design":
- **Masked Identity**: Identity is never broadcasted over BLE; only rotating tokens are used.
- **Scout Anonymity**: Users reporting devices remain 100% anonymous; their own data is never exposed.

---

## 📜 License
© 2026 LOQIT. All Rights Reserved. Building the future of secure device recovery.
