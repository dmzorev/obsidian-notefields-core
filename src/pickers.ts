import { Modal, Setting, setIcon } from "obsidian";
import {
	SYSTEM_COLOR_COLLECTION_ID,
	SYSTEM_ICON_COLLECTION_ID,
	catalogOptionMatchesQuery,
	colorToCss,
} from "./catalog-options";
import type NoteFieldsCorePlugin from "./main";

export class IconPickerModal extends Modal {
	constructor(
		private readonly plugin: NoteFieldsCorePlugin,
		private readonly currentIcon: string | null,
		private readonly onChoose: (icon: string | null) => void | Promise<void>,
		private readonly initialCollectionId: string | null = null
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.modalEl.addClass("props-framework-picker-modal");
		this.contentEl.createEl("h3", { text: "Choose icon" });
		let collectionId = this.initialCollectionId ?? "";

		new Setting(this.contentEl)
			.setName("Collection")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("", "All icons")
					.addOption(SYSTEM_ICON_COLLECTION_ID, "Obsidian icons");
				for (const collection of this.plugin.api.getIconOptionCollections()) {
					dropdown.addOption(collection.id, collection.name);
				}
				dropdown.setValue(collectionId).onChange((value) => {
					collectionId = value;
					render();
				});
			});

		const inputEl = this.contentEl.createEl("input", {
			attr: { placeholder: "Search icons", type: "text" },
			cls: "metadata-input-text props-framework-picker-search",
		});
		const resultsEl = this.contentEl.createDiv({ cls: "props-framework-icon-grid" });

		const render = (): void => {
			resultsEl.empty();
			const icons = this.plugin.api.resolveIconOptions(collectionId || null)
				.filter((option) => catalogOptionMatchesQuery(option, inputEl.value))
				.slice(0, 240);

			for (const option of icons) {
				const buttonEl = resultsEl.createEl("button", {
					attr: { "aria-label": option.label ?? option.value, type: "button" },
					cls: ["props-framework-icon-choice", option.value === this.currentIcon ? "is-selected" : ""],
				});
				const iconEl = buttonEl.createSpan({ cls: "props-framework-icon-choice-preview" });
				setIcon(iconEl, option.value);
				if (!iconEl.querySelector("svg")) {
					setIcon(iconEl, "lucide-circle-help");
				}
				buttonEl.createSpan({ text: option.label ?? option.value.replace(/^lucide-/u, "") });
				buttonEl.addEventListener("click", () => void this.choose(option.value));
			}
		};

		const actionsEl = this.contentEl.createDiv({ cls: "props-framework-picker-actions" });
		const clearButton = actionsEl.createEl("button", { attr: { type: "button" }, text: "Clear" });
		clearButton.addEventListener("click", () => void this.choose(null));

		inputEl.addEventListener("input", render);
		render();
		window.setTimeout(() => inputEl.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async choose(icon: string | null): Promise<void> {
		await this.onChoose(icon);
		this.close();
	}
}

export class ColorPickerModal extends Modal {
	constructor(
		private readonly plugin: NoteFieldsCorePlugin,
		private readonly currentColor: string | null,
		private readonly onChoose: (color: string | null) => void | Promise<void>,
		private readonly initialCollectionId: string | null = null
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.modalEl.addClass("props-framework-picker-modal");
		this.contentEl.createEl("h3", { text: "Choose color" });
		let collectionId = this.initialCollectionId ?? "";
		let customColor = normalizeColorToHex(this.currentColor) ?? "#7c8cff";

		new Setting(this.contentEl)
			.setName("Collection")
			.addDropdown((dropdown) => {
				dropdown
					.addOption("", "All colors")
					.addOption(SYSTEM_COLOR_COLLECTION_ID, "Default colors");
				for (const collection of this.plugin.api.getColorOptionCollections()) {
					dropdown.addOption(collection.id, collection.name);
				}
				dropdown.setValue(collectionId).onChange((value) => {
					collectionId = value;
					render();
				});
			});

		const searchEl = this.contentEl.createEl("input", {
			attr: { placeholder: "Search colors", type: "text" },
			cls: "metadata-input-text props-framework-picker-search",
		});
		const paletteEl = this.contentEl.createDiv({ cls: "props-framework-color-grid" });

		const render = (): void => {
			paletteEl.empty();
			const colors = this.plugin.api.resolveColorOptions(collectionId || null)
				.filter((option) => catalogOptionMatchesQuery(option, searchEl.value));
			for (const option of colors) {
				const swatchEl = paletteEl.createEl("button", {
					attr: { "aria-label": option.label ?? option.value, type: "button" },
					cls: ["props-framework-color-choice", option.value === this.currentColor ? "is-selected" : ""],
				});
				swatchEl.style.backgroundColor = colorToCss(option.value);
				swatchEl.setAttribute("data-tooltip-position", "top");
				swatchEl.addEventListener("click", () => void this.choose(option.value));
			}
		};

		new Setting(this.contentEl)
			.setName("Custom color")
			.addColorPicker((picker) => picker
				.setValue(customColor)
				.onChange((value) => {
					customColor = value;
				}))
			.addButton((button) => button
				.setButtonText("Apply")
				.setCta()
				.onClick(() => void this.choose(customColor)))
			.addButton((button) => button
				.setButtonText("Clear")
				.onClick(() => void this.choose(null)));

		searchEl.addEventListener("input", render);
		render();
		window.setTimeout(() => searchEl.focus(), 0);
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async choose(color: string | null): Promise<void> {
		await this.onChoose(color);
		this.close();
	}
}

function normalizeColorToHex(color: string | null): string | null {
	return color && /^#[0-9a-f]{6}$/iu.test(color) ? color : null;
}
