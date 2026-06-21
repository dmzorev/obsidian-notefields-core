import { Setting, setIcon } from "obsidian";
import type { NestedPropertyConfig, PropertyType } from "../types";
import { containMetadataEvents, renderValidation, stopMetadataEvent } from "../ui";

type JsonObject = Record<string, unknown>;
type NewValueKind = "text" | "number" | "checkbox" | "object" | "list";

export function createNestedType(): PropertyType<NestedPropertyConfig> {
	return {
		id: "framework:nested",
		name: "Nested object",
		description: "Schema-less editor for nested YAML object values.",
		icon: "lucide-braces",
		defaultConfig: {
			defaultCollapsed: false,
		},
		validate(value) {
			if (isPlainObject(value)) {
				return true;
			}

			return {
				valid: false,
				message: "Expected an object value.",
			};
		},
		normalize(value) {
			return isPlainObject(value) ? value : {};
		},
		render(el, ctx) {
			let value = isPlainObject(ctx.value) ? ctx.value : {};
			const collapsedPaths = new Set<string>();

			const render = (): void => {
				el.empty();
				const rootEl = el.createDiv({ cls: "props-framework-nested" });
				containMetadataEvents(rootEl);
				renderObject(rootEl, value, "", ctx.config.defaultCollapsed, collapsedPaths, (nextValue) => {
					value = nextValue;
					ctx.onChange(nextValue);
					render();
				});
				renderValidation(el, ctx.validate(value));
			};

			render();

			return {
				type: "framework:nested",
				focus: () => {
					const inputEl = el.querySelector("input");
					if (inputEl instanceof HTMLInputElement) {
						inputEl.focus();
					}
				},
			};
		},
		renderSettings(el, ctx) {
			new Setting(el)
				.setName("Collapsed by default")
				.addToggle((toggle) => toggle
					.setValue(ctx.definition.config.defaultCollapsed)
					.onChange(async (defaultCollapsed) => {
						await ctx.updateDefinition({
							...ctx.definition,
							config: {
								...ctx.definition.config,
								defaultCollapsed,
							},
						});
					}));
		},
	};
}

function renderObject(
	parentEl: HTMLElement,
	value: JsonObject,
	parentPath: string,
	defaultCollapsed: boolean,
	collapsedPaths: Set<string>,
	onChange: (value: JsonObject) => void
): void {
	const entriesEl = parentEl.createDiv({ cls: "props-framework-nested-entries" });

	for (const [key, childValue] of Object.entries(value)) {
		const path = joinPath(parentPath, key);
		renderEntry(entriesEl, key, childValue, path, true, defaultCollapsed, collapsedPaths, (nextChildValue) => {
			onChange({
				...value,
				[key]: nextChildValue,
			});
		}, () => {
			const nextValue = { ...value };
			delete nextValue[key];
			onChange(nextValue);
		}, (nextKey) => {
			if (!nextKey || nextKey === key || nextKey in value) {
				return false;
			}

			const nextPath = joinPath(parentPath, nextKey);
			renameCollapsedPath(collapsedPaths, path, nextPath);
			onChange(Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => {
				return entryKey === key ? [nextKey, entryValue] : [entryKey, entryValue];
			})));
			return true;
		});
	}

	renderAddObjectProperty(parentEl, value, onChange);
}

function renderArray(
	parentEl: HTMLElement,
	value: unknown[],
	parentPath: string,
	defaultCollapsed: boolean,
	collapsedPaths: Set<string>,
	onChange: (value: unknown[]) => void
): void {
	const entriesEl = parentEl.createDiv({ cls: "props-framework-nested-entries" });

	for (const [index, childValue] of value.entries()) {
		const path = joinPath(parentPath, String(index));
		renderEntry(entriesEl, String(index), childValue, path, false, defaultCollapsed, collapsedPaths, (nextChildValue) => {
			const nextValue = [...value];
			nextValue[index] = nextChildValue;
			onChange(nextValue);
		}, () => {
			onChange(value.filter((_item, itemIndex) => itemIndex !== index));
		});
	}

	const addEl = parentEl.createDiv({ cls: "props-framework-add-property" });
	const kindSelectEl = renderKindSelect(addEl);
	const addButton = renderButton(addEl, "Add item", "lucide-plus");
	addButton.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		onChange([...value, createDefaultValue(kindSelectEl.value as NewValueKind)]);
	});
}

function renderEntry(
	parentEl: HTMLElement,
	key: string,
	value: unknown,
	path: string,
	showKey: boolean,
	defaultCollapsed: boolean,
	collapsedPaths: Set<string>,
	onChange: (value: unknown) => void,
	onDelete: () => void,
	onRename?: (key: string) => boolean
): void {
	const rowEl = parentEl.createDiv({
		cls: ["props-framework-nested-row", showKey ? "" : "is-array-item"],
	});
	if (showKey) {
		const keyEl = rowEl.createDiv({ cls: "props-framework-nested-key" });
		renderEditableKey(keyEl, key, onRename);
	}

	const valueEl = rowEl.createDiv({ cls: "props-framework-nested-value" });
	renderNestedValue(valueEl, value, path, defaultCollapsed, collapsedPaths, onChange);

	const actionsEl = rowEl.createDiv({ cls: "props-framework-nested-actions" });
	const deleteButton = renderButton(actionsEl, `Remove ${key}`, "lucide-trash-2", true);
	deleteButton.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		onDelete();
	});
}

function renderEditableKey(parentEl: HTMLElement, key: string, onRename?: (key: string) => boolean): void {
	const labelEl = parentEl.createSpan({
		attr: {
			"aria-label": `Rename ${key}`,
			role: "button",
			tabindex: onRename ? "0" : "-1",
		},
		cls: "props-framework-nested-key-label",
		text: key,
	});
	if (!onRename) {
		return;
	}

	const beginEditing = (event: Event): void => {
		stopMetadataEvent(event);
		labelEl.hide();
		const inputEl = parentEl.createEl("input", {
			attr: {
				"aria-label": `Rename ${key}`,
				type: "text",
			},
			cls: "metadata-input-text props-framework-nested-key-input",
			value: key,
		});
		let finished = false;

		const cancel = (): void => {
			if (finished) {
				return;
			}
			finished = true;
			inputEl.remove();
			labelEl.show();
		};
		const commit = (): void => {
			if (finished) {
				return;
			}
			const nextKey = inputEl.value.trim();
			if (!nextKey || nextKey === key) {
				cancel();
				return;
			}
			if (!onRename(nextKey)) {
				inputEl.addClass("is-invalid");
				inputEl.focus();
				return;
			}
			finished = true;
		};

		inputEl.addEventListener("input", () => inputEl.removeClass("is-invalid"));
		inputEl.addEventListener("blur", commit);
		inputEl.addEventListener("keydown", (inputEvent) => {
			if (inputEvent.key === "Enter") {
				stopMetadataEvent(inputEvent);
				commit();
			} else if (inputEvent.key === "Escape") {
				stopMetadataEvent(inputEvent);
				cancel();
			}
		});
		inputEl.focus();
		inputEl.select();
	};

	labelEl.addEventListener("click", beginEditing);
	labelEl.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			beginEditing(event);
		}
	});
}

function renderNestedValue(
	parentEl: HTMLElement,
	value: unknown,
	path: string,
	defaultCollapsed: boolean,
	collapsedPaths: Set<string>,
	onChange: (value: unknown) => void
): void {
	if (Array.isArray(value)) {
		renderCollapsible(parentEl, path, "[ ... ]", "lucide-list-tree", defaultCollapsed, collapsedPaths, (bodyEl) => {
			renderArray(bodyEl, value, path, defaultCollapsed, collapsedPaths, onChange);
		});
		return;
	}

	if (isPlainObject(value)) {
		renderCollapsible(parentEl, path, "{ ... }", "lucide-braces", defaultCollapsed, collapsedPaths, (bodyEl) => {
			renderObject(bodyEl, value, path, defaultCollapsed, collapsedPaths, onChange);
		});
		return;
	}

	if (typeof value === "boolean") {
		const inputEl = parentEl.createEl("input", {
			attr: { type: "checkbox" },
			cls: "metadata-input-checkbox",
		});
		inputEl.checked = value;
		inputEl.addEventListener("change", () => onChange(inputEl.checked));
		return;
	}

	if (typeof value === "number") {
		const inputEl = parentEl.createEl("input", {
			attr: { type: "number" },
			cls: "metadata-input-number",
			value: String(value),
		});
		inputEl.addEventListener("change", () => onChange(Number(inputEl.value) || 0));
		return;
	}

	const inputEl = parentEl.createEl("input", {
		attr: { type: "text" },
		cls: "metadata-input-text",
		value: stringifyScalar(value),
	});
	inputEl.addEventListener("change", () => onChange(inputEl.value));
}

function renderCollapsible(
	parentEl: HTMLElement,
	path: string,
	summary: string,
	icon: string,
	defaultCollapsed: boolean,
	collapsedPaths: Set<string>,
	renderBody: (bodyEl: HTMLElement) => void
): void {
	const isCollapsed = collapsedPaths.has(path) || (defaultCollapsed && !collapsedPaths.has(`${path}:expanded`));
	const wrapperEl = parentEl.createDiv({
		cls: ["props-framework-nested-collapsible", isCollapsed ? "is-collapsed" : ""],
	});
	const headerEl = wrapperEl.createDiv({ cls: "props-framework-nested-summary" });
	const toggleButton = renderButton(headerEl, "Toggle nested value", "right-triangle", true);
	setIcon(headerEl.createSpan({ cls: "props-framework-nested-type-icon" }), icon);
	headerEl.createSpan({ text: summary });

	const bodyEl = wrapperEl.createDiv({ cls: "props-framework-nested-body" });
	renderBody(bodyEl);

	toggleButton.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		const nextCollapsed = !wrapperEl.hasClass("is-collapsed");
		wrapperEl.toggleClass("is-collapsed", nextCollapsed);
		if (nextCollapsed) {
			collapsedPaths.add(path);
			collapsedPaths.delete(`${path}:expanded`);
		} else {
			collapsedPaths.delete(path);
			collapsedPaths.add(`${path}:expanded`);
		}
	});
}

function renderAddObjectProperty(
	parentEl: HTMLElement,
	value: JsonObject,
	onChange: (value: JsonObject) => void
): void {
	const addEl = parentEl.createDiv({ cls: "props-framework-add-property" });
	const inputEl = addEl.createEl("input", {
		attr: {
			placeholder: "Property name",
			type: "text",
		},
		cls: "metadata-input-text",
	});
	const kindSelectEl = renderKindSelect(addEl);
	const buttonEl = renderButton(addEl, "Add", "lucide-plus");

	const addProperty = (): void => {
		const key = inputEl.value.trim();
		if (!key || key in value) {
			return;
		}

		onChange({
			...value,
			[key]: createDefaultValue(kindSelectEl.value as NewValueKind),
		});
	};

	buttonEl.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		addProperty();
	});
	inputEl.addEventListener("keydown", (event) => {
		if (event.key === "Enter") {
			stopMetadataEvent(event);
			addProperty();
		}
	});
}

function renderKindSelect(parentEl: HTMLElement): HTMLSelectElement {
	const selectEl = parentEl.createEl("select", { cls: "dropdown props-framework-kind-select" });
	const options: Array<{ value: NewValueKind; label: string }> = [
		{ value: "text", label: "Text" },
		{ value: "number", label: "Number" },
		{ value: "checkbox", label: "Checkbox" },
		{ value: "object", label: "Object" },
		{ value: "list", label: "List" },
	];

	for (const option of options) {
		selectEl.createEl("option", {
			attr: { value: option.value },
			text: option.label,
		});
	}

	selectEl.addEventListener("pointerdown", (event) => event.stopPropagation());
	selectEl.addEventListener("mousedown", (event) => event.stopPropagation());
	return selectEl;
}

function renderButton(parentEl: HTMLElement, label: string, icon: string, iconOnly = false): HTMLButtonElement {
	const buttonEl = parentEl.createEl("button", {
		attr: {
			"aria-label": label,
			type: "button",
		},
		cls: iconOnly ? "clickable-icon" : "props-framework-add-button",
	});
	setIcon(buttonEl, icon);
	if (!iconOnly) {
		buttonEl.createSpan({ text: label });
	}
	buttonEl.addEventListener("pointerdown", stopMetadataEvent);
	buttonEl.addEventListener("mousedown", stopMetadataEvent);
	return buttonEl;
}

function createDefaultValue(kind: NewValueKind): unknown {
	switch (kind) {
		case "checkbox":
			return false;
		case "list":
			return [];
		case "number":
			return 0;
		case "object":
			return {};
		case "text":
		default:
			return "";
	}
}

function isPlainObject(value: unknown): value is JsonObject {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function stringifyScalar(value: unknown): string {
	if (value === null || value === undefined) {
		return "";
	}

	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}

	return "";
}

function joinPath(parentPath: string, key: string): string {
	return parentPath ? `${parentPath}.${key}` : key;
}

function renameCollapsedPath(collapsedPaths: Set<string>, oldPath: string, newPath: string): void {
	const replacements: Array<[string, string]> = [];
	for (const path of collapsedPaths) {
		if (path === oldPath || path.startsWith(`${oldPath}.`) || path === `${oldPath}:expanded`) {
			replacements.push([path, `${newPath}${path.slice(oldPath.length)}`]);
		}
	}

	for (const [oldValue, newValue] of replacements) {
		collapsedPaths.delete(oldValue);
		collapsedPaths.add(newValue);
	}
}
