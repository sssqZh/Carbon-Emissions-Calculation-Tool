import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = resolve(root, 'db', 'carbon.sqlite');
const port = Number(process.env.API_PORT || 4174);

function ensureDatabase() {
  if (existsSync(dbPath)) return;
  const result = spawnSync('node', [resolve(root, 'scripts', 'init-db.mjs')], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'Failed to initialize database');
  }
}

function runSql(sql, json = true) {
  ensureDatabase();
  const input = json ? `.mode json\n${sql}` : sql;
  const result = spawnSync('sqlite3', [dbPath], {
    input,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 4,
  });

  if (result.status !== 0) {
    throw new Error(result.stderr || 'sqlite3 query failed');
  }

  if (!json) return null;
  const output = result.stdout.trim();
  return output ? JSON.parse(output) : [];
}

function quoteSql(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function assertSlug(value) {
  if (!/^[a-z0-9-]+$/.test(value)) {
    const error = new Error('Invalid calculator slug');
    error.statusCode = 400;
    throw error;
  }
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

function readRequestJson(req) {
  return new Promise((resolveRequest, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolveRequest(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function getCalculators() {
  return runSql(`
    SELECT id, slug, name, description, category, status, sort_order
    FROM calculators
    ORDER BY sort_order ASC, id ASC;
  `);
}

function getCalculatorDetail(slug) {
  assertSlug(slug);
  const rows = runSql(`
    SELECT id, slug, name, description, category, status, sort_order
    FROM calculators
    WHERE slug = ${quoteSql(slug)}
    LIMIT 1;
  `);

  if (rows.length === 0) {
    const error = new Error('Calculator not found');
    error.statusCode = 404;
    throw error;
  }

  const calculator = rows[0];
  const fields = runSql(`
    SELECT id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order
    FROM calculator_fields
    WHERE calculator_id = ${calculator.id}
    ORDER BY sort_order ASC, id ASC;
  `).map((field) => ({
    ...field,
    required: Boolean(field.required),
    options: field.options_json ? JSON.parse(field.options_json) : null,
    validation: field.validation_json ? JSON.parse(field.validation_json) : null,
  }));

  const formulaVersions = runSql(`
    SELECT id, version, formula_text, assumptions, effective_from, effective_to, status, created_at
    FROM formula_versions
    WHERE calculator_id = ${calculator.id}
    ORDER BY created_at DESC, id DESC;
  `);

  return { ...calculator, fields, formulaVersions };
}

function getEmissionFactors() {
  return runSql(`
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
    ORDER BY category ASC, name ASC;
  `);
}

function getReferences() {
  return runSql(`
    SELECT id, title, organization, publication_year, url, citation, notes, created_at
    FROM source_references
    ORDER BY id ASC;
  `);
}

function getCalculationRecords() {
  return runSql(`
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
    LIMIT 50;
  `).map((record) => ({
    ...record,
    result_snapshot: record.result_snapshot_json ? JSON.parse(record.result_snapshot_json) : null,
  }));
}

async function createCalculationRecord(req) {
  const body = await readRequestJson(req);
  const slug = String(body.calculatorSlug || '');
  assertSlug(slug);

  const calculator = runSql(`
    SELECT id, name
    FROM calculators
    WHERE slug = ${quoteSql(slug)}
    LIMIT 1;
  `)[0];

  if (!calculator) {
    const error = new Error('Calculator not found');
    error.statusCode = 404;
    throw error;
  }

  const title = body.title || `${calculator.name} 草稿记录`;
  const inputSnapshot = JSON.stringify(body.inputSnapshot || {});
  const resultSnapshot = JSON.stringify({
    status: 'pending_formula',
    message: '公式和排放因子尚未接入，当前记录仅保存输入快照。',
  });

  runSql(`
    INSERT INTO calculation_records
      (calculator_id, title, input_snapshot_json, result_snapshot_json, total_emission, emission_unit)
    VALUES
      (${calculator.id}, ${quoteSql(title)}, ${quoteSql(inputSnapshot)}, ${quoteSql(resultSnapshot)}, NULL, 'kgCO2e');
  `, false);

  return { ok: true };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/calculators') {
      sendJson(res, 200, getCalculators());
      return;
    }

    const calculatorMatch = url.pathname.match(/^\/api\/calculators\/([a-z0-9-]+)$/);
    if (req.method === 'GET' && calculatorMatch) {
      sendJson(res, 200, getCalculatorDetail(calculatorMatch[1]));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/emission-factors') {
      sendJson(res, 200, getEmissionFactors());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/references') {
      sendJson(res, 200, getReferences());
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/calculation-records') {
      sendJson(res, 200, getCalculationRecords());
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/calculation-records') {
      sendJson(res, 201, await createCalculationRecord(req));
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Internal server error' });
  }
});

ensureDatabase();
server.listen(port, '127.0.0.1', () => {
  console.log(`Carbon API listening on http://127.0.0.1:${port}`);
});
