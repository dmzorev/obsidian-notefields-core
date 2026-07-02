---
layout: page
title: Getting Started
---

# Getting started

[Documentation home](index.html) · [Fields and options](fields-and-options.html) · [Bases](bases.html)

## Install NoteFields Core

When the plugin is available through Community Plugins, install it from **Settings → Community plugins → Browse**. For manual installation, place `main.js`, `manifest.json`, and `styles.css` in `<vault>/.obsidian/plugins/notefields-core/`, reload Obsidian, and enable the plugin.

## Configure your first Select field

1. Open a note and add a property such as `status`.
2. Select the icon next to the property name.
3. Open **Property type**.
4. Choose **Select** in the NoteFields section.
5. Open **Property settings** and add values such as `todo`, `in-progress`, and `done`.
6. Optionally give each value a display title, icon, color, and search aliases.

NoteFields creates the field definition automatically. Other notes that use the same `status` property immediately receive the same editor.

## Property display

Open **Display** from the property menu to configure:

- **Property name**: the real YAML key.
- **Displayed title**: an optional label shown in the UI.
- **Icon**: a built-in Obsidian icon shown beside the property.
- **Visibility**: keep the property visible, always hide it, or hide it only while empty.

Changing the displayed title does not rename the YAML key. Renaming the property name updates the actual property while preserving its NoteFields definition.

Hidden properties stay in frontmatter. Use the eye button in the Properties heading to reveal them temporarily in the current note. Source mode continues to show the complete YAML, and this setting does not hide columns in Bases.

## Property settings

The available settings depend on the selected field type. Select and Multiselect expose option behavior; Nested exposes compact Bases display preferences; extension plugins can provide their own settings.

All configured properties can also be managed from **Settings → NoteFields Core**. Hiding a registered type under **Property type menu visibility** only removes it from menus for new assignments. Existing fields of that type continue to work.

## Next steps

- Learn how to share values between properties in [Fields and option collections](fields-and-options.html).
- Learn about table rendering in [Obsidian Bases](bases.html).
- Review storage behavior in [Data model and compatibility](data-and-compatibility.html).
