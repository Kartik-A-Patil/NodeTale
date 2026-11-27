export type Expr =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'identifier'; name: string }
  | { kind: 'unary'; op: '!' | '-'; expr: Expr }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '%' | '==' | '!=' | '>' | '<' | '>=' | '<=' | '&&' | '||'; left: Expr; right: Expr }
  | { kind: 'ternary'; test: Expr; then: Expr; otherwise: Expr }
  | { kind: 'member'; object: Expr; property: string }
  | { kind: 'index'; object: Expr; index: Expr }
  | { kind: 'call'; callee: string; args: Expr[] }
  | { kind: 'arrow'; params: string[]; body: Expr }
  | { kind: 'object'; entries: Array<[string, Expr]> };

/** `pos`: where the statement starts in its source, for the debugger's line numbers. */
export type Stmt = (
  | { kind: 'assign'; name: string; op: '=' | '+=' | '-=' | '*=' | '/='; value: Expr }
  | { kind: 'if'; test: Expr; then: Stmt[]; otherwise?: Stmt[] }
  | { kind: 'expr'; expr: Expr }
) & { pos?: number };
