---
layout: page
title: Create an Extension Plugin
---

# Create an extension plugin

[Developer guide](index.html) · [Property types](property-types.html) · [API reference](api-reference.html)

## Add Core as a type dependency

NoteFields Core publishes its public TypeScript surface through `src/public-api.ts`. During local development, use a file dependency or pin a GitHub commit:

```json
{
  "devDependencies": {
    "notefields-core": "https://codeload.github.com/dmzorev/obsidian-notefields-core/tar.gz/<commit>"
  }
}
```

Always use `import type` so Core code is erased from the extension bundle:

```ts
import type {
  NoteFieldsApi,
  PropertyType,
  PropertyTypeHandle,
} from "notefields-core";
```

Core remains a separately installed and enabled Obsidian plugin at runtime.

## Discover the runtime API

Obsidian does not currently expose community plugin lookup as a typed public API, so keep the adapter small and isolated:

```ts
import type { App } from "obsidian";
import type { NoteFieldsApi } from "notefields-core";

interface AppWithPlugins extends App {
  plugins?: {
    getPlugin?: (id: string) => { api?: NoteFieldsApi } | null;
  };
}

export function getNoteFieldsApi(app: App): NoteFieldsApi | null {
  const api = (app as AppWithPlugins).plugins
    ?.getPlugin?.("notefields-core")
    ?.api;

  return api?.apiVersion === 1 ? api : null;
}
```

Extensions should tolerate Core loading after them. Attempt registration on layout ready and reconnect if Core is reloaded.

## Register a field type

```ts
interface ProgressConfig {
  max: number;
}

const type: PropertyType<ProgressConfig> = {
  id: "my-plugin:progress",
  name: "Progress",
  icon: "lucide-gauge",
  description: "A bounded numeric progress field.",
  defaultConfig: { max: 100 },

  validate(value, ctx) {
    if (typeof value !== "number") return "Expected a number.";
    if (value < 0 || value > ctx.config.max) {
      return `Expected a value between 0 and ${ctx.config.max}.`;
    }
    return true;
  },

  render(el, ctx) {
    const input = el.createEl("input", {
      attr: {
        max: String(ctx.config.max),
        min: "0",
        type: "range",
      },
      value: String(ctx.value ?? 0),
    });

    input.addEventListener("change", () => {
      ctx.onChange(Number(input.value));
    });

    return {
      type: "my-plugin:progress",
      focus: () => input.focus(),
      setValue: (value) => {
        input.value = String(value ?? 0);
      },
    };
  },
};

const handle = api.registerType({
  ...type,
  ownerPluginId: this.manifest.id,
});

this.register(() => handle.dispose());
```

## Build boundary

After building, search the extension bundle for Core implementation names. The bundle should contain the plugin ID used for runtime discovery, but not `NoteFieldsCoreApi`, registry classes, or Core source modules.

```bash
rg "NoteFieldsCoreApi|PropertyTypeRegistry|src/api" main.js
```

See the [Property type contract](property-types.html) for render lifecycles and settings.
