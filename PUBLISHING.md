# Publishing NoteFields Core

This checklist follows the official [Obsidian plugin submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin).

## Before the first release

- Create the public GitHub repository at `dmzorev/notefields-core`.
- Point this local repository's remote to the new repository.
- Confirm `manifest.json`, `package.json`, and `versions.json` use the same release version.
- Confirm the plugin ID remains `notefields-core`. Community plugin IDs cannot be changed after publication without creating a new plugin.
- Run `npm ci`, `npm run build`, and `npm run lint`.
- Test the generated `main.js`, `manifest.json`, and `styles.css` in a clean vault.

## Create a release

1. Start from a clean working tree on the `main` branch.
2. Update the version with `npm version patch`, `npm version minor`, or `npm version major`. The npm lifecycle updates `manifest.json` and `versions.json`, then creates the commit and tag.
3. Push the version commit and generated tag with `git push --follow-tags origin main`. The tag must match `manifest.json` exactly and must not start with `v`.
4. The release workflow creates a draft GitHub release.
5. Review the release notes and publish the draft.
6. Verify that the release contains these separate assets:
   - `main.js`
   - `manifest.json`
   - `styles.css`

## Submit to Community Plugins

Add this entry to `community-plugins.json` in a fork of [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases):

```json
{
  "id": "notefields-core",
  "name": "NoteFields Core",
  "author": "Dmitry Zorev",
  "description": "Adds richer note property types, editors, validation, icons, colors, and an API for extending Obsidian properties.",
  "repo": "dmzorev/notefields-core",
  "branch": "main"
}
```

The `id`, `name`, `author`, and `description` values must exactly match `manifest.json`.

Open the submission pull request using the Community Plugin template and complete every checklist item. The release must be public before submitting the pull request.

## Future releases

After the plugin is accepted, no further pull request to `obsidian-releases` is needed. Update the version, create a matching tag, and publish the generated GitHub release.
