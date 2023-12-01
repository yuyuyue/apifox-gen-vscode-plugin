export function isEmptyObject(obj: object) {
  return Object.keys(obj).length === 0;
}

// 下划线转驼峰且首字母也大写
export function underscoreToCamelCase(underscoreStr: string) {
  const camelCaseStr = underscoreStr.replace(/_(.)/g, (match, char) => char.toUpperCase());
  const capitalizedStr = camelCaseStr.charAt(0).toUpperCase() + camelCaseStr.slice(1);
  return capitalizedStr;
}

export function firstLetterToLowercase(str: string) {
  if (str.length === 0) {
    return str; // 字符串为空，直接返回
  }
  
  const firstChar = str.charAt(0);
  const remainingChars = str.slice(1);
  const lowercaseFirstChar = firstChar.toLowerCase();
  
  return lowercaseFirstChar + remainingChars;
}