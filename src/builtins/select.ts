import { Setting, setIcon, type App } from "obsidian";
import { ColorPickerModal, IconPickerModal } from "../pickers";
import type { PropertyOption, PropertyType, SelectPropertyConfig } from "../types";
import {
	coerceString,
	coerceStringArray,
	containMetadataEvents,
	renderOptionLabel,
	renderValidation,
	stopMetadataEvent,
	uniqueOptions,
} from "../ui";

type OptionResolver = (propertyName: string) => PropertyOption[];

interface SelectSettingsContext {
	app: App;
	definition: { config: SelectPropertyConfig };
	updateDefinition: (definition: { config: SelectPropertyConfig }) => Promise<void>;
}

export function createSelectType(resolveOptions: OptionResolver): PropertyType<SelectPropertyConfig> {
	return {
		id: "framework:select",
		name: "Select",
		description: "Single value selected from configured or collected options.",
		icon: "lucide-list-check",
		defaultConfig: {
			options: [],
			optionSource: "manual",
			allowCustom: true,
			placeholder: "",
		},
		validate(value, ctx) {
			const text = coerceString(value);
			if (!text || ctx.config.allowCustom) {
				return true;
			}

			const options = resolveOptions(ctx.definition.property);
			return options.some((option) => option.value === text)
				? true
				: `Value "${text}" is not in the allowed options.`;
		},
		normalize(value) {
			return coerceString(value);
		},
		render(el, ctx) {
			let value = coerceString(ctx.value);
			let isOpen = false;
			let isEditing = false;
			let query = "";

			const render = (): void => {
				const options = uniqueOptions(resolveOptions(ctx.definition.property));
				const selectedOption = options.find((option) => option.value === value) ?? (value ? { value } : null);
				el.empty();

				const wrapperEl = el.createDiv({
					attr: {
						"aria-label": "Edit selected value",
						tabindex: isEditing ? "-1" : "0",
					},
					cls: ["props-framework-select", isEditing ? "is-editing" : "is-viewing"],
				});
				containMetadataEvents(wrapperEl);
				wrapperEl.addEventListener("focusout", () => {
					window.setTimeout(() => {
						if (!wrapperEl.isConnected || wrapperEl.contains(document.activeElement)) {
							return;
						}
						query = "";
						isOpen = false;
						isEditing = false;
						render();
					}, 0);
				});
				wrapperEl.addEventListener("focus", () => openEditor());
				wrapperEl.addEventListener("click", () => openEditor());

				if (isEditing) {
					const inputEl = wrapperEl.createEl("input", {
						attr: {
							placeholder: "Filter or add value",
							type: "text",
						},
						cls: "props-framework-select-input",
						value: query,
					});
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
							selectValue(query.trim());
						}
					});
					window.requestAnimationFrame(() => inputEl.focus());
				} else {
					const pillEl = wrapperEl.createDiv({
						cls: ["props-framework-value-pill", value ? "" : "is-empty"],
					});
					renderOptionPillContent(pillEl, selectedOption ?? { value: ctx.config.placeholder || "Select value" });
				}

				if (isOpen) {
					renderSuggestions(wrapperEl, getSuggestionConfig());
				}

				renderValidation(el, validateSelectValue(value, options.map((option) => option.value), ctx.config.allowCustom));

				function getSuggestionConfig(): SuggestionConfig {
					return {
						allowCustom: ctx.config.allowCustom,
						showInput: false,
						options,
						query,
						selectedValues: value ? [value] : [],
						onQueryChange: (nextQuery) => {
							query = nextQuery;
							render();
						},
						onSelect: selectValue,
					};
				}

				function selectValue(nextValue: string): void {
					value = nextValue;
					isOpen = false;
					isEditing = false;
					query = "";
					ctx.onChange(nextValue || null);
					render();
				}

				function openEditor(): void {
					if (isEditing) {
						return;
					}
					isEditing = true;
					isOpen = true;
					render();
				}
			};

			render();

			return {
				type: "framework:select",
				focus: () => {
					isEditing = true;
					isOpen = true;
					render();
				},
			};
		},
		renderSettings: renderSelectSettings,
	};
}

export function createMultiselectType(resolveOptions: OptionResolver): PropertyType<SelectPropertyConfig> {
	return {
		id: "framework:multiselect",
		name: "Multiselect",
		description: "Multiple string values selected from configured or collected options.",
		icon: "lucide-list-plus",
		defaultConfig: {
			options: [],
			optionSource: "manual",
			allowCustom: true,
			placeholder: "",
		},
		validate(value, ctx) {
			if (!Array.isArray(value)) {
				return {
					valid: false,
					message: "Expected a list of values.",
				};
			}

			if (ctx.config.allowCustom) {
				return true;
			}

			const options = resolveOptions(ctx.definition.property);
			const allowedValues = new Set(options.map((option) => option.value));
			const unknownValues = value.filter((item) => typeof item === "string" && !allowedValues.has(item));
			return unknownValues.length === 0
				? true
				: {
					valid: false,
					message: "Some values are not in the allowed options.",
					details: unknownValues.map((item) => String(item)),
				};
		},
		normalize(value) {
			return coerceStringArray(value);
		},
		render(el, ctx) {
			let value = coerceStringArray(ctx.value);
			let query = "";
			let isOpen = false;
			let isEditing = false;

			const render = (): void => {
				const options = uniqueOptions(resolveOptions(ctx.definition.property));
				el.empty();

				const wrapperEl = el.createDiv({
					attr: {
						"aria-label": "Edit multiple values",
						tabindex: isEditing ? "-1" : "0",
					},
					cls: ["props-framework-multiselect", isEditing ? "is-editing" : "is-viewing"],
				});
				containMetadataEvents(wrapperEl);
				wrapperEl.addEventListener("focusout", () => {
					window.setTimeout(() => {
						if (!wrapperEl.isConnected || wrapperEl.contains(document.activeElement)) {
							return;
						}
						query = "";
						isOpen = false;
						isEditing = false;
						render();
					}, 0);
				});
				wrapperEl.addEventListener("focus", () => openEditor());
				wrapperEl.addEventListener("click", (event) => {
					if (event.target instanceof Element && event.target.closest("button")) {
						return;
					}
					openEditor();
				});
				const inlineEl = wrapperEl.createDiv({ cls: "props-framework-multiselect-inline" });

				const updateValue = (nextValue: string[]): void => {
					value = nextValue;
					ctx.onChange(nextValue);
					render();
				};

				for (const item of value) {
					const option = options.find((candidate) => candidate.value === item) ?? { value: item };
					const pillEl = inlineEl.createDiv({ cls: "props-framework-value-pill" });
					renderOptionPillContent(pillEl, option);
					const removeButton = pillEl.createEl("button", {
						attr: { "aria-label": `Remove ${item}`, type: "button" },
						cls: "clickable-icon props-framework-pill-remove",
					});
					setIcon(removeButton, "lucide-x");
					removeButton.addEventListener("click", (event) => {
						stopMetadataEvent(event);
						updateValue(value.filter((candidate) => candidate !== item));
					});
				}

				if (isEditing) {
					const inputEl = inlineEl.createEl("input", {
						attr: {
							placeholder: "Add value",
							type: "text",
						},
						cls: "props-framework-multiselect-input",
						value: query,
					});
					inputEl.addEventListener("focus", () => {
						isOpen = true;
						renderSuggestions(wrapperEl, getSuggestionConfig());
					});
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
						if (event.key !== "Enter") {
							return;
						}
						stopMetadataEvent(event);
						const nextValue = query.trim();
						if (ctx.config.allowCustom && nextValue && !value.includes(nextValue)) {
							query = "";
							isOpen = true;
							updateValue([...value, nextValue]);
						}
					});
					window.requestAnimationFrame(() => inputEl.focus());
				}

				if (isOpen) {
					renderSuggestions(wrapperEl, getSuggestionConfig());
				}

				renderValidation(el, ctx.validate(value));

				function getSuggestionConfig(): SuggestionConfig {
					return {
						allowCustom: ctx.config.allowCustom,
						showInput: false,
						options,
						query,
						selectedValues: value,
						onQueryChange: (nextQuery) => {
							query = nextQuery;
							render();
						},
						onSelect: (nextValue) => {
							if (!nextValue || value.includes(nextValue)) {
								return;
							}
							query = "";
							isOpen = true;
							updateValue([...value, nextValue]);
						},
					};
				}

				function openEditor(): void {
					if (isEditing) {
						return;
					}
					isEditing = true;
					isOpen = true;
					render();
				}
			};

			render();

			return {
				type: "framework:multiselect",
				focus: () => {
					isEditing = true;
					isOpen = true;
					render();
				},
			};
		},
		renderSettings: renderSelectSettings,
	};
}

interface SuggestionConfig {
	allowCustom: boolean;
	showInput: boolean;
	options: PropertyOption[];
	query: string;
	selectedValues: string[];
	onQueryChange: (query: string) => void;
	onSelect: (value: string) => void;
}

function renderSuggestions(parentEl: HTMLElement, config: SuggestionConfig): void {
	parentEl.querySelector(".props-framework-suggestions")?.remove();
	const query = config.query.trim().toLowerCase();
	const options = config.options
		.filter((option) => !config.selectedValues.includes(option.value))
		.filter((option) => {
			if (!query) {
				return true;
			}
			return option.value.toLowerCase().includes(query) || option.label?.toLowerCase().includes(query);
		});

	const suggestionsEl = parentEl.createDiv({ cls: "props-framework-suggestions" });
	suggestionsEl.addEventListener("mousedown", stopMetadataEvent);
	if (config.showInput) {
		const inputEl = suggestionsEl.createEl("input", {
			attr: {
				placeholder: "Filter or add value",
				type: "text",
			},
			cls: "metadata-input-text props-framework-suggestion-input",
			value: config.query,
		});
		inputEl.addEventListener("input", () => config.onQueryChange(inputEl.value));
		inputEl.addEventListener("keydown", (event) => {
			if (event.key !== "Enter") {
				return;
			}
			stopMetadataEvent(event);
			if (config.allowCustom) {
				config.onSelect(inputEl.value.trim());
			}
		});
		window.setTimeout(() => inputEl.focus(), 0);
	}

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

function renderOptionPillContent(parentEl: HTMLElement, option: PropertyOption): void {
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

function toPillBackground(color: string): string {
	if (/^#|rgb|hsl|var\(/u.test(color)) {
		return color;
	}
	return `rgba(var(--color-${color}-rgb), 0.18)`;
}

function toPillTextColor(color: string): string {
	if (/^#|rgb|hsl|var\(/u.test(color)) {
		return "var(--text-normal)";
	}
	return `rgba(var(--color-${color}-rgb), 1)`;
}

function validateSelectValue(value: string, allowedValues: string[], allowCustom: boolean) {
	if (!value || allowCustom || allowedValues.includes(value)) {
		return { valid: true };
	}

	return {
		valid: false,
		message: `Value "${value}" is not in the allowed options.`,
		severity: "error" as const,
	};
}

function renderSelectSettings(
	el: HTMLElement,
	ctx: SelectSettingsContext
): void {
	const config = ctx.definition.config;

	new Setting(el)
		.setName("Options source")
		.setDesc("Configured values, values collected from notes, or both.")
		.addDropdown((dropdown) => dropdown
			.addOption("manual", "Manual")
			.addOption("vault", "Collect from notes")
			.addOption("manual-and-vault", "Manual and notes")
			.setValue(config.optionSource)
			.onChange(async (optionSource) => {
				await ctx.updateDefinition({
					...ctx.definition,
					config: {
						...config,
						optionSource: optionSource as SelectPropertyConfig["optionSource"],
					},
				});
			}));

	new Setting(el)
		.setName("Allow custom values")
		.addToggle((toggle) => toggle
			.setValue(config.allowCustom)
			.onChange(async (allowCustom) => {
				await ctx.updateDefinition({
					...ctx.definition,
					config: {
						...config,
						allowCustom,
					},
				});
			}));

	renderInlineOptionEditor(el, ctx);
}

function renderInlineOptionEditor(
	el: HTMLElement,
	ctx: SelectSettingsContext
): void {
	const optionsEl = el.createDiv({ cls: "props-framework-option-editor" });
	new Setting(optionsEl)
		.setName("Values")
		.setDesc("Edit possible values, display titles, icons and colors.")
		.setHeading();

	for (const [index, option] of ctx.definition.config.options.entries()) {
		const rowEl = optionsEl.createDiv({ cls: "props-framework-option-editor-row" });
		rowEl.createEl("input", {
			attr: { "aria-label": "Value", placeholder: "Value", type: "text" },
			cls: "metadata-input-text",
			value: option.value,
		}).addEventListener("change", (event) => {
			const target = event.target;
			if (target instanceof HTMLInputElement) {
				void updateOptionAt(ctx, index, { value: target.value.trim() });
			}
		});
		rowEl.createEl("input", {
			attr: { "aria-label": "Title", placeholder: "Title", type: "text" },
			cls: "metadata-input-text",
			value: option.label ?? "",
		}).addEventListener("change", (event) => {
			const target = event.target;
			if (target instanceof HTMLInputElement) {
				void updateOptionAt(ctx, index, { label: target.value.trim() || undefined });
			}
		});

		const iconButton = rowEl.createEl("button", {
			attr: { "aria-label": "Choose icon", type: "button" },
			cls: ["clickable-icon", "props-framework-icon-chip", option.icon ? "has-value" : "is-empty"],
		});
		setIcon(iconButton, option.icon || "lucide-plus");
		iconButton.addEventListener("click", () => {
			new IconPickerModal(ctx.app, option.icon ?? null, async (icon) => {
				const nextDefinition = await updateOptionAt(ctx, index, { icon: icon ?? undefined });
				el.empty();
				renderSelectSettings(el, { ...ctx, definition: nextDefinition });
			}).open();
		});

		const colorButton = rowEl.createEl("button", {
			attr: { "aria-label": "Choose color", type: "button" },
			cls: ["props-framework-color-chip", option.color ? "has-value" : "is-empty"],
		});
		colorButton.style.backgroundColor = option.color ? optionColorToCss(option.color) : "transparent";
		colorButton.addEventListener("click", () => {
			new ColorPickerModal(ctx.app, option.color ?? null, async (color) => {
				const nextDefinition = await updateOptionAt(ctx, index, { color: color ?? undefined });
				el.empty();
				renderSelectSettings(el, { ...ctx, definition: nextDefinition });
			}).open();
		});

		const deleteButton = rowEl.createEl("button", {
			attr: { "aria-label": "Delete value", type: "button" },
			cls: "clickable-icon",
		});
		setIcon(deleteButton, "lucide-trash-2");
		deleteButton.addEventListener("click", () => {
			const nextDefinition = {
				...ctx.definition,
				config: {
					...ctx.definition.config,
					options: ctx.definition.config.options.filter((_option, optionIndex) => optionIndex !== index),
				},
			};
			void ctx.updateDefinition(nextDefinition).then(() => {
				el.empty();
				renderSelectSettings(el, { ...ctx, definition: nextDefinition });
			});
		});
	}

	const addButton = optionsEl.createEl("button", {
		attr: { type: "button" },
		cls: "mod-cta props-framework-add-button",
		text: "Add value",
	});
	addButton.addEventListener("click", () => {
		const nextDefinition = {
			...ctx.definition,
			config: {
				...ctx.definition.config,
				options: [...ctx.definition.config.options, { value: getNextOptionValue(ctx.definition.config.options) }],
			},
		};
		void ctx.updateDefinition(nextDefinition).then(() => {
			el.empty();
			renderSelectSettings(el, { ...ctx, definition: nextDefinition });
		});
	});
}

async function updateOptionAt(
	ctx: SelectSettingsContext,
	index: number,
	patch: Partial<PropertyOption>
): Promise<SelectSettingsContext["definition"]> {
	const nextDefinition = {
		...ctx.definition,
		config: {
			...ctx.definition.config,
			options: ctx.definition.config.options.map((option, optionIndex) => {
				if (optionIndex !== index) {
					return option;
				}

				return {
					...option,
					...patch,
				};
			}),
		},
	};
	await ctx.updateDefinition(nextDefinition);
	return nextDefinition;
}

function getNextOptionValue(options: PropertyOption[]): string {
	const values = new Set(options.map((option) => option.value));
	const base = "new-value";
	let value = base;
	let index = 2;
	while (values.has(value)) {
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
