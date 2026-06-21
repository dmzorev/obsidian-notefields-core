import { App, PluginSettingTab, Setting, setIcon } from "obsidian";
import type NoteFieldsCorePlugin from "./main";
import { ColorPickerModal, IconPickerModal } from "./pickers";
import type {
	NoteFieldsSettings,
	NestedPropertyConfig,
	PropertyDefinition,
	PropertyOption,
	SelectPropertyConfig,
} from "./types";

export const DEFAULT_SELECT_CONFIG: SelectPropertyConfig = {
	options: [],
	optionSource: "manual",
	allowCustom: true,
	placeholder: "",
};

export const DEFAULT_NESTED_CONFIG: NestedPropertyConfig = {
	defaultCollapsed: false,
	basesShowRootBraces: false,
	basesExpandNestedValues: true,
};

export const DEFAULT_SETTINGS: NoteFieldsSettings = {
	properties: {},
	dataVersion: 1,
};

export function normalizePropertyName(propertyName: string): string {
	return propertyName.trim().toLowerCase();
}

function colorToCss(color: string): string {
	if (/^#|rgb|hsl|var\(/u.test(color)) {
		return color;
	}
	return `rgba(var(--color-${color}-rgb), 1)`;
}

export function getDefaultConfig(typeId: string): SelectPropertyConfig | NestedPropertyConfig | Record<string, never> {
	if (typeId === "notefields:select" || typeId === "notefields:multiselect") {
		return { ...DEFAULT_SELECT_CONFIG, options: [] };
	}

	if (typeId === "notefields:nested") {
		return { ...DEFAULT_NESTED_CONFIG };
	}

	return {};
}

export function normalizeDefinition(definition: PropertyDefinition): PropertyDefinition {
	const typeId = migrateTypeId(definition.typeId);
	return {
		...definition,
		property: definition.property.trim(),
		typeId,
		config: {
			...getDefaultConfig(typeId),
			...(definition.config as Record<string, unknown>),
		},
	};
}

export class NoteFieldsSettingTab extends PluginSettingTab {
	private plugin: NoteFieldsCorePlugin;

	constructor(app: App, plugin: NoteFieldsCorePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass("props-framework-settings");

		new Setting(containerEl)
			.setName("Managed properties")
			.setDesc("Assign richer property types to note properties. The frontmatter value stays in the note; display, editing and validation live here.")
			.setHeading();

		this.renderAddDefinition(containerEl);

		const definitions = Object.values(this.plugin.settings.properties)
			.sort((a, b) => a.property.localeCompare(b.property));

		if (definitions.length === 0) {
			containerEl.createDiv({
				cls: "props-framework-empty",
				text: "No managed properties yet.",
			});
			return;
		}

		for (const definition of definitions) {
			this.renderDefinition(containerEl, definition);
		}
	}

	private renderAddDefinition(containerEl: HTMLElement): void {
		let propertyName = "";

		new Setting(containerEl)
			.setName("Add managed property")
			.setDesc("Start with a property name. You can change the type after it is added.")
			.addText((text) => text
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- Property names are literal examples.
				.setPlaceholder("status")
				.onChange((value) => {
					propertyName = value;
				}))
			.addButton((button) => button
				.setButtonText("Add")
				.setCta()
				.onClick(async () => {
					const property = propertyName.trim();
					if (!property) {
						return;
					}

					await this.plugin.api.setPropertyDefinition({
						property,
						typeId: "notefields:select",
						config: getDefaultConfig("notefields:select"),
					});
					this.display();
				}));
	}

	private renderDefinition(containerEl: HTMLElement, definition: PropertyDefinition): void {
		const sectionEl = containerEl.createDiv({ cls: "props-framework-definition" });
		new Setting(sectionEl)
			.setName(definition.property)
			.setHeading();

		this.renderPropertyNameInput(sectionEl, definition);

		new Setting(sectionEl)
			.setName("Type")
			.addDropdown((dropdown) => {
				for (const type of this.plugin.api.getRegisteredTypes()) {
					dropdown.addOption(type.id, type.name);
				}
				dropdown
					.setValue(definition.typeId)
					.onChange(async (typeId) => {
						await this.plugin.api.setPropertyDefinition({
							...definition,
							typeId,
							config: getDefaultConfig(typeId),
						});
						this.display();
					});
			});

		new Setting(sectionEl)
			.setName("Displayed title")
			.setDesc("Optional label shown in the note properties UI.")
			.addText((text) => text
				.setPlaceholder(definition.property)
				.setValue(definition.displayTitle ?? "")
				.onChange(async (value) => {
					await this.plugin.api.setPropertyDefinition({
						...definition,
						displayTitle: value.trim() || undefined,
					});
				}));

		this.renderIconInput(sectionEl, definition.icon ?? "", async (icon) => {
			await this.plugin.api.setPropertyDefinition({
				...definition,
				icon: icon || undefined,
			});
			this.display();
		}, "Icon");

		if (definition.typeId === "notefields:select" || definition.typeId === "notefields:multiselect") {
			this.renderSelectConfig(sectionEl, definition as PropertyDefinition<SelectPropertyConfig>);
		}

		if (definition.typeId === "notefields:nested") {
			this.renderNestedConfig(sectionEl, definition as PropertyDefinition<NestedPropertyConfig>);
		}

		new Setting(sectionEl)
			.addButton((button) => button
				.setButtonText("Remove")
				.setWarning()
				.onClick(async () => {
					await this.plugin.api.removePropertyDefinition(definition.property);
					this.display();
				}));
	}

	private renderPropertyNameInput(sectionEl: HTMLElement, definition: PropertyDefinition): void {
		new Setting(sectionEl)
			.setName("Property name")
			.setDesc("Framework definition key. Keep it equal to the real note property name.")
			.addText((text) => {
				text
					.setPlaceholder(definition.property)
					.setValue(definition.property);
				text.inputEl.addEventListener("change", () => {
					const property = text.inputEl.value.trim();
					if (!property || property === definition.property) {
						text.setValue(definition.property);
						return;
					}
					void this.plugin.api.removePropertyDefinition(definition.property)
						.then(() => this.plugin.api.setPropertyDefinition({
							...definition,
							property,
						}))
						.then(() => this.display());
				});
			});
	}

	private renderSelectConfig(sectionEl: HTMLElement, definition: PropertyDefinition<SelectPropertyConfig>): void {
		const config = definition.config;

		new Setting(sectionEl)
			.setName("Options source")
			.setDesc("Configured values, values collected from notes, or both.")
			.addDropdown((dropdown) => dropdown
				.addOption("manual", "Manual")
				.addOption("vault", "Collect from notes")
				.addOption("manual-and-vault", "Manual and notes")
				.setValue(config.optionSource)
				.onChange(async (optionSource) => {
					await this.plugin.api.setPropertyDefinition({
						...definition,
						config: {
							...config,
							optionSource: optionSource as SelectPropertyConfig["optionSource"],
						},
					});
					this.display();
				}));

		new Setting(sectionEl)
			.setName("Allow custom values")
			.addToggle((toggle) => toggle
				.setValue(config.allowCustom)
				.onChange(async (allowCustom) => {
					await this.plugin.api.setPropertyDefinition({
						...definition,
						config: {
							...config,
							allowCustom,
						},
					});
				}));

		this.renderOptionEditor(sectionEl, definition);
	}

	private renderOptionEditor(sectionEl: HTMLElement, definition: PropertyDefinition<SelectPropertyConfig>): void {
		const optionsEl = sectionEl.createDiv({ cls: "props-framework-option-editor" });
		new Setting(optionsEl)
			.setName("Values")
			.setDesc("Edit possible values, display titles, icons and colors.")
			.setHeading();

		for (const [index, option] of definition.config.options.entries()) {
			const rowEl = optionsEl.createDiv({ cls: "props-framework-option-editor-row" });
			rowEl.createEl("input", {
				attr: { "aria-label": "Value", placeholder: "Value", type: "text" },
				cls: "metadata-input-text",
				value: option.value,
			}).addEventListener("change", (event) => {
				const target = event.target;
				if (target instanceof HTMLInputElement) {
					void this.updateOptionAt(definition, index, { value: target.value.trim() })
						.then(() => this.display());
				}
			});
			rowEl.createEl("input", {
				attr: { "aria-label": "Title", placeholder: "Title", type: "text" },
				cls: "metadata-input-text",
				value: option.label ?? "",
			}).addEventListener("change", (event) => {
				const target = event.target;
				if (target instanceof HTMLInputElement) {
					void this.updateOptionAt(definition, index, { label: target.value.trim() || undefined })
						.then(() => this.display());
				}
			});

			this.renderCompactIconButton(rowEl, option.icon ?? "", async (icon) => {
				await this.updateOptionAt(definition, index, { icon: icon || undefined });
				this.display();
			});
			this.renderCompactColorButton(rowEl, option.color ?? "", async (color) => {
				await this.updateOptionAt(definition, index, { color: color || undefined });
				this.display();
			});

			const deleteButton = rowEl.createEl("button", {
				attr: { "aria-label": "Delete value", type: "button" },
				cls: "clickable-icon",
			});
			setIcon(deleteButton, "lucide-trash-2");
			deleteButton.addEventListener("click", () => {
				void this.plugin.api.setPropertyDefinition({
					...definition,
					config: {
						...definition.config,
						options: definition.config.options.filter((_option, optionIndex) => optionIndex !== index),
					},
				}).then(() => this.display());
			});
		}

		const addButton = optionsEl.createEl("button", {
			attr: { type: "button" },
			cls: "mod-cta props-framework-add-button",
			text: "Add value",
		});
		addButton.addEventListener("click", () => {
			const value = this.getNextOptionValue(definition);
			void this.plugin.api.setPropertyDefinition({
				...definition,
				config: {
					...definition.config,
					options: [...definition.config.options, { value }],
				},
			}).then(() => this.display());
		});
	}

	private getNextOptionValue(definition: PropertyDefinition<SelectPropertyConfig>): string {
		const values = new Set(definition.config.options.map((option) => option.value));
		const base = "new-value";
		let value = base;
		let index = 2;
		while (values.has(value)) {
			value = `${base}-${index}`;
			index += 1;
		}
		return value;
	}

	private async updateOptionAt(
		definition: PropertyDefinition<SelectPropertyConfig>,
		index: number,
		patch: Partial<PropertyOption>
	): Promise<void> {
		await this.plugin.api.setPropertyDefinition({
			...definition,
			config: {
				...definition.config,
				options: definition.config.options.map((option, optionIndex) => {
					if (optionIndex !== index) {
						return option;
					}

					return {
						...option,
						...patch,
					};
				}),
			},
		});
	}

	private renderIconInput(
		parentEl: HTMLElement,
		value: string,
		onChange: (icon: string) => Promise<void>,
		name: string
	): void {
		new Setting(parentEl)
			.setName(name)
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- Icon ids are literal examples.
			.setDesc("Use a built-in icon id, for example lucide-list-check.")
			.addText((text) => text
				// eslint-disable-next-line obsidianmd/ui/sentence-case -- Icon ids are literal examples.
				.setPlaceholder("lucide-list-check")
				.setValue(value)
				.onChange(async (nextValue) => {
					await onChange(nextValue.trim());
				}))
			.addExtraButton((button) => button
				.setIcon("lucide-search")
				.setTooltip("Choose icon")
				.onClick(() => {
					new IconPickerModal(this.app, value || null, async (icon) => {
						await onChange(icon ?? "");
					}).open();
				}));
	}

	private renderCompactIconButton(parentEl: HTMLElement, value: string, onChange: (icon: string) => Promise<void>): void {
		const button = parentEl.createEl("button", {
			attr: { "aria-label": "Choose icon", type: "button" },
			cls: ["clickable-icon", "props-framework-icon-chip", value ? "has-value" : "is-empty"],
		});
		setIcon(button, value || "lucide-plus");
		button.addEventListener("click", () => {
			new IconPickerModal(this.app, value || null, async (icon) => {
				await onChange(icon ?? "");
			}).open();
		});
	}

	private renderCompactColorButton(parentEl: HTMLElement, value: string, onChange: (color: string) => Promise<void>): void {
		const button = parentEl.createEl("button", {
			attr: { "aria-label": "Choose color", type: "button" },
			cls: ["props-framework-color-chip", value ? "has-value" : "is-empty"],
		});
		button.style.backgroundColor = value ? colorToCss(value) : "transparent";
		button.addEventListener("click", () => {
			new ColorPickerModal(this.app, value || null, async (color) => {
				await onChange(color ?? "");
			}).open();
		});
	}

	private renderNestedConfig(sectionEl: HTMLElement, definition: PropertyDefinition<NestedPropertyConfig>): void {
		new Setting(sectionEl)
			.setName("Collapsed by default")
			.addToggle((toggle) => toggle
				.setValue(definition.config.defaultCollapsed)
				.onChange(async (defaultCollapsed) => {
					await this.plugin.api.setPropertyDefinition({
						...definition,
						config: {
							...definition.config,
							defaultCollapsed,
						},
					});
				}));

		new Setting(sectionEl)
			.setName("Show outer braces in bases")
			.setDesc("Wrap the top-level object preview in braces.")
			.addToggle((toggle) => toggle
				.setValue(definition.config.basesShowRootBraces)
				.onChange(async (basesShowRootBraces) => {
					await this.plugin.api.setPropertyDefinition({
						...definition,
						config: {
							...definition.config,
							basesShowRootBraces,
						},
					});
				}));

		new Setting(sectionEl)
			.setName("Expand nested values in bases")
			.setDesc("Show compact nested content instead of only item counts.")
			.addToggle((toggle) => toggle
				.setValue(definition.config.basesExpandNestedValues)
				.onChange(async (basesExpandNestedValues) => {
					await this.plugin.api.setPropertyDefinition({
						...definition,
						config: {
							...definition.config,
							basesExpandNestedValues,
						},
					});
				}));
	}
}

function migrateTypeId(typeId: string): string {
	const legacyTypeIds: Record<string, string> = {
		"framework:display": "notefields:display",
		"framework:multiselect": "notefields:multiselect",
		"framework:nested": "notefields:nested",
		"framework:select": "notefields:select",
	};
	return legacyTypeIds[typeId] ?? typeId;
}
