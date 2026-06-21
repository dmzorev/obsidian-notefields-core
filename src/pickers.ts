import { App, Modal, getIconIds, setIcon } from "obsidian";

const BASIC_COLORS = [
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

export class IconPickerModal extends Modal {
	constructor(
		app: App,
		private readonly currentIcon: string | null,
		private readonly onChoose: (icon: string | null) => void | Promise<void>
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.modalEl.addClass("props-framework-picker-modal");
		this.contentEl.createEl("h3", { text: "Choose icon" });

		const inputEl = this.contentEl.createEl("input", {
			attr: {
				placeholder: "Search icons",
				type: "text",
			},
			cls: "metadata-input-text props-framework-picker-search",
		});
		const resultsEl = this.contentEl.createDiv({ cls: "props-framework-icon-grid" });

		const render = (): void => {
			resultsEl.empty();
			const query = inputEl.value.trim().toLowerCase();
			const icons = getIconIds()
				.filter((icon) => !query || icon.toLowerCase().includes(query))
				.slice(0, 160);

			for (const icon of icons) {
				const buttonEl = resultsEl.createEl("button", {
					attr: {
						"aria-label": icon,
						type: "button",
					},
					cls: ["props-framework-icon-choice", icon === this.currentIcon ? "is-selected" : ""],
				});
				setIcon(buttonEl, icon);
				buttonEl.createSpan({ text: icon.replace(/^lucide-/u, "") });
				buttonEl.addEventListener("click", () => {
					void this.choose(icon);
				});
			}
		};

		const actionsEl = this.contentEl.createDiv({ cls: "props-framework-picker-actions" });
		const clearButton = actionsEl.createEl("button", {
			attr: { type: "button" },
			text: "Clear",
		});
		clearButton.addEventListener("click", () => {
			void this.choose(null);
		});

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
		app: App,
		private readonly currentColor: string | null,
		private readonly onChoose: (color: string | null) => void | Promise<void>
	) {
		super(app);
	}

	onOpen(): void {
		this.contentEl.empty();
		this.modalEl.addClass("props-framework-picker-modal");
		this.contentEl.createEl("h3", { text: "Choose color" });

		const previewEl = this.contentEl.createDiv({ cls: "props-framework-color-preview" });
		const inputEl = this.contentEl.createEl("input", {
			attr: {
				type: "color",
			},
			cls: "props-framework-color-input",
		});
		inputEl.value = normalizeColorToHex(this.currentColor) ?? "#7c8cff";
		previewEl.style.backgroundColor = inputEl.value;

		inputEl.addEventListener("input", () => {
			previewEl.style.backgroundColor = inputEl.value;
		});

		const paletteEl = this.contentEl.createDiv({ cls: "props-framework-color-grid" });
		for (const color of BASIC_COLORS) {
			const swatchEl = paletteEl.createEl("button", {
				attr: {
					"aria-label": color,
					type: "button",
				},
				cls: "props-framework-color-choice",
			});
			swatchEl.style.backgroundColor = `rgba(var(--color-${color}-rgb), 1)`;
			swatchEl.addEventListener("click", () => {
				void this.choose(color);
			});
		}

		const customEl = this.contentEl.createDiv({ cls: "props-framework-picker-actions" });
		const applyButton = customEl.createEl("button", {
			attr: { type: "button" },
			cls: "mod-cta",
			text: "Apply",
		});
		applyButton.addEventListener("click", () => {
			void this.choose(inputEl.value);
		});

		const clearButton = customEl.createEl("button", {
			attr: { type: "button" },
			text: "Clear",
		});
		clearButton.addEventListener("click", () => {
			void this.choose(null);
		});
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
	if (!color?.startsWith("#")) {
		return null;
	}

	if (/^#[0-9a-f]{6}$/iu.test(color)) {
		return color;
	}

	return null;
}
