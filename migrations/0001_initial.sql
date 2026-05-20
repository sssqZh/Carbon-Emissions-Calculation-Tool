-- Migration: Initial schema and seed data
-- Combined from db/schema.sql and db/seed.sql

CREATE TABLE IF NOT EXISTS calculators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'maintenance')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calculator_fields (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculator_id INTEGER NOT NULL,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK (field_type IN ('number', 'select', 'text', 'boolean')),
  unit TEXT,
  required INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
  options_json TEXT,
  validation_json TEXT,
  help_text TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (calculator_id) REFERENCES calculators(id) ON DELETE CASCADE,
  UNIQUE (calculator_id, field_key)
);

CREATE TABLE IF NOT EXISTS source_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  organization TEXT,
  publication_year INTEGER,
  url TEXT,
  citation TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS formula_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculator_id INTEGER NOT NULL,
  version TEXT NOT NULL,
  formula_text TEXT,
  assumptions TEXT,
  effective_from TEXT,
  effective_to TEXT,
  source_id INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (calculator_id) REFERENCES calculators(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES source_references(id) ON DELETE SET NULL,
  UNIQUE (calculator_id, version)
);

CREATE TABLE IF NOT EXISTS emission_factors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  factor_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  region TEXT,
  year INTEGER,
  value REAL,
  unit TEXT,
  source_id INTEGER,
  uncertainty TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (source_id) REFERENCES source_references(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS calculation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  calculator_id INTEGER NOT NULL,
  title TEXT,
  input_snapshot_json TEXT NOT NULL,
  result_snapshot_json TEXT NOT NULL,
  formula_version_id INTEGER,
  total_emission REAL,
  emission_unit TEXT NOT NULL DEFAULT 'kgCO2e',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (calculator_id) REFERENCES calculators(id) ON DELETE CASCADE,
  FOREIGN KEY (formula_version_id) REFERENCES formula_versions(id) ON DELETE SET NULL
);

CREATE TRIGGER IF NOT EXISTS calculators_touch_updated_at
AFTER UPDATE ON calculators
FOR EACH ROW
BEGIN
  UPDATE calculators SET updated_at = datetime('now') WHERE id = OLD.id;
END;

CREATE TRIGGER IF NOT EXISTS emission_factors_touch_updated_at
AFTER UPDATE ON emission_factors
FOR EACH ROW
BEGIN
  UPDATE emission_factors SET updated_at = datetime('now') WHERE id = OLD.id;
END;

-- Seed data

INSERT OR IGNORE INTO calculators (slug, name, description, category, status, sort_order) VALUES
  ('personal-footprint', '个人碳足迹估算', '基于出行、饮食、居住和消费数据估算个人碳排放。', '生活方式', 'draft', 10),
  ('grid-emission-factor', '当地电网平均碳排放因子计算', '用于维护和计算地区电力平均碳排放因子。', '能源', 'draft', 20),
  ('hotpot-emission', '火锅碳排放估算', '基于食材、能源、人数和交通等数据估算一次火锅活动的碳排放。', '场景活动', 'draft', 30);

INSERT OR IGNORE INTO source_references (title, organization, publication_year, url, citation, notes) VALUES
  ('个人碳足迹计算参考资料待补充', '待补充', NULL, NULL, NULL, '后续根据用户提供的资料更新。'),
  ('电网排放因子参考资料待补充', '待补充', NULL, NULL, NULL, '后续根据官方或研究数据更新。'),
  ('火锅碳排放计算参考资料待补充', '待补充', NULL, NULL, NULL, '后续根据食材、能源和运输因子资料更新。');

INSERT OR IGNORE INTO formula_versions (calculator_id, version, formula_text, assumptions, source_id, status)
SELECT id, '0.1-draft', '公式待接入。', '当前版本只用于前端和数据结构占位。', 1, 'draft'
FROM calculators
WHERE slug = 'personal-footprint';

INSERT OR IGNORE INTO formula_versions (calculator_id, version, formula_text, assumptions, source_id, status)
SELECT id, '0.1-draft', '公式待接入。', '当前版本只用于前端和数据结构占位。', 2, 'draft'
FROM calculators
WHERE slug = 'grid-emission-factor';

INSERT OR IGNORE INTO formula_versions (calculator_id, version, formula_text, assumptions, source_id, status)
SELECT id, '0.1-draft', '公式待接入。', '当前版本只用于前端和数据结构占位。', 3, 'draft'
FROM calculators
WHERE slug = 'hotpot-emission';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'monthly_electricity', '月用电量', 'number', 'kWh', 1, NULL, '{"min":0}', '填写最近一个月或典型月份的家庭用电量。', 10
FROM calculators WHERE slug = 'personal-footprint';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'weekly_commute_distance', '每周通勤距离', 'number', 'km', 0, NULL, '{"min":0}', '往返总距离，可先填写估算值。', 20
FROM calculators WHERE slug = 'personal-footprint';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'meat_meals_per_week', '每周含肉餐次', 'number', '次', 0, NULL, '{"min":0}', '用于后续饮食排放估算。', 30
FROM calculators WHERE slug = 'personal-footprint';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'region', '地区', 'select', NULL, 1, '["华北","华东","华中","华南","西南","西北","东北","待补充"]', NULL, '地区分区可在接入资料后调整。', 10
FROM calculators WHERE slug = 'grid-emission-factor';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'year', '年份', 'number', '年', 1, NULL, '{"min":2000,"max":2100}', '用于匹配对应年份的电力数据或官方因子。', 20
FROM calculators WHERE slug = 'grid-emission-factor';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'electricity_amount', '用电量', 'number', 'kWh', 0, NULL, '{"min":0}', '可用于将排放因子换算成用电排放。', 30
FROM calculators WHERE slug = 'grid-emission-factor';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'diners', '用餐人数', 'number', '人', 1, NULL, '{"min":1}', '用于计算人均排放。', 10
FROM calculators WHERE slug = 'hotpot-emission';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'beef_weight', '牛肉重量', 'number', 'kg', 0, NULL, '{"min":0}', '食材排放因子后续接入。', 20
FROM calculators WHERE slug = 'hotpot-emission';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'vegetable_weight', '蔬菜重量', 'number', 'kg', 0, NULL, '{"min":0}', '食材排放因子后续接入。', 30
FROM calculators WHERE slug = 'hotpot-emission';

INSERT OR IGNORE INTO calculator_fields
  (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order)
SELECT id, 'heat_source', '热源', 'select', NULL, 0, '["电磁炉","天然气","液化气","待补充"]', NULL, '不同热源将对应不同能源因子。', 40
FROM calculators WHERE slug = 'hotpot-emission';

INSERT OR IGNORE INTO emission_factors
  (factor_key, name, category, region, year, value, unit, source_id, uncertainty, notes)
VALUES
  ('grid-average-draft', '电网平均排放因子', '电力', '待补充', NULL, NULL, 'kgCO2e/kWh', 2, '待补充', '占位记录，不用于正式计算。'),
  ('beef-draft', '牛肉排放因子', '食材', '待补充', NULL, NULL, 'kgCO2e/kg', 3, '待补充', '占位记录，不用于正式计算。'),
  ('hotpot-heat-electricity-draft', '火锅电力热源因子', '能源', '待补充', NULL, NULL, 'kgCO2e/kWh', 3, '待补充', '占位记录，不用于正式计算。');
