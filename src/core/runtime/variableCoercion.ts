import { Variable } from '../../types';

// ARRAY/OBJECT values stay in their {elementType, elements}/{keys} wrapper shape
// (not unwrapped to plain JS) since the whitelisted arrayXxx/objectXxx helpers in
// logicService.ts both consume and return that exact shape.
export const toJSValue = (variable: Variable): unknown => variable.value;

export const applyScopeToVariables = (variables: Variable[], scope: Record<string, unknown>): Variable[] => {
  return variables.map((v) => (v.name in scope ? { ...v, value: scope[v.name] as Variable['value'] } : v));
};
