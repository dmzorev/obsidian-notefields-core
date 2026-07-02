---
layout: page
title: Data and Compatibility
---

# Data model and compatibility

[Documentation home](index.html) · [Getting started](getting-started.html)

## Note values

Values remain in each note's YAML frontmatter. NoteFields does not replace frontmatter with a database or proprietary storage layer.

## Plugin settings

The plugin stores field definitions, reusable options, icons, colors, and display preferences in `.obsidian/plugins/notefields-core/data.json` inside the vault configuration directory.

Deleting or disabling the plugin leaves note values untouched. Rich editors and display metadata are unavailable until the plugin is enabled again.

## Definition scope

Definitions are currently global to the vault and matched by normalized property name. Folder-specific and note-specific overrides are not yet supported.

## Privacy

NoteFields Core does not require an account, send telemetry, or make network requests. All note and configuration data stays in the vault.

## Compatibility

The plugin uses standard YAML values and aims to coexist with other metadata tools. Some UI integration depends on parts of Obsidian's property system that do not yet have a stable public API. Major Obsidian releases may occasionally require compatibility updates.
