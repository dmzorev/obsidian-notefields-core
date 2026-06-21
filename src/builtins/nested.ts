import { Menu, Setting, setIcon } from "obsidian";
import type { NestedPropertyConfig, PropertyRenderContext, PropertyType, PropertyWidgetComponent } from "../types";
import { containMetadataEvents, renderValidation, stopMetadataEvent } from "../ui";

type JsonObject = Record<string, unknown>;
type NewValueKind = "text" | "number" | "checkbox" | "object" | "list";
const BASES_EDITING_CLASS = "props-framework-is-editing-nested";
const NESTED_VALUE_KINDS: Array<{ icon: string; label: string; value: NewValueKind }> = [
	{ icon: "lucide-align-left", label: "Text", value: "text" },
	{ icon: "lucide-binary", label: "Number", value: "number" },
	{ icon: "lucide-square-check-big", label: "Checkbox", value: "checkbox" },
	{ icon: "lucide-braces", label: "Object", value: "object" },
	{ icon: "lucide-list-tree", label: "List", value: "list" },
];

export function createNestedType(): PropertyType<NestedPropertyConfig> {
	return {
		id: "notefields:nested",
		name: "Nested object",
		description: "Schema-less editor for nested YAML object values.",
		icon: "lucide-braces",
		defaultConfig: {
			defaultCollapsed: false,
			basesShowRootBraces: false,
			basesExpandNestedValues: true,
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
		render: renderNestedEditor,
		renderBase: renderNestedBase,
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

			new Setting(el)
				.setName("Show outer braces in bases")
				.setDesc("Wrap the top-level object preview in braces.")
				.addToggle((toggle) => toggle
					.setValue(ctx.definition.config.basesShowRootBraces)
					.onChange(async (basesShowRootBraces) => {
						await ctx.updateDefinition({
							...ctx.definition,
							config: {
								...ctx.definition.config,
								basesShowRootBraces,
							},
						});
					}));

			new Setting(el)
				.setName("Expand nested values in bases")
				.setDesc("Show compact nested content instead of only item counts.")
				.addToggle((toggle) => toggle
					.setValue(ctx.definition.config.basesExpandNestedValues)
					.onChange(async (basesExpandNestedValues) => {
						await ctx.updateDefinition({
							...ctx.definition,
							config: {
								...ctx.definition.config,
								basesExpandNestedValues,
							},
						});
					}));
		},
	};
}

function renderNestedEditor(
	el: HTMLElement,
	ctx: PropertyRenderContext<NestedPropertyConfig>
): PropertyWidgetComponent {
	let value = isPlainObject(ctx.value) ? ctx.value : {};
	const collapsedPaths = new Set<string>();
	const render = (): void => {
		el.empty();
		const rootEl = el.createDiv({ cls: ["props-framework-nested", "is-editing"] });
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
		type: "notefields:nested",
		focus: () => focusFirstNestedControl(el),
	};
}

function renderNestedBase(
	el: HTMLElement,
	ctx: PropertyRenderContext<NestedPropertyConfig>
): PropertyWidgetComponent {
	let value = isPlainObject(ctx.value) ? ctx.value : {};
	const collapsedPaths = new Set<string>();
	const hostEl = getBasesHost(el);
	let isEditing = hostEl.hasClass(BASES_EDITING_CLASS);

	const endEditing = (): void => {
		hostEl.removeClass(BASES_EDITING_CLASS);
		isEditing = false;
		render();
		ctx.blur();
	};

	const openEditor = (): void => {
		hostEl.addClass(BASES_EDITING_CLASS);
		if (!isEditing) {
			isEditing = true;
			render();
		}
		focusFirstNestedControl(el);
	};

	const render = (): void => {
		el.empty();
		const rootEl = el.createDiv({
			attr: {
				"aria-label": isEditing ? "Edit nested object" : "Open nested object editor",
				tabindex: isEditing ? "-1" : "0",
			},
			cls: ["props-framework-nested", isEditing ? "is-editing" : "is-viewing"],
		});
		containMetadataEvents(rootEl);

		if (isEditing) {
			renderObject(rootEl, value, "", ctx.config.defaultCollapsed, collapsedPaths, (nextValue) => {
				value = nextValue;
				hostEl.addClass(BASES_EDITING_CLASS);
				ctx.onChange(nextValue);
				render();
				focusFirstNestedControl(el);
			});
			rootEl.addEventListener("focusout", () => {
				window.setTimeout(() => {
					if (!rootEl.isConnected || rootEl.contains(document.activeElement)) {
						return;
					}
					endEditing();
				}, 0);
			});
		} else {
			renderObjectPreview(rootEl, value, ctx.config);
			rootEl.addEventListener("click", openEditor);
			rootEl.addEventListener("focus", openEditor);
		}

		renderValidation(el, ctx.validate(value));
	};

	render();
	if (isEditing) {
		focusFirstNestedControl(el);
	}

	return {
		type: "notefields:nested",
		focus: openEditor,
	};
}

function getBasesHost(el: HTMLElement): HTMLElement {
	const hostEl = el.closest(".bases-table-cell, .bases-cards-line, .bases-list-property");
	return hostEl instanceof HTMLElement ? hostEl : el;
}

function renderObjectPreview(parentEl: HTMLElement, value: JsonObject, config: NestedPropertyConfig): void {
	const text = formatObjectPreview(value, config);
	parentEl.createDiv({
		attr: text ? { title: text } : undefined,
		cls: "props-framework-nested-preview",
		text,
	});
}

function formatObjectPreview(value: JsonObject, config: NestedPropertyConfig): string {
	const entries = Object.entries(value);
	if (entries.length === 0) {
		return "";
	}

	const content = formatPreviewEntries(entries, config.basesExpandNestedValues, 0);
	return config.basesShowRootBraces ? `{ ${content} }` : content;
}

function formatPreviewEntries(entries: Array<[string, unknown]>, expandNested: boolean, depth: number): string {
	const visibleEntries = entries.slice(0, 6)
		.map(([key, value]) => `${key}: ${formatPreviewValue(value, expandNested, depth)}`);
	if (entries.length > visibleEntries.length) {
		visibleEntries.push("...");
	}
	return visibleEntries.join(", ");
}

function formatPreviewValue(value: unknown, expandNested: boolean, depth: number): string {
	if (Array.isArray(value)) {
		if (!expandNested || depth >= 2) {
			return `[${value.length}]`;
		}
		const items = value.slice(0, 6).map((item) => formatPreviewValue(item, true, depth + 1));
		if (value.length > items.length) {
			items.push("...");
		}
		return `[${items.join(", ")}]`;
	}
	if (isPlainObject(value)) {
		if (!expandNested || depth >= 2) {
			return `{${Object.keys(value).length}}`;
		}
		return `{ ${formatPreviewEntries(Object.entries(value), true, depth + 1)} }`;
	}
	if (value === null || value === undefined || value === "") {
		return "empty";
	}

	let serialized: string;
	if (typeof value === "object") {
		serialized = JSON.stringify(value) ?? "object";
	} else if (typeof value === "string") {
		serialized = value;
	} else if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
		serialized = value.toString();
	} else {
		serialized = "value";
	}
	const text = serialized.replace(/\s+/g, " ").trim();
	return text.length > 40 ? `${text.slice(0, 39)}...` : text;
}

function focusFirstNestedControl(parentEl: HTMLElement): void {
	window.requestAnimationFrame(() => {
		const controlEl = parentEl.querySelector("input, select, button");
		if (controlEl instanceof HTMLElement) {
			controlEl.focus();
		}
	});
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
	const addButton = renderButton(addEl, "Add item", "lucide-plus");
	addButton.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		onChange([...value, createDefaultValue("text")]);
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
		renderKindButton(keyEl, value, onChange);
		renderEditableKey(keyEl, key, onRename);
	} else {
		const typeEl = rowEl.createDiv({ cls: "props-framework-nested-array-type" });
		renderKindButton(typeEl, value, onChange);
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

function renderKindButton(parentEl: HTMLElement, value: unknown, onChange: (value: unknown) => void): void {
	const currentKind = getValueKind(value);
	const currentType = NESTED_VALUE_KINDS.find((kind) => kind.value === currentKind) ?? NESTED_VALUE_KINDS[0]!;
	const buttonEl = parentEl.createEl("button", {
		attr: {
			"aria-label": `Property type: ${currentType.label}`,
			type: "button",
		},
		cls: "clickable-icon props-framework-nested-type-button",
	});
	setIcon(buttonEl, currentType.icon);
	buttonEl.addEventListener("pointerdown", stopMetadataEvent);
	buttonEl.addEventListener("mousedown", stopMetadataEvent);
	buttonEl.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		const menu = new Menu();
		for (const kind of NESTED_VALUE_KINDS) {
			menu.addItem((item) => item
				.setTitle(kind.label)
				.setIcon(kind.icon)
				.setChecked(kind.value === currentKind)
				.onClick(() => {
					if (kind.value !== currentKind) {
						onChange(createDefaultValue(kind.value));
					}
				}));
		}
		menu.showAtMouseEvent(event);
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
		renderCollapsible(parentEl, path, "[ ... ]", defaultCollapsed, collapsedPaths, (bodyEl) => {
			renderArray(bodyEl, value, path, defaultCollapsed, collapsedPaths, onChange);
		});
		return;
	}

	if (isPlainObject(value)) {
		renderCollapsible(parentEl, path, "{ ... }", defaultCollapsed, collapsedPaths, (bodyEl) => {
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
		attr: { placeholder: "Empty", type: "text" },
		cls: "metadata-input-text",
		value: stringifyScalar(value),
	});
	inputEl.addEventListener("change", () => onChange(inputEl.value));
}

function renderCollapsible(
	parentEl: HTMLElement,
	path: string,
	summary: string,
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
	const buttonEl = renderButton(addEl, "Add property", "lucide-plus");
	buttonEl.addEventListener("click", (event) => {
		stopMetadataEvent(event);
		buttonEl.hide();
		const inputEl = addEl.createEl("input", {
			attr: {
				placeholder: "Property name",
				type: "text",
			},
			cls: "props-framework-add-property-input",
		});
		let finished = false;

		const finish = (commit: boolean): void => {
			if (finished) {
				return;
			}
			finished = true;
			const key = inputEl.value.trim();
			if (commit && key && !(key in value)) {
				onChange({
					...value,
					[key]: createDefaultValue("text"),
				});
				return;
			}
			inputEl.remove();
			buttonEl.show();
		};

		inputEl.addEventListener("blur", () => finish(true));
		inputEl.addEventListener("keydown", (inputEvent) => {
			if (inputEvent.key === "Enter" || inputEvent.key === "Tab") {
				stopMetadataEvent(inputEvent);
				finish(true);
			} else if (inputEvent.key === "Escape") {
				stopMetadataEvent(inputEvent);
				finish(false);
			}
		});
		inputEl.focus();
	});
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

function getValueKind(value: unknown): NewValueKind {
	if (Array.isArray(value)) {
		return "list";
	}
	if (isPlainObject(value)) {
		return "object";
	}
	if (typeof value === "boolean") {
		return "checkbox";
	}
	if (typeof value === "number") {
		return "number";
	}
	return "text";
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
