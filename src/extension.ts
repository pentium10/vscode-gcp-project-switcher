// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { Disposable, QuickInputButton, QuickInputButtons, QuickPickItem, window } from 'vscode';
import { codicons, ThemeIcons } from "vscode-ext-codicons";
const childprocess = require('child_process');
let nativeStatusBar: vscode.StatusBarItem;
let projectsJson: string;
let timer: any;
let currentProject: string;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	fetchCurrentProject();
	fetchProjects(true);
	let cmd1=vscode.commands.registerCommand("vscode-gcp-project-switcher.listProjects", () => listProjects(false));
	context.subscriptions.push(cmd1);
	let cmd2=vscode.commands.registerCommand("vscode-gcp-project-switcher.fetchProjects", () => fetchProjects(true));
	context.subscriptions.push(cmd2);
	let cmd3=vscode.commands.registerCommand("vscode-gcp-project-switcher.fetchCurrentProject", () => fetchProjects(true));
	context.subscriptions.push(cmd3);
	/**/
	context.subscriptions.push(nativeStatusBar);
	context.subscriptions.push(timer);
}


async function listProjects(forceNewWindow: boolean) {
	const projects = await fetchProjects(forceNewWindow);
	let items: vscode.QuickPickItem[] = [];
	for (let index = 0; index < projects.length; index++) {
		let item = projects[index];
		items.push({
			label: item.name,
			description: item.projectId
		});
	}

	const refreshButton: QuickInputButton = {
		iconPath: ThemeIcons.sync,
		tooltip: "Refresh project list",
	};

	const options = <vscode.QuickPickOptions>{
		matchOnDescription: true,
		placeHolder: "Loading Projects (pick one...)",
		buttons: [QuickInputButtons.Back]
	};

	const pick = await showQuickPick({
		title: 'Google Cloud Platform Projects',
		step: 0,
		totalSteps: 0,
		placeholder: 'Loading Projects (pick one...)',
		items: items,
		buttons: [refreshButton],
		shouldResume: function shouldResume() {
			// Could show a notification with the option to resume.
			return new Promise<boolean>((resolve, reject) => {
				// noop
			});
		}
	});
}
interface QuickPickParameters<T extends QuickPickItem> {
	title: string;
	step: number;
	totalSteps: number;
	items: T[];
	activeItem?: T;
	placeholder: string;
	buttons?: QuickInputButton[];
	shouldResume: () => Thenable<boolean>;
}
async function showQuickPick<T extends QuickPickItem, P extends QuickPickParameters<T>>({ title, step, totalSteps, items, activeItem, placeholder, buttons, shouldResume }: P) {
	const disposables: Disposable[] = [];
	try {
		return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>((resolve, reject) => {
			const input = window.createQuickPick<T>();
			let myItems = items;
			input.title = title;
			input.step = step;
			input.totalSteps = totalSteps;
			input.placeholder = placeholder;
			input.items = myItems;
			if (activeItem) {
				input.activeItems = [activeItem];
			}
			input.buttons = [
				...(buttons || [])
			];

			disposables.push(
				input.onDidTriggerButton(async item => {
					//vscode.window.showInformationMessage('Refreshing projects list...');
					await listProjects(true);
					input.dispose();
					resolve(undefined);
				}),
				input.onDidChangeSelection(async items => {
					//resolve(items[0])
					changeProject(items[0].description + "");
					refreshStatusBar(items[0].description + "");
					input.dispose();
					resolve(undefined);
				}
				),
			);
			input.show();
		});
	} finally {
		disposables.forEach(d => d.dispose());
	}
}

export function refreshStatusBar(project: string): void {
	if (nativeStatusBar == undefined) {
		nativeStatusBar = vscode.window
			.createStatusBarItem(vscode.StatusBarAlignment.Left, 1000);
	}

	nativeStatusBar.text = codicons.cloud + ' ' + project;
	nativeStatusBar.tooltip = 'gsutil current project: ' + project;
	nativeStatusBar.command = "vscode-gcp-project-switcher.listProjects"

	nativeStatusBar.show();

}

export function fetchCurrentProject(): Promise<void> {
	let cmd = `gcloud config get-value project --format=json`;

	clearTimeout(timer);

	timer = setTimeout(function () {
		fetchCurrentProject();
	}, 5000);

	return new Promise((resolve, reject) => {
		childprocess.exec(cmd, (e: Error, stdout: string, stderr: string) => {
			if (e) { reject(e); }
			else if (stderr.length > 0) { reject(new Error(stderr)); }
			else {
				let project = JSON.parse(stdout);
				if (0 === project.length) {
					resolve(undefined);
				}
				resolve(refreshStatusBar(project));
			}
		});
	});

}


export function fetchProjects(force: boolean): Promise<any> {
	let cmd = `gcloud projects list --format=json --sort-by=~createTime`;

	if (projectsJson != undefined && force == false) {
		return new Promise((resolve, reject) => {
			resolve(JSON.parse(projectsJson));
		})
	}

	return new Promise((resolve, reject) => {
		childprocess.exec(cmd, (e: Error, stdout: string, stderr: string) => {
			if (e) { reject(e); }
			else if (stderr.length > 0) { reject(new Error(stderr)); }
			else {
				projectsJson = stdout;
				let data = JSON.parse(stdout);
				if (0 === data.length) {
					resolve(undefined);
				}
				resolve(data);
			}
		});
	});
}

export async function changeProject(project: string): Promise<any> {
	let cmd = `gcloud config set project "` + project + `"`;

	return new Promise((resolve, reject) => {
		childprocess.exec(cmd, (e: Error, stdout: string, stderr: string) => {
			if (e) { reject(e); }
			else if (stderr.length > 0) { reject(new Error(stderr)); }
			else {
				resolve(undefined);
			}
		});
	});
}

// this method is called when your extension is deactivated
export function deactivate() {
	try {
		if (timer != undefined) {
			clearTimeout(timer);
		}
	}
	catch { }
	try {
		if (nativeStatusBar != undefined) {
			nativeStatusBar.dispose();
		}
	}
	catch { }
}
