import path = require('path');
import url = require('url');
import fs = require('fs');
import { VerifierOptions } from './types';
import { verifierLib } from './ffiVerifier';
import logger from '../logger';

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

const pactCrashMessage = (
  extraMessage: string
) => `!!!!!!!!! PACT CRASHED !!!!!!!!!

${extraMessage}

This is almost certainly a bug in pact-js-core. It would be great if you could
open a bug report at: https://github.com/pact-foundation/pact-js-core/issues
so that we can fix it.

There is additional debugging information above. If you open a bug report, 
please rerun with logLevel: 'debug' set in the VerifierOptions, and include the
full output.

SECURITY WARNING: Before including your log in the issue tracker, make sure you
have removed sensitive info such as login credentials and urls that you don't want
to share with the world.

Lastly, we're sorry about this!
`;

export const verify = (opts: VerifierOptions): Promise<string> => {
  // Todo: probably separate out the sections of this logic into separate promises
  return new Promise<string>((resolve, reject) => {
    // Todo: Does this need to be a specific log level?
    // PACT_LOG_LEVEL
    // LOG_LEVEL
    // < .. >
    verifierLib.init('LOG_LEVEL');

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
    logger.debug('sending arguments to FFI:');
    logger.debug(request);

    verifierLib.verify.async(request, (err: Error, res: number) => {
      logger.debug(`response from verifier: ${err}, ${res}`);
      if (err) {
        logger.error(err);
        logger.error(
          pactCrashMessage(
            'The underlying pact core returned an error through the ffi interface'
          )
        );
        reject(err);
      } else {
        switch (res) {
          case VERIFICATION_SUCCESSFUL:
            logger.info('Verification successful');
            resolve(`finished: ${res}`);
            break;
          case VERIFICATION_FAILED:
            logger.error('Verification unsuccessful');
            reject(new Error('Verfication failed'));
            break;
          case INVALID_ARGUMENTS:
            logger.error(
              pactCrashMessage(
                'The underlying pact core was invoked incorrectly.'
              )
            );
            reject(new Error('Verification was unable to run'));
            break;
          default:
            logger.error(
              pactCrashMessage(
                'The underlying pact core crashed in an unexpected way.'
              )
            );
            reject(new Error('Pact core crashed'));
            break;
        }
      }
    });
  });
};
