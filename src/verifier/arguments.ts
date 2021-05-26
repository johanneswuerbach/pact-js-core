import { LogLevel } from '../service';
import { ArgMapping } from './argumentMapper/types';
import { VerifierOptions } from './types';

import path = require('path');
import url = require('url');
import fs = require('fs');

type UriType = 'URL' | 'DIRECTORY' | 'FILE' | 'FILE_NOT_FOUND';
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

export const argMapping: ArgMapping<VerifierOptions> = {
  providerBaseUrl: (providerBaseUrl: string) => {
    const u = url.parse(providerBaseUrl);
    return u && u.port && u.hostname
      ? ['--port', u.port, '--hostname', u.hostname]
      : [];
  },
  logLevel: (logLevel: LogLevel) => ['--loglevel', logLevel],
  provider: { arg: '--provider-name', mapper: 'string' },
  pactUrls: (pactUrls: string[]) =>
    pactUrls.reduce<Array<string>>((acc: Array<string>, uri: string) => {
      switch (fileType(uri)) {
        case 'URL':
          return [...acc, '--url', uri];
        case 'DIRECTORY':
          return [...acc, '--dir', uri];
        case 'FILE':
          return [...acc, '--file', uri];
        case 'FILE_NOT_FOUND':
          throw new Error(`Pact file or directory '${uri}' doesn't exist`);
        default:
          return acc;
      }
    }, []),
  pactBrokerUrl: { arg: '--broker-url', mapper: 'string' },
  pactBrokerUsername: { arg: '--user', mapper: 'string' },
  pactBrokerPassword: { arg: '--password', mapper: 'string' },
  pactBrokerToken: { arg: '--broker-token', mapper: 'string' },
  consumerVersionTags: (tags: string | string[]) => [
    '--consumer-version-tags',
    Array.isArray(tags) ? tags.join(',') : tags,
  ],
  providerVersionTags: (tags: string | string[]) => [
    '--provider-version-tags',
    Array.isArray(tags) ? tags.join(',') : tags,
  ],
  providerStatesSetupUrl: { arg: '--state-change-url', mapper: 'string' },

  providerVersion: { arg: '--provider-version', mapper: 'string' },

  // Todo in FFI
  includeWipPactsSince: { arg: '--include-wip-pacts-since', mapper: 'string' },
  consumerVersionSelectors: () => {
    throw new Error('Consumer version selectors are not yet implemented');
  },
  publishVerificationResult: { arg: '--publish', mapper: 'flag' },
  enablePending: { arg: '--enable-pending', mapper: 'flag' },

  // Todo in Rust
  customProviderHeaders: () => {
    throw new Error('customProviderHeaders are not yet implemented');
  },
  timeout: {
    warningMessage: 'Timeout currently has no effect on the rust binary',
  },
  // We should support these, I think
  format: {
    warningMessage:
      "All output is currently on standard out, setting 'format' has no effect",
  },
  out: {
    warningMessage:
      "All output is currently on standard out, setting 'out' has no effect",
  },

  // Deprecate
  logDir: {
    warningMessage:
      'Setting logDir is deprecated as all logs are now on standard out.',
  },
  verbose: {
    warningMessage:
      "Verbose mode is deprecated, please use logLevel: 'debug' instead",
  },
  monkeypatch: {
    warningMessage:
      'The undocumented feature monkeypatch is no more, please file an issue if you were using it and need it',
  },
};
