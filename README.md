# NoteFields Core

Turn Obsidian properties into practical, structured fields without giving up plain YAML.

NoteFields Core adds better ways to choose, organize, and edit metadata directly inside notes and Obsidian Bases. Your values remain readable frontmatter, so notes still work without the plugin and stay compatible with the rest of the Obsidian ecosystem.

<!-- Screenshot slot: docs/assets/images/notefields-overview.png
Capture one note showing Select, Multiselect, Icon Picker, Color Picker, and a collapsed Nested object.
![Several NoteFields property types inside an Obsidian note](docs/assets/images/notefields-overview.png)
-->

## Why NoteFields?

Obsidian properties are useful, but larger vaults often need more than plain text boxes and generic lists. NoteFields Core gives frequently reused properties a consistent interface and keeps their possible values, labels, colors, and icons under control.

Use it to:

- choose one value with a searchable **Select** field;
- assign several values with a compact **Multiselect** field;
- edit objects and lists with recursive **Nested fields**;
- choose built-in Obsidian icons and reusable colors;
- hide internal properties until you choose to reveal them;
- reuse the same option set across multiple properties;
- work with the same rich fields in notes and Bases tables.

## Rich fields, standard notes

NoteFields changes how a property is displayed and edited, not where its value is stored.

```yaml
---
status: in-progress
reviewers:
  - design
  - editorial
project:
  owner: Dmitry
  milestones:
    - Prototype
    - Release
---
```

The example above remains ordinary YAML. You can edit it in Source mode, query it from Bases, process it with other plugins, or open the vault without NoteFields installed.

## Included field types

### Select and Multiselect

Create searchable choices with optional display labels, aliases, icons, and colors. Allow custom values when a field needs to stay flexible, or keep the list controlled for consistent metadata.

Option collections can be local to one property or shared across several properties. Updating a shared collection updates every field that uses it.

<!-- Screenshot slot: docs/assets/images/option-collections.png
Capture the editor for a shared option collection with labels, icons, and colors visible.
![Editing reusable options in NoteFields Core](docs/assets/images/option-collections.png)
-->

### Nested fields

Edit YAML objects and top-level lists of objects without switching to Source mode. Nested fields support text, numbers, checkboxes, objects, and lists at any depth. Keys can be renamed inline, and each nested value can use an appropriate editor.

<!-- Screenshot slot: docs/assets/images/nested-fields.png
Capture an expanded object containing a nested object, a list, a checkbox, and an empty property.
![Editing a recursive nested object inside an Obsidian note](docs/assets/images/nested-fields.png)
-->

### Icon and Color Picker

Store a simple icon ID or color value while choosing it through a visual picker. Create focused icon sets and color palettes for a project, workflow, or vault.

### Obsidian Bases

Select, Multiselect, Nested, Icon, and Color fields work in Bases tables. Compact previews keep rows readable; selecting a cell opens the full editor when more space is needed.

<!-- Screenshot slot: docs/assets/images/bases-fields.png
Capture a Bases table with Select, Multiselect, Nested, Icon, and Color columns plus one active editor.
![NoteFields property types in an Obsidian Bases table](docs/assets/images/bases-fields.png)
-->

## Getting started

1. Add a property to a note.
2. Select the icon next to its name.
3. Open **Property type** and choose a NoteFields type.
4. Use **Property settings** to configure options and behavior.

Definitions are matched globally by property name within the vault. Once `status` is configured as a Select field, every `status` property uses the same field definition.

Open **Display** to keep an internal property hidden or hide it only while empty. A small eye button in the Properties heading reveals hidden rows without changing their YAML values. Hidden properties remain visible in Source mode and are not removed from notes.

For a more detailed walkthrough, see the [Getting started guide](docs/getting-started.md).

## Installation

### Community Plugins

After NoteFields Core is available in the Obsidian Community Plugins directory:

1. Open **Settings → Community plugins**.
2. Select **Browse** and search for **NoteFields Core**.
3. Select **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the latest GitHub release.
2. Create `<vault>/.obsidian/plugins/notefields-core/`.
3. Place the three files in that directory.
4. Reload Obsidian and enable **NoteFields Core**.

## Data and privacy

- Note values stay in YAML frontmatter.
- Field definitions and option metadata are stored in the plugin's local `data.json`.
- NoteFields Core makes no network requests and includes no telemetry.
- No account or external service is required.

## Extensions and API

NoteFields Core can be extended by other Obsidian plugins. Extensions can add new field types, validation, settings, note renderers, Bases renderers, and integrations with reusable value, icon, and color collections.

Extensions can also register managed property presets: plugin-owned properties bound globally by name, backed by hidden field types, and protected from accidental type changes.

This API is primarily for plugin developers. See the [developer documentation](docs/developer/index.md) and the [NoteFields Rating reference plugin](https://github.com/dmzorev/obsidian-notefields-rating) for a complete independent integration.

## Documentation

- [Documentation home](docs/index.md)
- [Getting started](docs/getting-started.md)
- [Fields and option collections](docs/fields-and-options.md)
- [Using NoteFields in Bases](docs/bases.md)
- [Developer guide](docs/developer/index.md)

The `/docs` directory is structured for publishing with GitHub Pages.

## Current limitations

- Field definitions are global per vault and property name.
- Folder-specific and note-specific overrides are not yet supported.
- Bases integration currently focuses on table views.
- The built-in picker uses Obsidian's bundled icons; third-party icon-pack integration is not yet included.
- Parts of Obsidian's property system are not exposed through a stable public API, so major Obsidian updates may occasionally require compatibility fixes.

## Support and contributing

Bug reports and feature requests are welcome in [GitHub Issues](https://github.com/dmzorev/obsidian-notefields-core/issues). Include your Obsidian version, NoteFields Core version, platform, and reproduction steps.

Development and release instructions are available in [the developer documentation](docs/developer/contributing.md) and [PUBLISHING.md](PUBLISHING.md).

## License

[MIT](LICENSE) © 2026 [Dmitry Zorev](https://github.com/dmzorev)
