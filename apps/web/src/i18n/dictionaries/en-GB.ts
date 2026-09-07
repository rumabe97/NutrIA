import type { Dictionary } from './es-ES';

/**
 * British English.
 *
 * Typed as `Dictionary`, so a key added to Spanish and forgotten here fails the
 * build. That is the whole reason this file has no keys of its own.
 */
export const enGB: Dictionary = {
  activity: {
    athlete: 'Athlete',
    high: 'High',
    light: 'Light',
    moderate: 'Moderate',
    sedentary: 'Sedentary'
  },

  appNav: {
    brandHome: 'NutrIA — home',
    home: 'Home',
    mainLabel: 'Main navigation',
    plan: 'Plan',
    profile: 'Profile',
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
    createAccount: 'Create your account',
    createAccountSubtitle: 'A few minutes of questions and you will have your first fourteen-day plan.',
    email: 'Email address',
    emailTaken: 'An account with that email already exists.',
    forgotPassword: 'Forgotten your password?',
    goToAccount: 'Go to my account',
    haveAccount: 'Already have an account?',
    invalidCredentials: 'Wrong email or password.',
    invalidLink: 'This link is not valid, or it has expired.',
    name: 'Name',
    newPassword: 'New password',
    noAccount: 'No account yet?',
    password: 'Password',
    passwordHint: 'At least {count} characters.',
    passwordsDoNotMatch: 'The passwords do not match.',
    passwordTooShort: 'The password must be at least {count} characters.',
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
    signUp: 'Create my plan',
    signUpFailed: 'We could not create the account. Please try again.',
    signUpPending: 'Creating your account…',
    toSignIn: 'Sign in',
    toSignUp: 'Create one',
    verifyBody: 'We have sent you a confirmation link. Open it on this device to activate your account.',
    verifyMeanwhile: 'In the meantime you can carry on setting up your profile: your plan is generated when you finish.',
    verifyTitle: 'Confirm your email'
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
    targetsClamped: 'We adjusted your pace: it asked for {requested} kcal and we raised it to {floor}, the daily minimum we consider safe without professional supervision.',
    targetsEstimate: 'These are an estimate from your profile. You can adjust them.',
    targetsLabel: 'Your daily targets · {status}',
    targetsStatusEstimated: 'estimated',
    targetsStatusOverridden: 'set by you',
    today: 'Today',
    todayVsTarget: 'Today, against your targets',
    tomorrow: 'tomorrow',
    weightLog: 'Log',
    weightNone: 'No weight logged yet.',
    weightPlaceholder: 'kg',
    weightSince: '{change} kg since your first entry',
    weightStable: 'No change since your first entry',
    weightStart: 'You started at {value} kg',
    weightTitle: 'Your weight',
    weightToday: 'Today'
  },

  errors: {
    boundaryBody: 'It may be an intermittent connection. Try again; if it keeps failing, your data is safe.',
    boundaryHome: 'Go to the dashboard',
    boundaryTitle: 'We could not load this page',
    conflict: 'That is already in use.',
    internal: 'Something went wrong at our end. Try again in a moment.',
    invalidInput: 'Check the fields marked.',
    network: 'We could not connect. Check your connection.',
    notFound: 'We could not find what you were looking for.',
    onboardingIncomplete: 'Part of your profile is missing. Finish it and try again.',
    request: 'We could not complete that action.',
    unsafeContent: 'That content does not meet your dietary restrictions.'
  },

  footer: {
    account: 'Account',
    createAccount: 'Create account',
    disclaimer:
      'NutrIA produces general meal plans. It does not replace advice from a doctor or a registered dietitian. Speak to a professional if you have a medical condition, are pregnant, or take medication.',
    product: 'Product',
    signIn: 'Sign in',
    tagline: 'Nutrition that adapts to you.'
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
    invalidPlanBody: 'We built a plan but it did not meet your nutrition targets, so we discarded it rather than give it to you.',
    invalidPlanTitle: 'The plan did not come out right',
    onboardingIncompleteBody: 'We are missing information about you before we can work out what you need.',
    onboardingIncompleteTitle: 'Your profile is unfinished',
    poolTooSmallBody:
      'We do not yet have enough recipes that fit your restrictions, and no AI provider is configured, so we cannot create the missing ones. Set AI_PROVIDER on the server, or wait for the recipe library to grow.',
    poolTooSmallTitle: 'We are short of recipes',
    profileIncompleteBody: 'We need your date of birth, height, sex, weight and activity level to work out your targets.',
    profileIncompleteTitle: 'Your profile is missing information',
    rateLimited: 'You have asked for several plans in a row. Wait a moment before trying again.',
    safetyNote: 'We check your allergies before saving anything.',
    serverDetail: 'Server detail:',
    starting: 'Starting…',
    steps: {
      BUILDING_LIST: 'Putting your shopping list together',
      CHOOSING_RECIPES: 'Choosing recipes',
      LOADING_PROFILE: 'Reading your profile',
      SAVING_PLAN: 'Saving your plan',
      SCHEDULING_MEALS: 'Spreading the meals across the 14 days',
      VALIDATING_PLAN: 'Checking everything adds up'
    },
    title: 'We are building your plan',
    unsafeBody: 'We blocked the plan because a meal did not respect your allergies. We would rather give you nothing than give you something you cannot eat.',
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
    supplementName: 'Name',
    supplementProtein: 'Protein per serving (g)',
    supplementProteinLabel: 'Protein from supplements',
    supplementProteinTotal: '{grams} g per day,',
    supplementProteinTotalEmphasis: 'on top of',
    supplementProteinTotalTail: 'what the plan provides.',
    supplements: 'Supplements',
    supplementServings: 'Servings per day',
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
        answer: 'No. NutrIA is a meal-planning tool. If you have a medical condition, are pregnant, or take medication, speak to a healthcare professional.',
        question: 'Does this replace a dietitian or my doctor?'
      },
      {
        answer: 'All of them. Past plans are kept with their recipes, their shopping lists and your notes, and you can look them up whenever you like.',
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
      { body: 'Weight, adherence, energy and hunger. Only the trends that mean something, without turning it into an exam.', title: 'Progress without obsession' },
      { body: 'Your allergies and intolerances are applied as a system filter, not as an instruction to a model.', title: 'Allergies are a hard limit' },
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
      { body: 'NutrIA plans meals. It does not diagnose, does not prescribe, and does not replace a healthcare professional.', title: 'We know where the line is' }
    ],
    safetyLede: 'The AI proposes meals. Anything that could harm you is checked by the system.',
    safetyTitle: 'A model does not decide what matters.',
    steps: [
      { body: 'Your goal, your schedule, your allergies, your budget, and what you have no intention of cooking on a Tuesday.', title: 'You tell us how you live' },
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
    protein: 'Protein'
  },

  meal: {
    back: '← Back to the plan',
    cook: 'Cook',
    dayOf: '{slot} · Day {day}',
    difficulty: { easy: 'Easy', hard: 'Hard', medium: 'Medium' },
    difficultyLabel: 'Difficulty',
    ingredients: 'Ingredients',
    minutes: '{value} min',
    noCooking: 'No cooking',
    none: '—',
    prep: 'Prep',
    servingNote: 'Quantities for {servings} {unit}.',
    servingsLabel: 'Servings',
    servingUnitOne: 'serving',
    servingUnitOther: 'servings',
    steps: 'Method',
    totalMinutes: '{minutes} min in total'
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
      country: 'Country',
      countryHint: 'Two-letter code.',
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
      mealsPerDay: 'Meals per day',
      mealsPerDayHint: 'Between 2 and 6.',
      otherAllergies: 'Other allergies',
      pace: 'Pace (kg per week)',
      paceHint: 'How many kg per week. Your goal sets the direction.',
      portionPreference: 'Do you prefer large plates or light ones?',
      sex: 'Sex',
      sexHint: 'Used only for the metabolic equation. If you would rather not say, we use the middle value.',
      sleepEnd: 'What time do you get up?',
      sleepStart: 'What time do you go to bed?',
      targetWeightKg: 'Target weight (kg)',
      traceHint: 'Tick “traces” if products that may contain the allergen affect you too.',
      traceLabel: 'traces',
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
      mealsPerDay: 'Meals per day',
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

  plan: {
    createCta: 'Create my plan',
    day: 'Day {index}',
    dayIsToday: ' · today',
    daysLabel: 'Days of the plan',
    emptyBody: 'Your profile is complete. Create your first fourteen-day plan with recipes, quantities and the shopping list written.',
    emptyTitle: 'No plan yet',
    range: '14 days · {start} to {end}',
    title: 'Your plan',
    week: 'Week {number}'
  },

  profile: {
    account: 'Account',
    activity: 'Activity',
    allergies: 'Allergies',
    cooking: 'Cooking',
    cookingTime: 'Time to cook',
    country: 'Country',
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
    restrictions: 'Restrictions',
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
    youLike: 'You like'
  },

  shopping: {
    emptyBody: 'The list is generated with your plan, already added up and grouped by aisle.',
    emptyCta: 'See my plan',
    emptyTitle: 'No list yet',
    notice: 'For now the list is read-only. Ticking off what you already have, adjusting quantities and adding items arrives in the next release.',
    progress: '{done} of {total} in the trolley',
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
    badgeYours: 'Yours',
    basalRate: 'Basal metabolic rate',
    clampedCeiling: 'Your pace asked for {requested} kcal and we brought it down to {ceiling}: a bigger surplus becomes fat, not muscle.',
    clampedFloor: 'Your pace asked for {requested} kcal and we raised it to {floor}: below that we will not build a plan without professional supervision.',
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
    title: 'Your daily targets',
    unknown: '—'
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
  }
};
