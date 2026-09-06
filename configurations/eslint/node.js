import globals from 'globals';
import { config as baseConfig } from './base.js';

import { Linter } from 'eslint';

/**
 * A shared ESLint configuration for Node.js apps and packages (CLI, scripts, servers).
 *
 * @type {Linter.Config}
 * */
export const nodeConfig = [
  ...baseConfig,
  {
    languageOptions: {
      globals: { ...globals.node }
    }
  }
];
