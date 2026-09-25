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
  /* Words that only a screen reader or a keyboard ever reaches. */
  a11y: { skipToContent: 'Saltar al contenido' },

  activity: { athlete: 'Deportista', high: 'Alto', light: 'Ligero', moderate: 'Moderado', sedentary: 'Sedentario' },

  admin: {
    accounts: 'Cuentas',
    accountsTitle: 'Cuentas y accesos',
    activate: 'Abrir cuenta',
    activateFor: 'Abrir la cuenta de {email}',
    activationTitle: 'Altas',
    activityPeople: '{count} personas han entrado en este tiempo.',
    activityTitle: 'Actividad ({days} días)',
    aiByModel: 'Hoy, por el modelo que contestó',
    aiCalls: 'Peticiones hoy',
    aiHint:
      'Nuestro recuento de lo que ha salido de aquí, contra el límite que hayas configurado. Google no publica cuánta cuota te queda de verdad: si su consola dice otra cifra, la diferencia son llamadas que no pasaron por este servicio.',
    aiLastRefusal: 'Último rechazo por cuota',
    aiLastRefusalValue: '{model} · límite {limit} · reintentar en {seconds} s · a las {time} UTC',
    aiModel: 'Modelo',
    aiModelUsage: '{calls} llamadas · {failed} fallidas · {seconds} s de media · {input} / {output} tokens',
    aiRefused: 'Rechazadas por cuota',
    aiResets: 'La cuenta diaria se reinicia',
    aiTitle: 'IA',
    aiTokens: 'Tokens (entrada / salida)',
    attempts: '{count} intentos',
    automaticActivation: 'Activación automática',
    automaticHint: 'Quien confirma su correo entra directamente. Tú no tienes que hacer nada.',
    confirmed: 'correo confirmado',
    events: { session_started: 'Entradas', swap_requested: 'Cambios de comida pedidos' },
    failureNote: '{count} generaciones han fallado. El código dice si fue la cuota, la clave o el catálogo.',
    failures: 'Fallos',
    feedbackHandled: 'Marcar como visto',
    feedbackHandledFor: 'Marcar como visto el mensaje de {email}',
    feedbackHandledState: 'Visto',
    feedbackReopen: 'Volver a abrir',
    feedbackReopenFor: 'Volver a abrir el mensaje de {email}',
    feedbackTitle: 'Buzón ({count} sin ver)',
    funnel: {
      activated: 'Cuenta abierta',
      checkedIn: 'Han hecho el check-in',
      confirmed: 'Correo confirmado',
      lived: 'Han marcado alguna comida',
      onboarded: 'Perfil terminado',
      planned: 'Tienen un plan',
      returned: 'Han vuelto a por un segundo plan',
      signedUp: 'Se han registrado'
    },
    funnelHint:
      'Contado sobre los datos, no sobre eventos: cubre también las cuentas anteriores a esta pantalla. El porcentaje es sobre el paso de arriba.',
    funnelTitle: 'Embudo',
    inDays: 'en {days} días',
    ingredients: 'Ingredientes',
    intro: 'Cómo va el servicio. No hay ningún plan ni ningún perfil aquí: solo si la generación funciona y cuánto hay en el catálogo.',
    jobsTitle: 'Generaciones ({days} días)',
    justOpened: 'Cuenta abierta: {email}',
    logCall: '{slot}, ronda {round}: {model}',
    logCallAsked: 'pedido: {model}',
    logCallDropped: 'descartados: {reasons}',
    logCallFailed: 'falló ({status})',
    logCallIds: 'petición {request}',
    logCallKept: '{kept} de {dishes} platos',
    logCallQuota: 'cuota: límite {limit}, reintentar en {seconds} s',
    logCallReasoning: '{count} de razonamiento',
    logCalls: '{count} llamadas al modelo',
    logCallTokens: '{input} / {output} tokens',
    logCallVia: 'vía {provider}',
    logEmpty: 'Ninguna generación registrada todavía.',
    logHint:
      'Las últimas generaciones, quién las pidió y cada llamada al modelo: qué modelo contestó, a través de qué proveedor, cuánto tardó, los tokens y qué platos se quedaron. La petición es el id con el que el panel de OmniRoute guarda esa llamada.',
    logNoCalls: 'Ninguna llamada al modelo: salió de la biblioteca, o no llegó a pedirla.',
    logPlan: 'plan {version} · {model} · prompt {prompt} · {reused} platos de la biblioteca',
    logTitle: 'Registro de generaciones',
    makeFree: 'Pasar a gratis',
    makeFreeFor: 'Pasar la cuenta de {email} a gratis',
    makePremium: 'Dar premium',
    makePremiumFor: 'Dar premium a la cuenta de {email}',
    makeProfessional: 'Hacer profesional',
    makeProfessionalFor: 'Hacer profesional la cuenta de {email}',
    manualHint: 'Al confirmar su correo la cuenta queda esperando y te avisamos a ti. La abres tú desde esta lista.',
    noAccounts: 'No hay ninguna cuenta todavía.',
    noActivity: 'Ninguna actividad registrada todavía.',
    noFeedback: 'Nadie ha escrito todavía.',
    noJobs: 'Ninguna generación todavía.',
    notOpened: 'sin abrir',
    opened: 'cuenta abierta',
    pagerNext: 'Siguiente',
    pagerOf: '{from}–{to} de {total}',
    pagerPrevious: 'Anterior',
    plansTitle: 'Planes por estado',
    premiumHint: 'Premium está activo: las cuentas a las que se lo hayas dado tienen tres replanificaciones por quincena y veinte cambios por plan.',
    premiumLabel: 'Nivel de pago',
    premiumOffHint: 'Premium está apagado: todo el mundo usa los límites gratuitos, incluido quien ya lo tenga concedido. Encenderlo se lo devuelve.',
    premiumTitle: 'Nivel de pago',
    professionalChip: 'Profesional',
    professionalCollegiate: 'Número de colegiado',
    professionalCollegiateHint: 'Letras, números, / o -, como aparece en su colegio. Compruébalo antes de conceder.',
    professionalGrant: 'Conceder',
    professionalGranted: 'Nº {number} · desde el {date}',
    professionalHint: 'Encendido: los profesionales que concedas pueden abrir su consulta y vincular pacientes.',
    professionalLabel: 'Consulta para dietistas',
    professionalLinks: '{active} activos · {paused} en pausa · {ended} terminados',
    professionalOffHint: 'Apagado: nadie ve la consulta, tampoco quien ya tenga la concesión. Sus pacientes siguen como cuentas normales.',
    professionalRevoke: 'Retirar',
    professionalRevokeBody: 'Pierde el acceso a su consulta y sus invitaciones sin responder se anulan.',
    professionalRevokeConfirm: 'Sí, retirar',
    professionalRevokeFor: 'Retirar la concesión de {email}',
    professionalRevokeTitle: '¿Retirar a {email} como profesional?',
    professionalsEmpty: 'Todavía no hay ningún profesional.',
    professionalsHint: 'Cada profesional con sus vínculos contados. Aquí no aparece ningún paciente. Se concede desde la lista de cuentas.',
    professionalsTitle: 'Profesionales',
    pushTest: 'Enviarme un aviso de prueba',
    pushTestNoDevice: 'No tienes avisos activados en ningún dispositivo. Actívalos en tu perfil, desde el móvil, y vuelve a probar.',
    pushTestRefused:
      'Ninguno de tus {count} dispositivos lo aceptó. Si quitaste el permiso o borraste la app, vuelve a activar los avisos en tu perfil.',
    pushTestSent: 'Enviado: lo han aceptado {count} de tus dispositivos. Debería llegar en unos segundos.',
    pushTestUnconfigured: 'El push no está configurado en el servidor: faltan las variables VAPID en la API de Vercel, o falta el redeploy.',
    recipes: 'Recetas',
    rejection: {
      allergen: 'alérgeno',
      duplicate: 'repetido',
      foreign_food: 'nombra algo que no lleva',
      over_time: 'demasiado tiempo',
      schema: 'esquema',
      unknown_ingredient: 'ingrediente inventado',
      unwanted: 'dieta o gustos'
    },
    remindersHint:
      'Encendido: cada mañana se avisa, por correo y en los móviles que lo pidieron, a quien ha terminado su quincena sin hacer el check-in. Una vez por quincena, y cada persona puede desactivarlo en su perfil.',
    remindersLabel: 'Enviar el recordatorio',
    remindersOffHint: 'Apagado: no sale ningún recordatorio. El check-in solo aparece en la pantalla de Hoy.',
    remindersTitle: 'Recordatorio del check-in',
    roleAdmin: 'admin',
    tierPremium: 'Premium',
    title: 'Servicio',
    unconfirmed: 'sin confirmar',
    waiting: '{count} sin activar',
    withoutImage: '{count} sin ilustrar'
  },

  appNav: {
    brandHome: 'NutrIA — inicio',
    consulta: 'Consulta',
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
    continueWith: 'Continuar con {provider}',
    createAccount: 'Crea tu cuenta',
    createAccountSubtitle: 'Unos minutos de preguntas y tendrás tu primer plan de catorce días.',
    email: 'Correo electrónico',
    emailTaken: 'Ya existe una cuenta con ese correo.',
    forgotPassword: '¿Has olvidado tu contraseña?',
    goToAccount: 'Ir a mi cuenta',
    haveAccount: '¿Ya tienes cuenta?',
    invalidCredentials: 'Correo o contraseña incorrectos.',
    invalidLink: 'Este enlace no es válido o ha caducado.',
    legalAge: 'Necesitas tener al menos 18 años para crear una cuenta.',
    legalNotice: 'Al crear tu cuenta aceptas las {terms}. Cómo tratamos tus datos te lo explica la {privacy}.',
    legalPrivacy: 'política de privacidad',
    legalTerms: 'condiciones de uso',
    name: 'Nombre',
    newPassword: 'Nueva contraseña',
    noAccount: '¿Aún no tienes cuenta?',
    orWithEmail: 'o con tu correo',
    password: 'Contraseña',
    passwordHint: 'Mínimo {count} caracteres.',
    passwordsDoNotMatch: 'Las contraseñas no coinciden.',
    passwordTooShort: 'La contraseña debe tener al menos {count} caracteres.',
    pendingBody: 'Estamos abriendo NutrIA poco a poco. Activaremos tu cuenta ({email}) en cuanto podamos y te avisaremos por correo.',
    pendingCheck: 'Volver a comprobar',
    pendingConfirmBody: 'Te hemos enviado un enlace a {email}. Ábrelo y entras: no hace falta nada más.',
    pendingConfirmTitle: 'Confirma tu correo',
    pendingConfirmWaitBody: 'Te hemos enviado un enlace a {email}. Confírmalo y podrás entrar en cuanto abramos tu cuenta.',
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
    socialFailed: 'No hemos podido completar el acceso. Inténtalo de nuevo o entra con tu correo.',
    socialNotLinked:
      'Ya hay una cuenta con esa dirección y aún no está confirmada. Entra con tu contraseña y confirma el correo, o restablece la contraseña. Después podrás entrar también así.',
    toSignIn: 'Accede',
    toSignUp: 'Crea la tuya',
    verifyBody: 'Te hemos enviado un enlace de confirmación. Ábrelo desde este dispositivo para activar tu cuenta.',
    verifyMeanwhile: 'Mientras tanto puedes seguir configurando tu perfil: tu plan se generará cuando termines.',
    verifyTitle: 'Confirma tu correo'
  },

  care: {
    accessKinds: {
      health: 'tu historial de salud',
      list: 'tu perfil',
      overview: 'tu perfil',
      plan: 'tu plan',
      progress: 'tu progreso',
      review: 'la revisión de tu plan',
      targets: 'tus objetivos'
    },
    accessLogEmpty: 'Todavía no hay nada que mostrar aquí.',
    accessLogGranted: 'Empezaste a compartir {kind} con {professional}',
    accessLogGrantedGroup: 'Empezaste a compartir {kind} con {professional}, {count} veces · {range}',
    accessLogLoaded: '{count} accesos más cargados.',
    accessLogLoadMore: 'Ver más',
    accessLogNoMore: 'No hay más accesos que mostrar.',
    accessLogRead: '{professional} vio {kind}',
    accessLogReadGroup: '{professional} vio {kind} {count} veces · {range}',
    accessLogTitle: 'Quién ha accedido',
    accessLogWithdrawn: 'Dejaste de compartir {kind} con {professional}',
    accessLogWithdrawnGroup: 'Dejaste de compartir {kind} con {professional}, {count} veces · {range}',
    accessLogWrite: '{professional} cambió {kind}',
    accessLogWriteGroup: '{professional} cambió {kind} {count} veces · {range}',
    canDo: {
      plans: 'generar y cambiar tus planes',
      review: 'revisar cada plan nuevo antes de que lo veas; mientras lo revisa, sigues con el que tenías',
      targets: 'fijar tus objetivos diarios, dentro de los mismos límites de seguridad'
    },
    declineCta: 'No, gracias',
    end: 'Terminar el enlace',
    endConfirmBody:
      'Tu dietista dejará de ver tus datos desde ahora. Tus objetivos, tu historial y tu último plan publicado se quedan contigo, y el registro de sus accesos sigue en tu perfil. Lo que tu dietista ya anotara en su propia historia clínica lo conserva según su normativa. Puedes aceptar otra invitación suya más adelante.',
    endConfirmCta: 'Sí, terminar',
    endConfirmTitle: '¿Terminar el enlace con {professional}?',
    healthQuestion: 'Compartir también mis condiciones de salud, mi medicación y mis suplementos',
    healthShareIntro: 'Aparte de lo anterior, puedes compartir también:',
    healthShareNote: 'Es opcional y aparte. Puedes activarlo o dejar de compartirlo cuando quieras desde tu perfil, sin terminar el enlace.',
    healthShareOffHint: 'Tu dietista deja de verlas en cuanto lo desactivas. El enlace sigue activo.',
    healthShareOnHint: 'Tu dietista puede verlas.',
    healthShares: { conditions: 'tus condiciones de salud', medications: 'tus medicamentos', supplements: 'tus suplementos' },
    healthShareToggle: 'Compartir mis condiciones de salud, mi medicación y mis suplementos',
    invitationAccept: 'Aceptar la invitación',
    invitationCanDoIntro: 'Y podrá:',
    invitationIntro:
      '{professional}, dietista-nutricionista con número de colegiado {collegiateNumber}, te invita a llevar tu plan con su ayuda en NutrIA.',
    invitationLinkExistsBody: 'Ya tienes un dietista vinculado: {professional}, desde el {since}.',
    invitationLinkExistsCta: 'Ver mi perfil',
    invitationLinkExistsTitle: 'Ya tienes un enlace activo',
    invitationNotShared: 'No verá tus alergias, tus intolerancias ni tu correo.',
    invitationPrivacy:
      'NutrIA te comunica estos datos a {professional} porque tú lo pides. Tu dietista los usa para atenderte, bajo su secreto profesional, y responde de lo que haga con ellos en su consulta. Puedes terminar el enlace cuando quieras. Más en la {privacy}.',
    invitationShareIntro: 'Si aceptas, {professional} verá:',
    invitationTitle: 'Invitación de {professional}',
    invitationTrail: 'Cada vez que mire o cambie algo, lo verás en tu perfil.',
    linkSince: 'Desde el {date}',
    linkTitle: 'Tu dietista',
    shares: {
      checkIns: 'tus respuestas a los check-ins (no tus comentarios escritos)',
      mealPlans: 'tu plan de comidas y los anteriores',
      profile: 'tu nombre',
      progress: 'cuánto sigues cada quincena y tu peso a lo largo del tiempo',
      targets: 'tus objetivos diarios y cómo se calcularon'
    },
    whatIsShared: 'Comparte: {list}'
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
    commentsHint: 'Opcional. En tus palabras: platos, horarios, lo que sea. Se guarda con tu check-in, pero ya no llega al modelo ni cambia el plan.',
    difficulty: '¿Cómo ha sido seguir el plan?',
    difficultyEasy: 'Fácil',
    difficultyHard: 'Difícil',
    difficultyOk: 'Llevadero',
    doneBody: 'Gracias. Esto es lo que cambia:',
    doneNoTargets: 'Objetivos sin cambios.',
    doneTargets: 'Objetivo de calorías: de {from} a {to} kcal al día.',
    doneTitle: 'Quincena cerrada',
    doneWeight: 'Peso registrado: los objetivos ya se calculan con él.',
    hunger: '¿Cómo has ido de cantidades?',
    hungerHungry: 'Me quedaba con hambre',
    hungerRight: 'Bien',
    hungerTooMuch: 'Era demasiado',
    intro:
      'Cinco preguntas. Tu peso ajusta los objetivos y tus respuestas mueven las cantidades un 5 % arriba o abajo. Lo que escribas se guarda con el check-in, pero ya no llega al modelo ni cambia el plan.',
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
    checkInDueBody:
      'Han pasado catorce días. Cuéntanos en un minuto cómo ha ido: peso, cantidades y qué cambiarías. El siguiente plan lo tendrá en cuenta.',
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
    noPlanBody:
      'Ya tenemos todo lo que necesitamos sobre ti. Crearemos catorce días completos con recetas, cantidades y la lista de la compra hecha.',
    noPlanCta: 'Crear mi plan',
    noPlanTitle: 'Todavía no tienes plan',
    ofTarget: '{value} de {target} {unit}',
    pendingReviewBody: 'Tu dietista lo está revisando antes de publicarlo. Mientras tanto, sigue con el plan que ya tenías.',
    pendingReviewTitle: 'Tu plan nuevo está con tu dietista',
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
    accountNotActivated: 'Tu cuenta todavía no está activada.',
    boundaryBody: 'Puede ser una conexión intermitente. Vuelve a intentarlo; si sigue fallando, tus datos están a salvo.',
    boundaryHome: 'Ir al inicio',
    boundaryTitle: 'No hemos podido cargar esta página',
    careLinkExists: 'Ya tienes un dietista vinculado.',
    conflict: 'Ese dato ya está en uso.',
    emailNotVerified: 'Confirma tu correo para continuar.',
    internal: 'Algo ha ido mal por nuestra parte. Inténtalo de nuevo en un momento.',
    invalidInput: 'Revisa los datos marcados.',
    mealInFuture: 'Todavía no puedes marcar esta comida: aún no ha llegado el día.',
    network: 'No hemos podido conectar. Comprueba tu conexión.',
    notFound: 'No hemos encontrado lo que buscabas.',
    onboardingIncomplete: 'Nos falta parte de tu perfil. Termínalo y vuelve a intentarlo.',
    planPaused: 'Tu plan está en pausa mientras estás de vacaciones.',
    practiceFull: 'Tu consulta ya tiene todos los pacientes que incluye tu plan.',
    profileConsentRequired: 'Nos falta tu consentimiento para tratar tus datos de salud.',
    quotaExceeded: 'Has agotado lo que permite tu plan esta quincena.',
    request: 'No hemos podido completar la acción.',
    underMinimumAge: 'NutrIA es para mayores de 18 años.',
    unsafeContent: 'Ese contenido no cumple tus restricciones alimentarias.'
  },

  events: {
    add: 'Añadir',
    addedMidPlan: 'Añadido. Los días de antes ya se han rehecho para comer para ello.',
    addedNow: 'Añadido. Este plan ya contará con ello.',
    cancel: 'Quitar',
    cancelFor: 'Quitar {name} del {date}',
    carbs: 'Hidratos',
    daysBefore: 'Días antes',
    daysBeforeMany: 'Los {count} días previos',
    daysBeforeOne: 'El día previo',
    down: 'Bajar',
    fat: 'Grasa',
    full: 'Has puesto los {limit} eventos que caben en un plan. Quita uno para añadir otro.',
    left: 'Te quedan {remaining} de {limit} eventos para este plan.',
    leftOne: 'Te queda 1 evento de {limit} para este plan.',
    /* What a screen reader says where the sighted see ↓ and ↑: "menos grasa", "más hidratos". */
    less: 'menos',
    loading: 'ya está comiendo para esto',
    midPlanFull: 'Este plan ya no admite más eventos en marcha. El siguiente entra al crear el próximo plan.',
    midPlanIntro: 'Una carrera que no estaba cuando se creó el plan: añádela y los días de antes se rehacen para comer para ella.',
    midPlanLeft: 'Puedes añadir {remaining} eventos más con el plan en marcha.',
    midPlanLeftOne: 'Puedes añadir 1 evento más con el plan en marcha.',
    more: 'más',
    name: 'Qué es',
    namePlaceholder: 'Media maratón, partido, Hyrox…',
    nothingMoves: 'Al menos uno tiene que subir o bajar.',
    nowIntro: 'Una carrera, un partido, una sesión larga: si cae en estas dos semanas, añádelo ahora y el plan se crea contando con ello.',
    nowTitle: 'Días que comen distinto',
    on: 'Cuándo',
    protein: 'Proteína',
    removed: 'Evento quitado.',
    same: 'Igual',
    shapeLabel: 'Qué cambia en los días de antes',
    title: 'Eventos',
    up: 'Subir'
  },

  feedback: {
    intro: 'Lo lee una persona: yo. Cuenta lo que te falta, lo que te sobra o lo que no funciona.',
    kinds: { idea: 'Una idea', other: 'Otra cosa', problem: 'Algo falla' },
    kindsLabel: '¿De qué se trata?',
    messageLabel: 'Tu mensaje',
    placeholder: 'Escribe aquí…',
    send: 'Enviar',
    thanks: 'Recibido. Gracias por tomarte el rato.',
    title: '¿Qué mejorarías?'
  },

  footer: {
    account: 'Cuenta',
    createAccount: 'Crear cuenta',
    disclaimer:
      'NutrIA elabora planes de alimentación generales. No sustituye el consejo de un médico ni de un dietista-nutricionista colegiado. Consulta a un profesional si tienes una condición médica, estás embarazada o tomas medicación.',
    legal: 'Legal',
    privacyPolicy: 'Privacidad',
    product: 'Producto',
    signIn: 'Acceder',
    tagline: 'Nutrición que se adapta a ti.',
    terms: 'Condiciones'
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
    invalidPlanBody:
      'Hemos construido un plan pero le faltaban comidas o cruzaba un límite de seguridad, así que lo hemos descartado en lugar de dártelo. Vuelve a intentarlo.',
    invalidPlanTitle: 'El plan no salía bien',
    onboardingIncompleteBody: 'Nos faltan datos tuyos para poder calcular tus necesidades.',
    onboardingIncompleteTitle: 'Falta terminar tu perfil',
    poolTooSmallBody:
      'Todavía no tenemos suficientes recetas que encajen con tus restricciones y no hay ningún proveedor de IA configurado, así que no podemos crear las que faltan. Configura AI_PROVIDER en el servidor, o espera a que la biblioteca de recetas crezca.',
    poolTooSmallTitle: 'Nos faltan recetas',
    profileConsentRequiredBody: 'Necesitamos tu consentimiento para tratar tus datos de salud antes de poder calcular tu plan.',
    profileConsentRequiredTitle: 'Falta tu consentimiento',
    profileIncompleteBody: 'Necesitamos tu fecha de nacimiento, altura, sexo, peso y nivel de actividad para calcular tus objetivos.',
    profileIncompleteTitle: 'Falta información en tu perfil',
    quotaExceeded: 'Ya has rehecho tu plan esta quincena. Podrás crear el siguiente el {date}.',
    rateLimited: 'Has pedido varios planes seguidos. Espera un momento antes de volver a intentarlo.',
    readyBody:
      'Lo creamos con lo que ya sabemos de ti. Antes de empezar, repasa los días que comerán distinto: una vez en marcha, añadir uno obliga a rehacer el plan.',
    readyTitle: 'Tu plan de dos semanas',
    safetyNote: 'Comprobamos tus alergias antes de guardar nada.',
    serverDetail: 'Detalle del servidor:',
    start: 'Generar mi plan',
    starting: 'Empezando…',
    steps: {
      BUILDING_LIST: 'Preparando tu lista de la compra',
      CHOOSING_RECIPES: 'Eligiendo recetas',
      LOADING_PROFILE: 'Revisando tu perfil',
      SAVING_PLAN: 'Guardando tu plan',
      SCHEDULING_MEALS: 'Repartiendo las comidas de los 14 días',
      VALIDATING_PLAN: 'Comprobando que todo encaja'
    },
    timedOutBody: 'El modelo no terminó a tiempo. No se ha guardado nada a medias, así que puedes volver a intentarlo.',
    timedOutTitle: 'Ha tardado demasiado',
    title: 'Estamos creando tu plan',
    unsafeBody:
      'Hemos bloqueado el plan porque una comida no respetaba tus alergias. Preferimos no darte nada antes que darte algo que no puedes comer.',
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
      'Se guardan en tu cuenta, no aparecen en los registros del servidor y se borran con tu cuenta. Nunca se envían a ningún modelo de IA: solo llega su efecto, como los ingredientes que quitamos por una celiaquía. Si trabajas con un dietista, solo los ve si se lo permites aparte. Puedes borrarlos por separado con el botón de abajo.',
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
    supplementKind: 'Tipo',
    supplementKinds: {
      creatine: 'Creatina',
      omega_3: 'Omega-3',
      other: 'Otro',
      protein: 'Proteína en polvo',
      vitamins_minerals: 'Vitaminas y minerales'
    },
    supplementName: 'Nombre',
    supplementProtein: 'Proteína por toma (g)',
    supplementProteinLabel: 'Proteína de suplementos',
    supplementProteinTotal: '{grams} g al día,',
    supplementProteinTotalEmphasis: 'además',
    supplementProteinTotalTail: 'de lo que aporta el plan.',
    supplements: 'Suplementos',
    supplementServings: 'Tomas al día',
    supplementsHint: 'La proteína en polvo solo entra en tus recetas si anotas aquí un suplemento de proteína.',
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
        answer:
          'Sí. Puedes cambiar cualquier comida por otra que respete tus restricciones y encaje en tus objetivos del día. El plan se reajusta solo.',
        question: '¿Puedo cambiar una comida que no me gusta?'
      },
      {
        answer:
          'Se excluyen del catálogo por completo. Si además te afectan las trazas, también descartamos los ingredientes marcados como «puede contener».',
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
      {
        body: 'Peso, adherencia, energía y hambre. Solo las tendencias que significan algo, sin convertirlo en un examen.',
        title: 'Progreso sin obsesión'
      },
      {
        body: 'Tus alergias e intolerancias se aplican como filtro del sistema, no como una instrucción a un modelo.',
        title: 'Alergias como límite duro'
      },
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
      {
        body: 'NutrIA planifica comidas. No diagnostica, no receta y no sustituye a un profesional sanitario.',
        title: 'Sabemos dónde está el límite'
      }
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

  /* What a phone shows under the icon when somebody installs the app. */
  manifest: { description: 'Planes de alimentación personalizados, ajustados cada dos semanas.' },

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
    notYet: 'Podrás marcarla el {date}.',
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
    swapAxisVegetarian: 'Sin carne ni pescado',
    swapAxisVegetarianHint: 'Nada de carne, pescado ni marisco. El huevo y los lácteos siguen.',
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

  offline: {
    copyEarlier:
      'Sin conexión: estás viendo la copia del {date}. Lo que taches en la compra se guardará cuando vuelva la conexión; el resto de cambios la necesita.',
    copyToday:
      'Sin conexión: estás viendo la copia de las {time}. Lo que taches en la compra se guardará cuando vuelva la conexión; el resto de cambios la necesita.',
    offline: 'Sin conexión. Lo que taches en la compra se guardará cuando vuelva; el resto de cambios necesita conexión.'
  },

  onboarding: {
    customAllergen: {
      bestEffort:
        '— no lo tenemos en el catálogo: quitamos de tus platos los alimentos cuyo nombre coincide, pero solo por el nombre, así que no podemos garantizarlo. Revisa los platos antes de cocinarlos.',
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
      country: '¿Dónde haces la compra?',
      countryHint: 'Decide qué ingredientes entran en tu plan: no te propondremos nada que no puedas comprar donde estás.',
      cuisines: 'Cocinas que te apetecen',
      customAllergens: 'Algo que no esté en la lista',
      customAllergensHint: 'Separa con comas. Al guardar buscamos cada una en nuestro catálogo y te decimos qué podemos aplicar.',
      customGoal: 'Si has elegido «Otro», descríbelo',
      dietaryPatterns: 'Tipo de alimentación',
      dietaryPatternsHint:
        'Quitamos el cerdo, el alcohol y la gelatina (y, en kosher, el marisco y la carne con lácteos). La carne certificada depende de dónde la compres.',
      disliked: 'Alimentos que no quieres ver',
      dislikedHint: 'No volverán a aparecer en tus planes.',
      displayName: '¿Cómo quieres que te llamemos?',
      goalType: '¿Qué quieres conseguir?',
      heightCm: 'Altura (cm)',
      includesSnacks: 'Incluir tentempiés entre comidas',
      intolerances: 'Intolerancias',
      liked: 'Alimentos que te gustan',
      likedHint: 'Separa con comas.',
      mealShape: '¿Qué comidas haces, y de qué tamaño?',
      mealShapeHint: 'Marca las que no hagas. Si una la haces ligera, el resto del día asume esos macros.',
      otherAllergies: 'Otras alergias',
      pace: 'Ritmo (kg por semana)',
      paceHint:
        'Entre 0 y 1 kg por semana; el sentido lo marca tu objetivo. Si pides más de lo que es seguro para ti, lo ajustamos y te lo decimos en el resumen.',
      paceRange: 'El ritmo tiene que estar entre 0 y 1 kg por semana.',
      portionPreference: '¿Prefieres platos grandes o ligeros?',
      sex: 'Sexo',
      sexHint: 'Lo usamos solo para la ecuación metabólica. Si prefieres no decirlo, usamos el valor intermedio.',
      sleepEnd: '¿A qué hora te levantas?',
      sleepStart: '¿A qué hora te acuestas?',
      targetWeightKg: 'Peso objetivo (kg)',
      traceHint: 'Marca «trazas» si también te afectan los productos que pueden contener el alérgeno.',
      traceLabel: 'trazas',
      traceLabelFor: 'Trazas de {allergen}',
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
      countries: { ES: 'España', GB: 'Reino Unido' },
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
      mealSizes: { large: 'Fuerte', light: 'Ligera', normal: 'Normal', off: 'No la hago' },
      mealSlots: {
        afternoon_snack: 'Merienda',
        breakfast: 'Desayuno',
        dinner: 'Cena',
        lunch: 'Comida',
        morning_snack: 'Media mañana',
        supper: 'Recena'
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
      mealShape: 'Comidas del día',
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

  /*
   * One title and, where a search result is possible, one description per
   * address.
   *
   * Keyed by the path itself so a route and its words cannot drift apart: the
   * type of these keys is what `pageMetadata` accepts, and a page nobody wrote
   * a title for does not compile. Titles are written without the brand — the
   * layout's template appends it — except the landing page, which leads with it.
   */
  pages: {
    '/': {
      description:
        'Planes de catorce días con recetas, cantidades y la lista de la compra hecha, construidos alrededor de tus objetivos, tus horarios y tus alergias.',
      title: 'NutrIA — Planes de alimentación personalizados'
    },
    '/acceder': { description: 'Entra en NutrIA para ver tu plan de hoy, tu lista de la compra y tu progreso.', title: 'Acceder' },
    '/admin': { title: 'Panel' },
    '/check-in': { title: 'Check-in de la quincena' },
    '/compra': { title: 'La compra' },
    '/condiciones': {
      description: 'Las condiciones para usar NutrIA: qué es y qué no es, tu cuenta, las alergias, Premium y cómo cancelarlo.',
      title: 'Condiciones de uso'
    },
    '/consentimiento': { title: 'Tus datos de salud' },
    '/consulta': { title: 'Consulta' },
    '/consulta/[linkId]': { title: 'Un paciente' },
    '/inicio': { title: 'Hoy' },
    '/invitacion': { title: 'Invitación' },
    '/onboarding': { title: 'Tu perfil' },
    '/pendiente': { title: 'Cuenta pendiente' },
    '/perfil': { title: 'Tu perfil' },
    '/plan': { title: 'Tu plan' },
    '/plan/comida': { title: 'Una comida' },
    '/plan/generando': { title: 'Creando tu plan' },
    '/plan/historial': { title: 'Tus planes anteriores' },
    '/plan/historial/[id]': { title: 'Un plan anterior' },
    '/privacidad': {
      description: 'Qué datos guarda NutrIA sobre ti, para qué los usa, con quién los comparte y cómo verlos, corregirlos o borrarlos.',
      title: 'Política de privacidad'
    },
    '/progreso': { title: 'Tu progreso' },
    '/recuperar': { title: 'Recuperar tu contraseña' },
    '/registro': {
      description: 'Crea tu cuenta y responde unas preguntas: tendrás catorce días de comidas con la lista de la compra hecha. Sin tarjeta.',
      title: 'Crear tu cuenta'
    },
    '/restablecer': { title: 'Elegir una contraseña nueva' },
    '/verificar-email': { title: 'Confirmar tu correo' }
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
    loadedFor: 'Comiendo para: {name}',
    pendingReviewBody: 'Tu dietista lo está revisando antes de publicarlo. Aquí sigue tu plan anterior, tal como estaba.',
    pendingReviewTitle: 'Tu plan nuevo está con tu dietista',
    range: '14 días · del {start} al {end}',
    redoAvailable: 'Puedes rehacer este plan una vez esta quincena: recetas nuevas para los mismos días.',
    redoCta: 'Rehacer el plan',
    redoSpent: 'Ya has rehecho tu plan esta quincena. Podrás crear el siguiente el {date}.',
    title: 'Tu plan',
    week: 'Semana {number}'
  },

  practice: {
    adherenceLabel: 'de las comidas marcadas, hechas',
    adherenceNone: 'Sin comidas marcadas',
    back: '← Pacientes',
    checkInDifficulty: { easy: 'Fácil de seguir', hard: 'Difícil de seguir', ok: 'Se pudo seguir' },
    checkInHunger: { hungry: 'Se quedó con hambre', right: 'Cantidades justas', too_much: 'Demasiada comida' },
    checkInNone: 'Sin check-in',
    checkInSatisfaction: 'Satisfacción {value} de 5',
    checkInSuggested: 'Con esta respuesta, su objetivo pasaría a {kcal} kcal. No se ha cambiado: decides tú.',
    checkInWeight: 'Pesaba {value} kg',
    clientsEmpty: 'Aún no tienes pacientes. Invita al primero con su correo.',
    clientSince: 'Paciente desde el {date}',
    clientsTitle: 'Pacientes',
    currentPlanNone: 'Todavía no tiene ningún plan.',
    currentPlanTitle: 'Plan actual',
    dayTitle: 'Día {index} · {date}',
    dayTotals: '{kcal} kcal · {protein} g de proteína',
    end: 'Terminar vínculo',
    endConfirmBody:
      'Dejarás de ver su perfil, sus planes y su progreso, y se libera una plaza de tu plan. Sus objetivos se quedan como están y pasan a ser suyos.',
    endConfirmCta: 'Sí, terminar',
    endConfirmTitle: '¿Terminar el vínculo con {name}?',
    endHint: 'Tu paciente conserva su cuenta, su historial y su último plan publicado.',
    fortnightRange: '{from} – {to}',
    fortnightsEmpty: 'Todavía no ha vivido ninguna quincena.',
    fortnightsTitle: 'Quincenas y check-ins',
    generateBusy: 'Ya se está generando un plan para este paciente. Espera a que termine.',
    generateDoneDirect: 'Plan listo: ya lo tiene tu paciente.',
    generateDoneReview: 'Plan listo. Lo tienes arriba, en «Plan por revisar».',
    generateFailed: 'No se ha podido generar el plan y no se ha guardado nada. Puedes volver a intentarlo.',
    generateIncomplete: 'Tu paciente todavía no ha terminado su perfil: sin él no se pueden calcular sus necesidades.',
    generateQuota: 'Tu paciente ha agotado las generaciones de esta quincena. Se renuevan el {date}.',
    generating: 'Generando el plan…',
    gone: 'Este vínculo ya no está activo. Vuelve a la lista de pacientes.',
    healthConditions: 'Condiciones',
    healthIntro: 'Tu paciente decidió compartir esto contigo. Nunca se envía a ningún modelo.',
    healthMedications: 'Medicación',
    healthNone: 'Nada anotado',
    healthSupplements: 'Suplementos',
    healthTitle: 'Salud',
    historyEmpty: 'Todavía no hay planes anteriores.',
    historyItem: 'Plan {version} · {from} – {to}',
    historyStatus: { active: 'En curso', archived: 'Archivado', completed: 'Terminado', replaced: 'Sustituido' },
    historyTitle: 'Planes',
    intro: 'Tus pacientes, sus planes y el plan de tu consulta.',
    invitationExpires: 'Caduca el {date}',
    invitationsTitle: 'Invitaciones sin responder',
    inviteCta: 'Enviar la invitación',
    inviteEmail: 'Correo de tu paciente',
    inviteFull: 'Tu consulta ya tiene los {count} pacientes que incluye tu plan.',
    inviteFullEnd: 'También puedes terminar el vínculo con un paciente al que ya no atiendas.',
    inviteFullUp: 'Pasar a un plan mayor',
    inviteHint: 'Le llegará un correo con el enlace. Las invitaciones sin responder ocupan plaza hasta que caducan.',
    inviteInvalid: 'Escribe un correo válido, como nombre@ejemplo.com.',
    invitePending: 'Enviando…',
    inviteSent: 'Invitación enviada a {email}. Caduca el {date}.',
    inviteTitle: 'Invitar a un paciente',
    newFortnight: 'Nueva quincena',
    newFortnightDirect: 'Se publicará a tu paciente en cuanto esté listo.',
    newFortnightPending: 'Revisa y publica el plan pendiente antes de generar otro.',
    newFortnightReady: 'La quincena anterior ha terminado. Puedes generar la siguiente.',
    newFortnightReview: 'Llegará aquí para que lo revises antes de publicarlo.',
    newFortnightRunning: 'Podrás generar la siguiente cuando termine esta, el {date}.',
    overallLine: '{eaten} comidas hechas de {marked} marcadas',
    overallNone: 'Aún no ha marcado ninguna comida.',
    paused: 'En pausa',
    pausedHint: 'Tu consulta está cerrada: no puedes ver su ficha hasta que se renueve tu plan.',
    pendingIntro: 'Tu paciente no lo verá hasta que lo publiques. Mientras, sigue con su plan anterior.',
    pendingTitle: 'Plan por revisar',
    planChoose: '{clients} pacientes · {price} al mes',
    planChoosePlain: '{clients} pacientes',
    planClosed: 'Elige un plan para invitar a pacientes y ver su seguimiento.',
    planEnds: 'Tu plan termina el {date}.',
    planJustPaid: 'Pago recibido. Tu consulta se abrirá en unos segundos.',
    planLapsed: 'Tu plan no está al día: tus pacientes están en pausa y vuelven en cuanto se renueve.',
    planManage: 'Gestionar el plan',
    planPastDue: 'No se ha podido cobrar el último pago. Actualiza la tarjeta para que tus pacientes no queden en pausa.',
    planRenews: 'Se renueva el {date}.',
    planSeats: '{active} de {included} pacientes',
    planSeatsPending: 'Y {count} invitaciones sin responder, que también ocupan plaza.',
    planTerms: 'Contratas como profesional, no como consumidor. Condiciones del plan de consulta.',
    planTestMode: 'Modo de prueba: nada de lo que pagues es dinero real.',
    planTitle: 'Tu plan',
    planTrial: 'Los primeros {days} días son gratis. Al terminar, el plan se cobra cada mes hasta que lo canceles.',
    planTrialLeft: 'Periodo de prueba: te quedan {days} días.',
    planUnavailable: 'Los planes de consulta todavía no están disponibles.',
    publish: 'Publicar el plan',
    regenerate: 'Generar otro',
    regenerateHint: 'Sustituye este borrador por uno nuevo y cuenta como una generación de tu paciente.',
    reviewLabel: 'Revisar cada plan antes de que lo vea',
    reviewOffHint: 'Los planes nuevos llegan a tu paciente en cuanto están listos.',
    reviewOnHint: 'Cada plan nuevo te llega primero a ti, y tu paciente lo ve cuando lo publicas.',
    reviewTitle: 'Revisión',
    sharesHealth: 'Comparte su salud',
    stages: {
      awaiting_plan: 'Sin plan todavía',
      check_in_due: 'Check-in pendiente',
      onboarding: 'Completando su perfil',
      plan_awaiting_review: 'Plan por revisar',
      plan_under_way: 'Plan en marcha'
    },
    swapHint: 'Cuenta contra los cambios de este plan.',
    swapSpent: 'Ya no quedan cambios en este plan.',
    targetsBounds: 'Entre {min} y {max} kcal para este paciente.',
    targetsEdit: 'Cambiar objetivos',
    targetsEstimated: 'Estimados a partir de su perfil',
    targetsFieldInvalid: 'Este valor está fuera de lo que se puede fijar.',
    targetsProfessional: 'Fijados por {name}',
    targetsReset: 'Volver a los estimados',
    targetsSave: 'Guardar objetivos',
    targetsSelf: 'Fijados por tu paciente',
    targetsTitle: 'Objetivos diarios',
    title: 'Consulta',
    weightNone: 'Aún no ha anotado ningún peso.',
    weightTitle: 'Peso'
  },

  practiceAgreement: {
    accept: 'Aceptar y abrir mi consulta',
    acceptedOn: 'Aceptado el {date}, versión {version}.',
    checkbox: 'He leído y acepto el acuerdo del profesional y las condiciones del plan de consulta.',
    intro: [
      'Vas a ver datos de salud de tus pacientes. Esto es lo que aceptas para poder hacerlo. Léelo: son pocas cosas y todas importan.',
      'NutrIA lo presta {name}, a quien puedes escribir en {email}.'
    ],
    sections: [
      {
        heading: 'Quién eres aquí',
        list: [
          'Usas NutrIA como dietista-nutricionista titulado y, cuando tu comunidad lo exige, colegiado. El número de colegiado que nos diste es tuyo y está en vigor; si deja de estarlo, nos lo dices y dejas de usar la consulta.',
          'La cuenta es personal. Nadie más entra con ella, tampoco alguien de tu equipo.'
        ],
        paragraphs: []
      },
      {
        heading: 'Qué verás y qué podrás hacer',
        list: [
          'Verás su nombre, sus objetivos diarios y cómo se calcularon, su plan y los anteriores, cuánto de cada quincena ha seguido, su peso a lo largo del tiempo y las respuestas de cada check-in. Sus condiciones de salud, su medicación y sus suplementos, solo si tu paciente lo marca aparte, y dejas de verlos en cuanto lo desmarca.',
          'No verás sus alergias ni intolerancias, su correo, sus comentarios escritos ni nada de otras personas.',
          'Podrás fijar sus objetivos diarios dentro de los mismos límites de seguridad que usa la calculadora, generar y cambiar su plan, revisarlo antes de que lo vea y publicarlo.',
          'Cada vez que miras o cambias algo, tu paciente lo ve en su perfil: quién, qué y cuándo.'
        ],
        paragraphs: ['Solo de los pacientes que acepten tu invitación, y mientras el enlace siga activo:']
      },
      {
        heading: 'Secreto profesional',
        list: [
          'Lo que veas aquí está bajo tu secreto profesional, igual que lo que te cuentan en consulta. No lo compartes con nadie ajeno a la asistencia de ese paciente, salvo en los casos en que la ley te obliga o te permite hacerlo.',
          'Si trabajas con otras personas, ninguna usa tu cuenta ni ve la consulta.'
        ],
        paragraphs: []
      },
      {
        heading: 'Quién responde de los datos',
        list: [
          'NutrIA es responsable de los datos de la cuenta de tu paciente: los guarda, los protege, decide cuánto duran y atiende sus derechos sobre ellos (acceso, rectificación, borrado, portabilidad, oposición). Cuando tu paciente acepta tu invitación, NutrIA te comunica esos datos porque tu paciente lo pide y lo consiente.',
          'Tú eres responsable, por tu cuenta, de lo que hagas con lo que ves: de tu valoración, de lo que anotes fuera de NutrIA y de tu historia clínica. Lo haces para tu asistencia dietética, con tu propia base legal como profesional sanitario.',
          'NutrIA no trata datos por cuenta tuya: no es tu encargado del tratamiento. Si algún día NutrIA guardara algo que escribes para tu práctica —notas, una ficha, documentos— o te dejara exportar la ficha de un paciente, antes firmaríamos un contrato de encargo y te pediríamos aceptarlo.',
          'Si un paciente te pide ejercer un derecho sobre los datos que viven en NutrIA, le indicas que lo haga desde su perfil o escribiendo a {email}; si nos lo pide a nosotros sobre lo que tú guardas fuera, se lo diremos. Cada uno informa a los pacientes de lo suyo; NutrIA ya les informa, en la invitación y en su política de privacidad, de que te comunica sus datos y de qué datos son.',
          'Si una autoridad o un tribunal considerara que decidimos juntos el tratamiento, este apartado es nuestro acuerdo de reparto de responsabilidades: NutrIA informa a los pacientes y atiende sus derechos sobre lo que vive en NutrIA, y es el punto de contacto; tú, sobre lo que guardas fuera. Sus aspectos esenciales están en la política de privacidad.'
        ],
        paragraphs: []
      },
      {
        heading: 'NutrIA es una herramienta, no una segunda opinión',
        list: [
          'NutrIA planifica comidas. No diagnostica, no trata y no deriva ninguna regla de una enfermedad, salvo una: la celiaquía excluye el gluten. La medicación no produce nada.',
          'Los platos y las recetas los propone un modelo de inteligencia artificial y los comprueba nuestro código: alergias e intolerancias declaradas, límites de calorías y de proteína. Pueden tener errores de cantidades o de pasos. La decisión clínica y la revisión del plan son tuyas.',
          'Los datos de salud de tu paciente nunca llegan al modelo, compartan o no contigo.',
          'NutrIA no es tu historia clínica. Lo que tu profesión te obliga a registrar y conservar, lo registras y conservas tú, fuera de NutrIA. Cuando el enlace termina, dejas de ver todo lo que había aquí.'
        ],
        paragraphs: []
      },
      {
        heading: 'A quién invitas',
        list: [
          'Solo a personas que ya son tus pacientes y que saben, antes de recibir el correo, que las vas a invitar. Su dirección nos la das tú, y con ella solo enviamos la invitación.',
          'Nunca a menores de 18 años. Tampoco a pacientes que necesiten nutrición clínica que NutrIA no cubre: una enfermedad metabólica diagnosticada que requiera una pauta específica, el embarazo, la recuperación de un trastorno de la conducta alimentaria o la alimentación infantil. Para ellos, NutrIA no es la herramienta.',
          'Tu paciente decide: puede decir que no, aceptar sin compartir su salud, retirar esa parte o terminar el enlace cuando quiera. No le condiciones tu atención a que acepte.'
        ],
        paragraphs: []
      },
      {
        heading: 'Qué pasa con los datos cuando algo termina',
        list: [
          'Termina un enlace (lo terminas tú, tu paciente, o se pausa porque tu plan no está al día): dejas de ver sus datos en la siguiente petición. Los objetivos que fijaste se quedan en su cuenta y pasan a ser suyos. Un plan que tenías pendiente de revisar no se le muestra y no le cuesta nada. Tu nombre sigue en su registro de accesos, porque es su derecho saber quién miró.',
          'Borras tu cuenta: terminan todos tus enlaces y se borran tus invitaciones, tu concesión y tu suscripción. Tu nombre se queda en el registro de accesos de cada paciente que tuviste, sin tu cuenta.',
          'Tu paciente borra su cuenta: dejas de verlo; su registro se borra con ella.',
          'Retiramos tu concesión (por ejemplo, si tu número de colegiado deja de estar en vigor o incumples este acuerdo): pierdes el acceso a la consulta y tus invitaciones se anulan.',
          'Lo que hayas copiado fuera de NutrIA para tu historia clínica es tuyo y lo conservas según tu normativa.'
        ],
        paragraphs: []
      },
      {
        heading: 'Seguridad',
        list: [
          'Protege tu acceso: una contraseña que no uses en otro sitio, o entra con Google. No dejes la sesión abierta en un ordenador compartido.',
          'No hagas capturas ni copias de la ficha salvo para tu historia clínica, y guárdalas con la misma protección que el resto de tu documentación clínica.',
          'Si crees que alguien ha entrado en tu cuenta o ha visto datos de un paciente que no debía, escríbenos a {email} en cuanto lo sepas, y en todo caso en 24 horas. Nosotros valoraremos si hay que avisar a la Agencia Española de Protección de Datos y a los pacientes; si la brecha es tuya, fuera de NutrIA, esa obligación es tuya.'
        ],
        paragraphs: []
      },
      {
        heading: 'Usos prohibidos',
        list: [
          'intentar ver datos de alguien que no ha aceptado tu invitación, o saber si una dirección tiene cuenta en NutrIA;',
          'invitar direcciones que no sean de tus pacientes, ni usar la invitación para anunciar tus servicios;',
          'usar los datos de tus pacientes para algo que no sea su asistencia: ni publicidad, ni estudios, ni venderlos ni cederlos;',
          'compartir o prestar tu cuenta;',
          'extraer datos de forma automatizada o intentar saltarte los límites de tu plan o las medidas de seguridad.'
        ],
        outro: ['Si haces alguna de estas cosas, podemos retirar tu concesión de inmediato.'],
        paragraphs: ['No puedes:']
      },
      {
        heading: 'Cambios y duración',
        list: [
          'Este acuerdo dura mientras tengas la concesión. Si lo cambiamos en algo importante, te lo diremos por correo y te pediremos aceptarlo de nuevo antes de volver a abrir la consulta; mientras tanto tus pacientes siguen con sus cuentas.',
          'Se rige por la ley española. Para las condiciones económicas del plan de consulta, ver abajo.'
        ],
        paragraphs: []
      }
    ],
    terms: {
      sections: [
        {
          heading: 'Qué contratas',
          paragraphs: [
            'El acceso a la consulta de NutrIA para un número de pacientes activos que depende del plan (por ejemplo, 30 o 60). Cuentan como plaza los enlaces activos y las invitaciones que aún no han caducado. Al llegar al límite, puedes pasar a un plan mayor o terminar un enlace.'
          ]
        },
        {
          heading: 'Precio y pago',
          paragraphs: [
            'El precio mensual de cada plan, con impuestos, se muestra antes de pagar. Se cobra por adelantado cada mes a través de Stripe, con la tarjeta que indiques. Si necesitas una factura a nombre de tu actividad, indica tus datos fiscales en el pago.'
          ]
        },
        {
          heading: 'Prueba',
          paragraphs: [
            'La primera vez tienes {days} días gratis. Te pedimos la tarjeta al empezar y no cobramos hasta que la prueba acaba; si cancelas antes, no pagas nada. La prueba es una por cuenta.'
          ]
        },
        {
          heading: 'Renovación y cancelación',
          paragraphs: [
            'El plan se renueva cada mes hasta que lo canceles desde «Gestionar el plan», en tu consulta. Conservas el acceso hasta el final del mes pagado. No hay permanencia. Puedes cambiar de plan desde el mismo sitio; el cambio y su prorrateo los calcula Stripe al momento.'
          ]
        },
        {
          heading: 'Si el plan no está al día',
          paragraphs: [
            'Si un cobro falla, Stripe lo reintenta durante unos días y mantienes el acceso. Si el plan termina o deja de pagarse, tus pacientes quedan en pausa: dejas de ver sus datos, ellos conservan sus cuentas y vuelven a los límites gratuitos, y no se borra nada. Si vuelves a pagar, los enlaces se reanudan.'
          ]
        },
        {
          heading: 'Sin derecho de desistimiento de consumidor',
          paragraphs: [
            'Como contratas para tu actividad profesional, no se aplica el derecho de desistimiento de 14 días de los consumidores. Aun así, si cancelas durante la prueba no pagas nada.'
          ]
        },
        {
          heading: 'Disponibilidad y cambios',
          paragraphs: [
            'Hacemos lo posible porque la consulta funcione siempre, pero puede haber interrupciones. Si cambiamos el precio te avisamos con al menos 30 días y puedes cancelar antes. Si algún día cerramos el servicio, avisaremos con tiempo y devolveremos la parte no disfrutada del mes.'
          ]
        },
        {
          heading: 'Responsabilidad',
          paragraphs: [
            'Respondemos de lo que cause NutrIA por dolo o negligencia grave y de lo que la ley no permite excluir. No respondemos de tus decisiones clínicas ni de lo que hagas con los datos fuera de NutrIA, que son tuyos como profesional. Nuestra responsabilidad por lo demás se limita a lo que hayas pagado en los últimos doce meses.'
          ]
        },
        {
          heading: 'Ley y tribunales',
          paragraphs: [
            'Se rigen por la ley española. Para cualquier conflicto, los juzgados y tribunales del domicilio del titular de NutrIA, salvo que la ley disponga otra cosa.'
          ]
        }
      ],
      title: 'Condiciones del plan de consulta'
    },
    title: 'Antes de abrir tu consulta',
    version: 'Versión {version}'
  },

  privacy: {
    intro: [
      'Esta política explica qué datos guarda NutrIA sobre ti, para qué, con quién los comparte, cuánto tiempo y qué puedes hacer con ellos.',
      'NutrIA es una herramienta de planificación de comidas. No es un servicio médico y no sustituye el consejo de un médico ni de un dietista-nutricionista colegiado.'
    ],
    sections: [
      {
        heading: 'Quién trata tus datos',
        paragraphs: [
          'El responsable del tratamiento es {name}, titular de NutrIA. Puedes escribir a {email} para cualquier cuestión sobre tus datos, incluida una solicitud de acceso, rectificación o borrado.',
          'No tenemos delegado de protección de datos porque la ley no nos lo exige; {email} cumple esa función de contacto.'
        ]
      },
      {
        heading: 'Qué datos recogemos y para qué',
        list: [
          'Cuenta: tu nombre y tu correo y, si entras con Google o Apple, el nombre y el correo que ese servicio nos confirma. Mientras tienes la sesión abierta guardamos la dirección IP y el navegador desde el que entraste, para poder cerrarla. Para que tengas una cuenta y solo tú entres en ella.',
          'Tu cuerpo y tu objetivo: fecha de nacimiento, sexo, altura, peso, nivel de actividad, horarios y tu objetivo (por ejemplo, perder peso). Para calcular cuánto necesitas comer.',
          'Alergias e intolerancias: las que eliges de la lista, las que escribes a mano y su gravedad. Para que ningún plan te proponga algo que te puede hacer daño.',
          'Tu forma de comer: por ejemplo vegetariana, sin gluten o sin lactosa, y la cocina que te gusta o no. Para ajustar los platos.',
          'Enfermedades, medicación y suplementos: solo si decides contárnoslo, bajo un consentimiento aparte que puedes retirar en cualquier momento sin borrar el resto de tu cuenta.',
          'Cómo llevas el plan: qué comidas marcas como hechas o saltadas, tus valoraciones y comentarios de los platos, tu peso a lo largo del tiempo y tus check-ins quincenales. Para que el siguiente plan lo tenga en cuenta.',
          'Pagos: si contratas Premium, Stripe cobra y nosotros guardamos solo el identificador de tu suscripción y su estado. Nunca vemos el número de tu tarjeta.',
          'Uso del producto: registramos, ligado a tu cuenta, cuándo abres sesión y cuándo pides cambiar un plato, sin más detalle. Para saber si el producto funciona.',
          'Lo que nos escribes: los mensajes del buzón de sugerencias, para leerlos y responderte.'
        ],
        paragraphs: []
      },
      {
        heading: 'Cuáles de estos datos son especialmente protegidos',
        paragraphs: [
          'La ley protege especialmente los datos de salud y los que revelan creencias religiosas. En NutrIA lo son: tus alergias e intolerancias; tu peso, tu altura y tu objetivo, porque dicen algo de tu salud; una forma de comer como «sin gluten» o «sin lactosa», o una ligada a una religión; tus enfermedades, tu medicación y tus suplementos; y lo que escribas sobre cómo te sienta el plan.'
        ]
      },
      {
        heading: 'Por qué podemos tratar estos datos',
        paragraphs: [
          'Para darte el servicio que pides (contrato): tu cuenta, tu perfil, tus planes, tus pagos y los correos del servicio.',
          'Con tu consentimiento explícito: tus alergias e intolerancias, tu cuerpo y tu objetivo y tu forma de comer, que nos das con una casilla propia al crear tu perfil. Sin ellos no podemos hacer un plan seguro para ti, por eso sin ese consentimiento no generamos planes; puedes retirarlo cuando quieras borrando esos datos desde tu perfil. Tus enfermedades, tu medicación y tus suplementos, con un consentimiento aparte, opcional. Cada consentimiento se guarda con su fecha y la versión del texto que aceptaste.',
          'Por nuestro interés legítimo: registrar el uso del producto y los errores técnicos para que funcione, sin datos de salud. Puedes oponerte escribiéndonos.',
          'Por obligación legal: conservar lo que la ley fiscal exige de los pagos (lo hace Stripe).'
        ]
      },
      {
        id: 'tu-dietista',
        heading: 'Tu dietista en NutrIA',
        paragraphs: [
          'Un dietista-nutricionista puede invitarte por correo a llevar tu plan en NutrIA con su ayuda. Solo un profesional al que hemos dado acceso tras comprobar su número de colegiado puede hacerlo. Su invitación dura 14 días; tu dirección la guardamos solo ese tiempo, para enviarte la invitación.',
          'Nada se comparte si no aceptas. Si aceptas, tu dietista verá tu nombre, tus objetivos diarios y cómo se calcularon, tus planes, cuánto sigues cada quincena, tu peso a lo largo del tiempo y tus respuestas a los check-ins. Podrá fijar tus objetivos, generar y cambiar tus planes, y revisar cada plan nuevo antes de que lo veas. Tus enfermedades, tu medicación y tus suplementos solo si marcas esa casilla aparte. No verá tus alergias ni intolerancias, tu correo ni tus comentarios escritos.',
          'Cada vez que tu dietista mira o cambia algo, queda anotado y lo ves en tu perfil, en «Quién ha accedido».',
          'Puedes terminar el enlace cuando quieras desde tu perfil, y desde la siguiente petición tu dietista deja de ver tus datos. También puedes dejar de compartir solo tu salud sin terminar el enlace. Tus objetivos, tu historial y tu último plan publicado se quedan contigo.',
          'Quién responde de qué: NutrIA es responsable de tus datos en NutrIA y te los comunica a tu dietista porque tú lo pides. Tu dietista es responsable, por su cuenta y bajo su secreto profesional, de lo que haga con lo que ve en su consulta, por ejemplo lo que anote en tu historia clínica; para eso, escríbele a él. Para todo lo que está en NutrIA, escríbenos a {email}: somos tu punto de contacto.',
          'Si tu dietista borra su cuenta, el enlace termina y su nombre sigue en tu registro de accesos.'
        ]
      },
      {
        heading: 'La inteligencia artificial',
        paragraphs: [
          'Un modelo de inteligencia artificial propone los platos y las recetas. Nuestro propio código comprueba cada uno antes de que te llegue: un alérgeno declarado no llega a tu plan aunque el modelo se equivoque. La IA no toma ninguna decisión sobre ti: los límites de calorías y de proteína los aplican reglas fijas, no el modelo.',
          'Lo que recibe el modelo: tus objetivos diarios y tu objetivo (por ejemplo, perder peso), qué comidas haces y a qué horas te levantas, te acuestas y entrenas, cuánto cocinas y tu presupuesto, si eres vegetariano o vegano, las cocinas y los alimentos que te gustan, los nombres de los platos que te gustaron, que no te gustaron o que comiste la quincena anterior, y tus respuestas cerradas al check-in (hambre, dificultad, nota). Siempre con los nombres de nuestras listas. Nunca recibe tu nombre, tu correo, tu edad, tu sexo, tu peso ni tu altura, nada que hayas escrito a mano, tus alergias ni intolerancias, ninguna otra forma de comer (sin gluten, sin lactosa, halal, kósher…), ni tus enfermedades, tu medicación o tus suplementos. Lo que no puedes o no quieres comer lo quitamos antes, en nuestro código, del catálogo de alimentos que ve: le llega el efecto, nunca el dato.',
          'Hoy algunos de los modelos que usamos son versiones gratuitas alojadas en Estados Unidos cuyos proveedores pueden usar lo que reciben para mejorar sus modelos. Por eso les enviamos solo lo necesario para diseñar platos, nunca texto libre. Estamos cambiando a proveedores que no reutilicen los datos.',
          'Las ilustraciones de las recetas las dibuja un modelo a partir del nombre y los ingredientes de la receta, sin ningún dato tuyo.'
        ]
      },
      {
        heading: 'Con quién compartimos tus datos',
        list: [
          'Proveedores de inteligencia artificial, como se explica arriba.',
          'Vercel (alojamiento de la web y la API, en la Unión Europea) y Neon (base de datos, en la Unión Europea). Son empresas de Estados Unidos.',
          'Stripe, si contratas Premium, para cobrar la suscripción. Stripe procesa y conserva los datos de pago según sus propias políticas.',
          'Nuestro proveedor de correo, para los correos de confirmación, recuperación de contraseña y recordatorio del check-in que tú actives.',
          'El servicio de notificaciones de tu propio navegador (Google, Apple o Mozilla), si activas los avisos; el contenido va cifrado y ellos no pueden leerlo.',
          'Sentry, un servicio de errores, solo si está activado: recibe el error y dónde ocurrió, nunca tus datos ni lo que escribiste.'
        ],
        paragraphs: ['No vendemos tus datos. No hay anuncios ni cookies publicitarias.']
      },
      {
        heading: 'Transferencias fuera de la Unión Europea',
        paragraphs: [
          'Algunos de estos proveedores son empresas de Estados Unidos o tratan datos allí: Vercel, Neon, Stripe, el proveedor de correo, Sentry y los de inteligencia artificial. Vercel está certificado en el Marco de Privacidad de Datos UE-EE. UU., que la Comisión Europea reconoce como garantía suficiente; con el resto nos apoyamos en ese mismo marco o en las cláusulas contractuales tipo de la Comisión, según ofrezca cada uno. Los modelos gratuitos de inteligencia artificial que usamos hoy no ofrecen ninguna de esas garantías; por eso solo les enviamos lo que se describe arriba, sin nada que te identifique, que escribas tú ni que sea un dato de salud o una creencia. Puedes pedirnos el detalle de cada garantía en {email}.'
        ]
      },
      {
        heading: 'Cuánto tiempo guardamos tus datos',
        paragraphs: [
          'Mientras tu cuenta exista. Al borrarla, todo lo que hay en ella se borra al momento: perfil, alergias, salud, planes, listas de la compra, progreso y consentimientos.',
          'Nuestro proveedor de base de datos guarda, por su cuenta, un historial breve para poder recuperarnos de un fallo; puedes pedirnos el plazo exacto en {email}.',
          'Si contrataste Premium, Stripe conserva los datos de facturación el tiempo que le exige la ley, aunque borres tu cuenta.'
        ]
      },
      {
        heading: 'Tus derechos',
        list: [
          'Acceso: ver qué datos tenemos, desde tu perfil o pidiéndolos por correo.',
          'Rectificación: corregirlos, desde tu perfil en casi todo.',
          'Supresión: borrar tu cuenta desde tu perfil, o pedirlo por correo.',
          'Portabilidad: recibir tus datos en un archivo estructurado para llevarlos a otro servicio; pídenoslo por correo.',
          'Limitación: pedirnos que dejemos de usar un dato mientras resolvemos una reclamación tuya sobre él.',
          'Oposición: al registro de uso del producto, escribiéndonos.',
          'Retirar un consentimiento cuando quieras, sin que afecte a lo que ya hicimos con él: el de tu perfil o el de tu salud, borrando esos datos desde tu perfil.',
          'Reclamar ante la Agencia Española de Protección de Datos (aepd.es).'
        ],
        paragraphs: ['Respondemos en un mes como máximo. No te cobramos nada por ello.']
      },
      {
        heading: 'Cómo protegemos tus datos',
        paragraphs: [
          'Tu contraseña nunca se guarda en texto plano y la conexión va siempre cifrada. Tus enfermedades, tu medicación y tus suplementos viven en una parte del código que no puede hablar con la inteligencia artificial, y un test lo comprueba en cada cambio. Los registros del servidor y de errores no guardan lo que escribes. El acceso a la base de datos está restringido y nadie la consulta salvo para arreglar un fallo.'
        ]
      },
      {
        heading: 'Cookies y almacenamiento en tu dispositivo',
        paragraphs: [
          'Solo usamos lo imprescindible para que el servicio funcione, y por eso no te pedimos permiso: la cookie de tu sesión, la del idioma que has elegido y, al entrar con Google o Apple, las que ese paso necesita durante unos minutos. Ninguna es de terceros ni rastrea tu actividad en otras webs.',
          'En el almacenamiento de tu navegador guardamos lo que marcas sin conexión hasta que se envía, un aviso de plan pendiente de revisión y, si instalas NutrIA en tu teléfono, una copia de tu plan de hoy y de la lista de la compra para usarlas sin conexión. Todo se queda en tu dispositivo.'
        ]
      },
      {
        heading: 'Menores de edad',
        paragraphs: [
          'NutrIA no es para menores de 18 años. Si la fecha de nacimiento que indicas es de alguien menor, no podemos crear el perfil. Si sabemos que una cuenta es de un menor de 18 años, la borramos.'
        ]
      },
      {
        heading: 'Cambios en esta política',
        paragraphs: [
          'Si cambiamos algo importante, lo diremos aquí con la fecha y te avisaremos por correo antes de que se aplique. Si el cambio afecta a cómo tratamos tus datos de salud, te pediremos tu consentimiento de nuevo.'
        ]
      }
    ],
    title: 'Política de privacidad',
    updated: 'Última actualización: 25 de septiembre de 2026'
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
    premiumCancelAnytime: 'Sin permanencia: lo cancelas cuando quieras, desde aquí mismo.',
    premiumEnds: 'Tienes premium hasta el {date}. No se renovará.',
    premiumGranted: 'Tienes premium, concedido por NutrIA.',
    premiumJustPaid: 'Pago recibido. Premium se activa en unos segundos: si todavía no lo ves, recarga la página.',
    premiumManage: 'Gestionar la suscripción',
    premiumMonthly: 'Mensual · {price} al mes',
    premiumPastDue: 'No se ha podido cobrar la última cuota. Stripe lo volverá a intentar; actualiza la tarjeta para no perder premium.',
    premiumPitch:
      'Tres replanificaciones por quincena en vez de una, veinte cambios de comida por plan en vez de cinco, diez eventos por plan en vez de tres, y hasta tres eventos añadidos con el plan ya empezado.',
    premiumRenews: 'Tienes premium. Se renueva el {date}.',
    premiumSafety: 'La seguridad alimentaria —alergias, intolerancias y nutrientes— es la misma con premium y sin él.',
    premiumTestMode: 'Modo de prueba: no se cobra nada de verdad. Usa la tarjeta 4242 4242 4242 4242, cualquier fecha futura y cualquier CVC.',
    premiumTitle: 'Premium',
    premiumTrial: 'Los primeros {days} días son gratis: no se cobra nada hasta que acaben, y si lo cancelas antes no pagas nada.',
    premiumTrialing: 'Estás en tu prueba gratuita hasta el {date}. Si no la cancelas, después se renueva sola.',
    premiumYearly: 'Anual · {price} al año (ahorras un {saving} %)',
    premiumYearlyPlain: 'Anual · {price} al año',
    profileConsentTitle: 'Consentimiento de datos de salud',
    profileConsentWithdraw: 'Retirar el consentimiento y borrar estos datos',
    profileConsentWithdrawBody:
      'Se borran tus alergias, tus intolerancias, las que escribiste a mano, tu forma de comer, tu altura, tu peso y tu objetivo, y no se generarán más planes hasta que vuelvas a darlo. Volverás a los pasos de tu objetivo, tu cuerpo y tus alergias.',
    profileConsentWithdrawConfirm: 'Sí, retirar y borrar',
    profileConsentWithdrawTitle: '¿Retirar tu consentimiento?',
    pushBlocked: 'Este navegador tiene bloqueados los avisos de NutrIA. Puedes permitirlos en sus ajustes.',
    pushHint: 'Una notificación el día que toca el check-in. Se activa en cada dispositivo por separado.',
    pushInstallFirst:
      'Para recibir avisos en el iPhone, añade NutrIA a la pantalla de inicio (Compartir → Añadir a la pantalla de inicio) y actívalos desde ahí.',
    pushLabel: 'Avisarme también en este dispositivo',
    pushUnsupported: 'Este navegador no puede recibir avisos.',
    reminderCheckIn: 'Avísame por correo cuando acabe la quincena',
    reminderCheckInHint: 'Un correo cada catorce días, el día que toca el check-in. Nada más.',
    reminders: 'Avisos',
    restrictions: 'Restricciones',
    sectionCare: 'Tu dietista',
    sectionDanger: 'Zona peligrosa',
    sectionData: 'Tus datos',
    sectionHelp: 'Ayuda',
    sectionNotices: 'Avisos e idioma',
    sectionPlan: 'Tu plan',
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
    youAvoidBestEffort: '{labels} · se lo pedimos a la IA, pero no podemos garantizarlo',
    youAvoidEnforced: '{labels} · fuera de tus recetas',
    youLike: 'Te gusta'
  },

  profileConsent: {
    ai: 'Un modelo de inteligencia artificial diseña los platos. Recibe tus objetivos diarios, tus horarios de comida, tu presupuesto, si eres vegetariano o vegano, y los alimentos y platos que te gustan o no, siempre con los nombres de nuestras listas. Nunca recibe tu nombre, tu correo, tu edad, tu peso ni tu altura, nada que escribas a mano, tus alergias ni intolerancias, ninguna otra forma de comer, ni tus enfermedades o tu medicación: lo que no puedes o no quieres comer lo quitamos antes, en nuestro código, y el mismo código comprueba cada plato antes de que te llegue.',
    body: 'Para hacerte un plan seguro necesitamos datos que dicen algo de tu salud: tus alergias e intolerancias, tu peso, tu altura y tu objetivo, y tu forma de comer, que a veces revela una intolerancia o una creencia. Los usamos solo para calcular tus objetivos y elegir tus platos.',
    continue: 'Continuar',
    label: 'Consiento que NutrIA use estos datos de salud para hacer mis planes',
    note: 'Sin este consentimiento no podemos hacerte un plan. Puedes retirarlo cuando quieras desde tu perfil: se borran esos datos. Más en la {privacy}.',
    title: 'Antes de seguir: tus datos de salud'
  },

  progress: {
    adherenceLabel: 'de las que marcaste, hechas',
    adherenceNone: 'Sin comidas marcadas',
    allPlans: 'Todos tus planes →',
    chartEmpty: 'Con dos pesos anotados aparece la línea.',
    chartSummary: 'De {from} kg el {fromDate} a {to} kg el {toDate}.',
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
    nearby: 'Supermercados cerca',
    nearbyOpens: ' (se abre en la app de mapas)',
    nearbyQuery: 'supermercado',
    notice: 'Por ahora la lista es solo de consulta. Poder marcar lo que ya tienes, ajustar cantidades y añadir cosas llega en la próxima entrega.',
    progress: '{done} de {total} ya en el carro',
    share: 'Compartir lo que falta',
    shareCopied: 'Lista copiada: pégala donde quieras.',
    shareNothing: 'Ya lo tienes todo en el carro: no queda nada que compartir.',
    shareTitle: 'Lista de la compra',
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

  slots: { afternoon_snack: 'Merienda', breakfast: 'Desayuno', dinner: 'Cena', lunch: 'Comida', morning_snack: 'Almuerzo', supper: 'Recena' },

  targets: {
    activity: 'Actividad',
    activityValue: '{label} (×{factor})',
    allowedRange: 'Margen permitido',
    badgeEstimate: 'Estimación',
    badgeProfessional: 'Tu dietista',
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
    subtitleProfessional: 'Los ha ajustado {name}, tu dietista',
    title: 'Tus objetivos diarios',
    unknown: '—'
  },

  terms: {
    intro: [
      'Estas condiciones son el acuerdo entre tú y NutrIA. Al crear una cuenta o usar el servicio las aceptas.',
      'Lo más importante, primero: NutrIA te ayuda a planificar lo que comes. No es un servicio médico, no diagnostica ni trata nada, y no sustituye el consejo de un médico ni de un dietista-nutricionista colegiado.'
    ],
    sections: [
      {
        heading: 'Quién presta el servicio',
        paragraphs: [
          'NutrIA lo ofrece {name}, una persona física con residencia en España. Para cualquier cuestión sobre estas condiciones, escribe a {email}.'
        ]
      },
      {
        heading: 'Qué es NutrIA, y qué no es',
        paragraphs: [
          'NutrIA calcula unos objetivos nutricionales orientativos a partir de lo que nos cuentas y te propone planes de comidas de catorce días, con recetas, cantidades y lista de la compra.',
          'Los planes son generales y NutrIA no está pensada para nutrición clínica. Si tienes una enfermedad, estás embarazada o en periodo de lactancia, tomas medicación, o tienes o has tenido un trastorno de la conducta alimentaria, consulta a un profesional antes de seguir un plan, y enséñaselo.',
          'Los valores nutricionales son aproximados: se calculan a partir de tablas de composición de alimentos, y los alimentos reales varían.'
        ]
      },
      {
        heading: 'Alergias e intolerancias',
        paragraphs: [
          'Las alergias e intolerancias que declaras se comprueban en nuestro propio código contra los ingredientes de cada receta, y un plato con un alérgeno declarado no llega a tu plan. Esa comprobación trabaja sobre la receta, no sobre el producto que compras.',
          'Por eso, lee siempre la etiqueta de lo que compras: NutrIA no conoce las trazas, la contaminación cruzada ni los cambios de fórmula de un fabricante. Una alergia que escribas a mano y que no reconozcamos en nuestro catálogo no se puede comprobar de forma automática, y tu perfil te lo dice cuando ocurre. Si tienes una alergia grave, trata cada plan como una propuesta que revisar, no como una garantía.'
        ]
      },
      {
        heading: 'Tu cuenta',
        list: [
          'Necesitas tener al menos 18 años. Si la fecha de nacimiento que indicas es de alguien menor, no podremos crear tu perfil.',
          'Los datos que nos des deben ser tuyos y ciertos: los planes se calculan a partir de ellos.',
          'La cuenta es personal. Guarda tu contraseña y avísanos si crees que alguien ha entrado en tu cuenta.',
          'Mientras abrimos NutrIA poco a poco, puede que tu cuenta tenga que esperar a que la activemos.',
          'Puedes borrar tu cuenta cuando quieras desde tu perfil. Se borra todo lo que hay en ella, como explica la política de privacidad.'
        ],
        paragraphs: []
      },
      {
        heading: 'Contenido generado con inteligencia artificial',
        paragraphs: [
          'Las recetas y los planes se generan con ayuda de inteligencia artificial y se validan con nuestro propio código antes de mostrártelos. Aun así pueden contener errores: un tiempo de cocción, una cantidad, un paso poco claro. Usa tu criterio en la cocina, sobre todo con la seguridad alimentaria: cocina bien la carne, el pescado y los huevos, y respeta la cadena de frío.'
        ]
      },
      {
        heading: 'El plan gratuito y Premium',
        list: [
          'La primera vez que contratas Premium tienes una prueba gratuita, cuya duración se muestra antes de empezar: no se cobra nada hasta que acabe, y si cancelas antes no pagas nada.',
          'La suscripción se renueva sola al final de cada periodo hasta que la canceles.',
          'Puedes cancelarla cuando quieras desde tu perfil. Conservas Premium hasta el final del periodo ya pagado y no se te vuelve a cobrar.',
          'Tienes 14 días desde el primer cobro para desistir sin dar explicaciones: escríbenos y te devolvemos lo pagado.',
          'Si cambiamos el precio, te avisaremos con antelación y podrás cancelar antes de que se aplique.'
        ],
        paragraphs: [
          'NutrIA se puede usar gratis, con unos límites en los planes que puedes rehacer, las comidas que puedes cambiar y los eventos de cada plan. La seguridad alimentaria —alergias, intolerancias y nutrientes— es la misma con Premium y sin él.',
          'Premium, cuando está disponible, amplía esos límites con una suscripción mensual o anual. El precio se muestra, con impuestos, antes de pagar, y el pago lo gestiona Stripe.'
        ]
      },
      {
        heading: 'Uso aceptable',
        list: [
          'Acceder o intentar acceder a datos de otras personas.',
          'Extraer el contenido de forma automatizada, o revender los planes o las recetas.',
          'Usar el servicio de forma que lo degrade para los demás, por ejemplo generando planes de forma masiva o automatizada.',
          'Intentar saltarse los límites del plan gratuito o las medidas de seguridad.'
        ],
        paragraphs: ['NutrIA es para tu uso personal. Podemos suspender o cerrar una cuenta que haga alguna de estas cosas:']
      },
      {
        heading: 'Propiedad intelectual',
        paragraphs: [
          'La aplicación, su diseño y sus textos son de NutrIA. Los planes y las recetas que recibes son para tu uso personal: cocínalos, imprímelos, compártelos con quien comes. Lo que tú escribes —tu perfil, tus comentarios— sigue siendo tuyo; si nos envías una sugerencia, podemos usarla para mejorar el producto sin deberte nada por ello.'
        ]
      },
      {
        heading: 'Disponibilidad y cambios en el servicio',
        paragraphs: [
          'Hacemos lo posible por que NutrIA funcione siempre, pero no podemos garantizarlo: puede haber interrupciones, y las funciones pueden cambiar o desaparecer. Si algún día cerramos el servicio, avisaremos con tiempo para que puedas guardar lo que necesites, y devolveremos la parte no disfrutada de cualquier suscripción pagada.'
        ]
      },
      {
        heading: 'Si trabajas con un dietista',
        paragraphs: [
          'Un dietista-nutricionista puede invitarte a llevar tu plan en NutrIA con su ayuda. Si aceptas, podrá ver y ajustar tu plan como explica la invitación y la política de privacidad, y mientras el enlace dure tendrás los límites de Premium sin pagar nada.',
          'Tu dietista es un profesional independiente: su consejo y su relación contigo son cosa suya y tuya. NutrIA es la herramienta y no responde de sus decisiones clínicas, del mismo modo que tu dietista no responde de cómo funciona NutrIA.',
          'Puedes terminar el enlace cuando quieras. Al terminar, conservas tu cuenta, tu historial y tu último plan publicado, con los límites gratuitos.'
        ]
      },
      {
        heading: 'Responsabilidad',
        paragraphs: [
          'Respondemos de los daños que causemos por dolo o negligencia grave, y de todo aquello que la ley no permite excluir. No respondemos de las decisiones de salud que tomes a partir de un plan sin consultar a un profesional, ni de los productos que compres. Nada de esto limita los derechos que tienes como consumidor.',
          'Si usas NutrIA con un dietista, lo que te aconseje es responsabilidad suya como profesional; lo que haga NutrIA —cómo calcula, qué comprueba y qué te muestra— es responsabilidad nuestra.'
        ]
      },
      {
        heading: 'Cambios en estas condiciones',
        paragraphs: [
          'Si cambiamos algo importante, lo diremos aquí con la fecha de la actualización y te avisaremos por correo antes de que se aplique. Si no estás de acuerdo, puedes borrar tu cuenta; seguir usando NutrIA después del cambio significa que lo aceptas.'
        ]
      },
      {
        heading: 'Ley aplicable',
        paragraphs: [
          'Estas condiciones se rigen por la ley española. Si eres consumidor y vives en otro país, conservas la protección de las normas imperativas del país donde resides, y puedes reclamar ante los tribunales de tu domicilio.'
        ]
      }
    ],
    title: 'Condiciones de uso',
    updated: 'Última actualización: 25 de septiembre de 2026'
  },

  tour: {
    back: 'Atrás',
    closing: 'Puedes volver a ver esto cuando quieras desde tu perfil. Y si te falta algo, cuéntamelo ahí mismo.',
    done: 'Ya está',
    next: 'Siguiente',
    progress: '{step} de {of}',
    replayBody: 'Un repaso de lo que hace NutrIA, por si te lo saltaste o quieres verlo otra vez.',
    replayCta: 'Ver el tutorial',
    replayTitle: 'Cómo funciona NutrIA',
    skip: 'Saltar',
    stops: {
      checkIn: {
        body: 'Al terminar los catorce días te preguntamos el peso y cómo ha ido. Con eso se ajustan los objetivos del plan siguiente: es lo que hace que cada quincena se parezca más a ti.',
        cta: 'Ir al check-in',
        title: 'El check-in de cada quincena'
      },
      plan: {
        body: 'Cada catorce días NutrIA arma un plan completo con tus objetivos, tus alergias y lo que te gusta. No tienes que elegir nada: ya está hecho.',
        cta: 'Ver el plan',
        title: 'Tu quincena, ya planificada'
      },
      shape: {
        body: 'Si no desayunas, quítalo. Si cenas ligero, dilo. Las calorías del día se reparten entre las comidas que sí haces.',
        cta: 'Ajustar mis comidas',
        title: 'Di qué comidas haces y de qué tamaño'
      },
      swap: {
        body: 'Cada comida tiene un botón para cambiarla, y puedes pedir qué quieres a cambio: más rápida, sin cocinar, con más proteína o vegetariana. Tienes unos cuantos cambios por quincena.',
        cta: 'Ver el plan',
        title: '¿No te apetece un plato? Cámbialo'
      },
      trip: {
        body: 'Marca los días que estarás fuera y la quincena se pausa: los días que quedaban siguen ahí cuando vuelvas, no los pierdes.',
        cta: 'Marcar un viaje',
        title: 'Si te vas, el plan te espera'
      }
    }
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
  },
  vacations: {
    add: 'Pausar el plan',
    added: 'Viaje añadido. Tu plan se pausa esos días.',
    awayBody: 'Tu plan te espera. Retoma el {until}, justo donde lo dejaste.',
    awayNow: 'ahora mismo, {count} días',
    awayTitle: 'Estás de vacaciones',
    back: 'Ya estás de vuelta. Tu plan sigue desde hoy.',
    backEarly: 'He vuelto',
    backEarlyFor: 'He vuelto del viaje del {from} al {to}',
    cancel: 'Quitar',
    cancelFor: 'Quitar el viaje del {from} al {to}',
    days: '{count} días',
    from: 'Desde',
    intro: 'Marca los días que estarás fuera y el plan se pausa: esos días no cuentan como saltados y, al volver, sigue donde lo dejaste.',
    pausedUntil: 'Tu plan está en pausa · se reanuda el {date}',
    range: 'Del {from} al {to}',
    removed: 'Viaje quitado.',
    seePlan: 'Ver mi plan',
    title: 'Vacaciones',
    to: 'Hasta'
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
