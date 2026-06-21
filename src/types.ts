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
	renderSettings?: (el: HTMLElement, ctx: PropertySettingsContext<TConfig>) => void;
}

export interface PropertyTypeRegistration<TConfig = unknown> extends PropertyType<TConfig> {
	ownerPluginId: string;
	priority?: number;
}

export interface PropertyOption {
	value: string;
	label?: string;
	icon?: string;
	color?: string;
}

export type OptionSourceMode = "manual" | "vault" | "manual-and-vault";

export interface SelectPropertyConfig {
	options: PropertyOption[];
	optionSource: OptionSourceMode;
	allowCustom: boolean;
	placeholder?: string;
}

export interface NestedPropertyConfig {
	defaultCollapsed: boolean;
}

export type BuiltInPropertyTypeId =
	| "notefields:select"
	| "notefields:multiselect"
	| "notefields:nested";

export interface PropertyDefinition<TConfig = unknown> {
	property: string;
	typeId: PropertyTypeId;
	icon?: string;
	displayTitle?: string;
	config: TConfig;
}

export interface PropertySettingsContext<TConfig = unknown> {
	app: App;
	definition: PropertyDefinition<TConfig>;
	updateDefinition: (definition: PropertyDefinition<TConfig>) => Promise<void>;
}

export interface NoteFieldsSettings {
	properties: Record<string, PropertyDefinition>;
	dataVersion: number;
}

export interface PropertyTypeHandle {
	dispose: () => void;
}

export interface NoteFieldsApi {
	getPropertyDefinition: (propertyName: string) => PropertyDefinition | null;
	getPropertyDefinitions: () => PropertyDefinition[];
	setPropertyDefinition: (definition: PropertyDefinition) => Promise<void>;
	removePropertyDefinition: (propertyName: string) => Promise<void>;
	getRegisteredType: <TConfig = unknown>(typeId: PropertyTypeId) => PropertyType<TConfig> | null;
	getRegisteredTypes: () => PropertyType[];
	registerType: <TConfig = unknown>(registration: PropertyTypeRegistration<TConfig>) => PropertyTypeHandle;
	validateValue: (propertyName: string, value: unknown) => PropertyValidationResult;
	getOptions: (propertyName: string, sourceFile?: TFile | null) => PropertyOption[];
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
