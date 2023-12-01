// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { ListTreeProvider } from './tree/List';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	const listTreeProvider = new ListTreeProvider(context.globalState);
	vscode.window.registerTreeDataProvider(ListTreeProvider.treeId, listTreeProvider);
	vscode.commands.registerCommand('apifoxGen.list.refresh', () => listTreeProvider.refresh());
	vscode.commands.registerCommand('apifoxGen.list.addCookie', () => listTreeProvider.addCookie());
	vscode.commands.registerCommand('apifoxGen.list.genCode', (node) => listTreeProvider.genCode(node));
	vscode.commands.registerCommand('apifoxGen.list.addApiFloder', () => listTreeProvider.addApiFloder());
	vscode.commands.registerCommand('apifoxGen.list.baseURL', () => listTreeProvider.baseURL());
}