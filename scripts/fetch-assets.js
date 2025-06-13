#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const unzipper = require('unzipper');

const ASSETS = JSON.parse(fs.readFileSync(path.join(__dirname, '../assets.json'), 'utf8'));

function getShaUrl(zipUrl) {
  return `${zipUrl}.sha256`;
}

async function download(url, dest) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to get '${url}' (${response.status})`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await fs.promises.writeFile(dest, buffer);
}

function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function fetchAndExtract(asset) {
  const zipUrl = process.env[asset.zipEnv] || asset.defaultZip;
  const shaUrl = getShaUrl(zipUrl);
  const zipPath = path.join('vendor', `${asset.name}.zip`);
  const shaPath = path.join('vendor', `${asset.name}.zip.sha256`);

  // Download zip and sha256
  console.log(`Downloading ${zipUrl} ...`);
  await download(zipUrl, zipPath);
  console.log(`Downloading ${shaUrl} ...`);
  await download(shaUrl, shaPath);

  // Read expected hash
  const expectedHash = fs.readFileSync(shaPath, 'utf8').trim().split(' ')[0];
  // Calculate actual hash
  const actualHash = await sha256File(zipPath);
  if (expectedHash !== actualHash) {
    throw new Error(`SHA256 mismatch for ${zipPath}: expected ${expectedHash}, got ${actualHash}`);
  }
  console.log(`SHA256 verified for ${zipPath}`);

  // Unzip
  if (!fs.existsSync(asset.outDir)) {
    fs.mkdirSync(asset.outDir, { recursive: true });
  }
  await fs.createReadStream(zipPath)
    .pipe(unzipper.Extract({ path: asset.outDir }))
    .promise();
  console.log(`Extracted to ${asset.outDir}`);

  // Remove zip and sha256
  fs.unlinkSync(zipPath);
  fs.unlinkSync(shaPath);
}

(async () => {
  // eslint-disable-next-line no-restricted-syntax
  for (const asset of ASSETS) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await fetchAndExtract(asset);
    } catch (err) {
      console.error(`Error processing ${asset.name}:`, err.message);
      process.exit(1);
    }
  }
  console.log('All assets fetched and extracted successfully.');
})();
