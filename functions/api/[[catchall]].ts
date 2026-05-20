interface Env {
  DB: D1Database;
}

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

function assertSlug(value: string): void {
  if (!/^[a-z0-9-]+$/.test(value)) {
    throw new ResponseError('Invalid calculator slug', 400);
  }
}

class ResponseError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
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

  const title = body.title || `${calculator.name} 草稿记录`;
  const inputSnapshot = JSON.stringify(body.inputSnapshot || {});
  const resultSnapshot = JSON.stringify({
    status: 'pending_formula',
    message: '公式和排放因子尚未接入，当前记录仅保存输入快照。',
  });

  await db.prepare(`
    INSERT INTO calculation_records
      (calculator_id, title, input_snapshot_json, result_snapshot_json, total_emission, emission_unit)
    VALUES
      (?1, ?2, ?3, ?4, NULL, 'kgCO2e')
  `).bind(calculator.id as number, title, inputSnapshot, resultSnapshot).run();

  return { ok: true };
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  try {
    // GET /api/health
    if (method === 'GET' && pathname === '/api/health') {
      return jsonResponse({ ok: true });
    }

    // GET /api/calculators
    if (method === 'GET' && pathname === '/api/calculators') {
      const data = await getCalculators(env.DB);
      return jsonResponse(data);
    }

    // GET /api/calculators/:slug
    const calcMatch = pathname.match(/^\/api\/calculators\/([a-z0-9-]+)$/);
    if (method === 'GET' && calcMatch) {
      const data = await getCalculatorDetail(env.DB, calcMatch[1]);
      return jsonResponse(data);
    }

    // GET /api/emission-factors
    if (method === 'GET' && pathname === '/api/emission-factors') {
      const data = await getEmissionFactors(env.DB);
      return jsonResponse(data);
    }

    // GET /api/references
    if (method === 'GET' && pathname === '/api/references') {
      const data = await getReferences(env.DB);
      return jsonResponse(data);
    }

    // GET /api/calculation-records
    if (method === 'GET' && pathname === '/api/calculation-records') {
      const data = await getCalculationRecords(env.DB);
      return jsonResponse(data);
    }

    // POST /api/calculation-records
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
