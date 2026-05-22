import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenText,
  Calculator as CalculatorIcon,
  CheckCircle,
  Clock3,
  Database,
  Leaf,
  Moon,
  Plus,
  Save,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { calculate } from '../shared/calculations';
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

function getInitialTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [view, setView] = useState<ViewKey>('dashboard');
  const [calculators, setCalculators] = useState<Calculator[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [selectedCalculator, setSelectedCalculator] = useState<CalculatorDetail | null>(null);
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [records, setRecords] = useState<CalculationRecord[]>([]);
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'light' ? 'dark' : 'light'));
  }

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
          <h1>{getViewTitle(view)}</h1>
          <div className="topbar-right">
            <button className="theme-toggle" onClick={toggleTheme} type="button" title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}>
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <button className="icon-button" onClick={refresh} type="button" title="刷新数据">
              <Activity size={18} />
              <span>刷新</span>
            </button>
          </div>
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
      return '轻量碳排放计算器';
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

function getCalculatorEmoji(slug: string) {
  switch (slug) {
    case 'personal-footprint': return '\u{1F6B6}';
    case 'grid-emission-factor': return '\u26A1';
    case 'hotpot-emission': return '\u{1F372}';
    default: return '\u{1F30D}';
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
      {/* ── 核心操作区：计算器卡片（置顶） ── */}
      <div>
        <div className="section-header">
          <p className="eyebrow">开始测算</p>
          <h2>选择要使用的碳排放计算工具</h2>
        </div>
        <div className="calculator-grid">
          {calculators.map((calculator) => (
            <article
              className="calculator-card hero-card"
              key={calculator.slug}
              onClick={() => onOpenCalculators()}
            >
              <span className="card-emoji-badge">{getCalculatorEmoji(calculator.slug)}</span>
              <div className="card-topline">
                <span className="category">{calculator.category}</span>
                <StatusBadge status={calculator.status} />
              </div>
              <h3>{calculator.name}</h3>
              <p>{calculator.description}</p>
              <div className="card-cta">
                <span>进入测算</span>
                <ArrowRight size={16} />
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* ── 系统数据概览（降级到底部） ── */}
      <div>
        <div className="section-header">
          <p className="eyebrow">系统数据</p>
        </div>
        <div className="metric-grid metric-grid-compact">
          <Metric icon={CalculatorIcon} label="计算器模块" value={calculators.length} trend="全部已启用" />
          <Metric icon={Database} label="排放因子" value={factorCount} trend="权威数据源" />
          <Metric icon={Clock3} label="历史记录" value={recordCount} trend="计算记录" />
          <Metric icon={CheckCircle} label="公式版本" value={3} trend="v1.0 正式版" />
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  trend?: string;
}) {
  return (
    <article className="metric">
      <div className="metric-icon">
        <Icon size={18} />
      </div>
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {trend && <span className="metric-trend">{trend}</span>}
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

  // Live preview calculation
  const liveResult = useMemo(() => {
    try {
      return calculate(calculator.slug, formState);
    } catch {
      return null;
    }
  }, [calculator.slug, formState]);

  useEffect(() => {
    setFormState(initialState);
    setSavedMessage(null);
  }, [initialState]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavedMessage(null);
    await createDraftRecord(calculator.slug, formState);
    setSavedMessage(liveResult
      ? `已保存计算记录，总排放量: ${liveResult.total_emission} ${liveResult.emission_unit}`
      : '已保存计算记录。');
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
            {liveResult && liveResult.total_emission > 0 ? (
              <>
                <strong>{liveResult.total_emission} {liveResult.emission_unit}</strong>
                {liveResult.tree_offset > 0 && (
                  <p className="tree-offset">
                    🌳 需要 <em>{liveResult.tree_offset}</em> 棵树生长 1 年来抵消
                  </p>
                )}
                {liveResult.breakdown.length > 0 && (
                  <div className="breakdown-list">
                    {liveResult.breakdown.map((item, i) => (
                      <span key={i}>
                        {item.label}: {item.value} {item.unit}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <strong>等待输入</strong>
                <span>填写上方字段后这里将显示实时估算结果。</span>
              </>
            )}
          </div>
          <button className="primary-button" type="submit">
            <Save size={18} />
            <span>保存记录</span>
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
    return <div className="empty-state">暂无计算记录。保存任意计算器计算结果后会显示在这里。</div>;
  }

  return (
    <section className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>标题</th>
            <th>计算器</th>
            <th>总排放</th>
            <th>分项数</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>{record.title}</td>
              <td>{record.calculator_name}</td>
              <td>{record.total_emission === null ? '计算失败' : `${record.total_emission} ${record.emission_unit}`}</td>
              <td>{record.result_snapshot?.breakdown?.length ?? 0}</td>
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
