import { Data } from './types';

// we have to use ES6 imports as it's providing correct types for chalk.
import chalk from 'chalk';
import { download } from './install/download';
import { extract } from './install/extract';
import { throwError } from './connectors/console';
import { setup } from './setup';

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
    .then((entries) => Promise.all(entries.map((d) => download(d))))
    .then((entries) => Promise.all(entries.map((d) => extract(d))))
    .then((entries) => {
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
