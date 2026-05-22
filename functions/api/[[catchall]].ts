interface Env {
  DB: D1Database;
}

// ======================================================================
// Inline calculation engine (same as shared/calculations.ts)
// ======================================================================

interface BreakdownItem {
  category: string;
  label: string;
  value: number;
  unit: string;
  formula: string;
}

interface CalculationResult {
  total_emission: number;
  emission_unit: string;
  breakdown: BreakdownItem[];
  formula_version: string;
  tree_offset: number;
}

const TRAVEL_FACTORS: Record<string, { label: string; value: number; unit: string }> = {
  gas_car:     { label: '汽油私家车',     value: 0.180, unit: 'kgCO2e/km' },
  ev_car:      { label: '纯电动车',       value: 0.050, unit: 'kgCO2e/km' },
  bus:         { label: '公共汽车',       value: 0.030, unit: 'kgCO2e/pkm' },
  subway:      { label: '地铁/轻轨',      value: 0.015, unit: 'kgCO2e/pkm' },
  train:       { label: '高铁/火车',      value: 0.019, unit: 'kgCO2e/pkm' },
  flight:      { label: '飞机（经济舱）', value: 0.139, unit: 'kgCO2e/pkm' },
};

const DIET_FACTORS: Record<string, { label: string; value: number }> = {
  meat_heavy:  { label: '肉食爱好者', value: 9.0 },
  balanced:    { label: '均衡饮食',   value: 6.0 },
  pescatarian: { label: '素食/鱼素',  value: 4.1 },
  vegan:       { label: '纯素食',     value: 2.7 },
};

const HOUSING_FACTORS: Record<string, { label: string; value: number; unit: string }> = {
  electricity: { label: '电力',   value: 0.5568, unit: 'kgCO2e/kWh' },
  gas:         { label: '天然气', value: 2.160,  unit: 'kgCO2e/m³' },
  water:       { label: '自来水', value: 0.168,  unit: 'kgCO2e/t' },
};

const CONSUMPTION_FACTORS: Record<string, { label: string; value: number; unit: string }> = {
  clothing: { label: '新购衣物',   value: 10.0,  unit: 'kgCO2e/件' },
  phone:    { label: '手机/平板',  value: 80.0,  unit: 'kgCO2e/台' },
  computer: { label: '电脑/笔记本', value: 250.0, unit: 'kgCO2e/台' },
};

const POWER_GEN_FACTORS: Record<string, { label: string; value: number }> = {
  coal:    { label: '燃煤发电',   value: 0.9440 },
  gas_gen: { label: '燃气发电',   value: 0.4792 },
  solar:   { label: '光伏发电',   value: 0.0545 },
  biomass: { label: '生物质发电', value: 0.0457 },
  wind:    { label: '风力发电',   value: 0.0336 },
  csp:     { label: '光热发电',   value: 0.0313 },
  hydro:   { label: '水力发电',   value: 0.0143 },
  nuclear: { label: '核能发电',   value: 0.0065 },
};

const TRANSMISSION_FACTOR = 0.0463;
const PORTION_WEIGHT = 0.2;
const TREE_CO2_PER_YEAR = 18.3;

const FOOD_FACTORS: Record<string, { label: string; value: number }> = {
  beef:      { label: '牛肉',           value: 60.0 },
  mutton:    { label: '羊肉',           value: 40.0 },
  pork:      { label: '猪肉',           value: 12.3 },
  chicken:   { label: '鸡肉/禽肉',      value: 9.9 },
  seafood:   { label: '鱼类/海鲜',      value: 6.0 },
  tofu:      { label: '豆腐/豆制品',    value: 3.2 },
  mushroom:  { label: '菌菇类',         value: 1.5 },
  vegetable: { label: '蔬菜（绿叶菜/大白菜）', value: 1.0 },
  potato:    { label: '薯类（土豆/红薯）',     value: 0.5 },
  staple:    { label: '主食（面条/粉丝）',     value: 1.5 },
};

function safeNum(inputs: Record<string, unknown>, key: string): number {
  const v = inputs[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') { const n = Number(v); return isNaN(n) ? 0 : n; }
  return 0;
}

function safeBool(inputs: Record<string, unknown>, key: string): boolean {
  const v = inputs[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return false;
}

function calcPersonalFootprint(inputs: Record<string, unknown>): CalculationResult {
  const breakdown: BreakdownItem[] = [];
  let travelTotal = 0;
  const travelKeys = [
    { key: 'gas_car_km', fk: 'gas_car' }, { key: 'ev_car_km', fk: 'ev_car' },
    { key: 'bus_km', fk: 'bus' }, { key: 'subway_km', fk: 'subway' },
    { key: 'train_km', fk: 'train' }, { key: 'flight_km', fk: 'flight' },
  ];
  for (const { key, fk } of travelKeys) {
    const d = safeNum(inputs, key);
    if (d > 0) {
      const f = TRAVEL_FACTORS[fk]; const e = d * f.value; travelTotal += e;
      breakdown.push({ category: '出行', label: f.label, value: +e.toFixed(4), unit: 'kgCO2e', formula: `${d} km × ${f.value} kgCO2e/km` });
    }
  }
  let dietTotal = 0;
  const dietType = String(inputs.diet_type || 'balanced');
  const dietDays = safeNum(inputs, 'diet_days') || 365;
  if (DIET_FACTORS[dietType]) {
    const d = DIET_FACTORS[dietType]; dietTotal = dietDays * d.value;
    breakdown.push({ category: '饮食', label: d.label, value: +dietTotal.toFixed(4), unit: 'kgCO2e', formula: `${dietDays} 天 × ${d.value} kgCO2e/天` });
  }
  let housingTotal = 0;
  const ek = safeNum(inputs, 'electricity_kwh');
  if (ek > 0) { const e = ek * HOUSING_FACTORS.electricity.value; housingTotal += e; breakdown.push({ category: '居住', label: '用电', value: +e.toFixed(4), unit: 'kgCO2e', formula: `${ek} kWh × ${HOUSING_FACTORS.electricity.value} kgCO2e/kWh` }); }
  const gm = safeNum(inputs, 'gas_m3');
  if (gm > 0) { const e = gm * HOUSING_FACTORS.gas.value; housingTotal += e; breakdown.push({ category: '居住', label: '天然气', value: +e.toFixed(4), unit: 'kgCO2e', formula: `${gm} m³ × ${HOUSING_FACTORS.gas.value} kgCO2e/m³` }); }
  const wt = safeNum(inputs, 'water_tons');
  if (wt > 0) { const e = wt * HOUSING_FACTORS.water.value; housingTotal += e; breakdown.push({ category: '居住', label: '自来水', value: +e.toFixed(4), unit: 'kgCO2e', formula: `${wt} t × ${HOUSING_FACTORS.water.value} kgCO2e/t` }); }
  let consumptionTotal = 0;
  const cc = safeNum(inputs, 'clothing_count');
  if (cc > 0) { const e = cc * CONSUMPTION_FACTORS.clothing.value; consumptionTotal += e; breakdown.push({ category: '消费', label: CONSUMPTION_FACTORS.clothing.label, value: +e.toFixed(4), unit: 'kgCO2e', formula: `${cc} 件 × ${CONSUMPTION_FACTORS.clothing.value} kgCO2e/件` }); }
  const pc = safeNum(inputs, 'phone_count');
  if (pc > 0) { const e = pc * CONSUMPTION_FACTORS.phone.value; consumptionTotal += e; breakdown.push({ category: '消费', label: CONSUMPTION_FACTORS.phone.label, value: +e.toFixed(4), unit: 'kgCO2e', formula: `${pc} 台 × ${CONSUMPTION_FACTORS.phone.value} kgCO2e/台` }); }
  const lc = safeNum(inputs, 'computer_count');
  if (lc > 0) { const e = lc * CONSUMPTION_FACTORS.computer.value; consumptionTotal += e; breakdown.push({ category: '消费', label: CONSUMPTION_FACTORS.computer.label, value: +e.toFixed(4), unit: 'kgCO2e', formula: `${lc} 台 × ${CONSUMPTION_FACTORS.computer.value} kgCO2e/台` }); }
  const total = travelTotal + dietTotal + housingTotal + consumptionTotal;
  return { total_emission: +total.toFixed(4), emission_unit: 'kgCO2e', breakdown, formula_version: '1.0', tree_offset: +(total / TREE_CO2_PER_YEAR).toFixed(1) };
}

function calcGridEmission(inputs: Record<string, unknown>): CalculationResult {
  const breakdown: BreakdownItem[] = [];
  let wt = 0;
  const keys = [
    { key: 'coal_pct', fk: 'coal' }, { key: 'gas_gen_pct', fk: 'gas_gen' },
    { key: 'solar_pct', fk: 'solar' }, { key: 'biomass_pct', fk: 'biomass' },
    { key: 'wind_pct', fk: 'wind' }, { key: 'csp_pct', fk: 'csp' },
    { key: 'hydro_pct', fk: 'hydro' }, { key: 'nuclear_pct', fk: 'nuclear' },
  ];
  for (const { key, fk } of keys) {
    const p = safeNum(inputs, key);
    if (p > 0) { const f = POWER_GEN_FACTORS[fk]; const c = (p / 100) * f.value; wt += c; breakdown.push({ category: '发电能源', label: f.label, value: +c.toFixed(6), unit: 'kgCO2e/kWh', formula: `${p}% × ${f.value} = ${+c.toFixed(6)}` }); }
  }
  let tx = 0;
  if (safeBool(inputs, 'include_transmission')) { tx = TRANSMISSION_FACTOR; breakdown.push({ category: '输配电', label: '电网输配电修正', value: tx, unit: 'kgCO2e/kWh', formula: `修正系数: ${TRANSMISSION_FACTOR}` }); }
  const gf = wt + tx;
  return { total_emission: +gf.toFixed(6), emission_unit: 'kgCO2e/kWh', breakdown, formula_version: '1.0', tree_offset: +(gf / TREE_CO2_PER_YEAR).toFixed(1) };
}

function calcHotpotEmission(inputs: Record<string, unknown>): CalculationResult {
  const breakdown: BreakdownItem[] = [];
  let total = 0;
  const keys = [
    { key: 'beef_portions', fk: 'beef' }, { key: 'mutton_portions', fk: 'mutton' },
    { key: 'pork_portions', fk: 'pork' }, { key: 'chicken_portions', fk: 'chicken' },
    { key: 'seafood_portions', fk: 'seafood' }, { key: 'tofu_portions', fk: 'tofu' },
    { key: 'mushroom_portions', fk: 'mushroom' }, { key: 'vegetable_portions', fk: 'vegetable' },
    { key: 'potato_portions', fk: 'potato' }, { key: 'staple_portions', fk: 'staple' },
  ];
  const diners = Math.max(safeNum(inputs, 'diners'), 1);
  for (const { key, fk } of keys) {
    const p = safeNum(inputs, key);
    if (p > 0) { const f = FOOD_FACTORS[fk]; const e = p * PORTION_WEIGHT * f.value; total += e; breakdown.push({ category: '食材', label: f.label, value: +e.toFixed(4), unit: 'kgCO2e', formula: `${p} 份 × 0.2kg × ${f.value} = ${+e.toFixed(4)}` }); }
  }
  const pc = total / diners;
  breakdown.push({ category: '汇总', label: `人均排放（${diners}人）`, value: +pc.toFixed(4), unit: 'kgCO2e/人', formula: `${+total.toFixed(4)} ÷ ${diners} = ${+pc.toFixed(4)}` });
  return { total_emission: +total.toFixed(4), emission_unit: 'kgCO2e', breakdown, formula_version: '1.0', tree_offset: +(total / TREE_CO2_PER_YEAR).toFixed(1) };
}

function calculate(slug: string, inputs: Record<string, unknown>): CalculationResult {
  switch (slug) {
    case 'personal-footprint': return calcPersonalFootprint(inputs);
    case 'grid-emission-factor': return calcGridEmission(inputs);
    case 'hotpot-emission': return calcHotpotEmission(inputs);
    default: throw new Error(`Unknown calculator slug: ${slug}`);
  }
}

// ======================================================================

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message }, status);
}

class ResponseError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

function assertSlug(value: string): void {
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new ResponseError('Invalid calculator slug', 400);
  }
}

async function readRequestJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('content-type')?.includes('application/json') === false) {
    throw new ResponseError('Content-Type must be application/json', 400);
  }

  try {
    const text = await request.text();
    return text ? JSON.parse(text) : {};
  } catch {
    throw new ResponseError('Invalid JSON body', 400);
  }
}

async function getCalculators(db: D1Database) {
  const result = await db.prepare(`
    SELECT id, slug, name, description, category, status, sort_order
    FROM calculators
    ORDER BY sort_order ASC, id ASC
  `).all();
  return result.results;
}

async function getCalculatorDetail(db: D1Database, slug: string) {
  assertSlug(slug);

  const calc = await db.prepare(`
    SELECT id, slug, name, description, category, status, sort_order
    FROM calculators
    WHERE slug = ?1
    LIMIT 1
  `).bind(slug).first();

  if (!calc) {
    throw new ResponseError('Calculator not found', 404);
  }

  const calculator = calc as Record<string, unknown>;

  const fieldsResult = await db.prepare(`
    SELECT id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order
    FROM calculator_fields
    WHERE calculator_id = ?1
    ORDER BY sort_order ASC, id ASC
  `).bind(calculator.id as number).all();

  const fields = fieldsResult.results.map((field: Record<string, unknown>) => ({
    ...field,
    required: Boolean(field.required),
    options: field.options_json ? JSON.parse(field.options_json as string) : null,
    validation: field.validation_json ? JSON.parse(field.validation_json as string) : null,
  }));

  const versionsResult = await db.prepare(`
    SELECT id, version, formula_text, assumptions, effective_from, effective_to, status, created_at
    FROM formula_versions
    WHERE calculator_id = ?1
    ORDER BY created_at DESC, id DESC
  `).bind(calculator.id as number).all();

  return { ...calculator, fields, formulaVersions: versionsResult.results };
}

async function getEmissionFactors(db: D1Database) {
  const result = await db.prepare(`
    SELECT
      emission_factors.id,
      factor_key,
      name,
      category,
      region,
      year,
      value,
      unit,
      uncertainty,
      emission_factors.notes,
      source_references.title AS source_title
    FROM emission_factors
    LEFT JOIN source_references ON source_references.id = emission_factors.source_id
    ORDER BY category ASC, name ASC
  `).all();
  return result.results;
}

async function getReferences(db: D1Database) {
  const result = await db.prepare(`
    SELECT id, title, organization, publication_year, url, citation, notes, created_at
    FROM source_references
    ORDER BY id ASC
  `).all();
  return result.results;
}

async function getCalculationRecords(db: D1Database) {
  const result = await db.prepare(`
    SELECT
      calculation_records.id,
      calculation_records.title,
      calculators.name AS calculator_name,
      calculators.slug AS calculator_slug,
      total_emission,
      emission_unit,
      calculation_records.created_at,
      result_snapshot_json
    FROM calculation_records
    JOIN calculators ON calculators.id = calculation_records.calculator_id
    ORDER BY calculation_records.created_at DESC, calculation_records.id DESC
    LIMIT 50
  `).all();

  return result.results.map((record: Record<string, unknown>) => ({
    ...record,
    result_snapshot: record.result_snapshot_json ? JSON.parse(record.result_snapshot_json as string) : null,
  }));
}

async function createCalculationRecord(db: D1Database, request: Request) {
  const body = await readRequestJson(request);
  const slug = String(body.calculatorSlug || '');
  assertSlug(slug);

  const calculator = await db.prepare(`
    SELECT id, name
    FROM calculators
    WHERE slug = ?1
    LIMIT 1
  `).bind(slug).first() as Record<string, unknown> | null;

  if (!calculator) {
    throw new ResponseError('Calculator not found', 404);
  }

  const title = body.title || `${calculator.name} 计算记录`;
  const inputRaw = body.inputSnapshot as Record<string, unknown> || {};

  let result: CalculationResult;
  try {
    result = calculate(slug, inputRaw);
  } catch {
    result = { total_emission: 0, emission_unit: 'kgCO2e', breakdown: [], formula_version: 'unknown', tree_offset: 0 };
  }

  const inputSnapshot = JSON.stringify(inputRaw);
  const resultSnapshot = JSON.stringify({
    status: 'completed',
    message: `总排放量: ${result.total_emission} ${result.emission_unit}`,
    ...result,
  });

  await db.prepare(`
    INSERT INTO calculation_records
      (calculator_id, title, input_snapshot_json, result_snapshot_json, total_emission, emission_unit)
    VALUES
      (?1, ?2, ?3, ?4, ?5, ?6)
  `).bind(calculator.id as number, title, inputSnapshot, resultSnapshot, result.total_emission, result.emission_unit).run();

  return { ok: true, result };
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  try {
    if (method === 'GET' && pathname === '/api/health') {
      return jsonResponse({ ok: true });
    }

    if (method === 'GET' && pathname === '/api/calculators') {
      const data = await getCalculators(env.DB);
      return jsonResponse(data);
    }

    const calcMatch = pathname.match(/^\/api\/calculators\/([a-z0-9-]+)$/);
    if (method === 'GET' && calcMatch) {
      const data = await getCalculatorDetail(env.DB, calcMatch[1]);
      return jsonResponse(data);
    }

    if (method === 'GET' && pathname === '/api/emission-factors') {
      const data = await getEmissionFactors(env.DB);
      return jsonResponse(data);
    }

    if (method === 'GET' && pathname === '/api/references') {
      const data = await getReferences(env.DB);
      return jsonResponse(data);
    }

    if (method === 'GET' && pathname === '/api/calculation-records') {
      const data = await getCalculationRecords(env.DB);
      return jsonResponse(data);
    }

    if (method === 'POST' && pathname === '/api/calculation-records') {
      const data = await createCalculationRecord(env.DB, request);
      return jsonResponse(data, 201);
    }

    return errorResponse('Not found', 404);
  } catch (err) {
    if (err instanceof ResponseError) {
      return errorResponse(err.message, err.statusCode);
    }
    console.error(err);
    return errorResponse('Internal server error', 500);
  }
}
