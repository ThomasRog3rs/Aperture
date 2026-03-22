# Aperture — LAN Hosting Setup Guide

This guide walks you through making Aperture accessible to other devices on your local network. Your server's LAN IP is currently `192.168.1.185` — replace this with your actual IP if it differs (run `ipconfig getifaddr en0` to check).

---

## Step 1 — Add a `prestart` npm script

Open `package.json` and add a `prestart` entry to the `scripts` block so the `magnetapi` Docker container is started whenever PM2 launches the app (mirroring what `predev` already does for dev mode):

```json
"prestart": "docker start magnetapi 2>/dev/null || docker run -d --name magnetapi -p 8000:8000 ghcr.io/thomasrog3rs/magnetapi:v0.1",
```

---

## Step 2 — Configure Docker to auto-restart

Make the `magnetapi` container restart automatically if Docker restarts (e.g. after a reboot):

```bash
docker update --restart unless-stopped magnetapi
```

---

## Step 3 — Create `ecosystem.config.js`

Create a file called `ecosystem.config.js` in the root of the project with the following contents:

```js
module.exports = {
  apps: [
    {
      name: "aperture",
      script: "node_modules/.bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      cwd: "/Users/tom/Developer/source/Aperture",
      env: {
        NODE_ENV: "production",
      },
      max_memory_restart: "1G",
      restart_delay: 3000,
    },
  ],
};
```

The `-H 0.0.0.0` flag tells Next.js to listen on all network interfaces (not just localhost), making it reachable from other devices on your LAN.

---

## Step 4 — Build the production bundle

Build the app for production. This only needs to be re-run when you update the code:

```bash
npm run build
```

---

## Step 5 — Reload PM2 with the new config

Stop any existing PM2 Aperture process and start it fresh with the ecosystem config:

```bash
pm2 delete aperture 2>/dev/null; pm2 start ecosystem.config.js
```

You can confirm it's running with:

```bash
pm2 list
pm2 logs aperture --lines 20
```

---

## Step 6 — Check the macOS Firewall

Go to **System Settings → Network → Firewall**. If the firewall is **off**, skip this step.

If it is **on**, you need to allow incoming connections. The easiest way is to run:

```bash
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
```

Or go to **System Settings → Network → Firewall → Options…** and add `node` manually, setting it to "Allow incoming connections".

---

## Step 7 — Save PM2 state and configure startup

Save the current PM2 process list and install the macOS launchd startup agent so PM2 (and Aperture) starts automatically after a reboot:

```bash
pm2 save
pm2 startup
```

`pm2 startup` will print a command starting with `sudo env PATH=...` — **copy and run that command** to complete the launchd installation.

---

## Step 8 — Verify from another device

From any other device on your local network, open a browser and go to:

```
http://192.168.1.185:3000
```

Test video playback — both direct play and transcoded streams should work over the LAN without any further changes.

---

## Optional — Reserve a static LAN IP

Your server's IP (`192.168.1.185`) is assigned by DHCP and could change. To make the URL permanent, log into your router's admin panel and create a **DHCP reservation** that always assigns `192.168.1.185` to this machine's MAC address. The setting is usually under "LAN" or "DHCP" → "Static Leases" / "Address Reservation".

You can find this machine's MAC address with:

```bash
ifconfig en0 | grep ether
```

---

## Quick Reference

| What | Command |
|---|---|
| Check LAN IP | `ipconfig getifaddr en0` |
| Build app | `npm run build` |
| Start with PM2 | `pm2 start ecosystem.config.js` |
| View logs | `pm2 logs aperture` |
| Restart | `pm2 restart aperture` |
| Save PM2 state | `pm2 save` |
