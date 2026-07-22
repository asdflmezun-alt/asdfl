import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android TWA şablonu üretim alan adını ve 512px ikon kaynağını kullanır', async () => {
  const manifest = JSON.parse(await read('android/twa-manifest.template.json'));

  assert.equal(manifest.packageId, 'org.asdflmezun.app');
  assert.equal(manifest.host, 'www.asdflmezun.org');
  assert.equal(manifest.startUrl, '/index.html');
  assert.equal(manifest.iconUrl, 'https://www.asdflmezun.org/assets/images/logo.png');
  assert.equal(manifest.webManifestUrl, 'https://www.asdflmezun.org/manifest.json');
  assert.equal(manifest.signingKey.path, '/run-secrets/release.keystore');
});

test('assetlinks şablonu yalnız TWA URL yetkisini ister', async () => {
  const assetLinks = JSON.parse(await read('android/assetlinks.json.template'));

  assert.deepEqual(assetLinks[0].relation, ['delegate_permission/common.handle_all_urls']);
  assert.equal(assetLinks[0].target.package_name, 'org.asdflmezun.app');
  assert.equal(assetLinks[0].target.sha256_cert_fingerprints.length, 1);
});

test('Android workflow secretsiz ve kurulabilir bir test APK üretir', async () => {
  const workflow = await read('.github/workflows/android-release.yml');

  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request(?:_target)?:/);
  assert.match(workflow, /permissions:\s*\n\s*contents: read/);
  assert.doesNotMatch(workflow, /secrets\./);
  assert.doesNotMatch(workflow, /environment: android-release/);
  assert.match(workflow, /keytool -genkeypair/);
  assert.match(workflow, /\$RUNNER_TEMP\/asdfl-test\.keystore/);
  assert.match(workflow, /sdkmanager_path/);
  assert.match(workflow, /--licenses/);
  assert.equal(
    workflow.match(/--volume asdfl-bubblewrap-sdk:\/root\/\.bubblewrap\/android_sdk/g)?.length,
    3,
  );
  assert.match(workflow, /android\/app-release-signed\.apk/);
  assert.match(workflow, /if: always\(\)/);
  assert.match(workflow, /retention-days: 7/);
  assert.match(workflow, /apksigner_path/);
  assert.doesNotMatch(workflow, /app-release-bundle\.aab/);
  assert.doesNotMatch(workflow, /--skipPwaValidation/);
});

test('Android imzalama ve derleme çıktıları Git tarafından dışlanır', async () => {
  const gitignore = await read('.gitignore');
  const buildScript = await read('scripts/build-dist.mjs');

  for (const pattern of ['*.jks', '*.keystore', '*.apk', '*.aab', 'android/twa-manifest.json']) {
    assert.match(gitignore, new RegExp(`^${pattern.replaceAll('.', '\\.').replaceAll('*', '\\*')}$`, 'm'));
  }

  assert.match(buildScript, /const EXCLUDE = new Set\(\[[\s\S]*'android'/);
});
