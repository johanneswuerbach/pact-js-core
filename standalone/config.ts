import { BinaryEntry, Config, PackageConfig } from './types';
import { PACT_STANDALONE_VERSION } from './versions';

import path = require('path');
import fs = require('fs');
import { throwError } from './connectors/console';
import { isHttpUrl } from './urls';

export const PACT_DEFAULT_LOCATION = `https://github.com/pact-foundation/pact-ruby-standalone/releases/download/v${PACT_STANDALONE_VERSION}/`;
// const PACT_FFI_DEFAULT_LOCATION = `https://github.com/pact-foundation/pact-reference/releases/download/libpact_mock_server_ffi-v${PACT_FFI_VERSION}/`;

function getBinaryLocation(
  location: string,
  basePath: string
): string | undefined {
  // Check if location is valid and is a string
  if (!location || location.length === 0) {
    return undefined;
  }

  // Check if it's a URL, if not, try to resolve the path to work with either absolute or relative paths
  return isHttpUrl(location) ? location : path.resolve(basePath, location);
}

function findPackageConfig(location: string, tries = 10): PackageConfig {
  if (tries === 0) {
    return {};
  }
  const packagePath = path.resolve(location, 'package.json');
  if (fs.existsSync(packagePath)) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(packagePath).config;
    if (config && (config.pact_binary_location || config.pact_do_not_track)) {
      return {
        binaryLocation: getBinaryLocation(
          config.pact_binary_location,
          location
        ),
        doNotTrack: config.pact_do_not_track,
      };
    }
  }

  return findPackageConfig(path.resolve(location, '..'), tries - 1);
}

function createConfig(location: string = process.cwd()): Config {
  const packageConfig = findPackageConfig(location);
  const PACT_BINARY_LOCATION =
    packageConfig.binaryLocation || PACT_DEFAULT_LOCATION;
  const CHECKSUM_SUFFIX = '.checksum';

  return {
    doNotTrack:
      packageConfig.doNotTrack ||
      process.env.PACT_DO_NOT_TRACK !== undefined ||
      false,
    binaries: [
      {
        platform: 'win32',
        binary: `pact-${PACT_STANDALONE_VERSION}-win32.zip`,
        binaryChecksum: `pact-${PACT_STANDALONE_VERSION}-win32.zip${CHECKSUM_SUFFIX}`,
        downloadLocation: PACT_BINARY_LOCATION,
        folderName: `win32-${PACT_STANDALONE_VERSION}`,
        type: 'ruby-standalone',
      },
      {
        platform: 'darwin',
        binary: `pact-${PACT_STANDALONE_VERSION}-osx.tar.gz`,
        binaryChecksum: `pact-${PACT_STANDALONE_VERSION}-osx.tar.gz${CHECKSUM_SUFFIX}`,
        downloadLocation: PACT_BINARY_LOCATION,
        folderName: `darwin-${PACT_STANDALONE_VERSION}`,
        type: 'ruby-standalone',
      },
      {
        platform: 'linux',
        arch: 'x64',
        binary: `pact-${PACT_STANDALONE_VERSION}-linux-x86_64.tar.gz`,
        binaryChecksum: `pact-${PACT_STANDALONE_VERSION}-linux-x86_64.tar.gz${CHECKSUM_SUFFIX}`,
        downloadLocation: PACT_BINARY_LOCATION,
        folderName: `linux-x64-${PACT_STANDALONE_VERSION}`,
        type: 'ruby-standalone',
      },
      {
        platform: 'linux',
        arch: 'ia32',
        binary: `pact-${PACT_STANDALONE_VERSION}-linux-x86.tar.gz`,
        binaryChecksum: `pact-${PACT_STANDALONE_VERSION}-linux-x86.tar.gz${CHECKSUM_SUFFIX}`,
        downloadLocation: PACT_BINARY_LOCATION,
        folderName: `linux-ia32-${PACT_STANDALONE_VERSION}`,
        type: 'ruby-standalone',
      },
      /*  {
        platform: 'darwin',
        binary: `libpact_mock_server_ffi-osx-x86_64.a.gz`,
        binaryChecksum: `skip`,
        downloadLocation: PACT_FFI_DEFAULT_LOCATION,
        folderName: `darwin-${PACT_FFI_VERSION}-ffi`,
        type: 'rust-ffi',
      },  */
    ],
  };
}

export const CONFIG = createConfig();

export function getBinaryEntries(
  platform: string = process.platform,
  arch: string = process.arch
): BinaryEntry[] {
  const entries = CONFIG.binaries.filter(
    (value) =>
      value.platform === platform && (value.arch ? value.arch === arch : true)
  );

  if (entries.length === 0) {
    throw throwError(
      `Cannot find binary for platform '${platform}' with architecture '${arch}'.`
    );
  }
  return entries;
}
