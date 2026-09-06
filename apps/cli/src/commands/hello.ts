import { Command } from 'commander';

interface HelloOptions {
  name: string;
}

export const helloCommand = new Command('hello')
  .description('Say hello — smoke test that the CLI is wired up correctly')
  .option('-n, --name <name>', 'name to greet', 'World')
  .action((options: HelloOptions) => {
    console.log(`Hello, ${options.name}!`);
  });
