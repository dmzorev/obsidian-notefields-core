import { Setting, setIcon } from "obsidian";
import { colorToCss } from "../catalog-options";
import type NoteFieldsCorePlugin from "../main";
import type {
	CatalogPickerPropertyConfig,
	PropertyRenderContext,
	PropertyType,
	PropertyWidgetComponent,
} from "../types";
import { containMetadataEvents, stopMetadataEvent } from "../ui";

export function createIconPickerType(plugin: NoteFieldsCorePlugin): PropertyType<CatalogPickerPropertyConfig> {
	return {
		id: "notefields:icon",
		name: "Icon picker",
		description: "Choose a built-in Obsidian icon and store its ID as text.",
		icon: "lucide-smile",
		defaultConfig: { collectionId: null },
		validate: validateString,
		normalize: normalizeString,
		render: (el, ctx) => renderIconPicker(plugin, el, ctx),
		renderBase: (el, ctx) => renderIconPicker(plugin, el, ctx),
		renderSettings: (el, ctx) => {
			new Setting(el)
				.setName("Icon collection")
				.setDesc("Limit the picker to one collection, or show all available icons.")
				.addDropdown((dropdown) => {
					dropdown
						.addOption("", "All icons")
						.addOption(plugin.api.getSystemIconCollectionId(), "Obsidian icons");
					for (const collection of plugin.api.getIconOptionCollections()) {
						dropdown.addOption(collection.id, collection.name);
					}
					dropdown
						.setValue(ctx.definition.config.collectionId ?? "")
						.onChange(async (collectionId) => {
							await ctx.updateDefinition({
								...ctx.definition,
								config: { ...ctx.definition.config, collectionId: collectionId || null },
							});
						});
				});
		},
	};
}

export function createColorPickerType(plugin: NoteFieldsCorePlugin): PropertyType<CatalogPickerPropertyConfig> {
	return {
		id: "notefields:color",
		name: "Color picker",
		description: "Choose a color and store it as text.",
		icon: "lucide-palette",
		defaultConfig: { collectionId: null },
		validate: validateString,
		normalize: normalizeString,
		render: (el, ctx) => renderColorPicker(plugin, el, ctx),
		renderBase: (el, ctx) => renderColorPicker(plugin, el, ctx),
		renderSettings: (el, ctx) => {
			new Setting(el)
				.setName("Color collection")
				.setDesc("Limit the picker to one collection, or show all available colors.")
				.addDropdown((dropdown) => {
					dropdown
						.addOption("", "All colors")
						.addOption(plugin.api.getSystemColorCollectionId(), "Default colors");
					for (const collection of plugin.api.getColorOptionCollections()) {
						dropdown.addOption(collection.id, collection.name);
					}
					dropdown
						.setValue(ctx.definition.config.collectionId ?? "")
						.onChange(async (collectionId) => {
							await ctx.updateDefinition({
								...ctx.definition,
								config: { ...ctx.definition.config, collectionId: collectionId || null },
							});
						});
				});
		},
	};
}

function renderIconPicker(
	plugin: NoteFieldsCorePlugin,
	el: HTMLElement,
	ctx: PropertyRenderContext<CatalogPickerPropertyConfig>
): PropertyWidgetComponent {
	let value = normalizeString(ctx.value);
	const buttonEl = createPickerButton(el);
	const renderValue = (): void => {
		buttonEl.empty();
		buttonEl.setAttribute("aria-label", value || "Choose icon");
		const iconEl = buttonEl.createSpan({ cls: "props-framework-scalar-picker-icon" });
		setIcon(iconEl, value || "lucide-plus");
		if (value && !iconEl.querySelector("svg")) {
			setIcon(iconEl, "lucide-circle-help");
		}
		buttonEl.createSpan({ cls: value ? "" : "is-empty", text: value || "Choose icon" });
	};
	renderValue();
	const open = (): void => {
		plugin.api.openIconPicker(value || null, async (icon) => {
			value = icon ?? "";
			renderValue();
			ctx.onChange(value);
			ctx.blur();
		}, ctx.config.collectionId ?? null);
	};
	bindPickerButton(buttonEl, open);
	return {
		type: "notefields:icon",
		focus: () => buttonEl.focus(),
		setValue: (nextValue) => {
			value = normalizeString(nextValue);
			renderValue();
		},
	};
}

function renderColorPicker(
	plugin: NoteFieldsCorePlugin,
	el: HTMLElement,
	ctx: PropertyRenderContext<CatalogPickerPropertyConfig>
): PropertyWidgetComponent {
	let value = normalizeString(ctx.value);
	const buttonEl = createPickerButton(el);
	const renderValue = (): void => {
		buttonEl.empty();
		buttonEl.setAttribute("aria-label", value || "Choose color");
		if (value) {
			const swatchEl = buttonEl.createSpan({ cls: "props-framework-scalar-color-swatch" });
			swatchEl.style.backgroundColor = colorToCss(value);
		} else {
			const iconEl = buttonEl.createSpan({ cls: "props-framework-scalar-picker-icon" });
			setIcon(iconEl, "lucide-plus");
		}
		buttonEl.createSpan({ cls: value ? "" : "is-empty", text: value || "Choose color" });
	};
	renderValue();
	const open = (): void => {
		plugin.api.openColorPicker(value || null, async (color) => {
			value = color ?? "";
			renderValue();
			ctx.onChange(value);
			ctx.blur();
		}, ctx.config.collectionId ?? null);
	};
	bindPickerButton(buttonEl, open);
	return {
		type: "notefields:color",
		focus: () => buttonEl.focus(),
		setValue: (nextValue) => {
			value = normalizeString(nextValue);
			renderValue();
		},
	};
}

function createPickerButton(parentEl: HTMLElement): HTMLButtonElement {
	const buttonEl = parentEl.createEl("button", {
		attr: { type: "button" },
		cls: "props-framework-scalar-picker",
	});
	containMetadataEvents(buttonEl);
	return buttonEl;
}

function bindPickerButton(buttonEl: HTMLButtonElement, open: () => void): void {
	buttonEl.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		open();
	});
}

function validateString(value: unknown): boolean {
	return value === null || value === undefined || typeof value === "string";
}

function normalizeString(value: unknown): string {
	return typeof value === "string" ? value : "";
}
