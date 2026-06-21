import type {
	OptionValue,
	OptionValueType,
	ValueOption,
	ValueOptionBinding,
} from "./types";

export function createOptionId(prefix = "option"): string {
	const random = Math.random().toString(36).slice(2, 10);
	return `${prefix}-${Date.now().toString(36)}-${random}`;
}

export function createValueOption(value: OptionValue): ValueOption {
	return {
		id: createOptionId(),
		value,
	};
}

export function createLocalBinding(valueType: OptionValueType = "string"): ValueOptionBinding {
	return {
		mode: "local",
		valueType,
		options: [],
	};
}

export function optionValueKey(value: OptionValue): string {
	return `${typeof value}:${String(value)}`;
}

export function optionValuesEqual(left: unknown, right: unknown): boolean {
	return typeof left === typeof right && left === right;
}

export function formatOptionValue(value: OptionValue): string {
	return String(value);
}

export function isOptionValue(value: unknown): value is OptionValue {
	return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function valueMatchesType(value: OptionValue, valueType: OptionValueType): boolean {
	return valueType === "any" || typeof value === valueType;
}

export function coerceOptionValue(value: unknown, valueType: OptionValueType): OptionValue | null {
	if (!isOptionValue(value)) {
		return null;
	}

	if (valueType === "any" || typeof value === valueType) {
		return value;
	}

	if (valueType === "string") {
		return String(value);
	}

	if (valueType === "number") {
		if (typeof value === "boolean" || (typeof value === "string" && !value.trim())) {
			return null;
		}
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true") {
			return true;
		}
		if (normalized === "false") {
			return false;
		}
	}

	return null;
}

export function parseOptionInput(input: string, valueType: OptionValueType): OptionValue | null {
	if (valueType === "string" || valueType === "any") {
		return input.trim();
	}
	return coerceOptionValue(input, valueType);
}

export function normalizeValueOption(option: Partial<ValueOption> & { value: OptionValue }): ValueOption {
	return {
		...option,
		id: option.id || createOptionId(),
		aliases: option.aliases?.map((alias) => alias.trim()).filter(Boolean),
	};
}

export function uniqueValueOptions(options: ValueOption[]): ValueOption[] {
	const seen = new Set<string>();
	const result: ValueOption[] = [];

	for (const option of options) {
		const key = optionValueKey(option.value);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(option);
	}

	return result;
}

export function optionMatchesQuery(option: ValueOption, query: string): boolean {
	const normalized = query.trim().toLowerCase();
	if (!normalized) {
		return true;
	}

	return [formatOptionValue(option.value), option.label, ...(option.aliases ?? [])]
		.some((candidate) => candidate?.toLowerCase().includes(normalized));
}

export function cloneBinding(binding: ValueOptionBinding): ValueOptionBinding {
	if (binding.mode === "shared") {
		return { ...binding };
	}

	return {
		...binding,
		options: binding.options.map((option) => ({
			...option,
			aliases: option.aliases ? [...option.aliases] : undefined,
			meta: option.meta ? { ...option.meta } : undefined,
		})),
	};
}
