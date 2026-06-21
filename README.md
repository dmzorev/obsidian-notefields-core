# NoteFields Core

NoteFields Core brings richer, configurable property fields to Obsidian notes while keeping every value in standard YAML frontmatter.

Use Select, Multiselect, and nested object fields directly in the Properties view. Add display titles, Obsidian icons, colors, validation, and purpose-built editors without changing how your notes are stored. Other plugins can register additional field types through the public NoteFields API.

> [!IMPORTANT]
> NoteFields Core currently enhances note properties. Obsidian Bases integration is planned but is not part of the current release.

## Features

- **Select fields** with searchable options and optional custom values.
- **Multiselect fields** with colored pills, icons, filtering, and keyboard-friendly editing.
- **Nested object fields** for schema-less objects and lists, including recursive nesting and inline key editing.
- **Option metadata** with separate stored values, displayed titles, colors, and icons.
- **Vault option discovery** that can collect existing values from your notes.
- **Property display settings** for custom titles and built-in Obsidian icons.
- **Validation API** with messages, severity, and optional details.
- **Extensible field registry** that lets other plugins add custom property types and settings.
- **Frontmatter-first storage**: property values remain readable and editable without the plugin.

## How it works

NoteFields Core associates a global field definition with an Obsidian property name. The definition controls how that property is displayed, edited, normalized, and validated. It does not move the value out of the note.

For example:

```yaml
---
status: in-progress
tags-for-review:
  - design
  - copy
project:
  owner: Dmitry
  milestones:
    - Prototype
    - Release
---
```

The YAML remains standard YAML. NoteFields Core only adds the richer editing experience on top.

## Getting started

### Create a field

1. Add a property to a note.
2. Click the icon next to the property name.
3. Open **Property type** and choose **Select**, **Multiselect**, or **Nested object**.
4. NoteFields Core creates a field definition for that property automatically.

Field definitions are global for the vault and matched by property name.

### Configure a property

Click the property icon and use:

- **Display** to set the property name, displayed title, and icon.
- **Property settings** to configure behavior specific to the selected field type.
- Obsidian's standard **Property type** menu to change the type.

You can also manage all definitions under **Settings → NoteFields Core**.

### Configure Select and Multiselect

Each option can have:

- **Value**: the value written to frontmatter.
- **Title**: the label shown in the interface.
- **Icon**: any built-in Obsidian icon.
- **Color**: a preset or custom color.

Options can be configured manually, collected from existing notes, or combined from both sources. Enable **Allow custom values** to let users create values while editing a note.

### Edit nested objects

Nested object fields support strings, numbers, checkboxes, objects, and lists. Objects and lists can be nested recursively. Click an object key to rename it, use **Enter** to save, or **Escape** to cancel.

## Installation

### Community Plugins

After the plugin is accepted into the Obsidian Community Plugins directory:

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for **NoteFields Core**.
3. Select **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create `<vault>/.obsidian/plugins/notefields-core/`.
3. Place the three files in that directory.
4. Reload Obsidian and enable **NoteFields Core** under **Community plugins**.

## Data and privacy

- Note values are stored in each note's YAML frontmatter.
- Field definitions and option metadata are stored in the plugin's local `data.json` file inside the vault configuration directory.
- NoteFields Core does not send vault data to external services.
- The plugin does not require an account or network connection.

## Plugin API

Other Obsidian plugins can register custom field types through the enabled plugin instance:

```ts
const noteFields = (
  this.app as unknown as {
    plugins?: {
      getPlugin?: (id: string) => { api?: NoteFieldsApi } | null;
    };
  }
).plugins?.getPlugin?.("notefields-core")?.api;

const handle = noteFields?.registerType({
  id: "my-plugin:rating",
  ownerPluginId: this.manifest.id,
  name: "Rating",
  icon: "lucide-star",
  defaultConfig: { max: 5 },
  validate(value) {
    return typeof value === "number" ? true : "Expected a number.";
  },
  render(el, ctx) {
    const input = el.createEl("input", {
      attr: {
        max: String(ctx.config.max),
        min: "0",
        type: "number",
      },
      value: String(ctx.value ?? 0),
    });
    input.addEventListener("change", () => {
      ctx.onChange(Number(input.value));
    });
    return {
      type: "my-plugin:rating",
      focus: () => input.focus(),
    };
  },
});

this.register(() => handle?.dispose());
```

`validate` may return:

- `true`, `false`, `null`, or `undefined`.
- A string containing an error message.
- A structured result:

```ts
{
  valid: false,
  message: "Expected one of the configured options.",
  severity: "error",
  details: ["todo", "doing", "done"]
}
```

Custom field IDs should be namespaced with the owner plugin ID. Registered types may provide their own renderer, normalizer, validator, default configuration, icon, and settings UI.

## Current limitations

- Field definitions are global per vault and property name.
- Folder-specific and note-specific overrides are not yet supported.
- Obsidian Bases does not yet use NoteFields renderers.
- Only built-in Obsidian icons are supported.
- NoteFields integrates with parts of Obsidian's property system that are not yet exposed through a stable public API. Obsidian updates may occasionally require compatibility fixes.

## Development

Requirements:

- Node.js 20 or later.
- npm.

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run build
npm run lint
```

The production build creates `main.js` in the repository root.

## Releases

Release tags must exactly match the version in `manifest.json` and must not use a `v` prefix. A GitHub Actions workflow builds the plugin and creates a draft release containing the files required by Obsidian.

See [PUBLISHING.md](PUBLISHING.md) for the complete release and Community Plugins submission checklist.

## Support and contributing

Bug reports and feature requests are welcome in [GitHub Issues](https://github.com/dmzorev/notefields-core/issues). When reporting a problem, include your Obsidian version, NoteFields Core version, platform, and reproduction steps.

Pull requests are welcome. Please keep changes focused and run both the build and lint checks before submitting.

## Roadmap

Planned directions include:

- Obsidian Bases integration.
- Schema-backed object field types.
- Additional reusable types such as colors, icons, progress, integer, and rating fields.
- Folder-level field definitions and overrides.
- Optional integrations with popular icon pack plugins.
- APIs for richer property and media blocks in notes.

## License

[MIT](LICENSE) © 2026 [Dmitry Zorev](https://github.com/dmzorev)
