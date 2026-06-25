/**
 * FileOpen owner-permission relay.
 *
 * The editor's Protection tab (web-apps view/DocProtection.js → _notifyParent)
 * posts a `fo:savePerms` message to this page whenever the file owner toggles a
 * restriction (Restrict Editing / Printing / Save Copy). This relay persists those
 * flags to the Nextcloud database via `PUT /apps/eurooffice/ajax/fileperms`
 * (EditorController::setFilePerms → FilePermissions::set), so they survive a reload
 * and are enforced for users the file is shared with.
 *
 * Registered in templates/editor.php via Util::addScript('eurooffice','fo-fileperms').
 *
 * NOTE: /js is gitignored build output, so this hand-written file must be
 * force-added to keep it in version control:  git add -f js/fo-fileperms.js
 */
(function () {
    'use strict';

    function getFileId() {
        if (window.OCA && OCA.Eurooffice && OCA.Eurooffice.fileId) {
            return OCA.Eurooffice.fileId;
        }
        var ifr = document.querySelector('iframe[data-id]');
        return ifr ? ifr.getAttribute('data-id') : null;
    }

    function savePerms(perms) {
        var fileId = getFileId();
        if (!fileId) {
            console.warn('[fo-fileperms] no fileId available yet; cannot save permissions');
            return;
        }
        var url = OC.generateUrl('/apps/eurooffice/ajax/fileperms');
        fetch(url, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'requesttoken': (typeof OC !== 'undefined' && OC.requestToken) ? OC.requestToken : ''
            },
            body: JSON.stringify({
                fileId: parseInt(fileId, 10),
                allowPrint: perms.allowPrint !== false,
                allowDownload: perms.allowDownload !== false,
                allowEdit: perms.allowEdit !== false
            })
        }).then(function (resp) {
            return resp.json()
                .then(function (data) { return { ok: resp.ok, data: data }; })
                .catch(function () { return { ok: resp.ok, data: null }; });
        }).then(function (res) {
            if (res.ok && (!res.data || !res.data.error)) {
                console.log('[fo-fileperms] saved permissions', perms);
            } else {
                console.error('[fo-fileperms] save rejected:', res.data);
            }
        }).catch(function (err) {
            console.error('[fo-fileperms] save request failed:', err);
        });
    }

    window.addEventListener('message', function (event) {
        var data = event.data;
        if (typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return; }
        }
        if (!data || data.type !== 'fo:savePerms') {
            return;
        }
        savePerms(data);
    });

    console.log('[fo-fileperms] owner-permission relay ready');
})();
