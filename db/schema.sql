PRAGMA foreign_keys = ON;

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
