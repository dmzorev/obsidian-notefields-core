import { getIconIds } from "obsidian";
import type NoteFieldsCorePlugin from "./main";
import { createOptionId } from "./options";
import type {
	ColorOption,
	ColorOptionCollection,
	ColorOptionInput,
	IconOption,
	IconOptionCollection,
	IconOptionInput,
} from "./types";

export const SYSTEM_ICON_COLLECTION_ID = "notefields:obsidian-icons";
export const SYSTEM_COLOR_COLLECTION_ID = "notefields:default-colors";

export const DEFAULT_COLOR_VALUES = [
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"pink",
	"gray",
];

export class CatalogOptionsService {
	constructor(private readonly plugin: NoteFieldsCorePlugin) {}

	resolveIcons(collectionId?: string | null): IconOption[] {
		if (collectionId === SYSTEM_ICON_COLLECTION_ID) {
			return getSystemIconOptions();
		}
		if (collectionId) {
			return cloneOptions(this.plugin.settings.iconOptionCollections[collectionId]?.options ?? []);
		}

		return uniqueCatalogOptions([
			...Object.values(this.plugin.settings.iconOptionCollections).flatMap((collection) => collection.options),
			...getSystemIconOptions(),
		]);
	}

	resolveColors(collectionId?: string | null): ColorOption[] {
		if (collectionId === SYSTEM_COLOR_COLLECTION_ID) {
			return getSystemColorOptions();
		}
		if (collectionId) {
			return cloneOptions(this.plugin.settings.colorOptionCollections[collectionId]?.options ?? []);
		}

		return uniqueCatalogOptions([
			...Object.values(this.plugin.settings.colorOptionCollections).flatMap((collection) => collection.options),
			...getSystemColorOptions(),
		]);
	}

	normalizeIconCollection(collection: IconOptionCollection): IconOptionCollection {
		return {
			...collection,
			id: collection.id || createOptionId("icon-collection"),
			name: collection.name?.trim() || "Untitled icon collection",
			kind: "icon",
			options: uniqueCatalogOptions((collection.options ?? []).map(normalizeIconOption).filter(hasCatalogValue)),
			schemaVersion: 1,
		};
	}

	normalizeColorCollection(collection: ColorOptionCollection): ColorOptionCollection {
		return {
			...collection,
			id: collection.id || createOptionId("color-collection"),
			name: collection.name?.trim() || "Untitled color collection",
			kind: "color",
			options: uniqueCatalogOptions((collection.options ?? []).map(normalizeColorOption).filter(hasCatalogValue)),
			schemaVersion: 1,
		};
	}
}

export function normalizeIconOption(option: IconOptionInput): IconOption {
	return {
		...option,
		id: option.id || createOptionId("icon"),
		value: option.value.trim(),
		label: option.label?.trim() || undefined,
		aliases: normalizeAliases(option.aliases),
	};
}

export function normalizeColorOption(option: ColorOptionInput): ColorOption {
	return {
		...option,
		id: option.id || createOptionId("color"),
		value: option.value.trim(),
		label: option.label?.trim() || undefined,
		aliases: normalizeAliases(option.aliases),
	};
}

export function catalogOptionMatchesQuery(option: IconOption | ColorOption, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return true;
	}
	return [option.value, option.label, ...(option.aliases ?? [])]
		.some((candidate) => candidate?.toLowerCase().includes(normalized));
}

export function colorToCss(color: string): string {
	if (/^#|rgb|hsl|var\(/u.test(color)) {
		return color;
	}
	return `rgba(var(--color-${color}-rgb), 1)`;
}

function getSystemIconOptions(): IconOption[] {
	return getIconIds().map((value) => ({
		id: `system-icon:${value}`,
		value,
		label: value.replace(/^lucide-/u, ""),
	}));
}

function getSystemColorOptions(): ColorOption[] {
	return DEFAULT_COLOR_VALUES.map((value) => ({
		id: `system-color:${value}`,
		value,
		label: `${value.charAt(0).toUpperCase()}${value.slice(1)}`,
	}));
}

function normalizeAliases(aliases?: string[]): string[] | undefined {
	const normalized = aliases?.map((alias) => alias.trim()).filter(Boolean);
	return normalized?.length ? normalized : undefined;
}

function hasCatalogValue<T extends IconOption | ColorOption>(option: T): boolean {
	return Boolean(option.value);
}

function uniqueCatalogOptions<T extends IconOption | ColorOption>(options: T[]): T[] {
	const seen = new Set<string>();
	return options.filter((option) => {
		if (seen.has(option.value)) {
			return false;
		}
		seen.add(option.value);
		return true;
	});
}

function cloneOptions<T extends IconOption | ColorOption>(options: T[]): T[] {
	return options.map((option) => ({
		...option,
		aliases: option.aliases ? [...option.aliases] : undefined,
		meta: option.meta ? { ...option.meta } : undefined,
	}));
}
