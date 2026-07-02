import { Plugin, TFile } from "obsidian";
import { NoteFieldsCoreApi, PropertyTypeRegistry } from "./api";
import { createNestedType } from "./builtins/nested";
import { createMultiselectType, createSelectType } from "./builtins/select";
import { CatalogOptionsService } from "./catalog-options";
import { ObsidianPropertyAdapter } from "./obsidian-adapter";
import {
	DEFAULT_SETTINGS,
	NoteFieldsSettingTab,
	getDefaultConfig,
	normalizeDefinition,
	normalizePropertyName,
} from "./settings";
import { ValueOptionsService } from "./value-options";
import type {
	NoteFieldsSettings,
	OptionValue,
	OptionValueType,
	PropertyDefinition,
	NoteFieldsApi,
	ValueOption,
} from "./types";

declare module "obsidian" {
	interface Plugin {
		api?: NoteFieldsApi;
	}
}

export default class NoteFieldsCorePlugin extends Plugin {
	settings: NoteFieldsSettings;
	api: NoteFieldsCoreApi;
	adapter: ObsidianPropertyAdapter | null = null;
	readonly catalogOptions = new CatalogOptionsService(this);
	readonly valueOptions = new ValueOptionsService(this);

	private readonly registry = new PropertyTypeRegistry();
	private settingsMutationQueue: Promise<void> = Promise.resolve();
	private settingsSaveQueue: Promise<void> = Promise.resolve();

	async onload(): Promise<void> {
		await this.loadSettings();

		this.api = new NoteFieldsCoreApi(this, this.registry);
		this.registerBuiltInTypes();

		this.adapter = new ObsidianPropertyAdapter(this);
		this.adapter.load();

		this.addSettingTab(new NoteFieldsSettingTab(this.app, this));
		this.addCommand({
			id: "refresh-managed-properties",
			name: "Refresh managed properties",
			callback: () => this.adapter?.reloadAllProperties(),
		});
		this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
			if (file instanceof TFile && file.extension === "md") {
				void this.valueOptions.updateStoredWikilinks(oldPath, file.path);
			}
		}));
	}

	onunload(): void {
		this.adapter?.unload();
		this.adapter = null;
	}

	async loadSettings(): Promise<void> {
		const data = ((await this.loadData()) ?? {}) as Partial<NoteFieldsSettings>;
		const properties = data.properties ?? {};
		const collections = data.valueOptionCollections ?? {};
		const iconCollections = data.iconOptionCollections ?? {};
		const colorCollections = data.colorOptionCollections ?? {};

		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
			dataVersion: 3,
			properties: Object.fromEntries(
				Object.entries(properties)
					.map(([key, definition]) => {
						const normalized = normalizeDefinition({
							...definition,
							property: definition.property || key,
						});
						return [normalizePropertyName(normalized.property), normalized];
					})
			),
			valueOptionCollections: Object.fromEntries(
				Object.entries(collections).map(([key, collection]) => {
					const normalized = this.valueOptions.normalizeCollection({ ...collection, id: collection.id || key });
					return [normalized.id, normalized];
				})
			),
			iconOptionCollections: Object.fromEntries(
				Object.entries(iconCollections).map(([key, collection]) => {
					const normalized = this.catalogOptions.normalizeIconCollection({ ...collection, id: collection.id || key });
					return [normalized.id, normalized];
				})
			),
			colorOptionCollections: Object.fromEntries(
				Object.entries(colorCollections).map(([key, collection]) => {
					const normalized = this.catalogOptions.normalizeColorCollection({ ...collection, id: collection.id || key });
					return [normalized.id, normalized];
				})
			),
		};
	}

	async saveSettings(): Promise<void> {
		const snapshot = structuredClone(this.settings);
		const save = this.settingsSaveQueue.then(
			() => this.saveData(snapshot),
			() => this.saveData(snapshot)
		);
		this.settingsSaveQueue = save.then(() => undefined, () => undefined);
		await save;
	}

	runSettingsMutation<T>(operation: () => Promise<T>): Promise<T> {
		const result = this.settingsMutationQueue.then(operation, operation);
		this.settingsMutationQueue = result.then(() => undefined, () => undefined);
		return result;
	}

	collectOptions(propertyName: string, sourceFile?: TFile | null): ValueOption[] {
		void sourceFile;
		const binding = this.valueOptions.getPropertyBinding(propertyName);
		return binding ? this.valueOptions.resolve(binding) : [];
	}

	ensurePropertyDefinition(propertyName: string, typeId: string): PropertyDefinition {
		const existing = this.api.getPropertyDefinition(propertyName);
		if (existing?.typeId === typeId) {
			return existing;
		}

		const type = this.api.getRegisteredType(typeId);
		const definition = normalizeDefinition({
			...(existing ?? {}),
			property: propertyName,
			typeId,
			config: cloneConfig(type?.defaultConfig ?? getDefaultConfig(typeId)),
		});

		this.settings.properties[normalizePropertyName(propertyName)] = definition;
		void this.saveSettings();
		return definition;
	}

	ensureDisplayDefinition(propertyName: string): PropertyDefinition {
		const existing = this.api.getPropertyDefinition(propertyName);
		if (existing) {
			return existing;
		}

		const definition = normalizeDefinition({
			property: propertyName,
			typeId: "notefields:display",
			config: {},
		});

		this.settings.properties[normalizePropertyName(propertyName)] = definition;
		void this.saveSettings();
		return definition;
	}

	private registerBuiltInTypes(): void {
		const resolveOptions = (propertyName: string): ValueOption[] => this.collectOptions(propertyName);
		const rememberCustomValue = (propertyName: string, value: OptionValue): void => {
			void this.valueOptions.rememberCustomValue(propertyName, value);
		};
		const renderOptionsEditor = this.api.renderValueOptionsEditor.bind(this.api);
		const resolveValueType = (propertyName: string): OptionValueType => {
			const binding = this.valueOptions.getPropertyBinding(propertyName);
			return binding ? this.valueOptions.getValueType(binding) : "string";
		};

		this.registry.register({
			...createSelectType(resolveOptions, rememberCustomValue, renderOptionsEditor, resolveValueType),
			ownerPluginId: this.manifest.id,
		});
		this.registry.register({
			...createMultiselectType(resolveOptions, rememberCustomValue, renderOptionsEditor, resolveValueType),
			ownerPluginId: this.manifest.id,
		});
		this.registry.register({
			...createNestedType(),
			ownerPluginId: this.manifest.id,
		});
	}

}

function cloneConfig<T>(config: T): T {
	if (config === null || typeof config !== "object") {
		return config;
	}

	return JSON.parse(JSON.stringify(config)) as T;
}
