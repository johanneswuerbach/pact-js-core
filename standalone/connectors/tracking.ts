import chalk from 'chalk';
import { CONFIG } from '../config';
import { PACT_STANDALONE_VERSION } from '../versions';
import { request } from './boundaries/request';

const CIs = [
  'CI',
  'CONTINUOUS_INTEGRATION',
  'ABSTRUSE_BUILD_DIR',
  'APPVEYOR',
  'BUDDY_WORKSPACE_URL',
  'BUILDKITE',
  'CF_BUILD_URL',
  'CIRCLECI',
  'CODEBUILD_BUILD_ARN',
  'CONCOURSE_URL',
  'DRONE',
  'GITLAB_CI',
  'GO_SERVER_URL',
  'JENKINS_URL',
  'PROBO_ENVIRONMENT',
  'SEMAPHORE',
  'SHIPPABLE',
  'TDDIUM',
  'TEAMCITY_VERSION',
  'TF_BUILD',
  'TRAVIS',
  'WERCKER_ROOT',
];

export const trackDownload = (platform: string): void => {
  // Track downloads through Google Analytics unless testing or don't want to be tracked
  if (!CONFIG.doNotTrack) {
    console.log(
      chalk.gray(
        'Please note: we are tracking this download anonymously to gather important usage statistics. ' +
          "To disable tracking, set 'pact_do_not_track: true' in your package.json 'config' section."
      )
    );
    // Trying to find all environment variables of all possible CI services to get more accurate stats
    // but it's still not 100% since not all systems have unique environment variables for their CI server
    const isCI = CIs.some(key => process.env[key] !== undefined);
    request
      .post({
        url: 'https://www.google-analytics.com/collect',
        form: {
          v: 1,
          tid: 'UA-117778936-1', // Tracking ID / Property ID.
          cid: Math.round(2147483647 * Math.random()).toString(), // Anonymous Client ID.
          t: 'screenview', // Screenview hit type.
          an: 'pact-install', // App name.
          av: require('../../../package.json').version, // App version.
          aid: 'pact-node', // App Id - pact-node for historical reasons
          aiid: `standalone-${PACT_STANDALONE_VERSION}`, // App Installer Id.
          cd: `download-node-${platform}-${isCI ? 'ci' : 'user'}`,
          aip: true, // Anonymise IP address
        },
      })
      .on('error', () => {
        /* Ignore all errors */
      });
  }
};
