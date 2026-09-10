/**
 * The bytes and what they are, before the route turns them into a response.
 * The only stored bytes this API serves, and the only public route that does.
 */
export interface RecipeImageDto {
  readonly bytes: Buffer;
  readonly contentType: string;
}
