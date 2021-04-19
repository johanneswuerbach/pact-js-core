import chalk from 'chalk';
import * as http from 'http';

import fs = require('fs');

import { throwError } from './console';
import { request } from './boundaries/request';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const config = require('libnpmconfig');

export function downloadFileRetry(
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
