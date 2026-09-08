# 0010 — Illustrate recipes, label them as illustrations, keep them in the database

- **Status**: accepted
- **Date**: 2026-09-08
- **Project**: none (task, at the owner's report)

## Context

The owner asked for "photos of each meal, to illustrate and help". Nobody has cooked
these dishes: every recipe is generated, so there is no photograph of it and cannot be.
The meal page said as much in a comment — "an invented picture of it would be the most
convincing lie on the page" — and left the space to the four numbers a cook checks.

An image still helps. A plan is easier to scan with pictures, and "what is this dish"
is answered faster by one than by a name. The question is only what is honest.

The provider is the one already configured (Google), whose free tier allows text and
**zero** image generations; illustrations need billing on that project. That is the
owner's switch, so the feature has to be inert until it is thrown and correct once it is.

## Decision

**Generate an illustration per recipe, label it as one, and store it with the recipe.**

- **Illustrated, never "photographed".** The image model draws the dish from its name and
  ingredients. Every place it appears carries the label *Ilustración generada por IA* /
  *AI-generated illustration*. The label is a dictionary key, not a caption someone can
  forget: a screen that shows the image without it does not compile.
- **Per recipe, not per plan.** One image per `recipes` row, shared by every plan that
  uses it and gone when the recipe goes. Cost scales with distinct dishes, the same lever
  as generation (0006), not with users.
- **In the database.** A `recipe_images` row holds the bytes, resized to a phone-sized
  WebP. A few megabytes for the whole library; no second vendor, no token to provision,
  and the product still runs from a database URL alone. If the library ever makes this
  the wrong call, the route is the only thing that changes.
- **One public, immutable route.** `GET /recipes/:id/image` needs no session — a picture
  of grilled squid is not anyone's data — and is served with a year-long cache so the
  edge and the phone keep it. No recipe data travels with it, only the bytes.
- **After the plan, never before it.** Illustration is a background sweep: bounded per
  invocation after a generation, and swept by a cron for whatever is left. A plan is never
  delayed, and a failed image leaves a placeholder, not an error. The page is complete
  without the picture; the picture is the bonus.
- **Off by default.** `AI_ILLUSTRATIONS=false` until the owner enables billing. When off,
  nothing is called and nothing is stored.

## Alternatives considered

- **Stock photos by dish name.** Cheap and often the wrong dish; labelling a photo of
  someone else's paella as this plan's paella is the lie the comment warned about.
- **A blob store.** The idiomatic choice on the platform and the right one at scale;
  a second account, a token and a bucket for a few megabytes is not.
- **Ingredient photos too.** Two hundred generations for a shopping list that people read
  as text in a supermarket aisle. A category icon per ingredient gives the scanning
  benefit for nothing, and is the better next step if one is wanted.
- **Generating at plan time.** Ten seconds per image against a 300-second ceiling with
  forty dishes to draw. The plan would wait on its pictures.

## Consequences

- Text generation stays free-tier; illustrations cost roughly four cents each on the
  configured model, once, per distinct dish.
- The health-data boundary around the AI module covers the illustrator automatically —
  it lives in the same directory the boundary test scans — and its prompt is built from
  the recipe alone, which carries nothing about any person.
- Until billing is on, every screen renders exactly as it does today.
