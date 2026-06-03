<!--
SPDX-FileCopyrightText: 2026 Euro-Office contributors
SPDX-License-Identifier: AGPL
-->

[![License](https://img.shields.io/badge/License-GNU%20AGPL%20V3-green.svg?style=flat)](https://www.gnu.org/licenses/agpl-3.0.en.html)

# EuroOffice — File Permission Controls Fork

This is a fork of [Euro-Office/DocumentServer](https://github.com/Euro-Office/DocumentServer) with a custom feature added: **file owners can control what shared users are allowed to do with their files** — directly from the editor's Protection tab.

---

## What this fork adds

Out of the box, EuroOffice (and ONLYOFFICE) let you share files but give you no control over what recipients can do with them. This fork adds a per-file permission system that lets the **file owner** restrict three actions for anyone the file is shared with:

| Control | What it does |
|---------|-------------|
| **Allow Editing** | Toggle off → shared users open the file in read-only view mode |
| **Allow Printing** | Toggle off → shared users cannot print the document |
| **Allow Save Copy** | Toggle off → shared users cannot download or save a copy |

The owner always retains full access regardless of settings. Controls are saved per-file to a database table and enforced server-side whenever a non-owner opens the file.

### Where to find the controls

Open any `.docx` or `.pptx` file you own → click the **Protection** tab in the top toolbar → the three toggle buttons appear.

Non-owners do not see these controls — they only see (and are subject to) the restrictions the owner has set.

---

## What was changed from the original EuroOffice

### Nextcloud app (`eurooffice-nextcloud`) — 6 files

| File | Change |
|------|--------|
| `lib/FilePermissions.php` *(new)* | Database layer — reads and writes per-file permissions |
| `lib/Migration/Version080000Date20260528000000.php` *(new)* | Database migration — creates the `eurooffice_file_permissions` table with `allowEdit`, `allowPrint`, `allowDownload` columns |
| `lib/Controller/EditorApiController.php` | Fixed a bug where the Protection tab never showed in Nextcloud (`isset` → `!empty` on share token check). Injects `foOwnerPerms` into the editor config for owners. Enforces the owner's restrictions for non-owners by setting `permissions.edit/print/download/copy` and switching to view mode |
| `lib/Controller/EditorController.php` | Added `getFilePerms` and `setFilePerms` API endpoints. Provides `is-owner`, `editor-file-id`, and `file-perms` as initial state to the editor page |
| `appinfo/routes.php` | Added `GET /ajax/fileperms/{fileId}` and `PUT /ajax/fileperms` routes |
| `templates/editor.php` | Loads `fo-fileperms.js` (the postMessage relay script) on the editor page |

Also added (not tracked in git — lives in the Nextcloud app's `js/` folder):
- `js/fo-fileperms.js` — listens for `fo:savePerms` postMessages from the editor iframe, calls the Nextcloud API with `OC.requestToken` (only available in the parent page context)

### Editor frontend (`web-apps`) — 7 files

| File | Change |
|------|--------|
| `apps/documenteditor/main/app/view/DocProtection.js` | Added **Allow Editing**, **Allow Printing**, **Allow Save Copy** toggle buttons for owners. Hides the standard "Protect Document" button for owners (it locks everyone including the owner). Fixed a jQuery `.find()` → `.filter()` bug that was keeping the button group hidden |
| `apps/documenteditor/main/app/controller/DocProtection.js` | Wired up click events — each toggle fires a `postMessage` to the parent Nextcloud page with the new permission state |
| `apps/presentationeditor/main/app/view/DocProtection.js` *(new)* | Ported the same owner controls to the presentation editor |
| `apps/presentationeditor/main/app/controller/DocProtection.js` *(new)* | PE controller — includes a `getDocProps()` stub so existing common controllers (Comments, Plugins, Protection, ReviewChanges) don't throw errors on document load |
| `apps/presentationeditor/main/app/controller/Toolbar.js` | Modified to show the Protection tab in the browser for owners. Originally the PE Protection tab was gated behind `isDesktopApp`, so it never appeared in a web browser |
| `apps/presentationeditor/main/app/controller/Main.js` | Calls `DocProtection.setMode()` when the editor is ready |
| `apps/presentationeditor/main/app.js` | Registers `DocProtection` as a controller |

### Dev stack — 4 files

| File | Change |
|------|--------|
| `develop/ds-docservice.conf` *(new)* | nginx routing config — the `eo` container proxies all Nextcloud paths (including `/s/` share links, `/apps/`, `/index.php`, etc.) to the `nextcloud` container, so a single public URL (ngrok) serves both |
| `develop/docker-compose.yml` | Mounts `ds-docservice.conf` into the `eo` container |
| `recompile-de.sh` *(new)* | Script to rebuild the Document Editor `app.js` inside the `eo` container without a full clean — patches the version string and rotates the nginx cache tag |
| `recompile-pe.sh` *(new)* | Same for the Presentation Editor |

---

## How it works (technical overview)

```
Owner toggles button in editor
        │
        ▼
DocProtection.js (editor iframe)
  window.parent.postMessage({ type: 'fo:savePerms', allowEdit, allowPrint, allowDownload })
        │
        ▼
fo-fileperms.js (parent Nextcloud page)
  PUT /apps/eurooffice/ajax/fileperms  ← uses OC.requestToken (only in parent context)
        │
        ▼
EditorController::setFilePerms()
  verifies caller is the file owner
  FilePermissions::set() → DB table eurooffice_file_permissions
        │
        ▼ (next time a shared user opens the file)
EditorApiController::index()
  FilePermissions::get() → reads DB
  if (!$isOwner) {
    permissions.print  = false  (if !allowPrint)
    permissions.download = false  (if !allowDownload)
    permissions.edit = false + mode = "view"  (if !allowEdit)
  }
```

---

## Setup

See **[SETUP.md](SETUP.md)** for full step-by-step instructions for running this locally.

**Quick start:**
```bash
# 1. Clone (submodules required)
git clone --recurse-submodules https://github.com/ryanmathew404/EuroOffice-Test.git

# 2. Clone the Nextcloud app alongside it
git clone --branch nextcloud-app https://github.com/ryanmathew404/EuroOffice-Test.git eurooffice-nextcloud

# 3. Start the stack
cd EuroOffice-Test/develop && docker compose up -d

# 4. Build the editors (after containers are up)
docker exec eo bash -c '/develop/recompile-de.sh'
docker exec eo bash -c '/develop/recompile-pe.sh'

# 5. Run the DB migration (first time only)
docker exec nextcloud php /var/www/html/occ migrations:execute eurooffice 080000Date20260528000000
```

See [SETUP.md](SETUP.md) for ngrok setup, Nextcloud configuration, and troubleshooting.

---

## Repository structure

| Branch | Contents |
|--------|----------|
| `main` | Docker dev stack, build scripts, this README |
| `web-apps` | Editor frontend — owner permission controls |
| `nextcloud-app` | Nextcloud PHP app — permission API and enforcement |

---

## Original project

This is a fork of [Euro-Office/DocumentServer](https://github.com/Euro-Office/DocumentServer), which is itself a fork of [ONLYOFFICE/DocumentServer](https://github.com/ONLYOFFICE/DocumentServer).
Licensed under the GNU AGPL v3.
