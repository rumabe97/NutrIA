import { Command } from 'commander';

import { helloCommand } from './commands/hello';

const program = new Command();

program.name('cli').description('CLI for mini-template').version('0.0.0');

program.addCommand(helloCommand);

program.parse();
