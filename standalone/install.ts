import * as http from 'http';
import * as Request from 'request';
import unzipper = require('unzipper');
import tar = require('tar');
import { PackageConfig, Config, Data, BinaryEntry } from './types';

import pactEnvironment from '../src/pact-environment';
// we have to use ES6 imports as it's providing correct types for chalk.
import chalk from 'chalk';
import path = require('path');
import fs = require('fs');
import urljoin = require('url-join');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('libnpmconfig');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const sumchecker = require('sumchecker');

// Sets the request default for all calls through npm environment variables for proxy
const request = Request.defaults({
  proxy:
    process.env.npm_config_https_proxy ||
    process.env.npm_config_proxy ||
    undefined,
});

// Get latest version from https://github.com/pact-foundation/pact-ruby-standalone/releases
export const PACT_STANDALONE_VERSION = '1.88.48';
// Get latest version from https://github.com/pact-foundation/pact-reference/releases
export const PACT_FFI_VERSION = '0.0.18';
const PACT_DEFAULT_LOCATION = `https://github.com/pact-foundation/pact-ruby-standalone/releases/download/v${PACT_STANDALONE_VERSION}/`;
const PACT_FFI_DEFAULT_LOCATION = `https://github.com/pact-foundation/pact-reference/releases/download/libpact_mock_server_ffi-v${PACT_FFI_VERSION}/`;
const HTTP_REGEX = /^http(s?):\/\//;

function join(...paths: string[]): string {
  return HTTP_REGEX.test(paths[0]) ? urljoin(...paths) : path.join(...paths);
}

function throwError(msg: string): never {
  throw new Error(chalk.red(`Error while installing binary: ${msg}`));
}

function getBinaryLocation(
  location: string,
  basePath: string
): string | undefined {
  // Check if location is valid and is a string
  if (!location || location.length === 0) {
    return undefined;
  }

  // Check if it's a URL, if not, try to resolve the path to work with either absolute or relative paths
  return HTTP_REGEX.test(location)
    ? location
    : path.resolve(basePath, location);
}
function findPackageConfig(location: string, tries = 10): PackageConfig {
  if (tries === 0) {
    return {};
  }
  const packagePath = path.resolve(location, 'package.json');
  if (fs.existsSync(packagePath)) {
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

export function createConfig(location: string = process.cwd()): Config {
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
      {
        platform: 'darwin',
        binary: `libpact_mock_server_ffi-osx-x86_64.a.gz`,
        binaryChecksum: `skip`,
        downloadLocation: PACT_FFI_DEFAULT_LOCATION,
        folderName: `darwin-${PACT_FFI_VERSION}-ffi`,
        type: 'rust-ffi',
      },
    ],
  };
}

const CONFIG = createConfig();

const CIs = [
  'CI',
  'CONTINUOUS_INTEGRATION',
  'ABSTRUSE_BUILD_DIR',
  'APPVEYOR',
  'BUDDY_WORKSPACE_URL',
  'BUILDKITE',
  'CF_BUILD_URL',
  'CIRCLECI',
  'CODEBUILD_BUILD_ARN',
  'CONCOURSE_URL',
  'DRONE',
  'GITLAB_CI',
  'GO_SERVER_URL',
  'JENKINS_URL',
  'PROBO_ENVIRONMENT',
  'SEMAPHORE',
  'SHIPPABLE',
  'TDDIUM',
  'TEAMCITY_VERSION',
  'TF_BUILD',
  'TRAVIS',
  'WERCKER_ROOT',
];

function downloadFileRetry(
  url: string,
  filepath: string,
  retry = 3
): Promise<unknown> {
  return new Promise(
    (
      resolve: (unused?: unknown) => void,
      reject: (e: string) => void
    ): void => {
      let len = 0;
      let downloaded = 0;
      let time = Date.now();
      let ca = config.read()['cafile'];
      if (ca) {
        ca = fs.readFileSync(ca);
      }
      request({
        url,
        headers: {
          'User-Agent': 'https://github.com/pact-foundation/pact-js-core',
        },
        strictSSL: config.read()['strict-ssl'],
        agentOptions: {
          ca: ca,
        },
      })
        .on('error', (e: string) => reject(e))
        .on(
          'response',
          (res: http.IncomingMessage) =>
            (len = parseInt(res.headers['content-length'] as string, 10))
        )
        .on('data', (chunk: string[]) => {
          downloaded += chunk.length;
          // Only show download progress every second
          const now = Date.now();
          if (now - time > 1000) {
            time = now;
            console.log(
              chalk.gray(
                `Downloaded ${((100 * downloaded) / len).toFixed(2)}%...`
              )
            );
          }
        })
        .pipe(fs.createWriteStream(filepath))
        .on('finish', resolve);
    }
  ).catch((e: string) =>
    retry-- === 0 ? throwError(e) : downloadFileRetry(url, filepath, retry)
  );
}

function download(data: Data): Promise<Data> {
  console.log(
    chalk.gray(`Installing Pact Standalone Binary for ${data.platform}.`)
  );
  return new Promise(
    (resolve: (f: Data) => void, reject: (e: string) => void): void => {
      if (fs.existsSync(path.resolve(data.filepath))) {
        console.log(chalk.yellow('Binary already downloaded, skipping...'));
        resolve({ ...data, binaryAlreadyDownloaded: true });
        return;
      }
      console.log(
        chalk.yellow(
          `Downloading Pact Standalone Binary v${PACT_STANDALONE_VERSION} for platform ${data.platform} from ${data.binaryDownloadPath}`
        )
      );

      // Track downloads through Google Analytics unless testing or don't want to be tracked
      if (!CONFIG.doNotTrack) {
        console.log(
          chalk.gray(
            'Please note: we are tracking this download anonymously to gather important usage statistics. ' +
              "To disable tracking, set 'pact_do_not_track: true' in your package.json 'config' section."
          )
        );
        // Trying to find all environment variables of all possible CI services to get more accurate stats
        // but it's still not 100% since not all systems have unique environment variables for their CI server
        const isCI = CIs.some(key => process.env[key] !== undefined);
        request
          .post({
            url: 'https://www.google-analytics.com/collect',
            form: {
              v: 1,
              tid: 'UA-117778936-1', // Tracking ID / Property ID.
              cid: Math.round(2147483647 * Math.random()).toString(), // Anonymous Client ID.
              t: 'screenview', // Screenview hit type.
              an: 'pact-install', // App name.
              av: require('../package.json').version, // App version.
              aid: 'pact-node', // App Id - pact-node for historical reasons
              aiid: `standalone-${PACT_STANDALONE_VERSION}`, // App Installer Id.
              cd: `download-node-${data.platform}-${isCI ? 'ci' : 'user'}`,
              aip: true, // Anonymise IP address
            },
          })
          .on('error', () => {
            /* Ignore all errors */
          });
      }

      // Get archive of release
      // If URL, download via HTTP
      if (HTTP_REGEX.test(data.binaryDownloadPath)) {
        downloadFileRetry(data.binaryDownloadPath, data.filepath).then(
          () => {
            console.log(
              chalk.green(`Finished downloading binary to ${data.filepath}`)
            );
            resolve(data);
          },
          (e: string) =>
            reject(
              `Error downloading binary from ${data.binaryDownloadPath}: ${e}`
            )
        );
      } else if (fs.existsSync(data.binaryDownloadPath)) {
        // Or else it might be a local file, try to copy it over to the correct directory
        fs.createReadStream(data.binaryDownloadPath)
          .on('error', (e: string) =>
            reject(
              `Error reading the file at '${data.binaryDownloadPath}': ${e}`
            )
          )
          .pipe(
            fs
              .createWriteStream(data.filepath)
              .on('error', (e: string) =>
                reject(`Error writing the file to '${data.filepath}': ${e}`)
              )
              .on('close', () => resolve(data))
          );
      } else {
        reject(
          `Could not get binary from '${data.binaryDownloadPath}' as it's not a URL and does not exist at the path specified.`
        );
      }
    }
  );
}

function extract(data: Data): Promise<Data> {
  // If platform folder exists, binary already installed, skip to next step.
  if (fs.existsSync(data.platformFolderPath as string)) {
    return Promise.resolve({ ...data, binaryAlreadyInstalled: true });
  }

  // Make sure checksum is available
  if (
    !fs.existsSync(data.checksumFilepath) &&
    data.checksumFilepath !== 'skip'
  ) {
    console.error(data.checksumDownloadPath);
    throwError(`Checksum file missing from standalone directory. Aborting.`);
  }

  fs.mkdirSync(data.platformFolderPath as string);
  console.log(
    chalk.yellow(
      `Extracting binary from ${data.filepath}. (${JSON.stringify(data)})`
    )
  );

  // Validate checksum to make sure it's the correct binary
  const basename = path.basename(data.filepath);
  return (
    (data.checksumFilepath !== 'skip'
      ? sumchecker('sha1', data.checksumFilepath, __dirname, basename).then(
          () => console.log(chalk.green(`Checksum passed for '${basename}'.`)),
          () =>
            throwError(
              `Checksum rejected for file '${basename}' with checksum ${path.basename(
                data.checksumFilepath
              )}`
            )
        )
      : Promise.resolve()
    )
      // Extract files into their platform folder
      .then(() =>
        data.isWindows
          ? fs
              .createReadStream(data.filepath)
              .pipe(
                unzipper.Extract({
                  path: data.platformFolderPath,
                })
              )
              .on('entry', entry => entry.autodrain())
              .promise()
          : tar.x({
              file: data.filepath,
              cwd: data.platformFolderPath,
              preserveOwner: false,
            })
      )
      .then(() => {
        // Remove pact-publish as it's getting deprecated
        const publishPath = path.resolve(
          data.platformFolderPath as string,
          'pact',
          'bin',
          `pact-publish${pactEnvironment.isWindows() ? '.bat' : ''}`
        );
        if (fs.existsSync(publishPath)) {
          fs.unlinkSync(publishPath);
        }
        console.log(chalk.green('Extraction done.'));
      })
      .then(() => {
        return Promise.resolve(data);
      })
      .catch((e: Error) =>
        throwError(`Extraction failed for ${data.filepath}: ${e}`)
      )
  );
}

export function getBinaryEntry(
  platform: string = process.platform,
  arch: string = process.arch
): BinaryEntry[] {
  const entries = CONFIG.binaries.filter(
    value =>
      value.platform === platform && (value.arch ? value.arch === arch : true)
  );

  if (entries.length === 0) {
    throw throwError(
      `Cannot find binary for platform '${platform}' with architecture '${arch}'.`
    );
  }
  return entries;
}

function setup(platform?: string, arch?: string): Promise<Data[]> {
  const entries = getBinaryEntry(platform, arch);
  return Promise.resolve(
    entries.map(entry => ({
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

// This function is unused, but I'm not touching it.
export function downloadChecksums(): Promise<void> {
  console.log(chalk.gray(`Downloading All Pact Standalone Binary Checksums.`));
  return Promise.all(
    CONFIG.binaries.map(value =>
      setup(value.platform, value.arch)
        .then((allData: Data[]) =>
          allData.filter(({ checksumFilepath }) => checksumFilepath !== 'skip')
        )
        .then((checksums: Data[]) =>
          Promise.all(
            checksums.map(data =>
              downloadFileRetry(
                data.checksumDownloadPath,
                data.checksumFilepath
              ).then(
                () => {
                  console.log(
                    chalk.green(
                      `Finished downloading checksum ${path.basename(
                        data.checksumFilepath
                      )}`
                    )
                  );
                },
                error =>
                  throwError(
                    `Error downloading checksum from ${data.checksumDownloadPath}: ${error}`
                  )
              )
            )
          )
        )
    )
  ).then(
    () => console.log(chalk.green('All checksums downloaded.')),
    (e: string) => throwError(`Checksum Download Failed Unexpectedly: ${e}`)
  );
}

export default (platform?: string, arch?: string): Promise<Data[]> => {
  if (process.env.PACT_SKIP_BINARY_INSTALL === 'true') {
    console.log(
      chalk.yellow(
        "Skipping binary installation. Env var 'PACT_SKIP_BINARY_INSTALL' was found."
      )
    );
    return Promise.resolve([
      {
        binaryInstallSkipped: true,
      },
    ] as Data[]);
  }
  return setup(platform, arch)
    .then(entries => Promise.all(entries.map(d => download(d))))
    .then(entries => Promise.all(entries.map(d => extract(d))))
    .then(entries => {
      console.log(
        '\n\n' +
          chalk.bgYellow(
            chalk.black('### If you') +
              chalk.red(' ❤ ') +
              chalk.black('Pact and want to support us, please donate here:')
          ) +
          chalk.blue(' http://donate.pact.io/node') +
          '\n\n'
      );
      console.log(chalk.green('Pact Standalone Binary is ready.'));
      return entries;
    })
    .catch((e: string) =>
      throwError(`Postinstalled Failed Unexpectedly: ${e}`)
    );
};
