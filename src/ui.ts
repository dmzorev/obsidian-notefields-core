import { setIcon } from "obsidian";
import { formatOptionValue } from "./options";
import type { PropertyValidationResult, ValueOption } from "./types";

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

export function renderOptionLabel(parentEl: HTMLElement, option: ValueOption): void {
	if (option.icon) {
		const iconEl = parentEl.createSpan({ cls: "props-framework-option-icon" });
		setIcon(iconEl, option.icon);
	}

	parentEl.createSpan({
		cls: "props-framework-option-label",
		text: option.label ?? formatOptionValue(option.value),
	});
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

export function bindDebouncedInput(
	inputEl: HTMLInputElement,
	onCommit: (value: string) => void | Promise<void>,
	delay = 250
): void {
	let timeoutId: number | null = null;
	let dirty = false;
	let lastRequestedValue = inputEl.value;
	const commit = (): void => {
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
			timeoutId = null;
		}
		const value = inputEl.value;
		if (!dirty && value === lastRequestedValue) {
			return;
		}
		dirty = false;
		lastRequestedValue = value;
		void Promise.resolve(onCommit(value)).catch((error: unknown) => {
			console.error("NoteFields Core: failed to save an input value.", error);
		});
	};
	inputEl.addEventListener("input", () => {
		dirty = true;
		if (timeoutId !== null) {
			window.clearTimeout(timeoutId);
		}
		timeoutId = window.setTimeout(commit, delay);
	});
	inputEl.addEventListener("change", commit);
}
