export type TokenType =
  | 'NUMBER' | 'STRING' | 'BOOLEAN' | 'IDENT'
  | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'COMMA' | 'COLON' | 'ARROW'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH'
  | 'EQ' | 'NEQ' | 'GTE' | 'LTE' | 'GT' | 'LT'
  | 'AND' | 'OR' | 'NOT'
  | 'ASSIGN' | 'PLUS_ASSIGN' | 'MINUS_ASSIGN' | 'STAR_ASSIGN' | 'SLASH_ASSIGN'
  | 'STATEMENT_END' | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

const KEYWORDS: Record<string, 'BOOLEAN'> = { true: 'BOOLEAN', false: 'BOOLEAN' };

export class ExpressionSyntaxError extends Error {}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = source.length;

  const push = (type: TokenType, value: string, pos: number) => tokens.push({ type, value, pos });

  while (i < n) {
    const ch = source[i];

    if (ch === '\n' || ch === ';') {
      // Collapse consecutive separators into one STATEMENT_END
      if (tokens[tokens.length - 1]?.type !== 'STATEMENT_END') push('STATEMENT_END', ch, i);
      i++;
      continue;
    }

    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }

    // Line comment
    if (ch === '/' && source[i + 1] === '/') {
      while (i < n && source[i] !== '\n') i++;
      continue;
    }

    if (ch === '"' || ch === "'") {
      const quote = ch;
      const start = i;
      i++;
      let value = '';
      while (i < n && source[i] !== quote) {
        if (source[i] === '\\' && i + 1 < n) { value += source[i + 1]; i += 2; continue; }
        value += source[i];
        i++;
      }
      if (source[i] !== quote) throw new ExpressionSyntaxError(`Unterminated string at position ${start}`);
      i++;
      push('STRING', value, start);
      continue;
    }

    if (/[0-9]/.test(ch)) {
      const start = i;
      while (i < n && /[0-9.]/.test(source[i])) i++;
      push('NUMBER', source.slice(start, i), start);
      continue;
    }

    if (/[a-zA-Z_$]/.test(ch)) {
      const start = i;
      while (i < n && /[a-zA-Z0-9_$]/.test(source[i])) i++;
      const word = source.slice(start, i);
      const kw = KEYWORDS[word];
      push(kw || 'IDENT', word, start);
      continue;
    }

    const two = source.slice(i, i + 2);
    if (two === '==') { push('EQ', two, i); i += 2; continue; }
    if (two === '!=') { push('NEQ', two, i); i += 2; continue; }
    if (two === '>=') { push('GTE', two, i); i += 2; continue; }
    if (two === '<=') { push('LTE', two, i); i += 2; continue; }
    if (two === '&&') { push('AND', two, i); i += 2; continue; }
    if (two === '||') { push('OR', two, i); i += 2; continue; }
    if (two === '=>') { push('ARROW', two, i); i += 2; continue; }
    if (two === '+=') { push('PLUS_ASSIGN', two, i); i += 2; continue; }
    if (two === '-=') { push('MINUS_ASSIGN', two, i); i += 2; continue; }
    if (two === '*=') { push('STAR_ASSIGN', two, i); i += 2; continue; }
    if (two === '/=') { push('SLASH_ASSIGN', two, i); i += 2; continue; }

    switch (ch) {
      case '(': push('LPAREN', ch, i); i++; continue;
      case ')': push('RPAREN', ch, i); i++; continue;
      case '{': push('LBRACE', ch, i); i++; continue;
      case '}': push('RBRACE', ch, i); i++; continue;
      case ',': push('COMMA', ch, i); i++; continue;
      case ':': push('COLON', ch, i); i++; continue;
      case '+': push('PLUS', ch, i); i++; continue;
      case '-': push('MINUS', ch, i); i++; continue;
      case '*': push('STAR', ch, i); i++; continue;
      case '/': push('SLASH', ch, i); i++; continue;
      case '>': push('GT', ch, i); i++; continue;
      case '<': push('LT', ch, i); i++; continue;
      case '=': push('ASSIGN', ch, i); i++; continue;
      case '!': push('NOT', ch, i); i++; continue;
      default:
        throw new ExpressionSyntaxError(`Unexpected character '${ch}' at position ${i}`);
    }
  }

  push('EOF', '', n);
  return tokens;
}
