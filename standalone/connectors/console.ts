import chalk from 'chalk';

export const throwError = (msg: string): never => {
  throw new Error(chalk.red(`Error while installing binary: ${msg}`));
};
