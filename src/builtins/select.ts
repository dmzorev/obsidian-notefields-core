import { Notice, Setting, setIcon } from "obsidian";
import {
	coerceOptionValue,
	formatOptionValue,
	isOptionValue,
	optionMatchesQuery,
	optionValuesEqual,
	parseOptionInput,
	uniqueValueOptions,
} from "../options";
import type {
	OptionValue,
	OptionValueType,
	PropertySettingsContext,
	PropertyType,
	SelectPropertyConfig,
	ValueOption,
	ValueOptionsEditorContext,
} from "../types";
import {
	containMetadataEvents,
	renderOptionLabel,
	renderValidation,
	stopMetadataEvent,
} from "../ui";

type OptionResolver = (propertyName: string) => ValueOption[];
type ValueTypeResolver = (propertyName: string) => OptionValueType;
type CustomValueHandler = (propertyName: string, value: OptionValue) => void;
type OptionsEditorRenderer = (el: HTMLElement, context: ValueOptionsEditorContext) => void;

export function createSelectType(
	resolveOptions: OptionResolver,
	rememberCustomValue: CustomValueHandler,
	renderOptionsEditor: OptionsEditorRenderer,
	resolveValueType: ValueTypeResolver
): PropertyType<SelectPropertyConfig> {
	return {
		id: "notefields:select",
		name: "Select",
		description: "Single value selected from a local or shared option collection.",
		icon: "lucide-list-check",
		defaultConfig: createDefaultConfig(),
		optionSupport: createOptionSupport(),
		validate(value, ctx) {
			if (value === null || value === undefined || value === "") {
				return true;
			}
			if (!isOptionValue(value)) {
				return "Expected a text, number or boolean value.";
			}
			const normalized = coerceOptionValue(value, resolveValueType(ctx.definition.property));
			if (normalized === null) {
				return `Expected a ${resolveValueType(ctx.definition.property)} value.`;
			}
			if (ctx.config.allowCustom) {
				return true;
			}
			return resolveOptions(ctx.definition.property).some((option) => optionValuesEqual(option.value, normalized))
				? true
				: `Value "${formatOptionValue(normalized)}" is not in the allowed options.`;
		},
		normalize(value, ctx) {
			if (value === null || value === undefined || value === "") {
				return null;
			}
			return coerceOptionValue(value, resolveValueType(ctx.definition.property));
		},
		render(el, ctx) {
			let value = normalizeSingleValue(ctx.value, resolveValueType(ctx.definition.property));
			let isOpen = false;
			let isEditing = false;
			let query = "";

			const render = (): void => {
				const options = uniqueValueOptions(resolveOptions(ctx.definition.property));
				const selectedOption = value === null
					? null
					: options.find((option) => optionValuesEqual(option.value, value)) ?? { id: "current", value };
				el.empty();

				const wrapperEl = el.createDiv({
					attr: { "aria-label": "Edit selected value", tabindex: isEditing ? "-1" : "0" },
					cls: ["props-framework-select", isEditing ? "is-editing" : "is-viewing"],
				});
				containMetadataEvents(wrapperEl);
				bindEditorFocus(wrapperEl, () => {
					query = "";
					isOpen = false;
					isEditing = false;
					render();
				}, openEditor);

				if (isEditing) {
					const inputEl = createEditorInput(wrapperEl, query, "Filter or add value");
					inputEl.addEventListener("input", () => {
						query = inputEl.value;
						isOpen = true;
						renderSuggestions(wrapperEl, getSuggestionConfig());
					});
					inputEl.addEventListener("keydown", (event) => {
						if (event.key === "Escape") {
							stopMetadataEvent(event);
							query = "";
							isOpen = false;
							isEditing = false;
							render();
							return;
						}
						if (event.key === "Enter" && ctx.config.allowCustom && query.trim()) {
							stopMetadataEvent(event);
							const nextValue = parseOptionInput(query, resolveValueType(ctx.definition.property));
							if (nextValue === null) {
								new Notice(`Expected a ${resolveValueType(ctx.definition.property)} value.`);
								return;
							}
							selectValue(nextValue, true);
						}
					});
					window.requestAnimationFrame(() => inputEl.focus());
				} else {
					const pillEl = wrapperEl.createDiv({
						cls: ["props-framework-value-pill", value === null ? "is-empty" : ""],
					});
					renderOptionPillContent(pillEl, selectedOption ?? {
						id: "placeholder",
						value: ctx.config.placeholder || "Select value",
					});
				}

				if (isOpen) {
					renderSuggestions(wrapperEl, getSuggestionConfig());
				}
				renderValidation(el, ctx.validate(value));

				function getSuggestionConfig(): SuggestionConfig {
					return {
						options,
						query,
						selectedValues: value === null ? [] : [value],
						onSelect: (nextValue) => selectValue(nextValue, false),
					};
				}

				function selectValue(nextValue: OptionValue, isCustom: boolean): void {
					value = nextValue;
					isOpen = false;
					isEditing = false;
					query = "";
					ctx.onChange(nextValue);
					if (isCustom) {
						rememberCustomValue(ctx.definition.property, nextValue);
					}
					render();
				}

				function openEditor(): void {
					if (!isEditing) {
						isEditing = true;
						isOpen = true;
						render();
					}
				}
			};

			render();
			return {
				type: "notefields:select",
				focus: () => {
					isEditing = true;
					isOpen = true;
					render();
				},
			};
		},
		renderSettings: (el, ctx) => renderSelectSettings(el, ctx, renderOptionsEditor),
	};
}

export function createMultiselectType(
	resolveOptions: OptionResolver,
	rememberCustomValue: CustomValueHandler,
	renderOptionsEditor: OptionsEditorRenderer,
	resolveValueType: ValueTypeResolver
): PropertyType<SelectPropertyConfig> {
	return {
		id: "notefields:multiselect",
		name: "Multiselect",
		description: "Multiple values selected from a local or shared option collection.",
		icon: "lucide-list-plus",
		defaultConfig: createDefaultConfig(),
		optionSupport: createOptionSupport(),
		validate(value, ctx) {
			if (!Array.isArray(value)) {
				return { valid: false, message: "Expected a list of values." };
			}
			const valueType = resolveValueType(ctx.definition.property);
			const normalized = value.map((item) => coerceOptionValue(item, valueType));
			if (normalized.some((item) => item === null)) {
				return { valid: false, message: `Expected ${valueType} values.` };
			}
			if (ctx.config.allowCustom) {
				return true;
			}
			const options = resolveOptions(ctx.definition.property);
			const unknown = normalized.filter((item): item is OptionValue => item !== null)
				.filter((item) => !options.some((option) => optionValuesEqual(option.value, item)));
			return unknown.length === 0 ? true : {
				valid: false,
				message: "Some values are not in the allowed options.",
				details: unknown.map(formatOptionValue),
			};
		},
		normalize(value, ctx) {
			return normalizeMultipleValues(value, resolveValueType(ctx.definition.property));
		},
		render(el, ctx) {
			let value = normalizeMultipleValues(ctx.value, resolveValueType(ctx.definition.property));
			let query = "";
			let isOpen = false;
			let isEditing = false;

			const render = (): void => {
				const options = uniqueValueOptions(resolveOptions(ctx.definition.property));
				el.empty();
				const wrapperEl = el.createDiv({
					attr: { "aria-label": "Edit multiple values", tabindex: isEditing ? "-1" : "0" },
					cls: ["props-framework-multiselect", isEditing ? "is-editing" : "is-viewing"],
				});
				containMetadataEvents(wrapperEl);
				bindEditorFocus(wrapperEl, () => {
					query = "";
					isOpen = false;
					isEditing = false;
					render();
				}, openEditor, true);
				const inlineEl = wrapperEl.createDiv({ cls: "props-framework-multiselect-inline" });

				for (const item of value) {
					const option = options.find((candidate) => optionValuesEqual(candidate.value, item)) ?? {
						id: `current-${typeof item}-${String(item)}`,
						value: item,
					};
					const pillEl = inlineEl.createDiv({ cls: "props-framework-value-pill" });
					renderOptionPillContent(pillEl, option);
					const removeButton = pillEl.createEl("button", {
						attr: { "aria-label": `Remove ${formatOptionValue(item)}`, type: "button" },
						cls: "clickable-icon props-framework-pill-remove",
					});
					setIcon(removeButton, "lucide-x");
					removeButton.addEventListener("click", (event) => {
						stopMetadataEvent(event);
						updateValue(value.filter((candidate) => !optionValuesEqual(candidate, item)));
					});
				}

				if (isEditing) {
					const inputEl = createEditorInput(inlineEl, query, "Add value", "props-framework-multiselect-input");
					inputEl.addEventListener("input", () => {
						query = inputEl.value;
						isOpen = true;
						renderSuggestions(wrapperEl, getSuggestionConfig());
					});
					inputEl.addEventListener("keydown", (event) => {
						if (event.key === "Escape") {
							stopMetadataEvent(event);
							query = "";
							isOpen = false;
							isEditing = false;
							render();
							return;
						}
						if (event.key !== "Enter" || !ctx.config.allowCustom || !query.trim()) {
							return;
						}
						stopMetadataEvent(event);
						const nextValue = parseOptionInput(query, resolveValueType(ctx.definition.property));
						if (nextValue === null) {
							new Notice(`Expected a ${resolveValueType(ctx.definition.property)} value.`);
							return;
						}
						addValue(nextValue, true);
					});
					window.requestAnimationFrame(() => inputEl.focus());
				}

				if (isOpen) {
					renderSuggestions(wrapperEl, getSuggestionConfig());
				}
				renderValidation(el, ctx.validate(value));

				function getSuggestionConfig(): SuggestionConfig {
					return { options, query, selectedValues: value, onSelect: (nextValue) => addValue(nextValue, false) };
				}
				function addValue(nextValue: OptionValue, isCustom: boolean): void {
					if (value.some((item) => optionValuesEqual(item, nextValue))) {
						return;
					}
					query = "";
					isOpen = true;
					if (isCustom) {
						rememberCustomValue(ctx.definition.property, nextValue);
					}
					updateValue([...value, nextValue]);
				}
				function updateValue(nextValue: OptionValue[]): void {
					value = nextValue;
					ctx.onChange(nextValue);
					render();
				}
				function openEditor(): void {
					if (!isEditing) {
						isEditing = true;
						isOpen = true;
						render();
					}
				}
			};

			render();
			return {
				type: "notefields:multiselect",
				focus: () => {
					isEditing = true;
					isOpen = true;
					render();
				},
			};
		},
		renderSettings: (el, ctx) => renderSelectSettings(el, ctx, renderOptionsEditor),
	};
}

interface SuggestionConfig {
	options: ValueOption[];
	query: string;
	selectedValues: OptionValue[];
	onSelect: (value: OptionValue) => void;
}

function renderSuggestions(parentEl: HTMLElement, config: SuggestionConfig): void {
	parentEl.querySelector(".props-framework-suggestions")?.remove();
	const options = config.options
		.filter((option) => !config.selectedValues.some((value) => optionValuesEqual(value, option.value)))
		.filter((option) => optionMatchesQuery(option, config.query));
	const suggestionsEl = parentEl.createDiv({ cls: "props-framework-suggestions" });
	suggestionsEl.addEventListener("mousedown", stopMetadataEvent);
	const listEl = suggestionsEl.createDiv({ cls: "props-framework-suggestion-list" });
	for (const option of options) {
		const optionEl = listEl.createEl("button", {
			attr: { type: "button" },
			cls: "props-framework-suggestion-item",
		});
		renderOptionPillContent(optionEl, option);
		optionEl.addEventListener("click", (event) => {
			stopMetadataEvent(event);
			config.onSelect(option.value);
		});
	}
}

function renderOptionPillContent(parentEl: HTMLElement, option: ValueOption): void {
	parentEl.empty();
	parentEl.addClass("props-framework-value-pill");
	parentEl.addClass("props-framework-value-pill-inner");
	const color = option.color?.trim();
	if (color) {
		parentEl.style.setProperty("--props-framework-pill-bg", toPillBackground(color));
		parentEl.style.setProperty("--props-framework-pill-color", toPillTextColor(color));
	}
	renderOptionLabel(parentEl, option);
}

function renderSelectSettings(
	el: HTMLElement,
	ctx: PropertySettingsContext<SelectPropertyConfig>,
	renderOptionsEditor: OptionsEditorRenderer
): void {
	new Setting(el)
		.setName("Allow custom values")
		.addToggle((toggle) => toggle
			.setValue(ctx.definition.config.allowCustom)
			.onChange(async (allowCustom) => {
				const definition = ctx.getDefinition?.() ?? ctx.definition;
				await ctx.updateDefinition({
					...definition,
					config: { ...definition.config, allowCustom },
				});
			}));

	new Setting(el)
		.setName("Remember custom values")
		.setDesc("Add values created in notes to the selected option set automatically.")
		.addToggle((toggle) => toggle
			.setValue(ctx.definition.config.autoAddCustomValues)
			.onChange(async (autoAddCustomValues) => {
				const definition = ctx.getDefinition?.() ?? ctx.definition;
				await ctx.updateDefinition({
					...definition,
					config: { ...definition.config, autoAddCustomValues },
				});
			}));

	renderOptionsEditor(el, {
		binding: ctx.definition.config.optionBinding,
		propertyName: ctx.definition.property,
		onChange: async (optionBinding) => {
			await ctx.updateDefinition({
				...ctx.definition,
				config: { ...ctx.definition.config, optionBinding },
			});
		},
	});
}

function createDefaultConfig(): SelectPropertyConfig {
	return {
		optionBinding: { mode: "local", valueType: "string", options: [] },
		allowCustom: true,
		autoAddCustomValues: true,
		placeholder: "",
	};
}

function createOptionSupport() {
	return {
		kind: "value" as const,
		getBinding: (config: SelectPropertyConfig) => config.optionBinding,
		setBinding: (config: SelectPropertyConfig, optionBinding: SelectPropertyConfig["optionBinding"]) => ({
			...config,
			optionBinding,
		}),
		allowLocal: true,
		allowShared: true,
	};
}

function normalizeSingleValue(value: unknown, valueType: OptionValueType): OptionValue | null {
	if (value === null || value === undefined || value === "") {
		return null;
	}
	return coerceOptionValue(value, valueType);
}

function normalizeMultipleValues(value: unknown, valueType: OptionValueType): OptionValue[] {
	const values = Array.isArray(value) ? value : [value];
	return values.map((item) => coerceOptionValue(item, valueType))
		.filter((item): item is OptionValue => item !== null);
}

function bindEditorFocus(
	wrapperEl: HTMLElement,
	onBlur: () => void,
	onOpen: () => void,
	ignoreButtons = false
): void {
	wrapperEl.addEventListener("focusout", () => {
		window.setTimeout(() => {
			if (!wrapperEl.isConnected || wrapperEl.contains(document.activeElement)) {
				return;
			}
			onBlur();
		}, 0);
	});
	wrapperEl.addEventListener("focus", onOpen);
	wrapperEl.addEventListener("click", (event) => {
		if (ignoreButtons && event.target instanceof Element && event.target.closest("button")) {
			return;
		}
		onOpen();
	});
}

function createEditorInput(parentEl: HTMLElement, value: string, placeholder: string, cls = "props-framework-select-input"): HTMLInputElement {
	return parentEl.createEl("input", {
		attr: { placeholder, type: "text" },
		cls,
		value,
	});
}

function toPillBackground(color: string): string {
	return /^#|rgb|hsl|var\(/u.test(color) ? color : `rgba(var(--color-${color}-rgb), 0.18)`;
}

function toPillTextColor(color: string): string {
	return /^#|rgb|hsl|var\(/u.test(color) ? "var(--text-normal)" : `rgba(var(--color-${color}-rgb), 1)`;
}
