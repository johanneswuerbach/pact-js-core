import logger from '../logger';
import q = require('q');

import { deprecate } from 'util';

import { VerifierOptions } from './types';
import { verify } from './nativeVerifier';

export class Verifier {
  public static create = deprecate(
    (options: VerifierOptions) => new Verifier(options),
    'Create function will be removed in future release, please use the default export function or use `new Verifier()`'
  );

  public readonly options: VerifierOptions;
  /* private readonly __argMapping = {
    pactUrls: DEFAULT_ARG,
    providerBaseUrl: '--provider-base-url',
    pactBrokerUrl: '--pact-broker-base-url',
    providerStatesSetupUrl: '--provider-states-setup-url',
    pactBrokerUsername: '--broker-username',
    pactBrokerPassword: '--broker-password',
    pactBrokerToken: '--broker-token',
    consumerVersionTag: '--consumer-version-tag',
    providerVersionTag: '--provider-version-tag',
    consumerVersionTags: '--consumer-version-tag',
    providerVersionTags: '--provider-version-tag',
    consumerVersionSelectors: '--consumer-version-selector',
    publishVerificationResult: '--publish-verification-results',
    providerVersion: '--provider-app-version',
    provider: '--provider',
    enablePending: '--enable-pending',
    customProviderHeaders: '--custom-provider-header',
    verbose: '--verbose',
    includeWipPactsSince: '--include-wip-pacts-since',
    monkeypatch: '--monkeypatch',
    format: '--format',
    out: '--out',
    logDir: '--log-dir',
    logLevel: '--log-level',
  }; */

  constructor(options: VerifierOptions) {
    this.options = options;
  }

  public verify(): q.Promise<string> {
    logger.info('Verifying Pact Files');

    const deferred = q.defer<string>();
    verify(this.options).then(
      s => {
        logger.info('Woo');
        deferred.resolve(s);
      },
      e => {
        logger.error(e);
        deferred.reject(e);
      }
    );
    return deferred.promise
      .timeout(
        (this.options.timeout as number) || 30000,
        `Timeout waiting for verification process to complete`
      )
      .tap(() => logger.info('Pact Verification succeeded.'));

    /*  
    const deferred = q.defer<string>();
    const instance = spawn.spawnBinary(
      pactStandalone.verifierPath,
      this.options,
      this.__argMapping
    );
    const output: Array<stri  ng | Buffer> = [];
    instance.stdout.on('data', l => output.push(l));
    instance.stderr.on('data', l => output.push(l));
    instance.once('close', code => {
      const o = output.join('\n');
      code === 0 ? deferred.resolve(o) : deferred.reject(new Error(o));
    });

    return deferred.promise
      .timeout(
        this.options.timeout as number,
        `Timeout waiting for verification process to complete (PID: ${instance.pid})`
      )
      .tap(() => logger.info('Pact Verification succeeded.'));*/
  }
}

// Creates a new instance of the pact server with the specified option
export default (options: VerifierOptions): Verifier => new Verifier(options);

// A ConsumerVersionSelector is a way we specify which pacticipants and
// versions we want to use when configuring verifications.
//
// See https://docs.pact.io/selectors for more
