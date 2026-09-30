import { Controller, Get, Header, HttpCode, HttpStatus, Param, Post, StreamableFile } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags
} from '@nestjs/swagger';

import {
  DEFAULT_PAGE_SIZE,
  INGREDIENT_SORTS,
  MAX_PAGE_SIZE,
  RECIPE_CHECKS,
  RECIPE_PICTURE_FILTERS,
  RECIPE_SORTS,
  RECIPE_SOURCES,
  SORT_DIRECTIONS
} from 'core/entities/AdminQuery';
import { INGREDIENT_CATEGORIES, MEAL_SLOTS } from 'core/entities/Plan';

import { AdminCatalogueService } from '../services/index.js';
import { AcceptPictureCandidateDto, IngredientCatalogueQueryDto, PeriodQueryDto, RecipeCatalogueQueryDto } from '../dto/in/index.js';
import { CurrentUser, RateLimit, Roles, ZodBody } from '../../../shared/index.js';
import { PERIOD_PARAMETER, ZodQuery } from './ZodQuery.js';

import type {
  AdminCatalogueQualityDto,
  AdminIngredientsDto,
  AdminRecipeDto,
  AdminRecipesDto,
  PictureAcceptDto,
  PictureCandidateFileDto,
  PictureDiscardDto,
  PictureRemoveDto,
  PictureRetryDto
} from '../dto/out/index.js';
import type { SessionUser } from '../../../shared/index.js';

const PAGE_SIZE = { description: `1–${MAX_PAGE_SIZE}. ${DEFAULT_PAGE_SIZE} when absent.`, name: 'size', required: false, type: Number } as const;

/**
 * The shared catalogue, read only (`0068`): recipes and ingredients are
 * reference data and name nobody — no `created_by`, no id of a person
 * (`0028`). Editing it stays in the seed file in git.
 */
@ApiTags('admin')
@Controller('admin/catalogue')
@Roles('admin')
export class AdminCatalogueController {
  constructor(private readonly catalogue: AdminCatalogueService) {}

  @ApiOkResponse({
    description:
      'One page of recipes with macros per serving (the app’s own composition), allergens, picture state (with the reason it failed or was given back, when its cool-off ends, `pictureAcceptedByHand` — a ready picture the owner accepted by hand, the only kind that can be removed — and `pictureCandidate` — the allergen keys and catalogue ingredients the judge flagged on a rejected picture kept for review, and when it expires; never its address) and source, and the catalogue’s counts by slot and source and without a ready picture. 422 INVALID_INPUT for an unknown filter or sort.'
  })
  @ApiOperation({ summary: 'Search, filter, sort and page the recipes (0068)' })
  @ApiQuery({ description: 'Name contains, case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ enum: MEAL_SLOTS, name: 'slot', required: false })
  @ApiQuery({ description: 'An allergen key a served ingredient contains, e.g. `gluten`.', name: 'allergen', required: false, type: String })
  @ApiQuery({
    description: 'A picture state, or `accepted_by_hand`: the ready pictures the owner accepted against the judge (0072).',
    enum: RECIPE_PICTURE_FILTERS,
    name: 'picture',
    required: false
  })
  @ApiQuery({
    description:
      'Only the recipes a quality check finds — the ones Catálogo › Calidad counts (0071): `over_bound`, `uncosted`, `unserved`, `refusal_limit`, `over_cap`.',
    enum: RECIPE_CHECKS,
    name: 'check',
    required: false
  })
  @ApiQuery({ enum: RECIPE_SOURCES, name: 'source', required: false })
  @ApiQuery({ description: 'BCP 47, e.g. `es-ES`.', name: 'locale', required: false, type: String })
  @ApiQuery({ enum: RECIPE_SORTS, name: 'sort', required: false })
  @ApiQuery({ enum: SORT_DIRECTIONS, name: 'dir', required: false })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery(PAGE_SIZE)
  @Get('recipes')
  async recipes(@ZodQuery(RecipeCatalogueQueryDto) query: RecipeCatalogueQueryDto): Promise<AdminRecipesDto> {
    return this.catalogue.recipes(query);
  }

  @ApiNotFoundResponse({ description: 'No such recipe.' })
  @ApiOkResponse({
    description:
      'The recipe as the table lists it — macros per serving, allergens, picture state and `pictureCandidate` — `pictureUrl`, the public address of its picture when it is ready and null otherwise (never a candidate’s), and `ingredients`: its served ingredients with their grams for the recipe’s servings and their catalogue name, heaviest first. What a rejected picture is reviewed against. Nothing names a person.'
  })
  @ApiOperation({ summary: 'One recipe with its ingredients (0072)' })
  @Get('recipes/:id')
  async recipe(@Param('id') id: string): Promise<AdminRecipeDto> {
    return this.catalogue.recipe(id);
  }

  @ApiAcceptedResponse({
    description:
      'The picture was claimed and is being drawn: `{ status: "drawing" }`. One `picture.retried` row is in the trail. A candidate the dish held is deleted.'
  })
  @ApiConflictResponse({
    description:
      '`PICTURE_FLAG_OFF` (the dishPictures switch is off), `PICTURE_UNAVAILABLE` (no image, judge or store configured), `PICTURE_CAP_REACHED` (this month’s cap), `PICTURE_DRAWING` (already being drawn) or `PICTURE_NOT_RETRYABLE` (the picture is ready, or was never drawn).'
  })
  @ApiNotFoundResponse({ description: 'No such recipe.' })
  @ApiOperation({ summary: 'Retry a failed or given-back dish picture by hand, ignoring the cool-off (0066)' })
  @HttpCode(HttpStatus.ACCEPTED)
  @Post('recipes/:id/picture/retry')
  @RateLimit({ limit: 30, ttlSeconds: 3600 })
  async retryPicture(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<PictureRetryDto> {
    return this.catalogue.retryPicture(id, owner.id);
  }

  @ApiNotFoundResponse({ description: 'No candidate that can be looked at: none, an expired one, or no such recipe.' })
  @ApiOkResponse({
    content: { 'image/jpeg': { schema: { format: 'binary', type: 'string' } } },
    description:
      'The rejected picture this dish holds for review, byte for byte: `Content-Type: image/jpeg`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, no-store`. Reading it publishes nothing: only the owner’s acceptance does.'
  })
  @ApiOperation({ summary: 'The file of a dish’s rejected picture, kept privately for the owner’s review (0072)' })
  @ApiProduces('image/jpeg')
  @Get('recipes/:id/picture/candidate')
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async candidate(@Param('id') id: string): Promise<PictureCandidateFileDto> {
    const bytes = await this.catalogue.candidate(id);

    return new StreamableFile(bytes, { length: bytes.length, type: 'image/jpeg' });
  }

  @ApiNotFoundResponse({ description: 'No candidate that can be looked at: none, an expired one, or no such recipe.' })
  @ApiOkResponse({
    description:
      'The candidate’s file and its pointer are gone: `{ status: "discarded" }`. The dish stays failed and keeps its cool-off; one `picture.discarded` row is in the trail.'
  })
  @ApiOperation({ summary: 'Discard a dish’s rejected picture without drawing again (0072)' })
  @HttpCode(HttpStatus.OK)
  @Post('recipes/:id/picture/candidate/discard')
  @RateLimit({ limit: 30, ttlSeconds: 3600 })
  async discardCandidate(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<PictureDiscardDto> {
    return this.catalogue.discardCandidate(id, owner.id);
  }

  @ApiConflictResponse({
    description:
      '`PICTURE_FLAG_OFF` (the dishPictures switch is off), `PICTURE_UNAVAILABLE` (a store is not configured), `PICTURE_NO_CANDIDATE` (none that can be accepted — none, expired, its file gone, not the candidate whose `expiresAt` the body repeats, or the dish changed meanwhile: another tab, a retry, a discard), `PICTURE_ALLERGENS_MISMATCH` (the body does not repeat the allergens this candidate was flagged for) or `PICTURE_NOT_ACCEPTABLE` (the file is not a JPEG carrying its C2PA manifest). None says what the candidate stores.'
  })
  @ApiNotFoundResponse({ description: 'No such recipe.' })
  @ApiOkResponse({
    description:
      'The candidate is the dish’s picture: `{ status: "ready" }`. Its file was read again, found to carry its C2PA manifest (its presence, not its signature) and published byte for byte; one `picture.accepted` row, carrying the overridden allergen keys, was written in the same transaction. The month’s cap does not hold it: no model is called. 422 INVALID_INPUT when the body is not `{ allergens: string[], expiresAt: string }` — the list is required, empty when nothing was flagged, and `expiresAt` is the ISO instant the candidate was shown with.'
  })
  @ApiOperation({ summary: 'Accept a dish’s rejected picture against the judge, after seeing the allergens it flagged (0072)' })
  @HttpCode(HttpStatus.OK)
  @Post('recipes/:id/picture/candidate/accept')
  @RateLimit({ limit: 30, ttlSeconds: 3600 })
  async acceptCandidate(
    @Param('id') id: string,
    @ZodBody(AcceptPictureCandidateDto) body: AcceptPictureCandidateDto,
    @CurrentUser() owner: SessionUser
  ): Promise<PictureAcceptDto> {
    return this.catalogue.acceptCandidate(id, owner.id, body);
  }

  @ApiConflictResponse({
    description: '`PICTURE_NOT_REMOVABLE`: the dish has no picture accepted by hand — one the judge accepted cannot be removed.'
  })
  @ApiNotFoundResponse({ description: 'No such recipe.' })
  @ApiOkResponse({
    description:
      'The picture is no longer the dish’s: `{ status: "removed", fileDeleted }`. The dish is `failed` with the reason `owner_removed` and waits out its cool-off from now; one `picture.removed` row is in the trail. `fileDeleted` is false when the public file could not be deleted: no screen is given its address any more. True means the store deleted it: its cache may serve it for up to a minute more, and a browser that already fetched it keeps its copy.'
  })
  @ApiOperation({ summary: 'Remove a dish picture that was accepted by hand (0072)' })
  @HttpCode(HttpStatus.OK)
  @Post('recipes/:id/picture/remove')
  @RateLimit({ limit: 30, ttlSeconds: 3600 })
  async removePicture(@Param('id') id: string, @CurrentUser() owner: SessionUser): Promise<PictureRemoveDto> {
    return this.catalogue.removePicture(id, owner.id);
  }

  @ApiOkResponse({
    description:
      'What should be zero (recipes past the bound, without costable macros, meals with servings outside the bounds, dishes never served, recipes at the sweep’s refusal limit), what is worth a look (recipes over their meal’s cap by source, `oversized` rejections per day, pictures failed) and the rewrite sweep’s state. Counts only. 422 INVALID_INPUT for a period other than 7, 30 or 90.'
  })
  @ApiOperation({ summary: 'Catalogue quality and the rewrite sweep (0071)' })
  @ApiQuery(PERIOD_PARAMETER)
  @Get('quality')
  async quality(@ZodQuery(PeriodQueryDto) query: PeriodQueryDto): Promise<AdminCatalogueQualityDto> {
    return this.catalogue.quality(query);
  }

  @ApiOkResponse({
    description: 'One page of ingredients per 100 g, with allergens, countries and meal slots. 422 INVALID_INPUT for an unknown filter or sort.'
  })
  @ApiOperation({ summary: 'Search, filter, sort and page the ingredients (0068)' })
  @ApiQuery({ description: 'Name in any language, or slug, contains; case-insensitive.', name: 'q', required: false, type: String })
  @ApiQuery({ enum: INGREDIENT_CATEGORIES, name: 'category', required: false })
  @ApiQuery({ description: 'An allergen key the ingredient contains, e.g. `milk`.', name: 'allergen', required: false, type: String })
  @ApiQuery({ enum: INGREDIENT_SORTS, name: 'sort', required: false })
  @ApiQuery({ enum: SORT_DIRECTIONS, name: 'dir', required: false })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiQuery(PAGE_SIZE)
  @Get('ingredients')
  async ingredients(@ZodQuery(IngredientCatalogueQueryDto) query: IngredientCatalogueQueryDto): Promise<AdminIngredientsDto> {
    return this.catalogue.ingredients(query);
  }
}
