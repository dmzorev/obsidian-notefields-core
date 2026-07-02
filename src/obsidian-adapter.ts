import { MarkdownView, Menu, Modal, Setting, setIcon } from "obsidian";
import type NoteFieldsCorePlugin from "./main";
import type { PropertyDefinition, PropertyWidgetComponent } from "./types";
import { normalizeValidationResult } from "./types";
import { renderValidation } from "./ui";

interface ObsidianPropertyRenderContext {
	app: NoteFieldsCorePlugin["app"];
	key: string;
	sourcePath: string;
	onChange: (value: unknown) => void;
	blur?: () => void;
}

interface ObsidianPropertyWidget {
	type: string;
	icon: string;
	name: () => string;
	reservedKeys?: string[];
	validate: (value: unknown) => boolean;
	render: (el: HTMLElement, value: unknown, ctx: ObsidianPropertyRenderContext) => PropertyWidgetComponent;
}

interface ObsidianTypeInfo {
	expected?: ObsidianPropertyWidget;
	inferred?: ObsidianPropertyWidget;
	[key: string]: unknown;
}

interface MetadataTypeManagerLike {
	registeredTypeWidgets?: Record<string, ObsidianPropertyWidget>;
	getTypeInfo?: (...args: unknown[]) => ObsidianTypeInfo;
	getWidget?: (type: string) => ObsidianPropertyWidget | undefined;
	getAssignedWidget?: (propertyName: string) => string | null;
	setType?: (propertyName: string, type: string) => void;
}

export interface PropertyTypeChoice {
	id: string;
	name: string;
	icon: string;
	isFramework: boolean;
}

const BUILTIN_WIDGET_IDS = [
	"notefields:select",
	"notefields:multiselect",
	"notefields:nested",
] as const;

export class ObsidianPropertyAdapter {
	private metadataTypeManager: MetadataTypeManagerLike | null = null;
	private originalGetTypeInfo: MetadataTypeManagerLike["getTypeInfo"] | null = null;
	private originalShowAtMouseEvent: ((event: MouseEvent) => Menu) | null = null;
	private originalWidgets = new Map<string, ObsidianPropertyWidget | undefined>();
	private originalWidgetRenders = new Map<ObsidianPropertyWidget, ObsidianPropertyWidget["render"]>();

	constructor(private readonly plugin: NoteFieldsCorePlugin) {}

	load(): void {
		this.metadataTypeManager = (this.plugin.app as unknown as {
			metadataTypeManager?: MetadataTypeManagerLike;
		}).metadataTypeManager ?? null;

		if (!this.metadataTypeManager?.registeredTypeWidgets) {
			console.warn("NoteFields Core: metadataTypeManager is not available.");
			return;
		}

		this.registerWidgets();
		this.decorateWidgets();
		this.patchGetTypeInfo();
		this.patchPropertyMenu();
		this.reloadAllProperties();
	}

	unload(): void {
		if (!this.metadataTypeManager?.registeredTypeWidgets) {
			return;
		}

		if (this.originalGetTypeInfo) {
			this.metadataTypeManager.getTypeInfo = this.originalGetTypeInfo;
			this.originalGetTypeInfo = null;
		}
		if (this.originalShowAtMouseEvent) {
			Menu.prototype.showAtMouseEvent = this.originalShowAtMouseEvent;
			this.originalShowAtMouseEvent = null;
		}

		for (const widgetId of BUILTIN_WIDGET_IDS) {
			const originalWidget = this.originalWidgets.get(widgetId);
			if (originalWidget) {
				this.metadataTypeManager.registeredTypeWidgets[widgetId] = originalWidget;
			} else {
				delete this.metadataTypeManager.registeredTypeWidgets[widgetId];
			}
		}
		for (const [widget, render] of this.originalWidgetRenders) {
			widget.render = render;
		}
		this.originalWidgets.clear();
		this.originalWidgetRenders.clear();
		this.reloadAllProperties();
	}

	reloadAllProperties(): void {
		for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView) {
				const metadataEditor = (leaf.view as unknown as { metadataEditor?: unknown }).metadataEditor as {
					serialize?: () => unknown;
					synchronize?: (data: unknown) => void;
				} | undefined;
				if (!metadataEditor) {
					continue;
				}
				const data = metadataEditor.serialize?.();
				if (!metadataEditor.synchronize || data === undefined) {
					continue;
				}
				metadataEditor.synchronize({});
				metadataEditor.synchronize(data);
			}
		}
	}

	getPropertyTypeChoices(propertyName: string): PropertyTypeChoice[] {
		const widgets = Object.values(this.metadataTypeManager?.registeredTypeWidgets ?? {});
		return widgets
			.filter((widget) => !widget.reservedKeys || widget.reservedKeys.includes(propertyName))
			.filter((widget, index, all) => all.findIndex((candidate) => candidate.type === widget.type) === index)
			.map((widget) => ({
				id: widget.type,
				name: widget.name(),
				icon: widget.icon,
				isFramework: Boolean(this.plugin.api.getRegisteredType(widget.type)),
			}))
			.sort((left, right) => Number(right.isFramework) - Number(left.isFramework)
				|| left.name.localeCompare(right.name));
	}

	getPropertyType(propertyName: string): PropertyTypeChoice | null {
		const definition = this.plugin.api.getPropertyDefinition(propertyName);
		const typeId = definition && definition.typeId !== "notefields:display"
			? definition.typeId
			: this.metadataTypeManager?.getAssignedWidget?.(propertyName)
				?? this.metadataTypeManager?.getTypeInfo?.(propertyName)?.expected?.type
				?? "text";
		return this.getPropertyTypeChoices(propertyName).find((choice) => choice.id === typeId) ?? null;
	}

	async setPropertyType(propertyName: string, typeId: string): Promise<void> {
		const choice = this.getPropertyTypeChoices(propertyName).find((candidate) => candidate.id === typeId);
		if (!choice || !this.metadataTypeManager?.setType) {
			return;
		}

		this.metadataTypeManager.setType(propertyName, typeId);
		const definition = this.plugin.api.getPropertyDefinition(propertyName)
			?? this.plugin.ensureDisplayDefinition(propertyName);
		if (choice.isFramework) {
			const previousType = this.plugin.api.getRegisteredType(definition.typeId);
			const nextType = this.plugin.api.getRegisteredType(typeId);
			let config: unknown = structuredClone(nextType?.defaultConfig ?? {});
			if (previousType?.optionSupport && nextType?.optionSupport) {
				config = nextType.optionSupport.setBinding(
					config,
					previousType.optionSupport.getBinding(definition.config)
				);
			}
			await this.plugin.api.setPropertyDefinition({
				...definition,
				typeId,
				config,
			});
		} else {
			await this.plugin.api.setPropertyDefinition({
				...definition,
				typeId: "notefields:display",
				config: {},
			});
		}
		this.reloadAllProperties();
	}

	private registerWidgets(): void {
		if (!this.metadataTypeManager?.registeredTypeWidgets) {
			return;
		}

		for (const widgetId of BUILTIN_WIDGET_IDS) {
			this.originalWidgets.set(widgetId, this.metadataTypeManager.registeredTypeWidgets[widgetId]);
		}

		for (const typeId of BUILTIN_WIDGET_IDS) {
			this.metadataTypeManager.registeredTypeWidgets[typeId] = this.createWidget(typeId);
		}
	}

	private patchGetTypeInfo(): void {
		if (!this.metadataTypeManager?.getTypeInfo || this.originalGetTypeInfo) {
			return;
		}

		const manager = this.metadataTypeManager;
		const originalGetTypeInfo = manager.getTypeInfo;
		if (!originalGetTypeInfo) {
			return;
		}
		this.originalGetTypeInfo = originalGetTypeInfo.bind(manager);

		manager.getTypeInfo = (...args: unknown[]): ObsidianTypeInfo => {
			const originalResult = this.originalGetTypeInfo?.(...args) ?? {};
			const propertyName = this.getPropertyNameFromTypeInfoArgs(args);
			if (!propertyName) {
				return originalResult;
			}

			const definition = this.plugin.api.getPropertyDefinition(propertyName);
			if (!definition || definition.typeId === "notefields:display" || !this.metadataTypeManager?.registeredTypeWidgets) {
				return originalResult;
			}

			const widget = this.metadataTypeManager.registeredTypeWidgets[definition.typeId];
			if (!widget) {
				return originalResult;
			}

			return {
				...originalResult,
				expected: widget,
				inferred: widget,
			};
		};
	}

	private getPropertyNameFromTypeInfoArgs(args: unknown[]): string | null {
		const [firstArg] = args;
		if (typeof firstArg === "string") {
			return firstArg;
		}

		if (firstArg && typeof firstArg === "object" && "key" in firstArg) {
			const key = (firstArg as { key?: unknown }).key;
			return typeof key === "string" ? key : null;
		}

		return null;
	}

	private createWidget(typeId: string): ObsidianPropertyWidget {
		return {
			type: typeId,
			icon: this.plugin.api.getRegisteredType(typeId)?.icon ?? "lucide-settings-2",
			name: () => this.plugin.api.getRegisteredType(typeId)?.name ?? typeId,
			validate: (value: unknown) => normalizeValidationResult(this.plugin.api.getRegisteredType(typeId)?.validate?.(
				value,
				this.plugin.api.createRenderContext({
					property: "",
					typeId,
					config: this.plugin.api.getRegisteredType(typeId)?.defaultConfig ?? {},
				}, value)
			)).valid,
			render: (el, value, ctx) => {
				const definition = this.resolveDefinition(typeId, ctx)
					?? this.plugin.ensurePropertyDefinition(ctx.key, typeId);

				this.refreshPropertyDisplay(el, definition);
				const type = this.plugin.api.getRegisteredType(definition.typeId);
				if (!type) {
					el.empty();
					renderValidation(el, {
						valid: false,
						message: `Property type "${definition.typeId}" is not registered.`,
						severity: "error",
					});
					return { type: typeId };
				}

				const normalizedValue = type.normalize
					? type.normalize(value, this.plugin.api.createRenderContext(definition, value, {
						key: ctx.key,
						sourcePath: ctx.sourcePath,
						onChange: ctx.onChange,
						blur: ctx.blur ?? (() => undefined),
					}))
					: value;

				const renderContext = this.plugin.api.createRenderContext(definition, normalizedValue, {
					key: ctx.key,
					sourcePath: ctx.sourcePath,
					onChange: ctx.onChange,
					blur: ctx.blur ?? (() => undefined),
				});

				try {
					const isBase = Boolean(el.closest(".bases-view, .bases-table-cell, .bases-cards-line, .bases-list-property"));
					const renderer = isBase ? type.renderBase ?? type.render : type.render;
					return renderer(el, renderContext);
				} catch (error) {
					el.empty();
					renderValidation(el, {
						valid: false,
						message: "Property type renderer failed.",
						details: [error instanceof Error ? error.message : String(error)],
						severity: "error",
					});
					return { type: typeId };
				}
			},
		};
	}

	private resolveDefinition(typeId: string, ctx: ObsidianPropertyRenderContext): PropertyDefinition | null {
		const definition = this.plugin.api.getPropertyDefinition(ctx.key);
		if (!definition) {
			return null;
		}

		if (definition.typeId !== typeId) {
			return this.plugin.ensurePropertyDefinition(ctx.key, typeId);
		}

		return definition;
	}

	private decorateWidgets(): void {
		if (!this.metadataTypeManager?.registeredTypeWidgets) {
			return;
		}

		for (const widget of Object.values(this.metadataTypeManager.registeredTypeWidgets)) {
			if (!widget || this.originalWidgetRenders.has(widget)) {
				continue;
			}

			const originalRender = widget.render;
			this.originalWidgetRenders.set(widget, originalRender);
			widget.render = (el, value, ctx) => {
				const rendered = originalRender.call(widget, el, value, ctx);
				const definition = this.plugin.api.getPropertyDefinition(ctx.key);
				if (definition) {
					this.refreshPropertyDisplay(el, definition);
				}
				return rendered;
			};
		}
	}

	private refreshPropertyDisplay(el: HTMLElement, definition: PropertyDefinition): void {
		const icon = definition.icon ?? this.plugin.api.getRegisteredType(definition.typeId)?.icon;
		const propertyEl = el.closest(".metadata-property");

		const iconEl = propertyEl?.querySelector(".metadata-property-icon");
		if (iconEl instanceof HTMLElement) {
			setIcon(iconEl, icon || "lucide-settings-2");
			if (!iconEl.querySelector("svg")) {
				setIcon(iconEl, "lucide-settings-2");
				iconEl.addClass("props-framework-fallback-icon");
			} else {
				iconEl.removeClass("props-framework-fallback-icon");
			}
		}

		const keyInputEl = propertyEl?.querySelector(".metadata-property-key-input");
		if (!(keyInputEl instanceof HTMLInputElement)) {
			return;
		}
		keyInputEl.setAttribute("aria-label", definition.property);
		keyInputEl.title = definition.property;

		const keyContainerEl = keyInputEl.parentElement;
		keyContainerEl?.querySelector(".props-framework-displayed-title")?.remove();
		const title = definition.displayTitle?.trim();
		keyInputEl.removeClass("props-framework-has-displayed-title");
		if (!title || !keyContainerEl) {
			return;
		}

		keyContainerEl.addClass("props-framework-key-container");
		keyInputEl.addClass("props-framework-has-displayed-title");
		const titleEl = keyContainerEl.createSpan({
			cls: "props-framework-displayed-title",
			text: title,
		});
		positionDisplayedTitle(
			keyInputEl,
			keyContainerEl,
			titleEl,
			iconEl instanceof HTMLElement ? iconEl : null
		);
	}

	private patchPropertyMenu(): void {
		if (this.originalShowAtMouseEvent) {
			return;
		}

		const addFrameworkItemsToPropertyMenu = (menu: Menu, event: MouseEvent): void => {
			this.addFrameworkItemsToPropertyMenu(menu, event);
		};
		// eslint-disable-next-line @typescript-eslint/unbound-method -- We call it with the menu instance below.
		const original = Menu.prototype.showAtMouseEvent;
		this.originalShowAtMouseEvent = original;

		Menu.prototype.showAtMouseEvent = function patchedShowAtMouseEvent(this: Menu, event: MouseEvent): Menu {
			addFrameworkItemsToPropertyMenu(this, event);
			return original.call(this, event);
		};
	}

	private addFrameworkItemsToPropertyMenu(menu: Menu, event: MouseEvent): void {
		const targetEl = event.target instanceof Element ? event.target : null;
		const iconEl = targetEl?.closest(".metadata-property-icon");
		const propertyEl = targetEl?.closest(".metadata-property");
		if (!iconEl || !(propertyEl instanceof HTMLElement)) {
			return;
		}

		const propertyName = getPropertyName(propertyEl);
		if (!propertyName) {
			return;
		}

		const definition = this.plugin.api.getPropertyDefinition(propertyName)
			?? this.plugin.ensureDisplayDefinition(propertyName);

		menu.addItem((item) => item
			.setTitle("Display")
			.setIcon("lucide-badge")
			.setSection("action")
			.onClick(() => {
				new PropertyBasicsModal(this.plugin, propertyName).open();
			}));

		const type = this.plugin.api.getRegisteredType(definition.typeId);
		if (type?.renderSettings) {
			menu.addItem((item) => item
				.setTitle("Property settings")
				.setIcon("lucide-settings-2")
				.setSection("action")
				.onClick(() => {
					new PropertySettingsModal(this.plugin, propertyName).open();
				}));
		}
	}
}

export class PropertyBasicsModal extends Modal {
	constructor(
		private readonly plugin: NoteFieldsCorePlugin,
		private readonly propertyName: string
	) {
		super(plugin.app);
	}

	onOpen(): void {
		const initialDefinition = this.plugin.api.getPropertyDefinition(this.propertyName);
		if (!initialDefinition) {
			this.close();
			return;
		}
		let definition: PropertyDefinition = initialDefinition;

		this.contentEl.empty();
		this.modalEl.addClass("props-framework-editor-modal");
		this.contentEl.addClass("props-framework-modal");
		new Setting(this.contentEl)
			.setName("Property display")
			.setHeading();

		new Setting(this.contentEl)
			.setName("Property name")
			.setDesc("Framework definition key. Keep it equal to the real note property name.")
			.addText((text) => {
				text
					.setPlaceholder(definition.property)
					.setValue(definition.property);
				text.inputEl.addEventListener("change", () => {
					const nextProperty = text.inputEl.value.trim();
					if (!nextProperty || nextProperty === definition.property) {
						text.setValue(definition.property);
						return;
					}

					const nextDefinition = {
						...definition,
						property: nextProperty,
					};
					void this.plugin.api.removePropertyDefinition(definition.property)
						.then(() => this.plugin.api.setPropertyDefinition(nextDefinition))
						.then(() => {
							definition = nextDefinition;
							text.setValue(nextDefinition.property);
						});
				});
			});

		new Setting(this.contentEl)
			.setName("Property type")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- Obsidian and NoteFields are product names.
			.setDesc("Use a standard Obsidian type or a type provided by NoteFields.")
			.addDropdown((dropdown) => {
				for (const choice of this.plugin.adapter?.getPropertyTypeChoices(definition.property) ?? []) {
					dropdown.addOption(choice.id, choice.name);
				}
				dropdown
					.setValue(this.plugin.adapter?.getPropertyType(definition.property)?.id ?? definition.typeId)
					.onChange(async (typeId) => {
						await this.plugin.adapter?.setPropertyType(definition.property, typeId);
						definition = this.plugin.api.getPropertyDefinition(definition.property) ?? definition;
					});
			});

		new Setting(this.contentEl)
			.setName("Icon")
			// eslint-disable-next-line obsidianmd/ui/sentence-case -- Icon ids are literal examples.
			.setDesc("Use a built-in icon id, for example lucide-list-check.")
			.addText((text) => {
				text
					// eslint-disable-next-line obsidianmd/ui/sentence-case -- Icon ids are literal examples.
					.setPlaceholder("lucide-list-check")
					.setValue(definition.icon ?? "")
					.onChange(async (value) => {
						const nextDefinition = {
							...definition,
							icon: value.trim() || undefined,
						};
						await this.plugin.api.setPropertyDefinition({
							...nextDefinition,
						});
						definition = nextDefinition;
					});
			})
			.addExtraButton((button) => button
				.setIcon("lucide-search")
				.setTooltip("Choose icon")
				.onClick(() => {
					this.plugin.api.openIconPicker(definition.icon ?? null, async (icon) => {
						const nextDefinition = {
							...definition,
							icon: icon ?? undefined,
						};
						await this.plugin.api.setPropertyDefinition(nextDefinition);
						definition = nextDefinition;
					});
				}));

		new Setting(this.contentEl)
			.setName("Displayed title")
			.setDesc("Optional label shown in the note properties UI.")
			.addText((text) => {
				text
					.setPlaceholder(definition.property)
					.setValue(definition.displayTitle ?? "")
					.onChange(async (value) => {
						const nextDefinition = {
							...definition,
							displayTitle: value.trim() || undefined,
						};
						await this.plugin.api.setPropertyDefinition(nextDefinition);
						definition = nextDefinition;
					});
			});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

export class PropertySettingsModal extends Modal {
	constructor(
		private readonly plugin: NoteFieldsCorePlugin,
		private readonly propertyName: string
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.modalEl.addClass("props-framework-editor-modal");
		this.contentEl.addClass("props-framework-modal");

		const definition = this.plugin.api.getPropertyDefinition(this.propertyName);
		if (!definition) {
			this.close();
			return;
		}

		const type = this.plugin.api.getRegisteredType(definition.typeId);
		new Setting(this.contentEl)
			.setName(`${definition.displayTitle ?? definition.property} settings`)
			.setDesc(type?.name ?? definition.typeId)
			.setHeading();

		type?.renderSettings?.(this.contentEl, {
			app: this.plugin.app,
			definition,
			getDefinition: () => this.plugin.api.getPropertyDefinition(this.propertyName) ?? definition,
			updateDefinition: async (nextDefinition) => {
				await this.plugin.api.setPropertyDefinition(nextDefinition);
			},
		});
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

function getPropertyName(propertyEl: HTMLElement): string | null {
	const dataKey = propertyEl.getAttribute("data-property-key");
	if (dataKey) {
		return dataKey;
	}

	const inputEl = propertyEl.querySelector(".metadata-property-key-input");
	if (inputEl instanceof HTMLInputElement && inputEl.getAttribute("aria-label")) {
		return inputEl.getAttribute("aria-label");
	}

	if (inputEl instanceof HTMLInputElement) {
		return inputEl.value;
	}

	return null;
}

function positionDisplayedTitle(
	inputEl: HTMLInputElement,
	containerEl: HTMLElement,
	titleEl: HTMLElement,
	iconEl: HTMLElement | null
): void {
	const update = (): void => {
		const inputRect = inputEl.getBoundingClientRect();
		const containerRect = containerEl.getBoundingClientRect();
		if (inputRect.width === 0 || inputRect.height === 0) {
			return;
		}

		const inputStyle = window.getComputedStyle(inputEl);
		const paddingLeft = Number.parseFloat(inputStyle.paddingLeft) || 0;
		const paddingRight = Number.parseFloat(inputStyle.paddingRight) || 0;
		const iconRect = iconEl?.getBoundingClientRect();
		const inputTextLeft = inputRect.left + paddingLeft;
		const iconTextLeft = iconRect ? iconRect.right + 6 : inputTextLeft;
		const textLeft = Math.max(inputTextLeft, iconTextLeft);
		const textRight = inputRect.right - paddingRight;

		titleEl.style.left = `${textLeft - containerRect.left}px`;
		titleEl.style.top = `${inputRect.top - containerRect.top}px`;
		titleEl.style.width = `${Math.max(0, textRight - textLeft)}px`;
		titleEl.style.height = `${inputRect.height}px`;
		titleEl.style.fontFamily = inputStyle.fontFamily;
		titleEl.style.fontSize = inputStyle.fontSize;
		titleEl.style.fontWeight = inputStyle.fontWeight;
		titleEl.style.letterSpacing = inputStyle.letterSpacing;
		titleEl.style.lineHeight = inputStyle.lineHeight;
	};

	update();
	window.requestAnimationFrame(update);
}
