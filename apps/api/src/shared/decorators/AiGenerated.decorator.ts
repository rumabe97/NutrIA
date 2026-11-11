import { Header } from '@nestjs/common';

/**
 * The machine-readable mark on a response that carries text a model wrote
 * (AI Act art. 50.2; `docs/legal/2026-11-11-lawyer-hour-brief.md` H7): the
 * assistant's answers, and the dishes — every recipe in the library was
 * written by a model, the seed included. One header, the same everywhere, so
 * that anything reading the API can tell without parsing a body.
 *
 * The page carries its own mark (`data-ai-generated` in the web app), and the
 * assistant's downloaded copy marks each answer (`generatedBy: 'ai'`). The
 * dish pictures carry C2PA instead, from the model's provider.
 */
export const AI_GENERATED_HEADER = 'AI-Generated';

export function AiGenerated(): MethodDecorator {
  return Header(AI_GENERATED_HEADER, 'true');
}
