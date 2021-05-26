import chalk from 'chalk';
import pactEnvironment from '../../src/pact-environment';
import { Data } from '../types';
import fs = require('fs');
import path = require('path');
// import { ungzip } from 'node-gzip';

import unzipper = require('unzipper');
import tar = require('tar');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const sumchecker = require('sumchecker');

import { throwError } from '../connectors/console';

export function extract(data: Data): Promise<Data> {
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
    (
      data.checksumFilepath !== 'skip'
        ? sumchecker(
            'sha1',
            data.checksumFilepath,
            path.dirname(data.filepath),
            basename
          ).then(
            () =>
              console.log(chalk.green(`Checksum passed for '${basename}'.`)),
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
      .then(() => {
        if (data.isWindows) {
          fs.createReadStream(data.filepath)
            .pipe(
              unzipper.Extract({
                path: data.platformFolderPath,
              })
            )
            .on('entry', (entry) => entry.autodrain())
            .promise();
        } else if (data.filepath.endsWith('.tar.gz')) {
          tar.x({
            file: data.filepath,
            cwd: data.platformFolderPath,
            preserveOwner: false,
          });
        } else if (data.filepath.endsWith('.gz')) {
          throw new Error(`Implement this: ${data.filepath}`);
        } else {
          throw new Error(`Unknown file type extracting: ${data.filepath}`);
        }
      })
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
