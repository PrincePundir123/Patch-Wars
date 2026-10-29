# Credits

Original project work includes the engine, ability interpreter, server, UI, fixtures, fallback PixiJS silhouettes and CSS. The UI redesign adds two original OpenAI-generated raster assets, encoded as WebP: a matte arena environment and a six-unit atlas. Their provenance and layout are documented in apps/web/public/art/README.md. No competitor artwork, Riot assets, external music or proprietary source is included in the production app. TFT screenshots remain local reference material in the ignored .data directory.

| Library             | Purpose                                             | License      |
| ------------------- | --------------------------------------------------- | ------------ |
| Phosphor Icons      | UI icons and favicon                                | MIT          |
| React / React DOM   | UI                                                  | MIT          |
| Vite                | Development/build                                   | MIT          |
| TypeScript          | Type checking                                       | Apache-2.0   |
| PixiJS              | Animated renderer                                   | MIT          |
| Zustand             | Browser snapshot state                              | MIT          |
| React Router        | Routes                                              | MIT          |
| Fastify and plugins | HTTP, cookies, rate limits, static serving, sockets | MIT          |
| ws                  | WebSocket transport                                 | MIT          |
| Zod                 | Runtime schemas                                     | MIT          |
| OpenAI Codex SDK    | Guarded optional provider                           | Apache-2.0   |
| dotenv              | Local configuration                                 | BSD-2-Clause |
| Vitest              | Automated tests                                     | MIT          |
| Playwright          | Browser verification                                | Apache-2.0   |
| esbuild             | Bundles                                             | MIT          |
| ESLint / Prettier   | Code quality                                        | MIT          |
| pnpm                | Workspace installation                              | MIT          |

Exact versions and transitive dependencies are pinned in pnpm-lock.yaml. Package license files shipped by their authors govern redistribution. The generated `dependency-licenses.json` records installed direct package metadata. Reference projects in competitive-analysis.md were studied, not incorporated.
