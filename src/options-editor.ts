import { Notice, Setting, setIcon } from "obsidian";
import type NoteFieldsCorePlugin from "./main";
import {
	cloneBinding,
	coerceOptionValue,
	createValueOption,
	formatOptionValue,
	optionValueKey,
} from "./options";
import type {
	OptionValue,
	OptionValueType,
	ValueOption,
	ValueOptionBinding,
	ValueOptionCollection,
	ValueOptionsEditorContext,
} from "./types";

interface EditorOptions {
	showBinding?: boolean;
	showCollect?: boolean;
}

export function renderValueOptionsEditor(
	plugin: NoteFieldsCorePlugin,
	el: HTMLElement,
	context: ValueOptionsEditorContext,
	options: EditorOptions = {}
): void {
	const hostEl = el.createDiv({ cls: "props-framework-value-options-editor" });
	renderValueOptionsEditorContent(plugin, hostEl, context, options);
}

function renderValueOptionsEditorContent(
	plugin: NoteFieldsCorePlugin,
	el: HTMLElement,
	context: ValueOptionsEditorContext,
	options: EditorOptions
): void {
	const showBinding = options.showBinding ?? true;
	const showCollect = options.showCollect ?? true;
	const binding = cloneBinding(context.binding);
	const collection = binding.mode === "shared"
		? plugin.api.getValueOptionCollection(binding.collectionId)
		: null;
	const valueType = binding.mode === "local" ? binding.valueType : collection?.valueType ?? "string";
	const values = binding.mode === "local" ? binding.options : collection?.options ?? [];

	if (showBinding) {
		renderBindingSetting(plugin, el, context, binding, valueType, values);
	}

	new Setting(el)
		.setName("Value type")
		.setDesc("Use one YAML primitive type, or keep strings, numbers and booleans distinct.")
		.addDropdown((dropdown) => dropdown
			.addOption("string", "Text")
			.addOption("number", "Number")
			.addOption("boolean", "Boolean")
			.addOption("any", "Any")
			.setValue(valueType)
			.setDisabled(Boolean(collection?.readonly))
			.onChange(async (nextType) => {
				const type = nextType as OptionValueType;
				const converted = values.map((option) => {
					const value = coerceOptionValue(option.value, type);
					return value === null ? null : { ...option, value };
				});
				if (converted.some((option) => option === null)) {
					new Notice(`Some values cannot be converted to ${type}.`);
					rerender(plugin, el, context, options);
					return;
				}
				const typedOptions = converted.filter((option): option is ValueOption => option !== null);
				if (new Set(typedOptions.map((option) => optionValueKey(option.value))).size !== typedOptions.length) {
					new Notice("Changing the type would create duplicate values.");
					rerender(plugin, el, context, options);
					return;
				}
				await updateOptions(plugin, context, binding, collection, type, typedOptions);
				rerender(plugin, el, context, options);
			}));

	if (showCollect && context.propertyName) {
		new Setting(el)
			.setName("Values from notes")
			.setDesc("Scan the vault and add values currently used by this property.")
			.addButton((button) => button
				.setButtonText("Collect values")
				.setIcon("lucide-scan-search")
				.onClick(async () => {
					const added = await plugin.valueOptions.collectPropertyValues(context.propertyName ?? "");
					new Notice(added > 0 ? `Added ${added} value${added === 1 ? "" : "s"}.` : "No new values found.");
					rerender(plugin, el, {
						...context,
						binding: plugin.valueOptions.getPropertyBinding(context.propertyName ?? "") ?? binding,
					}, options);
				}));
	}

	const editorEl = el.createDiv({ cls: "props-framework-option-editor" });
	new Setting(editorEl)
		.setName("Values")
		.setDesc("Edit YAML values, display titles, aliases, icons and colors.")
		.setHeading();

	if (collection?.readonly) {
		editorEl.createDiv({
			cls: "props-framework-empty",
			text: "This collection is managed by another plugin and cannot be edited here.",
		});
	}

	for (const option of values) {
		renderOptionRow(plugin, editorEl, context, binding, collection, valueType, values, option, options);
	}

	if (!collection?.readonly) {
		const addButton = editorEl.createEl("button", {
			attr: { type: "button" },
			cls: "mod-cta props-framework-add-button",
			text: "Add value",
		});
		addButton.addEventListener("click", () => {
			const value = defaultValue(valueType, values);
			if (value === null) {
				new Notice("This value type has no additional unique values.");
				return;
			}
			const nextOptions = [...values, createValueOption(value)];
			void updateOptions(plugin, context, binding, collection, valueType, nextOptions)
				.then(() => rerender(plugin, el, context, options));
		});
	}
}

function renderBindingSetting(
	plugin: NoteFieldsCorePlugin,
	el: HTMLElement,
	context: ValueOptionsEditorContext,
	binding: ValueOptionBinding,
	valueType: OptionValueType,
	values: ValueOption[]
): void {
	const collections = plugin.api.getValueOptionCollections();
	const currentValue = binding.mode === "local" ? "local" : `shared:${binding.collectionId}`;

	new Setting(el)
		.setName("Options storage")
		.setDesc("Keep values unique to this property or reuse a shared collection.")
		.addDropdown((dropdown) => {
			dropdown.addOption("local", "Local options");
			for (const collection of collections) {
				dropdown.addOption(`shared:${collection.id}`, collection.name);
			}
			dropdown
				.setValue(currentValue)
				.onChange(async (nextValue) => {
					if (nextValue === "local") {
						await context.onChange({
							mode: "local",
							valueType,
							options: values.map((option) => ({ ...option })),
						});
					} else {
						await context.onChange({
							mode: "shared",
							collectionId: nextValue.slice("shared:".length),
						});
					}
					rerender(plugin, el, { ...context, binding: nextValue === "local"
						? { mode: "local", valueType, options: values.map((option) => ({ ...option })) }
						: { mode: "shared", collectionId: nextValue.slice("shared:".length) } }, {});
				});
		})
		.addButton((button) => button
			.setButtonText("Create shared")
			.setTooltip("Create a reusable collection from the current values")
			.onClick(async () => {
				const collection = await plugin.api.createValueOptionCollection({
					name: context.propertyName ? `${context.propertyName} values` : "New collection",
					valueType,
					options: values.map((option) => ({ ...option })),
				});
				const nextBinding: ValueOptionBinding = { mode: "shared", collectionId: collection.id };
				await context.onChange(nextBinding);
				rerender(plugin, el, { ...context, binding: nextBinding }, {});
			}));
}

function renderOptionRow(
	plugin: NoteFieldsCorePlugin,
	parentEl: HTMLElement,
	context: ValueOptionsEditorContext,
	binding: ValueOptionBinding,
	collection: ValueOptionCollection | null,
	valueType: OptionValueType,
	values: ValueOption[],
	option: ValueOption,
	editorOptions: EditorOptions
): void {
	const rowEl = parentEl.createDiv({ cls: "props-framework-option-editor-row" });
	const controlsEl = rowEl.createDiv({
		cls: ["props-framework-option-editor-main", valueType === "any" ? "is-multi-type" : ""],
	});
	let rowType = typeof option.value as Exclude<OptionValueType, "any">;

	if (valueType === "any") {
		new Setting(controlsEl).addDropdown((dropdown) => dropdown
			.addOption("string", "Text")
			.addOption("number", "Number")
			.addOption("boolean", "Boolean")
			.setValue(rowType)
			.setDisabled(Boolean(collection?.readonly))
			.onChange(async (nextType) => {
				rowType = nextType as Exclude<OptionValueType, "any">;
				const nextValue = coerceOptionValue(option.value, rowType) ?? defaultValue(rowType, values);
				if (nextValue === null || values.some((candidate) => candidate.id !== option.id
					&& typeof candidate.value === typeof nextValue && candidate.value === nextValue)) {
					new Notice("Changing the type would create a duplicate value.");
					rerender(plugin, parentEl.parentElement ?? parentEl, context, editorOptions);
					return;
				}
				await patchOption(plugin, context, binding, collection, valueType, values, option.id, { value: nextValue });
				rerender(plugin, parentEl.parentElement ?? parentEl, context, editorOptions);
			}));
	}

	const effectiveType = valueType === "any" ? rowType : valueType;
	if (effectiveType === "boolean") {
		const valueSelect = controlsEl.createEl("select", {
			attr: { "aria-label": "Value" },
			cls: "dropdown",
		});
		valueSelect.createEl("option", { attr: { value: "true" }, text: "True" });
		valueSelect.createEl("option", { attr: { value: "false" }, text: "False" });
		valueSelect.value = option.value === true ? "true" : "false";
		valueSelect.disabled = Boolean(collection?.readonly);
		valueSelect.addEventListener("change", () => {
			void patchOption(plugin, context, binding, collection, valueType, values, option.id, {
				value: valueSelect.value === "true",
			});
		});
	} else {
		const valueInput = controlsEl.createEl("input", {
			attr: { "aria-label": "Value", placeholder: "Value", type: effectiveType === "number" ? "number" : "text" },
			cls: "metadata-input-text",
			value: formatOptionValue(option.value),
		});
		valueInput.disabled = Boolean(collection?.readonly);
		valueInput.addEventListener("change", () => {
			const nextValue = coerceOptionValue(valueInput.value, effectiveType);
			if (nextValue === null) {
				valueInput.value = formatOptionValue(option.value);
				new Notice(`Expected a ${effectiveType} value.`);
				return;
			}
			void patchOption(plugin, context, binding, collection, valueType, values, option.id, { value: nextValue });
		});
	}

	const labelInput = controlsEl.createEl("input", {
		attr: { "aria-label": "Displayed title", placeholder: "Displayed title", type: "text" },
		cls: "metadata-input-text",
		value: option.label ?? "",
	});
	labelInput.disabled = Boolean(collection?.readonly);
	labelInput.addEventListener("change", () => {
		void patchOption(plugin, context, binding, collection, valueType, values, option.id, {
			label: labelInput.value.trim() || undefined,
		});
	});

	const aliasesInput = controlsEl.createEl("input", {
		attr: { "aria-label": "Search aliases", placeholder: "Aliases", type: "text" },
		cls: "metadata-input-text props-framework-option-aliases",
		value: option.aliases?.join(", ") ?? "",
	});
	aliasesInput.disabled = Boolean(collection?.readonly);
	aliasesInput.addEventListener("change", () => {
		const aliases = aliasesInput.value.split(",").map((alias) => alias.trim()).filter(Boolean);
		void patchOption(plugin, context, binding, collection, valueType, values, option.id, {
			aliases: aliases.length ? aliases : undefined,
		});
	});

	const iconButton = controlsEl.createEl("button", {
		attr: { "aria-label": "Choose icon", type: "button" },
		cls: ["clickable-icon", "props-framework-icon-chip", option.icon ? "has-value" : "is-empty"],
	});
	setIcon(iconButton, option.icon || "lucide-plus");
	iconButton.disabled = Boolean(collection?.readonly);
	iconButton.addEventListener("click", () => {
		plugin.api.openIconPicker(option.icon ?? null, async (icon) => {
			await patchOption(plugin, context, binding, collection, valueType, values, option.id, { icon: icon ?? undefined });
			rerender(plugin, parentEl.parentElement ?? parentEl, context, editorOptions);
		});
	});

	const colorButton = controlsEl.createEl("button", {
		attr: { "aria-label": "Choose color", type: "button" },
		cls: ["props-framework-color-chip", option.color ? "has-value" : "is-empty"],
	});
	colorButton.style.backgroundColor = option.color ? optionColorToCss(option.color) : "transparent";
	colorButton.disabled = Boolean(collection?.readonly);
	colorButton.addEventListener("click", () => {
		plugin.api.openColorPicker(option.color ?? null, async (color) => {
			await patchOption(plugin, context, binding, collection, valueType, values, option.id, { color: color ?? undefined });
			rerender(plugin, parentEl.parentElement ?? parentEl, context, editorOptions);
		});
	});

	const deleteButton = controlsEl.createEl("button", {
		attr: { "aria-label": "Delete value", type: "button" },
		cls: "clickable-icon",
	});
	setIcon(deleteButton, "lucide-trash-2");
	deleteButton.disabled = Boolean(collection?.readonly);
	deleteButton.addEventListener("click", () => {
		void updateOptions(
			plugin,
			context,
			binding,
			collection,
			valueType,
			values.filter((candidate) => candidate.id !== option.id)
		).then(() => rerender(plugin, parentEl.parentElement ?? parentEl, context, editorOptions));
	});
}

async function patchOption(
	plugin: NoteFieldsCorePlugin,
	context: ValueOptionsEditorContext,
	binding: ValueOptionBinding,
	collection: ValueOptionCollection | null,
	valueType: OptionValueType,
	options: ValueOption[],
	optionId: string,
	patch: Partial<ValueOption>
): Promise<void> {
	await updateOptions(plugin, context, binding, collection, valueType, options.map((option) => option.id === optionId
		? { ...option, ...patch }
		: option));
}

async function updateOptions(
	plugin: NoteFieldsCorePlugin,
	context: ValueOptionsEditorContext,
	binding: ValueOptionBinding,
	collection: ValueOptionCollection | null,
	valueType: OptionValueType,
	options: ValueOption[]
): Promise<void> {
	if (binding.mode === "shared" && collection) {
		const latestCollection = plugin.api.getValueOptionCollection(binding.collectionId) ?? collection;
		await plugin.api.updateValueOptionCollection({
			...latestCollection,
			valueType,
			options,
		});
		return;
	}

	await context.onChange({
		mode: "local",
		valueType,
		options,
	});
}

function rerender(
	plugin: NoteFieldsCorePlugin,
	el: HTMLElement,
	context: ValueOptionsEditorContext,
	options: EditorOptions
): void {
	el.empty();
	const latestBinding = context.propertyName
		? plugin.valueOptions.getPropertyBinding(context.propertyName) ?? context.binding
		: context.binding;
	renderValueOptionsEditorContent(plugin, el, { ...context, binding: latestBinding }, options);
}

function defaultValue(valueType: OptionValueType, options: ValueOption[]): OptionValue | null {
	if (valueType === "number") {
		const numbers = options.map((option) => option.value).filter((value): value is number => typeof value === "number");
		return numbers.length ? Math.max(...numbers) + 1 : 0;
	}
	if (valueType === "boolean") {
		if (!options.some((option) => option.value === false)) {
			return false;
		}
		return options.some((option) => option.value === true) ? null : true;
	}

	const values = new Set(options.map((option) => optionValueKey(option.value)));
	const base = "new-value";
	let value = base;
	let index = 2;
	while (values.has(optionValueKey(value))) {
		value = `${base}-${index}`;
		index += 1;
	}
	return value;
}

function optionColorToCss(color: string): string {
	if (/^#|rgb|hsl|var\(/u.test(color)) {
		return color;
	}
	return `rgba(var(--color-${color}-rgb), 1)`;
}
