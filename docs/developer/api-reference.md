---
layout: page
title: API Reference
---

# API reference

[Developer guide](index.html) · [Property types](property-types.html) · [Options API](options-api.html)

The public type surface is exported from `src/public-api.ts`. The runtime object implements `NoteFieldsApi` and currently reports `apiVersion: 1`.

## Property definitions and types

| Method | Description |
| --- | --- |
| `getPropertyDefinition(name)` | Returns one definition or `null`. |
| `getPropertyDefinitions()` | Returns every managed definition. |
| `setPropertyDefinition(definition)` | Creates or replaces a definition. |
| `patchPropertyDefinition(name, patch)` | Atomically patches a definition and reports whether it existed. |
| `removePropertyDefinition(name)` | Removes a managed definition without deleting note values. |
| `getRegisteredType(id)` | Returns a registered type or `null`. |
| `getRegisteredTypes()` | Returns all registered types sorted by name. |
| `registerType(registration)` | Registers a type and returns a disposable handle. |
| `validateValue(name, value)` | Validates a value using the property's current type. |

Set `typeMenuVisibility: "hidden"` on a type registration when it is an implementation detail that must keep rendering existing definitions but must never appear in property type selectors.

## Managed property presets

Managed presets let an extension bind a hidden type to a global property name without exposing that type for manual assignment.

| Method | Description |
| --- | --- |
| `getPropertyPreset(ownerPluginId, presetId)` | Returns the definition currently owned by a preset. |
| `syncPropertyPreset(registration)` | Creates, updates, moves, or adopts an owned definition. Returns a conflict instead of overwriting another definition. |
| `removePropertyPreset(ownerPluginId, presetId)` | Releases the owned definition without deleting frontmatter values. |

A preset definition stores `managedBy.ownerPluginId`, `managedBy.presetId`, and `managedBy.lockType`. Locked definitions cannot be renamed, removed, or assigned another type through regular Core controls. Their display title, icon, visibility, and type-specific config can still be edited. The initial visibility defaults to `hidden`, but later synchronization preserves the user's visibility choice.

`PropertyDefinition.visibility` accepts `visible`, `hidden`, or `hidden-when-empty`. It controls note Properties presentation only; it does not remove frontmatter or hide Bases columns. The field is optional for API compatibility and defaults to `visible` during normalization.

## Property block actions

`registerPropertyBlockAction(registration)` adds a disposable icon action to the right side of the Properties heading. Actions receive the current `TFile`, the metadata container, and the Obsidian app. Use `isVisible(context)` for note-specific availability and dispose the returned handle when the extension unloads.

The action zone is shared with Core's hidden-property toggle, so extensions should use this API instead of inserting buttons into `.metadata-properties-heading` directly.

## Value options

| Method | Description |
| --- | --- |
| `getOptions(propertyName, sourceFile?)` | Resolves options for a managed property, including configured discovery behavior. |
| `createValueOption(input)` | Normalizes input and assigns an ID when needed. |
| `getValueOptionCollections()` | Lists shared value collections. |
| `getValueOptionCollection(id)` | Returns one shared collection. |
| `createValueOptionCollection(input)` | Creates a shared collection. |
| `updateValueOptionCollection(collection)` | Replaces a shared collection and propagates stored-value changes. |
| `patchValueOption(collectionId, optionId, patch)` | Atomically patches one shared option. |
| `patchPropertyValueOption(property, optionId, patch)` | Atomically patches one local property option. |
| `removeValueOptionCollection(id)` | Removes an unused shared collection. |
| `resolveValueOptions(binding)` | Resolves local or shared bindings to concrete options. |
| `renderValueOptionsEditor(el, context)` | Renders the standard binding and options editor. |

## Icon options

| Method | Description |
| --- | --- |
| `createIconOption(input)` | Normalizes an icon option. |
| `getSystemIconCollectionId()` | Returns the virtual built-in collection ID. |
| `getIconOptionCollections()` | Lists user icon collections. |
| `getIconOptionCollection(id)` | Returns one user collection. |
| `createIconOptionCollection(input)` | Creates a collection. |
| `updateIconOptionCollection(collection)` | Replaces a collection. |
| `patchIconOption(collectionId, optionId, patch)` | Atomically patches one icon. |
| `removeIconOptionCollection(id)` | Removes a collection. |
| `resolveIconOptions(collectionId?)` | Resolves one collection or the merged catalog. |
| `openIconPicker(current, onChoose, collectionId?)` | Opens the shared icon picker. |

## Color options

| Method | Description |
| --- | --- |
| `createColorOption(input)` | Normalizes a color option. |
| `getSystemColorCollectionId()` | Returns the virtual default palette ID. |
| `getColorOptionCollections()` | Lists user color collections. |
| `getColorOptionCollection(id)` | Returns one user collection. |
| `createColorOptionCollection(input)` | Creates a collection. |
| `updateColorOptionCollection(collection)` | Replaces a collection. |
| `patchColorOption(collectionId, optionId, patch)` | Atomically patches one color. |
| `removeColorOptionCollection(id)` | Removes a collection. |
| `resolveColorOptions(collectionId?)` | Resolves one collection or the merged catalog. |
| `openColorPicker(current, onChoose, collectionId?)` | Opens the shared color picker. |

## UI refresh

`refresh()` asks Core to update active property views after an external state change. Core mutation methods already refresh automatically; call it only when an extension changes presentation state that Core cannot observe.
