#!/usr/bin/env python3
"""Reject a call APK whose bundled frontend differs from the source checkout."""
import hashlib
import json
import pathlib
import sys
import zipfile

root = pathlib.Path(__file__).resolve().parents[1]
with zipfile.ZipFile(sys.argv[1]) as apk:
    manifest = json.loads(apk.read('assets/call-web/call-build.json'))
    assert manifest['version'] == '1.3.5' and manifest['versionCode'] == 18
    for name, expected in manifest['files'].items():
        assert pathlib.PurePosixPath(name).name == name
        bundled = apk.read('assets/call-web/' + name)
        assert hashlib.sha256(bundled).hexdigest() == expected, name + ': package checksum mismatch'
        assert bundled == (root / name).read_bytes(), name + ': package differs from checkout'
    html = apk.read('assets/call-web/messages.html').decode()
    for control in ('data-call-mute', 'data-call-keypad', 'data-call-speaker', 'data-call-add',
                    'data-call-switch-mode', 'data-call-contacts', 'data-call-end', 'data-call-build'):
        assert control in html, control + ': missing from packaged screen'
    native = b''.join(apk.read(name) for name in apk.namelist() if name.endswith('.dex'))
    for obsolete in ('↔ تبديل', '⛶ تكبير'):
        assert obsolete.encode() not in native, 'obsolete native overlay remains: ' + obsolete
print(f"Verified packaged call UI {manifest['version']} ({manifest['versionCode']}), {len(manifest['files'])} files match the checkout")
