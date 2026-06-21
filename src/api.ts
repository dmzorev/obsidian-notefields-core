import type { App, TFile } from "obsidian";
import type PropsFrameworkPlugin from "./main";
import { normalizeDefinition, normalizePropertyName } from "./settings";
import type {
	PropertyDefinition,
	PropertyOption,
	PropertyRenderContext,
	PropertyType,
	PropertyTypeHandle,
	PropertyTypeId,
	PropertyTypeRegistration,
	PropsFrameworkApi,
} from "./types";
import { normalizeValidationResult, type PropertyValidationResult } from "./types";

export class PropertyTypeRegistry {
	private readonly registrations = new Map<PropertyTypeId, PropertyTypeRegistration>();

	register<TConfig>(registration: PropertyTypeRegistration<TConfig>): PropertyTypeHandle {
		const existing = this.registrations.get(registration.id);
		if (existing && (existing.priority ?? 0) > (registration.priority ?? 0)) {
			return { dispose: () => undefined };
		}

		this.registrations.set(registration.id, registration as PropertyTypeRegistration);

		return {
			dispose: () => {
				const current = this.registrations.get(registration.id);
				if (current?.ownerPluginId === registration.ownerPluginId) {
					this.registrations.delete(registration.id);
				}
			},
		};
	}

	get<TConfig = unknown>(typeId: PropertyTypeId): PropertyType<TConfig> | null {
		return (this.registrations.get(typeId) as PropertyTypeRegistration<TConfig> | undefined) ?? null;
	}

	getAll(): PropertyType[] {
		return Array.from(this.registrations.values())
			.sort((a, b) => a.name.localeCompare(b.name));
	}
}

export class FrameworkApi implements PropsFrameworkApi {
	constructor(
		private readonly plugin: PropsFrameworkPlugin,
		private readonly registry: PropertyTypeRegistry
	) {}

	getPropertyDefinition(propertyName: string): PropertyDefinition | null {
		const key = normalizePropertyName(propertyName);
		return this.plugin.settings.properties[key] ?? null;
	}

	getPropertyDefinitions(): PropertyDefinition[] {
		return Object.values(this.plugin.settings.properties);
	}

	async setPropertyDefinition(definition: PropertyDefinition): Promise<void> {
		const normalized = normalizeDefinition(definition);
		const key = normalizePropertyName(normalized.property);
		if (!key) {
			return;
		}

		this.plugin.settings.properties[key] = normalized;
		await this.plugin.saveSettings();
		this.refresh();
	}

	async removePropertyDefinition(propertyName: string): Promise<void> {
		const key = normalizePropertyName(propertyName);
		if (!key) {
			return;
		}

		delete this.plugin.settings.properties[key];
		await this.plugin.saveSettings();
		this.refresh();
	}

	getRegisteredType<TConfig = unknown>(typeId: PropertyTypeId): PropertyType<TConfig> | null {
		return this.registry.get<TConfig>(typeId);
	}

	getRegisteredTypes(): PropertyType[] {
		return this.registry.getAll();
	}

	registerType<TConfig = unknown>(registration: PropertyTypeRegistration<TConfig>): PropertyTypeHandle {
		const handle = this.registry.register(registration);
		this.refresh();

		return {
			dispose: () => {
				handle.dispose();
				this.refresh();
			},
		};
	}

	validateValue(propertyName: string, value: unknown): PropertyValidationResult {
		const definition = this.getPropertyDefinition(propertyName);
		if (!definition) {
			return { valid: true };
		}

		const type = this.registry.get(definition.typeId);
		if (!type) {
			return {
				valid: false,
				message: `Property type "${definition.typeId}" is not registered.`,
				severity: "error",
			};
		}

		if (!type.validate) {
			return { valid: true };
		}

		return normalizeValidationResult(type.validate(value, this.createRenderContext(definition, value)));
	}

	getOptions(propertyName: string, sourceFile?: TFile | null): PropertyOption[] {
		return this.plugin.collectOptions(propertyName, sourceFile);
	}

	refresh(): void {
		this.plugin.adapter?.reloadAllProperties();
	}

	createRenderContext<TConfig = unknown>(
		definition: PropertyDefinition<TConfig>,
		value: unknown,
		base?: Partial<PropertyRenderContext<TConfig>>
	): PropertyRenderContext<TConfig> {
		const type = this.registry.get<TConfig>(definition.typeId);

		return {
			app: this.plugin.app,
			config: definition.config,
			definition,
			key: definition.property,
			sourcePath: "",
			value,
			onChange: () => undefined,
			blur: () => undefined,
			validate: (nextValue) => {
				if (!type?.validate) {
					return { valid: true };
				}
				return normalizeValidationResult(type.validate(nextValue, this.createRenderContext(definition, nextValue, base)));
			},
			...base,
		};
	}
}

export function getPropsFrameworkApi(app: App): PropsFrameworkApi | null {
	const appWithPlugins = app as App & {
		plugins?: {
			plugins?: Record<string, { api?: PropsFrameworkApi }>;
			getPlugin?: (id: string) => { api?: PropsFrameworkApi } | null;
		};
	};

	return appWithPlugins.plugins?.getPlugin?.("obsidian-props-framework")?.api
		?? appWithPlugins.plugins?.plugins?.["obsidian-props-framework"]?.api
		?? null;
}
