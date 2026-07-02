# Changelog

All notable changes to NoteFields Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Compact nested object previews with focus-to-edit behavior in Obsidian Bases tables.
- Optional `renderBase` API for field types that need a dedicated Obsidian Bases presentation.
- Nested preview settings for outer braces and expanded nested values.
- Property type menus on nested keys and list items.
- Reusable Value Option collections for Select, Multiselect, and third-party field types.
- Text, number, boolean, and mixed YAML value types for option sets.
- Search aliases and serializable custom metadata on individual options.
- Public APIs for collection management, option resolution, and the standard options editor.
- Automatic collection updates for custom values created while editing notes.
- On-demand collection of existing property values from notes.
- Automatic frontmatter updates when an option value changes.
- Wikilink updates in stored options when their target note is renamed.
- Reusable icon collections backed by the complete built-in Obsidian icon catalog.
- Reusable color collections with the standard Obsidian color picker.
- Collection-aware icon and color pickers with labels and alias search.
- Public icon and color collection CRUD, resolver, and picker APIs.

### Fixed

- Rapid edits to option labels, aliases, icons and colors no longer overwrite one another with stale collection snapshots.
- Text option edits are now persisted after a short debounce even when the editor modal closes immediately.
- Property type controls now include standard Obsidian types alongside NoteFields types.
- Picker and editor modals now stay within the available viewport.
- Multiselect values in Bases tables now remain left-aligned on one line when the cell is too narrow.
- Nested editors now return to their compact preview when focus leaves the Bases cell.
- Nested add and delete actions keep the Bases editor open across value updates.
- Nested empty text values and add controls now follow the compact Obsidian properties style.
- NoteFields values now use the same small horizontal inset as standard Bases values.
- Select and Multiselect fields now clip predictably in narrow Bases columns without overlapping adjacent cells.

### Changed

- Plugin settings now use compact property and collection lists with focused editor modals.
- Creating icon and color collections no longer inserts large editors into the settings page.

## [1.0.0] - 2026-06-21

### Added

- Extensible property type registry and public plugin API.
- Select and Multiselect property editors with configurable values, titles, icons, and colors.
- Manual, vault-collected, and combined option sources.
- Recursive schema-less nested object and list editor.
- Inline editing for nested object keys.
- Property icons and displayed titles for managed and standard properties.
- Property-specific settings available from the note property menu.
- Structured validation results with messages, severity, and details.

[Unreleased]: https://github.com/dmzorev/notefields-core/compare/1.0.0...HEAD
[1.0.0]: https://github.com/dmzorev/notefields-core/releases/tag/1.0.0
