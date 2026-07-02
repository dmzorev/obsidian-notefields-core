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

`PropertyDefinition.visibility` accepts `visible`, `hidden`, or `hidden-when-empty`. It controls note Properties presentation only; it does not remove frontmatter or hide Bases columns. The field is optional for API compatibility and defaults to `visible` during normalization.

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
