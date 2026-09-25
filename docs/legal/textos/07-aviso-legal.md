# Aviso legal (página nueva)

> **No soy abogado.** Borrador para el producto.
>
> **Propósito**: la información general que exige el art. 10 LSSI y los datos de
> identidad que el art. 97.1.b-c TRLGDCU pide antes de vender a un consumidor.
> **Audiencia**: `frontend`, el propietario, el abogado. **Committed**: sí. **Mantenido
> por**: el agente `legal`.
>
> **Dónde va**: ruta pública nueva `/aviso-legal` (en inglés `/en/legal-notice`, como las
> otras páginas públicas, `0040`), namespace `legalNotice` con la forma de `terms`, enlace
> en el pie (`footer.legalNotice`: `Aviso legal` / `Legal notice`) junto a Privacidad y
> Condiciones.
>
> **Marcadores nuevos en `apps/web/src/i18n/legalIdentity.ts`** — el único archivo que
> puede llevar identidad, y **se publica**: `address`, `taxId`, `phone`. El propietario
> decide qué domicilio pone (su casa quedaría pública en un repositorio abierto; un
> domicilio profesional o de domiciliación es una alternativa **[abogado]**) y los
> rellena él, no un agente. Hasta que existan no se pueden poner las claves *live* de
> Stripe (P1-7). Con *Managed Payments*, Link es el vendedor ante el consumidor; aun así el
> art. 10 LSSI obliga al prestador del servicio, que es el propietario.

---

## Español

**title**: Aviso legal

**sections**:

1. **Titular**
   - `NutrIA es un servicio de {name}.`
   - `Domicilio: {address}.`
   - `NIF: {taxId}.`
   - `Correo: {email}. Teléfono: {phone}.`
   <!-- Fuente: LSSI art. 10.1.a («nombre…; su residencia o domicilio…; su dirección de correo electrónico y cualquier otro dato que permita establecer con él una comunicación directa y efectiva») y 10.1.e (NIF); TRLGDCU art. 97.1.b-c («dirección completa…, número de teléfono y dirección de correo electrónico»). -->
2. **Registros y autorizaciones**
   - `NutrIA no está inscrito en ningún registro mercantil ni necesita autorización administrativa previa.`
   <!-- Fuente: LSSI art. 10.1.b-c. Cambiar si el propietario constituye una sociedad. -->
3. **Profesión regulada**
   - `El titular no presta servicios sanitarios. Los dietistas-nutricionistas que usan NutrIA con sus pacientes son profesionales independientes, sujetos a su propia colegiación y normas deontológicas.`
   <!-- Fuente: LSSI art. 10.1.d (solo si el prestador ejerce una profesión regulada: no es el caso); Ley 44/2003. -->
4. **Precios**
   - `Los precios de Premium y de los planes de consulta se muestran, con impuestos, antes de pagar.`
   <!-- Fuente: LSSI art. 10.1.f. -->
5. **Resolución de conflictos**
   - `Si tienes una queja o reclamación, puedes presentarla por correo electrónico a {email}, por teléfono en el {phone} o por carta a {address}. Te daremos un número de reclamación y un justificante por escrito, y te responderemos en quince días como máximo. Si eres consumidor, también puedes acudir a la oficina de consumo de tu municipio o comunidad autónoma, o a los tribunales de tu domicilio.`
   <!-- Fuente: TRLGDCU art. 21.2 («clave identificativa y un justificante por escrito») y 21.3 (vía postal, telefónica y electrónica; respuesta «en el plazo máximo de quince días»); art. 97.1.u. La plataforma europea de resolución de litigios en línea se suprimió (Reglamento (UE) 2024/3228, con efecto el 20/07/2025): ya no se enlaza. -->
6. **Documentos**
   - `Condiciones de uso · Condiciones del plan de consulta · Política de privacidad` (enlaces)

---

## English

**title**: Legal notice

1. **Provider**: `NutrIA is a service of {name}.` / `Address: {address}.` / `Tax ID: {taxId}.` / `Email: {email}. Phone: {phone}.`
2. **Registers and authorisations**: `NutrIA is not entered in any commercial register and needs no prior administrative authorisation.`
3. **Regulated profession**: `The provider does not deliver health services. The dietitian-nutritionists who use NutrIA with their clients are independent professionals, subject to their own professional registration and codes of conduct.`
4. **Prices**: `Prices for Premium and practice plans are shown, including tax, before you pay.`
5. **Complaints**: `You can make a complaint by email to {email}, by phone on {phone} or by post to {address}. We will give you a complaint number and a written receipt, and answer within fifteen days at most. If you are a consumer, you can also go to your local or regional consumer office, or to the courts where you live.`
6. **Documents**: `Terms of use · Practice plan terms · Privacy policy` (links)
