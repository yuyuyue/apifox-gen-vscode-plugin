import { TreeDataProvider, TreeItem, TreeItemCollapsibleState, ProviderResult, window, workspace, ConfigurationTarget, EventEmitter, Event, Memento, Uri, ThemeIcon } from "vscode";
import { getProjects, getProjectTreeFloderNames } from '../utils/http';
import type { METHOD, TApiFloder, TProject } from '../utils/http';
import { generate } from "../utils/generate";
import path from 'path';

export class ListTreeProvider implements TreeDataProvider<ListItem> {
  public static readonly treeId = "apifoxGen.list";
  private _onDidChangeTreeData: EventEmitter<ListItem | undefined | null | void> = new EventEmitter<ListItem | undefined | null | void>();
  readonly onDidChangeTreeData: Event<ListItem | undefined | null | void> = this._onDidChangeTreeData.event;
  private globalState: Memento;
  
  public constructor(globalState: Memento) {
    this.globalState = globalState;
  }
  
  public refresh: () => void = () => {
    getProjects().then((data: TProject[]) => {
      Promise.all(data.map(item => getProjectTreeFloderNames(item.id))).then((args) => {
       const projectsTree = args.map((item, index) => {
          const dataItem = data[index];
          return {
            children: item,
            type: 'apiFloderRoot',
            key: dataItem.id,
            projectId: dataItem.id,
            ...dataItem
          };
        });
        this.globalState.update('projectsTree', projectsTree);
      });
      
      this._onDidChangeTreeData.fire();
    }).catch((e) => {
      window.showErrorMessage(e.message);
    });
  };
  
  public addCookie: () => void = () => { 
    const cookie = workspace.getConfiguration('apifoxGen').get<string>('cookie');
    window.showInputBox({
      placeHolder: '填写Cookie',
      value: cookie,
    }).then(v => {
      if (v === '' || v === undefined || v === null) {
        return;
      }
      const apifoxConfig = workspace.getConfiguration('apifoxGen');
      apifoxConfig.update('cookie', v, ConfigurationTarget.Global).then(() => {
        this.refresh();
      });
      window.showInformationMessage('添加成功');
    });
  };
  
  // 添加版本号
  public clientVersion: () => void = () => { 
    const clientVersion = workspace.getConfiguration('apifoxGen').get<string>('clientVersion');
    window.showInputBox({
      placeHolder: '添加版本号',
      value: clientVersion,
    }).then(v => {
      if (v === '' || v === undefined || v === null) {
        return;
      }
      const apifoxConfig = workspace.getConfiguration('apifoxGen');
      apifoxConfig.update('clientVersion', v, ConfigurationTarget.Global).then(() => {
        this.refresh();
      });
      window.showInformationMessage('添加成功');
    });
  };
  
  // 项目接口的公共目录，减少生成接口时目录选择的层级
  public addApiFloder: () => void = () => {
    const apiFloderPath = workspace.getConfiguration('apifoxGen', workspace.workspaceFolders![0].uri).get<string>('apiFloderPath');
    window.showInputBox({
      placeHolder: '填写项目接口目录路径',
      value: apiFloderPath,
    }).then(v => {
      if (v === undefined) {
        return;
      }
      const apifoxConfig = workspace.getConfiguration('apifoxGen', workspace.workspaceFolders![0].uri);
      apifoxConfig.update('apiFloderPath', v, ConfigurationTarget.WorkspaceFolder);
      window.showInformationMessage('添加成功');
    });
  };
  
  // 项目后端接口公共的路径，减少生成TS类型变量的长度
  public baseURL: () => void = () => {
    const baseURL = workspace.getConfiguration('apifoxGen', workspace.workspaceFolders![0].uri).get<string>('baseURL');
    window.showInputBox({
      placeHolder: '填写项目接口目录路径',
      value: baseURL,
    }).then(v => {
      if (v === undefined) {
        return;
      }
      const apifoxConfig = workspace.getConfiguration('apifoxGen', workspace.workspaceFolders![0].uri);
      apifoxConfig.update('baseURL', v, ConfigurationTarget.WorkspaceFolder);
      window.showInformationMessage('添加成功');
    });
  };
  
  // 生成接口
  public genCode: (node: ListItem) => void = (node) => {
    if (!workspace.workspaceFolders) {
      window.showWarningMessage('请先打开需要生成接口的项目');
      return;
    }
    const apiFloderPath = workspace.getConfiguration('apifoxGen', workspace.workspaceFolders![0].uri).get<string>('apiFloderPath');
    window.showOpenDialog({
      defaultUri: Uri.joinPath(workspace.workspaceFolders[0].uri, apiFloderPath ?? '')
    }).then((uri: any) => {
      if (!uri?.[0]) {
        return;
      }
      const absolutePath = uri?.[0]?.fsPath;
      const floderData = node.getFloderData;
      generate(floderData?.projectId, node?.id as string, absolutePath);
    });
  };
  
  getTreeItem(element: ListItem) {
    const elementFloderData = element?.getFloderData as TApiFloder;
    // 赋值接口id
    element.id = elementFloderData.key.split('.')[1];
    if (elementFloderData.type === 'apiFloderRoot') {
      element.contextValue = 'apiFloderRoot';
    }
    if (elementFloderData.type === 'apiDetailFolder') {
      element.iconPath = new ThemeIcon("folder");
    }
    if (elementFloderData.type === 'apiDetail') {
      // 用于识别api详情这一列，在packagejson
      element.contextValue = 'apiDetail';
      if (elementFloderData?.api) {
        switch (elementFloderData.api.method.toLocaleUpperCase() as METHOD) {
          case 'GET': {
            element.iconPath = {
              light: path.join(__dirname, '..', 'media', 'get.svg'),
              dark: path.join(__dirname, '..', 'media', 'get.svg'),
            };
            break;
          }
          case 'POST': {
            element.iconPath = {
              light: path.join(__dirname, '..', 'media', 'post.svg'),
              dark: path.join(__dirname, '..', 'media', 'post.svg'),
            };
            break;
          }
          case 'PUT': {
            element.iconPath = {
              light: path.join(__dirname, '..', 'media', 'put.svg'),
              dark: path.join(__dirname, '..', 'media', 'put.svg'),
            };
            break;
          }
          case "DELETE": {
            element.iconPath = {
              light: path.join(__dirname, '..', 'media', 'del.svg'),
              dark: path.join(__dirname, '..', 'media', 'del.svg'),
            };
            break;
          }
          case "PATCH": {
            element.iconPath = {
              light: path.join(__dirname, '..', 'media', 'patch.svg'),
              dark: path.join(__dirname, '..', 'media', 'patch.svg'),
            };
            break;
          }
        }
        
      }
    }
    return element;
  }
  
  getChildren(element?: ListItem | undefined): ProviderResult<ListItem[]> {
    const cookie = workspace.getConfiguration('apifoxGen').get<string>('cookie');
    if (!cookie) {
      return [];
    }
    const projectTree = this.globalState.get<TApiFloder[]>('projectsTree') ?? [];
    if (projectTree.length === 0) {
      return [];
    }

    const elementFloderData = element?.getFloderData;
    
    if (elementFloderData?.type === 'apiCase' || elementFloderData?.type === 'apiDetail') {
      return []; 
    }
    if (elementFloderData?.type === 'apiFloderRoot' || elementFloderData?.type === 'apiDetailFolder') {
      return elementFloderData?.children.map((item) => {
        item.projectId = elementFloderData.projectId;
        const collapsibleState = item.type === 'apiDetail' ? TreeItemCollapsibleState.None : TreeItemCollapsibleState.Collapsed;
        return new ListItem(item.name, collapsibleState, item);
      });
    }
    
    return projectTree.map(item => new ListItem(item.name, TreeItemCollapsibleState.Collapsed, item));
  }
}

export class ListItem extends TreeItem {
  private floderData: TApiFloder;
  
  get getFloderData() {
    return this.floderData;
  }
  
  constructor(label: string, collapsibleState: TreeItemCollapsibleState, floderData: TApiFloder) {
    super(label, collapsibleState);
    this.floderData = floderData;
  }
}