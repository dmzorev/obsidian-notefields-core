---
layout: page
title: Value, Icon, and Color Options
---

# Value, icon, and color options

[Developer guide](index.html) · [Property types](property-types.html) · [API reference](api-reference.html)

## Value Options

A `ValueOption` separates the YAML value from presentation and search metadata:

```ts
interface ValueOption {
  id: string;
  value: string | number | boolean;
  label?: string;
  icon?: string;
  color?: string;
  aliases?: string[];
  meta?: Record<string, string | number | boolean>;
}
```

IDs are managed by Core and are not written to frontmatter. Preserve IDs when updating existing options.

## Bindings

`ValueOptionBinding` is either local or shared:

```ts
type ValueOptionBinding =
  | {
      mode: "local";
      valueType: "string" | "number" | "boolean" | "any";
      options: ValueOption[];
    }
  | {
      mode: "shared";
      collectionId: string;
    };
```

An extension opts into the standard option UI through `optionSupport`:

```ts
interface ChoiceConfig {
  options: ValueOptionBinding;
}

const type: PropertyType<ChoiceConfig> = {
  id: "my-plugin:choice",
  name: "Choice",
  defaultConfig: {
    options: {
      mode: "local",
      valueType: "string",
      options: [],
    },
  },
  optionSupport: {
    kind: "value",
    getBinding: (config) => config.options,
    setBinding: (config, options) => ({ ...config, options }),
    allowLocal: true,
    allowShared: true,
  },
  render(el, ctx) {
    // Custom UI goes here.
    return { type: "my-plugin:choice" };
  },
};
```

## Standard options editor

Extensions can embed the same editor used by built-in Select and Multiselect fields:

```ts
api.renderValueOptionsEditor(el, {
  binding: ctx.definition.config.options,
  propertyName: ctx.definition.property,
  onChange: async (options) => {
    const definition = ctx.getDefinition?.() ?? ctx.definition;
    await ctx.updateDefinition({
      ...definition,
      config: { ...definition.config, options },
    });
  },
});
```

Use `resolveValueOptions(binding)` to obtain the effective options regardless of whether the binding is local or shared.

## Atomic updates

Prefer `patchValueOption`, `patchPropertyValueOption`, `patchIconOption`, and `patchColorOption` when changing one option. They reload the latest collection before applying the patch, reducing the chance of one modal overwriting another change.

## Icon and color catalogs

Icon and color collections follow the same stable-ID model but have specialized option shapes and editors.

```ts
api.openIconPicker(currentIcon, async (icon) => {
  await saveIcon(icon);
});

api.openColorPicker(currentColor, async (color) => {
  await saveColor(color);
});
```

Pass a collection ID as the third argument to limit a picker. Call `resolveIconOptions()` or `resolveColorOptions()` without an ID to retrieve the merged system and user catalog.

System collection IDs are available through `getSystemIconCollectionId()` and `getSystemColorCollectionId()`. System collections are virtual and read-only.
