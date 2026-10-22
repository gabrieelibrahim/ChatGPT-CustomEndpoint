// Token counts as providers report them, whatever the API shape: OpenAI Chat Completions (prompt_tokens /
// completion_tokens), the Responses API and Anthropic Messages (input_tokens / output_tokens, with Anthropic's
// cache reads and writes counted as input). Nothing is estimated: a count the provider did not send stays undefined.
export type ReportedUsage = { input?: number; output?: number };
const count = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
export function readUsage(value: unknown): ReportedUsage | undefined {
  if (!value || typeof value !== 'object') return;
  const u = value as Record<string, unknown>;
  const cached = (count(u.cache_read_input_tokens) ?? 0) + (count(u.cache_creation_input_tokens) ?? 0);
  const prompt = count(u.prompt_tokens) ?? count(u.input_tokens);
  const input = prompt === undefined ? undefined : prompt + (u.prompt_tokens === undefined ? cached : 0);
  const output = count(u.completion_tokens) ?? count(u.output_tokens);
  return input === undefined && output === undefined ? undefined : { input, output };
}
