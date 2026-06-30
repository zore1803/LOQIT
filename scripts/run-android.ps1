# LOQIT Android install/run script
# Builds and launches the native Android app on a connected USB device.

$ErrorActionPreference = "Stop"

Write-Host "Starting LOQIT Android build..." -ForegroundColor Cyan

$preferredJdks = @(
  "C:\Program Files\Java\jdk-21",
  "C:\Program Files\Java\latest",
  "C:\Program Files\Android\Android Studio\jbr"
)

$validJavaHome = $preferredJdks | Where-Object { Test-Path (Join-Path $_ "bin\java.exe") } | Select-Object -First 1
if (-not $validJavaHome) {
  throw "No valid JDK found. Install Android Studio or JDK 21, then run this again."
}

$env:JAVA_HOME = $validJavaHome
$env:NODE_ENV = "development"
$env:ORG_GRADLE_PROJECT_reactNativeArchitectures = "arm64-v8a"
Write-Host "Using JAVA_HOME=$env:JAVA_HOME" -ForegroundColor Green
Write-Host "Building Android native code for arm64-v8a." -ForegroundColor Green

$devices = adb devices | Select-String -Pattern "device$"
if (-not $devices) {
  Write-Host "No Android device is visible to ADB." -ForegroundColor Red
  Write-Host "Turn on Developer options > USB debugging, reconnect USB, and accept the phone popup." -ForegroundColor Yellow
  exit 1
}

adb reverse tcp:8081 tcp:8081 | Out-Null
npx expo run:android
