# apps/cli AGENTS.md

Programmatic interface to the application. A thin command layer — business logic belongs in `packages/core`, not here. Rules here are more specific than root `AGENTS.md` — both apply.

---

## Purpose and vision

The CLI serves two roles:

1. **Today** — developer tooling, scripting, and a clean interface to drive app logic without a browser.
2. **Tomorrow** — foundation for an MCP server. Each CLI command maps naturally to an MCP tool. When that migration happens, `packages/core` controllers become the shared handlers for both.

## Running

```bash
# Dev (run directly with tsx — no build step needed)
pnpm dev hello --name Pablo

# List available commands
pnpm dev --help

# Build (compiles to dist/)
pnpm build

# Run compiled output
pnpm start hello --name Pablo
```

## Directory layout

```
src/
  index.ts          — entry point: creates the root Command, registers all commands, calls program.parse()
  commands/         — one file per command
    hello.ts        — example command
```

## Absolute imports

`tsconfig.json` uses `paths` for absolute imports (no `baseUrl`, no `@` prefix):

- `commands/*` → `./src/commands/*`

```ts
import { helloCommand } from 'commands/hello'; // ✅
import { helloCommand } from './commands/hello'; // ✅ also fine
import { helloCommand } from '@/commands/hello'; // ❌ wrong
```

## Using core

Import controllers from `packages/core` — the same way `apps/web` does.

```ts
import { Command } from 'commander';
import { UserController } from 'core/controllers/User';
import { NotFoundError } from 'core/entities/Error';

export const getUserCommand = new Command('get-user')
  .description('Fetch a user by ID')
  .argument('<id>', 'User ID')
  .action(async (id: string) => {
    try {
      const user = await UserController.getUser({ id });
      console.log(user);
    } catch (error) {
      if (error instanceof NotFoundError) {
        console.error(`User not found: ${id}`);
        process.exit(1);
      }
      throw error;
    }
  });
```

## Adding a command

1. Create `src/commands/your-command.ts` exporting a named `Command` instance:

```ts
import { Command } from 'commander';

interface YourCommandOptions {
  flag: string;
}

export const yourCommand = new Command('your-command')
  .description('What it does')
  .option('-f, --flag <value>', 'description', 'default')
  .action((options: YourCommandOptions) => {
    // implementation
  });
```

2. Import and register it in `src/index.ts`:

```ts
import { yourCommand } from 'commands/your-command';
program.addCommand(yourCommand);
```

**Rules:**

- Every command is a named export from its own file — no default exports.
- Options are typed with a local interface (`YourCommandOptions`).
- Never use `any` for options — define the interface properly.
- Keep `action` callbacks thin: call `packages/core` controllers, format output for the terminal.

## Path toward MCP

When adding an MCP server, the pattern is:

```
packages/core/src/controllers/your-domain.ts  ← shared logic
apps/cli/src/commands/your-command.ts          ← calls controller, formats for terminal
apps/mcp/src/tools/your-tool.ts               ← calls controller, formats for MCP protocol
```

Structure the CLI command logic so the heavy lifting is a controller call, not inlined in the `action` callback. That makes the MCP migration nearly zero-cost.

## Tech

- `tsx` — runs TypeScript directly in dev, no build step needed.
- `commander` — command parsing. Typed options via local interfaces.
- No DOM, no React. `lib: ["esnext"]` only.
