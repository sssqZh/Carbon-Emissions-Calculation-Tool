// ============================================================================
// Carbon Emission Calculation Engine (ESM / plain JS for Node server)
// ============================================================================

// ---- Emission Factor Constants ----

const TRAVEL_FACTORS = {
  gas_car:     { label: '汽油私家车',     value: 0.180, unit: 'kgCO2e/km' },
  ev_car:      { label: '纯电动车',       value: 0.050, unit: 'kgCO2e/km' },
  bus:         { label: '公共汽车',       value: 0.030, unit: 'kgCO2e/pkm' },
  subway:      { label: '地铁/轻轨',      value: 0.015, unit: 'kgCO2e/pkm' },
  train:       { label: '高铁/火车',      value: 0.019, unit: 'kgCO2e/pkm' },
  flight:      { label: '飞机（经济舱）', value: 0.139, unit: 'kgCO2e/pkm' },
};

const DIET_FACTORS = {
  meat_heavy:  { label: '肉食爱好者', value: 9.0 },
  balanced:    { label: '均衡饮食',   value: 6.0 },
  pescatarian: { label: '素食/鱼素',  value: 4.1 },
  vegan:       { label: '纯素食',     value: 2.7 },
};

const HOUSING_FACTORS = {
  electricity: { label: '电力',   value: 0.5568, unit: 'kgCO2e/kWh' },
  gas:         { label: '天然气', value: 2.160,  unit: 'kgCO2e/m³' },
  water:       { label: '自来水', value: 0.168,  unit: 'kgCO2e/t' },
};

const CONSUMPTION_FACTORS = {
  clothing: { label: '新购衣物',   value: 10.0,  unit: 'kgCO2e/件' },
  phone:    { label: '手机/平板',  value: 80.0,  unit: 'kgCO2e/台' },
  computer: { label: '电脑/笔记本', value: 250.0, unit: 'kgCO2e/台' },
};

const POWER_GEN_FACTORS = {
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

const FOOD_FACTORS = {
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

const PORTION_WEIGHT = 0.2;
const TREE_CO2_PER_YEAR = 18.3;

// ---- Helpers ----

function safeNum(inputs, key) {
  const v = inputs[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function safeBool(inputs, key) {
  const v = inputs[key];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v === 'true' || v === '1';
  return false;
}

// ============================================================================
// Calculator: 个人碳足迹估算
// ============================================================================

function calculatePersonalFootprint(inputs) {
  const breakdown = [];
  let travelTotal = 0;

  const travelKeys = [
    { key: 'gas_car_km', factorKey: 'gas_car' },
    { key: 'ev_car_km', factorKey: 'ev_car' },
    { key: 'bus_km', factorKey: 'bus' },
    { key: 'subway_km', factorKey: 'subway' },
    { key: 'train_km', factorKey: 'train' },
    { key: 'flight_km', factorKey: 'flight' },
  ];

  for (const { key, factorKey } of travelKeys) {
    const distance = safeNum(inputs, key);
    if (distance > 0) {
      const f = TRAVEL_FACTORS[factorKey];
      const emission = distance * f.value;
      travelTotal += emission;
      breakdown.push({
        category: '出行',
        label: f.label,
        value: +emission.toFixed(4),
        unit: 'kgCO2e',
        formula: `${distance} km × ${f.value} kgCO2e/km`,
      });
    }
  }

  let dietTotal = 0;
  const dietType = String(inputs.diet_type || 'balanced');
  const dietDays = safeNum(inputs, 'diet_days') || 365;

  if (DIET_FACTORS[dietType]) {
    const d = DIET_FACTORS[dietType];
    dietTotal = dietDays * d.value;
    breakdown.push({
      category: '饮食',
      label: d.label,
      value: +dietTotal.toFixed(4),
      unit: 'kgCO2e',
      formula: `${dietDays} 天 × ${d.value} kgCO2e/天`,
    });
  }

  let housingTotal = 0;
  const electricityKwh = safeNum(inputs, 'electricity_kwh');
  if (electricityKwh > 0) {
    const e = electricityKwh * HOUSING_FACTORS.electricity.value;
    housingTotal += e;
    breakdown.push({
      category: '居住',
      label: '用电',
      value: +e.toFixed(4),
      unit: 'kgCO2e',
      formula: `${electricityKwh} kWh × ${HOUSING_FACTORS.electricity.value} kgCO2e/kWh`,
    });
  }

  const gasM3 = safeNum(inputs, 'gas_m3');
  if (gasM3 > 0) {
    const e = gasM3 * HOUSING_FACTORS.gas.value;
    housingTotal += e;
    breakdown.push({
      category: '居住',
      label: '天然气',
      value: +e.toFixed(4),
      unit: 'kgCO2e',
      formula: `${gasM3} m³ × ${HOUSING_FACTORS.gas.value} kgCO2e/m³`,
    });
  }

  const waterTons = safeNum(inputs, 'water_tons');
  if (waterTons > 0) {
    const e = waterTons * HOUSING_FACTORS.water.value;
    housingTotal += e;
    breakdown.push({
      category: '居住',
      label: '自来水',
      value: +e.toFixed(4),
      unit: 'kgCO2e',
      formula: `${waterTons} t × ${HOUSING_FACTORS.water.value} kgCO2e/t`,
    });
  }

  let consumptionTotal = 0;
  const clothingCount = safeNum(inputs, 'clothing_count');
  if (clothingCount > 0) {
    const e = clothingCount * CONSUMPTION_FACTORS.clothing.value;
    consumptionTotal += e;
    breakdown.push({
      category: '消费',
      label: CONSUMPTION_FACTORS.clothing.label,
      value: +e.toFixed(4),
      unit: 'kgCO2e',
      formula: `${clothingCount} 件 × ${CONSUMPTION_FACTORS.clothing.value} kgCO2e/件`,
    });
  }

  const phoneCount = safeNum(inputs, 'phone_count');
  if (phoneCount > 0) {
    const e = phoneCount * CONSUMPTION_FACTORS.phone.value;
    consumptionTotal += e;
    breakdown.push({
      category: '消费',
      label: CONSUMPTION_FACTORS.phone.label,
      value: +e.toFixed(4),
      unit: 'kgCO2e',
      formula: `${phoneCount} 台 × ${CONSUMPTION_FACTORS.phone.value} kgCO2e/台`,
    });
  }

  const computerCount = safeNum(inputs, 'computer_count');
  if (computerCount > 0) {
    const e = computerCount * CONSUMPTION_FACTORS.computer.value;
    consumptionTotal += e;
    breakdown.push({
      category: '消费',
      label: CONSUMPTION_FACTORS.computer.label,
      value: +e.toFixed(4),
      unit: 'kgCO2e',
      formula: `${computerCount} 台 × ${CONSUMPTION_FACTORS.computer.value} kgCO2e/台`,
    });
  }

  const total = travelTotal + dietTotal + housingTotal + consumptionTotal;

  return {
    total_emission: +total.toFixed(4),
    emission_unit: 'kgCO2e',
    breakdown,
    formula_version: '1.0',
    tree_offset: +(total / TREE_CO2_PER_YEAR).toFixed(1),
  };
}

// ============================================================================
// Calculator: 当地电网平均碳排放因子
// ============================================================================

function calculateGridEmission(inputs) {
  const breakdown = [];
  let weightedTotal = 0;

  const powerKeys = [
    { key: 'coal_pct', factorKey: 'coal' },
    { key: 'gas_gen_pct', factorKey: 'gas_gen' },
    { key: 'solar_pct', factorKey: 'solar' },
    { key: 'biomass_pct', factorKey: 'biomass' },
    { key: 'wind_pct', factorKey: 'wind' },
    { key: 'csp_pct', factorKey: 'csp' },
    { key: 'hydro_pct', factorKey: 'hydro' },
    { key: 'nuclear_pct', factorKey: 'nuclear' },
  ];

  for (const { key, factorKey } of powerKeys) {
    const pct = safeNum(inputs, key);
    if (pct > 0) {
      const f = POWER_GEN_FACTORS[factorKey];
      const contribution = (pct / 100) * f.value;
      weightedTotal += contribution;
      breakdown.push({
        category: '发电能源',
        label: f.label,
        value: +contribution.toFixed(6),
        unit: 'kgCO2e/kWh',
        formula: `${pct}% × ${f.value} kgCO2e/kWh = ${+contribution.toFixed(6)}`,
      });
    }
  }

  let transmission = 0;
  const includeTx = safeBool(inputs, 'include_transmission');
  if (includeTx) {
    transmission = TRANSMISSION_FACTOR;
    breakdown.push({
      category: '输配电',
      label: '电网输配电修正',
      value: transmission,
      unit: 'kgCO2e/kWh',
      formula: `输配电修正系数: ${TRANSMISSION_FACTOR} kgCO2e/kWh`,
    });
  }

  const gridFactor = weightedTotal + transmission;

  // Optional: if electricity_amount is provided, compute total emission
  const electricityAmount = safeNum(inputs, 'electricity_amount');
  const totalEmission = electricityAmount > 0 ? gridFactor * electricityAmount : gridFactor;

  const result = {
    total_emission: +totalEmission.toFixed(4),
    emission_unit: 'kgCO2e/kWh',
    breakdown,
    formula_version: '1.0',
    tree_offset: +(total / TREE_CO2_PER_YEAR).toFixed(1),
  };

  if (electricityAmount > 0) {
    result.grid_factor = +gridFactor.toFixed(6);
    result.emission_unit = 'kgCO2e';
    result.computed_emission = {
      grid_factor: +gridFactor.toFixed(6),
      electricity_amount: electricityAmount,
      total_emission: +totalEmission.toFixed(4),
    };
  }

  return result;
}

// ============================================================================
// Calculator: 火锅碳排放测算
// ============================================================================

function calculateHotpotEmission(inputs) {
  const breakdown = [];
  let total = 0;

  const foodKeys = [
    { key: 'beef_portions', factorKey: 'beef' },
    { key: 'mutton_portions', factorKey: 'mutton' },
    { key: 'pork_portions', factorKey: 'pork' },
    { key: 'chicken_portions', factorKey: 'chicken' },
    { key: 'seafood_portions', factorKey: 'seafood' },
    { key: 'tofu_portions', factorKey: 'tofu' },
    { key: 'mushroom_portions', factorKey: 'mushroom' },
    { key: 'vegetable_portions', factorKey: 'vegetable' },
    { key: 'potato_portions', factorKey: 'potato' },
    { key: 'staple_portions', factorKey: 'staple' },
  ];

  const diners = Math.max(safeNum(inputs, 'diners'), 1);

  for (const { key, factorKey } of foodKeys) {
    const portions = safeNum(inputs, key);
    if (portions > 0) {
      const f = FOOD_FACTORS[factorKey];
      const weight = portions * PORTION_WEIGHT;
      const emission = weight * f.value;
      total += emission;
      breakdown.push({
        category: '食材',
        label: f.label,
        value: +emission.toFixed(4),
        unit: 'kgCO2e',
        formula: `${portions} 份 × 0.2kg × ${f.value} kgCO2e/kg = ${+emission.toFixed(4)}`,
      });
    }
  }

  const perCapita = total / diners;

  breakdown.push({
    category: '汇总',
    label: `人均排放（${diners}人）`,
    value: +perCapita.toFixed(4),
    unit: 'kgCO2e/人',
    formula: `${+total.toFixed(4)} ÷ ${diners} 人 = ${+perCapita.toFixed(4)}`,
  });

  return {
    total_emission: +total.toFixed(4),
    emission_unit: 'kgCO2e',
    breakdown,
    formula_version: '1.0',
    tree_offset: +(total / TREE_CO2_PER_YEAR).toFixed(1),
  };
}

// ============================================================================
// Router
// ============================================================================

export function calculate(slug, inputs) {
  switch (slug) {
    case 'personal-footprint':
      return calculatePersonalFootprint(inputs);
    case 'grid-emission-factor':
      return calculateGridEmission(inputs);
    case 'hotpot-emission':
      return calculateHotpotEmission(inputs);
    default:
      throw new Error(`Unknown calculator slug: ${slug}`);
  }
}
