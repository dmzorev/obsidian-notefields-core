---
layout: page
title: Property Type Contract
---

# Property type contract

[Developer guide](index.html) · [Create an extension](getting-started.html) · [Options API](options-api.html)

## Registration

`registerType` accepts a `PropertyTypeRegistration<TConfig>`. It contains the field contract plus `ownerPluginId` and an optional numeric `priority`.

Required members:

- `id`: stable, namespaced type ID.
- `name`: user-facing type name.
- `defaultConfig`: configuration copied when assigning the type.
- `render`: renderer for note properties and fallback renderer for Bases.
- `ownerPluginId`: plugin responsible for the registration.

Optional members:

- `description` and `icon` for type menus.
- `validate` for user-facing validation.
- `normalize` before rendering or writing values.
- `renderBase` for a Bases-specific UI.
- `renderSettings` for per-property configuration.
- `optionSupport` for the shared Value Options framework.

## Render context

`PropertyRenderContext<TConfig>` provides:

| Member | Purpose |
| --- | --- |
| `app` | Current Obsidian application. |
| `config` | Configuration stored in the property definition. |
| `definition` | Full NoteFields property definition. |
| `key` | Property key being rendered. |
| `sourcePath` | Path of the note that owns the value. |
| `value` | Current YAML value. |
| `onChange(value)` | Writes a new value through Obsidian. |
| `blur()` | Ends the active edit session. |
| `validate(value)` | Runs the registered validator and returns a normalized result. |

The renderer returns a `PropertyWidgetComponent`:

- `type`: the registered type ID.
- `focus?()`: transfers focus into the editor.
- `setValue?(value)`: updates the existing DOM without recreating the component.
- `destroy?()`: releases listeners or resources owned by the renderer.

Implement `setValue` whenever practical. Obsidian and Bases can update a cell while keeping the current component alive.

## Bases renderer

`renderBase` uses the same context and component contract as `render`. Use it when table cells need a more compact preview or a different focus model. If omitted, Core calls `render` in Bases.

Keep inactive table cells single-line and bounded. Editors may expand while focused, but should return to their compact state after calling `ctx.blur()` or losing focus.

## Validation

Validators may return:

- `true`, `null`, or `undefined` for valid values;
- `false` for a generic error;
- a string for a specific error;
- a structured result.

```ts
return {
  valid: false,
  message: "Expected one of the configured values.",
  severity: "warning",
  details: ["todo", "doing", "done"],
};
```

Use errors when the stored value is incompatible with the field. Use warnings for recoverable states such as a numeric value that does not match a preferred step.

## Normalization

`normalize(value, ctx)` can coerce or sanitize a value before the field renders it. Normalization should be deterministic and should preserve valid YAML primitives. Avoid silently discarding user data.

## Property settings

`renderSettings(el, ctx)` receives a `PropertySettingsContext<TConfig>` with the current definition and `updateDefinition`.

Always retrieve the latest definition before applying an asynchronous change:

```ts
const definition = ctx.getDefinition?.() ?? ctx.definition;

await ctx.updateDefinition({
  ...definition,
  config: {
    ...definition.config,
    max: 10,
  },
});
```

This avoids overwriting changes made by another control while a picker or modal was open.
