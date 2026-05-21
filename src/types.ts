export type CalculatorStatus = 'draft' | 'active' | 'maintenance';

export type Calculator = {
  id: number;
  slug: string;
  name: string;
  description: string;
  category: string;
  status: CalculatorStatus;
  sort_order: number;
};

export type CalculatorField = {
  id: number;
  field_key: string;
  label: string;
  field_type: 'number' | 'select' | 'text' | 'boolean';
  unit: string | null;
  required: boolean;
  options: string[] | null;
  validation: Record<string, number | string | boolean> | null;
  help_text: string | null;
  sort_order: number;
};

export type FormulaVersion = {
  id: number;
  version: string;
  formula_text: string | null;
  assumptions: string | null;
  effective_from: string | null;
  effective_to: string | null;
  status: 'draft' | 'active' | 'archived';
  created_at: string;
};

export type CalculatorDetail = Calculator & {
  fields: CalculatorField[];
  formulaVersions: FormulaVersion[];
};

export type EmissionFactor = {
  id: number;
  factor_key: string;
  name: string;
  category: string;
  region: string | null;
  year: number | null;
  value: number | null;
  unit: string | null;
  uncertainty: string | null;
  notes: string | null;
  source_title: string | null;
};

export type CalculationRecord = {
  id: number;
  title: string | null;
  calculator_name: string;
  calculator_slug: string;
  total_emission: number | null;
  emission_unit: string;
  created_at: string;
  result_snapshot: CalculationResultSnapshot | null;
};

export type ReferenceItem = {
  id: number;
  title: string;
  organization: string | null;
  publication_year: number | null;
  url: string | null;
  citation: string | null;
  notes: string | null;
  created_at: string;
};

export interface BreakdownItem {
  category: string;
  label: string;
  value: number;
  unit: string;
  formula: string;
}

export interface CalculationResultSnapshot {
  status: string;
  message: string;
  total_emission: number;
  emission_unit: string;
  breakdown: BreakdownItem[];
  formula_version: string;
}
