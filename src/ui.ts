import { setIcon } from "obsidian";
import type { PropertyOption, PropertyValidationResult } from "./types";

export function renderValidation(el: HTMLElement, result: PropertyValidationResult): void {
	if (result.valid) {
		return;
	}

	const warningEl = el.createDiv({
		cls: [
			"props-framework-validation",
			result.severity === "warning" ? "is-warning" : "is-error",
		],
	});
	setIcon(warningEl.createSpan({ cls: "props-framework-validation-icon" }), "lucide-alert-triangle");
	warningEl.createSpan({ text: result.message ?? "Invalid value" });

	if (result.details?.length) {
		const detailsEl = warningEl.createEl("ul");
		for (const detail of result.details) {
			detailsEl.createEl("li", { text: detail });
		}
	}
}

export function renderOptionLabel(parentEl: HTMLElement, option: PropertyOption): void {
	if (option.icon) {
		const iconEl = parentEl.createSpan({ cls: "props-framework-option-icon" });
		setIcon(iconEl, option.icon);
	}

	parentEl.createSpan({
		cls: "props-framework-option-label",
		text: option.label ?? option.value,
	});
}

export function uniqueOptions(options: PropertyOption[]): PropertyOption[] {
	const seen = new Set<string>();
	const result: PropertyOption[] = [];

	for (const option of options) {
		if (!option.value || seen.has(option.value)) {
			continue;
		}
		seen.add(option.value);
		result.push(option);
	}

	return result;
}

export function coerceString(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}

	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		return String(value);
	}

	return "";
}

export function coerceStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value
			.filter((item): item is string | number | boolean => {
				return ["string", "number", "boolean"].includes(typeof item);
			})
			.map((item) => String(item));
	}

	const stringValue = coerceString(value);
	return stringValue ? [stringValue] : [];
}

export function stopMetadataEvent(event: Event): void {
	event.preventDefault();
	event.stopPropagation();
}

export function containMetadataEvents(el: HTMLElement): void {
	el.addEventListener("pointerdown", (event) => event.stopPropagation());
	el.addEventListener("mousedown", (event) => event.stopPropagation());
	el.addEventListener("click", (event) => event.stopPropagation());
}
