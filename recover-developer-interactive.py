#!/usr/bin/env python3
"""Private TTY-only wrapper; never store or echo the replacement password."""
import getpass
import json
import os
from pathlib import Path
import subprocess
import sys
import warnings


def main():
    if not sys.stdin.isatty():
        raise SystemExit('A private interactive terminal is required.')
    warnings.simplefilter('error', getpass.GetPassWarning)
    config = Path.home() / '.cl.selector/node-selector.json'
    settings = json.loads(config.read_text())['api']['env_vars']
    from urllib.parse import urlparse
    if urlparse(settings.get('MONGODB_URI', '')).username != 'shinomino_aux_service':
        raise SystemExit('SCOPED_SERVICE_ACCOUNT_REQUIRED')
    password = getpass.getpass('New developer password (12-128 characters): ')
    confirmation = getpass.getpass('Confirm new developer password: ')
    if password != confirmation or not 12 <= len(password) <= 128:
        raise SystemExit('Passwords must match and contain 12-128 characters.')
    environment = dict(os.environ)
    environment.update(MONGODB_URI=settings['MONGODB_URI'], DEVELOPER_RESET_PASSWORD=password)
    result = subprocess.run(
        [str(Path.home() / 'nodevenv/api/20/bin/node'),
         str(Path(__file__).with_name('recover-developer.cjs'))],
        cwd=Path.home() / 'api', env=environment,
        capture_output=True, text=True, timeout=45,
    )
    environment.pop('DEVELOPER_RESET_PASSWORD', None)
    del password, confirmation
    if result.returncode:
        raise SystemExit('RECOVERY_FAILED; no secret diagnostics displayed.')
    try:
        status = json.loads(result.stdout.strip().splitlines()[-1])
    except (ValueError, IndexError):
        raise SystemExit('RECOVERY_RESULT_UNCONFIRMED')
    if not (status.get('ok') and status.get('mfaPreserved') and status.get('oldSessionsRevoked')):
        raise SystemExit('RECOVERY_RESULT_UNCONFIRMED')
    print('RECOVERY_SUCCESS_MFA_PRESERVED_OLD_SESSIONS_REVOKED')
    # Remove obsolete plaintext maintenance values, preserving all service settings.
    settings = json.loads(config.read_text())['api']['env_vars']
    settings.pop('DEVELOPER_RESET_PASSWORD', None)
    settings.pop('shinomino_app', None)
    cleanup = subprocess.run(
        ['cloudlinux-selector', 'set', '--json', '--interpreter', 'nodejs',
         '--user', 'shinomin', '--app-root', 'api', '--env-vars', json.dumps(settings)],
        capture_output=True, text=True, timeout=45,
    )
    print('MAINTENANCE_ENV_CLEANUP_OK' if cleanup.returncode == 0 else 'MAINTENANCE_ENV_CLEANUP_REQUIRES_ATTENTION')


if __name__ == '__main__':
    main()
