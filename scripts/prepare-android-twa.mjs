import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const templateUrl = new URL('../android/twa-manifest.template.json', import.meta.url);
const outputUrl = new URL('../android/twa-manifest.json', import.meta.url);

const versionName = String(process.env.ANDROID_VERSION_NAME || '').trim();
const versionCodeText = String(process.env.ANDROID_VERSION_CODE || '').trim();
const signingKeyAlias = String(process.env.ANDROID_KEY_ALIAS || '').trim();

if (!/^[0-9]+(?:\.[0-9]+){1,3}(?:[-+][A-Za-z0-9.-]+)?$/.test(versionName)) {
  throw new Error('ANDROID_VERSION_NAME, 1.0.0 biçiminde geçerli bir sürüm olmalıdır.');
}

if (!/^[1-9][0-9]*$/.test(versionCodeText)) {
  throw new Error('ANDROID_VERSION_CODE pozitif bir tam sayı olmalıdır.');
}

const versionCode = Number(versionCodeText);
if (!Number.isSafeInteger(versionCode) || versionCode > 2_100_000_000) {
  throw new Error('ANDROID_VERSION_CODE, 2.100.000.000 değerini aşamaz.');
}

if (!/^[A-Za-z0-9._-]{1,128}$/.test(signingKeyAlias)) {
  throw new Error('ANDROID_KEY_ALIAS yalnızca harf, rakam, nokta, alt çizgi ve tire içerebilir.');
}

const manifest = JSON.parse(await readFile(templateUrl, 'utf8'));
manifest.appVersion = versionName;
manifest.appVersionCode = versionCode;
manifest.signingKey.alias = signingKeyAlias;

await writeFile(outputUrl, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Android TWA yapılandırması hazırlandı: ${fileURLToPath(outputUrl)}`);
