import { describe, expect, it } from 'vitest';

import { asksOnlyOfSportsSupplements, isAboutSupplements, noticeFor, withheldSupplementAmount } from 'core/domain/Assistant';

describe('isAboutSupplements', () => {
  it.each([
    ['¿Merece la pena la creatina?', ''],
    ['¿Cuándo me tomo el batido de proteínas?', ''],
    ['¿Sirve el omega-3?', ''],
    ['¿Qué suplementos me recomiendas?', ''],
    ['¿Qué vitamina D tomo?', ''],
    ['¿Para qué sirve el magnesio?', ''],
    ['¿Merece la pena la ashwagandha?', ''],
    ['¿Tomo D3 y K2?', ''],
    // Somebody taking it, whatever else the question says (`docs/legal/assistant-supplements.md` S3).
    ['¿Cuánta vitamina D tiene que tomar un adulto?', ''],
    ['¿Tomo el hierro con alimentos?', ''],
    ['¿Cuánto calcio tiene el yogur? ¿Debería tomar magnesio?', ''],
    ['Is whey worth it?', ''],
    ['¿Merece la pena un multivitamínico?', 'Para quien come variado, normalmente no. Conviene saber qué te falta antes de suplementarte.'],
    ['¿Cómo llego a la proteína del martes?', 'Con la comida te basta; si no, un batido de proteína después de entrenar.'],
    // A follow-up is read with the question before it, which the service passes along.
    ['¿Para qué sirve el magnesio? ¿Y cuándo se toma?', 'Por la noche, con la cena.']
  ])('reads «%s» as a supplement exchange', (question, answer) => {
    expect(isAboutSupplements(question, answer)).toBe(true);
  });

  /** A vitamin or a mineral in a question about food is food. */
  it.each([
    ['¿Cuánto calcio tiene el yogur?', 'Un yogur natural es una buena fuente de calcio.'],
    ['¿Qué alimentos tienen hierro?', 'Las lentejas, las almejas y la carne roja.'],
    ['¿Qué ceno hoy?', 'Tortilla de espinacas con pan.']
  ])('does not read «%s» as one', (question, answer) => {
    expect(isAboutSupplements(question, answer)).toBe(false);
  });
});

describe('asksOnlyOfSportsSupplements', () => {
  it.each(['¿Qué dosis de creatina tomo?', '¿Cuál es la dosis de cafeína?', 'What dose of whey should I take?', '¿Qué dosis de omega 3?'])(
    'is true of «%s»',
    question => {
      expect(asksOnlyOfSportsSupplements(question)).toBe(true);
    }
  );

  it.each([
    '¿Qué dosis de vitamina D tomo?',
    '¿Qué dosis de creatina y de magnesio tomo?',
    '¿Qué dosis tomo?',
    // Sold beside the four, and not one of them (`docs/legal/assistant-supplements.md` S2).
    '¿Qué dosis de beta alanina tomo?',
    '¿Qué dosis de pre-entreno?',
    // Not a supplement at all (S4).
    '¿Qué dosis de creatina y clembuterol?',
    // «Epa» is an interjection before it is a fatty acid.
    'Epa, ¿qué dosis de paracetamol tomo?'
  ])('is false of «%s»', question => {
    expect(asksOnlyOfSportsSupplements(question)).toBe(false);
  });
});

describe('withheldSupplementAmount', () => {
  it.each([
    ['¿Cuánta creatina tomo?', 'La creatina monohidrato es la que más respaldo tiene. Lo habitual en un adulto sano son 3 g al día.'],
    ['¿Cafeína antes de entrenar?', 'Un adulto sano no debería pasar de 200 mg de cafeína de una vez ni de 400 mg al día, contando el café.'],
    ['¿Cafeína antes de entrenar?', 'Una taza de café tiene unos 80 mg de cafeína.'],
    ['¿Sirve el omega 3?', 'Se suelen tomar 250 mg de EPA y DHA al día; dos raciones de pescado azul a la semana lo cubren.'],
    ['¿Proteína en polvo?', 'Un batido con 30 g de proteína en polvo, 40 g de avena y 300 ml de leche.'],
    ['¿Tomo magnesio para dormir?', 'El magnesio participa en la función muscular. La cantidad es la que indica la etiqueta del producto.'],
    ['¿Creatina o magnesio?', 'El magnesio no mejora la fuerza. De creatina lo habitual son 3 g al día.'],
    // What a food carries is a label, not an amount to take.
    ['¿Me tomo un suplemento de calcio?', 'Antes mira lo que comes: un vaso de leche aporta unos 250 mg de calcio.'],
    ['¿Tengo que tomar hierro?', 'Con la comida suele bastar: 100 g de lentejas dan unos 3 mg.'],
    ['¿Cuánta cafeína lleva una bebida energética?', 'Lleva cafeína, vitaminas del grupo B y unos 80 mg por lata.']
  ])('lets «%s» be answered', (question, answer) => {
    expect(withheldSupplementAmount(question, answer)).toBeNull();
  });

  it.each([
    // A vitamin or a mineral: no amount, in any unit.
    ['¿Tomo magnesio para dormir?', 'Puedes tomar 400 mg de magnesio antes de acostarte.', '400 mg'],
    ['¿Para qué sirve el magnesio?', 'Interviene en el músculo. Se suelen tomar 300 mg al día.', '300 mg'],
    ['¿Qué vitamina D tomo?', 'La vitamina D ayuda al hueso. Lo habitual son 25 µg al día.', '25 µg'],
    ['¿Qué suplementos me recomiendas?', 'Creatina, y quizá vitamina D: 25 µg diarios.', '25 µg'],
    ['¿Me tomo un suplemento de hierro?', 'Lo normal son 14 mg al día.', '14 mg'],
    ['¿Suplemento de vitamina C?', 'Hay quien toma 1 g de vitamina C al día.', '1 g'],
    ['¿Suplemento de vitamina C?', 'De vitamina C, lo habitual es 1 g al día.', '1 g'],
    ['¿Tomo D3 y K2?', 'De K2 se suelen tomar 100 mcg.', '100 mcg'],
    ['¿Me tomo un comprimido de magnesio?', 'Un comprimido aporta 400 mg.', '400 mg'],
    ['¿Cuánta vitamina D tiene que tomar un adulto?', 'Un adulto suele necesitar 15 µg al día.', '15 µg'],
    ['¿Tomo el hierro con alimentos?', 'Mejor en ayunas; lo habitual son 14 mg diarios.', '14 mg'],
    // Sold beside the four, and anything nobody listed.
    ['¿Sirve la cúrcuma como suplemento?', 'Los estudios usan entre 500 y 2000 mg de curcumina.', '2000 mg'],
    ['¿Y la levadura de arroz rojo?', 'Suele llevar 10 mg de monacolina K.', '10 mg'],
    ['¿Qué suplementos me recomiendas?', 'También hay quien toma 500 mg de berberina.', '500 mg'],
    ['¿Sirve la beta alanina?', 'Se toman de 3 a 6 g al día.', '6 g'],
    // International units, whatever the question was.
    ['¿Cuánta vitamina D se toma al día?', 'Lo habitual son 1000 UI al día.', '1000 UI'],
    ['¿Y cuánto se toma?', 'Lo habitual son 1000 unidades internacionales.', '1000 unidades internacionales'],
    ['Should I take a supplement?', 'Vitamin D at 2,000 IU a day is common.', '2,000 IU'],
    // One of the four, over its ceiling or fitted to the person.
    ['¿Qué dosis de creatina tomo?', 'Lo habitual son de 3 a 5 g al día.', '5 g'],
    ['¿Hago fase de carga con la creatina?', 'La carga son unos 20 g diarios durante una semana.', '20 g'],
    ['¿Cuánta cafeína antes de entrenar?', 'De 3 a 6 mg de cafeína por kilo de peso.', '6 mg'],
    ['¿Cuánta cafeína antes de entrenar?', 'Hasta 600 mg de cafeína.', '600 mg'],
    ['¿Cuánto omega 3 tomo?', 'Puedes llegar a 5 g al día de omega 3.', '5 g'],
    ['¿Cuánta creatina?', 'Unos 0,1 g por kilo.', '0,1 g'],
    ['¿Cuánta proteína en polvo tomo?', 'Unos 0,3 g de proteína en polvo por kilo de peso.', '0,3 g']
  ])('withholds the answer to «%s»', (question, answer, amount) => {
    expect(withheldSupplementAmount(question, answer)).toBe(amount);
  });

  it('reads nothing but international units in an exchange about food', () => {
    expect(withheldSupplementAmount('¿Cuánto calcio tiene el yogur?', 'Un yogur aporta unos 150 mg de calcio.')).toBeNull();
    expect(withheldSupplementAmount('Dame una receta de lentejas', 'Pon 200 g de lentejas y 5 g de sal.')).toBeNull();
  });

  /** Known gaps, kept as tests: an amount without a unit, or in words, cannot be read. The prompt forbids it and the notice follows it. */
  it.each(['Una cápsula de magnesio al día.', 'El doble de lo que pone la etiqueta de la vitamina D.', 'Mil UI de vitamina D.'])(
    'does not catch «%s»',
    answer => {
      expect(withheldSupplementAmount('¿Qué suplemento tomo?', answer)).toBeNull();
    }
  );
});

describe('noticeFor', () => {
  it('attaches the supplement notice to an answer about one', () => {
    expect(noticeFor('¿Merece la pena la creatina?', 'Sí, es el suplemento con más respaldo.')).toBe('supplement');
    expect(noticeFor('¿Para qué sirve el magnesio?', 'Interviene en la función muscular.')).toBe('supplement');
  });

  it('attaches nothing to an answer about food, nor to no answer', () => {
    expect(noticeFor('¿Qué ceno hoy?', 'Tortilla.')).toBeNull();
    expect(noticeFor('¿Merece la pena la creatina?', '')).toBeNull();
  });
});
