import { Injectable, Logger } from '@nestjs/common';

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** What the model returns: whether the question is about Veyro / work management, the answer, and which given sources it used (1-based). */
export interface AiGenerateResult {
  inScope: boolean;
  answer: string;
  sourcesUsed: number[];
}

/** A function the model may ask us to run. Declared per request; the model only ever sees this description. */
export interface AiToolDeclaration {
  name: string;
  description: string;
  parameters: object;
}

/** The model asking for a function to be run. `args` is untrusted input: the tool validates it. */
export interface AiToolCall {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

/** What generate() returns when the model wants tools run first. `modelTurn` is the provider's own message, sent back unchanged. */
export interface AiToolRequest {
  toolCalls: AiToolCall[];
  modelTurn: unknown;
}

/** One step of the conversation sent to the model: a chat message, the model's tool request, or our tool results. */
export type AiTurn =
  | AiChatMessage
  | { role: 'tool-request'; modelTurn: unknown }
  | { role: 'tool-result'; results: { id?: string; name: string; result: object }[] };

export const EMBEDDING_DIMS = 768;
const TIMEOUT_MS = 20_000;
const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBED_BATCH = 50;
const API = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * The only place that talks to the model provider (Gemini REST, plain fetch, no SDK). The key and models come from the
 * environment at call time, so tests swap the whole class for a fake, like StripeService.
 */
@Injectable()
export class AiGateway {
  private readonly logger = new Logger(AiGateway.name);

  isConfigured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  /**
   * Throws on any provider failure; the caller refunds the quota and answers 502. With `tools`, the model may answer with a
   * tool request instead of text: the caller runs the tools and calls again with the results appended to `turns`.
   */
  async generate(system: string, turns: AiTurn[], tools?: AiToolDeclaration[]): Promise<AiGenerateResult | AiToolRequest> {
    const json = await this.post(process.env.AI_MODEL || DEFAULT_MODEL, 'generateContent', {
      systemInstruction: { parts: [{ text: system }] },
      contents: turns.map((t) =>
        t.role === 'tool-request'
          ? t.modelTurn
          : t.role === 'tool-result'
            ? { role: 'user', parts: t.results.map((r) => ({ functionResponse: { ...(r.id ? { id: r.id } : {}), name: r.name, response: r.result } })) }
            : { role: t.role === 'assistant' ? 'model' : 'user', parts: [{ text: t.content }] },
      ),
      ...(tools?.length ? { tools: [{ functionDeclarations: tools }] } : {}),
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 800,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { inScope: { type: 'BOOLEAN' }, answer: { type: 'STRING' }, sourcesUsed: { type: 'ARRAY', items: { type: 'INTEGER' } } },
          required: ['inScope', 'answer'],
        },
      },
    });
    return this.parse(json);
  }

  /**
   * Turns texts into 768-number vectors. 'document' for text we store, 'query' for a user question: the provider tunes the
   * vectors differently for each so a question lands near the passage that answers it.
   */
  async embed(texts: string[], kind: 'document' | 'query'): Promise<number[][]> {
    const model = process.env.AI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL;
    const out: number[][] = [];
    for (let i = 0; i < texts.length; i += EMBED_BATCH) {
      const batch = texts.slice(i, i + EMBED_BATCH);
      const json = await this.post(model, 'batchEmbedContents', {
        requests: batch.map((text) => ({
          model: `models/${model}`,
          content: { parts: [{ text }] },
          taskType: kind === 'query' ? 'RETRIEVAL_QUERY' : 'RETRIEVAL_DOCUMENT',
          outputDimensionality: EMBEDDING_DIMS,
        })),
      });
      const vectors: unknown = json?.embeddings?.map((e: any) => e?.values);
      // Provider output is untrusted: a wrong count or size would corrupt the table or break the search query.
      if (!Array.isArray(vectors) || vectors.length !== batch.length || !vectors.every((v) => Array.isArray(v) && v.length === EMBEDDING_DIMS && v.every((n) => typeof n === 'number'))) {
        throw new Error('the embedding answer has the wrong shape');
      }
      out.push(...(vectors as number[][]));
    }
    return out;
  }

  private async post(model: string, method: string, body: object): Promise<any> {
    const payload = JSON.stringify(body);
    // One retry for the failures that usually pass on the second try: rate limit, provider 5xx, network or timeout.
    for (let attempt = 1; ; attempt++) {
      try {
        const res = await fetch(`${API}/${model}:${method}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY ?? '' },
          body: payload,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.status === 429 || res.status >= 500) throw new Error(`provider answered ${res.status}`);
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw Object.assign(new Error(`provider rejected the request (${res.status}): ${detail?.error?.message ?? ''}`), { final: true });
        }
        return await res.json();
      } catch (err) {
        const final = (err as { final?: boolean }).final;
        this.logger.warn(`Gemini ${method} failed (attempt ${attempt}): ${(err as Error).message}`);
        if (final || attempt >= 2) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  private parse(json: any): AiGenerateResult | AiToolRequest {
    const content = json?.candidates?.[0]?.content;
    const calls = (content?.parts ?? []).filter((p: any) => p?.functionCall?.name);
    if (calls.length) {
      return { toolCalls: calls.map((p: any) => ({ id: p.functionCall.id, name: String(p.functionCall.name), args: p.functionCall.args && typeof p.functionCall.args === 'object' ? p.functionCall.args : {} })), modelTurn: content };
    }
    const text = content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      throw new Error(`no answer (${json?.promptFeedback?.blockReason ?? json?.candidates?.[0]?.finishReason ?? 'empty'})`);
    }
    let out: any;
    try {
      out = JSON.parse(text);
    } catch {
      throw new Error('the model did not return valid JSON');
    }
    // Model output is untrusted input: check the shape before anything else uses it.
    if (typeof out?.inScope !== 'boolean' || typeof out?.answer !== 'string') {
      throw new Error('the model answer has the wrong shape');
    }
    const sourcesUsed = Array.isArray(out.sourcesUsed) ? out.sourcesUsed.filter((n: unknown) => Number.isInteger(n)) : [];
    return { inScope: out.inScope, answer: out.answer.trim(), sourcesUsed };
  }
}
