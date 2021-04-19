import chalk from 'chalk';
import { Data } from '../types';
import fs = require('fs');
import path = require('path');

import { PACT_STANDALONE_VERSION } from '../versions';
import { isHttpUrl } from '../urls';
import { downloadFileRetry } from '../connectors/http';
import { trackDownload } from '../connectors/tracking';

export function download(data: Data): Promise<Data> {
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
      trackDownload(data.platform);

      // Get archive of release
      // If URL, download via HTTP
      if (isHttpUrl(data.binaryDownloadPath)) {
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
