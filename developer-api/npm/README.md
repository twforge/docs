# @twforge/developer-api

The versioned service contract for the [TW Forge Developer API](https://docs.twforge.net/developer-api/).

The package contains:

| Path | Content |
|---|---|
| `@twforge/developer-api` | TypeScript types generated with [openapi-typescript](https://openapi-ts.dev/) (`paths`, `components`, `operations`). Types only, no runtime code. |
| `@twforge/developer-api/openapi.yaml` | The bundled OpenAPI document (YAML) |
| `@twforge/developer-api/openapi.json` | The bundled OpenAPI document (JSON) |

The package version is the contract version (`info.version` of the OpenAPI document) and follows semver:

- **major**: the API version, i.e. the `/api/vN` path (`1.x` describes `https://twforge.net/api/v1`). Breaking changes
  only happen with a new API version.
- **minor**: backwards-compatible additions (new endpoints, new optional fields)
- **patch**: backwards-compatible corrections of the spec, and changes that don't affect the API's shape
  (descriptions, examples, metadata, typo fixes)

Depend on `^1.x` to stay on API v1.

## Usage

```bash
npm install --save-dev @twforge/developer-api
```

```ts
import type { components, paths } from '@twforge/developer-api';

type TribeSkillActivation = components['schemas']['TribeSkillActivation'];
```

With [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) you get a small, fully typed client:

```ts
import createClient from 'openapi-fetch';
import type { paths } from '@twforge/developer-api';

const api = createClient<paths>({ baseUrl: 'https://twforge.net/api/v1' });
```

## License

MIT © TW Forge. The license covers this package (the API description and generated types); it does not grant access to the TW Forge API itself.
