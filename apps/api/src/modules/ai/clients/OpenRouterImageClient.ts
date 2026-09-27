import { isRecord, OpenRouterPictures, PictureCallError, pinnedProvider, reportedCost, servedBy } from './pictureTransport.js';
import { PictureImageClient } from './PictureImageClient.js';

import type { DrawnPicture } from './PictureImageClient.js';
import type { PictureSettings } from '../ai.config.js';
import type { PinnedProvider } from './pictureTransport.js';

/** How long to wait before each read of a call's cost when the answer did not carry it: OpenRouter files it a moment later. */
const COST_LOOKUP_DELAYS_MS: readonly number[] = [1000, 2000];

/**
 * The image model, through OpenRouter's `/images` (`0066`): Gemini 3.1 Flash
 * Lite Image on Google Vertex, 4:3, at 1K — the only resolution Vertex bills
 * and accepts. The file comes back as `data[0].b64_json` and is returned as
 * decoded, untouched: Google's C2PA manifest is bound to those exact bytes.
 *
 * Built by `AiModule` from `resolvePictureSettings`: null settings — the stub
 * provider, or no key — give a client that draws nothing.
 */
export class OpenRouterImageClient extends PictureImageClient {
  private readonly api: OpenRouterPictures | null;
  private readonly provider: PinnedProvider | null;

  constructor(
    private readonly settings: PictureSettings | null,
    secrets: readonly string[],
    fetchImpl?: typeof fetch,
    private readonly lookupDelaysMs: readonly number[] = COST_LOOKUP_DELAYS_MS
  ) {
    super();
    this.api = settings ? new OpenRouterPictures(settings.apiKey, secrets, fetchImpl) : null;
    this.provider = settings ? pinnedProvider(settings.imageProviders) : null;
  }

  get isAvailable(): boolean {
    return this.api !== null;
  }

  async draw(prompt: string, signal?: AbortSignal): Promise<DrawnPicture> {
    if (!this.api || !this.provider || !this.settings) {
      throw new PictureCallError('No image model configured', null);
    }

    const model = this.settings.imageModel;
    const answer = await this.api.post('/images', { aspect_ratio: '4:3', model, n: 1, prompt, resolution: '1K' }, this.provider, signal);
    const bytes = decodeImage(answer.body);
    const generationId = isRecord(answer.body) && typeof answer.body['id'] === 'string' ? answer.body['id'] : null;
    const reported = reportedCost(answer.body);
    const looked = reported === null && generationId !== null ? await this.lookUp(generationId, signal) : null;

    return {
      bytes,
      contentType: contentTypeOf(bytes),
      costUsd: reported ?? looked?.costUsd ?? null,
      generationId,
      model,
      provider: servedBy(answer) ?? looked?.provider ?? null
    };
  }

  /**
   * What OpenRouter filed for the call, read a few times: the answer does not
   * always carry its cost, and the monthly cap is a sum of costs.
   */
  private async lookUp(id: string, signal?: AbortSignal): Promise<{ readonly costUsd: number | null; readonly provider: string | null } | null> {
    for (const delay of this.lookupDelaysMs) {
      await new Promise(resolve => setTimeout(resolve, delay));

      const data = await this.api
        ?.get(`/generation?id=${encodeURIComponent(id)}`, signal)
        .then(answer => (isRecord(answer.body) && isRecord(answer.body['data']) ? answer.body['data'] : null))
        .catch(() => null);
      const cost = data?.['total_cost'];

      if (typeof cost === 'number' && Number.isFinite(cost)) {
        return { costUsd: cost, provider: typeof data?.['provider_name'] === 'string' ? data['provider_name'] : null };
      }
    }

    return null;
  }
}

/** The file in `data[0].b64_json`, decoded. A missing or empty one is a failed call. */
function decodeImage(body: unknown): Uint8Array {
  const data = isRecord(body) && Array.isArray(body['data']) ? (body['data'] as unknown[]) : [];
  const first = data[0];
  const encoded = isRecord(first) && typeof first['b64_json'] === 'string' ? first['b64_json'] : '';
  const bytes = new Uint8Array(Buffer.from(encoded.startsWith('data:') ? encoded.slice(encoded.indexOf(',') + 1) : encoded, 'base64'));

  if (bytes.length === 0) {
    throw new PictureCallError('OpenRouter /images answered with no image', null);
  }

  return bytes;
}

/** The file's type from its first bytes — what it is, not what anybody said it is. */
function contentTypeOf(bytes: Uint8Array): DrawnPicture['contentType'] {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }

  if (Buffer.from(bytes.subarray(0, 4)).toString('latin1') === 'RIFF' && Buffer.from(bytes.subarray(8, 12)).toString('latin1') === 'WEBP') {
    return 'image/webp';
  }

  throw new PictureCallError('OpenRouter /images answered with a file that is not a picture', null);
}
