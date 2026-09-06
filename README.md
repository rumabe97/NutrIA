# TRC Template

This is a custom TurboRepo starter built upon the original Turborepo core template, tailored for cleaner structure and more scalable configuration management.

## Getting Started

To create a new project using this template:

```sh
pnpm dlx create-turbo@latest --example https://github.com/therootkitcompany/trc-template
```

## What's inside?

This monorepo includes the following structure:

### Apps

- `web`: a Next.js app using TypeScript and a minimal default UI setup

### Packages

- `ui`: a simple, reusable React UI component library

### Configurations

Instead of traditional package-based configs, this repo centralizes shared configurations in a dedicated configurations/ directory:

- `configurations/eslint`: ESLint config shared across the repo.
- `configurations/typescript`: tsconfig.json base configurations.
- `configurations/prettier`: Prettier config and rules.

### Build

To build all apps and packages, run the following command:

```
cd trc-template
pnpm build
```

### Develop

To develop all apps and packages, run the following command:

```
cd trc-template
pnpm dev
```

## Useful Links

Learn more about the power of Turborepo:

- [Tasks](https://turbo.build/docs/core-concepts/monorepos/running-tasks)
- [Caching](https://turbo.build/docs/core-concepts/caching)
- [Remote Caching](https://turbo.build/docs/core-concepts/remote-caching)
- [Filtering](https://turbo.build/docs/core-concepts/monorepos/filtering)
- [Configuration Options](https://turbo.build/docs/reference/configuration)
- [CLI Usage](https://turbo.build/docs/reference/command-line-reference)
