---
layout: page
title: Contributing
---

# Contributing

[Developer guide](index.html) · [Documentation home](../index.html)

## Requirements

- Node.js 20 or later
- npm

## Development

```bash
npm install
npm run dev
```

The development task watches TypeScript and rebuilds `main.js`. Reload the plugin in a dedicated development vault after changes.

## Production checks

```bash
npm run lint
npm run build
```

Keep changes focused and avoid committing generated or unrelated vault files. Test note property editing and Bases rendering when changing widgets or adapter behavior.

## Releases

Release tags must exactly match the version in `manifest.json` and must not use a `v` prefix. GitHub Actions builds a draft release containing the Obsidian plugin assets.

See [`PUBLISHING.md`](https://github.com/dmzorev/obsidian-notefields-core/blob/main/PUBLISHING.md) for the complete release and Community Plugins submission checklist.
