# How many messages a person may send the assistant in a fortnight

> **Purpose**: the numbers for **`assistantMessagesPerFortnight`**, the per-person allowance on
> the nutrition assistant of [project 023](../../projects/023-an-assistant-that-answers-from-your-plan/PRD.md)
> (criterion 9). The owner chose the shape on 2026-11-09: per fortnight, with premium's number
> the larger one. This file prices the unit, sets free and premium, decides whether premium's
> number should be finite, writes the `ALLOWANCE_BOUNDS` entry and says what the pitch may
> claim. It also names three things in the build that would change what the number means.
> **Audience**: the owner, and the lead who writes the constant. **Committed**: yes.
> **Maintained by**: agents draft, owner approves. Update it in the same change that moves the
> number.
>
> Evidential content rule: facts below are labelled **confirmed** (with how) or **estimated**
> (with the hypothesis), plus **given** for a figure the lead supplied on 2026-11-09 and this
> file does not re-derive. Written 2026-11-09 against `assistant-023-phase-2` at `7a3c6c19`.
> Nothing of this feature is reachable, so there is **no usage to read**. Every claim about
> demand is an estimate and says what it rests on, and § 7 lists what to read once there is
> usage.
>
> Companion to [`tiers-and-allowances.md`](./tiers-and-allowances.md) and
> [`dish-requests.md`](./dish-requests.md). This is the third allowance whose unit is a model
> call, after redos and dish requests. It is the first one where **the money is not what the
> number protects**.

## What this decides

**Free 20 a fortnight and premium 100. Premium's number is finite because one shared monthly
ceiling stops the assistant for everybody, not because anyone's messages cost much. Every
message a person sends counts, and the screen always shows the count and the date it resets.**

| | Value | Unit |
| --- | --- | --- |
| `assistantMessagesPerFortnight`, free | **20** | messages sent, per account, per the product's fortnight |
| `assistantMessagesPerFortnight`, premium | **100** | the same |
| `ceiling` | **200** | twice premium's shipped number, the same ratio as `planRedosPerFortnight` (3 → 6) and `dishRequestsPerMonth` (3 → 6) |
| `floor` | **0** | the kill switch for one tier, without throwing the `assistant` flag for both |
| `kind` | **`financial`** | it spends from `AI_ASSISTANT_MONTHLY_CAP_USD`, a pot that stops for everybody when it is reached |

Both numbers are anchored on the same thing, which makes them sayable: **free is about one
question a day plus a first conversation, and premium is a question at every meal of the
fortnight, with a follow-up.**

## 1. What one unit costs to serve

| | Cost | Label |
| --- | --- | --- |
| One message on `claude-haiku-5-5`, made of two calls (the label, then the answer) | **≈ 0.00085 $** | **given** by the lead and not re-derived here. 0104 § Consequences agrees: *"still under a tenth of a cent"* |
| A message refused by the clinical lexicon | **0 $** | **confirmed**: PRD 6, the refusal fires before any call |
| A message cut as off topic | one label call, **less than 0.00085 $** | **confirmed**: PRD 2, the label is asked for and no answer is written |
| A message past the off-topic ceiling | **0 $** | **confirmed**: PRD 3, no label and no call |
| The most a long thread can add | bounded | **confirmed**: `HISTORY_LIMITS = { maxCharacters: 8000, maxTurns: 12 }` (`packages/core/src/domain/Assistant/HistoryWindow.ts:21`), so the replay a message carries has a hard top |
| What pays for it | the owner's Claude subscription credits, **about 100 € a month, lost if unspent** | **given**: PRD § Problem, LOG 2026-11-09 |

What follows from this:

- **At today's scale, nothing about the money bounds this number.** 100 € is **about 115 $**
  (**estimated**, at roughly 1.15 $ to the euro), which pays for **about 135,000 messages a
  month**. A premium account that uses all 100 messages costs **0.18 $ a month**. That is
  under a tenth of the 2.03 $ its redos may already spend on pictures (**confirmed**:
  `tiers-and-allowances.md`, production, 2026-10-12).
- **What the money does bound is the pot as a whole, and the pot is shared.**
  `AI_ASSISTANT_MONTHLY_CAP_USD` stops the assistant for **everybody** once the month's
  assistant spend reaches it (**confirmed**: PRD 8, `apps/api/src/modules/ai/ai.config.ts:356`).
  It is the same failure as the picture cap: it is global, nobody sees it coming, and it lands
  on people who did nothing. It is also what decides § 5.
- **This allowance does not move the price.** Premium's worst case rises from 2.03 $ to
  2.21 $ a month. The floor of about 3 €/month that `tiers-and-allowances.md` worked out still
  holds.

| Scenario (messages/fortnight × 2.17 fortnights/month × 0.00085 $) | Messages / month | Cost / month | Share of ~115 $ of credits |
| --- | --- | --- | --- |
| One free account, maxed | 43 | 0.04 $ | 0.03% |
| One premium account, maxed | 217 | 0.18 $ | 0.2% |
| One account at the ceiling (200) | 434 | 0.37 $ | 0.3% |
| 100 premium accounts, all maxed | 21,700 | 18.4 $ | 16% |
| 1,000 free accounts, all maxed | 43,400 | 36.9 $ | **32%** |
| One practice of 50 clients, all maxed | 10,850 | 9.2 $ | 8% |
| **One script on an unlimited premium account**, one message every 10 s | 259,000 | **220 $** | **190%: the month is gone in about two weeks** |

The free row matters most at scale. **Free is the population that grows**, the same point
`dish-requests.md` makes. About 3,000 free accounts all at their limit would use up the
credits, so if the product reaches that size the credits stop being free money and this
number becomes a real cost. The practice row shows the same thing both earlier reports
found: a linked client counts as `premium` before the column is read
(`PlanController.tierOf`, [`0061`](../../decisions/0061-a-subscription-grants-what-its-price-says.md)),
so every client of a practice gets premium's 100 at the practice's price. At this unit cost
that amounts to cents.

## 2. What an ordinary fortnight actually needs

**Estimated.** The feature has not shipped, so nothing has been measured. The estimate rests
on three things inside the product and one weak production proxy.

- **How long a conversation is, by the product's own design.** `HISTORY_LIMITS.maxTurns = 12`
  is six exchanges. The planners sized the replay window for conversations up to about that
  long. I take an ordinary conversation as **2–4 messages from the person** (a question and
  one to three follow-ups) and a long one as up to 6.
- **When the plan raises a question.** PRD § Problem lists them: *why is there so much
  lunch*, *can I swap this for what I have*, *is this enough protein for the gym*, *why does
  it keep giving me lentils*. These fall at points in the fortnight that can be counted:
  - the plan arrives (day 1): one conversation, the longest of the fortnight;
  - the shop: the shopping list exists, and one or two substitution questions follow;
  - cooking: a three-meal fortnight has **42 meals** (**confirmed** by construction, 14 × 3),
    and a doubt about a dish comes up on a cooking day, not every day;
  - the check-in at the end (PRODUCT.md § Scope): *why did my targets move*.
- **What is wasted while learning.** The label prompt is not written yet (phase 4). If a
  first message such as *"hola"* or *"¿qué puedes hacer?"* is labelled `off_topic`, it
  **counts** (the lead's rule) and is **cut**. I assume one or two messages per new account
  are lost this way. § 6 asks for that loss to be removed rather than budgeted for.
- **The weak production proxy.** The busiest plan in production took **5 swaps**, on a
  premium account with a limit of 20, and **no account has ever reached any limit**
  (**confirmed**: `tiers-and-allowances.md`, production counts, 2026-10-12). A swap is the
  nearest existing measure of *"a doubt about a meal"*, and the most engaged user had one
  every two to three days. Eight accounts are not a distribution, and I do not read one as
  if they were.

From those pieces, the demand I am pricing against, **estimated**:

| Who | Pattern | Messages / fortnight |
| --- | --- | --- |
| Light | asks when the plan arrives and once more | 5–10 |
| Ordinary, engaged | the arrival conversation, two or three doubts a week, the check-in | **18–25** |
| A daily habit | something most days, with a follow-up | 40–60 |
| Meal by meal | a question at every meal, with a follow-up, plus the arrival and the check-in | **≈ 100** (42 × 2 + ~16) |
| Not a person | a script, a shared login, someone using it as company | unbounded |

## 3. What the free tier must leave undone

The free number has two jobs, in this order:

1. **The first conversation must never hit the limit.** This is the moment that teaches
   someone the feature exists. A person who is cut off in the middle of their first
   conversation does not learn that the assistant is limited. They learn that it is broken,
   and they do not come back to find out. A first conversation is up to six messages, plus
   one or two lost to a greeting.
2. **It must not be enough to live on.** The person who notices the limit should be the one
   who has made asking a **habit**: the engaged user, late in the second week. Someone who
   asks once a day plus a first conversation fits. Someone asking two or three times a day
   does not.

**When a free user feels it**, estimated: an ordinary engaged user (18–25) runs out in the
last days of the fortnight, if at all. A daily-habit user runs out around **day 6–8**. A light
user never does. That is the intended result: the people who reach the limit are the people
premium is for.

## 4. The numbers, and why not one higher or lower

**What the evidence can resolve.** With no usage data, nothing separates 20 from 21. What the
estimates can separate are steps of about five, and the number is printed on the pricing
page, so I use round numbers. The arguments below are against the next step each way.

### Free 20

- **Why not 15.** Take away the first conversation (6) and one wasted greeting (1), and 8
  remain for thirteen days. That is not one question a day. It is a habit cut off before it
  forms. An ordinary engaged user (18–25) would run out in the first week, which is the "too
  mean, nobody stays" failure. 10 is worse: two conversations and a greeting, and the person
  who asked on day 1 meets the wall on day 3.
- **Why not 25 or 30.** 25 is the top of ordinary engaged use, so the engaged user would
  never meet the limit. Free would then be something they can live on, and premium's
  assistant benefit would only be felt by daily-habit users. 30 makes that certain. This is
  the "nobody pays" failure. It costs almost nothing in money (0.06 $ an account a month at
  30), but it takes away the reason to upgrade.
- **What 20 buys.** A first conversation of six, one question every remaining day, and a
  spare. In words: **about one question a day**.

### Premium 100

- **Why not 120 or more.** 100 already covers a question at every meal of a three-meal
  fortnight with a follow-up, plus the two longest conversations. Past that, a person is not
  asking about the plan in front of them. They are using the assistant as company, and PRD
  § Scope says it is *"not company"*. A higher number would also be one no real person ever
  reaches, which § 5 rules out.
- **Why not 80 or 60.** 60 is the top of the daily-habit user, and those are the people most
  attached to the feature and most likely to pay for it. They would hit the wall in the last
  days of a fortnight they paid for. 80 has the same failure for the meal-by-meal user four
  days earlier. Lowering it saves no money (§ 1), so the only effect would be to make the paid
  tier worse.
- **The ratio.** Premium's number is 5× free's. Redos are 3×, swaps 4× and fixed meals 3×.
  The larger gap here is deliberate: free's number is sized for learning the feature and
  premium's for living with it. Those are further apart for a conversation than for a redo.

### What breaks if this is wrong, in each direction

- **Too mean.** A free account is cut off before a habit forms and never learns what premium
  would give it. This would show up as **free accounts reaching 20 within the first five
  days** (§ 7). The console can raise free in one click, and no one is grandfathered into
  anything because payments are not live.
- **Too generous.** Free stops selling premium (no free account ever reaches 20), or, at a
  few thousand free accounts, the credits run out. If the credits run out, the assistant
  stops for **everybody**, paying accounts included, until the month resets. This would show
  up as **the month's assistant spend approaching the cap**. That is a reason to watch the
  cap, which the lead already owns, and not a reason to lower these numbers today.

## 5. Should premium's number be finite at all?

**Yes. Unlimited cannot be built, cannot honestly be printed, and is not needed.**

1. **One shared cap stops the assistant for everybody.** An unlimited premium account is all
   it takes for one script, one shared password or one obsessive user to spend the month's
   assistant budget for every account. The last row of the § 1 table does that in about two
   weeks. This holds whether or not the cap is set: it is unset by default
   (`Env.validation.ts:241`), and without it the credits themselves run out and every call
   fails for everyone, which is the same outcome arriving a little later. The off-topic ceiling does not help: a script that asks about food passes every
   label. 100 a fortnight limits the worst any single account can do to **0.18 $ a month**.
   That is the job the number does. It does not protect the money. It protects other
   people's access to the assistant.
2. **"Unlimited" would be a false word on a page that asks for money.** It would really mean
   unlimited until a ceiling nobody can see is reached for everyone. That is the kind of
   limit that is hidden until it is hit, which I will not propose.
3. **The table has no way to express it.** `Allowances` holds only integers, each with a
   floor and a ceiling (`Allowance.ts:74-90`, `ALLOWANCE_BOUNDS`, **confirmed**). A sentinel
   for "unlimited" would be a change to the code's shape that the owner did not choose, and
   `0097`'s rule that *"the fallback is always the smaller number"* has no meaning for
   infinity.

**And the rule I hold every premium number to, applied to this one.** A number nobody can
reach is "unlimited with extra steps", and `0044`'s ten events is the precedent for the damage
that does. **100 is reachable by a real person:** the meal-by-meal user, about 7 messages a
day (**estimated**, § 2). I expect few premium accounts to reach it, and I say so. It is the
outer edge of honest use, not the line that sells premium. The line that sells premium is the
free limit, which ordinary engaged users do reach. If several fortnights with twenty or more
premium accounts show **nobody** above 60, the number has become decoration and should come
down to 60. § 7 says what to read.

## 6. Three things in the build that change what the number means

These are not mine to design. Each goes to the lead in one paragraph, because the number
above is only true if each one is answered.

**Deleting a message may give it back.** **Confirmed**: there is a gap in the record. PRD 9
counts *"from the messages the person actually sent"*. PRD 10 lets the person delete *"one
message or a whole conversation at any time"*. `assistant_calls` names nobody, so it cannot
count per person, and I found nothing in the PRD, PLAN, LOG or `0104` that says how the count
survives deletion. If the count reads the rows in `assistant_messages`, **deleting a thread
refunds the allowance**. The number would then be "unlimited with extra steps" for anyone who
deletes, and the product would reward deleting history. The off-topic ceiling counts the same
rows (LOG, notes for phase 3) and has the same hole, which matters more there because it is
the abuse control. The count has to come from something that holds no text and goes with the
account. Choosing that is the lead's call, and it should be settled before the constant lands.

**Withheld answers count, and that is right here, but only because of the unit.**
`dish-requests.md` § 3 refused to charge for a failure: *"a counter that goes down when
nothing came back is a limit the person cannot predict"*. That reasoning applied because the
unit sold there was **a dish**. Here the unit is **a message you send**, which the person can
count themselves, and the lead's rule (everything sent counts, off-topic cuts included) is
predictable by that standard. I accept it on one condition: the share of answers withheld by
the service's own nets (`allergen`, `invented_figure`) must stay small. Free 20 is sized
assuming withheld answers cost a person at most one or two messages a fortnight. If phase 5
measures withholding above about **10% of answers**, the counter is charging people for the
service's own defect. The right response then is to stop counting withheld answers, not to
raise the number. Refusing to count them also has a cost, and it should be named: it opens a
route into the shared pot that no per-person counter sees, because someone could keep asking
for figures to provoke `invented_figure`.

**A greeting must not cost a first-timer anything.** If *"hola"* or *"¿qué puedes hacer?"*
are labelled `off_topic`, a new account loses part of its allowance **and** part of the abuse
ceiling just learning what the screen is for. The label prompt (phase 4) should treat a
greeting or a question about the assistant itself as in scope. The off-topic ceiling, which
is not mine to set, should be larger than a confused first fortnight's waste, so that
somebody new is never treated as an abuser.

## 7. The screen rules that come with the number

These are what make the number printable. None of them is optional.

- **The count is always on the screen, not only once it is nearly used up.** *"18 de 20 esta
  quincena"*. A limit hidden until it is hit is a dark pattern.
- **The reset is a date, and there are two windows, so there are two sentences.** With a plan
  running, the fortnight is the plan's span, counted the way `planRedosPerFortnight` counts
  one, and it has a single reset date: the day after the plan's `endDate` (`nextAt` in
  `PlanRedoStanding`). With no plan running, the window is the last 14 days. Messages then
  come back one at a time as they age out, so there is no single reset date, and the
  sentence has to say *"en los últimos 14 días"*. This is still one number, not two.
- **Past the limit, the history stays fully readable and deletable on free.** Reading or
  deleting a conversation is never counted and never gated. A free account that could not
  read what it had already been told would be held hostage by its own messages, which is the
  line `Allowance.ts` draws for the plan a person is living.
- **Nothing about safety may depend on there being a message left.** The assistant explains
  the plan. It is not the safety layer. Allergen exclusion, the energy floor and the
  professional-review notice all live in the plan and its screens, for every tier. A person
  who has no messages left loses an explanation, never a protection.
- **A zero is rendered as the premium card, never as "0 of 0".** This is `0097` rule 3, in
  case the console ever sets free to 0.

**Not in this rule set, deliberately:** no "upgrade to keep chatting" written into the
assistant's own answer, and no prompt to upgrade in the middle of a conversation. When the
limit is reached, the person gets one sentence with the date it resets, and the premium card
appears below the composer.

## The `ALLOWANCE_BOUNDS` entry

```ts
assistantMessagesPerFortnight: {
  ceiling: 200,
  floor: 0,
  kind: 'financial',
  why: 'Two hundred a fortnight is four messages at every meal of a three-meal plan plus its two long conversations, which is company and not a question about the plan; the money does not bound this one — at under a tenth of a cent a message, an account at the ceiling costs about 0.37 $ a month — but it spends from a monthly assistant cap that stops answering for everybody.'
}
```

**`kind: 'financial'`, with the same nuance `dish-requests.md` recorded.** By `0097`'s
definition it is financial, because it spends from a pot everyone shares. But this is the
second financial number whose cost is too small to set its ceiling. Working from the money,
the way `planRedosPerFortnight` was worked out, gives tens of thousands of messages, which is
not a meaningful product number. So 200 is a product bound with a financial label: twice the
shipped premium number, the ratio the other two financial numbers already use.

**The ceiling is dangerous on the free row, not the premium row.** It applies to both tiers.
Premium at 200 costs 0.37 $ an account a month. Free at 200 across 1,000 accounts is about
**370 $ a month, three times the credits**. `0097`'s rule for a financial number is that it is
never moved without the spend shown alongside it. For this number, the figure the console
must show is **free's**, multiplied by the number of free accounts.

**The floor is 0, and it does a job the flag cannot.** The `assistant` flag turns the feature
on or off for everyone. 0 on one tier turns it off for that tier alone, for example free set
to 0 in a month when the credits are gone, while paying accounts keep it.

## Is a fortnightly count the right shape?

**Yes, and better than the obvious alternative.** Conversations about a plan come in bursts:
the longest is on the day the plan arrives, followed by short ones on cooking days and one at
the check-in. A daily cap of one or two would cut off the first conversation, which is the
one that teaches the feature, at its second or third message. A fortnightly pool lets that
burst through and still limits the habit. That is exactly the split free needs, and it means
the count resets alongside every other number the person already lives by. My one
reservation concerns the **no-plan fallback**. A rolling 14-day window has no single reset
date and gives messages back one at a time, which is harder to explain than any other window
in this product. It is acceptable only with the second sentence in § 7. If the console ever
shows that no-plan accounts are a large share of assistant users, the shape to reconsider is
that fallback, not the fortnight.

## The audit: felt, bounded, costs

- **Is it felt?** Free's 20 is felt by the ordinary engaged user late in the fortnight and by
  the daily-habit user in its first week, which is where it should be felt. Premium's 100 is
  felt by almost nobody, as § 5 admits, so it is a guard on the shared pot and not a selling
  line. In the pitch, the benefit should be described as the gap between the two.
- **Is it bounded?** Yes. Free's limit is reached by real people. Premium's is reachable by a
  real person (meal by meal), and § 5 sets the condition under which it comes down.
- **Does it cost us?** Not at today's scale: these are credits that expire if unspent, at
  0.18 $ for a maxed premium account. It would cost money at a few thousand free accounts,
  which is the free row in § 1, and through the shared cap if premium were unlimited, which
  is why it is not.

This is **generous and costs money**, which is the cell I flag as a risk. The risk is real,
but it is far off: it starts at around 3,000 free accounts, not at 8. The response is the
console's free number, moved with the spend shown, not a smaller number today.

## The pitch

**One clause, giving the gap between the tiers as patterns rather than only as numbers,
because the patterns are what a person recognises.** In shape, for `frontend` and the owner
to word:

> …y el asistente, para una pregunta en cada comida: {assistantMessages} mensajes por quincena
> en vez de {assistantMessagesFree}.

Two constraints:

1. **Say "mensajes", never "preguntas" or "respuestas".** The counter counts what is sent,
   including a cut question and a withheld answer (§ 6). Only "mensajes" is true.
2. **Never "ilimitado".** § 5 explains why.

Two placeholders go into `pitchValues`: `premium.assistantMessagesPerFortnight` and
`free.assistantMessagesPerFortnight`.

## What is not mine to decide

- **The price.** Unchanged by this. The worst case rises by 0.18 $ a month and the floor of
  about 3 €/month stands.
- **`AI_ASSISTANT_MONTHLY_CAP_USD`.** It is unset by default (`Env.validation.ts:241`,
  **confirmed**). The lead was clear that it is not mine to price. The § 1 table is the
  arithmetic whoever sets it will want.
- **`assistantOffTopicPerFortnight`.** It is an abuse control. My one request is in § 6: it
  should be larger than a confused newcomer's waste.
- **Whether free meets a premium card with no checkout behind it.** Premium is granted by a
  switch and there is no checkout (memory, 2026-09-25 and 2026-10-20). A free account that
  reaches 20 would see a card with nowhere to go. That is the same issue
  [`the-past-is-premium.md`](./the-past-is-premium.md) § 4 raised for the past, and it is the
  owner's call. During the friends beta, one option is to set free to 100 from the console
  until a checkout exists. That is a single click and costs about 1.50 $ a month across the
  eight accounts.
- **The decision record.** The allowance is new, so it supersedes nothing. It rests on
  [`0097`](../../decisions/0097-what-each-subscription-allows-is-data-the-owner-edits.md)
  (kinds, ceilings, zero as a value, the smaller number as the fallback),
  [`0104`](../../decisions/0104-the-assistant-answers-and-the-service-is-the-only-source-of-a-number.md)
  (two calls a message, its own cap) and PRD 9.

## What to read once it ships

Each of these is a count that needs **no text**, so none of them conflicts with
`0068`'s rule that the console reads nobody:

1. **Messages per account-fortnight, by tier, as a distribution.** It tests every estimate in
   § 2.
2. **The day of the fortnight on which a free account reaches 20.** If it is usually within
   the first five days, free is too low. If no free account ever reaches it, free is too high.
3. **The share of premium account-fortnights above 60.** If it is zero across fortnights with
   twenty or more premium accounts, premium comes down to 60 (§ 5).
4. **The share of a new account's first three messages that are cut as `off_topic`.** If it is
   above about one in ten, the greeting fix in § 6 has not landed.
5. **The share of answers withheld by `allergen` or `invented_figure`.** Above about 10%, stop
   counting them (§ 6).

## The market, as context and not as a reason

Checked once on 2026-11-09 with one web search. Every source is a small app's marketing page
or a third-party blog. **None of them was verified** against an app store or a current
pricing page, and none of those apps has our cost base.

- An LBN blog post describes free at 20 AI conversations a day and premium at 50
  ([lbn-website.pages.dev](https://lbn-website.pages.dev/blog/ai-nutrition-assistant-free)).
- NutriGenius AI lists 5 messages a day on its free plan
  ([nutrigenius-ai.vercel.app](https://nutrigenius-ai.vercel.app)).
- NutriScan gives free accounts 4 voice-assistant calls a week, reset every Monday, with
  premium unlimited ([nutriscan.app](https://nutriscan.app/guide/does-nutriscan-have-an-ai-nutritionist)).
- SnapCalorie is described as making its AI nutritionist chat paid-only
  ([macaron.im](https://macaron.im/en/blog/is-snapcalorie-free)).

A daily cap of 5 or 20 works out to 70 or 280 a fortnight, so our free 20 is tighter per
fortnight than most of these. It can also be spent in bursts, which a daily cap cannot, and
§ 2 argues that bursts are what this feature needs. The fact worth noting is that **none of
these keeps the assistant from free entirely except SnapCalorie**, and free access is also
what this product needs: the first conversation is what teaches the feature exists.
