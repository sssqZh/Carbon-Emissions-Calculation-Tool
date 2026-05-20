import {
  Activity,
  Archive,
  BarChart3,
  BookOpenText,
  Calculator as CalculatorIcon,
  Clock3,
  Database,
  Leaf,
  Plus,
  Save,
  type LucideIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createDraftRecord,
  fetchCalculationRecords,
  fetchCalculatorDetail,
  fetchCalculators,
  fetchEmissionFactors,
  fetchReferences,
} from './api';
import type {
  CalculationRecord,
  Calculator,
  CalculatorDetail,
  CalculatorField,
  EmissionFactor,
  ReferenceItem,
} from './types';

type ViewKey = 'dashboard' | 'calculators' | 'factors' | 'records' | 'references';
type FormState = Record<string, string | boolean>;

const navItems: Array<{ key: ViewKey; label: string; icon: LucideIcon }> = [
  { key: 'dashboard', label: '概览', icon: BarChart3 },
  { key: 'calculators', label: '计算器', icon: CalculatorIcon },
  { key: 'factors', label: '因子库', icon: Database },
  { key: 'records', label: '历史记录', icon: Clock3 },
  { key: 'references', label: '参考资料', icon: BookOpenText },
];

const statusLabels = {
  draft: '草稿',
  active: '已启用',
  maintenance: '维护中',
  archived: '已归档',
};

function App() {
  const [view, setView] = useState<ViewKey>('dashboard');
  const [calculators, setCalculators] = useState<Calculator[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedCalculator, setSelectedCalculator] = useState<CalculatorDetail | null>(null);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [records, setRecords] = useState<CalculationRecord[]>([]);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const [calculatorRows, factorRows, recordRows, referenceRows] = await Promise.all([
        fetchCalculators(),
        fetchEmissionFactors(),
        fetchCalculationRecords(),
        fetchReferences(),
      ]);
      setCalculators(calculatorRows);
      setFactors(factorRows);
      setRecords(recordRows);
      setReferences(referenceRows);
      setSelectedSlug((current) => current ?? calculatorRows[0]?.slug ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    let active = true;
    fetchCalculatorDetail(selectedSlug)
      .then((detail) => {
        if (active) setSelectedCalculator(detail);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '计算器加载失败');
      });
    return () => {
      active = false;
    };
  }, [selectedSlug]);

  const activeCalculators = useMemo(
    () => calculators.filter((calculator) => calculator.status === 'active').length,
    [calculators],
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={22} />
          </span>
          <div>
            <strong>碳排放计算平台</strong>
            <span>本地数据库版本</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                className={view === item.key ? 'nav-item active' : 'nav-item'}
                onClick={() => setView(item.key)}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div>
            <p className="eyebrow">SQLite + React + TypeScript + Vite</p>
            <h1>{getViewTitle(view)}</h1>
          </div>
          <button className="icon-button" onClick={refresh} type="button" title="刷新数据">
            <Activity size={18} />
            <span>刷新</span>
          </button>
        </header>

        {error && <div className="notice error">{error}</div>}
        {loading ? (
          <div className="notice">正在从本地 SQLite 数据库加载数据...</div>
        ) : (
          <>
            {view === 'dashboard' && (
              <Dashboard
                calculators={calculators}
                activeCalculators={activeCalculators}
                factorCount={factors.length}
                recordCount={records.length}
                onOpenCalculators={() => setView('calculators')}
              />
            )}
            {view === 'calculators' && (
              <CalculatorsView
                calculators={calculators}
                selectedSlug={selectedSlug}
                selectedCalculator={selectedCalculator}
                onSelect={setSelectedSlug}
                onRecordCreated={refresh}
              />
            )}
            {view === 'factors' && <FactorsView factors={factors} />}
            {view === 'records' && <RecordsView records={records} />}
            {view === 'references' && <ReferencesView references={references} />}
          </>
        )}
      </main>
    </div>
  );
}

function getViewTitle(view: ViewKey) {
  switch (view) {
    case 'dashboard':
      return '项目概览';
    case 'calculators':
      return '计算器工作台';
    case 'factors':
      return '排放因子库';
    case 'records':
      return '历史记录';
    case 'references':
      return '参考资料';
  }
}

function Dashboard({
  calculators,
  activeCalculators,
  factorCount,
  recordCount,
  onOpenCalculators,
}: {
  calculators: Calculator[];
  activeCalculators: number;
  factorCount: number;
  recordCount: number;
  onOpenCalculators: () => void;
}) {
  return (
    <section className="stack">
      <div className="metric-grid">
        <Metric icon={CalculatorIcon} label="计算器模块" value={calculators.length} />
        <Metric icon={Archive} label="已启用模块" value={activeCalculators} />
        <Metric icon={Database} label="因子记录" value={factorCount} />
        <Metric icon={Clock3} label="历史记录" value={recordCount} />
      </div>

      <section className="workband">
        <div>
          <p className="eyebrow">第一阶段</p>
          <h2>先把计算器、字段、因子和记录链路跑通</h2>
          <p>
            当前页面已从本地 SQLite 读取计算器配置、字段定义、排放因子和资料记录。具体公式接入后，
            只需要扩展字段、公式版本和计算接口。
          </p>
        </div>
        <button className="primary-button" onClick={onOpenCalculators} type="button">
          <Plus size={18} />
          <span>查看计算器</span>
        </button>
      </section>

      <div className="calculator-grid">
        {calculators.map((calculator) => (
          <article className="calculator-card" key={calculator.slug}>
            <div className="card-topline">
              <span className="category">{calculator.category}</span>
              <StatusBadge status={calculator.status} />
            </div>
            <h3>{calculator.name}</h3>
            <p>{calculator.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <article className="metric">
      <Icon size={20} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function CalculatorsView({
  calculators,
  selectedSlug,
  selectedCalculator,
  onSelect,
  onRecordCreated,
}: {
  calculators: Calculator[];
  selectedSlug: string | null;
  selectedCalculator: CalculatorDetail | null;
  onSelect: (slug: string) => void;
  onRecordCreated: () => void;
}) {
  return (
    <div className="split-layout">
      <section className="list-pane">
        {calculators.map((calculator) => (
          <button
            className={selectedSlug === calculator.slug ? 'selector-card active' : 'selector-card'}
            key={calculator.slug}
            onClick={() => onSelect(calculator.slug)}
            type="button"
          >
            <span>{calculator.category}</span>
            <strong>{calculator.name}</strong>
            <small>{calculator.description}</small>
          </button>
        ))}
      </section>

      <section className="detail-pane">
        {selectedCalculator ? (
          <CalculatorDetailPanel calculator={selectedCalculator} onRecordCreated={onRecordCreated} />
        ) : (
          <div className="empty-state">请选择一个计算器。</div>
        )}
      </section>
    </div>
  );
}

function CalculatorDetailPanel({
  calculator,
  onRecordCreated,
}: {
  calculator: CalculatorDetail;
  onRecordCreated: () => void;
}) {
  const initialState = useMemo(() => buildInitialFormState(calculator.fields), [calculator.fields]);
  const [formState, setFormState] = useState<FormState>(initialState);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setFormState(initialState);
    setSavedMessage(null);
  }, [initialState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedMessage(null);
    await createDraftRecord(calculator.slug, formState);
    setSavedMessage('已保存为草稿记录，等待公式接入后生成真实结果。');
    onRecordCreated();
  }

  return (
    <div className="stack">
      <div className="detail-heading">
        <div>
          <div className="card-topline">
            <span className="category">{calculator.category}</span>
            <StatusBadge status={calculator.status} />
          </div>
          <h2>{calculator.name}</h2>
          <p>{calculator.description}</p>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        {calculator.fields.map((field) => (
          <FieldInput
            field={field}
            key={field.field_key}
            value={formState[field.field_key]}
            onChange={(value) => setFormState((current) => ({ ...current, [field.field_key]: value }))}
          />
        ))}

        <div className="result-shell">
          <div>
            <p className="eyebrow">结果预览</p>
            <strong>公式待接入</strong>
            <span>当前只保存输入快照，后续将展示总排放量、分项贡献和资料来源。</span>
          </div>
          <button className="primary-button" type="submit">
            <Save size={18} />
            <span>保存草稿</span>
          </button>
        </div>
      </form>

      {savedMessage && <div className="notice success">{savedMessage}</div>}

      <section className="subsection">
        <h3>公式版本</h3>
        <div className="formula-list">
          {calculator.formulaVersions.map((formula) => (
            <article key={formula.id}>
              <div>
                <strong>{formula.version}</strong>
                <StatusBadge status={formula.status} />
              </div>
              <p>{formula.formula_text}</p>
              <small>{formula.assumptions}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function buildInitialFormState(fields: CalculatorField[]): FormState {
  return fields.reduce<FormState>((state, field) => {
    if (field.field_type === 'boolean') {
      state[field.field_key] = false;
    } else if (field.field_type === 'select') {
      state[field.field_key] = field.options?.[0] ?? '';
    } else {
      state[field.field_key] = '';
    }
    return state;
  }, {});
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: CalculatorField;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  return (
    <label className="field">
      <span>
        {field.label}
        {field.required && <b>*</b>}
      </span>
      {field.field_type === 'select' ? (
        <select value={String(value)} onChange={(event) => onChange(event.target.value)} required={field.required}>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      ) : field.field_type === 'boolean' ? (
        <input
          checked={Boolean(value)}
          onChange={(event) => onChange(event.target.checked)}
          type="checkbox"
        />
      ) : (
        <div className="unit-input">
          <input
            min={typeof field.validation?.min === 'number' ? field.validation.min : undefined}
            max={typeof field.validation?.max === 'number' ? field.validation.max : undefined}
            onChange={(event) => onChange(event.target.value)}
            required={field.required}
            type={field.field_type}
            value={String(value)}
          />
          {field.unit && <em>{field.unit}</em>}
        </div>
      )}
      {field.help_text && <small>{field.help_text}</small>}
    </label>
  );
}

function FactorsView({ factors }: { factors: EmissionFactor[] }) {
  return (
    <section className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>分类</th>
            <th>地区</th>
            <th>年份</th>
            <th>数值</th>
            <th>单位</th>
            <th>来源</th>
          </tr>
        </thead>
        <tbody>
          {factors.map((factor) => (
            <tr key={factor.id}>
              <td>{factor.name}</td>
              <td>{factor.category}</td>
              <td>{factor.region ?? '待补充'}</td>
              <td>{factor.year ?? '待补充'}</td>
              <td>{factor.value ?? '待录入'}</td>
              <td>{factor.unit ?? '待补充'}</td>
              <td>{factor.source_title ?? '待补充'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function RecordsView({ records }: { records: CalculationRecord[] }) {
  if (records.length === 0) {
    return <div className="empty-state">暂无计算记录。保存任意计算器草稿后会显示在这里。</div>;
  }

  return (
    <section className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>计算器</th>
            <th>总排放</th>
            <th>状态</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.title}</td>
              <td>{record.calculator_name}</td>
              <td>{record.total_emission === null ? '待计算' : `${record.total_emission} ${record.emission_unit}`}</td>
              <td>{record.result_snapshot?.message ?? '待计算'}</td>
              <td>{record.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function ReferencesView({ references }: { references: ReferenceItem[] }) {
  return (
    <div className="reference-grid">
      {references.map((reference) => (
        <article className="reference-card" key={reference.id}>
          <span>{reference.organization ?? '待补充机构'}</span>
          <h3>{reference.title}</h3>
          <p>{reference.notes}</p>
          <small>{reference.publication_year ?? '年份待补充'}</small>
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`status ${status}`}>{statusLabels[status as keyof typeof statusLabels] ?? status}</span>;
}

export default App;
