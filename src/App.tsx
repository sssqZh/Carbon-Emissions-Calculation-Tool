import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpenText,
  Calculator as CalculatorIcon,
  CheckCircle,
  Clock3,
  Database,
  Flame,
  Leaf,
  Moon,
  Save,
  Sun,
  Zap,
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

const statusLabels: Record<string, string> = {
  draft: '草稿',
  active: '已启用',
  maintenance: '维护中',
  archived: '已归档',
};

const calculatorIcons: Record<string, LucideIcon> = {
  'personal-footprint': Leaf,
  'grid-emission-factor': Zap,
  'hotpot-emission': Flame,
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
    document.documentElement.classList.toggle('dark', theme === 'dark');
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

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    if (!selectedSlug) return;
    let active = true;
    fetchCalculatorDetail(selectedSlug)
      .then((detail) => { if (active) setSelectedCalculator(detail); })
      .catch((err) => { if (active) setError(err instanceof Error ? err.message : '计算器加载失败'); });
    return () => { active = false; };
  }, [selectedSlug]);

  const activeCount = useMemo(
    () => calculators.filter((c) => c.status === 'active').length,
    [calculators],
  );

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-[#080c09] dark:text-white relative overflow-hidden">
      {/* ── Ambient glow blobs (dark only) ── */}
      <div className="glow-blob w-[500px] h-[500px] bg-green-500/10 -top-32 -right-32" />
      <div className="glow-blob w-[400px] h-[400px] bg-teal-500/8 bottom-0 -left-32" />
      <div className="glow-blob w-[300px] h-[300px] bg-emerald-600/[0.04] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />

      {/* ── App shell ── */}
      <div className="relative z-10 flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-[260px] min-h-screen border-r border-gray-200 bg-white/80 backdrop-blur-sm dark:border-white/[0.06] dark:bg-[#080c09]/70 flex flex-col gap-6 p-5 shrink-0">
          <div className="flex items-center gap-3 px-2">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-eco-100 text-eco-600 border border-eco-200 dark:bg-eco-500/15 dark:text-eco-400 dark:border-eco-500/30">
              <Leaf size={20} />
            </div>
            <div>
              <strong className="block text-sm font-bold">轻量碳排放计算器</strong>
              <span className="block text-[11px] text-gray-400 mt-0.5">Lite Carbon Calc</span>
            </div>
          </div>

          <nav className="grid gap-1" aria-label="主导航">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = view === item.key;
              return (
                <button
                  key={item.key}
                  className={`sidebar-link relative ${isActive ? 'active' : ''}`}
                  onClick={() => setView(item.key)}
                  type="button"
                >
                  <Icon size={18} className={isActive ? 'text-eco-600 dark:text-eco-400' : 'text-gray-400 dark:text-gray-500'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0 p-8">
          {/* Topbar */}
          <header className="flex items-center justify-between gap-4 mb-7">
            <h1 className="text-[26px] font-bold tracking-tight">{getViewTitle(view)}</h1>
            <div className="flex items-center gap-2">
              <button
                className="grid place-items-center w-9 h-9 rounded-xl border border-gray-200 bg-white text-gray-400 hover:text-gray-700 hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:text-white dark:hover:border-white/20 transition-colors"
                onClick={toggleTheme}
                type="button"
                title={theme === 'light' ? '切换暗色模式' : '切换亮色模式'}
              >
                {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
              </button>
              <button
                className="inline-flex items-center gap-2 min-h-[36px] px-3.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-gray-400 dark:hover:text-white dark:hover:border-white/20 transition-all"
                onClick={refresh}
                type="button"
              >
                <Activity size={16} />
                <span>刷新</span>
              </button>
            </div>
          </header>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-sm dark:border-red-500/20 dark:bg-red-500/5 dark:text-red-400">
              {error}
            </div>
          )}

          {loading ? (
            <div className="px-4 py-4 rounded-xl border border-gray-200 bg-white text-gray-400 text-sm dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-gray-400">
              正在加载数据...
            </div>
          ) : (
            <>
              {view === 'dashboard' && (
                <Dashboard
                  calculators={calculators}
                  activeCount={activeCount}
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
    </div>
  );
}

/* ====================================================================== */

function getViewTitle(view: ViewKey) {
  const map: Record<ViewKey, string> = {
    dashboard: '轻量碳排放计算器',
    calculators: '计算器工作台',
    factors: '排放因子库',
    records: '历史记录',
    references: '参考资料',
  };
  return map[view];
}

/* ====================================================================== */

function Dashboard({
  calculators,
  activeCount,
  factorCount,
  recordCount,
  onOpenCalculators,
}: {
  calculators: Calculator[];
  activeCount: number;
  factorCount: number;
  recordCount: number;
  onOpenCalculators: () => void;
}) {
  return (
    <div className="grid gap-6">
      {/* ── Hero calculator cards ── */}
      <div>
        <div className="mb-3">
          <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-widest">开始测算</p>
          <h2 className="text-lg font-bold mt-0.5">选择要使用的碳排放计算工具</h2>
        </div>
        <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
          {calculators.map((calc) => {
            const Icon = calculatorIcons[calc.slug] ?? Leaf;
            return (
              <article
                key={calc.slug}
                className="hero-card group"
                onClick={() => onOpenCalculators()}
              >
                {/* Watermark icon */}
                <Icon className="absolute -bottom-3 -right-3 w-28 h-28 text-green-500/[0.04] -rotate-12 pointer-events-none" />

                {/* Icon badge */}
                <div className="bg-eco-100 text-eco-600 dark:bg-eco-500/15 dark:text-eco-400 p-2.5 rounded-xl w-fit">
                  <Icon size={22} />
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-eco-600 dark:text-eco-400 uppercase tracking-wider">
                    {calc.category}
                  </span>
                  <StatusBadge status={calc.status} />
                </div>

                <h3 className="text-base font-bold">{calc.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{calc.description}</p>

                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500 group-hover:text-eco-600 dark:group-hover:text-eco-400 transition-all duration-300 mt-1">
                  <span>进入测算</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </article>
            );
          })}
        </div>
      </div>

      {/* ── System metrics (de-emphasized) ── */}
      <div>
        <p className="text-[11px] font-semibold text-gray-300 dark:text-gray-600 uppercase tracking-widest mb-3">系统数据</p>
        <div className="grid grid-cols-4 gap-3 max-lg:grid-cols-2">
          <MetricCard icon={CalculatorIcon} label="计算器模块" value={calculators.length} />
          <MetricCard icon={Database} label="排放因子" value={factorCount} />
          <MetricCard icon={Clock3} label="历史记录" value={recordCount} />
          <MetricCard icon={CheckCircle} label="公式版本" value={3} />
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <article className="metric-card">
      <Icon size={16} className="text-gray-300 dark:text-gray-500" />
      <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{label}</span>
      <strong className="text-[28px] font-bold tracking-tight text-gray-500 dark:text-gray-300">{value}</strong>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'active' ? 'badge-active' :
    status === 'draft' ? 'badge-draft' :
    'badge-muted';
  return <span className={cls}>{statusLabels[status] ?? status}</span>;
}

/* ====================================================================== */

function CalculatorsView({
  calculators, selectedSlug, selectedCalculator, onSelect, onRecordCreated,
}: {
  calculators: Calculator[];
  selectedSlug: string | null;
  selectedCalculator: CalculatorDetail | null;
  onSelect: (slug: string) => void;
  onRecordCreated: () => void;
}) {
  return (
    <div className="grid grid-cols-[320px_1fr] gap-4 items-start max-lg:grid-cols-1">
      <div className="grid gap-2">
        {calculators.map((calc) => (
          <button
            key={calc.slug}
            className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer
              ${selectedSlug === calc.slug
                ? 'border-eco-400 bg-eco-50 dark:border-eco-500/50 dark:bg-eco-500/[0.06] shadow-[0_0_0_3px_rgba(46,160,67,0.08)]'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-white/[0.06] dark:bg-white/[0.02] dark:hover:border-white/10'}`}
            onClick={() => onSelect(calc.slug)}
            type="button"
          >
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{calc.category}</span>
            <strong className="block text-sm mt-0.5">{calc.name}</strong>
            <small className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5 leading-relaxed">{calc.description}</small>
          </button>
        ))}
      </div>

      <div>
        {selectedCalculator ? (
          <CalculatorDetailPanel calculator={selectedCalculator} onRecordCreated={onRecordCreated} />
        ) : (
          <div className="px-4 py-10 text-center text-gray-400 dark:text-gray-500 text-sm rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
            请选择一个计算器
          </div>
        )}
      </div>
    </div>
  );
}

/* ====================================================================== */

function CalculatorDetailPanel({
  calculator, onRecordCreated,
}: {
  calculator: CalculatorDetail;
  onRecordCreated: () => void;
}) {
  const initialState = useMemo(() => buildInitialFormState(calculator.fields), [calculator.fields]);
  const [formState, setFormState] = useState<FormState>(initialState);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const liveResult = useMemo(() => {
    try { return calculate(calculator.slug, formState); }
    catch { return null; }
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

  const carbonLevel = liveResult
    ? liveResult.total_emission < 10 ? 'low' : liveResult.total_emission < 1000 ? 'mid' : 'high'
    : null;

  return (
    <div className="grid gap-4">
      {/* Heading */}
      <div className="p-5 rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-eco-600 dark:text-eco-400 uppercase tracking-wider">{calculator.category}</span>
          <StatusBadge status={calculator.status} />
        </div>
        <h2 className="text-xl font-bold">{calculator.name}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{calculator.description}</p>
      </div>

      {/* Carbon health bar */}
      {liveResult && liveResult.total_emission > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 dark:bg-white/[0.03] dark:border-white/[0.06]">
          <span className={`text-sm font-semibold carbon-${carbonLevel}`}>
            {liveResult.total_emission} {liveResult.emission_unit}
          </span>
          <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                carbonLevel === 'low' ? 'bg-green-500 w-[15%]' :
                carbonLevel === 'mid' ? 'bg-yellow-500 w-[50%]' :
                'bg-orange-500 w-[85%]'
              }`}
            />
          </div>
          <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
            🌳 {liveResult.tree_offset} 棵树/年
          </span>
        </div>
      )}

      {/* Form */}
      <form className="grid grid-cols-2 gap-3 max-lg:grid-cols-1" onSubmit={handleSubmit}>
        {calculator.fields.map((field) => (
          <FieldInput
            key={field.field_key}
            field={field}
            value={formState[field.field_key]}
            onChange={(v) => setFormState((prev) => ({ ...prev, [field.field_key]: v }))}
          />
        ))}

        {/* Result shell */}
        <div className="col-span-full flex items-center justify-between gap-4 p-4 rounded-xl border border-eco-200 bg-eco-50 dark:border-eco-500/20 dark:bg-eco-500/[0.04]">
          <div>
            <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1">结果预览</p>
            {liveResult && liveResult.total_emission > 0 ? (
              <>
                <strong className={`text-xl font-bold carbon-${carbonLevel}`}>
                  {liveResult.total_emission} {liveResult.emission_unit}
                </strong>
                {liveResult.tree_offset > 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    🌳 需要 <span className="font-bold text-eco-600 dark:text-eco-400">{liveResult.tree_offset}</span> 棵树生长 1 年来抵消
                  </p>
                )}
                {liveResult.breakdown.length > 0 && (
                  <div className="grid gap-0.5 mt-2">
                    {liveResult.breakdown.map((item, i) => (
                      <span key={i} className="text-xs text-gray-400 dark:text-gray-500">
                        {item.label}: {item.value} {item.unit}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <strong className="text-lg font-bold text-gray-400 dark:text-gray-500">等待输入</strong>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">填写上方字段后这里将显示实时估算结果。</p>
              </>
            )}
          </div>
          <button
            className="inline-flex items-center gap-2 min-h-[38px] px-4 rounded-xl bg-eco-600 hover:bg-eco-500 text-white text-sm font-medium transition-all duration-200 hover:-translate-y-px shrink-0"
            type="submit"
          >
            <Save size={16} />
            <span>保存记录</span>
          </button>
        </div>
      </form>

      {savedMessage && (
        <div className="px-4 py-3 rounded-xl border border-eco-200 bg-eco-50 text-eco-700 text-sm dark:border-eco-500/20 dark:bg-eco-500/[0.06] dark:text-eco-400">
          {savedMessage}
        </div>
      )}

      {/* Formula versions */}
      <div>
        <h3 className="text-sm font-bold mb-2">公式版本</h3>
        <div className="grid gap-2">
          {calculator.formulaVersions.map((fv) => (
            <article key={fv.id} className="p-3.5 rounded-xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm">{fv.version}</strong>
                <StatusBadge status={fv.status} />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 leading-relaxed">{fv.formula_text}</p>
              {fv.assumptions && <small className="block text-xs text-gray-400 dark:text-gray-500 mt-1">{fv.assumptions}</small>}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ====================================================================== */

function buildInitialFormState(fields: CalculatorField[]): FormState {
  return fields.reduce<FormState>((state, field) => {
    if (field.field_type === 'boolean') state[field.field_key] = false;
    else if (field.field_type === 'select') state[field.field_key] = field.options?.[0] ?? '';
    else state[field.field_key] = '';
    return state;
  }, {});
}

function FieldInput({ field, value, onChange }: {
  field: CalculatorField;
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}) {
  return (
    <label className="field-card">
      <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
        {field.label}
        {field.required && <b className="ml-0.5 text-red-500">*</b>}
      </span>
      {field.field_type === 'select' ? (
        <select
          value={String(value)}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        >
          {(field.options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.field_type === 'boolean' ? (
        <input
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          type="checkbox"
        />
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
          <input
            min={typeof field.validation?.min === 'number' ? field.validation.min : undefined}
            max={typeof field.validation?.max === 'number' ? field.validation.max : undefined}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            type={field.field_type}
            value={String(value)}
          />
          {field.unit && <em className="text-xs text-gray-400 dark:text-gray-500 not-italic min-w-[40px]">{field.unit}</em>}
        </div>
      )}
      {field.help_text && <small className="text-[11px] text-gray-400 dark:text-gray-500 leading-relaxed">{field.help_text}</small>}
    </label>
  );
}

/* ====================================================================== */

function FactorsView({ factors }: { factors: EmissionFactor[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
      <table className="w-full min-w-[720px] border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/[0.02]">
            <Th>名称</Th><Th>分类</Th><Th>地区</Th><Th>年份</Th><Th>数值</Th><Th>单位</Th><Th>来源</Th>
          </tr>
        </thead>
        <tbody>
          {factors.map((f) => (
            <tr key={f.id} className="border-b border-gray-100 dark:border-white/[0.04] last:border-0">
              <Td>{f.name}</Td>
              <Td>{f.category}</Td>
              <Td>{f.region ?? '—'}</Td>
              <Td>{f.year ?? '—'}</Td>
              <Td className="tabular-nums font-mono text-sm">{f.value ?? '—'}</Td>
              <Td>{f.unit ?? '—'}</Td>
              <Td className="text-xs max-w-[180px] truncate">{f.source_title ?? '—'}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3.5 py-3 text-left text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">{children}</th>;
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-300 ${className ?? ''}`}>{children}</td>;
}

/* ====================================================================== */

function RecordsView({ records }: { records: CalculationRecord[] }) {
  if (records.length === 0) {
    return (
      <div className="px-4 py-10 text-center text-gray-400 dark:text-gray-500 text-sm rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
        暂无计算记录。保存任意计算器计算结果后会显示在这里。
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white dark:border-white/[0.06] dark:bg-white/[0.02]">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-white/[0.02]">
            <Th>标题</Th><Th>计算器</Th><Th>总排放</Th><Th>分项数</Th><Th>创建时间</Th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-gray-100 dark:border-white/[0.04] last:border-0">
              <Td>{r.title}</Td>
              <Td>{r.calculator_name}</Td>
              <Td className="tabular-nums font-mono text-sm">
                {r.total_emission === null ? '—' : `${r.total_emission} ${r.emission_unit}`}
              </Td>
              <Td>{r.result_snapshot?.breakdown?.length ?? 0}</Td>
              <Td className="text-xs text-gray-400 dark:text-gray-500">{r.created_at}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ====================================================================== */

function ReferencesView({ references }: { references: ReferenceItem[] }) {
  return (
    <div className="grid grid-cols-3 gap-4 max-lg:grid-cols-1">
      {references.map((ref) => (
        <article key={ref.id} className="metric-card">
          <span className="text-[11px] font-semibold text-eco-600 dark:text-eco-400 uppercase tracking-wider">
            {ref.organization ?? '待补充机构'}
          </span>
          <h3 className="text-base font-bold">{ref.title}</h3>
          {ref.notes && <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{ref.notes}</p>}
          <small className="text-xs text-gray-400 dark:text-gray-500">{ref.publication_year ?? '年份待补充'}</small>
        </article>
      ))}
    </div>
  );
}

export default App;
