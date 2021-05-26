import path = require('path');
import url = require('url');
import fs = require('fs');
import { VerifierOptions } from './types';
import { verifierLib } from './ffiVerifier';

type UriType = 'URL' | 'DIRECTORY' | 'FILE' | 'FILE_NOT_FOUND';

const VERIFICATION_SUCCESSFUL = 0;
const VERIFICATION_FAILED = 1;
// 2 - null string passed
// 3 - method panicked
const INVALID_ARGUMENTS = 4;

// Todo: Extract this, and possibly rename
const fileType = (uri: string): UriType => {
  if (/https?:/.test(url.parse(uri).protocol || '')) {
    return 'URL';
  }
  try {
    if (fs.statSync(path.normalize(uri)).isDirectory()) {
      return 'DIRECTORY';
    } else {
      return 'FILE';
    }
  } catch (e) {
    throw new Error(`Pact file or directory '${uri}' doesn't exist`);
  }
};

export const verify = (opts: VerifierOptions): Promise<string> => {
  // Todo: probably separate out the sections of this logic into separate promises
  return new Promise<string>((resolve, reject) => {
    // Todo: Does this need to be a specific log level?
    // PACT_LOG_LEVEL
    // LOG_LEVEL
    // < .. >
    verifierLib.init('LOG_LEVEL');
    // Todo: Replace all console.logs with logger calls
    console.log(JSON.stringify(opts));

    // todo, make the mapped args array immutable
    const mappedArgs = [];

    // Todo: use a similar argument mapper pattern to the spawn, for less boilerplate
    const arg = <T>(name: string, val?: T): void => {
      if (val) {
        mappedArgs.push(name, val);
      }
    };

    // Todo: Map all arguments
    arg('--provider-name', opts.provider);
    arg('--state-change-url', opts.providerStatesSetupUrl);
    arg(
      '--loglevel',
      opts.logLevel ? opts.logLevel.toLocaleLowerCase() : undefined
    );

    const u = url.parse(opts.providerBaseUrl);
    arg('--port', u.port);
    arg('--hostname', u.hostname);
    arg('--broker-url', opts.pactBrokerUrl);
    arg('--user', opts.pactBrokerUsername);
    arg('--password', opts.pactBrokerPassword);
    arg('--provider-version', opts.providerVersion);
    arg('--broker-token', opts.pactBrokerToken);

    if (opts.publishVerificationResult) {
      mappedArgs.push('--publish');
    }

    if (opts.enablePending) {
      mappedArgs.push('--enable-pending');
    }

    if (opts.consumerVersionTags) {
      mappedArgs.push('--consumer-version-tags');
      mappedArgs.push(
        Array.isArray(opts.consumerVersionTags)
          ? opts.consumerVersionTags.join(',')
          : opts.consumerVersionTags
      );
    }
    if (opts.providerVersionTags) {
      mappedArgs.push('--provider-version-tags');
      mappedArgs.push(
        Array.isArray(opts.providerVersionTags)
          ? opts.providerVersionTags.join(',')
          : opts.providerVersionTags
      );
    }

    if (opts.pactUrls) {
      mappedArgs.push(
        ...opts.pactUrls.reduce<Array<string>>(
          (acc: Array<string>, uri: string) => {
            switch (fileType(uri)) {
              case 'URL':
                return [...acc, '--url', uri];
              case 'DIRECTORY':
                return [...acc, '--dir', uri];
              case 'FILE':
                return [...acc, '--file', uri];
              case 'FILE_NOT_FOUND':
                throw new Error(
                  `Pact file or directory '${uri}' doesn't exist`
                );
              default:
                return acc;
            }
          },
          []
        )
      );
    }

    const request = mappedArgs.join('\n');
    console.log('sending arguments to FFI:', request);

    verifierLib.verify.async(request, (err: Error, res: number) => {
      console.log('response from verifier', err, res);
      if (err) {
        console.error(err);
        reject(err);
      } else {
        switch (res) {
          case VERIFICATION_SUCCESSFUL:
            console.log('Verification successful');
            resolve(`finished: ${res}`);
            break;
          case VERIFICATION_FAILED:
            console.log('Failed verififcation');
            reject('Verfication failed');
            break;
          case INVALID_ARGUMENTS:
            console.error();
            console.error(
              '!!! The underlying Pact core was invoked incorrectly !!!'
            );
            console.error(
              'This is a bug in pact-core-js. There is additional debuging information above'
            );
            console.error(
              'Please open a bug report at: https://github.com/pact-foundation/pact-js-core/issues'
            );
            console.error();
            reject('Verification was unable to run');
            break;
          default:
            console.error();
            console.error('!!! The underlying Pact core panicked !!!');
            console.error(
              'This is a bug in pact-core-js. There is additional debuging information above'
            );
            console.error(
              'Please open a bug report at: https://github.com/pact-foundation/pact-js-core/issues'
            );
            console.error();
            reject('Verification was unable to run');
            break;
        }
      }
    });
  });
};
