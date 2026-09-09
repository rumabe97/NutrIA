/**
 * What to reach for when the shop does not have it.
 *
 * Pairs are **catalogue rows**, never free text, so every alternative carries
 * the substitute's own allergen links and macros — the same rows the dish was
 * checked against — and can be filtered per person in code before it is shown
 * (`core/domain/Substitution`). A swap the model invented would have neither.
 *
 * Two shapes. A **group** is a family whose members stand in for each other at
 * the same weight: one legume for another, one white fish for another. An
 * **extra** is one-way, for the cases a group would get wrong — butter can become
 * olive oil, but a dish written around olive oil is not improved by butter; cow's
 * milk can become oat milk, but a dish written dairy-free must never be offered
 * milk. The rule the seed test enforces: **a swap never introduces a class of food
 * the dish did not already have** — no meat, fish, shellfish, pork, dairy, egg or
 * any animal product into a dish that had none. That is what keeps a vegetarian's,
 * a pescatarian's or a halal plan intact without the code knowing their pattern.
 *
 * Staples get no alternatives on purpose: salt, olive oil, onion, garlic, tomato,
 * eggs, the spices. Every shop has them, and a line of "or instead" under each
 * would bury the swaps that matter. The `ratio` scales the weight — `2` means
 * twice as much of the substitute.
 */

export type SubstitutionGroup = {
  readonly members: readonly string[];
  readonly name: string;
};

export type SubstitutionExtra = {
  readonly from: string;
  readonly ratio?: number;
  readonly to: string;
};

export type SubstitutionPair = {
  readonly ingredient: string;
  readonly ratio: number;
  readonly substitute: string;
};

export const SUBSTITUTION_GROUPS: readonly SubstitutionGroup[] = [
  // ── Pulses and plant proteins ─────────────────────────────────────────
  { members: ['lentejas-cocidas', 'garbanzos-cocidos', 'alubias-blancas-cocidas', 'alubias-pintas-cocidas', 'lentejas-rojas-cocidas', 'judias-rojas-cocidas', 'alubias-negras-cocidas', 'soja-cocida'], name: 'legumbres cocidas' },
  { members: ['lentejas-secas', 'garbanzos-secos', 'alubias-blancas-secas', 'alubias-pintas-secas', 'judiones', 'azukis', 'judia-mungo', 'guisantes-secos-partidos', 'habas-secas'], name: 'legumbres secas' },
  { members: ['seitan', 'tofu-firme', 'tempeh', 'soja-texturizada', 'heura', 'tofu-ahumado'], name: 'proteína vegetal' },
  { members: ['hamburguesa-vegetal', 'salchichas-vegetales', 'nuggets-vegetales'], name: 'vegetal preparado' },
  // ── Fish ──────────────────────────────────────────────────────────────
  { members: ['merluza', 'filete-de-merluza-congelado', 'bacalao-desalado', 'bacalao-fresco', 'bacalao-congelado', 'dorada', 'lubina', 'rape', 'mero', 'rodaballo', 'lenguado', 'gallo', 'pescadilla', 'rosada', 'tilapia', 'perca', 'corvina', 'besugo', 'abadejo', 'fletan', 'raya', 'congrio', 'bacaladilla', 'filete-de-panga-congelado'], name: 'pescado blanco' },
  { members: ['salmon', 'salmon-congelado', 'sardina', 'caballa', 'jurel', 'boquerones', 'atun-fresco', 'bonito', 'pez-espada', 'trucha', 'salmonete', 'palometa'], name: 'pescado azul' },
  { members: ['merluza', 'filete-de-merluza-congelado', 'bacalao-desalado', 'dorada', 'lubina', 'salmon', 'sardina'], name: 'pescado' },
  { members: ['atun-al-natural', 'atun-en-aceite', 'ventresca-de-atun', 'sardinas-en-aceite', 'caballa-en-conserva', 'melva-en-conserva', 'atun-en-escabeche'], name: 'conserva de pescado' },
  { members: ['salmon-ahumado', 'trucha-ahumada', 'bacalao-ahumado'], name: 'ahumado' },
  // ── Shellfish ─────────────────────────────────────────────────────────
  { members: ['gambas', 'langostinos', 'gambon', 'cigalas', 'gambas-peladas-congeladas', 'langostinos-congelados'], name: 'gambas' },
  { members: ['calamar', 'sepia', 'chipirones', 'pulpo-cocido', 'pulpo-fresco', 'pulpo-congelado', 'anillas-de-calamar-congeladas', 'sepia-congelada'], name: 'cefalópodos' },
  { members: ['mejillon', 'almeja', 'berberechos', 'navajas', 'vieiras', 'zamburinas', 'mejillones-congelados', 'almejas-al-natural', 'berberechos-al-natural', 'navajas-al-natural'], name: 'bivalvos' },
  { members: ['gambas', 'calamar', 'mejillon', 'almeja', 'pulpo-cocido'], name: 'marisco' },
  // ── Meat, no pork ─────────────────────────────────────────────────────
  { members: ['ternera-magra', 'solomillo-de-ternera', 'entrecot-de-ternera', 'chuleton-de-ternera', 'filete-de-ternera', 'redondo-de-ternera'], name: 'ternera para plancha' },
  { members: ['morcillo-de-ternera', 'ternera-para-guisar', 'carrillera-de-ternera', 'falda-de-ternera', 'costilla-de-ternera', 'rabo-de-toro'], name: 'ternera para guisar' },
  { members: ['carne-picada-de-ternera', 'pollo-picado', 'pavo-picado', 'cordero-picado'], name: 'carne picada' },
  { members: ['pierna-de-cordero', 'paletilla-de-cordero', 'chuletas-de-cordero', 'cabrito'], name: 'cordero' },
  { members: ['pechuga-de-pollo', 'muslo-de-pollo', 'pavo', 'conejo', 'contramuslo-de-pollo', 'pechuga-de-pavo', 'muslo-de-pavo', 'codorniz', 'perdiz'], name: 'carne blanca' },
  { members: ['magret-de-pato', 'confit-de-pato'], name: 'pato' },
  { members: ['fiambre-de-pollo', 'fiambre-de-pavo'], name: 'fiambre de ave' },
  { members: ['lasana-preparada', 'canelones-preparados'], name: 'pasta rellena preparada' },
  // ── Pork ──────────────────────────────────────────────────────────────
  { members: ['lomo-de-cerdo', 'solomillo-de-cerdo', 'chuleta-de-cerdo', 'secreto-de-cerdo', 'presa-iberica'], name: 'cerdo para plancha' },
  { members: ['costillas-de-cerdo', 'carrillera-de-cerdo', 'codillo-de-cerdo'], name: 'cerdo para guisar' },
  { members: ['chorizo', 'salchichon', 'fuet', 'lomo-embuchado', 'jamon-serrano', 'jamon-iberico'], name: 'embutido curado' },
  { members: ['jamon-serrano', 'jamon-cocido', 'jamon-iberico', 'lacon'], name: 'jamón' },
  { members: ['panceta', 'bacon'], name: 'panceta' },
  { members: ['carne-picada-de-cerdo', 'carne-picada-mixta'], name: 'picada de cerdo' },
  { members: ['san-jacobos-congelados', 'flamenquines-congelados'], name: 'rebozado de cerdo' },
  { members: ['fabada-en-lata', 'cocido-madrileno-en-lata', 'lentejas-con-chorizo-en-lata', 'callos-en-lata'], name: 'guiso en lata' },
  // ── Eggs ──────────────────────────────────────────────────────────────
  { members: ['huevo', 'huevo-de-codorniz'], name: 'huevo' },
  // ── Dairy ─────────────────────────────────────────────────────────────
  { members: ['leche-entera', 'leche-semidesnatada', 'leche-desnatada', 'leche-sin-lactosa', 'leche-de-cabra', 'leche-de-oveja'], name: 'leche' },
  { members: ['yogur-griego-natural', 'yogur-natural-desnatado', 'kefir', 'skyr', 'queso-batido-desnatado', 'yogur-proteico'], name: 'yogur' },
  { members: ['queso-de-burgos', 'queso-cottage', 'requeson', 'queso-fresco-de-cabra', 'queso-mozzarella', 'queso-feta', 'ricotta', 'mozzarella-fresca', 'burrata', 'queso-tierno', 'rulo-de-cabra'], name: 'queso fresco' },
  { members: ['queso-curado', 'queso-parmesano', 'queso-manchego-semicurado', 'queso-de-oveja-curado', 'queso-idiazabal', 'queso-pecorino', 'queso-cheddar', 'queso-gouda', 'queso-emmental', 'queso-gruyere', 'queso-provolone', 'queso-edam', 'queso-havarti', 'queso-raclette', 'queso-scamorza', 'queso-de-mahon', 'queso-de-cabra-curado', 'queso-rallado', 'queso-en-lonchas', 'queso-de-tetilla', 'queso-de-arzua'], name: 'queso curado' },
  { members: ['queso-azul', 'queso-cabrales'], name: 'queso azul' },
  { members: ['queso-brie', 'queso-camembert', 'queso-de-la-serena'], name: 'queso blando' },
  { members: ['queso-crema', 'queso-de-untar-light', 'mascarpone', 'queso-fundido'], name: 'queso cremoso' },
  { members: ['nata-para-cocinar', 'nata-para-montar', 'nata-ligera', 'crema-agria'], name: 'nata' },
  { members: ['mantequilla', 'mantequilla-sin-sal', 'ghee'], name: 'mantequilla' },
  { members: ['salsa-de-yogur', 'tzatziki'], name: 'salsa de yogur' },
  { members: ['arroz-con-leche', 'cuajada', 'petit-suisse', 'yogur-de-sabores'], name: 'postre lácteo' },
  { members: ['natillas', 'flan-de-huevo', 'crema-catalana', 'mousse-de-chocolate', 'tiramisu'], name: 'postre lácteo con huevo' },
  { members: ['helado-de-vainilla', 'helado-de-chocolate', 'helado-de-fresa', 'yogur-helado'], name: 'helado' },
  { members: ['croissant', 'magdalena', 'brioche', 'pan-de-leche', 'donut', 'napolitana-de-chocolate', 'bizcocho', 'sobaos'], name: 'bollería' },
  { members: ['galletas-de-mantequilla', 'cookies-de-chocolate'], name: 'galletas de mantequilla' },
  { members: ['pizza-margarita-congelada', 'pizza-cuatro-quesos-congelada', 'pizza-fresca-refrigerada'], name: 'pizza' },
  { members: ['raviolis-frescos', 'tortellini'], name: 'pasta rellena' },
  { members: ['pesto-genovese', 'pesto-rojo'], name: 'pesto' },
  { members: ['chocolate-con-leche', 'chocolate-blanco', 'chocolate-con-almendras', 'bombones'], name: 'chocolate con leche' },
  { members: ['batido-de-cacao', 'batido-de-fresa'], name: 'batido' },
  // ── Egg-based sauces ──────────────────────────────────────────────────
  { members: ['salsa-alioli', 'mayonesa', 'salsa-tartara'], name: 'salsa cremosa' },
  // ── Plant milks and creams ────────────────────────────────────────────
  { members: ['leche-de-almendra', 'leche-de-avena', 'leche-de-soja', 'bebida-de-arroz', 'bebida-de-coco', 'bebida-de-avellanas', 'bebida-de-anacardos'], name: 'bebida vegetal' },
  { members: ['nata-vegetal-de-soja', 'nata-vegetal-de-avena', 'leche-de-coco', 'leche-de-coco-ligera'], name: 'nata vegetal' },
  { members: ['yogur-de-soja', 'yogur-de-coco'], name: 'yogur vegetal' },
  // ── Grains, pasta, flours, bread ──────────────────────────────────────
  { members: ['arroz-bomba-crudo', 'arroz-largo-crudo', 'arroz-basmati-crudo', 'arroz-jazmin-crudo', 'arroz-vaporizado', 'arroz-integral-crudo', 'arroz-para-sushi', 'arroz-salvaje-crudo', 'arroz-negro-crudo'], name: 'arroz crudo' },
  { members: ['quinoa-cruda', 'bulgur-crudo', 'cuscus-crudo', 'mijo', 'trigo-sarraceno', 'amaranto', 'cebada-perlada', 'espelta-en-grano', 'freekeh'], name: 'grano crudo' },
  { members: ['arroz-blanco-cocido', 'arroz-basmati-cocido', 'arroz-integral-cocido', 'quinoa-cocida', 'bulgur-cocido', 'cuscus-cocido', 'mijo-cocido', 'trigo-sarraceno-cocido', 'cebada-cocida', 'espelta-cocida', 'arroz-salvaje-cocido'], name: 'cereal cocido' },
  { members: ['espaguetis-secos', 'macarrones-secos', 'pasta-integral-seca', 'fideos-finos', 'pasta-sin-gluten', 'pasta-de-lentejas', 'pasta-de-garbanzos'], name: 'pasta seca' },
  { members: ['pasta-cocida', 'pasta-integral-cocida', 'fideos-de-arroz-cocidos'], name: 'pasta' },
  { members: ['noodles-de-trigo', 'noodles-udon', 'fideos-soba', 'fideos-de-arroz-secos', 'fideos-de-cristal'], name: 'noodles' },
  { members: ['harina-de-trigo', 'harina-de-avena', 'harina-integral', 'harina-de-espelta', 'harina-de-fuerza'], name: 'harina' },
  { members: ['harina-de-arroz', 'harina-de-maiz', 'harina-de-garbanzo', 'harina-de-trigo-sarraceno'], name: 'harina sin gluten' },
  { members: ['maicena', 'fecula-de-patata', 'tapioca'], name: 'espesante' },
  { members: ['pan-rallado', 'panko', 'pan-rallado-sin-gluten'], name: 'pan rallado' },
  { members: ['pan-blanco', 'pan-integral', 'pan-de-centeno', 'pan-de-molde', 'hogaza-de-pan', 'baguette', 'chapata', 'pan-de-espelta', 'pan-de-semillas', 'pan-de-masa-madre', 'pan-de-cristal', 'panecillos', 'mollete', 'pan-sin-gluten', 'pan-de-molde-integral'], name: 'pan' },
  { members: ['pan-de-pita', 'pan-naan', 'tortilla-de-trigo', 'wrap-integral', 'tortilla-de-maiz', 'pan-bao'], name: 'pan plano' },
  { members: ['pan-de-hamburguesa', 'pan-de-hamburguesa-integral', 'pan-de-perrito'], name: 'bollo de pan' },
  { members: ['pan-tostado', 'tostas-de-centeno', 'picos-de-pan', 'regana', 'crackers', 'tortitas-de-arroz', 'tortitas-de-maiz'], name: 'pan tostado' },
  { members: ['masa-de-pizza', 'base-de-pizza-fresca'], name: 'masa de pizza' },
  { members: ['galletas-maria', 'galletas-de-avena', 'galletas-digestive', 'galletas-sin-gluten'], name: 'galletas' },
  { members: ['copos-de-maiz', 'muesli', 'granola', 'cereales-integrales', 'cereales-de-chocolate'], name: 'cereal de desayuno' },
  { members: ['copos-de-avena', 'copos-de-espelta', 'copos-de-centeno'], name: 'copos' },
  // ── Nuts, seeds, dried fruit ──────────────────────────────────────────
  { members: ['almendras', 'avellanas', 'nueces', 'anacardos', 'pistachos', 'cacahuetes', 'nueces-pecanas', 'nueces-de-macadamia', 'nueces-de-brasil', 'pinones', 'mix-de-frutos-secos'], name: 'frutos secos' },
  { members: ['pipas-de-girasol', 'semillas-de-calabaza', 'sesamo', 'semillas-de-canamo', 'semillas-de-amapola'], name: 'semillas' },
  { members: ['semillas-de-chia', 'semillas-de-lino'], name: 'semillas que espesan' },
  { members: ['mantequilla-de-cacahuete', 'crema-de-almendras', 'crema-de-anacardos', 'crema-de-pistacho', 'tahini'], name: 'crema de frutos secos' },
  { members: ['pasas', 'datiles', 'orejones', 'higos-secos', 'ciruelas-pasas', 'arandanos-deshidratados'], name: 'fruta desecada' },
  // ── Fruit ─────────────────────────────────────────────────────────────
  { members: ['manzana', 'pera', 'platano', 'naranja', 'mandarina', 'kiwi', 'uva', 'melocoton', 'nectarina', 'ciruela', 'mango', 'pina'], name: 'fruta fresca' },
  { members: ['naranja', 'mandarina', 'pomelo'], name: 'cítricos' },
  { members: ['limon', 'lima'], name: 'cítrico ácido' },
  { members: ['melocoton', 'nectarina', 'paraguayo', 'albaricoque', 'ciruela', 'cereza'], name: 'fruta de hueso' },
  { members: ['mango', 'pina', 'papaya', 'maracuya', 'lichi', 'pitaya', 'chirimoya', 'mango-congelado', 'pina-congelada'], name: 'fruta tropical' },
  { members: ['fresa', 'frambuesa', 'mora', 'arandano', 'grosella', 'frutos-rojos-congelados', 'arandanos-congelados', 'frambuesas-congeladas', 'fresas-congeladas'], name: 'frutos rojos' },
  { members: ['melon', 'sandia', 'melon-cantalupo'], name: 'melón' },
  { members: ['caqui', 'granada', 'higo', 'higo-chumbo', 'nispero'], name: 'fruta de otoño' },
  { members: ['aguacate', 'guacamole'], name: 'aguacate' },
  // ── Vegetables ────────────────────────────────────────────────────────
  { members: ['brocoli', 'coliflor', 'brocoli-congelado', 'coliflor-congelada', 'romanesco', 'bimi', 'coles-de-bruselas'], name: 'crucíferas' },
  { members: ['col-blanca', 'lombarda', 'col-china', 'pak-choi', 'col-rizada'], name: 'col' },
  { members: ['espinaca', 'col-rizada', 'espinacas-congeladas', 'acelga', 'grelos', 'borraja'], name: 'hoja verde' },
  { members: ['lechuga', 'escarola', 'rucula', 'lechuga-romana', 'lechuga-iceberg', 'lechuga-hoja-de-roble', 'canonigos', 'berros', 'endibia', 'mezcla-de-brotes'], name: 'ensalada' },
  { members: ['champinon', 'portobello', 'seta-shiitake', 'seta-ostra', 'seta-de-cardo', 'boletus', 'niscalos', 'setas-variadas', 'setas-congeladas', 'champinones-en-conserva'], name: 'setas' },
  { members: ['calabacin', 'berenjena'], name: 'verdura de sartén' },
  { members: ['pimiento-rojo', 'pimiento-verde', 'pimiento-amarillo', 'pimiento-italiano', 'pimientos-tricolor-congelados'], name: 'pimiento' },
  { members: ['pimiento-del-piquillo', 'pimientos-asados-en-conserva'], name: 'pimiento asado' },
  { members: ['guindilla-fresca', 'jalapeno'], name: 'picante fresco' },
  { members: ['guindilla-seca', 'cayena-molida', 'chile-chipotle-seco'], name: 'picante seco' },
  { members: ['pimiento-choricero', 'nora'], name: 'pimiento seco' },
  { members: ['calabaza', 'calabaza-cacahuete', 'boniato'], name: 'calabaza' },
  { members: ['patata', 'boniato', 'patata-nueva', 'yuca'], name: 'tubérculo' },
  { members: ['zanahoria', 'chirivia', 'nabo', 'colinabo', 'daikon', 'apionabo'], name: 'raíz' },
  { members: ['remolacha', 'remolacha-cocida', 'remolacha-en-conserva'], name: 'remolacha' },
  { members: ['tomate', 'tomate-cherry', 'tomate-pera'], name: 'tomate' },
  { members: ['tomate-triturado', 'tomate-frito', 'tomate-entero-pelado', 'tomate-troceado-en-conserva'], name: 'tomate en conserva' },
  { members: ['judia-verde', 'judia-verde-congelada', 'guisantes-congelados', 'guisantes-frescos', 'tirabeques', 'habas-frescas', 'habas-congeladas', 'guisantes-en-conserva', 'habas-en-conserva', 'judias-verdes-en-conserva', 'edamame-cocido', 'edamame-congelado'], name: 'verdura verde' },
  { members: ['maiz-dulce', 'maiz-congelado', 'mazorca-de-maiz'], name: 'maíz' },
  { members: ['esparrago-verde', 'esparrago-blanco', 'esparragos-blancos-en-conserva'], name: 'espárrago' },
  { members: ['alcachofa', 'alcachofas-congeladas', 'alcachofas-en-conserva'], name: 'alcachofa' },
  { members: ['menestra-congelada', 'menestra-en-conserva', 'mix-de-verduras-congelado', 'salteado-de-verduras-congelado', 'verduras-para-sopa-congeladas'], name: 'menestra' },
  { members: ['pisto-congelado', 'pisto-en-conserva', 'sofrito-envasado'], name: 'pisto' },
  { members: ['patatas-fritas-congeladas', 'patatas-gajo-congeladas'], name: 'patata congelada' },
  { members: ['kimchi', 'chucrut'], name: 'fermentado' },
  // ── Herbs and spices ──────────────────────────────────────────────────
  { members: ['perejil', 'cilantro', 'albahaca-fresca', 'hierbabuena', 'eneldo-fresco', 'cebollino'], name: 'hierba fresca' },
  { members: ['oregano-seco', 'tomillo-seco', 'romero-seco', 'albahaca-seca', 'perejil-seco', 'hierbas-provenzales', 'mejorana', 'salvia-seca', 'estragon-seco', 'eneldo-seco', 'hierbabuena-seca'], name: 'hierba seca' },
  { members: ['pimenton-dulce', 'pimenton-ahumado', 'pimenton-picante'], name: 'pimentón' },
  { members: ['pimienta-negra', 'pimienta-blanca'], name: 'pimienta' },
  { members: ['curry-en-polvo', 'garam-masala', 'ras-el-hanout'], name: 'curry' },
  { members: ['canela-molida', 'canela-en-rama'], name: 'canela' },
  { members: ['anis-en-grano', 'anis-estrellado'], name: 'anís' },
  { members: ['pasta-de-curry-rojo', 'pasta-de-curry-verde'], name: 'pasta de curry' },
  { members: ['cacao-en-polvo-puro', 'harina-de-algarroba'], name: 'cacao' },
  // ── Sauces, condiments, fats, sweet ───────────────────────────────────
  { members: ['vinagre-de-jerez', 'vinagre-de-manzana', 'vinagre-de-vino-tinto', 'vinagre-balsamico', 'vinagre-de-arroz', 'vinagre-blanco', 'vinagre-de-vino-blanco'], name: 'vinagre' },
  { members: ['salsa-de-soja', 'tamari', 'salsa-de-soja-baja-en-sal'], name: 'salsa de soja' },
  { members: ['salsa-teriyaki', 'salsa-hoisin', 'salsa-agridulce', 'salsa-de-chile-dulce'], name: 'salsa asiática dulce' },
  { members: ['salsa-sriracha', 'salsa-picante-tabasco', 'harissa', 'gochujang'], name: 'picante' },
  { members: ['mostaza-de-dijon', 'mostaza-amarilla', 'mostaza-antigua', 'mostaza-de-miel'], name: 'mostaza' },
  { members: ['tomate-frito', 'salsa-de-tomate-para-pizza', 'sofrito-envasado', 'tomate-triturado'], name: 'salsa de tomate' },
  { members: ['ketchup', 'salsa-barbacoa'], name: 'salsa dulce de tomate' },
  { members: ['mojo-picon', 'mojo-verde', 'chimichurri'], name: 'mojo' },
  { members: ['aceite-de-oliva-suave', 'aceite-de-girasol', 'aceite-de-aguacate', 'aceite-de-cacahuete', 'aceite-de-coco'], name: 'aceite para cocinar' },
  { members: ['aceite-de-sesamo', 'aceite-de-nuez', 'aceite-de-lino'], name: 'aceite para aliñar' },
  { members: ['azucar-blanco', 'azucar-moreno', 'panela'], name: 'azúcar' },
  { members: ['sirope-de-agave', 'sirope-de-arce', 'sirope-de-datiles', 'miel-de-cana'], name: 'sirope' },
  { members: ['mermelada-de-fresa', 'mermelada-de-melocoton', 'mermelada-de-naranja', 'mermelada-de-frutos-rojos', 'mermelada-light'], name: 'mermelada' },
  { members: ['dulce-de-membrillo', 'cabello-de-angel'], name: 'dulce de fruta' },
  { members: ['chocolate-negro-70', 'chocolate-negro-85', 'chocolate-de-cobertura', 'chips-de-chocolate'], name: 'chocolate negro' },
  { members: ['turron-de-jijona', 'mazapan'], name: 'turrón' },
  { members: ['alga-nori', 'alga-wakame', 'alga-kombu'], name: 'alga' },
  { members: ['alcaparras', 'pepinillos-en-vinagre', 'cebolletas-en-vinagre', 'guindillas-en-vinagre'], name: 'encurtidos' },
  { members: ['aceitunas-negras', 'aceitunas-verdes'], name: 'aceitunas' },
  { members: ['hummus', 'hummus-de-remolacha', 'baba-ganoush'], name: 'dip' },
  { members: ['patatas-fritas-de-bolsa', 'chips-de-verduras', 'nachos', 'palomitas-hechas', 'pretzels', 'kikos', 'garbanzos-tostados'], name: 'aperitivo salado' },
  { members: ['garbanzos-con-espinacas-en-lata', 'alubias-con-verduras-en-lata'], name: 'legumbre guisada en lata' },
  { members: ['crema-de-verduras-envasada', 'crema-de-calabaza-envasada', 'sopa-de-verduras-envasada'], name: 'crema de verduras' },
  { members: ['gazpacho-envasado', 'salmorejo-envasado'], name: 'sopa fría' },
  { members: ['sorbete-de-limon', 'polo-de-fruta'], name: 'helado sin lácteos' },
  // ── Drinks ────────────────────────────────────────────────────────────
  { members: ['zumo-de-naranja', 'zumo-de-manzana', 'zumo-de-pina', 'zumo-de-uva', 'zumo-de-melocoton', 'zumo-multifrutas', 'zumo-de-granada', 'zumo-de-arandanos'], name: 'zumo' },
  { members: ['te-verde', 'te-negro', 'infusion-de-manzanilla', 'infusion-de-rooibos', 'infusion-de-menta-poleo'], name: 'infusión' },
  { members: ['cafe-solo', 'cafe-descafeinado'], name: 'café' },
  { members: ['refresco-de-cola', 'refresco-light', 'tonica', 'limonada'], name: 'refresco' },
  { members: ['agua', 'agua-con-gas'], name: 'agua' }
];

export const SUBSTITUTION_EXTRAS: readonly SubstitutionExtra[] = [
  // Out of pork, never into it.
  { from: 'lomo-de-cerdo', to: 'pechuga-de-pollo' },
  { from: 'lomo-de-cerdo', to: 'pavo' },
  { from: 'lomo-de-cerdo', to: 'ternera-magra' },
  { from: 'costillas-de-cerdo', to: 'muslo-de-pollo' },
  { from: 'solomillo-de-cerdo', to: 'pechuga-de-pollo' },
  { from: 'solomillo-de-cerdo', to: 'pavo' },
  { from: 'chuleta-de-cerdo', to: 'pechuga-de-pollo' },
  { from: 'secreto-de-cerdo', to: 'contramuslo-de-pollo' },
  { from: 'presa-iberica', to: 'solomillo-de-ternera' },
  { from: 'carne-picada-mixta', to: 'carne-picada-de-ternera' },
  { from: 'carne-picada-de-cerdo', to: 'carne-picada-de-ternera' },
  { from: 'salchichas-frescas', to: 'salchichas-de-pollo' },
  { from: 'jamon-cocido', to: 'fiambre-de-pavo' },
  { from: 'jamon-cocido', to: 'fiambre-de-pollo' },
  { from: 'croquetas-de-jamon-congeladas', to: 'croquetas-de-pollo-congeladas' },
  { from: 'pate-de-higado', to: 'pate-vegetal' },
  { from: 'manteca-de-cerdo', to: 'aceite-de-oliva-virgen-extra' },
  { from: 'manteca-de-cerdo', to: 'aceite-de-coco' },
  { from: 'salsa-carbonara-envasada', to: 'salsa-de-queso' },
  { from: 'ensaimada', to: 'churros' },
  { from: 'polvoron', to: 'mazapan' },
  { from: 'arroz-tres-delicias-congelado', to: 'arroz-blanco-cocido' },
  // Red meat to white, lamb to beef; a mince to the one thing that behaves like mince.
  { from: 'ternera-magra', to: 'pechuga-de-pollo' },
  { from: 'ternera-magra', to: 'pavo' },
  { from: 'solomillo-de-ternera', to: 'pechuga-de-pollo' },
  { from: 'carne-picada-de-ternera', to: 'soja-texturizada' },
  { from: 'hamburguesa-de-ternera', to: 'hamburguesa-vegetal' },
  { from: 'hamburguesa-de-ternera', to: 'pollo-picado' },
  { from: 'pierna-de-cordero', to: 'redondo-de-ternera' },
  { from: 'chuletas-de-cordero', to: 'entrecot-de-ternera' },
  { from: 'pollo-entero', to: 'muslo-de-pollo' },
  { from: 'alitas-de-pollo', to: 'muslo-de-pollo' },
  { from: 'salchichas-de-pollo', to: 'salchichas-vegetales' },
  { from: 'nuggets-de-pollo-congelados', to: 'nuggets-vegetales' },
  { from: 'salsa-bolonesa-envasada', to: 'tomate-frito' },
  { from: 'caldo-de-pollo', to: 'caldo-de-verduras' },
  { from: 'caldo-de-pollo', to: 'caldo-de-carne' },
  { from: 'caldo-de-carne', to: 'caldo-de-verduras' },
  { from: 'caldo-de-carne', to: 'caldo-de-pollo' },
  { from: 'pastilla-de-caldo', to: 'pastilla-de-caldo-de-verduras' },
  // Fish and seafood, out towards the shelf that always has something.
  { from: 'atun-al-natural', to: 'sardina' },
  { from: 'sardina', to: 'atun-al-natural' },
  { from: 'caldo-de-pescado', to: 'caldo-de-verduras' },
  { from: 'caldo-dashi', to: 'caldo-de-pescado' },
  { from: 'salsa-de-pescado', to: 'salsa-de-soja' },
  { from: 'salsa-worcestershire', to: 'salsa-de-soja' },
  { from: 'salsa-de-ostras', to: 'salsa-hoisin' },
  { from: 'salsa-cesar', to: 'mayonesa' },
  { from: 'aceitunas-rellenas-de-anchoa', to: 'aceitunas-verdes' },
  { from: 'palitos-de-merluza-congelados', to: 'filete-de-merluza-congelado' },
  { from: 'gambas-rebozadas-congeladas', to: 'gambas-peladas-congeladas' },
  { from: 'calamares-a-la-romana-congelados', to: 'anillas-de-calamar-congeladas' },
  { from: 'empanada-de-atun', to: 'empanadillas-de-atun-congeladas' },
  // Dairy to plant, one direction.
  { from: 'leche-entera', to: 'leche-de-avena' },
  { from: 'leche-semidesnatada', to: 'leche-de-avena' },
  { from: 'leche-desnatada', to: 'leche-de-avena' },
  { from: 'leche-sin-lactosa', to: 'leche-de-avena' },
  { from: 'leche-de-cabra', to: 'leche-de-almendra' },
  { from: 'nata-para-cocinar', to: 'yogur-griego-natural' },
  { from: 'nata-para-cocinar', to: 'nata-vegetal-de-soja' },
  { from: 'nata-para-cocinar', to: 'nata-vegetal-de-avena' },
  { from: 'nata-para-cocinar', to: 'leche-de-coco' },
  { from: 'nata-para-montar', to: 'crema-de-coco' },
  { from: 'mantequilla', ratio: 0.8, to: 'aceite-de-oliva-virgen-extra' },
  { from: 'mantequilla', to: 'aceite-de-coco' },
  { from: 'mantequilla', to: 'margarina' },
  { from: 'mantequilla-sin-sal', ratio: 0.8, to: 'aceite-de-oliva-virgen-extra' },
  { from: 'ghee', to: 'aceite-de-oliva-virgen-extra' },
  { from: 'queso-parmesano', ratio: 0.5, to: 'levadura-nutricional' },
  { from: 'queso-rallado', ratio: 0.5, to: 'levadura-nutricional' },
  { from: 'queso-en-lonchas', to: 'queso-vegano' },
  { from: 'queso-mozzarella', to: 'queso-vegano' },
  { from: 'yogur-natural-desnatado', to: 'yogur-de-soja' },
  { from: 'yogur-griego-natural', to: 'yogur-de-coco' },
  { from: 'kefir', to: 'yogur-de-soja' },
  { from: 'helado-de-vainilla', to: 'sorbete-de-limon' },
  { from: 'helado-de-fresa', to: 'polo-de-fruta' },
  { from: 'yogur-helado', to: 'sorbete-de-limon' },
  { from: 'proteina-de-suero', to: 'proteina-de-guisante' },
  { from: 'bebida-de-proteinas', to: 'bebida-de-proteinas-vegetal' },
  { from: 'crema-de-avellanas-y-cacao', to: 'crema-de-almendras' },
  { from: 'chocolate-con-leche', to: 'chocolate-negro-70' },
  { from: 'barritas-de-proteinas', to: 'barritas-de-cereales' },
  { from: 'pesto-genovese', to: 'pesto-vegano' },
  { from: 'pesto-rojo', to: 'pesto-vegano' },
  { from: 'tzatziki', to: 'hummus' },
  { from: 'masa-quebrada', to: 'masa-de-hojaldre' },
  { from: 'pan-de-ajo-congelado', to: 'baguette' },
  // Egg to none.
  { from: 'pasta-fresca-al-huevo', ratio: 0.7, to: 'espaguetis-secos' },
  { from: 'turron-de-alicante', to: 'turron-de-jijona' },
  { from: 'rosquillas', to: 'churros' },
  // Animal products to plant.
  { from: 'gelatina-neutra', to: 'agar-agar' },
  { from: 'miel', to: 'sirope-de-agave' },
  { from: 'miel', to: 'sirope-de-arce' },
  { from: 'miel', to: 'sirope-de-datiles' },
  // Fats and thickeners.
  { from: 'aceite-de-girasol', to: 'aceite-de-oliva-virgen-extra' },
  { from: 'aceite-de-coco', to: 'aceite-de-oliva-virgen-extra' },
  { from: 'aceite-de-oliva-suave', to: 'aceite-de-oliva-virgen-extra' },
  { from: 'margarina', ratio: 0.8, to: 'aceite-de-oliva-virgen-extra' },
  { from: 'maicena', ratio: 2, to: 'harina-de-trigo' },
  { from: 'harina-de-trigo', to: 'harina-de-arroz' },
  { from: 'harina-de-almendra', ratio: 0.5, to: 'harina-de-coco' },
  { from: 'levadura-seca-de-panaderia', ratio: 3, to: 'levadura-fresca-de-panaderia' },
  { from: 'levadura-fresca-de-panaderia', ratio: 0.35, to: 'levadura-seca-de-panaderia' },
  { from: 'concentrado-de-tomate', ratio: 4, to: 'tomate-triturado' },
  { from: 'tomate-triturado', ratio: 0.3, to: 'concentrado-de-tomate' },
  // Breakfast.
  { from: 'copos-de-avena', to: 'muesli' },
  { from: 'muesli', to: 'copos-de-avena' },
  { from: 'copos-de-maiz', to: 'muesli' },
  { from: 'cacao-soluble', ratio: 0.5, to: 'cacao-en-polvo-puro' },
  // A nut-free way out of every nut.
  { from: 'almendras', to: 'pipas-de-girasol' },
  { from: 'avellanas', to: 'pipas-de-girasol' },
  { from: 'nueces', to: 'pipas-de-girasol' },
  { from: 'anacardos', to: 'pipas-de-girasol' },
  { from: 'pistachos', to: 'pipas-de-girasol' },
  { from: 'cacahuetes', to: 'pipas-de-girasol' },
  { from: 'pinones', to: 'pipas-de-girasol' },
  // Towards the staple, never away from it.
  { from: 'chalota', to: 'cebolla' },
  { from: 'cebolleta', to: 'cebolla' },
  { from: 'puerro', to: 'cebolla' },
  { from: 'cebolla-morada', to: 'cebolla' },
  { from: 'cebolla-dulce', to: 'cebolla' },
  { from: 'cebolla-picada-congelada', to: 'cebolla' },
  { from: 'esparrago-verde', to: 'judia-verde' },
  { from: 'okra', to: 'judia-verde' },
  { from: 'calabaza', to: 'boniato' },
  { from: 'calabaza', to: 'zanahoria' },
  { from: 'guisantes-congelados', to: 'edamame-cocido' },
  // Fresh herb to dried, at the weight a cook would use.
  { from: 'romero-fresco', ratio: 0.35, to: 'romero-seco' },
  { from: 'tomillo-fresco', ratio: 0.35, to: 'tomillo-seco' },
  { from: 'albahaca-fresca', ratio: 0.3, to: 'albahaca-seca' },
  { from: 'perejil', ratio: 0.3, to: 'perejil-seco' },
  { from: 'eneldo-fresco', ratio: 0.3, to: 'eneldo-seco' },
  { from: 'hierbabuena', ratio: 0.3, to: 'hierbabuena-seca' },
  { from: 'jengibre-fresco', ratio: 0.25, to: 'jengibre-en-polvo' },
  { from: 'ajo', ratio: 0.3, to: 'ajo-en-polvo' },
  { from: 'guindilla-fresca', ratio: 0.5, to: 'guindilla-seca' },
  { from: 'guindilla-fresca', ratio: 0.25, to: 'cayena-molida' },
  { from: 'azafran', to: 'colorante-alimentario' },
  { from: 'azafran', ratio: 2, to: 'curcuma-molida' },
  { from: 'colorante-alimentario', to: 'curcuma-molida' },
  { from: 'wasabi', to: 'mostaza-de-dijon' },
  { from: 'miso', ratio: 0.5, to: 'salsa-de-soja' },
  { from: 'salsa-teriyaki', to: 'salsa-de-soja' },
  { from: 'salsa-de-arandanos', to: 'mermelada-de-frutos-rojos' },
  { from: 'crema-de-vinagre-balsamico', ratio: 2, to: 'vinagre-balsamico' },
  { from: 'azucar-blanco', to: 'edulcorante' },
  { from: 'edulcorante', to: 'azucar-blanco' },
  { from: 'vino-blanco', to: 'caldo-de-verduras' },
  { from: 'vino-tinto', to: 'caldo-de-verduras' }
];

/**
 * Every ordered pair the seed writes: each group member for each other member,
 * then the extras. First mention wins, so a pair a group already produced is not
 * duplicated by an extra, and the unique constraint on the table is never hit.
 */
export function substitutionPairs(): readonly SubstitutionPair[] {
  const seen = new Set<string>();
  const pairs: SubstitutionPair[] = [];

  const add = (ingredient: string, substitute: string, ratio: number) => {
    const key = `${ingredient}→${substitute}`;

    if (ingredient === substitute || seen.has(key)) {return;}

    seen.add(key);
    pairs.push({ ingredient, ratio, substitute });
  };

  for (const group of SUBSTITUTION_GROUPS) {
    for (const ingredient of group.members) {
      for (const substitute of group.members) {add(ingredient, substitute, 1);}
    }
  }

  for (const extra of SUBSTITUTION_EXTRAS) {add(extra.from, extra.to, extra.ratio ?? 1);}

  return pairs;
}
