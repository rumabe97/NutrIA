/**
 * The Spanish dictionary — and the **shape** every other locale must match.
 *
 * `en-GB.ts` is typed as `Dictionary`, so a missing key is a compile error
 * rather than a blank space on a screen nobody visited in that language. Add a
 * key here first; the build will then tell you exactly what English is missing.
 *
 * Values are plain strings. Placeholders are `{name}` and are filled by
 * `interpolate` at render time — never by building a key out of user data,
 * which would put a translation lookup at the mercy of what someone typed.
 */
export const esES = {
  activity: {
    athlete: 'Deportista',
    high: 'Alto',
    light: 'Ligero',
    moderate: 'Moderado',
    sedentary: 'Sedentario'
  },

  appNav: {
    brandHome: 'NutrIA — inicio',
    home: 'Inicio',
    mainLabel: 'Navegación principal',
    plan: 'Plan',
    profile: 'Perfil',
    progress: 'Progreso',
    sectionsLabel: 'Secciones',
    shopping: 'Compra',
    signOut: 'Cerrar sesión'
  },

  auth: {
    askNewLink: 'Pedir un enlace nuevo',
    backToSignIn: 'Volver a acceder',
    checkEmail: 'Revisa tu correo',
    chooseNewPassword: 'Elige una contraseña nueva',
    chooseNewPasswordSubtitle: 'Después podrás acceder con ella.',
    confirmPassword: 'Repite la contraseña',
    createAccount: 'Crea tu cuenta',
    createAccountSubtitle: 'Unos minutos de preguntas y tendrás tu primer plan de catorce días.',
    email: 'Correo electrónico',
    emailTaken: 'Ya existe una cuenta con ese correo.',
    forgotPassword: '¿Has olvidado tu contraseña?',
    goToAccount: 'Ir a mi cuenta',
    haveAccount: '¿Ya tienes cuenta?',
    invalidCredentials: 'Correo o contraseña incorrectos.',
    invalidLink: 'Este enlace no es válido o ha caducado.',
    name: 'Nombre',
    newPassword: 'Nueva contraseña',
    noAccount: '¿Aún no tienes cuenta?',
    password: 'Contraseña',
    passwordHint: 'Mínimo {count} caracteres.',
    passwordsDoNotMatch: 'Las contraseñas no coinciden.',
    passwordTooShort: 'La contraseña debe tener al menos {count} caracteres.',
    pendingBody: 'Estamos abriendo NutrIA poco a poco. Activaremos tu cuenta ({email}) en cuanto podamos y te avisaremos por correo.',
    pendingCheck: 'Volver a comprobar',
    pendingSignOut: 'Cerrar sesión',
    pendingTitle: 'Cuenta pendiente de activación',
    recoverSent: 'Si existe una cuenta con ese correo, te hemos enviado un enlace para restablecer la contraseña. Caduca en una hora.',
    recoverSubtitle: 'Escribe tu correo y te enviaremos un enlace para elegir una nueva.',
    recoverTitle: 'Recuperar contraseña',
    savePassword: 'Guardar contraseña',
    sending: 'Enviando…',
    sendLink: 'Enviar enlace',
    signIn: 'Acceder',
    signingIn: 'Accediendo…',
    signInSubtitle: 'Accede para ver tu plan de hoy.',
    signInTitle: 'Bienvenido de nuevo',
    signInUnavailable: 'No hemos podido iniciar sesión (error {status}). Inténtalo de nuevo en un momento.',
    signUp: 'Crear mi plan',
    signUpFailed: 'No hemos podido crear la cuenta. Inténtalo de nuevo.',
    signUpPending: 'Creando tu cuenta…',
    toSignIn: 'Accede',
    toSignUp: 'Crea la tuya',
    verifyBody: 'Te hemos enviado un enlace de confirmación. Ábrelo desde este dispositivo para activar tu cuenta.',
    verifyMeanwhile: 'Mientras tanto puedes seguir configurando tu perfil: tu plan se generará cuando termines.',
    verifyTitle: 'Confirma tu correo'
  },

  categories: {
    bakery: 'Panadería',
    beverages: 'Bebidas',
    dairy: 'Lácteos',
    frozen: 'Congelados',
    other: 'Otros',
    pantry: 'Despensa',
    produce: 'Frutas y verduras',
    protein: 'Carne y pescado'
  },

  checkIn: {
    adherence: 'Has marcado como hechas {completed} de {marked} comidas ({percent} %).',
    adherenceNone: 'No has marcado comidas como hechas o saltadas esta quincena; no pasa nada.',
    alreadyBody: 'El check-in de tu último plan está hecho. Crea el siguiente cuando quieras.',
    alreadyTitle: 'Ya has cerrado esta quincena',
    backHome: 'Volver al inicio',
    comments: '¿Qué cambiarías?',
    commentsHint: 'Opcional. En tus palabras: platos, horarios, lo que sea. Llega al modelo tal cual.',
    difficulty: '¿Cómo ha sido seguir el plan?',
    difficultyEasy: 'Fácil',
    difficultyHard: 'Difícil',
    difficultyOk: 'Llevadero',
    doneBody: 'Gracias. Esto es lo que cambia:',
    doneNoTargets: 'Objetivos sin cambios.',
    doneTargets: 'Objetivo de calorías: de {from} a {to} kcal al día.',
    doneTitle: 'Quincena cerrada',
    doneWeight: 'Peso registrado: los objetivos ya se calculan con él.',
    doneWords: 'Tus palabras llegarán al modelo cuando generes el siguiente plan.',
    hunger: '¿Cómo has ido de cantidades?',
    hungerHungry: 'Me quedaba con hambre',
    hungerRight: 'Bien',
    hungerTooMuch: 'Era demasiado',
    intro: 'Cinco preguntas. Lo que digas aquí cambia el siguiente plan: tu peso ajusta los objetivos, las cantidades los suben o bajan un 5 %, y tus palabras llegan al modelo tal cual.',
    nextPlan: 'Crear mi próximo plan',
    notYetBody: 'El check-in se abre el último día del plan.',
    notYetTitle: 'Todavía no toca',
    satisfaction: '¿Qué nota le pones a la quincena?',
    submit: 'Cerrar la quincena',
    submitting: 'Guardando…',
    title: 'Check-in de la quincena',
    weight: 'Peso de hoy (kg)',
    weightHint: 'Opcional. Si lo pones, los objetivos de la siguiente quincena se calculan con él.'
  },

  common: {
    add: 'Añadir',
    back: 'Atrás',
    cancel: 'Cancelar',
    close: 'Cerrar',
    continue: 'Continuar',
    edit: 'Editar',
    finish: 'Terminar',
    none: 'Ninguna',
    noneMasculine: 'Ninguno',
    remove: 'Quitar',
    retry: 'Reintentar',
    save: 'Guardar',
    saving: 'Guardando…'
  },

  conditions: {
    breastfeeding: 'Lactancia',
    chronic_kidney_disease: 'Enfermedad renal crónica',
    coeliac: 'Celiaquía',
    gerd: 'Reflujo gastroesofágico',
    gout: 'Gota',
    hypercholesterolemia: 'Colesterol alto',
    hypertension: 'Hipertensión',
    hypothyroidism: 'Hipotiroidismo',
    ibs: 'Síndrome de intestino irritable',
    lactose_intolerance: 'Intolerancia a la lactosa',
    pcos: 'Síndrome de ovario poliquístico',
    pregnancy: 'Embarazo',
    type_1_diabetes: 'Diabetes tipo 1',
    type_2_diabetes: 'Diabetes tipo 2'
  },

  dashboard: {
    activePlan: 'Tu plan está activo',
    availableNow: 'ya disponible',
    checkIn: '· próxima revisión {when}',
    checkInDoneNote: 'Check-in hecho. Cuando quieras, crea el siguiente plan.',
    checkInDueBody: 'Han pasado catorce días. Cuéntanos en un minuto cómo ha ido: peso, cantidades y qué cambiarías. El siguiente plan lo tendrá en cuenta.',
    checkInDueCta: 'Hacer el check-in',
    checkInDueTitle: 'Tu check-in de la quincena',
    dayOf: 'Día {current} de {total}',
    daysLeft: 'Quedan {count} días',
    fortnight: 'Tu quincena',
    fortnightDay: 'Día {index}',
    goodAfternoon: 'Buenas tardes',
    goodEvening: 'Buenas noches',
    goodMorning: 'Buenos días',
    greetingNamed: '{greeting}, {name}.',
    inDays: 'en {count} días',
    lastDay: 'Último día',
    nextMeal: 'Lo siguiente',
    nextMealNone: 'Ya no queda nada por hoy.',
    noPlanBody: 'Ya tenemos todo lo que necesitamos sobre ti. Crearemos catorce días completos con recetas, cantidades y la lista de la compra hecha.',
    noPlanCta: 'Crear mi plan',
    noPlanTitle: 'Todavía no tienes plan',
    ofTarget: '{value} de {target} {unit}',
    planEndedBody: 'Tu plan ha llegado al final de sus catorce días. Crea el siguiente cuando quieras.',
    planEndedCta: 'Crear mi próximo plan',
    planEndedTitle: 'Tu plan ha terminado',
    profileComplete: 'Tu perfil está completo.',
    seeAllDays: 'Ver los 14 días →',
    seePreviousPlan: 'Ver el plan anterior',
    shoppingCount: '{items} artículos en {aisles} pasillos',
    shoppingCta: 'Ver la lista →',
    shoppingTitle: 'Tu lista de la compra',
    targetsAdjust: 'Ajustar →',
    targetsClamped:
      'Hemos ajustado tu ritmo: pedía {requested} kcal y lo hemos subido a {floor}, el mínimo diario que consideramos seguro sin supervisión profesional.',
    targetsEstimate: 'Son una estimación a partir de tu perfil. Puedes ajustarlas.',
    targetsLabel: 'Tus objetivos diarios · {status}',
    targetsStatusEstimated: 'estimados',
    targetsStatusOverridden: 'ajustados por ti',
    today: 'Hoy',
    todayVsTarget: 'Hoy, sobre tus objetivos',
    tomorrow: 'mañana',
    weightLog: 'Anotar',
    weightMore: 'Ver tu evolución →',
    weightNone: 'Aún no has anotado ningún peso.',
    weightPlaceholder: 'kg',
    weightSince: '{change} kg desde tu primera anotación',
    weightStable: 'Sin cambios desde tu primera anotación',
    weightStart: 'Empezaste en {value} kg',
    weightTitle: 'Tu peso',
    weightToday: 'Hoy'
  },

  errors: {
    boundaryBody: 'Puede ser una conexión intermitente. Vuelve a intentarlo; si sigue fallando, tus datos están a salvo.',
    boundaryHome: 'Ir al inicio',
    boundaryTitle: 'No hemos podido cargar esta página',
    conflict: 'Ese dato ya está en uso.',
    emailUnverified: 'Tu cuenta todavía no está activada.',
    internal: 'Algo ha ido mal por nuestra parte. Inténtalo de nuevo en un momento.',
    invalidInput: 'Revisa los datos marcados.',
    network: 'No hemos podido conectar. Comprueba tu conexión.',
    notFound: 'No hemos encontrado lo que buscabas.',
    onboardingIncomplete: 'Nos falta parte de tu perfil. Termínalo y vuelve a intentarlo.',
    quotaExceeded: 'Has agotado lo que permite tu plan esta quincena.',
    request: 'No hemos podido completar la acción.',
    unsafeContent: 'Ese contenido no cumple tus restricciones alimentarias.'
  },

  footer: {
    account: 'Cuenta',
    createAccount: 'Crear cuenta',
    disclaimer:
      'NutrIA elabora planes de alimentación generales. No sustituye el consejo de un médico ni de un dietista-nutricionista colegiado. Consulta a un profesional si tienes una condición médica, estás embarazada o tomas medicación.',
    product: 'Producto',
    signIn: 'Acceder',
    tagline: 'Nutrición que se adapta a ti.'
  },

  generation: {
    abandonedBody: 'El servidor se reinició mientras preparábamos tu plan. No se ha guardado nada a medias.',
    abandonedTitle: 'Se interrumpió',
    aiUnavailableBody:
      'Tu proveedor de IA está configurado pero ha rechazado la petición. Suele ser la clave (ANTHROPIC_API_KEY o GOOGLE_API_KEY), el nombre del modelo en AI_MODEL, o haber agotado la cuota gratuita. El detalle exacto está en el log del servidor.',
    aiUnavailableTitle: 'El proveedor de IA ha fallado',
    back: 'Volver',
    completeProfile: 'Completar mi perfil',
    couldNotStart: 'No hemos podido empezar',
    failedBody: 'Algo ha ido mal por nuestra parte. No se ha guardado nada, así que puedes volver a intentarlo.',
    failedTitle: 'No hemos podido crear tu plan',
    invalidPlanBody: 'Hemos construido un plan pero le faltaban comidas o cruzaba un límite de seguridad, así que lo hemos descartado en lugar de dártelo. Vuelve a intentarlo.',
    invalidPlanTitle: 'El plan no salía bien',
    onboardingIncompleteBody: 'Nos faltan datos tuyos para poder calcular tus necesidades.',
    onboardingIncompleteTitle: 'Falta terminar tu perfil',
    poolTooSmallBody:
      'Todavía no tenemos suficientes recetas que encajen con tus restricciones y no hay ningún proveedor de IA configurado, así que no podemos crear las que faltan. Configura AI_PROVIDER en el servidor, o espera a que la biblioteca de recetas crezca.',
    poolTooSmallTitle: 'Nos faltan recetas',
    profileIncompleteBody: 'Necesitamos tu fecha de nacimiento, altura, sexo, peso y nivel de actividad para calcular tus objetivos.',
    profileIncompleteTitle: 'Falta información en tu perfil',
    quotaExceeded: 'Ya has rehecho tu plan esta quincena. Podrás crear el siguiente el {date}.',
    rateLimited: 'Has pedido varios planes seguidos. Espera un momento antes de volver a intentarlo.',
    safetyNote: 'Comprobamos tus alergias antes de guardar nada.',
    serverDetail: 'Detalle del servidor:',
    starting: 'Empezando…',
    steps: {
      BUILDING_LIST: 'Preparando tu lista de la compra',
      CHOOSING_RECIPES: 'Eligiendo recetas',
      LOADING_PROFILE: 'Revisando tu perfil',
      SAVING_PLAN: 'Guardando tu plan',
      SCHEDULING_MEALS: 'Repartiendo las comidas de los 14 días',
      VALIDATING_PLAN: 'Comprobando que todo encaja'
    },
    title: 'Estamos creando tu plan',
    unsafeBody: 'Hemos bloqueado el plan porque una comida no respetaba tus alergias. Preferimos no darte nada antes que darte algo que no puedes comer.',
    unsafeTitle: 'Lo hemos bloqueado por seguridad',
    wait: 'Tarda un par de minutos. Puedes dejar esta página abierta.'
  },

  goals: {
    custom: 'Personalizado',
    healthy_eating: 'Comer sano',
    maintenance: 'Mantenimiento',
    muscle_gain: 'Ganar músculo',
    performance: 'Rendimiento',
    weight_loss: 'Perder peso'
  },

  health: {
    addSuggestionLink: 'el paso de alergias',
    applied: 'Por tu {condition} excluimos {allergen} de todos tus planes, igual que si fuera una alergia declarada.',
    conditions: 'Condiciones',
    conditionsOther: 'Otras',
    conditionsOtherHint: 'Separa con comas. No interpretamos lo que escribas aquí.',
    consentLabel: 'Guardad estos datos de salud para personalizar mis planes',
    consentNote:
      'Se guardan en tu cuenta, no se envían a ningún modelo de IA, no aparecen en los registros del servidor y se borran con tu cuenta. Puedes borrarlos por separado con el botón de abajo.',
    consentStale: 'Hemos actualizado cómo explicamos el uso de estos datos. Revisa y vuelve a guardar para seguir manteniéndolos.',
    intro: 'Opcional. Nada de esto es obligatorio para usar NutrIA, y puedes borrarlo entero cuando quieras.',
    medications: 'Medicación',
    medicationsHint: 'Solo el nombre. No pedimos dosis porque no hacemos nada con ella.',
    medicationsLabel: 'Medicamentos',
    medicationsNote:
      'No cruzamos medicamentos con alimentos ni buscamos interacciones. Eso es trabajo de tu médico o tu farmacéutico, y hacerlo aquí sería inventárnoslo.',
    suggestion:
      'Podemos excluir {allergen} por tu {condition}, pero no lo hacemos por nuestra cuenta: mucha gente tolera cantidades pequeñas. Si quieres que lo hagamos, añádelo a tus intolerancias en',
    supplementAdd: 'Añadir suplemento',
    supplementName: 'Nombre',
    supplementProtein: 'Proteína por toma (g)',
    supplementProteinLabel: 'Proteína de suplementos',
    supplementProteinTotal: '{grams} g al día,',
    supplementProteinTotalEmphasis: 'además',
    supplementProteinTotalTail: 'de lo que aporta el plan.',
    supplements: 'Suplementos',
    supplementServings: 'Tomas al día',
    title: 'Salud',
    withdraw: 'Borrar todos mis datos de salud'
  },

  landing: {
    ctaPrimary: 'Crear mi plan',
    ctaSecondary: 'Cómo funciona',
    eyebrow: 'Un plan nuevo cada dos semanas',
    faq: [
      {
        answer: 'Catorce días. Es tiempo suficiente para que un cambio se note y lo bastante corto para corregir el rumbo antes de que te canses.',
        question: '¿Por qué catorce días?'
      },
      {
        answer: 'Sí. Puedes cambiar cualquier comida por otra que respete tus restricciones y encaje en tus objetivos del día. El plan se reajusta solo.',
        question: '¿Puedo cambiar una comida que no me gusta?'
      },
      {
        answer: 'Se excluyen del catálogo por completo. Si además te afectan las trazas, también descartamos los ingredientes marcados como «puede contener».',
        question: '¿Cómo tratáis las alergias?'
      },
      {
        answer:
          'No. NutrIA es una herramienta de planificación alimentaria. Si tienes una condición médica, estás embarazada o tomas medicación, consulta a un profesional sanitario.',
        question: '¿Esto sustituye a un dietista o a mi médico?'
      },
      {
        answer: 'Todos. Los planes anteriores quedan guardados con sus recetas, sus listas y tus comentarios, y puedes consultarlos cuando quieras.',
        question: '¿Qué pasa con mis planes anteriores?'
      },
      {
        answer: 'Puedes borrar tu cuenta cuando quieras desde los ajustes. Se elimina todo: perfil, planes, progreso y conversaciones.',
        question: '¿Puedo borrar mis datos?'
      }
    ],
    faqTitle: 'Preguntas frecuentes',
    features: [
      { body: 'Catorce días completos con recetas, cantidades y tiempos. Sin decidir qué cenar a las nueve.', title: 'Planes de catorce días' },
      {
        body: '¿No te apetece? Pide algo más rápido, más barato, sin cocinar o con más proteína. Se recalcula al momento.',
        title: 'Cambia cualquier comida'
      },
      {
        body: 'Una lista por plan, agrupada por pasillo y con las cantidades ya sumadas. Tres tomates sueltos son 450 g.',
        title: 'Lista de la compra automática'
      },
      { body: 'Peso, adherencia, energía y hambre. Solo las tendencias que significan algo, sin convertirlo en un examen.', title: 'Progreso sin obsesión' },
      { body: 'Tus alergias e intolerancias se aplican como filtro del sistema, no como una instrucción a un modelo.', title: 'Alergias como límite duro' },
      { body: 'Pregunta por una sustitución, por qué elegimos un plato o qué comprar mañana. Conoce tu plan.', title: 'Asistente de nutrición' }
    ],
    finalCtaTitle: 'Deja de decidir qué cenar.',
    finalLede: 'Cuéntanos cómo vives y tendrás catorce días resueltos, con la lista de la compra hecha.',
    heroNote: 'Sin tarjeta. Tu plan estará listo en cuanto termines el cuestionario.',
    lede: 'Planes de alimentación personalizados, construidos alrededor de tus objetivos, tus preferencias y tu vida. Y ajustados cada dos semanas según lo que de verdad te funciona.',
    personalisationLede:
      'Objetivo, edad, actividad, horarios, presupuesto, cocina que te gusta, alimentos que no piensas volver a ver. Todo entra en el cálculo, y todo se puede cambiar después.',
    personalisationTitle: 'Tu plan sabe que los martes llegas tarde.',
    preview: {
      adherence: 'Adherencia',
      adherenceValue: '72 %',
      dayOf: 'Día 6 de 14',
      meals: [
        { kcal: '410 kcal', name: 'Bol de yogur griego con fruta y avena', slot: 'Desayuno' },
        { kcal: '620 kcal', name: 'Arroz con pollo, pimiento y brócoli', slot: 'Comida' },
        { kcal: '180 kcal', name: 'Manzana y un puñado de almendras', slot: 'Merienda' },
        { kcal: '540 kcal', name: 'Merluza al horno con patata y ensalada', slot: 'Cena' }
      ],
      nextReview: 'Próxima revisión',
      nextReviewValue: 'En 8 días',
      shopping: 'Lista de la compra',
      shoppingValue: '18 / 24',
      totals: '1.750 kcal · 130 g proteína'
    },
    safety: [
      {
        body: 'Las alergias e intolerancias las aplica código determinista sobre un catálogo de ingredientes, antes de que un plato se guarde o se muestre.',
        title: 'La IA no decide sobre tu seguridad'
      },
      {
        body: 'Las calorías y los macros salen de tablas de composición y de tu perfil, con un mínimo diario que ningún objetivo puede saltarse.',
        title: 'Los números no se improvisan'
      },
      { body: 'NutrIA planifica comidas. No diagnostica, no receta y no sustituye a un profesional sanitario.', title: 'Sabemos dónde está el límite' }
    ],
    safetyLede: 'La IA propone comidas. Lo que puede hacerte daño lo comprueba el sistema.',
    safetyTitle: 'Lo importante no lo decide un modelo.',
    steps: [
      { body: 'Objetivo, horarios, alergias, presupuesto y lo que no piensas cocinar un martes.', title: 'Nos cuentas cómo vives' },
      { body: 'Calculamos tus necesidades y construimos catorce días completos, comida a comida.', title: 'Creamos tu plan' },
      { body: 'Marca lo que comes, cambia lo que no te apetece, compra con una lista ya hecha.', title: 'Lo sigues a tu ritmo' },
      { body: 'Cada dos semanas revisamos qué funcionó y el siguiente plan llega mejor ajustado.', title: 'Se adapta' }
    ],
    stepsLede: 'El trabajo de planificar lo hacemos nosotros. Tú decides qué comer entre lo que ya encaja.',
    stepsTitle: 'Cuatro pasos. Después, se repite solo.',
    title: 'Nutrición que se adapta a ti.'
  },

  macros: {
    carbs: 'Carbohidratos',
    fat: 'Grasas',
    kcal: 'Calorías',
    note: 'Valores orientativos, calculados con tablas de composición (USDA/BEDCA). En producto envasado, la etiqueta manda.',
    protein: 'Proteína'
  },

  meal: {
    alternatives: 'Si no lo encuentras',
    back: '← Volver al plan',
    backToHistory: '← Volver al plan anterior',
    badgeDone: 'Hecha',
    badgeSkipped: 'Saltada',
    cook: 'Cocción',
    dayOf: '{slot} · Día {day}',
    difficulty: { easy: 'Fácil', hard: 'Difícil', medium: 'Media' },
    difficultyLabel: 'Dificultad',
    dislike: 'No me gusta',
    dislikedHint: 'Anotado: no volverá, ni nada muy parecido.',
    done: 'Hecha',
    doneHint: 'Marcada como hecha.',
    illustration: 'Ilustración generada por IA',
    ingredients: 'Ingredientes',
    like: 'Me gusta',
    likedHint: 'Anotado: podrá volver, y buscaremos platos en esta línea.',
    markDone: 'Marcar como hecha',
    minutes: '{value} min',
    noCooking: 'Sin cocinar',
    none: '—',
    prep: 'Preparación',
    readOnly: 'Este plato es de un plan anterior y se muestra tal como fue.',
    servingNote: 'Cantidades para {servings} {unit}.',
    servingsLabel: 'Raciones',
    servingUnitOne: 'ración',
    servingUnitOther: 'raciones',
    skipped: 'Saltada',
    skippedHint: 'Marcada como saltada.',
    statusHint: 'Cuando llegue el momento, marca si la has comido o la has saltado.',
    steps: 'Preparación',
    swap: 'Cambiar plato',
    swapAxisAny: 'Lo que encaje',
    swapAxisAnyHint: 'El plato que mejor cuadre con las calorías y la proteína de esta comida.',
    swapAxisLabel: '¿Qué buscas en el nuevo plato?',
    swapAxisMoreProtein: 'Más proteína',
    swapAxisMoreProteinHint: 'Al menos un 20 % más de proteína por caloría que este.',
    swapAxisNoCooking: 'Sin cocinar',
    swapAxisNoCookingHint: 'Nada al fuego: se prepara en frío.',
    swapAxisQuicker: 'Más rápido',
    swapAxisQuickerHint: 'Menos de {minutes} min en total, preparación y cocción.',
    swapConfirm: 'Cambiar',
    swapCount: '{remaining} de {limit}',
    swapHint: 'Te quedan {remaining} de {limit} cambios en este plan; la lista de la compra se actualiza sola.',
    swapHintOne: 'Te queda 1 cambio de {limit} en este plan; la lista de la compra se actualiza sola.',
    swapNoFit: 'Ahora mismo no tenemos otro plato que encaje aquí. Prueba más tarde.',
    swapNoFitAxis: 'No tenemos un plato así que encaje aquí ahora mismo. Prueba otra opción o cualquiera que encaje.',
    swapping: 'Buscando otro plato…',
    swapSpent: 'Has usado los {limit} cambios de este plan.',
    swapSpentShort: 'Cambios agotados',
    totalMinutes: '{minutes} min en total',
    unmarkDone: 'Quitar la marca de hecha',
    verdictHint: 'Lo tendremos en cuenta en tus próximos planes.',
    verdictTitle: '¿Qué te ha parecido?'
  },

  onboarding: {
    customAllergen: {
      bestEffort:
        '— no lo tenemos en el catálogo, así que no podemos garantizarlo. Se lo pedimos al generador y descartamos cualquier plato con ingredientes que no reconozcamos, pero revisa los platos antes de cocinarlos.',
      enforced: '— lo aplicamos: «{ingredient}» no aparecerá en ningún plato.'
    },
    fields: {
      activityLevel: 'Nivel de actividad',
      allergies: 'Alergias',
      birthDate: 'Fecha de nacimiento',
      breakfastStyle: '¿Cómo sueles desayunar?',
      budget: 'Presupuesto',
      cookingFrequency: '¿Con qué frecuencia cocinas?',
      cookingTime: 'Minutos que puedes dedicar a cocinar',
      cookingTimeHint: 'Por comida, entre 5 y 240.',
      cuisines: 'Cocinas que te apetecen',
      customAllergens: 'Algo que no esté en la lista',
      customAllergensHint: 'Separa con comas. Al guardar buscamos cada una en nuestro catálogo y te decimos qué podemos aplicar.',
      customGoal: 'Si has elegido «Otro», descríbelo',
      dietaryPatterns: 'Tipo de alimentación',
      disliked: 'Alimentos que no quieres ver',
      dislikedHint: 'No volverán a aparecer en tus planes.',
      displayName: '¿Cómo quieres que te llamemos?',
      goalType: '¿Qué quieres conseguir?',
      heightCm: 'Altura (cm)',
      includesSnacks: 'Incluir tentempiés entre comidas',
      intolerances: 'Intolerancias',
      liked: 'Alimentos que te gustan',
      likedHint: 'Separa con comas.',
      mealsPerDay: 'Comidas al día',
      mealsPerDayHint: 'Entre 2 y 6.',
      otherAllergies: 'Otras alergias',
      pace: 'Ritmo (kg por semana)',
      paceHint: 'Entre 0 y 1 kg por semana; el sentido lo marca tu objetivo. Si pides más de lo que es seguro para ti, lo ajustamos y te lo decimos en el resumen.',
      paceRange: 'El ritmo tiene que estar entre 0 y 1 kg por semana.',
      portionPreference: '¿Prefieres platos grandes o ligeros?',
      sex: 'Sexo',
      sexHint: 'Lo usamos solo para la ecuación metabólica. Si prefieres no decirlo, usamos el valor intermedio.',
      sleepEnd: '¿A qué hora te levantas?',
      sleepStart: '¿A qué hora te acuestas?',
      targetWeightKg: 'Peso objetivo (kg)',
      traceHint: 'Marca «trazas» si también te afectan los productos que pueden contener el alérgeno.',
      traceLabel: 'trazas',
      trainingDays: 'Días de entrenamiento por semana',
      trainingTime: '¿A qué hora entrenas?',
      weightKg: 'Peso actual (kg)',
      workScheduleNotes: 'Algo de tu horario que debamos saber'
    },
    options: {
      activity: {
        athlete: { hint: 'Doble sesión o competición.', label: 'Deportista' },
        high: { hint: 'Entreno 5–6 veces o trabajo físico.', label: 'Alto' },
        light: { hint: 'Camino a diario o entreno 1–2 veces.', label: 'Ligero' },
        moderate: { hint: 'Entreno 3–4 veces por semana.', label: 'Moderado' },
        sedentary: { hint: 'Trabajo sentado, poco ejercicio.', label: 'Sedentario' }
      },
      budget: {
        high: { hint: 'Producto fresco y de temporada.', label: 'Amplio' },
        low: { hint: 'Básicos y marcas blancas.', label: 'Ajustado' },
        medium: { hint: 'Sin pensarlo demasiado.', label: 'Normal' }
      },
      cookingFrequency: { daily: 'A diario', often: 'A menudo', rarely: 'Casi nunca', sometimes: 'A veces' },
      dietaryPatterns: {
        flexitarian: 'Flexitariana',
        gluten_free: 'Sin gluten',
        halal: 'Halal',
        kosher: 'Kosher',
        lactose_free: 'Sin lactosa',
        omnivore: 'Sin restricción',
        pescatarian: 'Pescetariana',
        vegan: 'Vegana',
        vegetarian: 'Vegetariana'
      },
      goals: {
        custom: { hint: 'Cuéntanoslo con tus palabras.', label: 'Otro' },
        healthy_eating: { hint: 'Sin objetivo de peso, solo comer bien.', label: 'Comer sano' },
        maintenance: { hint: 'Quedarte donde estás, comiendo mejor.', label: 'Mantenerme' },
        muscle_gain: { hint: 'Ganar músculo con un superávit controlado.', label: 'Ganar músculo' },
        performance: { hint: 'Comer para entrenar y recuperar mejor.', label: 'Rendimiento' },
        weight_loss: { hint: 'Reducir grasa manteniendo la masa muscular.', label: 'Perder peso' }
      },
      sex: { female: 'Mujer', male: 'Hombre', other: 'Otro', prefer_not_to_say: 'Prefiero no decirlo' }
    },
    percent: '{value} %',

    progressLabel: 'Progreso del cuestionario',

    review: {
      activity: 'Actividad',
      allergies: 'Alergias',
      basis: 'Calculado sobre {maintenance} kcal de mantenimiento',
      basisGain: ', más {pace} kg/semana',
      basisLoss: ', menos {pace} kg/semana',
      basisTail: '. Podrás ajustarlo desde tu perfil.',
      birthDate: 'Fecha de nacimiento',
      clamped: 'Hemos ajustado tu ritmo: pedía {requested} kcal, fuera del margen que consideramos seguro sin supervisión profesional.',
      cuisines: 'Cocinas',
      height: 'Altura',
      intolerances: 'Intolerancias',
      mealsPerDay: 'Comidas al día',
      name: 'Nombre',
      noCuisinePreference: 'Sin preferencia',
      objective: 'Objetivo',
      targets: 'Tus objetivos diarios (estimados)',
      targetsLine: '{kcal} kcal · {protein} g proteína · {carbs} g carbohidratos · {fat} g grasas',
      weight: 'Peso actual'
    },

    saveNote: 'Cada paso se guarda al pulsar «Continuar». Puedes salir cuando quieras y volverás justo aquí.',

    stepOf: 'Paso {current} de {total}',

    steps: {
      aboutYou: { subtitle: 'Con esto calculamos tus necesidades. Nada de esto se comparte.', title: 'Sobre ti' },
      allergies: { subtitle: 'Esto es un límite, no una preferencia: no aparecerá nunca.', title: 'Alergias e intolerancias' },
      bodyActivity: { subtitle: 'Cuánto te mueves cambia bastante las cifras.', title: 'Cuerpo y actividad' },
      cooking: { subtitle: 'Sé sincero: un plan que no puedes cocinar no sirve.', title: 'Cocina' },
      foodPreferences: { subtitle: 'Lo que te gusta aparecerá más. Lo que no, desaparece.', title: 'Preferencias' },
      goal: { subtitle: 'Puedes cambiarlo en cualquier momento.', title: 'Tu objetivo' },
      howYouEat: { subtitle: 'Cómo repartes la comida a lo largo del día.', title: 'Cómo comes' },
      lifestyle: { subtitle: 'Para que las comidas caigan cuando puedes comértelas.', title: 'Tu día a día' },
      review: { subtitle: 'Comprueba que todo está bien antes de terminar.', title: 'Revisión' }
    }
  },

  plan: {
    createCta: 'Crear mi plan',
    day: 'Día {index}',
    dayIsToday: ' · hoy',
    daysLabel: 'Días del plan',
    emptyBody: 'Tu perfil está completo. Crea tu primer plan de catorce días con recetas, cantidades y la lista de la compra hecha.',
    emptyTitle: 'Todavía no tienes plan',
    historyBack: '← Todos tus planes',
    historyCurrent: 'Actual',
    historyEmpty: 'Aquí irán quedando tus planes anteriores, tal como fueron.',
    historyFinished: 'Terminado',
    historyIntro: 'Cada plan queda tal como fue, con lo que comiste y lo que no. No se puede cambiar.',
    historyLink: 'Planes anteriores →',
    historyOne: 'Plan anterior',
    historyPlan: 'Plan {version}',
    historyReplaced: 'Sustituido',
    historyTitle: 'Tus planes',
    range: '14 días · del {start} al {end}',
    redoAvailable: 'Puedes rehacer este plan una vez esta quincena: recetas nuevas para los mismos días.',
    redoCta: 'Rehacer el plan',
    redoSpent: 'Ya has rehecho tu plan esta quincena. Podrás crear el siguiente el {date}.',
    title: 'Tu plan',
    week: 'Semana {number}'
  },

  profile: {
    account: 'Cuenta',
    activity: 'Actividad',
    allergies: 'Alergias',
    cooking: 'Cocina',
    cookingTime: 'Tiempo para cocinar',
    cuisines: 'Cocinas',
    dangerTitle: 'Borrar mi cuenta',
    deleteAllBody: 'Se elimina todo: perfil, objetivos, restricciones, planes, progreso y conversaciones. No se puede deshacer.',
    deleteBody: 'Se borrará tu perfil, tus planes, tu progreso y tus conversaciones. No se puede deshacer.',
    deleteConfirm: 'Borrar definitivamente',
    deleteFailed: 'No hemos podido borrar la cuenta. Inténtalo de nuevo.',
    deletePending: 'Borrando…',
    deletePrompt: 'Escribe {word} para confirmar.',
    deleteTypeLabel: 'Escribe {word}',
    deleteWord: 'BORRAR',
    dietaryPatterns: 'Tipo de alimentación',
    dislikedFoods: 'Alimentos que no quieres',
    displayName: 'Nombre para mostrar',
    email: 'Correo',
    emailVerified: 'Correo verificado',
    emailVerifiedNo: 'Pendiente',
    emailVerifiedYes: 'Sí',
    goal: 'Objetivo',
    height: 'Altura',
    howYouEat: 'Cómo comes',
    intolerances: 'Intolerancias',
    likedFoods: 'Alimentos que te gustan',
    locale: 'Idioma',
    localeHint: 'Cambia la interfaz al momento y se guarda en tu perfil.',
    minutes: '{value} min',
    name: 'Nombre',
    no: 'No',
    none: 'Ninguna',
    noRestriction: 'Sin restricción',
    pace: 'Ritmo',
    personalData: 'Datos personales',
    preferences: 'Preferencias',
    restrictions: 'Restricciones',
    snacks: 'Tentempiés',
    startingWeight: 'Peso actual',
    subtitle: 'Todo esto alimenta tus planes. Cámbialo cuando cambie tu vida.',
    supervision:
      'Nos has contado que tienes alguna condición de salud o medicación. NutrIA no interpreta ninguna de las dos: no ajustamos tu plan por ellas más allá de las restricciones que hayas marcado, y no comprobamos interacciones. Enséñale tu plan a tu médico, tu farmacéutico o un dietista-nutricionista antes de seguirlo.',
    targetWeight: 'Peso objetivo',
    title: 'Tu perfil',
    unset: '—',
    yes: 'Sí',
    youAvoid: 'No quieres ver',
    youLike: 'Te gusta'
  },

  progress: {
    adherenceLabel: 'de las que marcaste, hechas',
    adherenceNone: 'Sin comidas marcadas',
    allPlans: 'Todos tus planes →',
    chartEmpty: 'Con dos pesos anotados aparece la línea.',
    checkInWeight: 'Pesabas {value} kg',
    difficultyEasy: 'Fácil de seguir',
    difficultyHard: 'Difícil de seguir',
    difficultyOk: 'Se pudo seguir',
    emptyBody: 'Cuando tengas tu primer plan, aquí verás cada quincena: qué comidas hiciste, qué contaste en el check-in y cómo va tu peso.',
    emptyCta: 'Ir a inicio',
    emptyTitle: 'Todavía no hay nada que medir',
    fortnightRange: '{from} – {to}',
    fortnightsTitle: 'Tus quincenas',
    hungerHungry: 'Te quedaste con hambre',
    hungerRight: 'Cantidades justas',
    hungerTooMuch: 'Demasiada comida',
    intro: 'Lo que has ido anotando, junto. Nada de esto es una estimación: son tus pesos, tus comidas y tus check-ins.',
    lastFortnight: 'Última quincena',
    logLink: 'Anotar el peso de hoy →',
    mealsLine: '{eaten} hechas · {skipped} saltadas · {unmarked} sin marcar, de {soFar} hasta hoy',
    noChange: 'Sin cambios',
    noData: '—',
    openPlan: 'Ver el plan →',
    overallLine: '{eaten} comidas hechas de {marked} que marcaste',
    overallNone: 'Marca las comidas como hechas o saltadas y aquí verás cuánto del plan sigues.',
    planNumber: 'Plan {version}',
    reached: 'conseguido',
    satisfaction: 'Satisfacción {value} de 5',
    sinceStart: 'Desde el inicio',
    statusActive: 'En curso',
    statusArchived: 'Archivada',
    statusCompleted: 'Terminada',
    statusReplaced: 'Rehecha',
    title: 'Tu progreso',
    toGain: 'por ganar',
    toLose: 'por perder',
    toTarget: 'Hasta el objetivo',
    unavailable: 'No hemos podido cargar tu progreso. Prueba de nuevo en un momento.',
    weightLatest: 'Último peso',
    weightNone: 'Aún no has anotado ningún peso.',
    weightStart: 'Empezaste en {value} kg',
    weightTarget: 'Objetivo {value} kg',
    weightTitle: 'Tu peso'
  },

  shopping: {
    emptyBody: 'La lista se genera junto con tu plan, ya sumada y agrupada por pasillo.',
    emptyCta: 'Ver mi plan',
    emptyTitle: 'Todavía no hay lista',
    notice: 'Por ahora la lista es solo de consulta. Poder marcar lo que ya tienes, ajustar cantidades y añadir cosas llega en la próxima entrega.',
    progress: '{done} de {total} ya en el carro',
    subtitle: 'Todo lo que necesitas para los catorce días, ya sumado.',
    title: 'Lista de la compra'
  },

  siteNav: {
    brandHome: 'NutrIA — inicio',
    howItWorks: 'Cómo funciona',
    personalisation: 'Personalización',
    questions: 'Preguntas',
    safety: 'Seguridad',
    sectionsLabel: 'Secciones',
    signIn: 'Acceder',
    signUp: 'Crear mi plan'
  },

  slots: {
    afternoon_snack: 'Merienda',
    breakfast: 'Desayuno',
    dinner: 'Cena',
    lunch: 'Comida',
    morning_snack: 'Almuerzo',
    supper: 'Recena'
  },

  targets: {
    activity: 'Actividad',
    activityValue: '{label} (×{factor})',
    allowedRange: 'Margen permitido',
    badgeEstimate: 'Estimación',
    badgeYours: 'Tuyos',
    basalRate: 'Metabolismo basal',
    clampedCeiling: 'Tu ritmo pedía {requested} kcal y lo hemos bajado a {ceiling}: un superávit mayor se convierte en grasa, no en músculo.',
    clampedFloor: 'Tu ritmo pedía {requested} kcal y lo hemos subido a {floor}: por debajo no construimos un plan sin supervisión profesional.',
    computed: 'Resultado del cálculo',
    disclaimer:
      'Son una estimación, no una prescripción. Las ecuaciones aciertan de media, no en cada persona: úsalas como punto de partida y ajústalas según cómo te vaya.',
    edit: 'Ajustar mis objetivos',
    equation: 'Ecuación',
    equationMifflin: 'Mifflin-St Jeor',
    explain: 'Cómo hemos calculado esto',
    goal: 'Objetivo',
    hintRange: 'Entre {min} y {max}',
    hintUpTo: 'Hasta {max} g',
    kcalValue: '{value} kcal',
    labelCarbs: 'Carbohidratos (g)',
    labelFat: 'Grasas (g)',
    labelKcal: 'Calorías (kcal)',
    labelProtein: 'Proteína (g)',
    maintenance: 'Mantenimiento',
    pace: 'Ritmo',
    rangeValue: '{floor} – {ceiling} kcal',
    reset: 'Volver a los calculados',
    saveTargets: 'Guardar mis objetivos',
    stale:
      'Tenías unos objetivos propios guardados, pero tu perfil ha cambiado y ya no encajan dentro de los límites. Estamos usando los calculados hasta que los vuelvas a ajustar.',
    subtitleEstimated: 'Estimados a partir de tu perfil',
    subtitleOwn: 'Los has ajustado tú',
    title: 'Tus objetivos diarios',
    unknown: '—'
  },

  units: {
    gram: 'g',
    kcal: 'kcal',
    kilogram: 'kg',
    litre: 'l',
    millilitre: 'ml',
    perWeek: '{value} kg / semana',
    proteinShort: 'g P',
    slice: 'reb.',
    unit: 'ud.'
  }
};

/**
 * The shape, widened.
 *
 * No `as const` on the object above, deliberately: with literal types every
 * translation would have to repeat the Spanish string to satisfy the type, which
 * is the opposite of the point. What must match is the set of keys, and that is
 * exactly what this catches.
 */
export type Dictionary = typeof esES;
