# Changelog

All notable changes to NoteFields Core will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Compact nested object previews with focus-to-edit behavior in Obsidian Bases tables.

### Fixed

- Multiselect values in Bases tables now remain left-aligned on one line when the cell is too narrow.

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
