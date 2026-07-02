import type { App, TFile } from "obsidian";

export type PropertyTypeId = string;

export type PropertyValidationSeverity = "error" | "warning";

export interface PropertyValidationResult {
	valid: boolean;
	message?: string;
	severity?: PropertyValidationSeverity;
	details?: string[];
}

export type PropertyValidationReturn =
	| boolean
	| string
	| null
	| undefined
	| PropertyValidationResult;

export interface PropertyRenderContext<TConfig = unknown> {
	app: App;
	config: TConfig;
	definition: PropertyDefinition;
	key: string;
	sourcePath: string;
	value: unknown;
	onChange: (value: unknown) => void;
	blur: () => void;
	validate: (value: unknown) => PropertyValidationResult;
}

export interface PropertyWidgetComponent {
	type: string;
	focus?: () => void;
	setValue?: (value: unknown) => void;
	destroy?: () => void;
}

export interface PropertyType<TConfig = unknown> {
	id: PropertyTypeId;
	name: string;
	description?: string;
	icon?: string;
	defaultConfig: TConfig;
	validate?: (value: unknown, ctx: PropertyRenderContext<TConfig>) => PropertyValidationReturn;
	normalize?: (value: unknown, ctx: PropertyRenderContext<TConfig>) => unknown;
	render: (el: HTMLElement, ctx: PropertyRenderContext<TConfig>) => PropertyWidgetComponent;
	renderBase?: (el: HTMLElement, ctx: PropertyRenderContext<TConfig>) => PropertyWidgetComponent;
	renderSettings?: (el: HTMLElement, ctx: PropertySettingsContext<TConfig>) => void;
	optionSupport?: PropertyOptionSupport<TConfig>;
}

export interface PropertyTypeRegistration<TConfig = unknown> extends PropertyType<TConfig> {
	ownerPluginId: string;
	priority?: number;
}

export type OptionValue = string | number | boolean;

export type OptionValueType = "string" | "number" | "boolean" | "any";

export type OptionMetadata = Record<string, OptionValue>;

export interface ValueOption {
	id: string;
	value: OptionValue;
	label?: string;
	icon?: string;
	color?: string;
	aliases?: string[];
	meta?: OptionMetadata;
}

export type ValueOptionInput = Omit<ValueOption, "id"> & { id?: string };

export interface IconOption {
	id: string;
	value: string;
	label?: string;
	aliases?: string[];
	meta?: OptionMetadata;
}

export type IconOptionInput = Omit<IconOption, "id"> & { id?: string };

export interface ColorOption {
	id: string;
	value: string;
	label?: string;
	aliases?: string[];
	meta?: OptionMetadata;
}

export type ColorOptionInput = Omit<ColorOption, "id"> & { id?: string };

export interface LocalValueOptionBinding {
	mode: "local";
	valueType: OptionValueType;
	options: ValueOption[];
}

export interface SharedValueOptionBinding {
	mode: "shared";
	collectionId: string;
}

export type ValueOptionBinding = LocalValueOptionBinding | SharedValueOptionBinding;

export interface ValueOptionCollection {
	id: string;
	name: string;
	kind: "value";
	valueType: OptionValueType;
	options: ValueOption[];
	ownerPluginId?: string;
	readonly?: boolean;
	schemaVersion: number;
}

export interface IconOptionCollection {
	id: string;
	name: string;
	kind: "icon";
	options: IconOption[];
	ownerPluginId?: string;
	readonly?: boolean;
	schemaVersion: number;
}

export interface ColorOptionCollection {
	id: string;
	name: string;
	kind: "color";
	options: ColorOption[];
	ownerPluginId?: string;
	readonly?: boolean;
	schemaVersion: number;
}

export interface PropertyOptionSupport<TConfig = unknown> {
	kind: "value";
	getBinding: (config: TConfig) => ValueOptionBinding;
	setBinding: (config: TConfig, binding: ValueOptionBinding) => TConfig;
	allowLocal?: boolean;
	allowShared?: boolean;
}

export interface SelectPropertyConfig {
	optionBinding: ValueOptionBinding;
	allowCustom: boolean;
	autoAddCustomValues: boolean;
	placeholder?: string;
}

export interface NestedPropertyConfig {
	defaultCollapsed: boolean;
	basesShowRootBraces: boolean;
	basesExpandNestedValues: boolean;
}

export interface CatalogPickerPropertyConfig {
	collectionId?: string | null;
}

export type BuiltInPropertyTypeId =
	| "notefields:select"
	| "notefields:multiselect"
	| "notefields:nested"
	| "notefields:icon"
	| "notefields:color";

export type PropertyVisibility = "visible" | "hidden" | "hidden-when-empty";

export interface PropertyDefinition<TConfig = unknown> {
	property: string;
	typeId: PropertyTypeId;
	icon?: string;
	displayTitle?: string;
	visibility?: PropertyVisibility;
	config: TConfig;
}

export interface PropertySettingsContext<TConfig = unknown> {
	app: App;
	definition: PropertyDefinition<TConfig>;
	getDefinition?: () => PropertyDefinition<TConfig>;
	updateDefinition: (definition: PropertyDefinition<TConfig>) => Promise<void>;
}

export interface NoteFieldsSettings {
	properties: Record<string, PropertyDefinition>;
	valueOptionCollections: Record<string, ValueOptionCollection>;
	iconOptionCollections: Record<string, IconOptionCollection>;
	colorOptionCollections: Record<string, ColorOptionCollection>;
	propertyTypeMenuVisibility: Record<PropertyTypeId, boolean>;
	dataVersion: number;
}

export interface PropertyTypeHandle {
	dispose: () => void;
}

export interface CreateValueOptionCollectionInput {
	name: string;
	valueType?: OptionValueType;
	options?: ValueOptionInput[];
	ownerPluginId?: string;
	readonly?: boolean;
}

export interface CreateIconOptionCollectionInput {
	name: string;
	options?: IconOptionInput[];
	ownerPluginId?: string;
	readonly?: boolean;
}

export interface CreateColorOptionCollectionInput {
	name: string;
	options?: ColorOptionInput[];
	ownerPluginId?: string;
	readonly?: boolean;
}

export interface ValueOptionsEditorContext {
	binding: ValueOptionBinding;
	propertyName?: string;
	onChange: (binding: ValueOptionBinding) => Promise<void>;
}

export interface NoteFieldsApi {
	readonly apiVersion: 1;
	getPropertyDefinition: (propertyName: string) => PropertyDefinition | null;
	getPropertyDefinitions: () => PropertyDefinition[];
	setPropertyDefinition: (definition: PropertyDefinition) => Promise<void>;
	patchPropertyDefinition: (propertyName: string, patch: Partial<Omit<PropertyDefinition, "property">>) => Promise<boolean>;
	removePropertyDefinition: (propertyName: string) => Promise<void>;
	getRegisteredType: <TConfig = unknown>(typeId: PropertyTypeId) => PropertyType<TConfig> | null;
	getRegisteredTypes: () => PropertyType[];
	registerType: <TConfig = unknown>(registration: PropertyTypeRegistration<TConfig>) => PropertyTypeHandle;
	validateValue: (propertyName: string, value: unknown) => PropertyValidationResult;
	getOptions: (propertyName: string, sourceFile?: TFile | null) => ValueOption[];
	createValueOption: (input: ValueOptionInput) => ValueOption;
	getValueOptionCollections: () => ValueOptionCollection[];
	getValueOptionCollection: (collectionId: string) => ValueOptionCollection | null;
	createValueOptionCollection: (input: CreateValueOptionCollectionInput) => Promise<ValueOptionCollection>;
	updateValueOptionCollection: (collection: ValueOptionCollection) => Promise<void>;
	patchValueOption: (collectionId: string, optionId: string, patch: Partial<Omit<ValueOption, "id">>) => Promise<boolean>;
	patchPropertyValueOption: (propertyName: string, optionId: string, patch: Partial<Omit<ValueOption, "id">>) => Promise<boolean>;
	removeValueOptionCollection: (collectionId: string) => Promise<boolean>;
	resolveValueOptions: (binding: ValueOptionBinding) => ValueOption[];
	renderValueOptionsEditor: (el: HTMLElement, context: ValueOptionsEditorContext) => void;
	createIconOption: (input: IconOptionInput) => IconOption;
	getSystemIconCollectionId: () => string;
	getIconOptionCollections: () => IconOptionCollection[];
	getIconOptionCollection: (collectionId: string) => IconOptionCollection | null;
	createIconOptionCollection: (input: CreateIconOptionCollectionInput) => Promise<IconOptionCollection>;
	updateIconOptionCollection: (collection: IconOptionCollection) => Promise<void>;
	patchIconOption: (collectionId: string, optionId: string, patch: Partial<Omit<IconOption, "id">>) => Promise<boolean>;
	removeIconOptionCollection: (collectionId: string) => Promise<boolean>;
	resolveIconOptions: (collectionId?: string | null) => IconOption[];
	openIconPicker: (current: string | null, onChoose: (icon: string | null) => void | Promise<void>, collectionId?: string | null) => void;
	createColorOption: (input: ColorOptionInput) => ColorOption;
	getSystemColorCollectionId: () => string;
	getColorOptionCollections: () => ColorOptionCollection[];
	getColorOptionCollection: (collectionId: string) => ColorOptionCollection | null;
	createColorOptionCollection: (input: CreateColorOptionCollectionInput) => Promise<ColorOptionCollection>;
	updateColorOptionCollection: (collection: ColorOptionCollection) => Promise<void>;
	patchColorOption: (collectionId: string, optionId: string, patch: Partial<Omit<ColorOption, "id">>) => Promise<boolean>;
	removeColorOptionCollection: (collectionId: string) => Promise<boolean>;
	resolveColorOptions: (collectionId?: string | null) => ColorOption[];
	openColorPicker: (current: string | null, onChoose: (color: string | null) => void | Promise<void>, collectionId?: string | null) => void;
	refresh: () => void;
}

export function normalizeValidationResult(result: PropertyValidationReturn): PropertyValidationResult {
	if (result === true || result === undefined || result === null) {
		return { valid: true };
	}

	if (result === false) {
		return {
			valid: false,
			message: "Invalid value",
			severity: "error",
		};
	}

	if (typeof result === "string") {
		return {
			valid: false,
			message: result,
			severity: "error",
		};
	}

	return {
		severity: "error",
		...result,
	};
}
