# @mikode/tsconfig

Shared strict TypeScript configuration for MiKode projects.

## Install

```sh
pnpm add -D @mikode/tsconfig
```

## Usage

Extend the variant that matches your project in `tsconfig.json`:

```json
{
	"extends": "@mikode/tsconfig/node",
	"compilerOptions": {
		"outDir": "dist"
	},
	"include": ["src"]
}
```

Available entry points:

- `@mikode/tsconfig/base` — shared strictness options, no environment.
- `@mikode/tsconfig/node` — Node.js libraries and services.
- `@mikode/tsconfig/browser` — browser or universal code without JSX.
- `@mikode/tsconfig/react` — React code (extends `browser`).

See the [TypeScript standard](https://github.com/mikode13/engineering/blob/main/standards/typescript.md)
in `mikode-engineering` for the policy this package implements.

## License

This project is source-available, not open source. It is licensed under the MIT License
with the [Commons Clause License Condition v1.0](https://commonsclause.com/), which
restricts selling the software. See [LICENSE](./LICENSE) for the complete terms.
