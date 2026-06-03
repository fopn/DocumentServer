# EuroOffice Dev Environment — Team Setup Guide

Everything you need to run this fork of EuroOffice with the owner file-permission controls feature.

---

## What's in this repo

| Branch | Contents |
|--------|----------|
| `main` | Docker dev stack — compose file, nginx routing, build scripts |
| `web-apps` | Editor frontend — DocProtection owner controls (Document + Presentation editor) |
| `nextcloud-app` | Nextcloud PHP app — file-permission API, DB migration, editor config |

---

## Prerequisites

Install these before starting:

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with WSL2 backend on Windows)
- [ngrok](https://ngrok.com/download) — for a public URL the doc server can reach
- Git

---

## Step 1 — Clone the repo

```bash
git clone --recurse-submodules https://github.com/ryanmathew404/EuroOffice-Test.git
cd EuroOffice-Test
```

> **Important:** `--recurse-submodules` is required. Without it the `web-apps` folder will be empty.

---

## Step 2 — Set up the Nextcloud app

The Nextcloud PHP app (with the permission controls) lives on the `nextcloud-app` branch. Clone it separately alongside `EuroOffice-Test`:

```bash
# From the parent folder (one level above EuroOffice-Test)
git clone --branch nextcloud-app https://github.com/ryanmathew404/EuroOffice-Test.git eurooffice-nextcloud
```

Your folder structure should look like this:

```
(parent folder)/
├── EuroOffice-Test/          ← doc server fork
└── eurooffice-nextcloud/     ← nextcloud app
```

> The `docker-compose.yml` mounts `../../eurooffice-nextcloud` into the Nextcloud container, so the relative path must match exactly.

---

## Step 3 — Configure ngrok

You need a static ngrok domain (or update the URLs after getting a random one).

```bash
# Replace with your ngrok domain
ngrok http --url=YOUR-DOMAIN.ngrok-free.app 8080
```

Keep this running in its own terminal throughout development.

---

## Step 4 — Start the stack

```bash
cd EuroOffice-Test/develop
docker compose up -d
```

This starts three containers:
| Container | What | Port |
|-----------|------|------|
| `eo` | EuroOffice document server | 8080 |
| `nextcloud` | Nextcloud instance | 8081 |
| `onlyoffice` | Stock OnlyOffice (reference) | 8082 |

---

## Step 5 — Configure Nextcloud

First-time setup only (after containers are running):

1. Open `http://localhost:8081` — log in as **admin / admin**
2. Go to **Settings → EuroOffice** (admin settings)
3. Set the document server URL to your ngrok domain: `https://YOUR-DOMAIN.ngrok-free.app/`
4. Set the internal server URL to `http://eo/`
5. Set the Nextcloud server URL (for the doc server to call back) to `http://nextcloud/`
6. Save — you should see a green checkmark

---

## Step 6 — Build the editor frontend

The `web-apps` source must be compiled into `app.js` inside the running `eo` container.

```bash
# Build Document Editor
docker exec eo bash -c '/develop/recompile-de.sh'

# Build Presentation Editor
docker exec eo bash -c '/develop/recompile-pe.sh'
```

Each build takes ~60–90 seconds. You'll see `Cache tag updated: ... — done.` when finished.

> **You must re-run these after any git pull that changes files in `web-apps/`.**

---

## Step 7 — Run the DB migration

First time only — creates the `eurooffice_file_permissions` table:

```bash
docker exec nextcloud php /var/www/html/occ migrations:execute eurooffice 080000Date20260528000000
```

---

## Accessing the app

| URL | What |
|-----|------|
| `http://localhost:8081` | Nextcloud (local) |
| `https://YOUR-DOMAIN.ngrok-free.app` | Nextcloud (public, via ngrok) |
| `https://YOUR-DOMAIN.ngrok-free.app/s/<token>` | Share links |

Login: **admin / admin**

---

## The feature — owner file permissions

When a file owner opens a `.docx` or `.pptx` in the editor:

1. Click the **Protection** tab in the top toolbar
2. Three toggle buttons appear: **Allow Editing**, **Allow Printing**, **Allow Save Copy**
3. Toggling any button saves the setting immediately (per file, stored in DB)
4. Anyone the file is **shared with** will have those restrictions enforced when they open it
5. The owner always retains full access regardless of settings

---

## Stopping and restarting

```bash
# Stop (preserves all data)
docker stop eo nextcloud onlyoffice

# Restart
docker start eo nextcloud onlyoffice
```

> **Never use `docker compose down`** — it destroys the Nextcloud anonymous volume (your files, users, and permissions DB will be wiped).

---

## Troubleshooting

**Share links (`/s/...`) not working via ngrok domain**
- Check that `eo` is running: `docker ps`
- The nginx config in `develop/ds-docservice.conf` routes `/s/` to Nextcloud — make sure the container started with the mount: `docker inspect eo --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}'`

**Protection tab not showing**
- Hard-refresh the browser: `Ctrl + Shift + R`
- Make sure you ran the recompile scripts (Step 6)

**"An error occurred during the work with the document"**
- Check doc server logs: `docker exec eo bash -c 'tail -20 /var/log/euro-office/documentserver/docservice/out.log'`

**Editor not loading / WebSocket errors**
- Make sure ngrok is running and the URL in Nextcloud settings matches your ngrok domain exactly

**Stray container stealing port 8080**
```bash
docker ps -a  # find the offending container
docker rm -f <container-name>
docker start eo nextcloud onlyoffice
```
