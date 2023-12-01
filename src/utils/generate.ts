import { workspace } from 'vscode';
import { getApiDetail, getApiSchemas } from './http';
import { isEmptyObject, underscoreToCamelCase, firstLetterToLowercase } from './util';
import fs from 'fs';

// 在Query中的请求参数
const PARAMS_METHOD = ['GET', 'DELETE'];

const PATH_REGX = /\{\w+\}/g;

let hasTypedRef: any[] = [];

const API_TO_TS = {
  'array': 'string[]',
  'integer': 'number',
  'number': 'number',
  'file': 'Blob',
  'string': 'string'
} as const;

const JSON_SCHEMA_ROOT = '__root__';

export function generate(projectId: string, interfaceId: string, path: string) {
  Promise.all(
    [
      getApiDetail(projectId, interfaceId),
      getApiSchemas(projectId)
    ]
  ).then(([detail, schemas]) => {
    hasTypedRef = [];
    const { reqTName, reqTypeStr } = generateRequestType(detail, schemas);
    const { resTName, resTypeStr } = generateResponseType(detail, schemas);
    const funStr = generateAxiosFunc(detail, reqTName, resTName);
    
    const fileStr = reqTypeStr + resTypeStr + funStr;
    let hasFile = fs.existsSync(path);
    try {
      if (!hasFile) {
        fs.writeFileSync(path, "import http from './http'", 'utf-8');
      }
      fs.appendFileSync(path, fileStr, 'utf-8');
    } catch (err) {
      throw new Error('数据写入错误');
    }
  });
}

function getTNameByPathAndMethod(path: string, method: string) {
  const baseURL = workspace.getConfiguration('apifoxGen', workspace.workspaceFolders![0].uri).get<string>('baseURL') ?? '';
  const regex = new RegExp(`^${baseURL}`);
  return path.replace(regex, '')
    .replace(PATH_REGX, '')
    .replace('_', '/')
    .split('/')
    .map((str: string) => str.charAt(0).toUpperCase() + str.slice(1))
    .join('') + underscoreToCamelCase(method);
}

function generateRequestType(data: any, schemas: any): {
  reqTypeStr: string;
  reqTName: string
} {
  const { method, path, requestBody, parameters } = data;
  
  const reqTName = getTNameByPathAndMethod(path, method);
  
  if (PARAMS_METHOD.includes(String(method).toLocaleUpperCase())) {
    return generateParamsRequestType(parameters?.query, reqTName);
  } else {
    return generateBodyRequestType(requestBody, reqTName, schemas);
  }
}

function generateParamsRequestType(params: any[] = [], name: string) {
  const reqTName = `I${name}ParamsReq`;
  let reqTypeStr = `\ninterface ${reqTName} {`;
  const type = generateParametersType(params);
  if (type === '') {
    return {
      reqTypeStr: '',
      reqTName: ''
    };
  } else {
    reqTypeStr += generateParametersType(params);
    reqTypeStr += `\n}`;
  }
 
  return {
    reqTypeStr,
    reqTName
  };
}

function mappingApiTypeToTsType(item: any, level: number = 1) {
  const blackRetract = ' '.repeat(level * 2);
  const desc = `${item.description ? ` // ${item.description}` : ''}`;
  const type = `\n${blackRetract}${item.name}${item.required ? '' : '?'}: ${API_TO_TS[item.type as keyof typeof API_TO_TS] ?? item.type}${desc}`;
  return type;
}

// 生成常规params类型的ts
function generateParametersType(params: any) {
  let type = '';
  params?.forEach((item: any) => type += mappingApiTypeToTsType(item));
  return type;
}

function findRefsType(ref: string, schemas: any) {
  const refid = ref?.split('/')?.pop();
  const schema = schemas?.find((item: any) => String(item.id) === refid);
  return schema;
}

// jsonschema类型生成type
function generateJsonSchemaType(jsonSchema: any, schemas: any, level: number = 1, isParentArrayType: boolean = false) {
  const { required, properties = {}, ['x-apifox-refs']: refs, items } = jsonSchema;
  let refTypes: any[] = [];
  let typeStr = '';
  let isSimpleType = false; // 是否是简单类型，只有一层，外层类型不需要对象形式，需要一个标识，其他处理逻辑相同
  
  if (!refs && isEmptyObject(properties) && !items) {
    return {
      refTypes,
      typeStr,
      isSimpleType
    };
  }
  
  // 直接引用数据模型的方式，本质是当前对象上加很多项，相当于解构，生成type也给解构了，直接加到properties上
  if (refs && !isEmptyObject(refs)) {
    const keys = Object.keys(refs);
    keys.forEach((k) => {
      const schema = findRefsType(refs[k]?.$ref, schemas);
      const { properties: refProperties } =  schema?.jsonSchema;
      const names = Object.keys(refProperties);
      names.forEach((name) => {
        properties[name] = refProperties[name];
      });
    });
  }
  
  const properKeys = Object.keys(properties);
  // 单层
  if (properKeys.length === 0 && level === 1) {
    isSimpleType = true;
    properties[JSON_SCHEMA_ROOT] = jsonSchema;
    properKeys.push(JSON_SCHEMA_ROOT);
  } else if (items) { // 单层数组的子项递归
    isSimpleType = true;
    properties[JSON_SCHEMA_ROOT] = items;
    properKeys.push(JSON_SCHEMA_ROOT);
  }
  properKeys.forEach((key) => {
    const item = properties[key];
    const isRequired = required?.includes(key) || key === JSON_SCHEMA_ROOT || item?.required;
    const blackRetract = isSimpleType ? '' : ' '.repeat(level * 2);
    const desc = isSimpleType ? '' : `${item.title ?  ` // ${item.title}` : ''}`;
    const propertyName = isSimpleType ? '' : `${key}: `;

    // 类型是引用模型类型
    if ('$ref' in item) {
      const schema = findRefsType(item.$ref, schemas);
      if (!schema) {
        return;
      }
      const { jsonSchema } = schema;
      // 生成refTypes需要
      const name = 'I' + underscoreToCamelCase(schema.name);
      jsonSchema.name = name;
      refTypes.push(jsonSchema);
      typeStr += `\n${blackRetract}${propertyName}${name}${desc}`;
      return;
    }
    
    // 类型是对象类型，需要递归处理
    if (item.type === 'object') {
      const { typeStr: objType, refTypes: objRefType } = generateJsonSchemaType(item, schemas, level + 1);
      typeStr += `\n${blackRetract}${propertyName}{${desc}`;
      typeStr += `${objType}`;
      typeStr += `\n${blackRetract}}`;
      
      refTypes = [...refTypes, ...objRefType];
      return;
    }
    
    // array类型需要判断子项的类型, 递归处理子类型
    if (item.type === 'array' && 'items' in item) {
      const { typeStr: arrayType, refTypes: arrayRefType } = generateJsonSchemaType(item, schemas, level + 1);
      typeStr += `\n${blackRetract}${propertyName}${arrayType?.replace(/\n/, '')}[]${desc}`;
      refTypes = [...refTypes, ...arrayRefType];
      return;
    }
    
    // 正常类型的情况
    item.name = key;
    item.required = isRequired;
    typeStr += `\n${blackRetract}${propertyName}${API_TO_TS[item.type as keyof typeof API_TO_TS] ?? item.type}${desc}`;
  });
  
  return {
    typeStr,
    refTypes,
    isSimpleType,
  };
}

function generateBodyRequestType(body: any, name: any, schemas: any) {
  const reqTName = `I${name}BodyReq`;
  let reqTypeStr = `\ninterface ${reqTName} {`;
  let extraRefTypes: any[] = [];
  let extraRefTypeStr = '';
  const { parameters = [], jsonSchema = {} } = body;
  
  let parametersType = '';
  if (parameters.length !== 0) {
    parametersType = generateParametersType(parameters);
    reqTypeStr += parametersType;
  }
  const { typeStr, refTypes, isSimpleType } = generateJsonSchemaType(jsonSchema, schemas);
  // 如果是空的，不生成接口
  if (typeStr === '' && parametersType === '') {
    return {
      reqTypeStr: '',
      reqTName: ''
    };
  }
  // 只有params的情况
  if (typeStr === '' && parametersType !== '') {
    reqTypeStr += '\n}';
  }
 
  if (isSimpleType) {
    reqTypeStr = `\ntype ${reqTName} = ${typeStr}`;
  } else {
    reqTypeStr += typeStr;
    reqTypeStr += `\n}`;
  }
  extraRefTypes = [...extraRefTypes, ...refTypes];
  
  while (extraRefTypes.length !== 0) {
    const jsonSchema = extraRefTypes.shift();
    if (hasTypedRef.includes(jsonSchema.name)) {
      continue;
    }
    hasTypedRef.push(jsonSchema.name);
    const { typeStr, refTypes, isSimpleType } = generateJsonSchemaType(jsonSchema, schemas);
    let refStr = '';
    if (isSimpleType) {
      refStr = `\ntype ${jsonSchema.name} = ${typeStr}`;
    } else {
      refStr += `\ninterface ${jsonSchema.name} {`;
      refStr += typeStr;
      refStr += `\n}`;
    }
    extraRefTypeStr += refStr;
    extraRefTypes = [...extraRefTypes, ...refTypes];
  }
  
  
  reqTypeStr = extraRefTypeStr + reqTypeStr;
  
  return {
    reqTypeStr,
    reqTName
  };
}

// 获取响应数据类型
function generateResponseType(data: any, schemas: any) {
  const { responses, path, method } = data;
  const jsonSchema = responses?.[0]?.jsonSchema;
  console.log(jsonSchema, 'jsonSchame');
  const pathName = getTNameByPathAndMethod(path, method);
  let resTName = `I${pathName}${underscoreToCamelCase(method)}Res`;
  let resTypeStr = `\ninterface ${resTName} {`;
  
  let extraRefTypes: any[] = [];
  let extraRefTypeStr = '';
  const { typeStr, refTypes, isSimpleType } = generateJsonSchemaType(jsonSchema, schemas);
  
  if (typeStr === '') {
    return {
      resTName: '',
      resTypeStr: ''
    };
  }
  
  if (isSimpleType) {
    resTypeStr = `\ntype ${resTName} = ${typeStr}`;
  } else {
    resTypeStr += typeStr;
    resTypeStr += `\n}`;
  }
  extraRefTypes = [...refTypes];
  
  while (extraRefTypes.length !== 0) {
    const jsonSchema = extraRefTypes.shift();
    if (hasTypedRef.includes(jsonSchema.name)) {
      continue;
    }
    hasTypedRef.push(jsonSchema.name);
    const { typeStr, refTypes  } = generateJsonSchemaType(jsonSchema, schemas);
    let refStr = '';
    if (isSimpleType) {
      refStr = `\ntype ${jsonSchema.name} = ${typeStr}`;
    } else {
      refStr += `\ninterface ${jsonSchema.name} {`;
      refStr += typeStr;
      refStr += `\n}`;
    }
    extraRefTypeStr += refStr;
    extraRefTypes = [...extraRefTypes, ...refTypes];
  }
  
  resTypeStr = extraRefTypeStr + resTypeStr;
  
  return { resTName, resTypeStr };
}

function generateAxiosFunc(data: any, reqTName: string, resTName: string) {
  const { method, path, name, id, parameters } = data;
  const fname = firstLetterToLowercase(getTNameByPathAndMethod(path, method));
  const baseURL = workspace.getConfiguration('apifoxGen', workspace.workspaceFolders![0].uri).get<string>('baseURL') ?? '';
  const regex = new RegExp(`^${baseURL}`);
  let interfacePath = path.replace(regex, '');
  let upperCaseMethod = String(method).toLocaleUpperCase();
  const descStr = `\n// ${name} ${id}`;
  let funStr = '';
  let paths = parameters?.path ?? [];
  // 有path参数
  if (PATH_REGX.test(interfacePath)) {
    interfacePath.replace(PATH_REGX, (a: string) => `$${a}`);
  }
  const paramStr = reqTName === '' ? '' : `params: ${reqTName}`;
  const pathStr = `${paths.length ? ', ' + paths.map((item: any) => `${item?.name}: string`).join(', ') : ''}`;
  const paramsConfigStr = reqTName === '' ? '' : `, ${PARAMS_METHOD.includes(upperCaseMethod) ? '{ params }' : 'params'}`;
  funStr += `\nexport const ${fname} = async (${paramStr}${pathStr}): Promise<${resTName === '' ? null : resTName}> => {`;
  funStr += `\n  const { data } = await http.${method}(\`${interfacePath}\`${paramsConfigStr})`;
  funStr += `\n  return data`;
  funStr += `\n}`;
  
  return descStr + funStr;
}