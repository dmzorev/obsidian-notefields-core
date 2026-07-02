import { Notice, Setting, setIcon } from "obsidian";
import { colorToCss } from "./catalog-options";
import type NoteFieldsCorePlugin from "./main";
import type {
	ColorOption,
	ColorOptionCollection,
	IconOption,
	IconOptionCollection,
} from "./types";
import { bindDebouncedInput } from "./ui";

const NEW_COLOR_VALUES = ["#7c8cff", "#e93147", "#ec7500", "#08b94e", "#00bfbc", "#7852ee", "#d53984"];

export function renderIconCollectionEditor(
	plugin: NoteFieldsCorePlugin,
	parentEl: HTMLElement,
	collection: IconOptionCollection
): void {
	const hostEl = parentEl.createDiv({ cls: "props-framework-catalog-editor" });
	const readonly = Boolean(collection.readonly);
	for (const option of collection.options) {
		const rowEl = hostEl.createDiv({ cls: "props-framework-catalog-editor-row is-icon" });
		const previewButton = rowEl.createEl("button", {
			attr: { "aria-label": "Choose icon", type: "button" },
			cls: ["clickable-icon", "props-framework-icon-chip", "has-value"],
		});
		previewButton.disabled = readonly;
		setIcon(previewButton, option.value || "lucide-plus");
		previewButton.addEventListener("click", () => {
			plugin.api.openIconPicker(option.value || null, async (value) => {
				if (!value) {
					return;
				}
				await patchIconOption(plugin, collection.id, option.id, { value });
				rerenderIconEditor(plugin, hostEl, collection.id);
			});
		});

		const valueInput = createTextInput(rowEl, "Icon ID", option.value);
		valueInput.disabled = readonly;
		bindDebouncedInput(valueInput, async (inputValue) => {
			const value = inputValue.trim();
			if (!value) {
				valueInput.value = option.value;
				return;
			}
			await patchIconOption(plugin, collection.id, option.id, { value });
		});
		bindCommonInputs(plugin, rowEl, collection.id, option, "icon", readonly);
	}
	if (readonly) {
		return;
	}

	const addButton = createAddButton(hostEl, "Add icon");
	addButton.addEventListener("click", () => {
		void (async () => {
			const existing = new Set(collection.options.map((option) => option.value));
			const value = plugin.api.resolveIconOptions("notefields:obsidian-icons")
				.find((option) => !existing.has(option.value))?.value;
			if (!value) {
				new Notice("No additional icons are available.");
				return;
			}
			await plugin.api.appendIconOption(collection.id, plugin.api.createIconOption({ value }));
			rerenderIconEditor(plugin, hostEl, collection.id);
		})();
	});
}

export function renderColorCollectionEditor(
	plugin: NoteFieldsCorePlugin,
	parentEl: HTMLElement,
	collection: ColorOptionCollection
): void {
	const hostEl = parentEl.createDiv({ cls: "props-framework-catalog-editor" });
	const readonly = Boolean(collection.readonly);
	for (const option of collection.options) {
		const rowEl = hostEl.createDiv({ cls: "props-framework-catalog-editor-row is-color" });
		const pickerHost = rowEl.createDiv({ cls: "props-framework-inline-color-picker" });
		new Setting(pickerHost).addColorPicker((picker) => picker
			.setValue(toHexColor(option.value))
			.setDisabled(readonly)
			.onChange(async (value) => {
				await patchColorOption(plugin, collection.id, option.id, { value });
				rerenderColorEditor(plugin, hostEl, collection.id);
			}));

		const valueInput = createTextInput(rowEl, "Color", option.value);
		valueInput.disabled = readonly;
		valueInput.style.setProperty("--props-framework-option-color", colorToCss(option.value));
		valueInput.addClass("props-framework-color-value-input");
		bindDebouncedInput(valueInput, async (inputValue) => {
			const value = inputValue.trim();
			if (!value) {
				valueInput.value = option.value;
				return;
			}
			await patchColorOption(plugin, collection.id, option.id, { value });
		});
		bindCommonInputs(plugin, rowEl, collection.id, option, "color", readonly);
	}
	if (readonly) {
		return;
	}

	const addButton = createAddButton(hostEl, "Add color");
	addButton.addEventListener("click", () => {
		void (async () => {
			const existing = new Set(collection.options.map((option) => option.value));
			const value = NEW_COLOR_VALUES.find((candidate) => !existing.has(candidate));
			if (!value) {
				new Notice("Choose a different color before adding another option.");
				return;
			}
			await plugin.api.appendColorOption(collection.id, plugin.api.createColorOption({ value }));
			rerenderColorEditor(plugin, hostEl, collection.id);
		})();
	});
}

function bindCommonInputs(
	plugin: NoteFieldsCorePlugin,
	rowEl: HTMLElement,
	collectionId: string,
	option: IconOption | ColorOption,
	kind: "icon" | "color",
	readonly: boolean
): void {
	const labelInput = createTextInput(rowEl, "Displayed title", option.label ?? "");
	labelInput.disabled = readonly;
	bindDebouncedInput(labelInput, async (value) => {
		await patchCatalogOption(plugin, collectionId, option.id, { label: value.trim() || undefined }, kind);
	});
	const aliasesInput = createTextInput(rowEl, "Aliases", option.aliases?.join(", ") ?? "");
	aliasesInput.disabled = readonly;
	bindDebouncedInput(aliasesInput, async (value) => {
		const aliases = value.split(",").map((alias) => alias.trim()).filter(Boolean);
		await patchCatalogOption(plugin, collectionId, option.id, { aliases: aliases.length ? aliases : undefined }, kind);
	});
	const deleteButton = rowEl.createEl("button", {
		attr: { "aria-label": `Delete ${kind}`, type: "button" },
		cls: "clickable-icon",
	});
	deleteButton.disabled = readonly;
	setIcon(deleteButton, "lucide-trash-2");
	deleteButton.addEventListener("click", () => {
		void (async () => {
			if (kind === "icon") {
				await plugin.api.removeIconOption(collectionId, option.id);
				rerenderIconEditor(plugin, rowEl.closest(".props-framework-catalog-editor") as HTMLElement, collectionId);
				return;
			}
			await plugin.api.removeColorOption(collectionId, option.id);
			rerenderColorEditor(plugin, rowEl.closest(".props-framework-catalog-editor") as HTMLElement, collectionId);
		})();
	});
}

async function patchCatalogOption(
	plugin: NoteFieldsCorePlugin,
	collectionId: string,
	optionId: string,
	patch: Partial<IconOption & ColorOption>,
	kind: "icon" | "color"
): Promise<void> {
	if (kind === "icon") {
		await patchIconOption(plugin, collectionId, optionId, patch);
	} else {
		await patchColorOption(plugin, collectionId, optionId, patch);
	}
}

async function patchIconOption(
	plugin: NoteFieldsCorePlugin,
	collectionId: string,
	optionId: string,
	patch: Partial<IconOption>
): Promise<void> {
	await plugin.api.patchIconOption(collectionId, optionId, patch);
}

async function patchColorOption(
	plugin: NoteFieldsCorePlugin,
	collectionId: string,
	optionId: string,
	patch: Partial<ColorOption>
): Promise<void> {
	await plugin.api.patchColorOption(collectionId, optionId, patch);
}

function rerenderIconEditor(plugin: NoteFieldsCorePlugin, hostEl: HTMLElement, collectionId: string): void {
	const collection = plugin.api.getIconOptionCollection(collectionId);
	const parentEl = hostEl.parentElement;
	if (!collection || !parentEl) {
		return;
	}
	hostEl.remove();
	renderIconCollectionEditor(plugin, parentEl, collection);
}

function rerenderColorEditor(plugin: NoteFieldsCorePlugin, hostEl: HTMLElement, collectionId: string): void {
	const collection = plugin.api.getColorOptionCollection(collectionId);
	const parentEl = hostEl.parentElement;
	if (!collection || !parentEl) {
		return;
	}
	hostEl.remove();
	renderColorCollectionEditor(plugin, parentEl, collection);
}

function createTextInput(parentEl: HTMLElement, label: string, value: string): HTMLInputElement {
	return parentEl.createEl("input", {
		attr: { "aria-label": label, placeholder: label, type: "text" },
		cls: "metadata-input-text",
		value,
	});
}

function createAddButton(parentEl: HTMLElement, text: string): HTMLButtonElement {
	return parentEl.createEl("button", {
		attr: { type: "button" },
		cls: "mod-cta props-framework-add-button",
		text,
	});
}

function toHexColor(value: string): string {
	return /^#[0-9a-f]{6}$/iu.test(value) ? value : "#7c8cff";
}
