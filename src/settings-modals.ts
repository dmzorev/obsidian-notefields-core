import { Modal, Notice, Setting } from "obsidian";
import { renderColorCollectionEditor, renderIconCollectionEditor } from "./catalog-options-editor";
import type NoteFieldsCorePlugin from "./main";
import { renderValueOptionsEditor } from "./options-editor";

export type OptionCollectionKind = "value" | "icon" | "color";

export class OptionCollectionModal extends Modal {
	constructor(
		private readonly plugin: NoteFieldsCorePlugin,
		private readonly kind: OptionCollectionKind,
		private readonly collectionId: string
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("props-framework-editor-modal");
		this.render();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private render(): void {
		this.contentEl.empty();
		const collection = this.getCollection();
		if (!collection) {
			this.close();
			return;
		}

		new Setting(this.contentEl)
			.setName(collection.name)
			.setDesc(`${collection.options.length} ${formatItemCount(this.kind, collection.options.length)}`)
			.setHeading();

		new Setting(this.contentEl)
			.setName("Collection name")
			.addText((text) => {
				text.setValue(collection.name).setDisabled(Boolean(collection.readonly));
				text.inputEl.addEventListener("change", () => {
					const name = text.inputEl.value.trim();
					if (!name) {
						text.setValue(collection.name);
						return;
					}
					void this.renameCollection(name);
				});
			});

		if (this.kind === "value") {
			renderValueOptionsEditor(this.plugin, this.contentEl, {
				binding: { mode: "shared", collectionId: this.collectionId },
				onChange: async () => undefined,
			}, { showBinding: false, showCollect: false });
		} else if (this.kind === "icon") {
			const iconCollection = this.plugin.api.getIconOptionCollection(this.collectionId);
			if (iconCollection) {
				renderIconCollectionEditor(this.plugin, this.contentEl, iconCollection);
			}
		} else {
			const colorCollection = this.plugin.api.getColorOptionCollection(this.collectionId);
			if (colorCollection) {
				renderColorCollectionEditor(this.plugin, this.contentEl, colorCollection);
			}
		}
	}

	private getCollection() {
		if (this.kind === "value") {
			return this.plugin.api.getValueOptionCollection(this.collectionId);
		}
		if (this.kind === "icon") {
			return this.plugin.api.getIconOptionCollection(this.collectionId);
		}
		return this.plugin.api.getColorOptionCollection(this.collectionId);
	}

	private async renameCollection(name: string): Promise<void> {
		const collection = this.getCollection();
		if (!collection || collection.readonly || collection.name === name) {
			return;
		}
		if (this.kind === "value" && collection.kind === "value") {
			await this.plugin.api.updateValueOptionCollection({ ...collection, name });
		} else if (this.kind === "icon" && collection.kind === "icon") {
			await this.plugin.api.updateIconOptionCollection({ ...collection, name });
		} else if (this.kind === "color" && collection.kind === "color") {
			await this.plugin.api.updateColorOptionCollection({ ...collection, name });
		}
		this.render();
	}
}

export class CreateOptionCollectionModal extends Modal {
	private name = "";

	constructor(
		private readonly plugin: NoteFieldsCorePlugin,
		private readonly kind: OptionCollectionKind,
		private readonly onCreated: () => void
	) {
		super(plugin.app);
	}

	onOpen(): void {
		this.modalEl.addClass("props-framework-small-modal");
		new Setting(this.contentEl)
			.setName(`New ${this.kind} collection`)
			.setHeading();
		new Setting(this.contentEl)
			.setName("Name")
			.addText((text) => {
				text.setPlaceholder(collectionPlaceholder(this.kind)).onChange((value) => {
					this.name = value;
				});
				window.setTimeout(() => text.inputEl.focus(), 0);
				text.inputEl.addEventListener("keydown", (event) => {
					if (event.key === "Enter") {
						event.preventDefault();
						void this.create();
					}
				});
			})
			.addButton((button) => button
				.setButtonText("Create")
				.setCta()
				.onClick(() => void this.create()));
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async create(): Promise<void> {
		const name = this.name.trim();
		if (!name) {
			new Notice("Enter a collection name.");
			return;
		}
		let id: string;
		if (this.kind === "value") {
			id = (await this.plugin.api.createValueOptionCollection({ name })).id;
		} else if (this.kind === "icon") {
			id = (await this.plugin.api.createIconOptionCollection({ name })).id;
		} else {
			id = (await this.plugin.api.createColorOptionCollection({ name })).id;
		}
		this.close();
		this.onCreated();
		new OptionCollectionModal(this.plugin, this.kind, id).open();
	}
}

function collectionPlaceholder(kind: OptionCollectionKind): string {
	if (kind === "value") {
		return "Statuses";
	}
	if (kind === "icon") {
		return "Project icons";
	}
	return "Project colors";
}

function formatItemCount(kind: OptionCollectionKind, count: number): string {
	const singular = kind === "value" ? "value" : kind;
	return `${singular}${count === 1 ? "" : "s"}`;
}
