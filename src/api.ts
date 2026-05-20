import type {
  CalculationRecord,
  Calculator,
  CalculatorDetail,
  EmissionFactor,
  ReferenceItem,
} from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function fetchCalculators() {
  return request<Calculator[]>('/api/calculators');
}

export function fetchCalculatorDetail(slug: string) {
  return request<CalculatorDetail>(`/api/calculators/${slug}`);
}

export function fetchEmissionFactors() {
  return request<EmissionFactor[]>('/api/emission-factors');
}

export function fetchCalculationRecords() {
  return request<CalculationRecord[]>('/api/calculation-records');
}

export function fetchReferences() {
  return request<ReferenceItem[]>('/api/references');
}

export function createDraftRecord(calculatorSlug: string, inputSnapshot: Record<string, unknown>) {
  return request<{ ok: boolean }>('/api/calculation-records', {
    method: 'POST',
    body: JSON.stringify({
      calculatorSlug,
      inputSnapshot,
    }),
  });
}
