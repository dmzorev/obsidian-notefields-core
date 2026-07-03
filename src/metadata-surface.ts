import { MarkdownView, setIcon } from "obsidian";
import type NoteFieldsCorePlugin from "./main";
import type { PropertyBlockActionContext, PropertyDefinition } from "./types";

const CONTAINER_SELECTOR = ".metadata-container";
const PROPERTY_SELECTOR = ".metadata-property";
const TOGGLE_CLASS = "notefields-hidden-properties-toggle";
const ACTION_BAR_CLASS = "notefields-property-block-actions";
const ACTION_CLASS = "notefields-property-block-action";

export class MetadataSurfaceController {
	private readonly observers = new Map<HTMLElement, MutationObserver>();
	private readonly scheduled = new WeakSet<HTMLElement>();

	constructor(private readonly plugin: NoteFieldsCorePlugin) {}

	load(): void {
		this.plugin.registerEvent(this.plugin.app.workspace.on("layout-change", () => this.refreshSoon()));
		this.plugin.registerEvent(this.plugin.app.workspace.on("active-leaf-change", () => this.refreshSoon()));
		this.refreshSoon();
	}

	unload(): void {
		for (const observer of this.observers.values()) {
			observer.disconnect();
		}
		this.observers.clear();
		for (const containerEl of this.getContainers()) {
			this.cleanupContainer(containerEl);
		}
	}

	decorateProperty(
		propertyEl: HTMLElement,
		definition: PropertyDefinition,
		value: unknown
	): void {
		propertyEl.toggleClass("notefields-value-empty", isEmptyValue(value));
		propertyEl.dataset.notefieldsVisibility = definition.visibility ?? "visible";
		const containerEl = propertyEl.closest(CONTAINER_SELECTOR);
		if (containerEl instanceof HTMLElement) {
			this.observe(containerEl);
			this.schedule(containerEl);
		}
	}

	refreshSoon(): void {
		window.setTimeout(() => {
			for (const containerEl of this.getContainers()) {
				this.observe(containerEl);
				this.schedule(containerEl);
			}
		}, 0);
	}

	private getContainers(): HTMLElement[] {
		const containers: HTMLElement[] = [];
		for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
			if (!(leaf.view instanceof MarkdownView)) {
				continue;
			}
			for (const containerEl of Array.from(leaf.view.containerEl.querySelectorAll(CONTAINER_SELECTOR))) {
				if (containerEl instanceof HTMLElement) {
					containers.push(containerEl);
				}
			}
		}
		return containers;
	}

	private observe(containerEl: HTMLElement): void {
		if (this.observers.has(containerEl)) {
			return;
		}
		const observer = new MutationObserver(() => this.schedule(containerEl));
		observer.observe(containerEl, {
			attributes: true,
			attributeFilter: ["class", "data-property-key"],
			childList: true,
			subtree: true,
		});
		this.observers.set(containerEl, observer);
	}

	private schedule(containerEl: HTMLElement): void {
		if (this.scheduled.has(containerEl)) {
			return;
		}
		this.scheduled.add(containerEl);
		window.requestAnimationFrame(() => {
			this.scheduled.delete(containerEl);
			if (!containerEl.isConnected) {
				this.observers.get(containerEl)?.disconnect();
				this.observers.delete(containerEl);
				return;
			}
			this.decorateContainer(containerEl);
		});
	}

	private decorateContainer(containerEl: HTMLElement): void {
		let hiddenCount = 0;
		for (const row of Array.from(containerEl.querySelectorAll(PROPERTY_SELECTOR))) {
			if (!(row instanceof HTMLElement)) {
				continue;
			}
			const definition = this.getDefinition(row);
			const visibility = definition?.visibility ?? "visible";
			const hidden = visibility === "hidden"
				|| visibility === "hidden-when-empty" && this.isEmptyRow(row);
			row.toggleClass("notefields-property-hidden", hidden);
			row.toggleClass("notefields-property-hidden-when-empty", visibility === "hidden-when-empty");
			if (hidden) {
				hiddenCount += 1;
			}
		}

		this.updateToggle(containerEl, hiddenCount);
		this.updateRegisteredActions(containerEl);
		this.removeEmptyActionBar(containerEl);
	}

	private getDefinition(propertyEl: HTMLElement): PropertyDefinition | null {
		const propertyName = getPropertyName(propertyEl);
		return propertyName ? this.plugin.api.getPropertyDefinition(propertyName) : null;
	}

	private isEmptyRow(propertyEl: HTMLElement): boolean {
		return propertyEl.hasClass("notefields-value-empty") || propertyEl.hasClass("is-empty");
	}

	private updateToggle(containerEl: HTMLElement, hiddenCount: number): void {
		let buttonEl = containerEl.querySelector<HTMLButtonElement>(`.${TOGGLE_CLASS}`);
		if (hiddenCount === 0) {
			buttonEl?.remove();
			containerEl.removeClass("notefields-show-hidden-properties");
			return;
		}

		if (!(buttonEl instanceof HTMLButtonElement)) {
			const actionBarEl = this.getActionBar(containerEl);
			buttonEl = document.createElement("button");
			buttonEl.type = "button";
			buttonEl.addClass("clickable-icon");
			buttonEl.addClass(TOGGLE_CLASS);
			for (const eventName of ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick"]) {
				buttonEl.addEventListener(eventName, (event) => event.stopPropagation());
			}
			buttonEl.addEventListener("click", (event) => {
				event.preventDefault();
				event.stopPropagation();
				containerEl.toggleClass(
					"notefields-show-hidden-properties",
					!containerEl.hasClass("notefields-show-hidden-properties")
				);
				this.schedule(containerEl);
			});
			buttonEl.addEventListener("keydown", (event) => event.stopPropagation());
			actionBarEl.append(buttonEl);
		} else {
			const actionBarEl = this.getActionBar(containerEl);
			if (buttonEl.parentElement !== actionBarEl) actionBarEl.prepend(buttonEl);
		}
		for (const staleIcon of Array.from(buttonEl.querySelectorAll(":scope > svg"))) {
			staleIcon.remove();
		}
		let iconEl = buttonEl.querySelector<HTMLElement>(".notefields-hidden-properties-icon");
		if (!iconEl) {
			iconEl = document.createElement("span");
			iconEl.addClass("notefields-hidden-properties-icon");
			buttonEl.prepend(iconEl);
		}
		let countEl = buttonEl.querySelector<HTMLElement>(".notefields-hidden-properties-count");
		if (!countEl) {
			countEl = document.createElement("span");
			countEl.addClass("notefields-hidden-properties-count");
			buttonEl.append(countEl);
		}

		const shown = containerEl.hasClass("notefields-show-hidden-properties");
		const state = shown ? "shown" : "hidden";
		if (buttonEl.dataset.notefieldsState !== state) {
			iconEl.empty();
			setIcon(iconEl, shown ? "lucide-eye-off" : "lucide-eye");
			buttonEl.dataset.notefieldsState = state;
		}
		const count = String(hiddenCount);
		if (countEl.textContent !== count) {
			countEl.textContent = count;
		}
		const action = shown ? "Hide" : "Show";
		const suffix = hiddenCount === 1 ? "property" : "properties";
		const label = `${action} ${hiddenCount} hidden ${suffix}`;
		buttonEl.setAttribute("aria-label", label);
		buttonEl.title = label;
		buttonEl.setAttribute("aria-pressed", String(shown));
	}

	private updateRegisteredActions(containerEl: HTMLElement): void {
		const context = this.createActionContext(containerEl);
		const actions = this.plugin.api.getPropertyBlockActions(context);
		const expected = new Set(actions.map((action) => `${action.ownerPluginId}:${action.id}`));
		const existing = new Map<string, HTMLButtonElement>();
		for (const element of Array.from(containerEl.querySelectorAll<HTMLButtonElement>(`.${ACTION_CLASS}`))) {
			const key = element.dataset.notefieldsAction;
			if (key) existing.set(key, element);
		}

		for (const [key, buttonEl] of existing) {
			if (!expected.has(key)) buttonEl.remove();
		}
		if (actions.length === 0) return;

		const actionBarEl = this.getActionBar(containerEl);
		let previousEl: Element | null = actionBarEl.querySelector(`.${TOGGLE_CLASS}`);
		for (const action of actions) {
			const key = `${action.ownerPluginId}:${action.id}`;
			let buttonEl = existing.get(key);
			if (!buttonEl?.isConnected) {
				buttonEl = actionBarEl.createEl("button", {
					attr: { type: "button" },
					cls: ["clickable-icon", ACTION_CLASS],
				});
				buttonEl.dataset.notefieldsAction = key;
				stopActionPropagation(buttonEl);
				buttonEl.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					const currentContext = this.createActionContext(containerEl);
					const current = this.plugin.api.getPropertyBlockActions(currentContext)
						.find((candidate) => `${candidate.ownerPluginId}:${candidate.id}` === key);
					if (current) void current.onClick(currentContext);
				});
			}
			buttonEl.title = action.title;
			buttonEl.setAttribute("aria-label", action.title);
			if (buttonEl.dataset.notefieldsIcon !== action.icon) {
				buttonEl.empty();
				setIcon(buttonEl, action.icon);
				buttonEl.dataset.notefieldsIcon = action.icon;
			}
			const expectedNext = previousEl?.nextElementSibling ?? actionBarEl.firstElementChild;
			if (buttonEl !== expectedNext) actionBarEl.insertBefore(buttonEl, expectedNext);
			previousEl = buttonEl;
		}
	}

	private getActionBar(containerEl: HTMLElement): HTMLElement {
		let actionBarEl = containerEl.querySelector<HTMLElement>(`:scope > .${ACTION_BAR_CLASS}`);
		if (!actionBarEl) {
			actionBarEl = containerEl.createDiv({ cls: ACTION_BAR_CLASS });
		}
		return actionBarEl;
	}

	private removeEmptyActionBar(containerEl: HTMLElement): void {
		const actionBarEl = containerEl.querySelector<HTMLElement>(`:scope > .${ACTION_BAR_CLASS}`);
		if (actionBarEl && actionBarEl.childElementCount === 0) actionBarEl.remove();
	}

	private createActionContext(containerEl: HTMLElement): PropertyBlockActionContext {
		let file = null;
		for (const leaf of this.plugin.app.workspace.getLeavesOfType("markdown")) {
			if (leaf.view instanceof MarkdownView && leaf.view.containerEl.contains(containerEl)) {
				file = leaf.view.file;
				break;
			}
		}
		return { app: this.plugin.app, file, containerEl };
	}

	private cleanupContainer(containerEl: HTMLElement): void {
		containerEl.removeClass("notefields-show-hidden-properties");
		containerEl.querySelector(`.${ACTION_BAR_CLASS}`)?.remove();
		containerEl.querySelector(`.${TOGGLE_CLASS}`)?.remove();
		for (const row of Array.from(containerEl.querySelectorAll(PROPERTY_SELECTOR))) {
			if (row instanceof HTMLElement) {
				row.removeClass(
					"notefields-property-hidden",
					"notefields-property-hidden-when-empty",
					"notefields-value-empty"
				);
				delete row.dataset.notefieldsVisibility;
			}
		}
	}
}

function stopActionPropagation(buttonEl: HTMLButtonElement): void {
	for (const eventName of ["pointerdown", "pointerup", "mousedown", "mouseup", "dblclick"]) {
		buttonEl.addEventListener(eventName, (event) => event.stopPropagation());
	}
	buttonEl.addEventListener("keydown", (event) => event.stopPropagation());
}

function getPropertyName(propertyEl: HTMLElement): string | null {
	const dataKey = propertyEl.getAttribute("data-property-key");
	if (dataKey) {
		return dataKey;
	}
	const inputEl = propertyEl.querySelector(".metadata-property-key-input");
	if (!(inputEl instanceof HTMLInputElement)) {
		return null;
	}
	return inputEl.getAttribute("aria-label") || inputEl.value || null;
}

function isEmptyValue(value: unknown): boolean {
	if (value === null || value === undefined || value === "") {
		return true;
	}
	if (Array.isArray(value)) {
		return value.length === 0;
	}
	return typeof value === "object" && Object.keys(value).length === 0;
}
