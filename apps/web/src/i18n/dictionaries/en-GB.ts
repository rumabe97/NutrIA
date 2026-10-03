import type { Dictionary } from './es-ES';

/**
 * British English.
 *
 * Typed as `Dictionary`, so a key added to Spanish and forgotten here fails the
 * build. That is the whole reason this file has no keys of its own.
 */
export const enGB: Dictionary = {
  a11y: { skipToContent: 'Skip to content' },

  activity: { athlete: 'Athlete', high: 'High', light: 'Light', moderate: 'Moderate', sedentary: 'Sedentary' },

  admin: {
    accompanimentsHint: 'On: new plans, swaps and rebuilds set bread, salad or fruit beside large meals, and the plate drops to a normal serving.',
    accompanimentsLabel: 'Accompaniments (bread, salad, fruit)',
    accompanimentsOffHint: 'Off: no new accompaniments are added. Those a plan already has are still shown.',
    automaticActivation: 'Automatic activation',
    automaticHint: 'Whoever confirms their address is in. Nothing for you to do.',
    events: { app_used: 'Used the app', session_started: 'Sign-ins', swap_requested: 'Meal swaps asked for' },
    funnel: {
      activated: 'Account opened',
      checkedIn: 'Did the check-in',
      confirmed: 'Address confirmed',
      lived: 'Marked at least one meal',
      onboarded: 'Finished the profile',
      planned: 'Have a plan',
      returned: 'Came back for a second plan',
      signedUp: 'Signed up'
    },
    manualHint: 'Confirming their address leaves the account waiting and sends you a mail. You open it from this list.',
    picturesHint:
      'On: the first time somebody opens a dish with no picture, one is drawn, and everyone who opens it afterwards sees it. Once the month’s cap is reached, no more are drawn until next month.',
    picturesLabel: 'Draw the dish pictures',
    picturesOffHint: 'Off: no new picture is drawn. The ones that already exist are still shown.',
    premiumHint: 'Premium is on: accounts you have granted it get three redos a fortnight and twenty swaps a plan.',
    premiumLabel: 'Paid tier',
    premiumOffHint: 'Premium is off: everybody is on the free limits, including anyone already granted it. Turning it on gives it back.',
    professionalHint: 'On: the professionals you grant can open their practice and link clients.',
    professionalLabel: 'Practice for dietitians',
    professionalOffHint: 'Off: nobody sees the practice, not even those already granted. Their clients carry on as ordinary accounts.',
    pushTest: 'Send me a test notification',
    pushTestNoDevice: 'No device of yours has notifications on. Turn them on in your profile, from your phone, and try again.',
    pushTestRefused:
      'None of your {count} devices accepted it. If you removed the permission or the app, turn notifications on again in your profile.',
    pushTestSent: 'Sent: {count} of your devices accepted it. It should arrive in a few seconds.',
    pushTestUnconfigured: 'Push is not set up on the server: the VAPID variables are missing on the API project in Vercel, or it needs a redeploy.',
    remindersHint:
      'On: every morning, whoever has finished their fortnight without checking in is told, by email and on the phones that asked. Once a fortnight, and each person can turn it off on their profile.',
    remindersOffHint: 'Off: no reminder goes out. The check-in only shows on the Today screen.',
    remindersTitle: 'Check-in reminder'
  },

  /* `/admin/cuentas`: sign-ups per week, then every account with its locks and milestones (never content, `0028`). */
  adminAccounts: {
    activate: 'Open account',
    activateFor: 'Open account: {email}',
    caption: 'Accounts',
    columns: {
      actions: 'Actions',
      activated: 'Open',
      confirmed: 'Email confirmed',
      created: 'Signed up',
      email: 'Email',
      lastActive: 'Last activity',
      onboarded: 'Profile finished',
      plans: 'Plans',
      professional: 'Professional',
      role: 'Role',
      tier: 'Tier'
    },
    empty: 'No account yet.',
    howCounted: [
      'Weeks start on Monday, Madrid time. The first and last weeks of the period are usually partial: they count only the period’s days.',
      'Open means the account can sign in. Accounts that have not confirmed their address also show as not open.',
      'Last activity is the last time the account signed in or used the app. It does not say what they did. Until {date} it counted sign-ins only.',
      'Plans counts the account’s plans in any state. No plan is read.'
    ],
    intro: 'Who has signed up, what they still need to get in, and how far they have got.',
    justOpened: 'Account opened: {email}',
    makeFree: 'Move to free',
    makeFreeFor: 'Move to free: {email}',
    makePremium: 'Give premium',
    makePremiumFor: 'Give premium: {email}',
    makeProfessional: 'Make professional',
    makeProfessionalFor: 'Make professional: {email}',
    noMatch: 'No account matches the search or the filters.',
    professionalCollegiate: 'Collegiate number',
    professionalCollegiateHint: 'Letters, digits, / or -, as their college writes it. Check it before granting.',
    professionalCollegiateInvalid: 'That number will not do: it must be 3 to 20 letters, digits, / or -, with no spaces.',
    professionalGrant: 'Grant',
    roles: { admin: 'Admin', user: 'User' },
    search: 'Search by email',
    signUpsChart: 'Sign-ups per week',
    signUpsEmpty: 'Nobody signed up in this period.',
    signUpsSeries: 'Sign-ups',
    signUpsTitle: 'Sign-ups',
    sortBy: { createdAt: 'sign-up date', email: 'email', lastActiveAt: 'last activity', plans: 'number of plans' },
    tableTitle: 'Every account',
    tiers: { free: 'Free', premium: 'Premium' },
    title: 'Accounts',
    twoFactorRemoval: {
      body: 'It is removed between 48 and 72 hours from now. We write to this address straight away: if they did not ask for it, signing in with their code cancels it.',
      cancel: 'Cancel',
      cancelFor: 'Cancel the second factor removal: {email}',
      confirm: 'Schedule the removal',
      notPending: 'There was no removal pending any more: the person may have cancelled it by signing in with their code.',
      pending: 'Second factor: removed from {date}',
      remove: 'Remove the second factor',
      removeFor: 'Remove the second factor: {email}',
      title: 'Remove the second factor from {email}'
    }
  },

  adminAi: {
    averageMs: 'Average time per call',
    averageNote: 'Previous period: {seconds}',
    calls: 'Model calls',
    callsChart: 'Calls per day',
    callsEmpty: 'No model call in this period.',
    callsSeries: 'Calls',
    cap: 'Monthly cap',
    caption: 'Usage by model',
    columns: {
      averageMs: 'Average',
      calls: 'Calls',
      cost: 'Cost',
      failed: 'Failed',
      input: 'Input tokens',
      model: 'Model',
      output: 'Output tokens',
      reasoning: 'Reasoning'
    },
    failed: 'Failed calls',
    featureChart: 'This month’s spend by feature',
    featureColumn: 'Feature',
    featureEmpty: 'Nothing billed this month.',
    featureNote: '“Unlabelled” is calls from before 29 September 2026, when what made each call was not yet recorded.',
    features: { plan: 'Plans', rewrite: 'Nightly rewrite', swap: 'Dish swaps', unknown: 'Unlabelled' },
    featureTable: 'This month’s calls and spend by feature',
    featureTitle: 'By feature',
    howCounted: [
      'Every figure with an arrow is compared with the previous period of the same length. Days are Madrid days.',
      'Spend is what the text models billed, call by call: the dishes generated for plans and the nightly step rewrites. The per-day and per-model figures do not tell the two apart; “This month” does, by feature, from 29 September 2026.',
      'Dish pictures are billed apart and have their own page, under Catalogue.',
      'A call counts against the model that answered. One that failed before knowing counts against the model asked for.',
      'A failed call is one the provider refused, one that ran out of time, or one that answered with something unusable.'
    ],
    inputTokens: 'Input tokens',
    intro: 'How often the text models are called, with how many tokens, and what it costs.',
    modelsChart: 'Calls per model',
    modelsEmpty: 'No model call in this period.',
    modelsTitle: 'By model',
    monthChart: 'This month’s spend against the cap',
    monthEmpty: 'No cap is set.',
    monthNoCap: 'No cap is set: the spend is shown, but nothing warns when it climbs.',
    monthNote: 'Since {date}, the UTC calendar month: it does not change with the period.',
    monthOnlyOnWarns: 'The cap only warns: it never stops a plan. The real wall is the OpenRouter key’s own cap.',
    monthSpent: 'This month’s spend: {spent}.',
    monthTitle: 'This month',
    noAverage: 'No call timed itself',
    others: 'The rest ({count})',
    outputTokens: 'Output tokens',
    over: 'Over the cap',
    spend: 'Text AI spend',
    spendChart: 'Spend per day',
    spendEmpty: 'Nothing billed in this period.',
    spendSeries: 'Spend',
    spent: 'Spent',
    tilesLabel: 'The period’s figures',
    title: 'AI and models',
    tokens: { input: 'Input', output: 'Output' },
    tokensChart: 'Tokens per day',
    tokensEmpty: 'No token in this period.',
    trendsTitle: 'Per day',
    uncosted: { many: '{count} calls without a cost: the figure is a minimum.', one: '1 call without a cost: the figure is a minimum.' },
    warnOver: 'Warning: spend is over the cap. The nightly rewrite stays paused; plans keep being generated.',
    warnSweep: 'Warning: spend has reached {share} of the cap. The nightly rewrite is paused until next month; plans keep being generated.'
  },

  /* `/admin/ajustes/registro` (`0071`): who did each account or setting mutation, and when. */
  adminAudit: {
    actions: {
      'account.activated': 'Account activated',
      'account.tier_changed': 'Tier changed',
      'auth.2fa_disabled': '2-step verification turned off',
      'auth.2fa_enabled': '2-step verification turned on',
      'auth.2fa_removal_cancelled': '2-step verification removal cancelled',
      'auth.2fa_removal_requested': '2-step verification removal requested',
      'auth.2fa_removed_by_owner': '2-step verification removed on request',
      'auth.backup_code_used': 'Backup code used',
      'auth.backup_codes_regenerated': 'New backup codes generated',
      'auth.passkey_added': 'Passkey added',
      'auth.passkey_removed': 'Passkey removed',
      'auth.password_changed': 'Password changed',
      'auth.sessions_revoked': 'Sessions signed out',
      'feedback.handled': 'Message marked seen',
      'feedback.reopened': 'Message reopened',
      'picture.accepted': 'Rejected dish picture accepted by hand, against the checker',
      'picture.discarded': 'Rejected dish picture discarded by hand',
      'picture.removed': 'Published dish picture removed',
      'picture.retried': 'Dish picture retried by hand',
      'professional.granted': 'Professional profile granted',
      'professional.revoked': 'Professional profile revoked',
      'push.test_sent': 'Test push sent',
      'setting.changed': 'Setting changed'
    },
    allergensOverridden: 'The checker had flagged:',
    allergensOverriddenNone: 'The checker had flagged no allergen',
    /** `auth.backup_code_used`: how many codes the person has left. */
    backupCodesLeft: '{remaining} left',
    caption: 'Actions',
    columns: { account: 'Account', action: 'Action', actor: 'Who', date: 'Date', detail: 'Detail' },
    empty: 'The log starts on the day this deploys: there is no row before it.',
    howCounted: [
      'The log starts on the day this deploys. There is no row from before it.',
      'Times are Madrid’s.',
      'The detail is only what the action itself keeps: never the request body, never an IP address.'
    ],
    intro: 'Who made each account or setting change, and when.',
    noMatch: 'No action matches the filter.',
    /** `auth.password_changed`: how the person changed it. */
    passwordVia: { change: 'From their profile', reset: 'With the recovery link' },
    removalCancelledBy: { account: 'The person, by signing in with their code', owner: 'From the console' },
    removedAcceptedBy: { judge: 'The checker had accepted it', owner: 'You had accepted it by hand, against the checker' },
    /** `auth.sessions_revoked`: which of the person's sessions were closed. */
    sessionsScope: { all: 'All of them', one: 'One', others: 'All but their own' },
    settingChange: '{key}: {state}',
    state: { off: 'Off', on: 'On' },
    tableNote: 'Most recent first.',
    tableTitle: 'Every action',
    tierChange: '{from} → {to}',
    title: 'Audit log',
    via: { automatic: 'Automatic', console: 'Console', mail_link: 'Email link' }
  },

  /* `/admin/consentimientos` (`0071`): each versioned consent, its version in force and who holds it. Numbers only. */
  adminConsents: {
    caption: 'Consents by version',
    columns: {
      consent: 'Consent',
      current: 'On the current one',
      older: 'On an older one',
      version: 'Version in force',
      versions: 'Versions in use'
    },
    consents: {
      care: 'Link with a professional',
      health: 'Health data',
      professional: 'The professional’s agreement',
      profile: 'Profile',
      terms: 'Terms of use'
    },
    empty: 'No account has accepted yet.',
    howCounted: [
      'It counts accounts: each account counts once per consent, on the version it accepted.',
      'On an older one are the accounts that will be asked again. Not accepted is a grant that has not accepted the agreement yet (the professional’s only). No record are the accounts created before the terms’ version was kept: which one they saw is unknown, and they are not asked again.',
      'An open link is one accepted consent.',
      'No dates: this page does not say when anybody accepted. The privacy policy is not a consent and is not here.'
    ],
    intro: 'Which version of each consent is in force and how many accounts hold it.',
    onboarded: 'Finished profile on the current version',
    onboardedNote: '{holding} of {total} accounts with a finished profile.',
    tilesLabel: 'The consents’ figures',
    title: 'Consents',
    unaccepted: 'not accepted',
    unrecorded: 'No record',
    versionOf: '{version}: {n}'
  },

  /* Words every console page with a period shares: the selector, the charts' table, the tiles' change. */
  adminConsole: {
    changeLabel: '{change} against the previous period',
    dataLabel: 'Show data',
    day: 'Day',
    howCounted: 'How it’s counted',
    no: 'No',
    period: 'Period',
    periodOption: '{days} days',
    seconds: '{seconds} s',
    /* The console's tables (`AdminTable`): the toolbar, the sort links, the result line and the pager. */
    table: {
      any: 'Any',
      apply: 'Apply',
      ascending: 'ascending',
      clear: 'Clear the search and filters',
      clearFilters: 'Clear the filters',
      count: '{count} in all',
      descending: 'descending',
      filters: 'Filters',
      filtersActive: 'Filters ({count} active)',
      filtersActiveOne: 'Filters (1 active)',
      next: 'Next',
      pager: 'Table pages',
      pageSize: 'Per page',
      previous: 'Previous',
      range: '{from}–{to} of {total}',
      sortAsc: 'sort ascending',
      sortDesc: 'sort descending',
      sortedAsc: 'sorted ascending; sort descending',
      sortedDesc: 'sorted descending; sort ascending',
      status: '{count} in all · by {column}, {direction}',
      toolbar: 'Search and filter',
      toolbarFilters: 'Filter'
    },
    week: 'Week (from Monday)',
    yes: 'Yes'
  },

  /* `/admin/buzon`: messages per week, then every message as it was written (`0037`). */
  adminInbox: {
    caption: 'Messages',
    columns: { actions: 'Action', date: 'Date', kind: 'Kind', message: 'Message', sender: 'From', state: 'State' },
    empty: 'Nobody has written yet.',
    handled: 'Mark as seen',
    handledFor: 'Mark as seen: message from {email}',
    howCounted: [
      'Weeks start on Monday, Madrid time. The first and last weeks of the period are usually partial: they count only the period’s days.',
      'Unseen counts every message you have not marked, whatever its date.'
    ],
    intro: 'What people write to you, as they wrote it.',
    messagesChart: 'Messages per week',
    messagesEmpty: 'Nobody wrote in this period.',
    messagesSeries: 'Messages',
    messagesTitle: 'Messages',
    noMatch: 'No message matches the search or the filter.',
    reopen: 'Reopen',
    reopenFor: 'Reopen: message from {email}',
    search: 'Search the message or the email',
    seenState: 'Seen',
    sortBy: { createdAt: 'date' },
    state: 'State',
    states: { all: 'All', seen: 'Seen', waiting: 'Unseen' },
    tableTitle: 'Every message',
    title: 'Inbox',
    waiting: '{count} unseen',
    waitingState: 'Unseen'
  },

  adminIngredients: {
    caption: 'Ingredients',
    columns: {
      allergens: 'Allergens',
      carbs: 'Carbs (g)',
      category: 'Category',
      countries: 'Countries',
      fat: 'Fat (g)',
      kcal: 'kcal',
      mayContain: 'Traces',
      meals: 'Meals',
      name: 'Name',
      protein: 'Protein (g)'
    },
    containsAllergen: 'Contains the allergen',
    empty: 'The catalogue has no ingredient.',
    everyMeal: 'All',
    everywhere: 'All',
    howCounted: [
      'Figures are per 100 g.',
      'Allergens and traces are the ingredient’s label, not anybody’s allergy.',
      'Meals “All” means the ingredient suits any meal. Countries “All”, that it is sold everywhere.'
    ],
    intro: 'Every ingredient in the catalogue, with its figures per 100 g and its label.',
    noMatch: 'No ingredient matches the search or the filters.',
    search: 'Search by name',
    sortBy: { carbs: 'carbs', category: 'category', fat: 'fat', kcal: 'kcal', name: 'name', protein: 'protein' },
    tableTitle: 'All ingredients',
    title: 'Ingredients'
  },

  adminLog: {
    caption: 'Generations',
    chartsTitle: 'In the period',
    code: 'Code',
    codes: {
      GENERATION_ABANDONED: 'It never finished and was written off as abandoned',
      GENERATION_AI_UNAVAILABLE: 'The model did not answer',
      GENERATION_FAILED: 'Unexpected error',
      GENERATION_INVALID_PLAN: 'The plan failed validation',
      GENERATION_ONBOARDING_INCOMPLETE: 'The person had not finished signing up',
      GENERATION_POOL_TOO_SMALL: 'There were not enough dishes that met their restrictions',
      GENERATION_PROFILE_CONSENT_REQUIRED: 'Consent to process their health data was missing',
      GENERATION_PROFILE_INCOMPLETE: 'Part of the profile was missing',
      GENERATION_TIMED_OUT: 'It ran out of time',
      GENERATION_UNSAFE_CONTENT: 'A dish did not meet their dietary restrictions'
    },
    columns: {
      account: 'Account',
      attempts: 'Attempts',
      calls: 'Model calls',
      code: 'Code',
      detail: 'Detail',
      plan: 'Plan',
      seconds: 'Seconds',
      started: 'Started',
      status: 'Status'
    },
    durationsChart: 'Duration per day',
    durationsEmpty: 'No generation finished in this period.',
    empty: 'No generation logged yet.',
    failuresEmpty: 'No generation failed in this period.',
    failuresNote: 'Failed generations of the period, by the reason the service left. The raw code stays in the table and in the filter.',
    failuresTitle: 'Failures by reason',
    from: 'From day',
    howCounted: [
      'Days and times are Madrid’s.',
      'Each generation on the outcomes chart counts in the state it is in now.',
      'The median and the 95th percentile measure only the generations that finished, by the day they were asked for. A day with none has no point on the line.',
      'Dropped dishes are the ones the model proposed and the service did not accept, added up over every generation in the period. The table leaves out the reasons “allergen” and “diet or dislikes”: next to an address they would say something about that person.',
      'A generation with no model call came entirely from the library, or never got as far as asking.',
      'The request is the id the gateway files that call under.'
    ],
    intro: 'Every plan generation: how it ended, how long it took, and every model call.',
    logCall: '{slot}, round {round}',
    logCallAsked: 'asked: {model}',
    logCallColumns: { call: 'Meal', error: 'Provider’s message', model: 'Model', request: 'Request', result: 'Result', seconds: 'Seconds' },
    logCallDropped: 'dropped: {reasons}',
    logCallFailed: 'failed ({status})',
    logCallKept: '{kept} of {dishes} dishes',
    logCallQuota: 'quota: limit {limit}, retry in {seconds} s',
    logCallReasoning: '{count} reasoning',
    logCalls: '{count} calls',
    logCallsCaption: 'Model calls of this generation',
    logCallTokens: '{input} / {output} tokens',
    logCallVia: 'via {provider}',
    logNoCalls: 'None',
    logPlan: 'v{version} · {model} · prompt {prompt} · {reused} from the library',
    noCode: 'No code',
    noMatch: 'No generation matches the search or the filters.',
    outcomesChart: 'Generations per day',
    outcomesEmpty: 'No generation in this period.',
    p50: 'Median',
    p95: '95th percentile',
    reason: 'Reason',
    rejection: {
      allergen: 'allergen',
      duplicate: 'repeated',
      foreign_food: 'names what it lacks',
      over_time: 'too long',
      oversized: 'serving too large',
      schema: 'schema',
      unknown_ingredient: 'invented ingredient',
      unwanted: 'diet or dislikes',
      wrong_language: 'wrong language',
      wrong_meal: 'wrong meal'
    },
    rejectionsChart: 'Dropped dishes by reason',
    rejectionsEmpty: 'No dish dropped in this period.',
    rejectionsSeries: 'Dishes',
    search: 'Search by address',
    since: 'Started in',
    sinceDay: 'The last 24 hours',
    sinceDays: 'The last {days} days',
    statuses: { failed: 'Failed', queued: 'Queued', running: 'Running', succeeded: 'Finished' },
    tableNote: 'Latest first.',
    tableTitle: 'All generations',
    title: 'Log',
    to: 'To day'
  },

  /* The console's own navigation (`0068`): six groups, and only the pages that exist yet. */
  adminNav: {
    back: 'Back to NutrIA',
    groups: { catalogue: 'Catalogue', generation: 'Generation', people: 'People', product: 'Product', settings: 'Settings', summary: 'Overview' },
    label: 'Console sections',
    menu: 'Menu',
    pages: {
      accounts: 'Accounts',
      ai: 'AI and models',
      auditLog: 'Audit log',
      consents: 'Consents',
      inbox: 'Inbox',
      ingredients: 'Ingredients',
      log: 'Log',
      notifications: 'Notifications',
      pictures: 'Pictures',
      planQuality: 'Plan quality',
      plans: 'Plans',
      product: 'Funnel and activity',
      professionals: 'Professionals',
      quality: 'Quality',
      recipes: 'Recipes',
      retention: 'Retention',
      settings: 'Switches',
      summary: 'Overview',
      system: 'System'
    },
    title: 'Console'
  },

  /* `/admin/notificaciones` (`0071`): push subscriptions, reminders per week and channel, and who checked in after one. */
  adminNotifications: {
    answered: 'Checked in within 3 days',
    answeredNote: '{share} of those who got a reminder.',
    howCounted: [
      'Weeks start on Monday, Madrid time. The first and last of the period are usually incomplete.',
      'A reminder that leaves by both channels counts once in each. Reminders per channel are kept since {date}: before that, a reminder sent by both kept a single row.',
      'Checked in within 3 days counts distinct people, among those sent a reminder in the period, who made a check-in in the three days after one. It does not prove the reminder was the reason.',
      'Subscriptions are subscribed browsers: one person may have several. No subscription address and no name is shown.'
    ],
    intro: 'Who can be reached, how many reminders leave by each channel and how many people check in afterwards.',
    people: 'People with push',
    reminded: 'People reminded',
    remindersChannels: { email: 'Email', push: 'Push' },
    remindersChart: 'Reminders per week',
    remindersEmpty: 'No reminder left in this period.',
    remindersTitle: 'Reminders',
    subscriptions: 'Push subscriptions',
    tilesLabel: 'The notifications’ figures',
    title: 'Notifications'
  },

  /* `/admin/catalogo/[id]/imagen` (`0072`, project 010): one picture the checker rejected, beside what the dish is made of and what the checker flagged; or one published picture, whoever accepted it, and the way to remove it. A dish, never a person (`0028`); never the vision model's own words. */
  adminPictureReview: {
    accept: 'Accept',
    acceptAck: 'I have seen the picture and I publish it although the checker saw in it:',
    acceptAckMissing: 'Tick the box to publish the picture.',
    acceptAckNone: 'I have seen the picture and I publish it although the checker rejected it.',
    acceptConfirm: 'Publish the picture',
    acceptConfirmBody: 'Step 2 of 2. Once confirmed, the picture of {dish} is published as it is for everyone who gets the dish.',
    acceptConfirmTitle: 'Publish this picture?',
    acceptContinue: 'Understood, continue',
    acceptDone: 'Picture published. You accepted it by hand.',
    acceptedHelp: 'Remove leaves the dish without a picture for everyone and deletes the published file. It costs nothing.',
    acceptedIntro: 'This dish’s picture is published: you accepted it by hand, against the checker. Everyone who gets the dish sees it.',
    acceptedTitle: 'Picture accepted by hand',
    acceptedTrail: 'The audit log keeps when each picture was accepted and which allergens the checker had flagged.',
    acceptedTrailLink: 'Open the audit log',
    acceptEffects: [
      'The picture is published for everyone who gets this dish.',
      'If it shows a food carrying an allergen the dish does not have, a person with that allergy may distrust a dish that is safe for them.',
      'The dish’s allergens are decided by the recipe, not by the picture: accepting it changes neither what the dish contains nor who is given it.',
      'The checker only looks at what is extra in the picture. If an ingredient the dish does contain is missing, nobody has checked that: compare it with the dish’s list yourself.',
      'It is recorded in the audit log, with your account and the allergens the checker flagged.',
      'It can be taken back later: “Remove” leaves the dish without a picture again. It does not delete the copies a browser has already stored.'
    ],
    acceptEffectsTitle: 'What happens if you accept it',
    acceptStaleTitle: 'Nothing was published',
    acceptTooMany: 'Too many acceptances in an hour: wait a while and try again.',
    acceptWarningBody: 'Step 1 of 2. The checker rejected this picture. Accepting it publishes it against the checker’s verdict.',
    acceptWarningTitle: 'Before you accept this picture',
    back: 'Back to Recipes',
    decideHelp:
      'Accept publishes it as it is for everyone who gets the dish, against the checker, and costs nothing. Discard deletes it and costs nothing either. Retry deletes it and draws another, which is a paid call.',
    decideNote:
      'You can look at it until {date}, Madrid time. After that the nightly cleanup deletes it, normally the following night, and until then the dish is not drawn again on its own.',
    decideTitle: 'What to do with it',
    discard: 'Discard',
    discardBody:
      'The file is deleted and cannot be brought back. It costs nothing: no new picture is drawn, and the dish stays without a picture until its next retry.',
    discardConfirm: 'Discard the picture',
    discardDone: 'Picture discarded.',
    discardTitle: 'Discard this picture?',
    dishAllergens: 'The dish’s allergens',
    dishTitle: 'The dish',
    dishTraces: 'The dish’s traces',
    flaggedAllergens: 'Allergens it saw that the dish does not have',
    flaggedAllergensNone: 'It flagged none. That does not mean the picture is right.',
    flaggedIngredients: 'Catalogue ingredients it recognised',
    flaggedNote: 'What the checker saw in the picture, in the catalogue’s words. It may include allergens the dish carries as traces.',
    flaggedTitle: 'What the checker saw',
    gone: 'This picture is no longer kept.',
    ingredients: 'Ingredients, for the whole recipe',
    intro: 'The checker rejected this picture and it is not published. It is waiting for your decision: accept it, discard it or retry the drawing.',
    introNothing: 'The dish’s picture: {state}.',
    introNothingReason: 'The dish’s picture: {state}. {reason}.',
    judgeAcceptedHelp:
      'If it shows something the dish does not contain, remove it: the dish is left without a picture for everyone and the published file is deleted. It costs nothing.',
    judgeAcceptedIntro: 'This dish’s picture is published: the checker accepted it. Everyone who gets the dish sees it.',
    judgeAcceptedTitle: 'Picture accepted by the checker',
    judgePublishedCaption: 'AI-generated picture. The checker accepted it and it is published: it is what everyone who gets this dish sees.',
    loadFailed:
      'The picture could not be loaded: the file may be gone. Reload the page; if it still does not show, discard it or retry. Do not accept it unseen.',
    none: 'None',
    nothingBody:
      'This dish has no published picture and no rejected one waiting: it has not been drawn yet, it is being drawn, or it was discarded, retried, removed, or its 7 days passed.',
    nothingTitle: 'There is no picture to review',
    pictureAlt: 'AI-generated picture of {dish}, awaiting review',
    pictureCaption: 'AI-generated picture. The checker rejected it and it is not published: it is only seen on this page.',
    pictureTitle: 'The picture',
    publishedAlt: 'AI-generated picture of {dish}, published',
    publishedCaption: 'AI-generated picture. You accepted it by hand and it is published: it is what everyone who gets this dish sees.',
    publishedLoadFailed:
      'The published picture could not be loaded: its file may be gone. Reload the page; if it still does not show, remove it: the dish is left without a picture and is drawn again after at least 7 days, or sooner if you retry it from Recipes.',
    reload: 'Close and reload the page',
    remove: 'Remove',
    removeBody:
      'The dish goes back to having no picture for everyone who gets it, and the published file is deleted from the store: this picture cannot be recovered. Vercel’s network may go on serving it for up to a minute, and a browser that already loaded it keeps its copy. It waits at least 7 days before it is drawn again on its own, unless you retry it by hand from Recipes. It is recorded in the audit log, with your account.',
    removeConfirm: 'Remove the picture',
    removeDone: 'Picture removed. The dish has no picture now.',
    removeLeftover:
      'The picture is removed: the dish no longer shows it to anyone. But its file could not be deleted from the public store, and it stays there until you delete it by hand, in the Vercel dashboard: in the pictures’ store, the dish-pictures folder and, inside it, the one named with this dish’s id (it is in this page’s address).',
    removeLeftoverTitle: 'Removed, with its file not deleted',
    removeStaleTitle: 'Nothing was removed',
    removeTitle: 'Remove the picture of {dish}?',
    removeTooMany: 'Too many removals in an hour: wait a while and try again.',
    retry: 'Retry',
    retryBody:
      'This picture is deleted and another is drawn now. Drawing is a paid call and counts towards the month’s cap; the checker may reject it again.',
    retryConfirm: 'Delete and draw another',
    retryDone: 'Picture discarded. Another is being drawn.',
    retryTitle: 'Draw another picture?',
    title: 'Review the picture of {dish}'
  },

  adminPictures: {
    acceptedByHand: 'Of the ready ones, accepted by hand against the checker',
    acceptedByHandLabel: 'Ready pictures accepted by hand',
    cap: 'Month’s cap',
    failedEmpty: 'No picture failed in this period.',
    failedLink: 'See the recipes with a failed picture',
    failedListLabel: 'Failed pictures by reason',
    failedNote:
      'Pictures that failed for the dish’s own reasons in the period, or that you removed by hand, counted by the day they ended. They are tried again on their own after at least 7 days, or by hand from Recipes.',
    failedTitle: 'Why they failed',
    gaugeChart: 'The month’s spend against the cap',
    gaugeEmpty: 'No cap is set.',
    gaugeNote: 'Since {date}, calendar month in UTC: it does not change with the period.',
    gaugeTitle: 'This month',
    howCounted: [
      'The cap counts the calendar month in UTC, not the period. Once it is reached no more pictures are drawn until next month.',
      'Spend per day is what drawing pictures was billed each day, in Madrid days.',
      'Ready is a published picture with its file: the checker accepted it or, against the checker, you accepted it by hand. Failed is one that failed for the dish’s own reasons, or a published one you removed: it is tried again after at least 7 days. Given back is one left by the cap or the key: it is drawn again on the next view.',
      'Dish pictures are billed apart from text, whose spend is on AI and models.'
    ],
    intro: 'What the dish pictures cost and what state they are in.',
    over: 'Over the cap',
    reasonHelp: {
      call_failed: 'The call ended without an answer that could be used: a timeout, a provider error or an unreadable answer.',
      cap_reached: 'The month’s picture spend reached the cap. It is drawn on the next view of the dish, if the cap allows.',
      judge_allergen:
        'The checker saw a food in the picture carrying an allergen the dish does not have. It is the only thing that rejects a picture for its content.',
      judge_rejected: 'The checker rejected it for a reason other than an allergen.',
      model_refused: 'The provider did not accept the request (a usage limit or a policy): a 4xx error other than 402.',
      no_provenance: 'The file came back without the C2PA signature that proves it is a generated image, and it is never kept.',
      other: 'Any other case, including old rows that did not record the reason.',
      owner_removed:
        'You removed a published picture: the checker had accepted it, or you had by hand. Not a drawing that failed: the dish waits at least 7 days before it is drawn again on its own.',
      payment_refused: 'The provider’s account cannot pay for another call (error 402, spent key or quota). Not the dish’s fault.'
    },
    reasons: {
      call_failed: 'The call failed',
      cap_reached: 'Month’s cap reached',
      judge_allergen: 'The checker saw an allergen the dish does not have',
      judge_rejected: 'The checker rejected it',
      model_refused: 'The model refused the request',
      no_provenance: 'No C2PA signature',
      other: 'Other reason',
      owner_removed: 'You removed it by hand',
      payment_refused: 'The provider cannot charge'
    },
    releasedEmpty: 'No picture was given back in this period.',
    releasedListLabel: 'Pictures given back by reason',
    releasedNote: 'Given back through no fault of the dish (the cap or payment): they are drawn again on the next view, with no wait.',
    releasedTitle: 'Given back, not failed',
    settingsLink: 'Change in Settings',
    settingsOff: 'Drawing pictures is off: no new one is drawn.',
    settingsOn: 'Drawing pictures is on.',
    share: 'Of the total',
    spendChart: 'Picture spend per day',
    spendEmpty: 'Nothing was drawn in this period.',
    spendSeries: 'Spend',
    spendTitle: 'In the period',
    spent: 'Spent',
    state: 'State',
    states: { drawing: 'Being drawn', failed: 'Failed', ready: 'Ready', released: 'Given back' },
    statesChart: 'Pictures by state',
    statesEmpty: 'There is no picture yet.',
    statesNote: 'All of them, from any date: it does not change with the period.',
    statesSeries: 'Pictures',
    statesTitle: 'Current state',
    title: 'Pictures'
  },

  /* `/admin/producto/planes/calidad` (`0071`): how the plans made in the period were delivered against the owner's bar. Sums only, never a plan or a person (`0028`). */
  adminPlanQuality: {
    advisoriesLabel: 'Plans carrying each advisory',
    advisoriesNote: 'Advisories the plans went out with; none stopped a plan being delivered.',
    advisoriesTitle: 'Advisories by kind',
    advisoryKinds: {
      carbs_out_of_band: 'Carbs outside the band',
      fat_out_of_band: 'Fat outside the band',
      kcal_out_of_band: 'Calories outside the band',
      protein_above_target: 'Protein above target',
      protein_below_target: 'Protein below target',
      variety: 'Variety'
    },
    bandLabel: 'Share of days inside the band',
    bandNote: 'A day is inside the band when all four macros land within ±5 % of their target.',
    bandTitle: 'Days inside the band',
    dataSince: 'Data since {date}.',
    daysOf: '{count} of {days} days',
    deliveryLabel: 'Times the plans stepped outside what was planned',
    deliveryNote: 'How often the plans had to step outside what was planned to be built.',
    deliveryTitle: 'How they were delivered',
    eventDays: 'Event days inside their band',
    fallbacks: { full_library: 'From the whole library', wider_rotation: 'With a wider rotation' },
    few: 'Little data: {plans} plans in the period; {min} are needed to show figures.',
    floorCaution: 'It does not say the floor caused a miss: it counts days outside the band on any macro, whatever the reason.',
    floorLine: 'Days with the band narrowed by the floor: {days}. Outside the band: {narrowed}, against {rest} on the rest.',
    floorLineAlone: 'Days with the band narrowed by the floor: {days}. Outside the band: {narrowed}.',
    floorNoData: 'No plan in the period records this yet.',
    floorNone: 'No day in the period had its band narrowed by the floor.',
    floorSince: 'Recorded since {date}.',
    floorTitle: 'Energy floor',
    howCounted: [
      'The plans made in the period are counted, summed: no plan, day or person is ever shown.',
      'Plans made before quality was recorded are not scored afterwards: they are counted apart and enter no figure.',
      'A day counts as inside the band only when all four macros are inside it at once. A day can miss several macros.',
      'Below {min} plans in the period no figure is shown: it would be one or two people’s plans.',
      'The energy floor narrows a day’s band when its target sits below it. It is recorded only on plans made from the date shown, and there is no series per day.'
    ],
    inBandAll: 'All four macros at once',
    intro: 'How many of the plans’ days meet the band, which macros miss, and what it took to deliver them.',
    loadsRefused: 'Event loads refused',
    macros: { carbs: 'Carbs', fat: 'Fat', kcal: 'Calories', protein: 'Protein' },
    noData: 'No plan has its quality recorded yet.',
    tiles: { plans: 'Scored plans', withoutQuality: 'Plans without quality recorded' },
    tilesLabel: 'Plans in the period',
    title: 'Plan quality',
    untilYesterday: 'The period ends yesterday: today’s plans are not in it.',
    withoutQualityNote: 'Made before quality was recorded: they enter no figure.'
  },

  /* `/admin/producto/planes`: every plan by the state it is in now, and plans made per day. */
  adminPlans: {
    byStateChart: 'Plans by state',
    byStateEmpty: 'No plan yet.',
    byStateNote: 'Every plan, whenever it was made: the period does not change it.',
    byStateTitle: 'State now',
    createdChart: 'Plans created per day',
    createdEmpty: 'No plan was created in this period.',
    createdTitle: 'In the period',
    howCounted: [
      'A plan is only saved when its generation succeeds. Failed generations leave no plan: they are counted on the Overview.',
      'Each plan counts in the state it is in today, not the one it had when it was made.'
    ],
    intro: 'Which state the plans are in, and how many are made each day.',
    series: 'Plans',
    share: 'Share',
    state: 'State',
    states: {
      active: 'Active',
      archived: 'Archived',
      completed: 'Finished',
      draft: 'Draft',
      failed: 'Failed',
      generating: 'Generating',
      pending_review: 'Awaiting review',
      scheduled: 'Scheduled'
    },
    title: 'Plans'
  },

  /* `/admin/producto`: how far people get, and what they do each day. */
  adminProduct: {
    activeChart: 'Active people per day',
    activeEmpty: 'Nobody signed in during this period.',
    activeSeries: 'People',
    activityTitle: 'Activity',
    eventsChart: 'Events per day',
    eventsEmpty: 'No event in this period.',
    funnelChart: 'People at each step',
    funnelEmpty: 'Nobody has signed up yet.',
    funnelNote: 'Since the first account: the period does not change it.',
    funnelSeries: 'People',
    funnelShare: 'Of the step above',
    funnelStep: 'Step',
    funnelTitle: 'Funnel',
    howCounted: [
      'The funnel is counted from the data rather than from events, so it covers the accounts that predate this screen too. Each step’s percentage is of the step above.',
      'Active people per day counts each person once a day. Someone who signs in on three different days counts on all three, so the days can add up to more than the period’s total on the Overview. Active means signed in or used the app; until {date} it counted sign-ins only.',
      'Events are things somebody did. Calls to the model are not here: they have a page of their own.'
    ],
    intro: 'How far people get, and what they do each day.',
    title: 'Funnel and activity'
  },

  /* `/admin/profesionales`: who has the practice (`0059`), with their links counted — never a client named. */
  adminProfessionals: {
    caption: 'Professionals',
    columns: { actions: 'Action', collegiate: 'Collegiate no.', email: 'Email', granted: 'Since', links: 'Links' },
    empty: 'No professionals yet.',
    intro: 'Each professional with their links counted. No client appears here. Granted from Accounts.',
    links: '{active} active · {paused} paused · {ended} ended',
    noMatch: 'No professional matches the search.',
    revoke: 'Revoke',
    revokeBody: 'They lose access to their practice and their unanswered invitations are cancelled.',
    revokeConfirm: 'Yes, revoke',
    revokeFor: 'Revoke: grant of {email}',
    revokeTitle: 'Revoke {email} as a professional?',
    search: 'Search by email',
    sortBy: { email: 'email', grantedAt: 'grant date', links: 'number of links' },
    title: 'Professionals'
  },

  /* `/admin/catalogo/calidad` (`0071`): what the catalogue should satisfy and does not, and the step rewrite's state. */
  adminQuality: {
    historyCalls: 'Calls',
    historyChart: 'What each run did, by day',
    historyCost: 'Cost',
    historyCostChart: 'Rewrite spend by day',
    historyCostSeries: 'Cost',
    historyEmpty: 'No run rewrote or spent anything in this period.',
    historyNoData: 'No data',
    historyNote: 'By Madrid day, within the period.',
    historyPending: 'Pending at the end',
    historyRunsCaption: 'Days the rewrite was active',
    historyRunsEmpty: 'No run or call in this period.',
    historyRunsHeader: 'Runs',
    historySeries: { heldByCap: 'Held by the cap', rewritten: 'Rewritten', skipped: 'Skipped', unreached: 'Not reached' },
    historyTitle: 'Rewrite history',
    historyTotal: 'Total',
    howCounted: [
      'Everything is worked out now, over every recipe, with the same sums the scheduler uses: no figure is stored. Each link opens Recipes with exactly the recipes counted.',
      'Meals with servings out of range are meals stored with a serving outside the scheduler’s limits. They are only counted: no meal is shown.',
      'Over the cap is a dish that passes its meal’s maximum kcal without passing the limit for one serving. Size rejections are dishes the model proposed and the service dropped for passing that limit, per Madrid day.',
      'Failed pictures are the ones that failed because of the dish itself. Those left for the cap or the key do not count.',
      'The step rewrite counts each recipe once: current, pending or given up. With refusals are the ones refused at least once without reaching the limit; a recipe can also be pending.',
      'The rewrite history sums, per Madrid day, what each night’s run did: rewritten, skipped, not reached and held by the spend cap (a held run counts only there). Pending is the day’s last run’s value. Calls and cost are the rewrite feature’s; the cost is a floor when a call carried none.'
    ],
    intro: 'What the catalogue should satisfy and does not, and how the step rewrite is going.',
    lookChart: 'Size rejections per day',
    lookEmpty: 'No dish was rejected for its size in this period.',
    lookLabel: 'Figures worth a look',
    lookNote: 'Not defects: worth a look now and then.',
    lookSeries: 'Dishes rejected',
    lookTitle: 'Worth a look',
    openRecipes: 'See the recipes',
    overCapBySource: 'Over their meal’s cap, by source',
    picturesFailed: 'Pictures failed for the dish itself',
    rejectionsTitle: 'Dishes rejected for size',
    status: { ok: 'Fine', warn: 'Check' },
    sweep: { current: 'Current', givenUp: 'Given up', pending: 'Pending', withRefusals: 'With refusals' },
    sweepNote: 'Steps version {version}. A recipe is given up after {bound} refusals.',
    sweepOf: 'of {total} recipes',
    sweepTitle: 'Step rewrite',
    tilesLabel: 'The rewrite’s state',
    title: 'Quality',
    zero: {
      mealsOutsideServingBounds: 'Meals with servings out of range',
      overBound: 'Recipes past the limit for one serving',
      refusalLimit: 'Recipes the rewrite has given up on',
      uncosted: 'Recipes without computable macros',
      unserved: 'Dishes that fit no meal'
    },
    zeroLabel: 'Figures that should be zero',
    zeroNote: 'A figure above zero is a defect upstream. Those with a link open the recipes counted.',
    zeroTitle: 'Should be zero'
  },

  adminRecipes: {
    acceptedByHand: 'Accepted by hand, against the checker',
    bySlotChart: 'Recipes by meal',
    bySlotEmpty: 'The catalogue has no recipe.',
    bySlotSeries: 'Recipes',
    bySlotTitle: 'By meal',
    caption: 'Recipes',
    check: 'Quality',
    checks: {
      over_bound: 'Past the limit for one serving',
      over_cap: 'Over their meal’s cap',
      refusal_limit: 'Rewrite given up',
      uncosted: 'Without computable macros',
      unserved: 'Fits no meal'
    },
    columns: {
      allergens: 'Allergens',
      carbs: 'Carbs (g)',
      fat: 'Fat (g)',
      kcal: 'kcal',
      locale: 'Language',
      mayContain: 'Traces',
      meals: 'Meals',
      name: 'Name',
      picture: 'Picture',
      protein: 'Protein (g)',
      source: 'Source'
    },
    containsAllergen: 'Contains the allergen',
    empty: 'The catalogue has no recipe.',
    howCounted: [
      'Figures are per serving, from the recipe’s ingredients, with the same sum the app uses. A recipe that cannot be costed shows —.',
      'Allergens and traces are the dish’s label, not anybody’s allergy.',
      'A recipe that suits two meals counts in both on the chart.',
      'Without a picture counts every recipe with no ready picture: those being drawn or that failed too.',
      'The catalogue is everybody’s: nothing here says who asked for each recipe.',
      'A failed or given-back picture can be retried by hand with “Retry”, without waiting the 7 days; only when drawing is on and the month’s cap allows it.',
      'A picture the checker rejected is kept for 7 days for you to look at: “Review the picture” opens it, and from there it is accepted, discarded or retried. While it is kept, the dish is not drawn on its own.',
      'Any ready picture can be removed, whether the checker accepted it or you did by hand: “Review the picture” opens its page, with the dish’s ingredients, and it is removed from there. One you accepted by hand, against the checker, says so on its row, and the picture filter “Ready, accepted by hand” gathers them.'
    ],
    intro: 'The recipe catalogue: how many, for which meal, and where they came from.',
    locales: { 'en-GB': 'English', 'es-ES': 'Spanish' },
    noMatch: 'No recipe matches the search or the filters.',
    pictureFilters: { accepted_by_hand: 'Ready, accepted by hand', drawing: 'Being drawn', failed: 'Failed', none: 'No picture', ready: 'Ready' },
    pictures: { drawing: 'Being drawn', failed: 'Failed', none: 'No picture', ready: 'Ready' },
    retry: 'Retry',
    retryFor: 'Retry the picture of {dish}',
    retryFrom: 'Tries again on its own from {date}',
    retrying: 'Retrying…',
    retryNext: 'Tries again on its own on the next view',
    retryStarted: 'Being drawn',
    retryTooMany: 'Too many retries: wait a while and try again.',
    review: 'Review the picture',
    reviewFor: 'Review the picture of {dish}',
    search: 'Search by name',
    slot: 'Meal',
    sortBy: { kcal: 'kcal per serving', name: 'name', protein: 'protein per serving' },
    sources: { ai: 'AI', seed: 'Seed', user: 'User' },
    tableTitle: 'All recipes',
    tiles: { ai: 'Generated by AI', seed: 'From the seed', total: 'Recipes', user: 'Made by users', withoutImage: 'Without a picture' },
    tilesLabel: 'The catalogue’s figures',
    title: 'Recipes'
  },

  /* `/admin/personas/retencion` (`0071`): sign-up cohorts and how many were active later. Counts of people, no id, no link (`0028`). */
  adminRetention: {
    cohort: 'Cohort',
    cohortsLabel: 'Cohorts',
    didNote:
      'Someone with a meal completed, a swap, a check-in or a progress entry that week. It is approximate: someone who only opens the app is not counted.',
    didTable: 'Cohorts that did something',
    didTitle: 'Did something (approximate)',
    empty: 'Nobody signed up in these cohorts.',
    hidden: 'A dash (—) is a cell with no figure: either fewer than {min} eligible people, or that week has not happened yet.',
    howCounted: [
      'A cohort is the people who signed up in that month. A cell reads “active / eligible”: the eligible are those who have already lived that whole week.',
      'Week 1 is the seven days that begin seven days after each person’s own sign-up; week 2, fourteen; week 4, twenty-eight.',
      'A cell is shown only from {min} eligible people; with more it also carries the percentage. Below that, a dash (—): the figure is not shown.',
      'The two versions count different people for the same cohort: “Used the app” only counts people who signed up from {since}.',
      'There are no links and no names: a cell is a count, not a list of people.'
    ],
    intro: 'How many people are still active one, two and four weeks after signing up.',
    notYet: 'No figure: that week has not happened yet',
    size: 'People',
    title: 'Retention',
    tooFew: 'No figure: fewer than {min} eligible people',
    usedNote: 'Someone who signed in or used the app that week. It only counts people who signed up from {since}; the columns fill in from {from}.',
    usedTable: 'Cohorts that used the app',
    usedTitle: 'Used the app',
    week: 'Week {weeks}'
  },

  /* `/admin/ajustes`: the five switches and the push test, grouped by what they govern. */
  adminSettings: {
    access: 'Access',
    intro: 'The switches that run the service. Under each one, what is true right now.',
    notifications: 'Notifications',
    product: 'Product',
    title: 'Switches'
  },

  /* `/admin`: the period's headline figures, two trends, and what needs the owner now. */
  adminSummary: {
    activePeople: 'Active people',
    failedInPeriod: '{count} failed in the period',
    generationsChart: 'Generations per day',
    generationsEmpty: 'No generation in this period.',
    howCounted: [
      'Every figure with an arrow is compared with the previous period of the same length.',
      'Active people counts each person once over the whole period, whether they signed in on one day or on many. Active means signed in or used the app; until {date} it counted sign-ins only.',
      'Successful generations are the finished ones out of those finished or failed that started in the period. Those still queued or running do not count.',
      'Each generation on the chart counts in the state it is in now.',
      'Not activated includes the accounts that have not confirmed their address yet.',
      'The picture cap counts the calendar month in UTC, not the period.',
      'Text AI spend is what the text models billed: the dishes for plans and the nightly step rewrites. Pictures are apart.'
    ],
    intro: 'How the service is doing in the chosen period, against the previous period of the same length.',
    needsYou: {
      failed: 'Failed generations in the last 24 h',
      title: 'Needs you',
      unread: 'Unseen messages',
      waiting: 'Accounts waiting for activation'
    },
    newAccounts: 'New accounts',
    noneFinished: 'None finished in the period',
    outcomes: { failed: 'Failed', pending: 'Queued or running', succeeded: 'Finished' },
    pictureMonth: 'This month: {spent} of {cap}',
    pictureSpend: 'Picture spend',
    plansGenerated: 'Plans generated',
    previousRate: 'Previous period: {rate}',
    signUpsChart: 'Sign-ups per day',
    signUpsEmpty: 'Nobody signed up in this period.',
    signUpsSeries: 'Sign-ups',
    successRate: 'Successful generations',
    textAiSpend: 'Text AI spend',
    textMonth: 'This month: {spent} of {cap} ({share})',
    textMonthOver: 'Over the cap; rewrite paused',
    textMonthPaused: 'Nightly rewrite paused',
    tilesLabel: 'The period’s figures',
    title: 'Overview',
    total: 'Total',
    totalAccounts: 'Accounts',
    trendsTitle: 'Trends',
    unreadMessages: 'Unseen messages',
    waitingAccounts: 'Not activated'
  },

  /* `/admin/ajustes/sistema` (`0071`): the deployed commit, versions, caps, integrations yes or no, each cron's last run and mail sent. */
  adminSystem: {
    caps: {
      oversizedFactor: 'A dish is rejected past this multiple of its meal’s cap',
      pictureMonthlyUsd: 'Monthly cap for pictures',
      rewriteAttemptBound: 'Refusals before the rewrite gives up on a recipe',
      servingBounds: 'Servings a meal is sized between',
      servingKcal: 'kcal cap per serving, {slot}'
    },
    capsTitle: 'Limits',
    columns: { item: 'Item', job: 'Job', lastRun: 'Last run', state: 'State', template: 'Template', value: 'Value' },
    commit: 'Deployed version',
    commitNone: 'Unknown',
    cronCaption: 'Scheduled jobs',
    cronEmpty: 'No jobs.',
    cronNever: 'Never',
    cronNote: 'Stale if it has gone more than {hours} h without finishing.',
    crons: {
      activations: 'Plan activation',
      reminders: 'Check-in reminders',
      rewrite: 'Step rewrite',
      twoFactorRemovals: 'Second factor removals',
      verifications: 'Expired link cleanup'
    },
    cronState: { ok: 'On time', stale: 'Stale' },
    cronTitle: 'Scheduled jobs',
    howCounted: [
      'No configuration value, key or address appears here: only yes or no, versions, dates and limits.',
      'A scheduled job is stale if its last finished run is over 26 hours old, or it has never finished. Runs are kept since {date}: until the first one lands, every job reads “Never”.',
      'Mail is counted since {date}, per template and Madrid day. Sent means handed to the provider, not read. No recipient is kept.',
      'The deployed version is given by the platform on each deploy.'
    ],
    integrations: {
      cronSecret: 'Scheduled jobs’ secret',
      mail: 'Mail',
      ownerAddress: 'Owner’s address for alerts',
      pictures: 'Dish pictures',
      push: 'Push notifications',
      rewriteSweep: 'Nightly step rewrite',
      sentry: 'Error tracking'
    },
    integrationsTitle: 'Integrations',
    intro: 'Which version is running, with which limits, what is set up and whether jobs and mail work.',
    mailCaption: 'Mail by template',
    mailChart: 'Mail per day',
    mailEmpty: 'No mail left in this period.',
    mailKinds: {
      'account-waiting': 'Account waiting',
      'backup-code-used': 'Backup code used',
      'backup-codes-regenerated': 'New backup codes',
      'care-invitation': 'Link invitation',
      'check-in-reminder': 'Check-in reminder',
      'checkin-submitted': 'Check-in submitted',
      'owner-alert': 'Alert to the owner',
      'owner-digest': 'Daily digest to the owner',
      'owner-picture-alert': 'Picture alert to the owner',
      'passkey-added': 'Passkey added',
      'password-changed': 'Password changed',
      'password-reset': 'Password reset',
      'professional-granted': 'Professional profile granted',
      'two-factor-disabled': 'Second factor turned off',
      'two-factor-enabled': 'Second factor turned on',
      'two-factor-removal-cancelled': 'Second factor removal cancelled',
      'two-factor-removal-requested': 'Second factor removal requested',
      'two-factor-removed': 'Second factor removed',
      'verify-email': 'Confirm email'
    },
    mailSeries: { failed: 'Failed', sent: 'Sent' },
    mailTitle: 'Mail',
    no: 'No',
    title: 'System',
    versions: {
      careConsent: 'Link consent',
      healthConsent: 'Health data consent',
      professionalAgreement: 'The professional’s agreement',
      profileConsent: 'Profile consent',
      prompt: 'Dish generation prompt',
      steps: 'Step rewrite prompt',
      terms: 'Terms of use'
    },
    versionsTitle: 'Versions',
    yes: 'Yes'
  },

  appNav: {
    brandHome: 'NutrIA — home',
    consulta: 'Practice',
    home: 'Home',
    mainLabel: 'Main navigation',
    plan: 'Plan',
    profile: 'Profile',
    progress: 'Progress',
    sectionsLabel: 'Sections',
    shopping: 'Shopping',
    signOut: 'Sign out'
  },

  auth: {
    askNewLink: 'Ask for a new link',
    backToSignIn: 'Back to sign in',
    checkEmail: 'Check your email',
    chooseNewPassword: 'Choose a new password',
    chooseNewPasswordSubtitle:
      'You will be able to sign in with it afterwards. If you had passkeys, we remove them: you can add them again from your profile.',
    confirmPassword: 'Repeat the password',
    continueWith: 'Continue with {provider}',
    createAccount: 'Create your account',
    createAccountSubtitle: 'A few minutes of questions and you will have your first fourteen-day plan.',
    email: 'Email address',
    emailTaken: 'An account with that email already exists.',
    forgotPassword: 'Forgotten your password?',
    goToAccount: 'Go to my account',
    haveAccount: 'Already have an account?',
    invalidCredentials: 'Wrong email or password.',
    invalidLink: 'This link is not valid, or it has expired.',
    legalAge: 'You need to be at least 18 to create an account.',
    legalNotice: 'By creating your account you accept the {terms}. How we handle your data is explained in the {privacy}.',
    legalNoticeSignIn:
      'If this is the first time you sign in with Google or Apple, your account is created and you accept the {terms}. How we handle your data is explained in the {privacy}.',
    legalOpensInTab: ' (opens in a new tab)',
    legalPrivacy: 'privacy policy',
    legalTerms: 'terms of use',
    name: 'Name',
    newPassword: 'New password',
    noAccount: 'No account yet?',
    orWithEmail: 'or with your email',
    password: 'Password',
    passwordCompromised: 'That password appears in known data breaches. Choose another: a phrase of several words is best.',
    passwordHasContext: 'The password cannot contain your name, your email or “nutria”. Choose another.',
    passwordHint: 'At least {count} characters.',
    passwordMeterEnough: 'Length: enough.',
    passwordMeterLong: 'Length: good.',
    passwordMeterMissing: '{count} more characters needed.',
    passwordMeterMissingOne: '1 more character needed.',
    passwordMeterShort: 'Length: too short.',
    passwordMeterTooLong: 'Length: too long.',
    passwordsDoNotMatch: 'The passwords do not match.',
    passwordStrengthHint: 'A phrase of several words is best.',
    passwordTooLong: 'The password can be at most {count} characters.',
    passwordTooShort: 'The password must be at least {count} characters.',
    pendingBody: 'We are opening NutrIA a few people at a time. We will activate your account ({email}) as soon as we can and let you know by email.',
    pendingCheck: 'Check again',
    pendingConfirmBody: 'We have sent a link to {email}. Open it and you are in — nothing else is needed.',
    pendingConfirmTitle: 'Confirm your email',
    pendingConfirmWaitBody: 'We have sent a link to {email}. Confirm it, and you are in as soon as we open your account.',
    pendingSignOut: 'Sign out',
    pendingTitle: 'Account pending activation',
    recoverSent: 'If an account exists with that email, we have sent a link to reset the password. It expires in an hour.',
    recoverSubtitle: 'Enter your email and we will send you a link to choose a new one.',
    recoverTitle: 'Reset your password',
    savePassword: 'Save password',
    sending: 'Sending…',
    sendLink: 'Send link',
    signIn: 'Sign in',
    signingIn: 'Signing in…',
    signInSubtitle: 'Sign in to see today’s plan.',
    signInTitle: 'Welcome back',
    signInUnavailable: 'We could not sign you in (error {status}). Try again in a moment.',
    signUp: 'Create my plan',
    signUpFailed: 'We could not create the account. Please try again.',
    signUpPending: 'Creating your account…',
    socialFailed: 'We could not complete the sign-in. Try again, or sign in with your email.',
    socialNotLinked:
      'There is already an account with that address, and it has not been confirmed yet. Sign in with your password and confirm the email, or reset the password. After that you can sign in this way too.',
    tooManyAttempts: 'Too many attempts in a row. Wait a moment and try again.',
    toSignIn: 'Sign in',
    toSignUp: 'Create one',
    verifyBody: 'We have sent you a confirmation link. Open it on this device to activate your account.',
    verifyMeanwhile: 'In the meantime you can carry on setting up your profile: your plan is generated when you finish.',
    verifyTitle: 'Confirm your email'
  },

  care: {
    accessKinds: {
      health: 'your health record',
      list: 'your profile',
      overview: 'your profile',
      plan: 'your plan',
      progress: 'your progress',
      review: 'your plan review',
      targets: 'your targets'
    },
    accessLogEmpty: 'There is nothing to show here yet.',
    accessLogGranted: 'You started sharing {kind} with {professional}',
    accessLogGrantedGroup: 'You started sharing {kind} with {professional}, {count} times · {range}',
    accessLogLoaded: '{count} more entries loaded.',
    accessLogLoadMore: 'Show more',
    accessLogNoMore: 'No more entries to show.',
    accessLogRead: '{professional} viewed {kind}',
    accessLogReadGroup: '{professional} viewed {kind} {count} times · {range}',
    accessLogTitle: 'Who has accessed',
    accessLogWithdrawn: 'You stopped sharing {kind} with {professional}',
    accessLogWithdrawnGroup: 'You stopped sharing {kind} with {professional}, {count} times · {range}',
    accessLogWrite: '{professional} changed {kind}',
    accessLogWriteGroup: '{professional} changed {kind} {count} times · {range}',
    canDo: {
      plans: 'generate and change your plans',
      review: 'review each new plan before you see it; while they do, you carry on with the one you had',
      targets: 'set your daily targets, within the same safety bounds'
    },
    declineCta: 'No, thanks',
    end: 'End the link',
    endConfirmBody:
      'Your dietitian will stop seeing your data from now on. Your targets, your history and your last published plan stay with you, and the record of their access stays on your profile. Anything your dietitian already noted in their own clinical record they keep under their own rules. You can accept another invitation from them later.',
    endConfirmCta: 'Yes, end it',
    endConfirmTitle: 'End the link with {professional}?',
    healthQuestion: 'Also share my health conditions, medications and supplements',
    healthShareIntro: 'Besides the above, you can also share:',
    healthShareNote: 'It is optional and separate. You can turn it on or stop sharing it at any time from your profile, without ending the link.',
    healthShareOffHint: 'Your dietitian stops seeing them as soon as you turn it off. The link stays active.',
    healthShareOnHint: 'Your dietitian can see them.',
    healthShares: { conditions: 'your health conditions', medications: 'your medications', supplements: 'your supplements' },
    healthShareToggle: 'Share my health conditions, medications and supplements',
    invitationAccept: 'Accept the invitation',
    invitationCanDoIntro: 'And they will be able to:',
    invitationIntro:
      '{professional}, a registered dietitian-nutritionist (registration number {collegiateNumber}), invites you to follow your plan with their help on NutrIA.',
    invitationLinkExistsBody: 'You already have a dietitian linked: {professional}, since {since}.',
    invitationLinkExistsCta: 'See my profile',
    invitationLinkExistsTitle: 'You already have an active link',
    invitationNotShared: 'They will not see your allergies, your intolerances or your email address.',
    invitationPrivacy:
      'NutrIA discloses this data to {professional} because you ask it to. Your dietitian uses it to care for you, under professional secrecy, and is responsible for what they do with it in their practice. You can end the link at any time. More in the {privacy}.',
    invitationShareIntro: 'If you accept, {professional} will see:',
    invitationTitle: 'Invitation from {professional}',
    invitationTrail: 'Every time they look at or change something, you will see it on your profile.',
    linkSince: 'Since {date}',
    linkTitle: 'Your dietitian',
    shares: {
      checkIns: 'your check-in answers (not your written comments)',
      mealPlans: 'your meal plan and earlier ones',
      profile: 'your name',
      progress: 'how much of each fortnight you follow and your weight over time',
      targets: 'your daily targets and how they were worked out'
    },
    whatIsShared: 'Shares: {list}'
  },

  categories: {
    bakery: 'Bakery',
    beverages: 'Drinks',
    dairy: 'Dairy',
    frozen: 'Frozen',
    other: 'Other',
    pantry: 'Cupboard',
    produce: 'Fruit and veg',
    protein: 'Meat and fish'
  },

  checkIn: {
    adherence: 'You marked {completed} of {marked} meals as eaten ({percent} %).',
    adherenceNone: 'You did not mark meals as eaten or skipped this fortnight; that is fine.',
    alreadyBody: 'Your last plan has its check-in. Create the next one whenever you like.',
    alreadyTitle: 'This fortnight is already closed',
    backHome: 'Back to home',
    comments: 'What would you change?',
    commentsHint:
      'Optional. In your words: dishes, timing, anything. It is kept with your check-in, but no longer reaches the model or changes the plan.',
    difficulty: 'How was following the plan?',
    difficultyEasy: 'Easy',
    difficultyHard: 'Hard',
    difficultyOk: 'Manageable',
    doneBody: 'Thank you. Here is what changes:',
    doneNoTargets: 'Targets unchanged.',
    doneTargets: 'Calorie target: from {from} to {to} kcal a day.',
    doneTitle: 'Fortnight closed',
    doneWeight: 'Weight logged: the targets are computed from it now.',
    hunger: 'How were the portions?',
    hungerHungry: 'I was left hungry',
    hungerRight: 'Right',
    hungerTooMuch: 'Too much',
    intro:
      'Five questions. Your weight adjusts the targets and your answers move the portions 5 % up or down. What you write is kept with the check-in, but no longer reaches the model or changes the plan.',
    nextPlan: 'Create my next plan',
    notYetBody: "The check-in opens on the plan's last day.",
    notYetTitle: 'Not yet',
    satisfaction: 'How would you rate the fortnight?',
    submit: 'Close the fortnight',
    submitting: 'Saving…',
    title: 'Fortnight check-in',
    weight: 'Weight today (kg)',
    weightHint: "Optional. If you give it, next fortnight's targets are computed from it."
  },

  common: {
    add: 'Add',
    back: 'Back',
    cancel: 'Cancel',
    close: 'Close',
    continue: 'Continue',
    edit: 'Edit',
    finish: 'Finish',
    none: 'None',
    noneMasculine: 'None',
    remove: 'Remove',
    retry: 'Try again',
    save: 'Save',
    saving: 'Saving…'
  },

  conditions: {
    breastfeeding: 'Breastfeeding',
    chronic_kidney_disease: 'Chronic kidney disease',
    coeliac: 'Coeliac disease',
    gerd: 'Acid reflux',
    gout: 'Gout',
    hypercholesterolemia: 'High cholesterol',
    hypertension: 'High blood pressure',
    hypothyroidism: 'Underactive thyroid',
    ibs: 'Irritable bowel syndrome',
    lactose_intolerance: 'Lactose intolerance',
    pcos: 'Polycystic ovary syndrome',
    pregnancy: 'Pregnancy',
    type_1_diabetes: 'Type 1 diabetes',
    type_2_diabetes: 'Type 2 diabetes'
  },

  dashboard: {
    activePlan: 'Your plan is active',
    availableNow: 'available now',
    checkIn: '· next review {when}',
    checkInDoneNote: 'Check-in done. Create the next plan whenever you like.',
    checkInDueBody:
      'Fourteen days are up. Take a minute to tell us how it went: weight, portions and what you would change. The next plan will take it into account.',
    checkInDueCta: 'Do the check-in',
    checkInDueTitle: 'Your fortnight check-in',
    dayOf: 'Day {current} of {total}',
    daysLeft: '{count} days to go',
    fortnight: 'Your fortnight',
    fortnightDay: 'Day {index}',
    goodAfternoon: 'Good afternoon',
    goodEvening: 'Good evening',
    goodMorning: 'Good morning',
    greetingNamed: '{greeting}, {name}.',
    inDays: 'in {count} days',
    lastDay: 'Last day',
    nextMeal: 'Up next',
    nextMealNone: 'Nothing left for today.',
    nextPlanBody: 'It is ready. You can look at its days and get the shopping done ahead.',
    nextPlanDays: 'See its days',
    nextPlanShopping: 'See its shopping list',
    nextPlanTitle: 'Your next plan starts on {date}',
    nextPlanWaitingBody: 'Its first day has not come yet, so there are no meals to show. You can look at its days and get the shopping done ahead.',
    noPlanBody: 'We have everything we need about you. We will build fourteen complete days with recipes, quantities and the shopping list written.',
    noPlanCta: 'Create my plan',
    noPlanTitle: 'No plan yet',
    ofTarget: '{value} of {target} {unit}',
    pendingReviewBody: 'Your dietitian is reviewing it before publishing. In the meantime, carry on with the plan you already had.',
    pendingReviewTitle: 'Your new plan is with your dietitian',
    planEndedBody: 'Your plan has reached the end of its fourteen days. Create the next one whenever you like.',
    planEndedCta: 'Create my next plan',
    planEndedTitle: 'Your plan has finished',
    profileComplete: 'Your profile is complete.',
    seeAllDays: 'See all 14 days →',
    seePreviousPlan: 'See the previous plan',
    shoppingCount: '{items} items across {aisles} aisles',
    shoppingCta: 'See the list →',
    shoppingTitle: 'Your shopping list',
    targetsAdjust: 'Adjust →',
    targetsClamped:
      'We adjusted your pace: it asked for {requested} kcal and we raised it to {floor}, the daily minimum we consider safe without professional supervision.',
    targetsEstimate: 'These are an estimate from your profile. You can adjust them.',
    targetsLabel: 'Your daily targets · {status}',
    targetsStatusEstimated: 'estimated',
    targetsStatusOverridden: 'set by you',
    today: 'Today',
    todayVsTarget: 'Today, against your targets',
    tomorrow: 'tomorrow',
    weightLog: 'Log',
    weightMore: 'See how it is going →',
    weightNone: 'No weight logged yet.',
    weightPlaceholder: 'kg',
    weightSince: '{change} kg since your first entry',
    weightStable: 'No change since your first entry',
    weightStart: 'You started at {value} kg',
    weightTitle: 'Your weight',
    weightToday: 'Today'
  },

  errors: {
    accountNotActivated: 'Your account has not been activated yet.',
    boundaryBody: 'It may be an intermittent connection. Try again; if it keeps failing, your data is safe.',
    boundaryHome: 'Go to the dashboard',
    boundaryTitle: 'We could not load this page',
    careLinkExists: 'You already have a dietitian linked.',
    conflict: 'That is already in use.',
    emailNotVerified: 'Confirm your email to continue.',
    internal: 'Something went wrong at our end. Try again in a moment.',
    invalidInput: 'Check the fields marked.',
    mealInFuture: 'You cannot mark this meal yet: its day has not come.',
    network: 'We could not connect. Check your connection.',
    notFound: 'We could not find what you were looking for.',
    notFoundTitle: 'Page not found',
    onboardingIncomplete: 'Part of your profile is missing. Finish it and try again.',
    passwordChangeRequired: 'You need to change your password before you carry on.',
    pictureAllergensMismatch:
      'The picture waiting for review has changed since you opened the page: what the checker flagged is no longer what you saw. Reload and look at it again.',
    pictureCapReached: 'This month’s picture spend has reached the cap: no more can be drawn until next month.',
    pictureDrawing: 'That picture is already being drawn.',
    pictureFlagOff: 'Drawing pictures is off. Turn it on in Settings and try again.',
    pictureNoCandidate: 'That picture is no longer kept: it was accepted, discarded, retried, or its 7 days passed.',
    pictureNotAcceptable:
      'That picture cannot be accepted: its file is not a JPEG with the C2PA signature that marks it as AI-generated. Discard it or retry.',
    pictureNotRemovable: 'That picture cannot be removed: the dish no longer has a published picture.',
    pictureNotRetryable: 'That picture cannot be retried: it is no longer failed.',
    pictureUnavailable: 'Pictures are not available right now: the provider’s key or service is missing.',
    planPaused: 'Your plan is paused while you are away.',
    practiceFull: 'Your practice already has all the clients your plan includes.',
    profileConsentRequired: 'We need your consent to handle your health data.',
    quotaExceeded: 'You have used up what your plan allows this fortnight.',
    reauthenticationRequired: 'For your security, sign out, sign back in and try again.',
    request: 'We could not complete that action.',
    /** The console's second factor removal (project 011, phase 4). */
    twoFactorNotEnabled: 'This account no longer has the second factor on.',
    twoFactorRemovalPending: 'A removal was already pending for this account: its date is on its row.',
    underMinimumAge: 'NutrIA is for adults, 18 and over.',
    unsafeContent: 'That content does not meet your dietary restrictions.'
  },

  events: {
    add: 'Add',
    addedMidPlan: 'Added. The days before it have been rebuilt to eat for it.',
    addedNow: 'Added. This plan will be built with it.',
    cancel: 'Remove',
    cancelFor: 'Remove {name} on {date}',
    carbs: 'Carbs',
    daysBefore: 'Days before',
    daysBeforeMany: 'The {count} days before',
    daysBeforeOne: 'The day before',
    down: 'Lower',
    fat: 'Fat',
    full: 'You have added the {limit} events a plan holds. Remove one to add another.',
    left: '{remaining} of {limit} events left for this plan.',
    leftOne: '1 event of {limit} left for this plan.',
    less: 'less',
    loading: 'already eating for this',
    midPlanFull: 'This plan takes no more events while under way. The next one goes in when the next plan is built.',
    midPlanIntro: 'A race that was not there when the plan was built: add it and the days before it are rebuilt to eat for it.',
    midPlanLeft: 'You can add {remaining} more events with the plan under way.',
    midPlanLeftOne: 'You can add 1 more event with the plan under way.',
    more: 'more',
    name: 'What it is',
    namePlaceholder: 'Half marathon, match, Hyrox…',
    nothingMoves: 'At least one has to go up or down.',
    nowIntro: 'A race, a match, a long session: if it falls in the next two weeks, add it now and the plan is built around it.',
    nowTitle: 'Days that eat differently',
    on: 'When',
    protein: 'Protein',
    removed: 'Event removed.',
    same: 'Same',
    shapeLabel: 'What changes on the days before',
    title: 'Events',
    up: 'Raise'
  },

  feedback: {
    intro: 'A person reads this: me. Tell me what is missing, what is in the way, or what does not work.',
    kinds: { idea: 'An idea', other: 'Something else', problem: 'Something is broken' },
    kindsLabel: 'What is this about?',
    messageLabel: 'Your message',
    placeholder: 'Write here…',
    send: 'Send',
    thanks: 'Got it. Thanks for taking the time.',
    title: 'What would you improve?'
  },

  footer: {
    account: 'Account',
    createAccount: 'Create account',
    disclaimer:
      'NutrIA produces general meal plans. It does not replace advice from a doctor or a registered dietitian. Speak to a professional if you have a medical condition, are pregnant, or take medication.',
    legal: 'Legal',
    privacyPolicy: 'Privacy',
    product: 'Product',
    signIn: 'Sign in',
    tagline: 'Nutrition that adapts to you.',
    terms: 'Terms'
  },

  generation: {
    abandonedBody: 'The server restarted while we were preparing your plan. Nothing has been saved half-finished.',
    abandonedTitle: 'It was interrupted',
    aiUnavailableBody:
      'Your AI provider is configured but rejected the request. It is usually the key (ANTHROPIC_API_KEY or GOOGLE_API_KEY), the model name in AI_MODEL, or a free quota that has run out. The exact detail is in the server log.',
    aiUnavailableTitle: 'The AI provider failed',
    back: 'Back',
    completeProfile: 'Finish my profile',
    couldNotStart: 'We could not start',
    failedBody: 'Something went wrong at our end. Nothing was saved, so you can try again.',
    failedTitle: 'We could not create your plan',
    invalidPlanBody: 'We built a plan but it was missing meals or crossed a safety limit, so we discarded it rather than give it to you. Try again.',
    invalidPlanTitle: 'The plan did not come out right',
    onboardingIncompleteBody: 'We are missing information about you before we can work out what you need.',
    onboardingIncompleteTitle: 'Your profile is unfinished',
    poolTooSmallBody:
      'We do not yet have enough recipes that fit your restrictions, and no AI provider is configured, so we cannot create the missing ones. Set AI_PROVIDER on the server, or wait for the recipe library to grow.',
    poolTooSmallTitle: 'We are short of recipes',
    profileConsentRequiredBody: 'We need your consent to handle your health data before we can work out your plan.',
    profileConsentRequiredTitle: 'Your consent is missing',
    profileIncompleteBody: 'We need your date of birth, height, sex, weight and activity level to work out your targets.',
    profileIncompleteTitle: 'Your profile is missing information',
    quotaExceeded: 'You have already redone your plan this fortnight. The next one opens on {date}.',
    rateLimited: 'You have asked for several plans in a row. Wait a moment before trying again.',
    readyBody:
      'We build it from what we already know about you. Before it starts, check the days that will eat differently: once it is under way, adding one means redoing the plan.',
    readyTitle: 'Your two-week plan',
    safetyNote: 'We check your allergies before saving anything.',
    serverDetail: 'Server detail:',
    start: 'Build my plan',
    startDate: {
      chosen: 'Your plan starts on {date}.',
      free: 'Free',
      legend: 'When does your plan start?',
      noRedo: 'No redos left',
      redoNote: 'It counts as a redo: the days of your plan that overlap the new one are replaced.',
      spentNote: 'You have used this plan’s redo. You can choose a day from {date}.',
      today: 'Today',
      tomorrow: 'Tomorrow',
      usesRedo: 'Uses a redo'
    },
    starting: 'Starting…',
    steps: {
      BUILDING_LIST: 'Putting your shopping list together',
      CHOOSING_RECIPES: 'Choosing recipes',
      LOADING_PROFILE: 'Reading your profile',
      SAVING_PLAN: 'Saving your plan',
      SCHEDULING_MEALS: 'Spreading the meals across the 14 days',
      VALIDATING_PLAN: 'Checking everything adds up'
    },
    timedOutBody: 'The model did not finish in time. Nothing was saved half-finished, so you can try again.',
    timedOutTitle: 'It took too long',
    title: 'We are building your plan',
    unsafeBody:
      'We blocked the plan because a meal did not respect your allergies. We would rather give you nothing than give you something you cannot eat.',
    unsafeTitle: 'We blocked it for safety',
    wait: 'It takes a couple of minutes. You can leave this page open.'
  },

  goals: {
    healthy_eating: 'Eating well',
    maintenance: 'Maintenance',
    muscle_gain: 'Build muscle',
    performance: 'Performance',
    weight_loss: 'Lose weight'
  },

  health: {
    addSuggestionLink: 'the allergies step',
    applied: 'Because of your {condition} we exclude {allergen} from every plan, exactly as if it were a declared allergy.',
    conditions: 'Conditions',
    conditionsOther: 'Other',
    conditionsOtherHint: 'Separate with commas. We do not interpret what you write here.',
    consentLabel: 'Store this health data to personalise my plans',
    consentNote:
      'They are kept in your account, never appear in server logs and are deleted with your account. They are never sent to any AI model: only their effect is, such as the ingredients we remove for coeliac disease. If you work with a dietitian, they only see them if you allow it separately. You can delete them separately with the button below.',
    consentStale: 'We have updated how we explain the use of this data. Review it and save again to keep it.',
    intro: 'Optional. None of this is required to use NutrIA, and you can delete all of it whenever you like.',
    medications: 'Medication',
    medicationsHint: 'The name only. We do not ask for a dose because we do nothing with it.',
    medicationsLabel: 'Medicines',
    medicationsNote:
      'We do not cross-reference medicines with food or look for interactions. That is your doctor’s or pharmacist’s job, and doing it here would mean making it up.',
    suggestion:
      'We could exclude {allergen} because of your {condition}, but we do not do it on our own: many people tolerate small amounts. If you want us to, add it to your intolerances in',
    supplementAdd: 'Add a supplement',
    supplementKind: 'Type',
    supplementKinds: {
      creatine: 'Creatine',
      omega_3: 'Omega-3',
      other: 'Other',
      protein: 'Protein powder',
      vitamins_minerals: 'Vitamins and minerals'
    },
    supplementName: 'Name',
    supplementProtein: 'Protein per serving (g)',
    supplementProteinLabel: 'Protein from supplements',
    supplementProteinTotal: '{grams} g per day,',
    supplementProteinTotalEmphasis: 'on top of',
    supplementProteinTotalTail: 'what the plan provides.',
    supplements: 'Supplements',
    supplementServings: 'Servings per day',
    supplementsHint: 'Protein powder only goes into your recipes if you record a protein supplement here.',
    title: 'Health',
    withdraw: 'Delete all my health data'
  },

  landing: {
    ctaPrimary: 'Create my plan',
    ctaSecondary: 'How it works',
    eyebrow: 'A new plan every fortnight',
    faq: [
      {
        answer: 'Fourteen days. Long enough for a change to show, short enough to correct course before you get bored of it.',
        question: 'Why fourteen days?'
      },
      {
        answer: 'Yes. Swap any meal for another that respects your restrictions and fits the day’s targets. The plan rebalances itself.',
        question: 'Can I change a meal I don’t fancy?'
      },
      {
        answer: 'They are removed from the catalogue entirely. If traces affect you too, we also drop anything marked “may contain”.',
        question: 'How do you handle allergies?'
      },
      {
        answer:
          'No. NutrIA is a meal-planning tool. If you have a medical condition, are pregnant, or take medication, speak to a healthcare professional.',
        question: 'Does this replace a dietitian or my doctor?'
      },
      {
        answer:
          'All of them. Past plans are kept with their recipes, their shopping lists and your notes, and you can look them up whenever you like.',
        question: 'What happens to my previous plans?'
      },
      {
        answer: 'You can delete your account whenever you want from settings. Everything goes: profile, plans, progress and conversations.',
        question: 'Can I delete my data?'
      }
    ],
    faqTitle: 'Frequently asked questions',
    features: [
      { body: 'Fourteen full days with recipes, quantities and timings. No deciding what to cook at nine at night.', title: 'Fourteen-day plans' },
      {
        body: 'Not in the mood? Ask for something quicker, cheaper, no-cook or higher in protein. It recalculates on the spot.',
        title: 'Swap any meal'
      },
      {
        body: 'One list per plan, grouped by aisle with the quantities already added up. Three loose tomatoes become 450 g.',
        title: 'Shopping list, done for you'
      },
      {
        body: 'Weight, adherence, energy and hunger. Only the trends that mean something, without turning it into an exam.',
        title: 'Progress without obsession'
      },
      {
        body: 'Your allergies and intolerances are applied as a system filter, not as an instruction to a model.',
        title: 'Allergies are a hard limit'
      },
      { body: 'Ask for a substitution, why we chose a dish, or what to buy tomorrow. It knows your plan.', title: 'Nutrition assistant' }
    ],
    finalCtaTitle: 'Stop deciding what’s for dinner.',
    finalLede: 'Tell us how you live and you will have fourteen days sorted, with the shopping list already written.',
    heroNote: 'No card needed. Your plan is ready as soon as you finish the questions.',
    lede: 'Personalised meal plans built around your goals, your preferences and your life. Adjusted every fortnight according to what actually works for you.',
    personalisationLede:
      'Goal, age, activity, the cooking you like, the foods you never want to see again. It all goes into the calculation, and it can all be changed later.',
    personalisationTitle: 'Your plan knows you skip breakfast.',
    preview: {
      adherence: 'Adherence',
      adherenceValue: '72%',
      dayOf: 'Day 6 of 14',
      meals: [
        { kcal: '410 kcal', name: 'Greek yoghurt bowl with fruit and oats', slot: 'Breakfast' },
        { kcal: '620 kcal', name: 'Rice with chicken, pepper and broccoli', slot: 'Lunch' },
        { kcal: '180 kcal', name: 'An apple and a handful of almonds', slot: 'Afternoon snack' },
        { kcal: '540 kcal', name: 'Baked hake with potato and salad', slot: 'Dinner' }
      ],
      nextReview: 'Next review',
      nextReviewValue: 'In 8 days',
      shopping: 'Shopping list',
      shoppingValue: '18 / 24',
      totals: '1,750 kcal · 130 g protein'
    },
    safety: [
      {
        body: 'Allergies and intolerances are applied by deterministic code against an ingredient catalogue, before a dish can be stored or shown.',
        title: 'AI does not decide your safety'
      },
      {
        body: 'Calories and macros come from composition tables and your profile, with a daily floor no goal is allowed to cross.',
        title: 'The numbers are not improvised'
      },
      {
        body: 'NutrIA plans meals. It does not diagnose, does not prescribe, and does not replace a healthcare professional.',
        title: 'We know where the line is'
      }
    ],
    safetyLede: 'The AI proposes meals. Anything that could harm you is checked by the system.',
    safetyTitle: 'A model does not decide what matters.',
    steps: [
      { body: 'Your goal, your allergies, and how much time you have to cook each dish.', title: 'You tell us how you live' },
      { body: 'We work out what you need and build fourteen complete days, meal by meal.', title: 'We build your plan' },
      { body: 'Tick off what you eat, swap what you don’t fancy, shop with a list already written.', title: 'You follow it at your pace' },
      { body: 'Every fortnight we look at what worked, and the next plan arrives better tuned.', title: 'It adapts' }
    ],
    stepsLede: 'We do the planning. You decide what to eat from the things that already fit.',
    stepsTitle: 'Four steps. After that, it repeats itself.',
    title: 'Nutrition that adapts to you.'
  },

  macros: {
    carbs: 'Carbohydrate',
    fat: 'Fat',
    kcal: 'Calories',
    note: 'Approximate values from composition tables (USDA/BEDCA). For packaged products, the label wins.',
    protein: 'Protein'
  },

  manifest: { description: 'Personalised meal plans, adjusted every two weeks.' },

  meal: {
    accompanimentAdds: '+{kcal} kcal',
    accompanimentNames: {
      almendras: 'almonds ({grams})',
      'arroz-blanco': 'plain rice',
      'arroz-rojo': 'Mexican red rice',
      'brocoli-salteado': 'sautéed broccoli',
      caqui: 'a persimmon',
      'ensalada-de-invierno': 'winter salad',
      'ensalada-de-pepino': 'cucumber salad',
      'ensalada-marroqui': 'Moroccan salad',
      'ensalada-mixta': 'mixed salad',
      'ensalada-verde': 'green salad',
      fresa: 'strawberries ({grams})',
      frijoles: 'black beans',
      gazpacho: 'gazpacho',
      hummus: 'hummus ({grams})',
      'insalata-mista': 'insalata mista',
      'judias-verdes-rehogadas': 'sautéed green beans',
      kiwi: 'two kiwis',
      mandarina: 'two mandarins',
      manzana: 'an apple',
      melocoton: 'a peach',
      melon: 'melon ({grams})',
      naranja: 'an orange',
      'naranja-con-canela': 'orange with cinnamon',
      nectarina: 'a nectarine',
      nueces: 'walnuts ({grams})',
      'pak-choi-salteado': 'sautéed pak choi',
      'pan-blanco': 'bread ({grams})',
      'pan-de-centeno': 'rye bread ({grams})',
      'pan-de-masa-madre': 'sourdough bread ({grams})',
      'pan-de-pita': 'pitta bread',
      'pan-integral': 'wholemeal bread ({grams})',
      'pan-sin-gluten': 'gluten-free bread ({grams})',
      pera: 'a pear',
      'pico-de-gallo': 'pico de gallo',
      pina: 'pineapple ({grams})',
      platano: 'a banana',
      'queso-de-burgos': 'Burgos fresh cheese ({grams})',
      requeson: 'ricotta-style cheese ({grams})',
      sandia: 'watermelon ({grams})',
      'sopa-de-miso': 'miso soup',
      tabule: 'tabbouleh',
      'tortilla-de-maiz': 'corn tortillas ({grams})',
      uva: 'grapes ({grams})',
      'verduras-a-la-plancha': 'griddled vegetables',
      'yogur-griego-natural': 'Greek yoghurt ({grams})',
      'yogur-natural-desnatado': 'plain yoghurt ({grams})'
    },
    accompanimentsShare: 'Together they add {kcal} kcal: {percent}% of this meal.',
    accompanimentsTitle: 'Served with',
    alternatives: 'If you can’t find it',
    back: '← Back to the plan',
    backToHistory: '← Back to the earlier plan',
    badgeDone: 'Eaten',
    badgeSkipped: 'Skipped',
    cook: 'Cook',
    cookedNote: '({cooked} cooked)',
    dayOf: '{slot} · Day {day}',
    difficulty: { easy: 'Easy', hard: 'Hard', medium: 'Medium' },
    difficultyLabel: 'Difficulty',
    dislike: 'Not for me',
    dislikedHint: 'Noted: it will not come back, nor anything close to it.',
    done: 'Eaten',
    doneHint: 'Marked as eaten.',
    dryLine: '{name}: {dry} dry',
    ingredients: 'Ingredients',
    like: 'I like it',
    likedHint: 'Noted: it may come back, and we will look for dishes along these lines.',
    markDone: 'Mark as eaten',
    minutes: '{value} min',
    noCooking: 'No cooking',
    none: '—',
    notYet: 'You can mark it on {date}.',
    pictureCaption: 'AI-generated image. For illustration only: the ingredient list is what counts.',
    pictureOf: 'AI-generated image of {name}',
    prep: 'Prep',
    readOnly: 'This meal belongs to an earlier plan and is shown as it was.',
    servingNote: 'Quantities for {servings} {unit}.',
    servingsLabel: 'Servings',
    servingUnitOne: 'serving',
    servingUnitOther: 'servings',
    skipped: 'Skipped',
    skippedHint: 'Marked as skipped.',
    statusHint: 'When the time comes, mark whether you ate it or skipped it.',
    steps: 'Method',
    swap: 'Swap this dish',
    swapAxisAny: 'Whatever fits',
    swapAxisAnyHint: 'The dish that best matches the calories and protein of this meal.',
    swapAxisLabel: 'What should the new dish be?',
    swapAxisMoreProtein: 'More protein',
    swapAxisMoreProteinHint: 'At least a fifth more protein per calorie than this one.',
    swapAxisNoCooking: 'No cooking',
    swapAxisNoCookingHint: 'Nothing on the hob: assembled cold.',
    swapAxisQuicker: 'Quicker',
    swapAxisQuickerHint: 'Under {minutes} min in total, prep and cooking.',
    swapAxisVegetarian: 'No meat or fish',
    swapAxisVegetarianHint: 'No meat, fish or shellfish. Eggs and dairy stay.',
    swapConfirm: 'Change',
    swapCount: '{remaining} of {limit}',
    swapHint: '{remaining} of {limit} swaps left on this plan; the shopping list updates itself.',
    swapHintOne: '1 swap of {limit} left on this plan; the shopping list updates itself.',
    swapNoFit: 'We have nothing else that fits here right now. Try again later.',
    swapNoFitAxis: 'We have no dish like that fitting here right now. Try another option, or whatever fits.',
    swapping: 'Finding another dish…',
    swapSpent: 'You have used all {limit} swaps on this plan.',
    swapSpentShort: 'No changes left',
    totalMinutes: '{minutes} min in total',
    unmarkDone: 'Unmark as eaten',
    verdictHint: 'It shapes your next plans.',
    verdictTitle: 'What did you think?'
  },

  mealSize: {
    body: 'With {count} meals a day, the largest carries about {kcal} kcal. It is the only way to spread your macros, which is why the dishes come out generous.',
    dismissed: 'Note hidden',
    keep: 'Carry on',
    keepName: 'Carry on and build my plan',
    suggestions: {
      add_afternoon_snack: {
        action: 'Add an afternoon snack',
        body: 'If you add an afternoon snack, your main meal would come down to about {kcal} kcal.'
      },
      add_breakfast: { action: 'Add a breakfast', body: 'If you add a breakfast, your main meal would come down to about {kcal} kcal.' },
      none: 'More meals of this kind would not bring it any lower: it is your macros that make it big.',
      snack_to_normal: {
        action: 'Change the {slot}',
        body: 'If you move the {slot} from light to normal, your main meal would come down to about {kcal} kcal.'
      }
    },
    title: 'Your meals will be big',
    understood: 'Got it'
  },
  offline: {
    copyEarlier:
      'Offline: this is the copy from {date}. What you tick on the shopping list is saved when you are back online; anything else needs a connection.',
    copyToday:
      'Offline: this is the copy from {time}. What you tick on the shopping list is saved when you are back online; anything else needs a connection.',
    offline: 'Offline. What you tick on the shopping list is saved when you are back online; anything else needs a connection.'
  },

  onboarding: {
    customAllergen: {
      bestEffort:
        "— it isn't in our catalogue: we take out foods whose name matches it, but by name only, so we can't guarantee it. Check each dish before you cook it.",
      enforced: '— applied: “{ingredient}” will not appear in any dish.'
    },
    fields: {
      activityLevel: 'Activity level',
      allergies: 'Allergies',
      birthDate: 'Date of birth',
      cookingTime: 'Minutes you can spend cooking',
      cookingTimeHint: 'Per meal, between 5 and 240.',
      country: 'Where do you do your shopping?',
      countryHint: 'It decides which ingredients reach your plan: nothing will be suggested that you cannot buy where you are.',
      cuisines: 'Cuisines you fancy',
      customAllergens: 'Something not on the list',
      customAllergensHint: 'Separate with commas. When you save we look each one up in our catalogue and tell you what we can apply.',
      dietaryPatterns: 'Way of eating',
      dietaryPatternsHint:
        'We take out pork, alcohol and gelatine (and, for kosher, shellfish and meat with dairy). Certified meat depends on where you buy it. “Traditional Spanish” leaves only home-style Spanish cooking: no tofu, seitan, quinoa, Asian sauces or tacos.',
      disliked: 'Foods you don’t want to see',
      dislikedHint: 'They will not appear in your plans again.',
      displayName: 'What should we call you?',
      goalType: 'What do you want to achieve?',
      heightCm: 'Height (cm)',
      includesSnacks: 'Include snacks between meals',
      intolerances: 'Intolerances',
      liked: 'Foods you like',
      likedHint: 'Separate with commas.',
      mealShape: 'Which meals do you eat, and how big?',
      mealShapeHint: 'Mark the ones you skip. If one is light, the rest of the day takes on those macros.',
      otherAllergies: 'Other allergies',
      pace: 'Pace (kg per week)',
      paceHint:
        'Between 0 and 1 kg per week; your goal sets the direction. If you ask for more than is safe for you, we adjust it and say so in the summary.',
      paceRange: 'The pace has to be between 0 and 1 kg per week.',
      sex: 'Sex',
      sexHint: 'Used only for the metabolic equation. If you would rather not say, we use the middle value.',
      targetWeightKg: 'Target weight (kg)',
      traceHint: 'Tick “traces” if products that may contain the allergen affect you too.',
      traceLabel: 'traces',
      traceLabelFor: 'Traces of {allergen}',
      weightKg: 'Current weight (kg)'
    },
    options: {
      activity: {
        athlete: { hint: 'Two sessions a day, or competing.', label: 'Athlete' },
        high: { hint: 'I train 5–6 times, or my work is physical.', label: 'High' },
        light: { hint: 'I walk daily or train once or twice.', label: 'Light' },
        moderate: { hint: 'I train 3–4 times a week.', label: 'Moderate' },
        sedentary: { hint: 'Desk job, little exercise.', label: 'Sedentary' }
      },
      countries: { ES: 'Spain', GB: 'United Kingdom' },
      dietaryPatterns: {
        flexitarian: 'Flexitarian',
        gluten_free: 'Gluten-free',
        halal: 'Halal',
        kosher: 'Kosher',
        lactose_free: 'Lactose-free',
        omnivore: 'No restriction',
        pescatarian: 'Pescatarian',
        traditional_spanish: 'Traditional Spanish',
        vegan: 'Vegan',
        vegetarian: 'Vegetarian'
      },
      goals: {
        healthy_eating: { hint: 'No weight target, just eating well.', label: 'Eat well' },
        maintenance: { hint: 'Stay where you are, eating better.', label: 'Maintain' },
        muscle_gain: { hint: 'Build muscle on a controlled surplus.', label: 'Build muscle' },
        performance: { hint: 'Eat to train and recover better.', label: 'Performance' },
        weight_loss: { hint: 'Lose fat while keeping muscle.', label: 'Lose weight' }
      },
      mealSizes: { large: 'Large', light: 'Light', normal: 'Normal', off: 'I skip it' },
      mealSlots: {
        afternoon_snack: 'Afternoon snack',
        breakfast: 'Breakfast',
        dinner: 'Dinner',
        lunch: 'Lunch',
        morning_snack: 'Mid-morning',
        supper: 'Supper'
      },
      sex: { female: 'Female', male: 'Male', other: 'Other', prefer_not_to_say: 'Prefer not to say' }
    },
    percent: '{value}%',

    progressLabel: 'Questionnaire progress',

    review: {
      activity: 'Activity',
      allergies: 'Allergies',
      basis: 'Worked out from {maintenance} kcal of maintenance',
      basisGain: ', plus {pace} kg/week',
      basisLoss: ', minus {pace} kg/week',
      basisTail: '. You can adjust it from your profile.',
      birthDate: 'Date of birth',
      clamped: 'We adjusted your pace: it asked for {requested} kcal, outside the range we consider safe without professional supervision.',
      cuisines: 'Cuisines',
      height: 'Height',
      intolerances: 'Intolerances',
      mealShape: 'Meals in a day',
      name: 'Name',
      noCuisinePreference: 'No preference',
      objective: 'Goal',
      targets: 'Your daily targets (estimated)',
      targetsLine: '{kcal} kcal · {protein} g protein · {carbs} g carbohydrate · {fat} g fat',
      weight: 'Current weight'
    },

    saveNote: 'Each step is saved when you press “Continue”. You can leave whenever you like and you will come back to exactly here.',

    stepOf: 'Step {current} of {total}',

    steps: {
      aboutYou: { subtitle: 'This is what we work your needs out from. None of it is shared.', title: 'About you' },
      allergies: { subtitle: 'This is a limit, not a preference: it will never appear.', title: 'Allergies and intolerances' },
      bodyActivity: { subtitle: 'How much you move changes the numbers quite a lot.', title: 'Body and activity' },
      cooking: { subtitle: 'Be honest: a plan you cannot cook is no use.', title: 'Cooking' },
      foodPreferences: { subtitle: 'What you like turns up more. What you don’t, disappears.', title: 'Preferences' },
      goal: { subtitle: 'You can change it whenever you like.', title: 'Your goal' },
      howYouEat: { subtitle: 'How you spread your food across the day.', title: 'How you eat' },
      review: { subtitle: 'Check everything is right before you finish.', title: 'Review' }
    }
  },

  pages: {
    '/': {
      description: 'Fourteen-day plans with recipes, quantities and the shopping list already done, built around your goals and your allergies.',
      title: 'NutrIA — Personalised meal plans'
    },
    '/acceder': { description: "Sign in to NutrIA to see today's plan, your shopping list and your progress.", title: 'Sign in' },
    '/acceder/codigo': { title: '2-step verification' },
    '/admin': { title: 'Overview' },
    '/admin/ajustes': { title: 'Switches' },
    '/admin/ajustes/registro': { title: 'Audit log' },
    '/admin/ajustes/sistema': { title: 'System' },
    '/admin/buzon': { title: 'Inbox' },
    '/admin/catalogo': { title: 'Recipes' },
    '/admin/catalogo/[id]/imagen': { title: 'Review a picture' },
    '/admin/catalogo/calidad': { title: 'Quality' },
    '/admin/catalogo/imagenes': { title: 'Pictures' },
    '/admin/catalogo/ingredientes': { title: 'Ingredients' },
    '/admin/consentimientos': { title: 'Consents' },
    '/admin/cuentas': { title: 'Accounts' },
    '/admin/generacion': { title: 'Log' },
    '/admin/generacion/ia': { title: 'AI and models' },
    '/admin/notificaciones': { title: 'Notifications' },
    '/admin/personas/retencion': { title: 'Retention' },
    '/admin/producto': { title: 'Funnel and activity' },
    '/admin/producto/planes': { title: 'Plans' },
    '/admin/producto/planes/calidad': { title: 'Plan quality' },
    '/admin/profesionales': { title: 'Professionals' },
    '/cambiar-contrasena': { title: 'Change your password' },
    '/check-in': { title: "The fortnight's check-in" },
    '/compra': { title: 'The shopping' },
    '/compra/proxima': { title: 'Shopping for the next plan' },
    '/condiciones': {
      description: 'The terms for using NutrIA: what it is and is not, your account, allergies, Premium and how to cancel it.',
      title: 'Terms of use'
    },
    '/consentimiento': { title: 'Your health data' },
    '/consulta': { title: 'Practice' },
    '/consulta/[linkId]': { title: 'A client' },
    '/inicio': { title: 'Today' },
    '/invitacion': { title: 'Invitation' },
    '/onboarding': { title: 'Your profile' },
    '/pendiente': { title: 'Account pending' },
    '/perfil': { title: 'Your profile' },
    '/plan': { title: 'Your plan' },
    '/plan/comida': { title: 'A meal' },
    '/plan/generando': { title: 'Building your plan' },
    '/plan/historial': { title: 'Your earlier plans' },
    '/plan/historial/[id]': { title: 'An earlier plan' },
    '/plan/proximo': { title: 'Your next plan' },
    '/privacidad': {
      description: 'What NutrIA holds about you, what it is used for, who it is shared with, and how to see, correct or delete it.',
      title: 'Privacy policy'
    },
    '/progreso': { title: 'Your progress' },
    '/recuperar': { title: 'Reset your password' },
    '/registro': {
      description:
        'Create your account and answer a few questions: you will have fourteen days of meals with the shopping list already done. No card needed.',
      title: 'Create your account'
    },
    '/restablecer': { title: 'Choose a new password' },
    '/verificar-email': { title: 'Confirm your email' }
  },

  passkeys: {
    add: 'Add a passkey',
    addBody: 'Enter your password. Your device will then ask for Face ID, your fingerprint or its passcode to create the passkey.',
    added: 'Passkey added. We have emailed you to confirm it.',
    addedOn: 'Added on {date}',
    addFailed: 'The passkey could not be added. Please try again.',
    addTitle: 'Confirm it is you',
    alreadyAdded: 'This device already holds a passkey for your account.',
    body: 'Sign in with Face ID, your fingerprint or your device’s screen lock, without typing your password. Each passkey only works at this web address: {host}.',
    confirmAgain: 'Enter your password again to add the passkey.',
    listFailed: 'We could not load your passkeys.',
    listNotFresh: 'For your security, your passkeys are only shown if you signed in recently.',
    loading: 'Loading your passkeys…',
    none: 'You have no passkeys yet.',
    remove: 'Remove',
    removeBody: 'You will no longer be able to sign in with it. Your device may still offer it: delete it there too, among your passwords.',
    removeConfirm: 'Yes, remove it',
    removed: 'We have removed the passkey {name}.',
    removeGone: 'That passkey was no longer on your account.',
    removeLabel: 'Remove the passkey {name}, added on {date}',
    removeTitle: 'Remove the passkey {name}?',
    resetNote: 'If you reset your password, we remove all your passkeys and you will need to add them again.',
    signIn: 'Sign in with a passkey',
    signInFailed: 'Could not sign in with the passkey. Try again or sign in with your password.',
    stale: 'For your security, you need to have signed in within the last 10 minutes to add a passkey.',
    title: 'Passkeys',
    unnamed: 'Passkey'
  },

  picture: { aiMark: 'AI', aiMarkLabel: 'AI-generated image' },

  plan: {
    createCta: 'Create my plan',
    day: 'Day {index}',
    dayIsToday: ' · today',
    daysLabel: 'Days of the plan',
    emptyBody: 'Your profile is complete. Create your first fourteen-day plan with recipes, quantities and the shopping list written.',
    emptyTitle: 'No plan yet',
    historyBack: '← All your plans',
    historyCurrent: 'Current',
    historyEmpty: 'Your earlier plans will collect here, exactly as they were.',
    historyFinished: 'Finished',
    historyIntro: 'Every plan stays as it was, with what you ate and what you did not. It cannot be changed.',
    historyLink: 'Earlier plans →',
    historyOne: 'Earlier plan',
    historyPlan: 'Plan {version}',
    historyReplaced: 'Replaced',
    historyTitle: 'Your plans',
    loadedFor: 'Eating for: {name}',
    pendingReviewBody: 'Your dietitian is reviewing it before publishing. Here is your previous plan, just as it was.',
    pendingReviewTitle: 'Your new plan is with your dietitian',
    range: '14 days · {start} to {end}',
    redoAvailable: 'You can redo this plan once this fortnight: new dishes for the same days.',
    redoCta: 'Redo the plan',
    redoSpent: 'You have already redone your plan this fortnight. The next one opens on {date}.',
    scheduledBody: 'Its first day has not come yet. Meanwhile you can look at its days and change what does not suit you.',
    scheduledCta: 'See its days',
    scheduledLink: 'Your next plan starts on {date} →',
    scheduledTitle: 'Your plan starts on {date}',
    title: 'Your plan',
    upcomingBack: '← Your current plan',
    upcomingTitle: 'Your next plan',
    week: 'Week {number}'
  },

  practice: {
    adherenceLabel: 'of the meals marked, eaten',
    adherenceNone: 'No meals marked',
    back: '← Clients',
    checkInDifficulty: { easy: 'Easy to follow', hard: 'Hard to follow', ok: 'Manageable' },
    checkInHunger: { hungry: 'Was left hungry', right: 'Portions about right', too_much: 'Too much food' },
    checkInNone: 'No check-in',
    checkInSatisfaction: 'Satisfaction {value} out of 5',
    checkInSuggested: 'With this answer, their target would move to {kcal} kcal. Nothing has changed: it is your call.',
    checkInWeight: 'Weighed {value} kg',
    clientsEmpty: 'No clients yet. Invite the first one by email.',
    clientSince: 'Client since {date}',
    clientsTitle: 'Clients',
    currentPlanNone: 'No plan yet.',
    currentPlanTitle: 'Current plan',
    dayTitle: 'Day {index} · {date}',
    dayTotals: '{kcal} kcal · {protein} g protein',
    end: 'End the link',
    endConfirmBody:
      'You will stop seeing their profile, plans and progress, and a place on your plan frees up. Their targets stay as they are and become their own.',
    endConfirmCta: 'Yes, end it',
    endConfirmTitle: 'End the link with {name}?',
    endHint: 'Your client keeps their account, their history and their last published plan.',
    fortnightRange: '{from} – {to}',
    fortnightsEmpty: 'No fortnight lived yet.',
    fortnightsTitle: 'Fortnights and check-ins',
    generateBusy: 'A plan is already being generated for this client. Wait for it to finish.',
    generateDoneDirect: 'Plan ready: your client has it now.',
    generateDoneReview: 'Plan ready. It is above, under “Plan to review”.',
    generateFailed: 'The plan could not be generated and nothing was saved. You can try again.',
    generateIncomplete: 'Your client has not finished their profile yet: without it their needs cannot be worked out.',
    generateQuota: 'Your client has used this fortnight’s generations. They renew on {date}.',
    generating: 'Generating the plan…',
    gone: 'This link is no longer active. Go back to your clients.',
    healthConditions: 'Conditions',
    healthIntro: 'Your client chose to share this with you. It is never sent to any model.',
    healthMedications: 'Medication',
    healthNone: 'Nothing recorded',
    healthSupplements: 'Supplements',
    healthTitle: 'Health',
    historyEmpty: 'No earlier plans yet.',
    historyItem: 'Plan {version} · {from} – {to}',
    historyStatus: { active: 'Under way', archived: 'Archived', completed: 'Finished', replaced: 'Replaced' },
    historyTitle: 'Plans',
    intro: 'Your clients, their plans and your practice’s plan.',
    invitationExpires: 'Expires on {date}',
    invitationsTitle: 'Unanswered invitations',
    inviteCta: 'Send the invitation',
    inviteEmail: 'Your client’s email',
    inviteFull: 'Your practice already has the {count} clients your plan includes.',
    inviteFullEnd: 'You can also end the link with a client you no longer see.',
    inviteFullUp: 'Move to a larger plan',
    inviteHint: 'They will get an email with the link. Unanswered invitations take a place until they expire.',
    inviteInvalid: 'Enter a valid email, like name@example.com.',
    invitePending: 'Sending…',
    inviteSent: 'Invitation sent to {email}. It expires on {date}.',
    inviteTitle: 'Invite a client',
    newFortnight: 'New fortnight',
    newFortnightDirect: 'It will be published to your client as soon as it is ready.',
    newFortnightPending: 'Review and publish the pending plan before generating another.',
    newFortnightReady: 'The last fortnight has ended. You can generate the next one.',
    newFortnightReview: 'It will arrive here for you to review before publishing it.',
    newFortnightRunning: 'You can generate the next one when this one ends, on {date}.',
    overallLine: '{eaten} meals eaten of {marked} marked',
    overallNone: 'No meal marked yet.',
    paused: 'Paused',
    pausedHint: 'Your practice is closed: you cannot open their page until your plan renews.',
    pendingIntro: 'Your client will not see it until you publish it. Meanwhile they carry on with their previous plan.',
    pendingTitle: 'Plan to review',
    planChoose: '{clients} clients · {price} a month',
    planChoosePlain: '{clients} clients',
    planClosed: 'Choose a plan to invite clients and follow their progress.',
    planEnds: 'Your plan ends on {date}.',
    planJustPaid: 'Payment received. Your practice will open in a few seconds.',
    planLapsed: 'Your plan is not up to date: your clients are paused and come back as soon as it renews.',
    planManage: 'Manage the plan',
    planPastDue: 'The last payment could not be taken. Update your card so your clients are not paused.',
    planRenews: 'Renews on {date}.',
    planSeats: '{active} of {included} clients',
    planSeatsPending: 'And {count} unanswered invitations, which take a place too.',
    planTerms: 'You are buying as a professional, not a consumer. {terms}',
    planTermsLink: 'Practice plan terms',
    planTestMode: 'Test mode: nothing you pay is real money.',
    planTitle: 'Your plan',
    planTrial: 'The first {days} days are free. After that, the plan is charged monthly until you cancel.',
    planTrialLeft: 'Trial: {days} days left.',
    planUnavailable: 'Practice plans are not available yet.',
    publish: 'Publish the plan',
    regenerate: 'Generate another',
    regenerateHint: 'Replaces this draft with a new one and counts as one of your client’s generations.',
    reviewLabel: 'Review each plan before they see it',
    reviewOffHint: 'New plans reach your client as soon as they are ready.',
    reviewOnHint: 'Each new plan comes to you first, and your client sees it when you publish it.',
    reviewTitle: 'Review',
    sharesHealth: 'Shares their health',
    stages: {
      awaiting_plan: 'No plan yet',
      check_in_due: 'Check-in due',
      onboarding: 'Completing their profile',
      plan_awaiting_review: 'Plan to review',
      plan_under_way: 'Plan under way'
    },
    swapHint: 'Counts against this plan’s changes.',
    swapSpent: 'No changes left on this plan.',
    targetsBounds: 'Between {min} and {max} kcal for this client.',
    targetsEdit: 'Change targets',
    targetsEstimated: 'Estimated from their profile',
    targetsFieldInvalid: 'This value is outside what can be set.',
    targetsProfessional: 'Set by {name}',
    targetsReset: 'Back to the estimate',
    targetsSave: 'Save targets',
    targetsSelf: 'Set by your client',
    targetsTitle: 'Daily targets',
    title: 'Practice',
    weightNone: 'No weight recorded yet.',
    weightTitle: 'Weight'
  },

  practiceAgreement: {
    accept: 'Accept and open my practice',
    acceptedOn: 'Accepted on {date}, version {version}.',
    checkbox: 'I have read and accept the professional’s agreement and the practice plan terms.',
    intro: [
      'You are about to see your clients’ health data. This is what you agree to in order to do so. Please read it: it is short and all of it matters.',
      'NutrIA is provided by {name}, who you can write to at {email}.'
    ],
    sections: [
      {
        heading: 'Who you are here',
        list: [
          'You use NutrIA as a qualified dietitian-nutritionist and, where your region requires it, a registered member of your professional college. The registration number you gave us is yours and current; if it stops being so, you tell us and stop using the practice.',
          'The account is personal. Nobody else signs in with it, including anyone on your team.'
        ],
        paragraphs: []
      },
      {
        heading: 'What you will see and what you can do',
        list: [
          'You will see their name, their daily targets and how they were worked out, their plan and the earlier ones, how much of each fortnight they followed, their weight over time and their answers to each check-in. Their health conditions, medications and supplements only if your client ticks that separately, and you stop seeing them as soon as they untick it.',
          'You will not see their allergies or intolerances, their email address, their written comments or anything about anyone else.',
          'You can set their daily targets within the same safety bounds the calculator uses, generate and change their plan, review it before they see it and publish it.',
          'Every time you look at or change something, your client sees it on their profile: who, what and when.'
        ],
        paragraphs: ['Only for clients who accept your invitation, and only while the link is active:']
      },
      {
        heading: 'Professional secrecy',
        list: [
          'What you see here is covered by your professional secrecy, like anything a client tells you in a consultation. You do not share it with anyone outside that client’s care, except where the law requires or allows you to.',
          'If you work with others, none of them uses your account or sees the practice.'
        ],
        paragraphs: []
      },
      {
        heading: 'Who is responsible for the data',
        list: [
          'NutrIA is the controller of the data in your client’s account: it stores it, protects it, decides how long it is kept and handles their rights over it (access, rectification, erasure, portability, objection). When your client accepts your invitation, NutrIA discloses that data to you because your client asks for it and consents.',
          'You are an independent controller of what you do with what you see: your assessment, anything you record outside NutrIA and your clinical record. You do so for your dietetic care, on your own legal basis as a health professional.',
          'NutrIA does not process data on your behalf: it is not your processor. If NutrIA ever stored something you write for your practice — notes, a record, documents — or let you export a client’s file, we would first sign a processing agreement and ask you to accept it.',
          'If a client asks you to exercise a right over the data held in NutrIA, point them to their profile or to {email}; if they ask us about what you keep outside NutrIA, we will tell them. Each of us informs clients about our own part; NutrIA already tells them, in the invitation and in its privacy policy, that it discloses their data to you and which data.',
          'If an authority or a court considered that we decide the processing jointly, this section is our arrangement: NutrIA informs clients and handles their rights over what is held in NutrIA, and is the contact point; you do so for what you keep outside. Its essence is set out in the privacy policy.'
        ],
        paragraphs: []
      },
      {
        heading: 'NutrIA is a tool, not a second opinion',
        list: [
          'NutrIA plans meals. It does not diagnose or treat, and it derives no rule from any condition except one: coeliac disease excludes gluten. Medication produces nothing.',
          'Dishes and recipes are proposed by an artificial-intelligence model and checked by our code: declared allergies and intolerances, calorie and protein bounds. They can contain mistakes in quantities or steps. The clinical decision and the review of the plan are yours.',
          'Your client’s health data never reaches the model, whether or not they share it with you.',
          'NutrIA is not your clinical record. Whatever your profession requires you to record and keep, you record and keep outside NutrIA. When the link ends, you stop seeing everything that was here.'
        ],
        paragraphs: []
      },
      {
        heading: 'Who you invite',
        list: [
          'Only people who are already your clients and who know, before the email arrives, that you are inviting them. You give us their address, and we only use it to send the invitation.',
          'Never anyone under 18. Nor clients who need clinical nutrition NutrIA does not cover: a diagnosed metabolic disease requiring a specific regimen, pregnancy, recovery from an eating disorder, or infant feeding. For them, NutrIA is not the tool.',
          'Your client decides: they can say no, accept without sharing their health, withdraw that part or end the link at any time. Do not make your care conditional on their accepting.'
        ],
        paragraphs: []
      },
      {
        heading: 'What happens to the data when something ends',
        list: [
          'A link ends (you end it, your client does, or it is paused because your plan is not paid up): you stop seeing their data on the next request. The targets you set stay in their account and become theirs. A plan you had pending review is not shown to them and costs them nothing. Your name stays in their access record, because knowing who looked is their right.',
          'You delete your account: all your links end, and your invitations, your grant and your subscription are deleted. Your name stays in the access record of every client you had, without your account.',
          'Your client deletes their account: you stop seeing them; their record goes with it.',
          'We revoke your grant (for example, if your registration lapses or you breach this agreement): you lose access to the practice and your pending invitations are cancelled.',
          'Anything you copied outside NutrIA for your clinical record is yours and you keep it under your own rules.'
        ],
        paragraphs: []
      },
      {
        heading: 'Security',
        list: [
          'Protect your access: a password you do not use anywhere else, or sign in with Google. Do not leave the session open on a shared computer.',
          'Do not take screenshots or copies of a client’s page except for your clinical record, and keep them with the same protection as the rest of your clinical documentation.',
          'If you think someone has got into your account or seen a client’s data they should not have, write to {email} as soon as you know, and in any case within 24 hours. We will assess whether the Spanish Data Protection Agency and the clients must be told; if the breach is yours, outside NutrIA, that duty is yours.'
        ],
        paragraphs: []
      },
      {
        heading: 'Prohibited uses',
        list: [
          'try to see the data of anyone who has not accepted your invitation, or find out whether an address has a NutrIA account;',
          'invite addresses that are not your clients’, or use the invitation to advertise your services;',
          'use your clients’ data for anything other than their care: no advertising, no studies, no selling or passing it on;',
          'share or lend your account;',
          'extract data automatically or try to get round your plan’s limits or the security measures.'
        ],
        outro: ['If you do any of these, we may revoke your grant immediately.'],
        paragraphs: ['You may not:']
      },
      {
        heading: 'Changes and term',
        list: [
          'This agreement lasts as long as you hold the grant. If we change anything important, we will tell you by email and ask you to accept again before the practice reopens; your clients keep their accounts in the meantime.',
          'It is governed by Spanish law. For the practice plan’s commercial terms, see below.'
        ],
        paragraphs: []
      }
    ],
    terms: {
      sections: [
        {
          heading: 'What you are buying',
          paragraphs: [
            'Access to the NutrIA practice for a number of active clients that depends on the plan (for example, 30 or 60). Active links and invitations that have not yet expired both take a place. At the limit, you can move to a larger plan or end a link.'
          ]
        },
        {
          heading: 'Price and payment',
          paragraphs: [
            'Each plan’s monthly price, including tax, is shown before you pay. It is charged monthly in advance through Stripe, to the card you give. If you need an invoice in your business’s name, enter your tax details at checkout.'
          ]
        },
        {
          heading: 'Trial',
          paragraphs: [
            'The first time, you get {days} days free. We ask for your card at the start and charge nothing until the trial ends; if you cancel before then, you pay nothing. One trial per account.'
          ]
        },
        {
          heading: 'Renewal and cancellation',
          paragraphs: [
            'The plan renews every month until you cancel it from "Manage plan" in your practice. You keep access until the end of the paid month. There is no minimum term. You can change plan from the same place; Stripe works out the change and any proration immediately.'
          ]
        },
        {
          heading: 'If the plan is not paid up',
          paragraphs: [
            'If a payment fails, Stripe retries it for a few days and you keep access. If the plan ends or stops being paid, your clients are paused: you stop seeing their data, they keep their accounts and return to the free limits, and nothing is deleted. If you pay again, the links resume.'
          ]
        },
        {
          heading: 'No consumer right of withdrawal',
          paragraphs: [
            'Because you are buying for your professional activity, the 14-day consumer right of withdrawal does not apply. Even so, if you cancel during the trial you pay nothing.'
          ]
        },
        {
          heading: 'Availability and changes',
          paragraphs: [
            'We do our best to keep the practice running at all times, but there may be interruptions. If we change the price we will tell you at least 30 days in advance and you can cancel before then. If we ever close the service, we will give notice and refund the unused part of the month.'
          ]
        },
        {
          heading: 'Liability',
          paragraphs: [
            'We are liable for harm caused by NutrIA through wilful misconduct or gross negligence and for anything the law does not allow us to exclude. We are not liable for your clinical decisions or for what you do with data outside NutrIA, which are yours as a professional. Otherwise our liability is capped at what you paid in the last twelve months.'
          ]
        },
        {
          heading: 'Law and courts',
          paragraphs: [
            'These terms are governed by Spanish law. Any dispute goes to the courts of the domicile of NutrIA’s owner, unless the law provides otherwise.'
          ]
        }
      ],
      title: 'Practice plan terms'
    },
    title: 'Before your practice opens',
    version: 'Version {version}'
  },

  privacy: {
    intro: [
      'This policy explains what data NutrIA keeps about you, what for, who it shares it with, for how long, and what you can do about it.',
      'NutrIA is a meal-planning tool. It is not a medical service and does not replace the advice of a doctor or a registered dietitian-nutritionist.'
    ],
    sections: [
      {
        heading: 'Who handles your data',
        paragraphs: [
          'The controller is {name}, who runs NutrIA. You can write to {email} for anything about your data, including a request to access, correct or delete it.',
          'We have no data protection officer because the law does not require one; {email} is the contact point.'
        ]
      },
      {
        heading: 'What we collect and why',
        list: [
          'Account: your name and email and, if you sign in with Google or Apple, the name and email that service confirms to us, and which version of the terms of use you accepted when you created it and when. While you are signed in we keep the IP address and browser you signed in from, so we can end the session. So that you have an account and only you get into it, and so that we can show which terms you accepted.',
          'Your body and your goal: date of birth, sex, height, weight, activity level and your goal (for example, losing weight). To work out how much you need to eat.',
          'Country: where you shop from. So the catalogue only shows you foods you can actually find there.',
          'Allergies and intolerances: the ones you pick from the list, the ones you type yourself, and how severe they are. So that no plan offers you something that could harm you.',
          'How you eat: for example vegetarian, gluten-free or lactose-free, and the cuisines you like or not. To fit the dishes to you.',
          'Conditions, medication and supplements: only if you choose to tell us, under a separate consent you can withdraw at any time without deleting the rest of your account.',
          'How the plan is going: which meals you mark as eaten or skipped, your ratings and comments on dishes, your weight over time and your fortnightly check-ins. So the next plan takes them into account.',
          'Payments: if you subscribe to Premium, Stripe takes the payment and we keep only the identifier for your subscription and its status. We never see your card number.',
          'Account security: we record when you change or reset your password and when you sign out of sessions, with the date and without your IP address. So that we can see what happened if someone gets into your account.',
          'Two-step verification, only if you turn it on: the secret of your authenticator app and your backup codes, encrypted, failed code attempts and, in the security record, when you turn it on, turn it off or use a backup code. If you turn it off, we delete the secret and the codes. If you lose your phone and your backup codes, you can ask us, from your account’s address, to remove it: we email you right away, it is removed 48 to 72 hours later and, if you sign in with a code before then, it is cancelled; it is noted in the security record. So that, even if someone knows your password, they cannot get into your account.',
          "Passkeys, only if you add one: its identifier and public key; what your device tells us about it, such as whether it syncs across your devices, how it connects or what kind of device or app keeps it; the name of your browser and system we save it under; when you added it and, in the security record, when one is added or removed. The secret part of the key, your Face ID, your fingerprint and your device's passcode never reach us: the key stays on your device or, if you sync your passkeys (for example with iCloud or Google), with the service you choose for that. If you remove it, or reset your password, we delete it. So that you can sign in without a password.",
          'Product use: we record, linked to your account, when you sign in and when you ask to change a dish, and nothing more. To know whether the product works.',
          'What you write to us: messages in the feedback box, so we can read and answer them.'
        ],
        paragraphs: []
      },
      {
        heading: 'Which of these are specially protected',
        paragraphs: [
          'The law gives special protection to health data and to data revealing religious beliefs. On NutrIA these are: your allergies and intolerances; your weight, height and goal, because they say something about your health; a way of eating such as gluten-free or lactose-free, or one tied to a religion; your conditions, medications and supplements; and anything you write about how the plan agrees with you.'
        ]
      },
      {
        heading: 'Why we may process this data',
        paragraphs: [
          'To provide the service you ask for (contract): your account, profile, plans, payments and service emails.',
          'With your explicit consent: your allergies and intolerances, your body and goal and your way of eating, which you give with a checkbox of its own when you create your profile. Without them we cannot make a safe plan for you, so without that consent we do not generate plans; you can withdraw it at any time by deleting that data from your profile. Your conditions, medications and supplements, under a separate, optional consent. Each consent is stored with its date and the version of the text you accepted.',
          'Our legitimate interest: recording product use and technical errors to keep it working, with no health data. You can object by writing to us.',
          'Legal obligation: keeping what tax law requires about payments (Stripe does this).'
        ]
      },
      {
        id: 'tu-dietista',
        heading: 'Your dietitian on NutrIA',
        paragraphs: [
          'A dietitian-nutritionist can invite you by email to follow your plan with them on NutrIA. Only a professional we have given access to, after checking their registration number, can do so. The invitation lasts 14 days; we use your address only to send it and delete it with the invitation: as soon as you answer or, if you do not, by the day after it expires at the latest.',
          'Nothing is shared unless you accept. If you do, your dietitian will see your name, your daily targets and how they were worked out, your plans, how much of each fortnight you follow, your weight over time and your check-in answers. They can set your targets, generate and change your plans, and review each new plan before you see it. Your conditions, medications and supplements only if you tick that separate box. They will not see your allergies or intolerances, your email address or your written comments.',
          'Every time your dietitian looks at or changes something, it is recorded and you can see it on your profile under "Who has accessed".',
          'You can end the link from your profile at any time, and from the next request your dietitian stops seeing your data. You can also stop sharing just your health without ending the link. Your targets, your history and your last published plan stay with you.',
          'Who is responsible for what: NutrIA is responsible for your data on NutrIA and discloses it to your dietitian because you ask it to. Your dietitian is responsible, on their own account and under professional secrecy, for what they do with what they see in their practice, such as what they note in your clinical record; for that, contact them. For everything held on NutrIA, write to us at {email}: we are your contact point.',
          'If your dietitian deletes their account, the link ends and their name stays in your access record.'
        ]
      },
      {
        heading: 'Artificial intelligence',
        paragraphs: [
          "NutrIA's dishes and recipes are designed by an artificial-intelligence model or come from our library of dishes already designed and checked. Our own code checks every dish before it reaches you: a declared allergen does not reach your plan even if the model gets it wrong. The AI makes no decision about you: the calorie and protein bounds are applied by fixed rules, not by the model.",
          'What the model receives when it designs new dishes for your plan: your daily targets and your goal (for example, losing weight), which meals you eat and how much time you want to spend cooking each dish, whether you are vegetarian or vegan, the cuisines and foods you like, the names of dishes you liked, disliked or ate last fortnight, and your closed check-in answers (hunger, difficulty, rating). Always by the names on our lists. It never receives your name, email, age, sex, weight or height, anything you typed yourself, your allergies or intolerances, any other way of eating (gluten-free, lactose-free, halal, kosher…), or your conditions, medications or supplements. What you cannot or will not eat we remove first, in our code, from the catalogue of foods it sees: it gets the effect, never the datum.',
          "Where it goes: the request goes to OpenRouter (OpenRouter, Inc., United States), which processes it on our behalf and passes it to the company that runs the model: DeepInfra or CoreWeave, also in the United States. The model is Gemma 4 31B and, if it does not answer, DeepSeek V4.1 Flash; they are open models run by those companies: what is sent to design your dishes never goes through Google's or DeepSeek's own services.",
          'Nobody trains on it or keeps it: we only use providers that delete the request as soon as they answer and do not use it to train or improve any model. We require this in our OpenRouter account and again in every request. OpenRouter keeps only technical data about each request (size, time, cost), not its content.',
          'One exception you should know about: OpenRouter may pass a small sample of requests, with nothing linking them to our account or to you, through a model that tags them with a topic for its public usage statistics. It does not keep the text, only the tag.',
          'The pictures of the dishes are generated by another model, from the recipe alone: its name, its ingredients and in what proportion. It never receives anything of yours, not even who opened the dish. The request goes to OpenRouter, which passes it to Google (Vertex AI), and a model run by DeepInfra reviews every picture before it is published. None of them keeps the request or trains on it. If that model clearly sees in the picture a food carrying an allergen the recipe does not have, the picture is rejected, and it is published only if we then review it by hand and decide to publish it; something shaped like what the dish already has or its name says, such as its bread or its milk, does not count, because a picture cannot show what it is made of. That review is not a guarantee: the picture may show something the dish does not contain, and what the dish contains is what its ingredient list says. The pictures are stored on Vercel, shown to everyone who sees that dish, and carry the "AI" mark; the files also carry an invisible, machine-readable mark saying they were generated by AI.',
          'Until 26 September 2026 some of the models we used were free versions hosted in the United States whose providers could use what they received to improve their models. We no longer use any of them.'
        ]
      },
      {
        heading: 'Who we share your data with',
        list: [
          'OpenRouter, and DeepInfra or CoreWeave, which run the artificial-intelligence model, as explained in "Artificial intelligence". They are in the United States.',
          'Vercel (hosting for the website, the API and the pictures of the dishes, in the European Union) and Neon (database, in the European Union). Both are US companies.',
          'Stripe, if you subscribe to Premium, to charge the subscription. Stripe processes and keeps payment data under its own policies.',
          'Our email provider, for confirmation, password-reset and invitation emails, account security notices (such as your password having changed, which cannot be turned off) and notices you turn on.',
          "Your browser's own notification service (Google, Apple or Mozilla), if you turn on reminders; the content is encrypted and they cannot read it.",
          'Sentry, an error-reporting service, only if switched on: it receives the error and where it happened, never your data or anything you wrote.'
        ],
        paragraphs: ['We do not sell your data. There are no adverts and no advertising cookies.']
      },
      {
        heading: 'Transfers outside the European Union',
        paragraphs: [
          "Some of these providers are US companies or process data there: Vercel, Neon, Stripe, the email provider, Sentry, OpenRouter, DeepInfra and CoreWeave. Vercel, Neon, Stripe and Sentry are certified under the EU-US Data Privacy Framework, which the European Commission recognises as an adequate safeguard; with the email provider we rely on that same framework or on the Commission's standard contractual clauses. OpenRouter is not in that framework: with it we rely on the standard contractual clauses. DeepInfra and CoreWeave receive the request from OpenRouter and commit to it not to keep it or train on it; the request carries nothing that identifies you. You can ask us for the details of each safeguard at {email}."
        ]
      },
      {
        heading: 'How long we keep your data',
        paragraphs: [
          'While your account exists. When you delete it, everything in it is deleted at once: profile, allergies, health, plans, shopping lists, progress and consents.',
          'The security record of your account is kept while your account exists; when you delete it, it stops being linked to you.',
          'Our database provider keeps, on its own, a short history to let us recover from a fault; you can ask us for the exact window at {email}.',
          'If you subscribed to Premium, Stripe keeps billing data for as long as the law requires, even if you delete your account.'
        ]
      },
      {
        heading: 'Your rights',
        list: [
          'Access: see what data we hold, from your profile or by asking by email.',
          'Rectification: correct it, from your profile for almost everything.',
          'Erasure: delete your account from your profile, or ask by email.',
          'Portability: receive your data in a structured file to take to another service; ask us by email.',
          'Restriction: ask us to stop using a piece of data while we resolve your complaint about it.',
          'Objection: to the product-use record, by writing to us.',
          'Withdraw a consent at any time, without affecting what we already did with it: your profile consent or your health consent, by deleting that data from your profile.',
          'Complain to the Spanish Data Protection Agency (aepd.es).'
        ],
        paragraphs: ['We answer within one month at most, free of charge.']
      },
      {
        heading: 'How we protect your data',
        paragraphs: [
          'Your password is never stored in plain text and the connection is always encrypted. Your conditions, medications and supplements live in a part of the code that cannot talk to the artificial intelligence, and a test checks it on every change. Server and error logs do not keep what you write. When you create, reset or change your password, and each time you sign in with it, we compare it with a public list of leaked passwords: from our server we send the free Have I Been Pwned service only the first five characters of a fingerprint of the password, which does not reveal what the password is, with no account, email or IP address of yours, and we keep neither the password nor that fingerprint. If the service does not answer, the password is accepted without that check. When you sign in, your password is accepted even if it appears on the list: we ask you to change it, and we keep nothing but that mark on your account. Database access is restricted and nobody looks at it except to fix a fault.'
        ]
      },
      {
        heading: 'Cookies and storage on your device',
        paragraphs: [
          'We only use what is essential for the service to work, which is why we do not ask for permission: your session cookie, the cookie for the language you chose, the one that, if you tick “trust this device” when verifying in two steps, stops asking you for the code for 30 days in that browser, and, when you sign in with Google or Apple, on the sign-in page (which offers you your passkeys) or when you add a passkey, the ones that step needs for a few minutes. None is third-party or tracks you on other sites.',
          "In your browser's storage we keep the meals you tick while offline until they are sent, a notice about a plan pending review and, if you install NutrIA on your phone, a copy of today's plan and the shopping list so they work offline. It all stays on your device."
        ]
      },
      {
        heading: 'Children',
        paragraphs: [
          'NutrIA is not for anyone under 18. If the date of birth you give belongs to someone younger, we cannot create the profile. If we learn that an account belongs to someone under 18, we delete it.'
        ]
      },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'If we change anything important, we will say so here with the date and email you before it applies. If the change affects how we handle your health data, we will ask for your consent again.'
        ]
      }
    ],
    title: 'Privacy policy',
    updated: 'Last updated: 3 October 2026'
  },

  profile: {
    account: 'Account',
    activity: 'Activity',
    allergies: 'Allergies',
    cooking: 'Cooking',
    cookingTime: 'Time to cook',
    cuisines: 'Cuisines',
    dangerTitle: 'Delete my account',
    deleteAllBody: 'Everything goes: profile, targets, restrictions, plans, progress and conversations. This cannot be undone.',
    deleteBody: 'Your profile, plans, progress and conversations will be deleted. This cannot be undone.',
    deleteConfirm: 'Delete permanently',
    deleteFailed: 'We could not delete the account. Please try again.',
    deletePending: 'Deleting…',
    deletePrompt: 'Type {word} to confirm.',
    deleteSignInAgain: 'Sign out and sign in again',
    deleteSignInAgainBody: 'For your security, you need to have signed in today to delete your account. Sign out, sign back in and delete it.',
    deleteTypeLabel: 'Type {word}',
    deleteWord: 'DELETE',
    dietaryPatterns: 'Way of eating',
    dislikedFoods: 'Foods you don’t want',
    displayName: 'Display name',
    email: 'Email',
    emailVerified: 'Email verified',
    emailVerifiedNo: 'Pending',
    emailVerifiedYes: 'Yes',
    goal: 'Goal',
    height: 'Height',
    howYouEat: 'How you eat',
    intolerances: 'Intolerances',
    likedFoods: 'Foods you like',
    locale: 'Language',
    localeHint: 'Changes the interface straight away and is saved to your profile.',
    minutes: '{value} min',
    name: 'Name',
    no: 'No',
    none: 'None',
    noRestriction: 'No restriction',
    pace: 'Pace',
    personalData: 'Personal details',
    preferences: 'Preferences',
    premiumCancelAnytime: 'No commitment: cancel whenever you like, right here.',
    premiumEnds: 'You have premium until {date}. It will not renew.',
    premiumGranted: 'You have premium, granted by NutrIA.',
    premiumJustPaid: 'Payment received. Premium switches on in a few seconds; if you do not see it yet, reload the page.',
    premiumManage: 'Manage the subscription',
    premiumMonthly: 'Monthly · {price} a month',
    premiumPastDue: 'The last payment could not be taken. Stripe will try again; update your card to keep premium.',
    premiumPitch:
      'Three plan redos a fortnight instead of one, twenty meal swaps a plan instead of five, ten events a plan instead of three, and up to three events added once a plan has started.',
    premiumRenews: 'You have premium. It renews on {date}.',
    premiumSafety: 'Food safety — allergies, intolerances and nutrients — is the same with premium and without it.',
    premiumTestMode: 'Test mode: nothing is really charged. Use the card 4242 4242 4242 4242, any future date and any CVC.',
    premiumTitle: 'Premium',
    premiumTrial: 'The first {days} days are free: nothing is charged until they end, and cancelling before then costs nothing.',
    premiumTrialing: 'You are on your free trial until {date}. Unless you cancel, it renews by itself after that.',
    premiumYearly: 'Yearly · {price} a year (save {saving} %)',
    premiumYearlyPlain: 'Yearly · {price} a year',
    profileConsentTitle: 'Health data consent',
    profileConsentWithdraw: 'Withdraw consent and delete this data',
    profileConsentWithdrawBody:
      'Your allergies, intolerances, the ones you typed by hand, your way of eating, height, weight and goal are deleted, and no more plans will be generated until you give it again. You will return to the goal, body and allergies steps of the questionnaire.',
    profileConsentWithdrawConfirm: 'Yes, withdraw and delete',
    profileConsentWithdrawTitle: 'Withdraw your consent?',
    pushBlocked: 'This browser is blocking notifications from NutrIA. You can allow them in its settings.',
    pushHint: 'One notification on check-in day. Each device is turned on separately.',
    pushInstallFirst: 'To get notifications on an iPhone, add NutrIA to your home screen (Share → Add to Home Screen) and turn them on from there.',
    pushLabel: 'Also notify me on this device',
    pushUnsupported: 'This browser cannot receive notifications.',
    reminderCheckIn: 'Email me when the fortnight ends',
    reminderCheckInHint: 'One email every fourteen days, on check-in day. Nothing else.',
    reminders: 'Reminders',
    restrictions: 'Restrictions',
    sectionCare: 'Your dietitian',
    sectionDanger: 'Danger zone',
    sectionData: 'Your details',
    sectionHelp: 'Help',
    sectionNotices: 'Notices and language',
    sectionPlan: 'Your plan',
    snacks: 'Snacks',
    startingWeight: 'Current weight',
    subtitle: 'All of this feeds your plans. Change it when your life changes.',
    supervision:
      'You have told us about a health condition or medication. NutrIA interprets neither: we do not adjust your plan for them beyond the restrictions you have ticked, and we do not check for interactions. Show your plan to your doctor, your pharmacist or a registered dietitian before following it.',
    targetWeight: 'Target weight',
    title: 'Your profile',
    unset: '—',
    yes: 'Yes',
    youAvoid: 'You avoid',
    youAvoidBestEffort: '{labels} · asked of the AI, but we cannot guarantee it',
    youAvoidEnforced: '{labels} · kept out of your recipes',
    youLike: 'You like'
  },

  profileConsent: {
    ai: 'An artificial-intelligence model designs the dishes. It receives your daily targets, your meal times, whether you are vegetarian or vegan, and the foods and dishes you like or dislike, always by the names on our lists. It never receives your name, email, age, weight or height, anything you type yourself, your allergies or intolerances, any other way of eating, or your conditions or medication: what you cannot or will not eat we remove first, in our code, and the same code checks every dish before it reaches you.',
    body: 'To build you a safe plan we need data that says something about your health: your allergies and intolerances, your weight, height and goal, and how you eat, which sometimes reveals an intolerance or a belief. We use them only to work out your targets and choose your dishes.',
    continue: 'Continue',
    label: 'I consent to NutrIA using this health data to make my plans',
    note: 'Without this consent we cannot make you a plan. You can withdraw it at any time from your profile: that data is then deleted. More in the {privacy}.',
    title: 'Before you go on: your health data'
  },

  progress: {
    adherenceLabel: 'of the ones you marked, eaten',
    adherenceNone: 'No meals marked',
    allPlans: 'All your plans →',
    chartEmpty: 'Log two weights and the line appears.',
    chartSummary: 'From {from} kg on {fromDate} to {to} kg on {toDate}.',
    checkInWeight: 'You weighed {value} kg',
    difficultyEasy: 'Easy to follow',
    difficultyHard: 'Hard to follow',
    difficultyOk: 'Could be followed',
    emptyBody:
      'Once you have your first plan, every fortnight shows up here: which meals you ate, what you said at the check-in and how your weight is going.',
    emptyCta: 'Go home',
    emptyTitle: 'Nothing to measure yet',
    fortnightRange: '{from} – {to}',
    fortnightsTitle: 'Your fortnights',
    hungerHungry: 'You were left hungry',
    hungerRight: 'Portions were right',
    hungerTooMuch: 'Too much food',
    intro: 'What you have logged, in one place. None of it is an estimate: these are your weights, your meals and your check-ins.',
    lastFortnight: 'Last fortnight',
    logLink: "Log today's weight →",
    mealsLine: '{eaten} eaten · {skipped} skipped · {unmarked} unmarked, of {soFar} so far',
    noChange: 'No change',
    noData: '—',
    openPlan: 'See the plan →',
    overallLine: '{eaten} meals eaten of the {marked} you marked',
    overallNone: 'Mark meals as eaten or skipped and this shows how much of the plan you follow.',
    planNumber: 'Plan {version}',
    reached: 'reached',
    satisfaction: 'Satisfaction {value} of 5',
    sinceStart: 'Since the start',
    statusActive: 'In progress',
    statusArchived: 'Archived',
    statusCompleted: 'Finished',
    statusReplaced: 'Redone',
    title: 'Your progress',
    toGain: 'to gain',
    toLose: 'to lose',
    toTarget: 'To your target',
    unavailable: 'We could not load your progress. Try again in a moment.',
    weightLatest: 'Latest weight',
    weightNone: 'You have not logged a weight yet.',
    weightStart: 'You started at {value} kg',
    weightTarget: 'Target {value} kg',
    weightTitle: 'Your weight'
  },

  security: {
    browserUnknown: 'Browser',
    changePassword: 'Change password',
    closeOthers: 'Sign out all the others',
    closeOthersBody: 'You will have to sign in again on each of them. You stay signed in on this one.',
    closeOthersConfirm: 'Yes, sign them out',
    closeOthersTitle: 'Sign out on all your other devices?',
    closeSession: 'Sign out',
    closeSessionLabel: 'Sign out {device}, signed in on {date}',
    currentPassword: 'Current password',
    currentPasswordMissing: 'Type your current password.',
    deviceOn: '{browser} on {platform}',
    forcedBody:
      'Your password appears in known data breaches. It does not mean anyone has got into your account, but it is no longer safe: choose a new one to carry on. Saving it signs you out on your other devices.',
    forcedSignOut: 'Sign out',
    forcedTitle: 'Change your password',
    googleOnly: 'You sign in with Google, so your account is as well protected as your Google account.',
    googleOnlyLink: 'Turn on 2-Step Verification in your Google account',
    lastActive: 'Last active: {date}',
    noOtherSessions: 'You are not signed in on any other device.',
    othersClosed: 'We have signed you out on your other devices.',
    passwordBody: 'Changing it signs you out on your other devices, and we let you know by email.',
    passwordChanged: 'Password changed. We have signed you out on your other devices.',
    passwordTitle: 'Password',
    sectionTitle: 'Security',
    sessionClosed: 'We have signed out {device}.',
    sessionsBody: 'A device you sign out will have to sign in again. Until it next connects, it may still show what it kept for reading offline.',
    sessionsFailed: 'We could not load your sessions.',
    sessionsLoading: 'Loading your sessions…',
    sessionsNotFresh: 'For your security, the list only shows if you have signed in today. You can still sign out all the others now.',
    sessionsTitle: 'Where you are signed in',
    signInAgain: 'Sign out and sign in again',
    started: 'Signed in on {date}',
    thisDevice: 'This device',
    wrongCurrentPassword: 'Your current password is not right.'
  },

  shopping: {
    emptyBody: 'The list is generated with your plan, already added up and grouped by aisle.',
    emptyCta: 'See my plan',
    emptyTitle: 'No list yet',
    nearby: 'Supermarkets nearby',
    nearbyOpens: ' (opens in your maps app)',
    nearbyQuery: 'supermarket',
    nextSubtitle: 'Everything you need for the plan that starts on {date}, already added up.',
    notice: 'For now the list is read-only. Ticking off what you already have, adjusting quantities and adding items arrives in the next release.',
    progress: '{done} of {total} in the trolley',
    share: 'Share what is left',
    shareCopied: 'List copied: paste it wherever you like.',
    shareNothing: 'Everything is in the trolley: nothing left to share.',
    shareTitle: 'Shopping list',
    subtitle: 'Everything you need for the fortnight, already added up.',
    switchCurrent: 'Current',
    switchLabel: 'Which list to show',
    switchNext: 'Next',
    title: 'Shopping list'
  },

  siteNav: {
    brandHome: 'NutrIA — home',
    howItWorks: 'How it works',
    personalisation: 'Personalisation',
    questions: 'Questions',
    safety: 'Safety',
    sectionsLabel: 'Sections',
    signIn: 'Sign in',
    signUp: 'Create my plan'
  },

  slots: {
    afternoon_snack: 'Afternoon snack',
    breakfast: 'Breakfast',
    dinner: 'Dinner',
    lunch: 'Lunch',
    morning_snack: 'Morning snack',
    supper: 'Supper'
  },

  targets: {
    activity: 'Activity',
    activityValue: '{label} (×{factor})',
    allowedRange: 'Allowed range',
    badgeEstimate: 'Estimate',
    badgeProfessional: 'Your dietitian',
    badgeYours: 'Yours',
    basalRate: 'Basal metabolic rate',
    clampedCeiling: 'Your pace asked for {requested} kcal and we brought it down to {ceiling}: a bigger surplus becomes fat, not muscle.',
    clampedFloor:
      'Your pace asked for {requested} kcal and we raised it to {floor}: below that we will not build a plan without professional supervision.',
    computed: 'Result of the calculation',
    disclaimer:
      'These are an estimate, not a prescription. The equations are right on average, not for every person: use them as a starting point and adjust as you go.',
    edit: 'Adjust my targets',
    equation: 'Equation',
    equationMifflin: 'Mifflin-St Jeor',
    explain: 'How we worked this out',
    goal: 'Goal',
    hintRange: 'Between {min} and {max}',
    hintUpTo: 'Up to {max} g',
    kcalValue: '{value} kcal',
    labelCarbs: 'Carbohydrate (g)',
    labelFat: 'Fat (g)',
    labelKcal: 'Calories (kcal)',
    labelProtein: 'Protein (g)',
    maintenance: 'Maintenance',
    pace: 'Pace',
    rangeValue: '{floor} – {ceiling} kcal',
    reset: 'Back to the calculated ones',
    saveTargets: 'Save my targets',
    stale:
      'You had your own targets saved, but your profile has changed and they no longer fall within the limits. We are using the calculated ones until you adjust them again.',
    subtitleEstimated: 'Estimated from your profile',
    subtitleOwn: 'You set these',
    subtitleProfessional: 'Set by {name}, your dietitian',
    title: 'Your daily targets',
    unknown: '—'
  },

  terms: {
    intro: [
      'These terms are the agreement between you and NutrIA. By creating an account or using the service you accept them.',
      'The most important thing first: NutrIA helps you plan what you eat. It is not a medical service, it does not diagnose or treat anything, and it does not replace advice from a doctor or a registered dietitian.'
    ],
    sections: [
      {
        heading: 'Who provides the service',
        paragraphs: ['NutrIA is offered by {name}, a private individual resident in Spain. For anything about these terms, write to {email}.']
      },
      {
        heading: 'What NutrIA is, and what it is not',
        paragraphs: [
          'NutrIA works out indicative nutritional targets from what you tell us and proposes fourteen-day meal plans, with recipes, quantities and a shopping list.',
          'The plans are general, and NutrIA is not meant for clinical nutrition. If you have a medical condition, are pregnant or breastfeeding, take medication, or have or have had an eating disorder, speak to a professional before following a plan, and show it to them.',
          'Nutritional values are approximate: they are calculated from food composition tables, and real foods vary.'
        ]
      },
      {
        heading: 'Allergies and intolerances',
        paragraphs: [
          'The allergies and intolerances you declare are checked in our own code against the ingredients of every recipe, and a dish with a declared allergen never reaches your plan. That check works on the recipe, not on the product you buy.',
          'So always read the label of what you buy: NutrIA does not know about traces, cross-contamination or a manufacturer changing a formula. An allergy you type by hand that we do not recognise in our catalogue cannot be checked automatically, and your profile tells you when that happens. If you have a severe allergy, treat every plan as a proposal to review, not as a guarantee.'
        ]
      },
      {
        heading: 'Your account',
        list: [
          'You must be at least 18. If the date of birth you give belongs to someone younger, we will not be able to create your profile.',
          'The details you give us must be your own and true: the plans are calculated from them.',
          'The account is personal. Keep your password safe and tell us if you think somebody has been in your account.',
          'While we open NutrIA gradually, your account may have to wait for us to activate it.',
          'You can delete your account whenever you like from your profile. Everything in it is deleted, as the privacy policy explains.'
        ],
        paragraphs: []
      },
      {
        heading: 'How this contract is made',
        list: [
          'It is made when you create your account: you fill in your name, email and a password and press "Create my plan", or you sign in with Google or Apple for the first time. Either way, the notice next to those buttons links to these terms.',
          'Before you press, you can review and correct what you have typed in each field, and if something is missing or not valid we tell you before the account is created.',
          'We keep which version of these terms you accepted and when. This page always shows the current version, with its date, and you can save or print it. If you want the version you accepted, ask us at {email}.',
          'You can contract in Spanish or English.'
        ],
        paragraphs: []
      },
      {
        heading: 'Content generated with artificial intelligence',
        paragraphs: [
          'Recipes and plans are generated with the help of artificial intelligence and validated by our own code before you see them. They can still contain mistakes: a cooking time, a quantity, an unclear step. Use your judgement in the kitchen, above all with food safety: cook meat, fish and eggs through, and keep the cold chain.',
          'The pictures of the dishes are also generated by artificial intelligence, from the recipe, and we mark them as such. They are for illustration only: they are not a photo of the dish you will cook and may not show all of its ingredients or its real quantities. What each dish contains is what its ingredient list says, and that list is the one that takes your allergies into account.'
        ]
      },
      {
        heading: 'The free plan and Premium',
        list: [
          'The first time you subscribe to Premium you get a free trial, whose length is shown before it starts: nothing is charged until it ends, and if you cancel before then you pay nothing.',
          'The subscription renews by itself at the end of each period until you cancel it.',
          'You can cancel whenever you like from your profile. You keep Premium until the end of the period already paid for, and you are not charged again.',
          'You have 14 days from the first charge to withdraw without giving a reason: write to us and we will refund what you paid.',
          'If we change the price, we will tell you in advance and you can cancel before it applies.'
        ],
        paragraphs: [
          'NutrIA can be used for free, with limits on the plans you can redo, the meals you can swap and the events in each plan. Food safety — allergies, intolerances and nutrients — is the same with Premium and without it.',
          'Premium, when it is available, raises those limits for a monthly or yearly subscription. The price is shown, tax included, before you pay, and the payment is handled by Stripe.'
        ]
      },
      {
        heading: 'Acceptable use',
        list: [
          "Accessing, or trying to access, other people's data.",
          'Extracting the content automatically, or reselling the plans or the recipes.',
          'Using the service in a way that degrades it for others, for example generating plans in bulk or by script.',
          'Trying to get around the limits of the free plan or the security measures.'
        ],
        paragraphs: ['NutrIA is for your personal use. We may suspend or close an account that does any of the following:']
      },
      {
        heading: 'Intellectual property',
        paragraphs: [
          'The application, its design and its words belong to NutrIA. The plans and recipes you receive are for your personal use: cook them, print them, share them with the people you eat with. What you write — your profile, your comments — remains yours; if you send us a suggestion, we may use it to improve the product without owing you anything for it.'
        ]
      },
      {
        heading: 'Availability and changes to the service',
        paragraphs: [
          'We do what we can to keep NutrIA working, but we cannot guarantee it: there may be interruptions, and features may change or disappear. If we ever close the service, we will give notice in good time so you can keep what you need, and we will refund the unused part of any paid subscription.'
        ]
      },
      {
        id: 'dietista',
        heading: 'If you work with a dietitian',
        paragraphs: [
          'A dietitian-nutritionist can invite you to follow your plan with them on NutrIA. If you accept, they can see and adjust your plan as the invitation and the privacy policy explain, and while the link lasts you get Premium’s limits at no cost.',
          'Your dietitian is an independent professional: their advice and their relationship with you are between the two of you. NutrIA is the tool and is not responsible for their clinical decisions, just as your dietitian is not responsible for how NutrIA works.',
          'You can end the link whenever you like. When it ends, you keep your account, your history and your last published plan, on the free limits.'
        ]
      },
      {
        heading: 'Liability',
        paragraphs: [
          'We answer for damage we cause deliberately or through gross negligence, and for everything the law does not allow us to exclude. We do not answer for health decisions you take from a plan without speaking to a professional, nor for the products you buy. None of this limits the rights you have as a consumer.',
          'If you use NutrIA with a dietitian, their advice is their responsibility as a professional; what NutrIA does — how it calculates, what it checks and what it shows you — is ours.'
        ]
      },
      {
        heading: 'Changes to these terms',
        paragraphs: [
          'If we change anything important, we will say so here with the date of the update and tell you by email before it applies. If you do not agree, you can delete your account; continuing to use NutrIA after the change means you accept it.'
        ]
      },
      {
        heading: 'Governing law',
        paragraphs: [
          'These terms are governed by Spanish law. If you are a consumer living in another country, you keep the protection of the mandatory rules of the country where you live, and you may bring a claim before the courts of your home address.'
        ]
      }
    ],
    title: 'Terms of use',
    updated: 'Last updated: 29 September 2026'
  },

  tour: {
    back: 'Back',
    closing: 'You can see this again from your profile whenever you like. And if something is missing, tell me right there.',
    done: 'Got it',
    next: 'Next',
    progress: '{step} of {of}',
    replayBody: 'A quick run through what NutrIA does, in case you skipped it or want to see it again.',
    replayCta: 'See the tour',
    replayTitle: 'How NutrIA works',
    skip: 'Skip',
    stops: {
      checkIn: {
        body: 'When the fourteen days are up we ask for your weight and how it went. That is what sets the targets for the next plan — it is what makes each fortnight fit you better.',
        cta: 'Go to the check-in',
        title: 'The fortnight check-in'
      },
      plan: {
        body: 'Every fourteen days NutrIA builds a whole plan around your targets, your allergies and what you like. You do not have to choose anything: it is already done.',
        cta: 'See the plan',
        title: 'Your fortnight, already planned'
      },
      shape: {
        body: 'If you skip breakfast, take it out. If you eat a light dinner, say so. The day is shared out between the meals you actually eat.',
        cta: 'Adjust my meals',
        title: 'Say which meals you eat, and how big'
      },
      swap: {
        body: 'Every meal has a button to change it, and you can say what you want instead: quicker, no cooking, more protein or vegetarian. You get a few changes each fortnight.',
        cta: 'See the plan',
        title: "Don't fancy a dish? Change it"
      },
      trip: {
        body: 'Mark the days you will be away and the fortnight pauses: the days that were left are still there when you get back.',
        cta: 'Mark a trip',
        title: 'Going away? The plan waits'
      }
    }
  },

  twoFactor: {
    activate: 'Turn on',
    addToApp: 'Add to your app',
    attemptsSpent: 'Too many wrong codes for this sign-in. Sign in again to start over.',
    backupCode: 'Backup code',
    backupCodeHint: 'One of the 10 you saved: 10 letters and numbers with a hyphen.',
    backupCodeMissing: 'A backup code is 10 letters and numbers with a hyphen, like abcde-12345.',
    bodyOff:
      'When you sign in, as well as your password we will ask for a 6-digit code from an authenticator app, such as iPhone Passwords or Google Authenticator.',
    bodyOn:
      'When you sign in with your password we also ask for a code from your authenticator app. If you do not have it to hand, a backup code works.',
    challengeBackupSubtitle: 'Type one of the backup codes you saved when you turned it on. Each one works only once.',
    challengeSubtitle: 'Your account has 2-step verification turned on. Type the code your authenticator app is showing now.',
    challengeTitle: '2-step verification',
    code: 'Verification code',
    codeHint: 'The 6-digit code your authenticator app shows.',
    codeMissing: 'The code has 6 digits.',
    codesBody: 'Each code works once. You will not see them here again; if you lose them, generate new ones.',
    codesCopied: 'Codes copied.',
    codesSaved: 'I have saved them',
    codesSavedMissing: 'Tick the box once you have saved them: you will not see them again.',
    codesTitleEnabled: 'Verification turned on. Save your backup codes',
    codesTitleRegenerated: 'New codes. The old ones no longer work',
    confirm: 'Check and turn on',
    confirmCode: 'Code from the app',
    confirmHint: 'The 6 digits the app shows now: that is how we know it was added properly.',
    copy: 'Copy codes',
    copyFailed: 'They could not be copied. Download them or write them down.',
    copySecret: 'Copy key',
    disable: 'Turn off',
    disableBody: 'Your account will be protected by your password alone, and your backup codes will stop working.',
    disableConfirm: 'Turn off verification',
    disabled: '2-step verification turned off. We have confirmed it by email.',
    disableTitle: 'Turn off 2-step verification?',
    done: 'Done',
    download: 'Download (.txt)',
    downloading: 'Downloading {file}',
    enabled: '2-step verification turned on. We have confirmed it by email.',
    expired: 'Too much time has passed. Sign in again.',
    fileDate: 'Generated on {date}',
    fileName: 'nutria-backup-codes.txt',
    fileNote: 'Each code works only once. If you generate new codes, these stop working.',
    fileTitle: 'NutrIA · Backup codes',
    googleNote: 'If you also sign in with Google, we do not ask for the code there: your Google account’s own 2-Step Verification protects it.',
    locked: 'Too many failed attempts. Wait 15 minutes and sign in again.',
    lockedSettings: 'Too many wrong codes. Wait 15 minutes and try again.',
    password: 'Your password',
    passwordMissing: 'Type your password.',
    passwordStep: 'First, your password: anything that changes your account’s security always asks for it.',
    regenerate: 'Generate new codes',
    regenerateBody: 'The old codes will stop working.',
    regenerateConfirm: 'Generate codes',
    regenerated: 'You have new backup codes. The old ones no longer work.',
    regenerateTitle: 'Generate new backup codes?',
    scanCaption: 'Scan it with your authenticator app. If you are on your phone, use the button or the key below.',
    secret: 'Setup key',
    secretCopied: 'Key copied.',
    setupWrongCode: 'That does not match. Type the code the app is showing now.',
    statusOff: 'Off',
    statusOn: 'On',
    stepConfirm: 'Step 3 of 3: check the code',
    stepPassword: 'Step 1 of 3: your password',
    stepScan: 'Step 2 of 3: add NutrIA to your app',
    title: '2-step verification',
    trustDevice: 'Trust this device for 30 days',
    trustDeviceHint: 'We will not ask for the code in this browser for 30 days. Do not tick it on a shared device.',
    useApp: 'Use the code from the app',
    useBackup: 'Use a backup code',
    verify: 'Verify',
    verifying: 'Verifying…',
    wrongBackupCode: 'That backup code is not valid or has already been used.',
    wrongCode: 'That code is not right. Type the one the app shows now; if it keeps failing, check that your phone sets its time automatically.',
    wrongPassword: 'That password is not right.'
  },

  units: {
    gram: 'g',
    kcal: 'kcal',
    kilogram: 'kg',
    litre: 'l',
    millilitre: 'ml',
    perWeek: '{value} kg / week',
    proteinShort: 'g P',
    slice: 'slices',
    unit: 'units'
  },
  vacations: {
    add: 'Pause the plan',
    added: 'Trip added. Your plan pauses on those days.',
    awayBody: 'Your plan is waiting. It picks up on {until}, exactly where you left it.',
    awayNow: 'right now, {count} days',
    awayTitle: 'You are away',
    back: 'Welcome back. Your plan carries on from today.',
    backEarly: 'I am back',
    backEarlyFor: 'I am back from the trip from {from} to {to}',
    cancel: 'Remove',
    cancelFor: 'Remove the trip from {from} to {to}',
    days: '{count} days',
    from: 'From',
    intro:
      'Mark the days you will be away and the plan pauses: those days do not count as skipped, and when you return it carries on where it stopped.',
    pausedUntil: 'Your plan is paused · it picks up on {date}',
    range: '{from} to {to}',
    removed: 'Trip removed.',
    seePlan: 'See my plan',
    title: 'Holidays',
    to: 'Until'
  }
};
