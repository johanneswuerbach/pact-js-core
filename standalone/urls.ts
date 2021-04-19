import urljoin = require('url-join');
import path = require('path');

export const isHttpUrl = (s: string): boolean => /^http(s?):\/\//.test(s);

export const join = (...paths: string[]): string =>
  isHttpUrl(paths[0]) ? urljoin(...paths) : path.join(...paths);
