import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import type NoteFieldsCorePlugin from "./main";
import { createLocalBinding, isOptionValue, normalizeValueOption, uniqueValueOptions } from "./options";
import { renderValueOptionsEditor } from "./options-editor";
import { IconPickerModal } from "./pickers";
import type {
	NoteFieldsSettings,
	NestedPropertyConfig,
	PropertyDefinition,
	SelectPropertyConfig,
} from "./types";

export const DEFAULT_SELECT_CONFIG: SelectPropertyConfig = {
	optionBinding: createLocalBinding("string"),
	allowCustom: true,
	autoAddCustomValues: true,
	placeholder: "",
};

export const DEFAULT_NESTED_CONFIG: NestedPropertyConfig = {
	defaultCollapsed: false,
	basesShowRootBraces: false,
	basesExpandNestedValues: true,
};

export const DEFAULT_SETTINGS: NoteFieldsSettings = {
	properties: {},
	valueOptionCollections: {},
	dataVersion: 2,
};

export function normalizePropertyName(propertyName: string): string {
	return propertyName.trim().toLowerCase();
}

export function getDefaultConfig(typeId: string): SelectPropertyConfig | NestedPropertyConfig | Record<string, never> {
	if (typeId === "notefields:select" || typeId === "notefields:multiselect") {
		return { ...DEFAULT_SELECT_CONFIG, optionBinding: createLocalBinding("string") };
	}

	if (typeId === "notefields:nested") {
		return { ...DEFAULT_NESTED_CONFIG };
	}

	return {};
}

export function normalizeDefinition(definition: PropertyDefinition): PropertyDefinition {
	const typeId = migrateTypeId(definition.typeId);
	const config = {
		...getDefaultConfig(typeId),
		...(definition.config as Record<string, unknown>),
	} as Record<string, unknown>;
	if ((typeId === "notefields:select" || typeId === "notefields:multiselect") && !config.optionBinding) {
		const legacyOptions = Array.isArray(config.options)
			? (config.options as unknown[]).filter(isStoredValueOption).map((option) => normalizeValueOption(option))
			: [];
		config.optionBinding = {
			...createLocalBinding("string"),
			options: legacyOptions,
		};
	}
	if ((typeId === "notefields:select" || typeId === "notefields:multiselect") && config.optionBinding) {
		const binding = config.optionBinding as SelectPropertyConfig["optionBinding"];
		if (binding.mode === "local") {
			config.optionBinding = {
				...binding,
				valueType: binding.valueType ?? "string",
				options: uniqueValueOptions((binding.options ?? [])
					.filter((option) => isOptionValue(option.value))
					.map((option) => normalizeValueOption(option))),
			};
		}
		delete config.options;
		delete config.optionSource;
	}
	return {
		...definition,
		property: definition.property.trim(),
		typeId,
		config,
	};
}

function isStoredValueOption(option: unknown): option is { value: string | number | boolean } {
	return Boolean(option && typeof option === "object" && "value" in option
		&& isOptionValue((option as { value?: unknown }).value));
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
			.setName("Option collections")
			.setDesc("Create reusable value sets for select, multiselect and third-party field types.")
			.setHeading();

		this.renderValueCollections(containerEl);

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

	private renderValueCollections(containerEl: HTMLElement): void {
		let collectionName = "";
		new Setting(containerEl)
			.setName("New collection")
			.setDesc("Collections can be shared by any number of properties and plugins.")
			.addText((text) => text
				.setPlaceholder("Statuses")
				.onChange((value) => {
					collectionName = value;
				}))
			.addButton((button) => button
				.setButtonText("Create")
				.setCta()
				.onClick(async () => {
					const name = collectionName.trim();
					if (!name) {
						return;
					}
					await this.plugin.api.createValueOptionCollection({ name });
					this.display();
				}));

		for (const collection of this.plugin.api.getValueOptionCollections()) {
			const sectionEl = containerEl.createDiv({
				cls: ["props-framework-definition", "props-framework-collection"],
			});
			new Setting(sectionEl)
				.setName(collection.name)
				.setDesc(`${collection.options.length} value${collection.options.length === 1 ? "" : "s"}`)
				.setHeading();

			new Setting(sectionEl)
				.setName("Collection name")
				.addText((text) => text
					.setValue(collection.name)
					.setDisabled(Boolean(collection.readonly))
					.onChange(async (name) => {
						const normalized = name.trim();
						if (normalized && normalized !== collection.name) {
							await this.plugin.api.updateValueOptionCollection({ ...collection, name: normalized });
						}
					}));

			renderValueOptionsEditor(this.plugin, sectionEl, {
				binding: { mode: "shared", collectionId: collection.id },
				onChange: async () => undefined,
			}, { showBinding: false, showCollect: false });

			if (!collection.readonly) {
				new Setting(sectionEl)
					.addButton((button) => button
						.setButtonText("Remove collection")
						.setWarning()
						.onClick(async () => {
							const removed = await this.plugin.api.removeValueOptionCollection(collection.id);
							if (!removed) {
								new Notice("This collection is still used by one or more properties.");
								return;
							}
							this.display();
						}));
			}
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

		const type = this.plugin.api.getRegisteredType(definition.typeId);
		type?.renderSettings?.(sectionEl, {
			app: this.app,
			definition,
			getDefinition: () => this.plugin.api.getPropertyDefinition(definition.property) ?? definition,
			updateDefinition: async (nextDefinition) => {
				await this.plugin.api.setPropertyDefinition(nextDefinition);
			},
		});

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
