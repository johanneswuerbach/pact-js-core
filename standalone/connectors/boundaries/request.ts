import * as Request from 'request';

// Sets the request default for all calls through npm environment variables for proxy
export const request = Request.defaults({
  proxy:
    process.env.npm_config_https_proxy ||
    process.env.npm_config_proxy ||
    undefined,
});
