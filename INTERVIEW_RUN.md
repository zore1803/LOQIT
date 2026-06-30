# LOQIT Interview Runbook

## One-time phone setup

1. Enable Developer options on the Android phone.
2. Enable USB debugging.
3. Connect the phone by USB and accept the "Allow USB debugging" popup.

## Install and launch the app

From this folder:

```powershell
npm run android
```

If it says no device is visible, reconnect the USB cable, unlock the phone, accept the debugging popup, then run:

```powershell
adb devices
npm run android
```

## Start the app during the interview

If the app is already installed on the phone, run:

```powershell
npm run dev
```

Then open LOQIT on the phone. Keep the terminal running while you demo.

## Useful fallback

If the app cannot connect to Metro, run:

```powershell
adb reverse tcp:8081 tcp:8081
npm run dev
```

## Already built APK

The debug APK is created here:

```text
android\app\build\outputs\apk\debug\app-debug.apk
```
