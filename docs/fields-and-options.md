---
layout: page
title: Fields and Option Collections
---

# Fields and option collections

[Documentation home](index.html) · [Getting started](getting-started.html) · [Bases](bases.html)

## Select

Select stores one YAML primitive and presents it as a searchable choice. It is useful for status, priority, category, owner, or any property with one active value.

## Multiselect

Multiselect stores a YAML list. Selected values appear as compact pills and remain visible while searching for another value. It is useful for labels, teams, dependencies, or workflow stages that may overlap.

## Configuring values

Each option can contain:

- **Value**: the string, number, or boolean written to YAML.
- **Displayed title**: the label shown to the user.
- **Aliases**: additional search terms.
- **Icon**: an optional built-in Obsidian icon.
- **Color**: a preset or custom color.
- **Metadata**: additional primitive data reserved for plugins.

Options have internal stable IDs. These IDs are not visible in notes or in normal settings. They let NoteFields preserve option identity when labels, colors, ordering, or stored values change.

## Local and shared collections

Use **Local options** when values belong to one property only. Use a shared collection when several fields should use the same choices, including a Select and Multiselect with different interfaces.

Shared collections are managed centrally in **Settings → NoteFields Core → Option collections**. Editing a shared option updates all connected fields. When its stored YAML value changes, NoteFields updates matching values in notes that use the collection.

## Value types

- **Text** converts compatible values to strings.
- **Number** stores numeric values.
- **Boolean** stores `true` or `false`.
- **Any** preserves primitive types and treats `1`, `"1"`, `false`, and `0` as different values.

Enable **Allow custom values** to enter values that are not yet listed. Enable **Remember custom values** to add them to the active collection automatically. **Collect values** scans the vault for values already used by the property.

Stored `[[wikilinks]]` remain strings, but NoteFields updates matching option values when the target note is renamed.

## Nested structures

Nested fields edit schema-less YAML objects and top-level lists of objects recursively. Supported child values include text, numbers, checkboxes, objects, and lists.

- Select a key to rename it.
- Press **Enter** to save or **Escape** to cancel.
- Select the type icon to change a child editor.
- Use **Add property** for objects and **Add item** for lists.
- Collapse large sections without losing their state during nearby edits.
- Choose whether an empty field starts as an object or a list of objects in property settings.
- Show compact object summaries always, only while collapsed, or never. The choice applies at every nesting level.
- Show or hide outer braces and brackets consistently in nested summaries and Bases previews.

Top-level lists keep every item as an editable object and add new items as `{}`. Invalid scalar items remain visible so they can be converted or removed instead of being discarded.

## Icon Picker and Color Picker

Icon Picker stores an icon ID as a string. Color Picker stores a color value as a string. Both can use curated collections created under **Option collections**.

The icon picker includes every icon bundled with Obsidian. The color picker includes the default Obsidian palette and a standard custom color control. System collections are generated at runtime and are not copied into plugin settings.
