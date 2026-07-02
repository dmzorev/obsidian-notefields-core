---
layout: page
title: Developer Guide
---

# Developer guide

[Documentation home](../index.html) · [Create an extension](getting-started.html) · [API reference](api-reference.html)

NoteFields Core exposes a versioned runtime API for independent Obsidian plugins. An extension can register a field type with its own configuration, validation, note renderer, Bases renderer, and settings UI without bundling the Core implementation.

## What the API provides

- A property type registry with owner-aware disposal.
- Render contexts for notes and Bases.
- Property-specific configuration and settings UI.
- Validation and normalization hooks.
- Local and reusable Value Option collections.
- Reusable icon and color collections and pickers.
- Property definition CRUD and UI refresh.

## Recommended reading order

1. [Create an extension plugin](getting-started.html)
2. [Property type contract](property-types.html)
3. [Value, icon, and color options](options-api.html)
4. [API reference](api-reference.html)

The [NoteFields Rating plugin](https://github.com/dmzorev/obsidian-notefields-rating) is the canonical reference implementation. It registers an interactive numeric field, supplies separate note and Bases rendering, exposes per-property settings, and imports Core only for TypeScript contracts.

## Stability

Check `api.apiVersion` before registering an extension. The current API version is `1`. Additive methods may arrive without changing the version; incompatible contract changes will require a new API version.

Custom type IDs must be namespaced with the extension plugin ID, for example `my-plugin:rating`.
