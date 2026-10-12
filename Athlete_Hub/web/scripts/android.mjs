// One-step Android preview: `npm run android` (or `npm run android -- Pixel_6a` to pick an emulator,
// or `npm run android:phone` to use only a USB-connected phone).
//
// 1. Starts the .NET API (port 5007) and the phone build of the web app (port 4173) unless they are
//    already running.
// 2. Uses a plugged-in Android phone (USB debugging on) or starts an Android Studio emulator.
// 3. Links the device's "localhost:4173" to this PC with `adb reverse`, so Chrome treats the app as
//    secure and offers the full "Install app" option, then opens the app in the device's browser.
//
// Press Ctrl+C to stop the servers this script started. The emulator is left open.

import { execFile, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const webDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiDir = path.resolve(webDir, '..', 'backend', 'AthleteHub.API')
const WEB_PORT = 4173
const API_PORT = 5007
const APP_URL = `http://localhost:${WEB_PORT}`
const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk')]
  .find((dir) => dir && existsSync(dir))
const exe = process.platform === 'win32' ? '.exe' : ''
const adbPath = sdk && path.join(sdk, 'platform-tools', `adb${exe}`)
const emulatorPath = sdk && path.join(sdk, 'emulator', `emulator${exe}`)
const started = []

const step = (message) => console.log(`\n\x1b[1m▶ ${message}\x1b[0m`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const adb = async (...args) => (await run(adbPath, args)).stdout.trim()

function fail(message) {
  console.error(`\n\x1b[31m✖ ${message}\x1b[0m`)
  stopStarted()
  process.exit(1)
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => { socket.destroy(); resolve(true) })
    socket.once('error', () => resolve(false))
  })
}

async function waitFor(check, seconds, what) {
  for (let i = 0; i < seconds; i++) {
    if (await check()) return
    await sleep(1000)
  }
  fail(`Timed out waiting for ${what}.`)
}

/** Runs a long-lived command, prefixing its output so the API and web logs stay readable. */
function startServer(label, command, cwd) {
  const child = spawn(command, { cwd, shell: true })
  const prefix = (data) => data.toString().split(/\r?\n/).filter(Boolean).forEach((line) => console.log(`[${label}] ${line}`))
  child.stdout.on('data', prefix)
  child.stderr.on('data', prefix)
  child.on('exit', (code) => { if (code) console.log(`[${label}] exited with code ${code}`) })
  started.push(child)
  return child
}

function stopStarted() {
  for (const child of started) {
    if (child.exitCode !== null) continue
    if (process.platform === 'win32') spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    else child.kill('SIGTERM')
  }
}

process.on('SIGINT', () => { console.log('\nStopping the servers started by this script…'); stopStarted(); process.exit(0) })

// ---------------------------------------------------------------- servers

step('API (port 5007)')
if (await portOpen(API_PORT)) {
  console.log('Already running — using it.')
} else {
  startServer('api', 'dotnet run', apiDir)
  await waitFor(() => portOpen(API_PORT), 180, 'the API to start')
  console.log('API is up.')
}

step('Web app, phone build (port 4173)')
if (await portOpen(WEB_PORT)) {
  console.log('Already running — using it. (Restart it with `npm run phone` if you changed the code.)')
} else {
  startServer('web', `npm run phone -- --port ${WEB_PORT} --strictPort`, webDir)
  await waitFor(() => portOpen(WEB_PORT), 180, 'the web app to build and start')
  console.log('Web app is up.')
}

// ---------------------------------------------------------------- device

step('Android device')
if (!adbPath || !existsSync(adbPath)) fail('Android SDK not found. Install Android Studio (it includes the SDK) or set ANDROID_HOME.')

// `npm run android -- phone` uses only a USB-connected phone and never starts the emulator.
const phoneOnly = process.argv[2]?.toLowerCase() === 'phone'
const listDevices = async () => (await adb('devices')).split(/\r?\n/).slice(1)
  .map((line) => line.trim().split(/\s+/))
  .filter(([serial, state]) => serial && state)
  .map(([serial, state]) => ({ serial, state, physical: !serial.startsWith('emulator-') }))
const readyPhone = (devices) => devices.find((device) => device.physical && device.state === 'device')
const connectedDevices = async () => (await listDevices()).filter((device) => device.state === 'device')

const PHONE_SETUP = `  Your phone is not connected for debugging yet. On the phone (realme / Android):
    1. Settings → About device → Version → tap "Build number" 7 times (enter your PIN if asked).
    2. Settings → Additional settings → Developer options → turn on "USB debugging".
    3. Plug the phone into this laptop with a data cable and unlock it.
    4. When "Allow USB debugging?" appears, tick "Always allow from this computer" and tap Allow.
  If nothing appears, pull down the notification for the USB connection and choose "File transfer".
  Waiting for the phone…`

/** Waits for a USB phone, telling the user when it is waiting for them to tap "Allow". */
async function waitForPhone(seconds) {
  let askedToAllow = false
  await waitFor(async () => {
    const devices = await listDevices()
    if (!askedToAllow && devices.some((device) => device.physical && device.state === 'unauthorized')) {
      askedToAllow = true
      console.log('  Your phone is asking "Allow USB debugging?" — unlock it, tick "Always allow from this computer", and tap Allow.')
    }
    return Boolean(readyPhone(devices))
  }, seconds, 'your phone (see the steps above)')
  return readyPhone(await listDevices())
}

const devices = await listDevices()
let target = readyPhone(devices)
if (!target && devices.some((device) => device.physical && device.state === 'unauthorized')) target = await waitForPhone(120)
if (!target && phoneOnly) {
  console.log(PHONE_SETUP)
  target = await waitForPhone(300)
}
if (!target) target = devices.find((device) => device.state === 'device')

if (target) {
  const model = target.physical ? (await adb('-s', target.serial, 'shell', 'getprop', 'ro.product.model').catch(() => '')) : ''
  console.log(target.physical ? `Using your phone${model ? ` (${model})` : ''}.` : `Using the running emulator (${target.serial}).`)
} else {
  console.log('No phone connected — using the emulator. (For your phone: plug it in with USB debugging on, or run `npm run android:phone`.)')
  const avds = (await run(emulatorPath, ['-list-avds'])).stdout.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('INFO'))
  if (!avds.length) fail('No emulator found. In Android Studio open Device Manager and create a virtual phone first.')
  const wanted = process.argv[2]
  const avd = wanted ? avds.find((name) => name.toLowerCase() === wanted.toLowerCase()) : avds[0]
  if (!avd) fail(`No emulator named "${wanted}". Available: ${avds.join(', ')}`)
  console.log(`Starting emulator "${avd}" (available: ${avds.join(', ')}). The first boot can take a minute or two…`)
  const emulator = spawn(emulatorPath, ['-avd', avd], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] })
  let emulatorLog = ''
  const collect = (data) => { emulatorLog = (emulatorLog + data.toString()).slice(-4000) }
  emulator.stdout.on('data', collect)
  emulator.stderr.on('data', collect)
  let emulatorExited = false
  emulator.on('exit', () => { emulatorExited = true })
  emulator.unref()
  await waitFor(async () => {
    if (emulatorExited) {
      const fatal = emulatorLog.split(/\r?\n/).find((line) => line.includes('FATAL')) || emulatorLog.trim().split(/\r?\n/).pop() || 'no output'
      if (emulatorLog.includes('Failed to process .ini file')) {
        fail(`The emulator could not read its settings in ${path.join(process.env.USERPROFILE || '~', '.android')} (Windows permissions).
  Fix: open PowerShell as Administrator and run:
    takeown /F "${path.join(process.env.USERPROFILE || '', '.android')}" /R /D Y
    icacls "${path.join(process.env.USERPROFILE || '', '.android')}" /reset /T
  Then run this again. (Emulator said: ${fatal.trim()})`)
      }
      fail(`The emulator closed while starting: ${fatal.trim()}`)
    }
    return (await connectedDevices()).length > 0
  }, 180, 'the emulator to appear')
  target = (await connectedDevices())[0]
}
const serial = target.serial
await waitFor(async () => {
  try { return (await adb('-s', serial, 'shell', 'getprop', 'sys.boot_completed')) === '1' } catch { return false }
}, 300, 'Android to finish booting')
console.log('Device is ready.')

// ---------------------------------------------------------------- open the app

step('Opening Athlete-Hub on the device')
await adb('-s', serial, 'reverse', `tcp:${WEB_PORT}`, `tcp:${WEB_PORT}`)

// A restored emulator often comes back asleep behind the lock screen, still showing the last app used.
const shell = (...args) => adb('-s', serial, 'shell', ...args).catch(() => '')
await shell('input', 'keyevent', 'KEYCODE_WAKEUP')
await shell('wm', 'dismiss-keyguard')
await shell('input', 'keyevent', 'KEYCODE_MENU')

const hasChrome = (await shell('pm', 'list', 'packages', 'com.android.chrome')).includes('com.android.chrome')
if (hasChrome && serial.startsWith('emulator-')) {
  // Emulators only: skip Chrome's first-run "Welcome / sign in" screens so the app opens directly.
  // Chrome reads this testing flag file when it is the debug app; real phones are left untouched.
  await shell('am', 'set-debug-app', '--persistent', 'com.android.chrome')
  await shell('echo "_ --disable-fre --no-default-browser-check --no-first-run" > /data/local/tmp/chrome-command-line')
  await shell('am', 'force-stop', 'com.android.chrome')
}
const open = ['-s', serial, 'shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', APP_URL]
await adb(...(hasChrome ? [...open, 'com.android.chrome'] : open))

console.log(`
\x1b[32m✔ Athlete-Hub is open on the device at ${APP_URL}\x1b[0m
  • ${target.physical ? 'Unlock your phone if it is locked — the app is open in Chrome. ' : ''}Sign in with a test account (password Seed123!).
  • To install it like an app: tap your initials (top right) → "Install app on this phone",
    or Chrome's ⋮ menu → "Add to Home screen".
  • On a real phone, if Chrome shows its welcome screen first, finish it, then run this again.
${started.length ? '\nKeep this window open while testing. Press Ctrl+C to stop the servers this script started.' : ''}`)
if (!started.length) process.exit(0)
