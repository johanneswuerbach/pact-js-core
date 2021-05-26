import chalk from 'chalk';
import path = require('path');

import { CONFIG } from './config';
import { downloadFileRetry } from './connectors/http';
import { throwError } from './connectors/console';
import { setup } from './setup';

import { Data } from './types';

export function downloadChecksums(): Promise<void> {
  console.log(chalk.gray(`Downloading All Pact Standalone Binary Checksums.`));
  return Promise.all(
    CONFIG.binaries.map((value) =>
      setup(value.platform, value.arch)
        .then((allData: Data[]) =>
          allData.filter(({ checksumFilepath }) => checksumFilepath !== 'skip')
        )
        .then((checksums: Data[]) =>
          Promise.all(
            checksums.map((data) =>
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
                (error) =>
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
