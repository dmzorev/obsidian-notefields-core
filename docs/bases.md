---
layout: page
title: Obsidian Bases
---

# Obsidian Bases

[Documentation home](index.html) · [Getting started](getting-started.html) · [Fields and options](fields-and-options.html)

NoteFields field definitions apply to the same property in notes and Obsidian Bases. No second configuration is required.

## Table display

- Select and Multiselect use compact, single-line values and clip overflow in narrow columns.
- Icon and Color fields keep their visual picker representation.
- Nested fields use a concise one-line summary when the cell is not active.
- Empty Nested objects display as an empty cell rather than explanatory placeholder text.

## Editing

Select or focus a cell to enter edit mode. Select, Multiselect, and Nested editors can expand beyond a narrow cell while active, then return to the compact display after focus leaves the editor.

Buttons inside an expanded Nested editor keep the editor open, so adding an item or property does not collapse the cell prematurely.

## Nested display settings

Nested fields provide settings specifically for Bases:

- show or hide braces or brackets around the root structure;
- summarize nested objects and arrays by item count;
- expand nested values into a more descriptive inline preview.

These settings affect Bases presentation only. The full editor inside notes remains recursive.

## Current scope

NoteFields currently focuses on the Bases table view. Other Bases layouts may use Obsidian's standard property presentation until dedicated integrations are added.
