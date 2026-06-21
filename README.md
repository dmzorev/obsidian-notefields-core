# Properties Framework

Properties Framework is an Obsidian plugin prototype for richer note property types.

The value itself stays in note frontmatter. The plugin adds a registry that maps a
property name to a richer type definition with custom rendering, editing,
normalization and validation.

## Prototype scope

- Global property definitions by property name.
- Built-in `select`, `multiselect` and schema-less `nested object` types.
- Manual select options and options collected from existing notes.
- Built-in Obsidian icon ids for managed properties.
- Public `plugin.api` for other plugins to register property types.
- Automatic framework definition creation when a framework type is selected
  from the note property type menu.
- Inline property menu actions for icon, displayed title and type settings.

Bases integration, per-folder overrides, external icon packs, media property
blocks, banners and covers are intentionally outside the first prototype.

## External plugin API

Other plugins can read the API from the enabled plugin instance:

```ts
const framework = this.app.plugins.getPlugin("obsidian-props-framework")?.api;

const handle = framework?.registerType({
  id: "my-plugin:rating",
  ownerPluginId: this.manifest.id,
  name: "Rating",
  icon: "lucide-star",
  defaultConfig: { max: 5 },
  validate(value) {
    return typeof value === "number"
      ? true
      : "Expected a number.";
  },
  render(el, ctx) {
    el.empty();
    const input = el.createEl("input", {
      attr: { type: "number", min: "0", max: String(ctx.config.max) },
      value: String(ctx.value ?? 0),
    });
    input.addEventListener("change", () => ctx.onChange(Number(input.value)));
    return { type: "my-plugin:rating", focus: () => input.focus() };
  },
});

this.register(() => handle?.dispose());
```

`validate` can return `true`, `false`, a string error message, or a structured
result:

```ts
{
  valid: false,
  message: "Expected one of the configured options.",
  severity: "error",
  details: ["todo", "doing", "done"]
}
```

## Development

```bash
npm install
npm run build
```
