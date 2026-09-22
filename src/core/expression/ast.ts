export type Expr =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'unary'; op: '!' | '-'; expr: Expr }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '==' | '!=' | '>' | '<' | '>=' | '<=' | '&&' | '||'; left: Expr; right: Expr }
  | { kind: 'call'; callee: string; args: Expr[] }
  | { kind: 'arrow'; params: string[]; body: Expr }
  | { kind: 'object'; entries: Array<[string, Expr]> };

export type Stmt =
  | { kind: 'assign'; name: string; op: '=' | '+=' | '-=' | '*=' | '/='; value: Expr }
  | { kind: 'expr'; expr: Expr };
