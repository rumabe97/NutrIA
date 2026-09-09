import { Global, Module } from '@nestjs/common';

import { envProvider } from '../../config/index.js';
import { ErrorReporter } from './ErrorReporter.js';

/**
 * Global: the exception filter and the background job runner both report, and
 * threading one service through every module would add an import with no
 * decision behind it.
 */
@Global()
@Module({ exports: [ErrorReporter], providers: [envProvider, ErrorReporter] })
export class ObservabilityModule {}
