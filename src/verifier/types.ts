import { LogLevel } from '../service';

export interface ConsumerVersionSelector {
  pacticipant?: string;
  tag?: string;
  version?: string;
  latest?: boolean;
  all?: boolean;
}

export interface VerifierOptions {
  providerBaseUrl: string;
  provider?: string;
  pactUrls?: string[];
  pactBrokerUrl?: string;
  pactBrokerUsername?: string;
  pactBrokerPassword?: string;
  pactBrokerToken?: string;
  consumerVersionTags?: string | string[];
  providerVersionTags?: string | string[];
  consumerVersionSelectors?: ConsumerVersionSelector[];
  providerStatesSetupUrl?: string;
  customProviderHeaders?: string[];
  publishVerificationResult?: boolean;
  providerVersion?: string;
  enablePending?: boolean;
  timeout?: number;
  verbose?: boolean;
  includeWipPactsSince?: string;
  monkeypatch?: string;
  format?: 'json' | 'xml' | 'progress' | 'RspecJunitFormatter';
  out?: string;
  logDir?: string;
  logLevel?: LogLevel;
}
