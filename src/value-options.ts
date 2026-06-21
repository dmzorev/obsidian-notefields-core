import type NoteFieldsCorePlugin from "./main";
import {
	coerceOptionValue,
	createOptionId,
	createValueOption,
	isOptionValue,
	normalizeValueOption,
	optionValueKey,
	optionValuesEqual,
	uniqueValueOptions,
} from "./options";
import type {
	OptionValue,
	OptionValueType,
	SelectPropertyConfig,
	ValueOption,
	ValueOptionBinding,
	ValueOptionCollection,
} from "./types";

export class ValueOptionsService {
	constructor(private readonly plugin: NoteFieldsCorePlugin) {}

	resolve(binding: ValueOptionBinding): ValueOption[] {
		if (binding.mode === "local") {
			return uniqueValueOptions(binding.options);
		}
		return uniqueValueOptions(this.plugin.settings.valueOptionCollections[binding.collectionId]?.options ?? []);
	}

	getPropertyBinding(propertyName: string): ValueOptionBinding | null {
		const definition = this.plugin.api.getPropertyDefinition(propertyName);
		if (!definition) {
			return null;
		}
		const type = this.plugin.api.getRegisteredType(definition.typeId);
		if (type?.optionSupport?.kind !== "value") {
			return null;
		}
		return type.optionSupport.getBinding(definition.config);
	}

	getValueType(binding: ValueOptionBinding): OptionValueType {
		return binding.mode === "local"
			? binding.valueType
			: this.plugin.settings.valueOptionCollections[binding.collectionId]?.valueType ?? "string";
	}

	async rememberCustomValue(propertyName: string, value: OptionValue): Promise<void> {
		const definition = this.plugin.api.getPropertyDefinition(propertyName);
		if (!definition) {
			return;
		}
		const config = definition.config as SelectPropertyConfig;
		if (!config.autoAddCustomValues) {
			return;
		}
		const binding = this.getPropertyBinding(propertyName);
		if (!binding) {
			return;
		}
		const normalized = coerceOptionValue(value, this.getValueType(binding));
		if (normalized === null || this.resolve(binding).some((option) => optionValuesEqual(option.value, normalized))) {
			return;
		}

		if (binding.mode === "shared") {
			const collection = this.plugin.settings.valueOptionCollections[binding.collectionId];
			if (!collection || collection.readonly) {
				return;
			}
			await this.plugin.api.updateValueOptionCollection({
				...collection,
				options: [...collection.options, createValueOption(normalized)],
			});
			return;
		}

		const type = this.plugin.api.getRegisteredType<SelectPropertyConfig>(definition.typeId);
		if (!type?.optionSupport) {
			return;
		}
		await this.plugin.api.setPropertyDefinition({
			...definition,
			config: type.optionSupport.setBinding(config, {
				...binding,
				options: [...binding.options, createValueOption(normalized)],
			}),
		});
	}

	async collectPropertyValues(propertyName: string): Promise<number> {
		const definition = this.plugin.api.getPropertyDefinition(propertyName);
		const binding = this.getPropertyBinding(propertyName);
		if (!definition || !binding) {
			return 0;
		}
		const valueType = this.getValueType(binding);
		const existing = new Set(this.resolve(binding).map((option) => optionValueKey(option.value)));
		const discovered: ValueOption[] = [];

		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			const frontmatter = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
			const rawValue = frontmatter?.[definition.property];
			const values = Array.isArray(rawValue) ? rawValue : [rawValue];
			for (const rawItem of values) {
				const item = coerceOptionValue(rawItem, valueType);
				if (item === null || existing.has(optionValueKey(item))) {
					continue;
				}
				existing.add(optionValueKey(item));
				discovered.push(createValueOption(item));
			}
		}

		if (!discovered.length) {
			return 0;
		}
		if (binding.mode === "shared") {
			const collection = this.plugin.settings.valueOptionCollections[binding.collectionId];
			if (!collection || collection.readonly) {
				return 0;
			}
			await this.plugin.api.updateValueOptionCollection({ ...collection, options: [...collection.options, ...discovered] });
		} else {
			const config = definition.config as SelectPropertyConfig;
			const type = this.plugin.api.getRegisteredType<SelectPropertyConfig>(definition.typeId);
			if (!type?.optionSupport) {
				return 0;
			}
			await this.plugin.api.setPropertyDefinition({
				...definition,
				config: type.optionSupport.setBinding(config, {
					...binding,
					options: [...binding.options, ...discovered],
				}),
			});
		}
		return discovered.length;
	}

	getPropertiesUsingCollection(collectionId: string): string[] {
		return this.plugin.api.getPropertyDefinitions()
			.filter((definition) => {
				const type = this.plugin.api.getRegisteredType(definition.typeId);
				if (type?.optionSupport?.kind !== "value") {
					return false;
				}
				const binding = type.optionSupport.getBinding(definition.config);
				return binding.mode === "shared" && binding.collectionId === collectionId;
			})
			.map((definition) => definition.property);
	}

	async replacePropertyValues(
		propertyNames: string[],
		replacements: Map<string, { from: OptionValue; to: OptionValue }>
	): Promise<void> {
		if (!propertyNames.length || !replacements.size) {
			return;
		}

		for (const file of this.plugin.app.vault.getMarkdownFiles()) {
			const cached = this.plugin.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
			if (!cached || !propertyNames.some((property) => valueContainsReplacement(cached[property], replacements))) {
				continue;
			}
			await this.plugin.app.fileManager.processFrontMatter(file, (frontmatter) => {
				const values = frontmatter as Record<string, unknown>;
				for (const property of propertyNames) {
					if (Object.prototype.hasOwnProperty.call(values, property)) {
						values[property] = replaceFrontmatterValue(values[property], replacements);
					}
				}
			});
		}
	}

	normalizeCollection(collection: ValueOptionCollection): ValueOptionCollection {
		return {
			...collection,
			id: collection.id || createOptionId("collection"),
			kind: "value",
			name: collection.name?.trim() || "Untitled collection",
			valueType: collection.valueType ?? "string",
			options: uniqueValueOptions((collection.options ?? [])
				.filter((option) => isOptionValue(option.value))
				.map((option) => normalizeValueOption(option))),
			schemaVersion: 1,
		};
	}

	async updateStoredWikilinks(oldPath: string, newPath: string): Promise<void> {
		let changed = false;
		const updateOptions = (options: ValueOption[]): ValueOption[] => options.map((option) => {
			const value = updateWikilink(option.value, oldPath, newPath);
			if (value === option.value) {
				return option;
			}
			changed = true;
			return { ...option, value };
		});

		for (const collection of Object.values(this.plugin.settings.valueOptionCollections)) {
			collection.options = uniqueValueOptions(updateOptions(collection.options));
		}
		for (const definition of Object.values(this.plugin.settings.properties)) {
			const type = this.plugin.api.getRegisteredType(definition.typeId);
			if (type?.optionSupport?.kind !== "value") {
				continue;
			}
			const binding = type.optionSupport.getBinding(definition.config);
			if (binding.mode !== "local") {
				continue;
			}
			definition.config = type.optionSupport.setBinding(definition.config, {
				...binding,
				options: uniqueValueOptions(updateOptions(binding.options)),
			});
		}
		if (changed) {
			await this.plugin.saveSettings();
			this.plugin.api.refresh();
		}
	}
}

function valueContainsReplacement(value: unknown, replacements: Map<string, { from: OptionValue; to: OptionValue }>): boolean {
	if (Array.isArray(value)) {
		return value.some((item) => isOptionValue(item) && replacements.has(optionValueKey(item)));
	}
	return isOptionValue(value) && replacements.has(optionValueKey(value));
}

function replaceFrontmatterValue(value: unknown, replacements: Map<string, { from: OptionValue; to: OptionValue }>): unknown {
	if (Array.isArray(value)) {
		return value.map((item) => replaceFrontmatterValue(item, replacements));
	}
	if (!isOptionValue(value)) {
		return value;
	}
	return replacements.get(optionValueKey(value))?.to ?? value;
}

function updateWikilink(value: OptionValue, oldPath: string, newPath: string): OptionValue {
	if (typeof value !== "string") {
		return value;
	}
	const match = /^\[\[([^\]|#]+)(#[^\]|]+)?(\|[^\]]+)?\]\]$/u.exec(value);
	if (!match) {
		return value;
	}
	const target = match[1] ?? "";
	const oldWithoutExtension = oldPath.replace(/\.md$/u, "");
	const oldName = oldWithoutExtension.split("/").pop() ?? oldWithoutExtension;
	if (target !== oldWithoutExtension && target !== oldName) {
		return value;
	}
	const newWithoutExtension = newPath.replace(/\.md$/u, "");
	const newName = newWithoutExtension.split("/").pop() ?? newWithoutExtension;
	const nextTarget = target.includes("/") ? newWithoutExtension : newName;
	return `[[${nextTarget}${match[2] ?? ""}${match[3] ?? ""}]]`;
}
