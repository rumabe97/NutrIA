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
    accounts: 'Accounts',
    accountsTitle: 'Accounts and access',
    activate: 'Open account',
    activateFor: 'Open the account of {email}',
    activationTitle: 'New accounts',
    activityPeople: '{count} people signed in during this window.',
    activityTitle: 'Activity ({days} days)',
    aiByModel: 'Today, by the model that answered',
    aiCalls: 'Requests today',
    aiHint:
      'Our count of what left this service, against the limit you configured. Google publishes no endpoint for what is left: if their console says something else, the difference is calls that did not come through here.',
    aiLastRefusal: 'Last refusal for quota',
    aiLastRefusalValue: '{model} · limit {limit} · retry in {seconds} s · at {time} UTC',
    aiModel: 'Model',
    aiModelUsage: '{calls} calls · {failed} failed · {seconds} s on average · {input} / {output} tokens',
    aiRefused: 'Refused for quota',
    aiResets: 'The daily count starts again',
    aiTitle: 'AI',
    aiTokens: 'Tokens (in / out)',
    attempts: '{count} attempts',
    automaticActivation: 'Automatic activation',
    automaticHint: 'Whoever confirms their address is in. Nothing for you to do.',
    confirmed: 'email confirmed',
    events: { session_started: 'Sign-ins', swap_requested: 'Meal swaps asked for' },
    failureNote: '{count} generations failed. The code says whether it was the quota, the key or the catalogue.',
    failures: 'Failures',
    feedbackHandled: 'Mark as seen',
    feedbackHandledFor: 'Mark the message from {email} as seen',
    feedbackHandledState: 'Seen',
    feedbackReopen: 'Reopen',
    feedbackReopenFor: 'Reopen the message from {email}',
    feedbackTitle: 'Inbox ({count} unseen)',
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
    funnelHint:
      'Counted from the data rather than from events, so it covers the accounts that predate this screen. The percentage is of the step above.',
    funnelTitle: 'Funnel',
    inDays: 'in {days} days',
    ingredients: 'Ingredients',
    intro: 'How the service is doing. No plan and no profile here: only whether generation works and how much the catalogue holds.',
    jobsTitle: 'Generations ({days} days)',
    justOpened: 'Account opened: {email}',
    logCall: '{slot}, round {round}: {model}',
    logCallAsked: 'asked: {model}',
    logCallDropped: 'dropped: {reasons}',
    logCallFailed: 'failed ({status})',
    logCallIds: 'request {request}',
    logCallKept: '{kept} of {dishes} dishes',
    logCallQuota: 'quota: limit {limit}, retry in {seconds} s',
    logCallReasoning: '{count} reasoning',
    logCalls: '{count} model calls',
    logCallTokens: '{input} / {output} tokens',
    logCallVia: 'via {provider}',
    logEmpty: 'No generation logged yet.',
    logHint:
      'The latest generations, who asked for each, and every model call: which model answered, through which provider, how long it took, the tokens and which dishes were kept. The request is the id the OmniRoute dashboard files that call under.',
    logNoCalls: 'No model call: it came from the library, or never got as far as asking.',
    logPlan: 'plan {version} · {model} · prompt {prompt} · {reused} dishes from the library',
    logTitle: 'Generation log',
    makeFree: 'Move to free',
    makeFreeFor: 'Move {email} to the free tier',
    makePremium: 'Give premium',
    makePremiumFor: 'Give {email} premium',
    makeProfessional: 'Make professional',
    makeProfessionalFor: 'Make the account {email} a professional',
    manualHint: 'Confirming their address leaves the account waiting and sends you a mail. You open it from this list.',
    noAccounts: 'No account yet.',
    noActivity: 'No activity recorded yet.',
    noFeedback: 'Nobody has written yet.',
    noJobs: 'No generation yet.',
    notOpened: 'not opened',
    opened: 'account open',
    pagerNext: 'Next',
    pagerOf: '{from}–{to} of {total}',
    pagerPrevious: 'Previous',
    plansTitle: 'Plans by state',
    premiumHint: 'Premium is on: accounts you have granted it get three redos a fortnight and twenty swaps a plan.',
    premiumLabel: 'Paid tier',
    premiumOffHint: 'Premium is off: everybody is on the free limits, including anyone already granted it. Turning it on gives it back.',
    premiumTitle: 'Paid tier',
    professionalChip: 'Professional',
    professionalCollegiate: 'Collegiate number',
    professionalCollegiateHint: 'Letters, digits, / or -, as their college writes it. Check it before granting.',
    professionalGrant: 'Grant',
    professionalGranted: 'No. {number} · since {date}',
    professionalHint: 'On: the professionals you grant can open their practice and link clients.',
    professionalLabel: 'Practice for dietitians',
    professionalLinks: '{active} active · {paused} paused · {ended} ended',
    professionalOffHint: 'Off: nobody sees the practice, not even those already granted. Their clients carry on as ordinary accounts.',
    professionalRevoke: 'Revoke',
    professionalRevokeBody: 'They lose access to their practice and their unanswered invitations are cancelled.',
    professionalRevokeConfirm: 'Yes, revoke',
    professionalRevokeFor: 'Revoke the grant of {email}',
    professionalRevokeTitle: 'Revoke {email} as a professional?',
    professionalsEmpty: 'No professionals yet.',
    professionalsHint: 'Each professional with their links counted. No client appears here. Granted from the accounts list.',
    professionalsTitle: 'Professionals',
    pushTest: 'Send me a test notification',
    pushTestNoDevice: 'No device of yours has notifications on. Turn them on in your profile, from your phone, and try again.',
    pushTestRefused:
      'None of your {count} devices accepted it. If you removed the permission or the app, turn notifications on again in your profile.',
    pushTestSent: 'Sent: {count} of your devices accepted it. It should arrive in a few seconds.',
    pushTestUnconfigured: 'Push is not set up on the server: the VAPID variables are missing on the API project in Vercel, or it needs a redeploy.',
    recipes: 'Recipes',
    rejection: {
      allergen: 'allergen',
      duplicate: 'repeated',
      foreign_food: 'names what it lacks',
      over_time: 'too long',
      schema: 'schema',
      unknown_ingredient: 'invented ingredient',
      unwanted: 'diet or dislikes'
    },
    remindersHint:
      'On: every morning, whoever has finished their fortnight without checking in is told, by email and on the phones that asked. Once a fortnight, and each person can turn it off on their profile.',
    remindersLabel: 'Send the reminder',
    remindersOffHint: 'Off: no reminder goes out. The check-in only shows on the Today screen.',
    remindersTitle: 'Check-in reminder',
    roleAdmin: 'admin',
    tierPremium: 'Premium',
    title: 'Service',
    unconfirmed: 'unconfirmed',
    waiting: '{count} not activated',
    withoutImage: '{count} without a picture'
  },

  appNav: {
    brandHome: 'NutrIA — home',
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
    chooseNewPasswordSubtitle: 'You will be able to sign in with it afterwards.',
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
    legalNotice: 'By continuing you accept the {terms} and the {privacy}.',
    legalPrivacy: 'privacy policy',
    legalTerms: 'terms of use',
    name: 'Name',
    newPassword: 'New password',
    noAccount: 'No account yet?',
    orWithEmail: 'or with your email',
    password: 'Password',
    passwordHint: 'At least {count} characters.',
    passwordsDoNotMatch: 'The passwords do not match.',
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
    accessLogListCollapsed: '{professional} has viewed your profile {count} times',
    accessLogLoaded: '{count} more entries loaded.',
    accessLogLoadMore: 'Show more',
    accessLogNoMore: 'No more entries to show.',
    accessLogRead: '{professional} viewed {kind}',
    accessLogTitle: 'Who has accessed',
    accessLogWrite: '{professional} changed {kind}',
    declineCta: 'No, thanks',
    end: 'End the link',
    endConfirmBody: 'Your dietitian will stop seeing your profile, your plan and your progress. You can accept another invitation from them later.',
    endConfirmCta: 'Yes, end it',
    endConfirmTitle: 'End the link with {professional}?',
    healthQuestion: 'Also share your health record',
    healthShareIntro: 'Besides the above, you can also share:',
    healthShareNote: 'Only if you tick it. You can leave it unticked and decide later from your profile.',
    healthShares: { conditions: 'your health conditions', medications: 'your medications', supplements: 'your supplements' },
    invitationAccept: 'Accept the invitation',
    invitationIntro: '{professional} invites you to share your tracking with NutrIA, to support you.',
    invitationLinkExistsBody: 'You already have a dietitian linked: {professional}, since {since}.',
    invitationLinkExistsCta: 'See my profile',
    invitationLinkExistsTitle: 'You already have an active link',
    invitationShareIntro: 'If you accept, {professional} will be able to see:',
    invitationTitle: 'Invitation from {professional}',
    linkSince: 'Since {date}',
    linkTitle: 'Your dietitian',
    shares: { checkIns: 'your check-ins', mealPlans: 'your meal plans', profile: 'your profile', progress: 'your progress', targets: 'your targets' },
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
    commentsHint: 'Optional. In your words: dishes, timing, anything. It reaches the model as written.',
    difficulty: 'How was following the plan?',
    difficultyEasy: 'Easy',
    difficultyHard: 'Hard',
    difficultyOk: 'Manageable',
    doneBody: 'Thank you. Here is what changes:',
    doneNoTargets: 'Targets unchanged.',
    doneTargets: 'Calorie target: from {from} to {to} kcal a day.',
    doneTitle: 'Fortnight closed',
    doneWeight: 'Weight logged: the targets are computed from it now.',
    doneWords: 'Your words reach the model when you generate the next plan.',
    hunger: 'How were the portions?',
    hungerHungry: 'I was left hungry',
    hungerRight: 'Right',
    hungerTooMuch: 'Too much',
    intro:
      'Five questions. What you say here changes the next plan: your weight adjusts the targets, the portions move them 5 % up or down, and your words reach the model as written.',
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
    onboardingIncomplete: 'Part of your profile is missing. Finish it and try again.',
    planPaused: 'Your plan is paused while you are away.',
    practiceFull: 'Your practice already has all the clients your plan includes.',
    quotaExceeded: 'You have used up what your plan allows this fortnight.',
    request: 'We could not complete that action.',
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
    custom: 'Custom',
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
      'It is stored in your account, never sent to an AI model, never written to the server logs, and deleted with your account. You can delete it on its own with the button below.',
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
      'Goal, age, activity, schedule, budget, the cooking you like, the foods you never want to see again. It all goes into the calculation, and it can all be changed later.',
    personalisationTitle: 'Your plan knows you get home late on Tuesdays.',
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
      {
        body: 'Your goal, your schedule, your allergies, your budget, and what you have no intention of cooking on a Tuesday.',
        title: 'You tell us how you live'
      },
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
    alternatives: 'If you can’t find it',
    back: '← Back to the plan',
    backToHistory: '← Back to the earlier plan',
    badgeDone: 'Eaten',
    badgeSkipped: 'Skipped',
    cook: 'Cook',
    dayOf: '{slot} · Day {day}',
    difficulty: { easy: 'Easy', hard: 'Hard', medium: 'Medium' },
    difficultyLabel: 'Difficulty',
    dislike: 'Not for me',
    dislikedHint: 'Noted: it will not come back, nor anything close to it.',
    done: 'Eaten',
    doneHint: 'Marked as eaten.',
    illustration: 'AI-generated illustration',
    ingredients: 'Ingredients',
    like: 'I like it',
    likedHint: 'Noted: it may come back, and we will look for dishes along these lines.',
    markDone: 'Mark as eaten',
    minutes: '{value} min',
    noCooking: 'No cooking',
    none: '—',
    notYet: 'You can mark it on {date}.',
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
        '— it is not in our catalogue, so we cannot guarantee it. We tell the generator to avoid it and we discard any dish with ingredients we cannot identify, but check the dishes before you cook them.',
      enforced: '— applied: “{ingredient}” will not appear in any dish.'
    },
    fields: {
      activityLevel: 'Activity level',
      allergies: 'Allergies',
      birthDate: 'Date of birth',
      breakfastStyle: 'What do you usually have for breakfast?',
      budget: 'Budget',
      cookingFrequency: 'How often do you cook?',
      cookingTime: 'Minutes you can spend cooking',
      cookingTimeHint: 'Per meal, between 5 and 240.',
      country: 'Where do you do your shopping?',
      countryHint: 'It decides which ingredients reach your plan: nothing will be suggested that you cannot buy where you are.',
      cuisines: 'Cuisines you fancy',
      customAllergens: 'Something not on the list',
      customAllergensHint: 'Separate with commas. When you save we look each one up in our catalogue and tell you what we can apply.',
      customGoal: 'If you chose “Other”, describe it',
      dietaryPatterns: 'Way of eating',
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
      portionPreference: 'Do you prefer large plates or light ones?',
      sex: 'Sex',
      sexHint: 'Used only for the metabolic equation. If you would rather not say, we use the middle value.',
      sleepEnd: 'What time do you get up?',
      sleepStart: 'What time do you go to bed?',
      targetWeightKg: 'Target weight (kg)',
      traceHint: 'Tick “traces” if products that may contain the allergen affect you too.',
      traceLabel: 'traces',
      traceLabelFor: 'Traces of {allergen}',
      trainingDays: 'Training days per week',
      trainingTime: 'What time do you train?',
      weightKg: 'Current weight (kg)',
      workScheduleNotes: 'Anything about your schedule we should know'
    },
    options: {
      activity: {
        athlete: { hint: 'Two sessions a day, or competing.', label: 'Athlete' },
        high: { hint: 'I train 5–6 times, or my work is physical.', label: 'High' },
        light: { hint: 'I walk daily or train once or twice.', label: 'Light' },
        moderate: { hint: 'I train 3–4 times a week.', label: 'Moderate' },
        sedentary: { hint: 'Desk job, little exercise.', label: 'Sedentary' }
      },
      budget: {
        high: { hint: 'Fresh and seasonal.', label: 'Generous' },
        low: { hint: 'Basics and own brands.', label: 'Tight' },
        medium: { hint: 'Without thinking about it too hard.', label: 'Normal' }
      },
      cookingFrequency: { daily: 'Daily', often: 'Often', rarely: 'Almost never', sometimes: 'Sometimes' },
      countries: { ES: 'Spain', GB: 'United Kingdom' },
      dietaryPatterns: {
        flexitarian: 'Flexitarian',
        gluten_free: 'Gluten-free',
        halal: 'Halal',
        kosher: 'Kosher',
        lactose_free: 'Lactose-free',
        omnivore: 'No restriction',
        pescatarian: 'Pescatarian',
        vegan: 'Vegan',
        vegetarian: 'Vegetarian'
      },
      goals: {
        custom: { hint: 'Tell us in your own words.', label: 'Other' },
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
      lifestyle: { subtitle: 'So meals land when you can actually eat them.', title: 'Your days' },
      review: { subtitle: 'Check everything is right before you finish.', title: 'Review' }
    }
  },

  pages: {
    '/': {
      description:
        'Fourteen-day plans with recipes, quantities and the shopping list already done, built around your goals, your timetable and your allergies.',
      title: 'NutrIA — Personalised meal plans'
    },
    '/acceder': { description: "Sign in to NutrIA to see today's plan, your shopping list and your progress.", title: 'Sign in' },
    '/admin': { title: 'Admin' },
    '/check-in': { title: "The fortnight's check-in" },
    '/compra': { title: 'The shopping' },
    '/condiciones': {
      description: 'The terms for using NutrIA: what it is and is not, your account, allergies, Premium and how to cancel it.',
      title: 'Terms of use'
    },
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
    title: 'Your plan',
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
    planTestMode: 'Test mode: nothing you pay is real money.',
    planTitle: 'Your plan',
    planTrial: 'The first {days} days are free.',
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

  privacy: {
    intro: [
      'This policy explains what data NutrIA holds about you, what it is used for, who it is shared with, and what you can do to see, correct or delete it.',
      'NutrIA is a meal-planning tool. It is not a medical service and does not replace advice from a doctor or a registered dietitian.'
    ],
    sections: [
      {
        heading: 'Who processes your data',
        paragraphs: [
          'The data controller is {name}, a private individual — not a company or a registered self-employed business. You can write to {email} for anything about your data, including a request to access, correct or delete it.'
        ]
      },
      {
        heading: 'What we collect, and why',
        list: [
          'Account: your name and email address and, if you sign in with Google or Apple, the name and email that service confirms to us. So you can create an account and get into it.',
          'Profile and targets: your age, sex, height, weight, activity level and nutritional targets. To work out how much you need to eat.',
          'Allergies and intolerances: the foods you cannot eat. So no plan ever proposes one of them.',
          'Conditions, medication and supplements: only if you choose to tell us, under a separate consent you can withdraw at any time without deleting the rest of your account.',
          'Preferences: the cuisine you prefer, foods you dislike, your meal times. To fit your plans to you.',
          'Use of the plan: which meals you mark eaten or skipped, your weight over time, your fortnightly check-ins. So your next plan takes this into account.',
          'Payments: if you subscribe to Premium, Stripe processes the charge and we store only an identifier for your subscription and its status. We never see or store your card number.',
          'Technical use: which actions you take in the app (for example, that you signed in, or asked for a different recipe), with nothing more than that, to know what works and what does not.'
        ],
        paragraphs: []
      },
      {
        heading: 'Why we may process this data',
        paragraphs: [
          'Account, profile, targets, allergy and plan-use data are processed because they are necessary to give you the service you asked for: without them NutrIA cannot calculate or propose anything. Your conditions, medication and supplements are processed only with your explicit consent, recorded with its date and withdrawable at any time from your profile. Anonymous technical use is processed under our legitimate interest in knowing whether the product works.'
        ]
      },
      {
        heading: 'Who we share your data with',
        list: [
          'An AI generation provider, to propose your recipes and plans. It receives only your nutritional targets, your preferences, and your allergies and intolerances — never your conditions, your medication or your supplements. What the AI proposes is always checked against our own code before it reaches you: a declared allergen never reaches your plan even if the model got it wrong.',
          'Stripe, if you subscribe to Premium, to charge the subscription. Stripe processes and retains payment data under its own policies.',
          'Our email provider, to send you the confirmation, password-reset and check-in reminder emails you ask for.',
          "Your own browser's push notification service, if you turn on reminders on your phone.",
          'Sentry, an error-monitoring service, only when it is switched on. It receives the error and where in the code it happened, never your personal data or anything you wrote.',
          'Vercel and Neon, who host the application and the database. Nobody else has access to them.'
        ],
        paragraphs: ['We do not sell your data to anyone. There are no adverts on NutrIA and no advertising cookies.']
      },
      {
        heading: 'How long we keep your data',
        paragraphs: [
          'We keep your data for as long as your account exists. Deleting your account deletes everything in it at once and in cascade: profile, allergies, plans, shopping lists, progress and consents. A technical backup may hold that information for a few more days, only so we can recover from a fault, and it is removed automatically once that period passes.',
          'If you subscribed to Premium, Stripe keeps billing data for as long as the law requires, regardless of whether you delete your account.'
        ]
      },
      {
        heading: 'Your rights',
        list: [
          'Access the data we hold about you, from your profile or by asking by email.',
          'Correct it, from your own profile in most cases.',
          'Delete it, by deleting your account from your profile or by asking by email.',
          'Withdraw your consent to hold conditions, medication or supplements, without it affecting the rest of your account.',
          'Object to anonymous technical use, by writing to us.',
          "Complain to Spain's data protection authority, the Agencia Española de Protección de Datos (aepd.es), or to your own country's authority, if you believe we have not respected your rights."
        ],
        paragraphs: []
      },
      {
        heading: 'How we protect your data',
        paragraphs: [
          'Your password is never stored in plain text. The connection between your device and NutrIA is always encrypted. Your conditions, medication and supplements live in a part of the code that never talks to the AI. Access to the database is restricted, and nobody looks at it except to fix a fault.'
        ]
      },
      {
        heading: 'Cookies and storage on your device',
        paragraphs: [
          'We use two cookies, neither for advertising: one holds your signed-in session, the other the language you chose. Neither tracks your activity on other sites, and there is no third-party cookie.',
          "If you install NutrIA on your phone, your browser keeps a copy of today's plan and the shopping list so they work offline. That copy stays on your own device: it never reaches us, and we never see it."
        ]
      },
      { heading: 'Children', paragraphs: ['NutrIA is not directed at anyone under 16, and we do not deliberately ask for their data.'] },
      {
        heading: 'Changes to this policy',
        paragraphs: [
          'If we change anything important, we will say so here with the date of the update. If the change affects how we treat your conditions, your medication or your supplements, we will ask for your consent again before applying it.'
        ]
      }
    ],
    title: 'Privacy policy',
    updated: 'Last updated: 21 September 2026'
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

  shopping: {
    emptyBody: 'The list is generated with your plan, already added up and grouped by aisle.',
    emptyCta: 'See my plan',
    emptyTitle: 'No list yet',
    nearby: 'Supermarkets nearby',
    nearbyOpens: ' (opens in your maps app)',
    nearbyQuery: 'supermarket',
    notice: 'For now the list is read-only. Ticking off what you already have, adjusting quantities and adding items arrives in the next release.',
    progress: '{done} of {total} in the trolley',
    share: 'Share what is left',
    shareCopied: 'List copied: paste it wherever you like.',
    shareNothing: 'Everything is in the trolley: nothing left to share.',
    shareTitle: 'Shopping list',
    subtitle: 'Everything you need for the fortnight, already added up.',
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
          'You must be at least 16.',
          'The details you give us must be your own and true: the plans are calculated from them.',
          'The account is personal. Keep your password safe and tell us if you think somebody has been in your account.',
          'While we open NutrIA gradually, your account may have to wait for us to activate it.',
          'You can delete your account whenever you like from your profile. Everything in it is deleted, as the privacy policy explains.'
        ],
        paragraphs: []
      },
      {
        heading: 'Content generated with artificial intelligence',
        paragraphs: [
          'Recipes and plans are generated with the help of artificial intelligence and validated by our own code before you see them. They can still contain mistakes: a cooking time, a quantity, an unclear step. Use your judgement in the kitchen, above all with food safety: cook meat, fish and eggs through, and keep the cold chain.'
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
        heading: 'Liability',
        paragraphs: [
          'We answer for damage we cause deliberately or through gross negligence, and for everything the law does not allow us to exclude. We do not answer for health decisions you take from a plan without speaking to a professional, nor for the products you buy. None of this limits the rights you have as a consumer.'
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
    updated: 'Last updated: 21 September 2026'
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
