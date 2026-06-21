import { Plugin, TFile } from "obsidian";
import { NoteFieldsCoreApi, PropertyTypeRegistry } from "./api";
import { createNestedType } from "./builtins/nested";
import { createMultiselectType, createSelectType } from "./builtins/select";
import { ObsidianPropertyAdapter } from "./obsidian-adapter";
import {
	DEFAULT_SETTINGS,
	NoteFieldsSettingTab,
	getDefaultConfig,
	normalizeDefinition,
	normalizePropertyName,
} from "./settings";
import type {
	NoteFieldsSettings,
	PropertyDefinition,
	PropertyOption,
	NoteFieldsApi,
	SelectPropertyConfig,
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

	private readonly registry = new PropertyTypeRegistry();

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
	}

	onunload(): void {
		this.adapter?.unload();
		this.adapter = null;
	}

	async loadSettings(): Promise<void> {
		const data = ((await this.loadData()) ?? {}) as Partial<NoteFieldsSettings>;
		const properties = data.properties ?? {};

		this.settings = {
			...DEFAULT_SETTINGS,
			...data,
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
		};
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	collectOptions(propertyName: string, sourceFile?: TFile | null): PropertyOption[] {
		void sourceFile;
		const definition = this.api.getPropertyDefinition(propertyName);
		if (!definition || (definition.typeId !== "notefields:select" && definition.typeId !== "notefields:multiselect")) {
			return [];
		}

		const config = definition.config as SelectPropertyConfig;
		const options: PropertyOption[] = [];

		if (config.optionSource === "manual" || config.optionSource === "manual-and-vault") {
			options.push(...config.options);
		}

		if (config.optionSource === "vault" || config.optionSource === "manual-and-vault") {
			options.push(...this.collectVaultOptions(definition.property));
		}

		const seen = new Set<string>();
		return options.filter((option) => {
			if (!option.value || seen.has(option.value)) {
				return false;
			}
			seen.add(option.value);
			return true;
		});
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
		const resolveOptions = (propertyName: string): PropertyOption[] => this.collectOptions(propertyName);

		this.registry.register({
			...createSelectType(resolveOptions),
			ownerPluginId: this.manifest.id,
		});
		this.registry.register({
			...createMultiselectType(resolveOptions),
			ownerPluginId: this.manifest.id,
		});
		this.registry.register({
			...createNestedType(),
			ownerPluginId: this.manifest.id,
		});
	}

	private collectVaultOptions(propertyName: string): PropertyOption[] {
		const values = new Set<string>();

		for (const file of this.app.vault.getMarkdownFiles()) {
			const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
			if (!frontmatter) {
				continue;
			}

			const value = frontmatter[propertyName];
			if (Array.isArray(value)) {
				for (const item of value) {
					if (typeof item === "string" || typeof item === "number" || typeof item === "boolean") {
						values.add(String(item));
					}
				}
				continue;
			}

			if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
				values.add(String(value));
			}
		}

		return Array.from(values)
			.sort((a, b) => a.localeCompare(b))
			.map((value) => ({ value }));
	}
}

function cloneConfig<T>(config: T): T {
	if (config === null || typeof config !== "object") {
		return config;
	}

	return JSON.parse(JSON.stringify(config)) as T;
}
