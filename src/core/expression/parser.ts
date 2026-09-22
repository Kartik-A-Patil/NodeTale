import { Token, TokenType, tokenize, ExpressionSyntaxError } from './tokenizer';
import { Expr, Stmt } from './ast';

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  private at(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private advance(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType): Token {
    if (!this.at(type)) {
      throw new ExpressionSyntaxError(`Expected ${type} but got ${this.peek().type} ('${this.peek().value}') at position ${this.peek().pos}`);
    }
    return this.advance();
  }

  private skipStatementEnds() {
    while (this.at('STATEMENT_END')) this.advance();
  }

  // --- Statements (scripts) ---

  parseProgram(): Stmt[] {
    const statements: Stmt[] = [];
    this.skipStatementEnds();
    while (!this.at('EOF')) {
      statements.push(this.parseStatement());
      if (!this.at('EOF')) this.expectStatementEnd();
      this.skipStatementEnds();
    }
    return statements;
  }

  private expectStatementEnd() {
    if (this.at('STATEMENT_END') || this.at('EOF')) {
      this.skipStatementEnds();
      return;
    }
    throw new ExpressionSyntaxError(`Expected end of statement but got '${this.peek().value}' at position ${this.peek().pos}`);
  }

  private static readonly ASSIGN_OPS: Partial<Record<TokenType, '=' | '+=' | '-=' | '*=' | '/='>> = {
    ASSIGN: '=', PLUS_ASSIGN: '+=', MINUS_ASSIGN: '-=', STAR_ASSIGN: '*=', SLASH_ASSIGN: '/=',
  };

  private parseStatement(): Stmt {
    if (this.at('IDENT')) {
      const op = Parser.ASSIGN_OPS[this.peek(1).type];
      if (op) {
        const name = this.advance().value;
        this.advance();
        const value = this.parseExpression();
        return { kind: 'assign', name, op, value };
      }
    }
    return { kind: 'expr', expr: this.parseExpression() };
  }

  // --- Expressions (shared by conditions and scripts) ---

  parseExpression(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.at('OR')) {
      this.advance();
      left = { kind: 'binary', op: '||', left, right: this.parseAnd() };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseEquality();
    while (this.at('AND')) {
      this.advance();
      left = { kind: 'binary', op: '&&', left, right: this.parseEquality() };
    }
    return left;
  }

  private parseEquality(): Expr {
    let left = this.parseRelational();
    while (this.at('EQ') || this.at('NEQ')) {
      const op = this.advance().type === 'EQ' ? '==' : '!=';
      left = { kind: 'binary', op, left, right: this.parseRelational() };
    }
    return left;
  }

  private parseRelational(): Expr {
    let left = this.parseAdditive();
    while (this.at('GT') || this.at('LT') || this.at('GTE') || this.at('LTE')) {
      const tok = this.advance().type;
      const op = tok === 'GT' ? '>' : tok === 'LT' ? '<' : tok === 'GTE' ? '>=' : '<=';
      left = { kind: 'binary', op, left, right: this.parseAdditive() };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    while (this.at('PLUS') || this.at('MINUS')) {
      const op = this.advance().type === 'PLUS' ? '+' : '-';
      left = { kind: 'binary', op, left, right: this.parseMultiplicative() };
    }
    return left;
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    while (this.at('STAR') || this.at('SLASH')) {
      const op = this.advance().type === 'STAR' ? '*' : '/';
      left = { kind: 'binary', op, left, right: this.parseUnary() };
    }
    return left;
  }

  private parseUnary(): Expr {
    if (this.at('NOT')) {
      this.advance();
      return { kind: 'unary', op: '!', expr: this.parseUnary() };
    }
    if (this.at('MINUS')) {
      this.advance();
      return { kind: 'unary', op: '-', expr: this.parseUnary() };
    }
    return this.parseCallOrPrimary();
  }

  private parseCallOrPrimary(): Expr {
    const primary = this.parsePrimary();
    if (primary.kind === 'identifier' && this.at('LPAREN')) {
      this.advance();
      const args: Expr[] = [];
      if (!this.at('RPAREN')) {
        args.push(this.parseExpression());
        while (this.at('COMMA')) {
          this.advance();
          args.push(this.parseExpression());
        }
      }
      this.expect('RPAREN');
      return { kind: 'call', callee: primary.name, args };
    }
    return primary;
  }

  // Lookahead: does the upcoming `(...)` form an arrow function parameter list
  // (i.e. is it followed by `=>`)?
  private isArrowAhead(): boolean {
    let depth = 0;
    let i = this.pos;
    if (this.tokens[i]?.type !== 'LPAREN') return false;
    for (; i < this.tokens.length; i++) {
      const t = this.tokens[i].type;
      if (t === 'LPAREN') depth++;
      else if (t === 'RPAREN') {
        depth--;
        if (depth === 0) return this.tokens[i + 1]?.type === 'ARROW';
      } else if (t === 'EOF') {
        return false;
      }
    }
    return false;
  }

  private parsePrimary(): Expr {
    const tok = this.peek();

    if (tok.type === 'NUMBER') { this.advance(); return { kind: 'literal', value: Number(tok.value) }; }
    if (tok.type === 'STRING') { this.advance(); return { kind: 'literal', value: tok.value }; }
    if (tok.type === 'BOOLEAN') { this.advance(); return { kind: 'literal', value: tok.value === 'true' }; }

    // Bare single-param arrow: `x => expr`
    if (tok.type === 'IDENT' && this.peek(1).type === 'ARROW') {
      const param = this.advance().value;
      this.expect('ARROW');
      return { kind: 'arrow', params: [param], body: this.parseExpression() };
    }

    if (tok.type === 'IDENT') { this.advance(); return { kind: 'identifier', name: tok.value }; }

    if (tok.type === 'LPAREN' && this.isArrowAhead()) {
      this.advance();
      const params: string[] = [];
      if (!this.at('RPAREN')) {
        params.push(this.expect('IDENT').value);
        while (this.at('COMMA')) {
          this.advance();
          params.push(this.expect('IDENT').value);
        }
      }
      this.expect('RPAREN');
      this.expect('ARROW');
      return { kind: 'arrow', params, body: this.parseExpression() };
    }

    if (tok.type === 'LPAREN') {
      this.advance();
      const expr = this.parseExpression();
      this.expect('RPAREN');
      return expr;
    }

    if (tok.type === 'LBRACE') {
      this.advance();
      const entries: Array<[string, Expr]> = [];
      if (!this.at('RBRACE')) {
        entries.push(this.parseObjectEntry());
        while (this.at('COMMA')) {
          this.advance();
          entries.push(this.parseObjectEntry());
        }
      }
      this.expect('RBRACE');
      return { kind: 'object', entries };
    }

    throw new ExpressionSyntaxError(`Unexpected token '${tok.value}' at position ${tok.pos}`);
  }

  private parseObjectEntry(): [string, Expr] {
    const key = this.at('STRING') ? this.advance().value : this.expect('IDENT').value;
    this.expect('COLON');
    return [key, this.parseExpression()];
  }
}

export function parseExpression(source: string): Expr {
  const parser = new Parser(tokenize(source));
  const expr = parser.parseExpression();
  return expr;
}

export function parseScript(source: string): Stmt[] {
  return new Parser(tokenize(source)).parseProgram();
}

export { ExpressionSyntaxError } from './tokenizer';
