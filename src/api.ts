import type { App, TFile } from "obsidian";
import {
	normalizeColorOption,
	normalizeIconOption,
	SYSTEM_COLOR_COLLECTION_ID,
	SYSTEM_ICON_COLLECTION_ID,
} from "./catalog-options";
import type NoteFieldsCorePlugin from "./main";
import { createOptionId, normalizeValueOption, optionValuesEqual, uniqueValueOptions } from "./options";
import { renderValueOptionsEditor } from "./options-editor";
import { ColorPickerModal, IconPickerModal } from "./pickers";
import { normalizeDefinition, normalizePropertyName } from "./settings";
import type {
	PropertyDefinition,
	ColorOption,
	ColorOptionCollection,
	ColorOptionInput,
	CreateColorOptionCollectionInput,
	CreateIconOptionCollectionInput,
	CreateValueOptionCollectionInput,
	IconOption,
	IconOptionCollection,
	IconOptionInput,
	OptionValue,
	PropertyRenderContext,
	PropertyType,
	PropertyTypeHandle,
	PropertyTypeId,
	PropertyTypeRegistration,
	NoteFieldsApi,
	ValueOption,
	ValueOptionBinding,
	ValueOptionCollection,
	ValueOptionInput,
	ValueOptionsEditorContext,
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

export class NoteFieldsCoreApi implements NoteFieldsApi {
	readonly apiVersion = 1 as const;

	constructor(
		private readonly plugin: NoteFieldsCorePlugin,
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
		await this.plugin.runSettingsMutation(() => this.setPropertyDefinitionNow(definition));
	}

	private async setPropertyDefinitionNow(definition: PropertyDefinition): Promise<void> {
		const normalized = normalizeDefinition(definition);
		const key = normalizePropertyName(normalized.property);
		if (!key) {
			return;
		}

		const previous = this.plugin.settings.properties[key];
		if (previous) {
			const type = this.registry.get(previous.typeId);
			const nextType = this.registry.get(normalized.typeId);
			if (type?.optionSupport?.kind === "value" && nextType?.optionSupport?.kind === "value") {
				const previousBinding = type.optionSupport.getBinding(previous.config);
				const nextBinding = nextType.optionSupport.getBinding(normalized.config);
				if (previousBinding.mode === "local" && nextBinding.mode === "local") {
					await this.plugin.valueOptions.replacePropertyValues(
						[normalized.property],
						getOptionReplacements(previousBinding.options, nextBinding.options)
					);
				}
			}
		}

		this.plugin.settings.properties[key] = normalized;
		await this.plugin.saveSettings();
		this.refresh();
	}

	async patchPropertyDefinition(
		propertyName: string,
		patch: Partial<Omit<PropertyDefinition, "property">>
	): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const definition = this.getPropertyDefinition(propertyName);
			if (!definition) {
				return false;
			}
			await this.setPropertyDefinitionNow({ ...definition, ...patch, property: definition.property });
			return true;
		});
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
		this.plugin.adapter?.registerTypeWidget(registration.id);
		this.refresh();

		return {
			dispose: () => {
				handle.dispose();
				this.plugin.adapter?.unregisterTypeWidget(registration.id);
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

	getOptions(propertyName: string, sourceFile?: TFile | null): ValueOption[] {
		return this.plugin.collectOptions(propertyName, sourceFile);
	}

	createValueOption(input: ValueOptionInput): ValueOption {
		return normalizeValueOption(input);
	}

	getValueOptionCollections(): ValueOptionCollection[] {
		return Object.values(this.plugin.settings.valueOptionCollections)
			.map((collection) => cloneCollection(collection))
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	getValueOptionCollection(collectionId: string): ValueOptionCollection | null {
		const collection = this.plugin.settings.valueOptionCollections[collectionId];
		return collection ? cloneCollection(collection) : null;
	}

	async createValueOptionCollection(input: CreateValueOptionCollectionInput): Promise<ValueOptionCollection> {
		const collection: ValueOptionCollection = {
			id: createOptionId("collection"),
			name: input.name.trim() || "Untitled collection",
			kind: "value",
			valueType: input.valueType ?? "string",
			options: uniqueValueOptions((input.options ?? []).map((option) => normalizeValueOption(option))),
			ownerPluginId: input.ownerPluginId,
			readonly: input.readonly,
			schemaVersion: 1,
		};
		this.plugin.settings.valueOptionCollections[collection.id] = collection;
		await this.plugin.saveSettings();
		this.refresh();
		return cloneCollection(collection);
	}

	async updateValueOptionCollection(collection: ValueOptionCollection): Promise<void> {
		await this.plugin.runSettingsMutation(() => this.updateValueOptionCollectionNow(collection));
	}

	private async updateValueOptionCollectionNow(collection: ValueOptionCollection): Promise<void> {
		const previous = this.plugin.settings.valueOptionCollections[collection.id];
		if (!previous || previous.readonly) {
			return;
		}
		const normalized: ValueOptionCollection = {
			...collection,
			name: collection.name.trim() || previous.name,
			kind: "value",
			options: uniqueValueOptions(collection.options.map((option) => normalizeValueOption(option))),
			schemaVersion: 1,
		};
		await this.plugin.valueOptions.replacePropertyValues(
			this.plugin.valueOptions.getPropertiesUsingCollection(collection.id),
			getOptionReplacements(previous.options, normalized.options)
		);
		this.plugin.settings.valueOptionCollections[collection.id] = normalized;
		await this.plugin.saveSettings();
		this.refresh();
	}

	async patchValueOption(
		collectionId: string,
		optionId: string,
		patch: Partial<Omit<ValueOption, "id">>
	): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.valueOptionCollections[collectionId];
			if (!collection || collection.readonly || !collection.options.some((option) => option.id === optionId)) {
				return false;
			}
			await this.updateValueOptionCollectionNow({
				...collection,
				options: collection.options.map((option) => option.id === optionId ? { ...option, ...patch } : option),
			});
			return true;
		});
	}

	async appendValueOption(collectionId: string, option: ValueOption): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.valueOptionCollections[collectionId];
			if (!collection || collection.readonly) {
				return false;
			}
			await this.updateValueOptionCollectionNow({
				...collection,
				options: [...collection.options, option],
			});
			return true;
		});
	}

	async removeValueOption(collectionId: string, optionId: string): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.valueOptionCollections[collectionId];
			if (!collection || collection.readonly) {
				return false;
			}
			await this.updateValueOptionCollectionNow({
				...collection,
				options: collection.options.filter((option) => option.id !== optionId),
			});
			return true;
		});
	}

	async patchPropertyValueOption(
		propertyName: string,
		optionId: string,
		patch: Partial<Omit<ValueOption, "id">>
	): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const definition = this.getPropertyDefinition(propertyName);
			const type = definition ? this.registry.get(definition.typeId) : null;
			if (!definition || type?.optionSupport?.kind !== "value") {
				return false;
			}
			const binding = type.optionSupport.getBinding(definition.config);
			if (binding.mode !== "local" || !binding.options.some((option) => option.id === optionId)) {
				return false;
			}
			await this.setPropertyDefinitionNow({
				...definition,
				config: type.optionSupport.setBinding(definition.config, {
					...binding,
					options: binding.options.map((option) => option.id === optionId ? { ...option, ...patch } : option),
				}),
			});
			return true;
		});
	}

	async appendPropertyValueOption(propertyName: string, option: ValueOption): Promise<boolean> {
		return this.mutateLocalPropertyOptions(propertyName, (options) => [...options, option]);
	}

	async removePropertyValueOption(propertyName: string, optionId: string): Promise<boolean> {
		return this.mutateLocalPropertyOptions(
			propertyName,
			(options) => options.filter((option) => option.id !== optionId)
		);
	}

	private mutateLocalPropertyOptions(
		propertyName: string,
		mutate: (options: ValueOption[]) => ValueOption[]
	): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const definition = this.getPropertyDefinition(propertyName);
			const type = definition ? this.registry.get(definition.typeId) : null;
			if (!definition || type?.optionSupport?.kind !== "value") {
				return false;
			}
			const binding = type.optionSupport.getBinding(definition.config);
			if (binding.mode !== "local") {
				return false;
			}
			await this.setPropertyDefinitionNow({
				...definition,
				config: type.optionSupport.setBinding(definition.config, {
					...binding,
					options: mutate(binding.options),
				}),
			});
			return true;
		});
	}

	async removeValueOptionCollection(collectionId: string): Promise<boolean> {
		const collection = this.plugin.settings.valueOptionCollections[collectionId];
		if (!collection || collection.readonly || this.plugin.valueOptions.getPropertiesUsingCollection(collectionId).length) {
			return false;
		}
		delete this.plugin.settings.valueOptionCollections[collectionId];
		await this.plugin.saveSettings();
		this.refresh();
		return true;
	}

	resolveValueOptions(binding: ValueOptionBinding): ValueOption[] {
		return this.plugin.valueOptions.resolve(binding).map((option) => ({ ...option }));
	}

	renderValueOptionsEditor(el: HTMLElement, context: ValueOptionsEditorContext): void {
		const managedContext: ValueOptionsEditorContext = context.propertyName
			? {
				...context,
				onChange: async (binding) => {
					const definition = this.getPropertyDefinition(context.propertyName ?? "");
					const type = definition ? this.registry.get(definition.typeId) : null;
					if (!definition || type?.optionSupport?.kind !== "value") {
						await context.onChange(binding);
						return;
					}
					await this.setPropertyDefinition({
						...definition,
						config: type.optionSupport.setBinding(definition.config, binding),
					});
				},
			}
			: context;
		renderValueOptionsEditor(this.plugin, el, managedContext);
	}

	createIconOption(input: IconOptionInput): IconOption {
		return normalizeIconOption(input);
	}

	getSystemIconCollectionId(): string {
		return SYSTEM_ICON_COLLECTION_ID;
	}

	getIconOptionCollections(): IconOptionCollection[] {
		return Object.values(this.plugin.settings.iconOptionCollections)
			.map(cloneCatalogCollection)
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	getIconOptionCollection(collectionId: string): IconOptionCollection | null {
		const collection = this.plugin.settings.iconOptionCollections[collectionId];
		return collection ? cloneCatalogCollection(collection) : null;
	}

	async createIconOptionCollection(input: CreateIconOptionCollectionInput): Promise<IconOptionCollection> {
		const collection = this.plugin.catalogOptions.normalizeIconCollection({
			id: createOptionId("icon-collection"),
			name: input.name,
			kind: "icon",
			options: (input.options ?? []).map(normalizeIconOption),
			ownerPluginId: input.ownerPluginId,
			readonly: input.readonly,
			schemaVersion: 1,
		});
		this.plugin.settings.iconOptionCollections[collection.id] = collection;
		await this.plugin.saveSettings();
		return cloneCatalogCollection(collection);
	}

	async updateIconOptionCollection(collection: IconOptionCollection): Promise<void> {
		await this.plugin.runSettingsMutation(() => this.updateIconOptionCollectionNow(collection));
	}

	private async updateIconOptionCollectionNow(collection: IconOptionCollection): Promise<void> {
		const previous = this.plugin.settings.iconOptionCollections[collection.id];
		if (!previous || previous.readonly) {
			return;
		}
		this.plugin.settings.iconOptionCollections[collection.id] = this.plugin.catalogOptions.normalizeIconCollection(collection);
		await this.plugin.saveSettings();
		this.refresh();
	}

	async patchIconOption(
		collectionId: string,
		optionId: string,
		patch: Partial<Omit<IconOption, "id">>
	): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.iconOptionCollections[collectionId];
			if (!collection || collection.readonly || !collection.options.some((option) => option.id === optionId)) {
				return false;
			}
			await this.updateIconOptionCollectionNow({
				...collection,
				options: collection.options.map((option) => option.id === optionId ? { ...option, ...patch } : option),
			});
			return true;
		});
	}

	async appendIconOption(collectionId: string, option: IconOption): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.iconOptionCollections[collectionId];
			if (!collection || collection.readonly) {
				return false;
			}
			await this.updateIconOptionCollectionNow({ ...collection, options: [...collection.options, option] });
			return true;
		});
	}

	async removeIconOption(collectionId: string, optionId: string): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.iconOptionCollections[collectionId];
			if (!collection || collection.readonly) {
				return false;
			}
			await this.updateIconOptionCollectionNow({
				...collection,
				options: collection.options.filter((option) => option.id !== optionId),
			});
			return true;
		});
	}

	async removeIconOptionCollection(collectionId: string): Promise<boolean> {
		const collection = this.plugin.settings.iconOptionCollections[collectionId];
		if (!collection || collection.readonly) {
			return false;
		}
		delete this.plugin.settings.iconOptionCollections[collectionId];
		await this.plugin.saveSettings();
		return true;
	}

	resolveIconOptions(collectionId?: string | null): IconOption[] {
		return this.plugin.catalogOptions.resolveIcons(collectionId).map(cloneCatalogOption);
	}

	openIconPicker(
		current: string | null,
		onChoose: (icon: string | null) => void | Promise<void>,
		collectionId?: string | null
	): void {
		new IconPickerModal(this.plugin, current, onChoose, collectionId ?? null).open();
	}

	createColorOption(input: ColorOptionInput): ColorOption {
		return normalizeColorOption(input);
	}

	getSystemColorCollectionId(): string {
		return SYSTEM_COLOR_COLLECTION_ID;
	}

	getColorOptionCollections(): ColorOptionCollection[] {
		return Object.values(this.plugin.settings.colorOptionCollections)
			.map(cloneCatalogCollection)
			.sort((left, right) => left.name.localeCompare(right.name));
	}

	getColorOptionCollection(collectionId: string): ColorOptionCollection | null {
		const collection = this.plugin.settings.colorOptionCollections[collectionId];
		return collection ? cloneCatalogCollection(collection) : null;
	}

	async createColorOptionCollection(input: CreateColorOptionCollectionInput): Promise<ColorOptionCollection> {
		const collection = this.plugin.catalogOptions.normalizeColorCollection({
			id: createOptionId("color-collection"),
			name: input.name,
			kind: "color",
			options: (input.options ?? []).map(normalizeColorOption),
			ownerPluginId: input.ownerPluginId,
			readonly: input.readonly,
			schemaVersion: 1,
		});
		this.plugin.settings.colorOptionCollections[collection.id] = collection;
		await this.plugin.saveSettings();
		return cloneCatalogCollection(collection);
	}

	async updateColorOptionCollection(collection: ColorOptionCollection): Promise<void> {
		await this.plugin.runSettingsMutation(() => this.updateColorOptionCollectionNow(collection));
	}

	private async updateColorOptionCollectionNow(collection: ColorOptionCollection): Promise<void> {
		const previous = this.plugin.settings.colorOptionCollections[collection.id];
		if (!previous || previous.readonly) {
			return;
		}
		this.plugin.settings.colorOptionCollections[collection.id] = this.plugin.catalogOptions.normalizeColorCollection(collection);
		await this.plugin.saveSettings();
		this.refresh();
	}

	async patchColorOption(
		collectionId: string,
		optionId: string,
		patch: Partial<Omit<ColorOption, "id">>
	): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.colorOptionCollections[collectionId];
			if (!collection || collection.readonly || !collection.options.some((option) => option.id === optionId)) {
				return false;
			}
			await this.updateColorOptionCollectionNow({
				...collection,
				options: collection.options.map((option) => option.id === optionId ? { ...option, ...patch } : option),
			});
			return true;
		});
	}

	async appendColorOption(collectionId: string, option: ColorOption): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.colorOptionCollections[collectionId];
			if (!collection || collection.readonly) {
				return false;
			}
			await this.updateColorOptionCollectionNow({ ...collection, options: [...collection.options, option] });
			return true;
		});
	}

	async removeColorOption(collectionId: string, optionId: string): Promise<boolean> {
		return this.plugin.runSettingsMutation(async () => {
			const collection = this.plugin.settings.colorOptionCollections[collectionId];
			if (!collection || collection.readonly) {
				return false;
			}
			await this.updateColorOptionCollectionNow({
				...collection,
				options: collection.options.filter((option) => option.id !== optionId),
			});
			return true;
		});
	}

	async removeColorOptionCollection(collectionId: string): Promise<boolean> {
		const collection = this.plugin.settings.colorOptionCollections[collectionId];
		if (!collection || collection.readonly) {
			return false;
		}
		delete this.plugin.settings.colorOptionCollections[collectionId];
		await this.plugin.saveSettings();
		return true;
	}

	resolveColorOptions(collectionId?: string | null): ColorOption[] {
		return this.plugin.catalogOptions.resolveColors(collectionId).map(cloneCatalogOption);
	}

	openColorPicker(
		current: string | null,
		onChoose: (color: string | null) => void | Promise<void>,
		collectionId?: string | null
	): void {
		new ColorPickerModal(this.plugin, current, onChoose, collectionId ?? null).open();
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

function getOptionReplacements(previous: ValueOption[], next: ValueOption[]): Map<string, { from: OptionValue; to: OptionValue }> {
	const nextById = new Map(next.map((option) => [option.id, option]));
	const replacements = new Map<string, { from: OptionValue; to: OptionValue }>();
	for (const option of previous) {
		const nextOption = nextById.get(option.id);
		if (nextOption && !optionValuesEqual(option.value, nextOption.value)) {
			replacements.set(`${typeof option.value}:${String(option.value)}`, {
				from: option.value,
				to: nextOption.value,
			});
		}
	}
	return replacements;
}

function cloneCollection(collection: ValueOptionCollection): ValueOptionCollection {
	return {
		...collection,
		options: collection.options.map((option) => ({
			...option,
			aliases: option.aliases ? [...option.aliases] : undefined,
			meta: option.meta ? { ...option.meta } : undefined,
		})),
	};
}

function cloneCatalogCollection<T extends IconOptionCollection | ColorOptionCollection>(collection: T): T {
	return {
		...collection,
		options: collection.options.map((option) => ({
			...option,
			aliases: option.aliases ? [...option.aliases] : undefined,
			meta: option.meta ? { ...option.meta } : undefined,
		})),
	};
}

function cloneCatalogOption<T extends IconOption | ColorOption>(option: T): T {
	return {
		...option,
		aliases: option.aliases ? [...option.aliases] : undefined,
		meta: option.meta ? { ...option.meta } : undefined,
	};
}

export function getNoteFieldsApi(app: App): NoteFieldsApi | null {
	const appWithPlugins = app as App & {
		plugins?: {
			plugins?: Record<string, { api?: NoteFieldsApi }>;
			getPlugin?: (id: string) => { api?: NoteFieldsApi } | null;
		};
	};

	return appWithPlugins.plugins?.getPlugin?.("notefields-core")?.api
		?? appWithPlugins.plugins?.plugins?.["notefields-core"]?.api
		?? appWithPlugins.plugins?.getPlugin?.("obsidian-props-framework")?.api
		?? appWithPlugins.plugins?.plugins?.["obsidian-props-framework"]?.api
		?? null;
}
