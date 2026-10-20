import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

const parser = unified().use(remarkParse).use(remarkGfm).use(remarkMath);
/** Normalize common provider TeX delimiters without modifying fenced/inline code. */
export function normalizeMathDelimiters(text: string) {
  if (!/\\[()[\]]/.test(text)) return text;
  // Code can be nested inside lists and blockquotes. Protect AST source ranges
  // rather than guessing fences line by line, including partially streamed code.
  const ranges: [number, number][] = [];
  function visit(node: { type: string; position?: { start: { offset?: number }; end: { offset?: number } }; children?: unknown[] }) {
    if (node.type === 'code' || node.type === 'inlineCode') {
      const start = node.position?.start.offset, end = node.position?.end.offset;
      if (start !== undefined && end !== undefined) ranges.push([start, end]);
    } else node.children?.forEach(child => visit(child as Parameters<typeof visit>[0]));
  }
  visit(parser.parse(text));
  const replacements: Record<string, string> = { '\\(': '$', '\\)': '$', '\\[': '\n\n$$\n', '\\]': '\n$$\n\n' };
  const convert = (value: string) => value.replace(/\\\\|\\[()[\]]/g, token => replacements[token] ?? token);
  let at = 0, out = '';
  for (const [start, end] of ranges) { out += convert(text.slice(at, start)) + text.slice(start, end); at = end; }
  return out + convert(text.slice(at));
}
export function richMarkdownBlocks(text: string): { key: number; text: string }[] {
  // Reference/footnote definitions have document-wide semantics. Render them in
  // one SDK document so IDs, reference resolution and numbering stay correct.
  if (/^ {0,3}\[[^\]\n]+\]:/m.test(text)) return [{ key: 0, text }];
  const tree = parser.parse(text);
  return tree.children.map((node, index) => ({ key: node.position?.start.offset ?? index, text: text.slice(node.position?.start.offset ?? 0, node.position?.end.offset ?? text.length) }));
}
