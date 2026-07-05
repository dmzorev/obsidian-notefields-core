import { App, Notice, PluginSettingTab, Setting, setIcon } from "obsidian";
import type NoteFieldsCorePlugin from "./main";
import { createLocalBinding, isOptionValue, normalizeValueOption, uniqueValueOptions } from "./options";
import { PropertyBasicsModal, PropertySettingsModal } from "./obsidian-adapter";
import {
	CreateOptionCollectionModal,
	OptionCollectionModal,
	type OptionCollectionKind,
} from "./settings-modals";
import { showTypeMenu } from "./type-menu";
import type {
	CatalogPickerPropertyConfig,
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
	defaultRootKind: "object",
	defaultCollapsed: false,
	basesShowRootBraces: false,
	basesExpandNestedValues: true,
};

export const DEFAULT_SETTINGS: NoteFieldsSettings = {
	properties: {},
	valueOptionCollections: {},
	iconOptionCollections: {},
	colorOptionCollections: {},
	propertyTypeMenuVisibility: {},
	dataVersion: 4,
};

export function normalizePropertyName(propertyName: string): string {
	return propertyName.trim().toLowerCase();
}

export function getDefaultConfig(
	typeId: string
): SelectPropertyConfig | NestedPropertyConfig | CatalogPickerPropertyConfig | Record<string, never> {
	if (typeId === "notefields:select" || typeId === "notefields:multiselect") {
		return { ...DEFAULT_SELECT_CONFIG, optionBinding: createLocalBinding("string") };
	}

	if (typeId === "notefields:nested") {
		return { ...DEFAULT_NESTED_CONFIG };
	}
	if (typeId === "notefields:icon" || typeId === "notefields:color") {
		return { collectionId: null };
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
		visibility: normalizePropertyVisibility(definition.visibility),
		managedBy: normalizeManagedPropertyBinding(definition.managedBy),
		config,
	};
}

function normalizeManagedPropertyBinding(value: unknown): PropertyDefinition["managedBy"] {
	if (!value || typeof value !== "object") {
		return undefined;
	}
	const binding = value as Partial<NonNullable<PropertyDefinition["managedBy"]>>;
	if (!binding.ownerPluginId?.trim() || !binding.presetId?.trim()) {
		return undefined;
	}
	return {
		ownerPluginId: binding.ownerPluginId.trim(),
		presetId: binding.presetId.trim(),
		lockType: binding.lockType !== false,
	};
}

function normalizePropertyVisibility(value: unknown): PropertyDefinition["visibility"] {
	return value === "hidden" || value === "hidden-when-empty" ? value : "visible";
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
			.setName("Managed properties")
			.setDesc("Rich display and editing behavior for note properties.")
			.setHeading();
		this.renderAddDefinition(containerEl);

		const definitions = Object.values(this.plugin.settings.properties)
			.filter((definition) => Boolean(definition.property.trim()))
			.sort((a, b) => a.property.localeCompare(b.property));
		const propertyListEl = containerEl.createDiv({ cls: "props-framework-settings-list" });
		if (definitions.length === 0) {
			this.renderEmpty(propertyListEl, "No managed properties yet.");
		} else {
			for (const definition of definitions) {
				this.renderDefinitionRow(propertyListEl, definition);
			}
		}

		new Setting(containerEl)
			.setName("Option collections")
			.setDesc("Reusable values, icons and colors shared by fields and plugins.")
			.setHeading();
		this.renderCollectionGroup(containerEl, "Value collections", "value", "lucide-list-checks");
		this.renderCollectionGroup(containerEl, "Icon collections", "icon", "lucide-shapes");
		this.renderCollectionGroup(containerEl, "Color collections", "color", "lucide-palette");
	
		new Setting(containerEl)
			.setName("Property type menu visibility")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- NoteFields is a product name.
			.setDesc("Choose which registered NoteFields types appear in type menus. Existing fields keep working when a type is hidden.")
			.setHeading();
		this.renderTypeMenuVisibility(containerEl);
	}

	private renderTypeMenuVisibility(containerEl: HTMLElement): void {
		const listEl = containerEl.createDiv({ cls: "props-framework-settings-list" });
		for (const type of this.plugin.api.getRegisteredTypes().filter((candidate) => candidate.typeMenuVisibility !== "hidden")) {
			new Setting(listEl)
				.setName(type.name)
				.setDesc(type.id)
				.addToggle((toggle) => toggle
					.setTooltip("Show in property type menus")
					.setValue(this.plugin.isPropertyTypeVisible(type.id))
					.onChange(async (visible) => {
						await this.plugin.setPropertyTypeMenuVisibility(type.id, visible);
					}));
		}
	}

	private renderAddDefinition(containerEl: HTMLElement): void {
		let propertyName = "";

		new Setting(containerEl)
			.setName("Add property")
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
						typeId: "notefields:display",
						config: {},
					});
					this.display();
					new PropertyBasicsModal(this.plugin, property).open();
				}));
	}

	private renderDefinitionRow(parentEl: HTMLElement, definition: PropertyDefinition): void {
		const type = this.plugin.adapter?.getPropertyType(definition.property);
		const locked = definition.managedBy?.lockType === true;
		const rowEl = this.createListRow(
			parentEl,
			locked ? "lucide-lock-keyhole" : type?.icon ?? "lucide-file-question",
			locked
				? `Managed by ${definition.managedBy?.ownerPluginId ?? "plugin"}`
				: `Property type: ${type?.name ?? "Text"}`,
			(event) => {
				if (!locked) this.openPropertyTypeMenu(event, definition);
			}
		);

		this.renderListSummary(rowEl, definition.displayTitle?.trim() || definition.property, definition.property, () => {
			new PropertyBasicsModal(this.plugin, definition.property).open();
		});
		const actionsEl = rowEl.createDiv({ cls: "props-framework-list-actions" });
		this.createActionButton(actionsEl, "lucide-pencil", "Edit property", () => {
			new PropertyBasicsModal(this.plugin, definition.property).open();
		});
		if (this.plugin.api.getRegisteredType(definition.typeId)?.renderSettings) {
			this.createActionButton(actionsEl, "lucide-sliders-horizontal", "Property settings", () => {
				new PropertySettingsModal(this.plugin, definition.property).open();
			});
		}
		if (!definition.managedBy) {
			this.createActionButton(actionsEl, "lucide-trash-2", "Remove property", () => {
				void this.plugin.api.removePropertyDefinition(definition.property).then(() => this.display());
			}, true);
		}
	}

	private openPropertyTypeMenu(event: MouseEvent, definition: PropertyDefinition): void {
		const currentType = this.plugin.adapter?.getPropertyType(definition.property)?.id;
		const choices = (this.plugin.adapter?.getPropertyTypeChoices(definition.property) ?? []).map((choice) => ({
			...choice,
			group: choice.isFramework ? "framework" as const : "standard" as const,
		}));
		showTypeMenu(event, choices, currentType ?? "text", async (typeId) => {
			await this.plugin.adapter?.setPropertyType(definition.property, typeId);
			this.display();
		});
	}

	private renderCollectionGroup(
		containerEl: HTMLElement,
		name: string,
		kind: OptionCollectionKind,
		icon: string
	): void {
		new Setting(containerEl)
			.setName(name)
			.setHeading()
			.addExtraButton((button) => button
				.setIcon("lucide-plus")
				.setTooltip(`Add ${kind} collection`)
				.onClick(() => new CreateOptionCollectionModal(this.plugin, kind, () => this.display()).open()));
		const listEl = containerEl.createDiv({ cls: "props-framework-settings-list" });
		const collections = kind === "value"
			? this.plugin.api.getValueOptionCollections()
			: kind === "icon"
				? this.plugin.api.getIconOptionCollections()
				: this.plugin.api.getColorOptionCollections();
		if (collections.length === 0) {
			this.renderEmpty(listEl, `No ${kind} collections yet.`);
			return;
		}
		for (const collection of collections) {
			const open = (): void => new OptionCollectionModal(this.plugin, kind, collection.id).open();
			const rowEl = this.createListRow(listEl, icon, `Edit ${collection.name}`, () => open());
			this.renderListSummary(
				rowEl,
				collection.name,
				`${collection.options.length} ${kind}${collection.options.length === 1 ? "" : "s"}`,
				open
			);
			const actionsEl = rowEl.createDiv({ cls: "props-framework-list-actions" });
			this.createActionButton(actionsEl, "lucide-pencil", "Edit collection", open);
			if (!collection.readonly) {
				this.createActionButton(actionsEl, "lucide-trash-2", "Remove collection", () => {
					void this.removeCollection(kind, collection.id);
				}, true);
			}
		}
	}

	private async removeCollection(kind: OptionCollectionKind, id: string): Promise<void> {
		const removed = kind === "value"
			? await this.plugin.api.removeValueOptionCollection(id)
			: kind === "icon"
				? await this.plugin.api.removeIconOptionCollection(id)
				: await this.plugin.api.removeColorOptionCollection(id);
		if (!removed) {
			new Notice("This collection is still in use or cannot be removed.");
			return;
		}
		this.display();
	}

	private createListRow(
		parentEl: HTMLElement,
		icon: string,
		label: string,
		onIconClick: (event: MouseEvent) => void
	): HTMLElement {
		const rowEl = parentEl.createDiv({ cls: "props-framework-settings-row" });
		const iconButton = rowEl.createEl("button", {
			attr: { "aria-label": label, type: "button" },
			cls: ["clickable-icon", "props-framework-list-icon"],
		});
		setIcon(iconButton, icon);
		iconButton.addEventListener("click", onIconClick);
		return rowEl;
	}

	private renderListSummary(
		rowEl: HTMLElement,
		title: string,
		subtitle: string,
		onOpen: () => void
	): void {
		const summaryButton = rowEl.createEl("button", {
			attr: { type: "button" },
			cls: "props-framework-list-summary",
		});
		summaryButton.createDiv({ cls: "props-framework-list-title", text: title });
		summaryButton.createDiv({ cls: "props-framework-list-subtitle", text: subtitle });
		summaryButton.addEventListener("click", onOpen);
	}

	private createActionButton(
		parentEl: HTMLElement,
		icon: string,
		label: string,
		onClick: () => void,
		warning = false
	): void {
		const button = parentEl.createEl("button", {
			attr: { "aria-label": label, type: "button" },
			cls: ["clickable-icon", warning ? "is-warning" : ""],
		});
		setIcon(button, icon);
		button.addEventListener("click", onClick);
	}

	private renderEmpty(parentEl: HTMLElement, text: string): void {
		parentEl.createDiv({ cls: "props-framework-settings-empty", text });
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
