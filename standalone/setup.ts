import path = require('path');
import pactEnvironment from '../src/pact-environment';

import { getBinaryEntries, PACT_DEFAULT_LOCATION } from './config';
import { Data } from './types';
import { join } from './urls';

export function setup(platform?: string, arch?: string): Promise<Data[]> {
  const entries = getBinaryEntries(platform, arch);
  return Promise.resolve(
    entries.map((entry) => ({
      binaryDownloadPath: join(entry.downloadLocation, entry.binary),
      checksumDownloadPath: join(PACT_DEFAULT_LOCATION, entry.binaryChecksum),
      filepath: path.resolve(__dirname, entry.binary),
      checksumFilepath:
        entry.binaryChecksum === 'skip'
          ? 'skip'
          : path.resolve(__dirname, entry.binaryChecksum),
      isWindows: pactEnvironment.isWindows(platform),
      platform: entry.platform,
      arch: entry.arch,
      platformFolderPath: path.resolve(__dirname, entry.folderName),
    }))
  );
}
