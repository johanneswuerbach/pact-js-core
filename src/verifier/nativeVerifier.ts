// https://github.com/node-ffi/node-ffi/wiki/Node-FFI-Tutorial
import ffi = require('ffi-napi');
import path = require('path');
import url = require('url');
import fs = require('fs');
import { flatten } from 'underscore';
import { VerifierOptions } from './types';
import _ = require('underscore');

// TODO: make this dynamic, and download during install/on-demand
const dll = path.resolve(
  process.cwd(),
  'ffi',
  'libpact_verifier_ffi-osx-x86_64.dylib'
);

// Map the FFI c interface
//
// char* version();
// void free_string(char* s);
// int verify(char* s);
const lib = ffi.Library(dll, {
  init: ['string', ['string']],
  version: ['string', []],
  // eslint-disable-next-line @typescript-eslint/camelcase
  free_string: ['void', ['string']],
  verify: ['int', ['string']],
});

export const verify = (opts: VerifierOptions): Promise<string> => {
  return new Promise<string>((resolve, reject) => {
    lib.init('LOG_LEVEL');
    console.log(JSON.stringify(opts));
    const u = url.parse(opts.providerBaseUrl);

    const mappedArgs = [];

    const arg = <T>(name: string, val?: T): void => {
      if (val) {
        mappedArgs.push(name, val);
      }
    };

    arg('--provider-name', opts.provider);
    arg('--state-change-url', opts.providerStatesSetupUrl);
    arg(
      '--loglevel',
      opts.logLevel ? opts.logLevel.toLocaleLowerCase() : undefined
    );

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

    if (opts.consumerVersionTags && opts.consumerVersionTags.length !== 0) {
      mappedArgs.push('--consumer-version-tags');
      mappedArgs.push(flatten([opts.consumerVersionTags]).join(','));
    }
    if (opts.providerVersionTags && opts.providerVersionTags.length !== 0) {
      mappedArgs.push('--provider-version-tags');
      mappedArgs.push(flatten([opts.providerVersionTags]).join(','));
    }

    if (opts.pactUrls) {
      _.chain(opts.pactUrls)
        .map((uri: string) => {
          // only check local files
          if (/https?:/.test(url.parse(uri).protocol || '')) {
            mappedArgs.push('--url', uri);
          } else {
            try {
              if (fs.statSync(path.normalize(uri)).isDirectory()) {
                mappedArgs.push('--dir', uri);
              } else {
                mappedArgs.push('--file', uri);
              }
            } catch (e) {
              throw new Error(`Pact file or directory '${uri}' doesn't exist`);
            }
          }
          // HTTP paths are OK
          return uri;
        })
        .compact()
        .value();
    }

    const request = mappedArgs.join('\n');
    console.log('sending arguments to FFI:', request);

    lib.verify.async(request, (err: Error, res: number) => {
      console.log('response from verifier', err, res);
      if (err) {
        console.error(err);
        reject(err);
      } else {
        if (res === 0) {
          console.log('Verification successful');
          resolve(`finished: ${res}`);
        } else {
          console.log('Failed verififcation');
          reject('Verfication failed');
        }
      }
    });
  });
};
