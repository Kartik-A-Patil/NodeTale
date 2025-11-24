import { Variable, VariableType } from '../types';

export const evaluateCondition = (conditionStr: string | undefined, variables: Variable[]): boolean => {
  if (!conditionStr) return true;

  // Very basic parser: "variableName == value"
  // Supports ==, !=, >, <
  
  // 1. Find the variable
  const variable = variables.find(v => conditionStr.includes(v.name));
  if (!variable) return false;

  let operator = '';
  if (conditionStr.includes('==')) operator = '==';
  else if (conditionStr.includes('!=')) operator = '!=';
  else if (conditionStr.includes('>')) operator = '>';
  else if (conditionStr.includes('<')) operator = '<';

  if (!operator) return false;

  const parts = conditionStr.split(operator);
  const targetValueRaw = parts[1].trim();
  
  let targetValue: any = targetValueRaw;
  
  if (variable.type === VariableType.BOOLEAN) {
    targetValue = targetValueRaw === 'true';
  } else if (variable.type === VariableType.NUMBER) {
    targetValue = Number(targetValueRaw);
  } else {
    targetValue = targetValueRaw.replace(/['"]/g, '');
  }

  const currentValue = variable.value;

  switch (operator) {
    case '==': return currentValue === targetValue;
    case '!=': return currentValue !== targetValue;
    case '>': return Number(currentValue) > Number(targetValue);
    case '<': return Number(currentValue) < Number(targetValue);
    default: return false;
  }
};

export const replaceVariablesInText = (text: string, variables: Variable[]): string => {
  let processed = text;
  variables.forEach(v => {
    const regex = new RegExp(`{{${v.name}}}`, 'g');
    processed = processed.replace(regex, String(v.value));
  });
  return processed;
};
