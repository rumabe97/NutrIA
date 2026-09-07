import { Fragment } from 'react';

import styles from './page.module.css';

import { Accordion, AccordionItem } from 'ui/components/Accordion';
import { Text } from 'ui/components/Text';

import { CtaLink } from 'components/CtaLink';
import { Reveal } from 'components/Reveal';
import { SiteFooter } from 'components/SiteFooter';
import { SiteHeader } from 'components/SiteHeader';

const STEPS = [
  { body: 'Objetivo, horarios, alergias, presupuesto y lo que no piensas cocinar un martes.', title: 'Nos cuentas cómo vives' },
  { body: 'Calculamos tus necesidades y construimos catorce días completos, comida a comida.', title: 'Creamos tu plan' },
  { body: 'Marca lo que comes, cambia lo que no te apetece, compra con una lista ya hecha.', title: 'Lo sigues a tu ritmo' },
  { body: 'Cada dos semanas revisamos qué funcionó y el siguiente plan llega mejor ajustado.', title: 'Se adapta' }
] as const;

const FEATURES = [
  { body: 'Catorce días completos con recetas, cantidades y tiempos. Sin decidir qué cenar a las nueve.', title: 'Planes de catorce días' },
  { body: '¿No te apetece? Pide algo más rápido, más barato, sin cocinar o con más proteína. Se recalcula al momento.', title: 'Cambia cualquier comida' },
  { body: 'Una lista por plan, agrupada por pasillo y con las cantidades ya sumadas. Tres tomates sueltos son 450 g.', title: 'Lista de la compra automática' },
  { body: 'Peso, adherencia, energía y hambre. Solo las tendencias que significan algo, sin convertirlo en un examen.', title: 'Progreso sin obsesión' },
  { body: 'Tus alergias e intolerancias se aplican como filtro del sistema, no como una instrucción a un modelo.', title: 'Alergias como límite duro' },
  { body: 'Pregunta por una sustitución, por qué elegimos un plato o qué comprar mañana. Conoce tu plan.', title: 'Asistente de nutrición' }
] as const;

const SAFETY = [
  { body: 'Las alergias e intolerancias las aplica código determinista sobre un catálogo de ingredientes, antes de que un plato se guarde o se muestre.', title: 'La IA no decide sobre tu seguridad' },
  { body: 'Las calorías y los macros salen de tablas de composición y de tu perfil, con un mínimo diario que ningún objetivo puede saltarse.', title: 'Los números no se improvisan' },
  { body: 'NutrIA planifica comidas. No diagnostica, no receta y no sustituye a un profesional sanitario.', title: 'Sabemos dónde está el límite' }
] as const;

const FAQ = [
  { answer: 'Catorce días. Es tiempo suficiente para que un cambio se note y lo bastante corto para corregir el rumbo antes de que te canses.', question: '¿Por qué catorce días?' },
  { answer: 'Sí. Puedes cambiar cualquier comida por otra que respete tus restricciones y encaje en tus objetivos del día. El plan se reajusta solo.', question: '¿Puedo cambiar una comida que no me gusta?' },
  { answer: 'Se excluyen del catálogo por completo. Si además te afectan las trazas, también descartamos los ingredientes marcados como "puede contener".', question: '¿Cómo tratáis las alergias?' },
  { answer: 'No. NutrIA es una herramienta de planificación alimentaria. Si tienes una condición médica, estás embarazada o tomas medicación, consulta a un profesional sanitario.', question: '¿Esto sustituye a un dietista o a mi médico?' },
  { answer: 'Todos. Los planes anteriores quedan guardados con sus recetas, sus listas y tus comentarios, y puedes consultarlos cuando quieras.', question: '¿Qué pasa con mis planes anteriores?' },
  { answer: 'Puedes borrar tu cuenta cuando quieras desde los ajustes. Se elimina todo: perfil, planes, progreso y conversaciones.', question: '¿Puedo borrar mis datos?' }
] as const;

const PREVIEW_MEALS = [
  { kcal: '410 kcal', name: 'Bol de yogur griego con fruta y avena', slot: 'Desayuno' },
  { kcal: '620 kcal', name: 'Arroz con pollo, pimiento y brócoli', slot: 'Comida' },
  { kcal: '180 kcal', name: 'Manzana y un puñado de almendras', slot: 'Merienda' },
  { kcal: '540 kcal', name: 'Merluza al horno con patata y ensalada', slot: 'Cena' }
] as const;

export default function LandingPage() {
  return (
    <Fragment>
      <SiteHeader />

      <main className={styles.main}>
        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <section className={styles.hero}>
          <Reveal>
            <span className={styles.eyebrow}>Un plan nuevo cada dos semanas</span>
            <h1 className={styles.display}>Nutrición que se adapta a ti.</h1>
            <Text className={styles.lede} tone="secondary">
              Planes de alimentación personalizados, construidos alrededor de tus objetivos, tus preferencias y tu vida. Y ajustados cada dos semanas según lo
              que de verdad te funciona.
            </Text>

            <div className={styles.heroActions}>
              <CtaLink href="/registro" size="lg">
                Crear mi plan
              </CtaLink>
              <CtaLink href="#como-funciona" size="lg" variant="secondary">
                Cómo funciona
              </CtaLink>
            </div>

            <Text className={styles.heroNote} size="sm" tone="tertiary">
              Sin tarjeta. Tu plan estará listo en cuanto termines el cuestionario.
            </Text>
          </Reveal>

          {/* A static illustration of the product, deliberately: it is the plan
              screen's real structure and copy, not a stock dashboard. */}
          <Reveal className={styles.preview} delay={120}>
            <div className={styles.previewBar}>
              <Text size="sm" weight="medium">
                Día 6 de 14
              </Text>
              <Text size="sm" tone="tertiary">
                1.750 kcal · 130 g proteína
              </Text>
            </div>

            <div className={styles.previewBody}>
              {PREVIEW_MEALS.map(meal => (
                <div className={styles.mealRow} key={meal.slot}>
                  <Text size="sm" tone="tertiary">
                    {meal.slot}
                  </Text>
                  <Text size="sm">{meal.name}</Text>
                  <Text size="sm" tone="tertiary">
                    {meal.kcal}
                  </Text>
                </div>
              ))}
            </div>

            <div className={styles.previewStats}>
              {[
                { label: 'Adherencia', value: '72 %' },
                { label: 'Próxima revisión', value: 'En 8 días' },
                { label: 'Lista de la compra', value: '18 / 24' }
              ].map(stat => (
                <div key={stat.label}>
                  <Text size="lg" weight="semibold">
                    {stat.value}
                  </Text>
                  <Text size="xs" tone="tertiary">
                    {stat.label}
                  </Text>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ── How it works ─────────────────────────────────────────────── */}
        <section className={styles.section} id="como-funciona">
          <Reveal>
            <h2 className={styles.headline}>Cuatro pasos. Después, se repite solo.</h2>
            <Text className={styles.sectionLede} tone="secondary">
              El trabajo de planificar lo hacemos nosotros. Tú decides qué comer entre lo que ya encaja.
            </Text>
          </Reveal>

          <div className={styles.steps}>
            {STEPS.map((step, index) => (
              <Reveal className={styles.step} delay={index * 80} key={step.title}>
                <Text size="md" weight="semibold">
                  {step.title}
                </Text>
                <Text size="sm" tone="secondary">
                  {step.body}
                </Text>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Personalisation ──────────────────────────────────────────── */}
        <section className={styles.section} id="personalizacion">
          <Reveal>
            <h2 className={styles.headline}>Tu plan sabe que los martes llegas tarde.</h2>
            <Text className={styles.sectionLede} tone="secondary">
              Objetivo, edad, actividad, horarios, presupuesto, cocina que te gusta, alimentos que no piensas volver a ver. Todo entra en el cálculo, y todo se
              puede cambiar después.
            </Text>
          </Reveal>

          <div className={styles.features}>
            {FEATURES.map((feature, index) => (
              <Reveal className={styles.feature} delay={index * 60} key={feature.title}>
                <Text className={styles.featureTitle} weight="semibold">
                  {feature.title}
                </Text>
                <Text size="sm" tone="secondary">
                  {feature.body}
                </Text>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── Safety ───────────────────────────────────────────────────── */}
        <section id="seguridad">
          <div className={styles.safety}>
            <div className={styles.safetyInner}>
              <Reveal>
                <h2 className={styles.headline}>Lo importante no lo decide un modelo.</h2>
                <Text className={styles.sectionLede} tone="secondary">
                  La IA propone comidas. Lo que puede hacerte daño lo comprueba el sistema.
                </Text>
              </Reveal>

              <div className={styles.safetyGrid}>
                {SAFETY.map((item, index) => (
                  <Reveal className={styles.safetyItem} delay={index * 80} key={item.title}>
                    <Text weight="semibold">{item.title}</Text>
                    <Text size="sm" tone="secondary">
                      {item.body}
                    </Text>
                  </Reveal>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className={styles.section} id="preguntas">
          <Reveal>
            <h2 className={styles.headline}>Preguntas frecuentes</h2>
          </Reveal>

          <Reveal className={styles.faq}>
            <Accordion collapsible={true} type="single">
              {FAQ.map(item => (
                <AccordionItem key={item.question} trigger={item.question} value={item.question}>
                  {item.answer}
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </section>

        {/* ── Final CTA ────────────────────────────────────────────────── */}
        <section className={styles.finalCta}>
          <Reveal>
            <h2 className={styles.headline} style={{ marginInline: 'auto' }}>
              Deja de decidir qué cenar.
            </h2>
            <Text className={styles.lede} tone="secondary">
              Cuéntanos cómo vives y tendrás catorce días resueltos, con la lista de la compra hecha.
            </Text>
            <div className={styles.heroActions}>
              <CtaLink href="/registro" size="lg">
                Crear mi plan
              </CtaLink>
            </div>
          </Reveal>
        </section>
      </main>

      <SiteFooter />
    </Fragment>
  );
}
