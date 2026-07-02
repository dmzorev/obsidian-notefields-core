import { Menu } from "obsidian";

export interface TypeMenuChoice {
	id: string;
	name: string;
	icon: string;
	group?: "framework" | "standard";
}

export function showTypeMenu(
	event: MouseEvent,
	choices: TypeMenuChoice[],
	currentTypeId: string,
	onChoose: (typeId: string) => void | Promise<void>
): void {
	const menu = new Menu();
	const framework = choices.filter((choice) => choice.group === "framework");
	const standard = choices.filter((choice) => choice.group !== "framework");
	addChoices(menu, framework, currentTypeId, onChoose);
	if (framework.length && standard.length) {
		menu.addSeparator();
	}
	addChoices(menu, standard, currentTypeId, onChoose);
	menu.showAtMouseEvent(event);
}

function addChoices(
	menu: Menu,
	choices: TypeMenuChoice[],
	currentTypeId: string,
	onChoose: (typeId: string) => void | Promise<void>
): void {
	for (const choice of choices) {
		menu.addItem((item) => item
			.setTitle(choice.name)
			.setIcon(choice.icon)
			.setChecked(choice.id === currentTypeId)
			.onClick(() => void onChoose(choice.id)));
	}
}
