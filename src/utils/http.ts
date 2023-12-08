import { workspace, window } from 'vscode';
import axios from 'axios';

export type TProject = {
  id: string
  name: string
};

axios.interceptors.request.use(
  (config) => {
    const cookie = workspace.getConfiguration('apifoxGen').get<string>('cookie');
    const clientVersion = workspace.getConfiguration('apifoxGen').get<string>('clientVersion');
    
    if (cookie === '') {
      window.showWarningMessage('请先配置cookie');
      return Promise.reject(new Error('请先配置cookie'));
    }
    
    config.headers.Authorization = cookie;
    config.headers['X-Client-Version'] = clientVersion;
    
    return config;
  },
  (err) => {
    return Promise.reject(err);
  });

// 获取个人apifox所有项目列表
export async function getProjects() {
  try {
    const res = await axios.get('https://api.apifox.com/api/v1/user-projects?locale=zh-CN');
    return res?.data?.data?.map((item: TProject) => ({ id: String(item.id), name: item.name }));
  } catch (e) {
    throw e;
  }
}

// 获取某个项目下的所有接口
export async function getInterfaceById(id: string) {
  const res = await axios.get('https://api.apifox.cn/api/v1/api-details?locale=zh-CN', {
    headers: {
      'X-Project-Id': id
    }
  });
  
}

export type METHOD = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

export type TApiFloder = {
  children: TApiFloder[],
  name: string,
  type: 'apiDetailFolder' | 'apiDetail' | 'apiCase' | 'apiFloderRoot'
  key: string,
  api?: {
    method: METHOD
  },
  projectId: string
} & TProject;

// 获取单个项目的文件目录
export async function getProjectTreeFloderNames(id: string): Promise<TApiFloder[]> {
  const res = await axios.get('https://api.apifox.com/api/v1/api-tree-list?locale=zh-CN', {
    headers: {
      'X-Project-Id': id
    }
  });
  const { data } = res?.data ?? {};
  return data;
}

// 获取接口详细数据
export async function getApiDetail(projectid: string, interfaceid: string) {
  const res = await axios.get('https://api.apifox.cn/api/v1/api-details?locale=zh-CN', {
    headers: {
      'X-Project-Id': projectid
    }
  });
  
  const { data } = res?.data ?? {};
  const itface = data.find((item: any) => String(item.id) === interfaceid);
  if (!itface) {
    window.showWarningMessage('接口详情请求失败');
  }
  return itface;
}

export async function getApiSchemas(projectid: string) {
  const res = await axios.get('https://api.apifox.com/api/v1/api-schemas?locale=zh-CN', {
    headers: {
      'X-Project-Id': projectid
    }
  });
  
  const { data } = res?.data ?? {};
  return data;
}