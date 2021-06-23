// https://github.com/node-ffi/node-ffi/wiki/Node-FFI-Tutorial
import ffi = require('ffi-napi');
import path = require('path');
import { FfiBinding } from './types';

// This is a lookup between process.platform and
// the platform names used in pact-reference
const PLATFORM_LOOKUP = {
  linux: 'linux',
  darwin: 'osx',
  win32: 'windows', // yes, 'win32' is what process.platform returns on windows 64 bit
};

// This is a lookup between process.arch and
// the architecture names used in pact-reference
const ARCH_LOOKUP = { x64: 'x86_64' };

// This is a lookup between "${platform}-${arch}" and
// the file extensions to link on that platform/arch combination
const EXTENSION_LOOKUP = {
  'osx-x86_64': 'dylib',
  'linux-x86_64': 'so',
  'windows-x86_64': 'dll',
};

// This function exists to wrap the untyped ffi lib
// and return a typed version based on the description
export const initialiseFfi = <T>(
  filename: string,
  description: T
): FfiBinding<T> =>
  ffi.Library(
    path.resolve(process.cwd(), 'ffi', filename),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    description as { [k: string]: any }
  );

export const libName = (library: string, version: string): string => {
  const arch = ARCH_LOOKUP[process.arch];
  const platform = PLATFORM_LOOKUP[process.platform];

  if (!arch || !platform) {
    throw new Error(
      `Pact does not currently support the operating system and architecture combination '${process.platform}/${process.arch}'`
    );
  }

  const prefix = `${platform}-${arch}`;

  const extension = EXTENSION_LOOKUP[prefix];
  if (!extension) {
    throw new Error(
      `Pact doesn't know what library to use for the architecture combination '${process.platform}/${process.arch}'`
    );
  }
  return `${version}-${library}-${prefix}.${extension}`;
};
