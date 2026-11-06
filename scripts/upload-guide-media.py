#!/usr/bin/env python3
"""Publish checked, immutable editorial media using a dedicated impersonated identity."""
import argparse
import hashlib
import json
import pathlib
import subprocess
import urllib.error
import urllib.parse
import urllib.request

BUCKET = 'glob2-website-public'
IDENTITY = 'glob2-website-media@bradley-personal-20261027.iam.gserviceaccount.com'

def publish(manifest, source, workload_identity=False):
    # Share validation with the build; do not let a publication point at another bucket.
    subprocess.run(['node', '--input-type=module', '-e',
                    "import {readFile} from 'node:fs/promises'; import {validateManifest} from './scripts/stage-guide-media.mjs'; validateManifest(JSON.parse(await readFile(process.argv[1],'utf8')));", str(manifest)], check=True)
    assets = json.loads(manifest.read_text())['assets']
    checked = []
    for asset in assets:
        file = (source / asset['path'].lstrip('/')).resolve()
        if not file.is_relative_to(source.resolve()): raise ValueError('Media path escapes source directory')
        data = file.read_bytes()
        if len(data) != asset['bytes'] or hashlib.sha256(data).hexdigest() != asset['sha256']:
            raise ValueError(f"Media checksum mismatch: {asset['id']}")
        checked.append((asset, data))
    command = ['gcloud', 'auth', 'print-access-token']
    if not workload_identity: command += ['--impersonate-service-account', IDENTITY]
    token = subprocess.check_output(command, text=True).strip()
    for asset, data in checked:
        name = asset['path'].lstrip('/')
        metadata = f'https://storage.googleapis.com/storage/v1/b/{BUCKET}/o/{urllib.parse.quote(name, safe="")}'
        headers = {'Authorization': 'Bearer ' + token}
        try:
            with urllib.request.urlopen(urllib.request.Request(metadata, headers=headers), timeout=30) as response:
                obj = json.load(response)
            existing = urllib.request.urlopen(asset['url'], timeout=30).read()
            if hashlib.sha256(existing).hexdigest() != asset['sha256']:
                raise ValueError(f'Immutable media object already exists with different bytes: {name}')
            print(f"Already published {asset['id']}"); continue
        except urllib.error.HTTPError as error:
            if error.code != 404: raise
        mime = 'video/mp4' if asset['kind'] == 'video' else ('image/png' if name.endswith('.png') else 'image/webp')
        url = f'https://storage.googleapis.com/upload/storage/v1/b/{BUCKET}/o?' + urllib.parse.urlencode({'uploadType': 'media', 'name': name, 'ifGenerationMatch': '0'})
        with urllib.request.urlopen(urllib.request.Request(url, data=data, headers={**headers, 'Content-Type': mime}, method='POST'), timeout=120) as response:
            json.load(response)
        print(f"Published {asset['id']}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=pathlib.Path, default=pathlib.Path('src/data/guide-media.json'))
    parser.add_argument('--source-dir', type=pathlib.Path, required=True)
    parser.add_argument('--workload-identity', action='store_true', help='Use the workflow’s short-lived WIF identity')
    args = parser.parse_args()
    publish(args.manifest, args.source_dir, args.workload_identity)
