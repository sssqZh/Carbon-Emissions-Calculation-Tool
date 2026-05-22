-- Migration: Update calculation data with real emission factors and expanded fields

-- Clear old data (respect foreign keys: delete calculation_records first)
DELETE FROM calculation_records;
DELETE FROM emission_factors;
DELETE FROM calculator_fields;
DELETE FROM formula_versions;
DELETE FROM source_references;

-- ============================================================================
-- Source References
-- ============================================================================

INSERT INTO source_references (id, title, organization, publication_year, url, citation, notes) VALUES
  (1, '个人碳足迹计算参考资料', '项目资料', 2026, '/references/personal-carbon-footprint.html', NULL, '出行因子参考国内私家车排量平均水平、深圳市低碳出行方法学等。饮食因子参考牛津大学 Our World in Data 膳食碳足迹研究。'),
  (2, '建筑碳排放计算标准 GB/T 51366-2019', '住房和城乡建设部', 2019, '/references/building-carbon-standard.html', 'GB/T 51366-2019', '用于天然气和自来水等建筑运行相关碳排放因子参考。'),
  (3, '主要能源碳排放因子 附件A', '项目资料', 2026, '/references/energy-emission-factors.html', NULL, '天然气单位燃料排放因子为 2.16 kgCO2/m³。'),
  (4, '2023年电力碳足迹因子数据公告', '生态环境部、国家统计局、国家能源局', 2025, '/references/power-carbon-footprint-2023.html', NULL, '用于电网发电生命周期碳足迹因子。2025年1月发布。'),
  (5, '食品生命周期碳足迹研究', 'Poore & Nemecek (Science 2018)', 2018, '/references/food-lifecycle-study.html', 'Poore, J., & Nemecek, T. (2018). Reducing food''s environmental impacts through producers and consumers. Science.', '用于火锅食材和饮食结构相关碳排放因子。');

-- ============================================================================
-- Update calculator status
-- ============================================================================

UPDATE calculators SET status = 'active', description = '基于出行、饮食、居住和消费数据估算个人年度碳足迹。' WHERE slug = 'personal-footprint';
UPDATE calculators SET status = 'active', description = '根据本地发电结构占比估算电网平均碳排放因子。' WHERE slug = 'grid-emission-factor';
UPDATE calculators SET status = 'active', description = '按火锅食材份数估算一次用餐的食材碳排放。' WHERE slug = 'hotpot-emission';

-- ============================================================================
-- Formula Versions
-- ============================================================================

INSERT INTO formula_versions (id, calculator_id, version, formula_text, assumptions, source_id, status) VALUES
  (1, (SELECT id FROM calculators WHERE slug = 'personal-footprint'), '1.0', '总碳足迹 = 出行 + 饮食 + 居住 + 消费。出行: Σ(各类交通工具里程 × 排放因子)。饮食: 饮食天数 × 膳食类型日排放因子。居住: 用电量×电力因子 + 天然气量×天然气因子 + 用水量×自来水因子。消费: Σ(购买数量 × 单品碳足迹)。', '按年度输入估算，结果单位为 kgCO2e。', 1, 'active'),
  (2, (SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), '1.0', 'EF_grid = Σ(能源占比% ÷ 100 × 发电生命周期碳足迹因子) + (输配电修正 0.0463 如果勾选)。', '各能源占比合计应约等于 100%。输配电修正为可选。', 4, 'active'),
  (3, (SELECT id FROM calculators WHERE slug = 'hotpot-emission'), '1.0', '火锅碳排放 = Σ(份数 × 0.2 kg/份 × 食材碳排放因子)。人均排放 = 总排放 ÷ 用餐人数。', '每份按 200g (0.2 kg) 估算。当前仅计算食材生命周期排放，不含热源和交通。', 5, 'active');

-- ============================================================================
-- Calculator Fields — personal-footprint (14)
-- ============================================================================

INSERT INTO calculator_fields (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order) VALUES
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'gas_car_km', '汽油私家车里程', 'number', 'km', 0, NULL, '{"min":0}', '年度汽油私家车出行距离。', 10),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'ev_car_km', '纯电动车里程', 'number', 'km', 0, NULL, '{"min":0}', '年度电动车出行距离。', 20),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'bus_km', '公共汽车里程', 'number', 'pkm', 0, NULL, '{"min":0}', '年度公交乘客公里 (pkm)。', 30),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'subway_km', '地铁/轻轨里程', 'number', 'pkm', 0, NULL, '{"min":0}', '年度轨道交通乘客公里 (pkm)。', 40),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'train_km', '高铁/火车里程', 'number', 'pkm', 0, NULL, '{"min":0}', '年度铁路乘客公里 (pkm)。', 50),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'flight_km', '飞机经济舱里程', 'number', 'pkm', 0, NULL, '{"min":0}', '年度飞行乘客公里 (pkm)。', 60),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'diet_type', '饮食类型', 'select', NULL, 1, '["meat_heavy","balanced","pescatarian","vegan"]', NULL, 'meat_heavy=肉食爱好者, balanced=均衡饮食, pescatarian=素食/鱼素, vegan=纯素食。', 70),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'diet_days', '饮食天数', 'number', '天', 0, NULL, '{"min":0,"max":366}', '默认按 365 天/年估算。', 80),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'electricity_kwh', '家庭用电量', 'number', 'kWh', 0, NULL, '{"min":0}', '年度家庭用电量。', 90),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'gas_m3', '天然气用量', 'number', 'm³', 0, NULL, '{"min":0}', '年度天然气用量（立方米）。', 100),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'water_tons', '自来水用量', 'number', 't', 0, NULL, '{"min":0}', '年度自来水用量，1 m³ ≈ 1 吨。', 110),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'clothing_count', '新购衣物数量', 'number', '件', 0, NULL, '{"min":0}', '年度新购衣物件数。', 120),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'phone_count', '手机/平板数量', 'number', '台', 0, NULL, '{"min":0}', '年度新购手机或平板数量。', 130),
  ((SELECT id FROM calculators WHERE slug = 'personal-footprint'), 'computer_count', '电脑/笔记本数量', 'number', '台', 0, NULL, '{"min":0}', '年度新购电脑或笔记本数量。', 140);

-- ============================================================================
-- Calculator Fields — grid-emission-factor (10)
-- ============================================================================

INSERT INTO calculator_fields (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order) VALUES
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'coal_pct', '燃煤发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地燃煤发电占比。', 10),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'gas_gen_pct', '燃气发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地燃气发电占比。', 20),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'solar_pct', '光伏发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地光伏发电占比。', 30),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'biomass_pct', '生物质发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地生物质发电占比。', 40),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'wind_pct', '风力发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地风力发电占比。', 50),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'csp_pct', '光热发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地光热发电占比。', 60),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'hydro_pct', '水力发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地水力发电占比。', 70),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'nuclear_pct', '核能发电占比', 'number', '%', 0, NULL, '{"min":0,"max":100}', '本地核能发电占比。', 80),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'include_transmission', '计入输配电修正', 'boolean', NULL, 0, NULL, NULL, '勾选后额外加上 0.0463 kgCO2e/kWh 输配电修正。', 90),
  ((SELECT id FROM calculators WHERE slug = 'grid-emission-factor'), 'electricity_amount', '换算用电量', 'number', 'kWh', 0, NULL, '{"min":0}', '可选，用计算出的电网因子乘以该用电量得出总排放。', 100);

-- ============================================================================
-- Calculator Fields — hotpot-emission (11)
-- ============================================================================

INSERT INTO calculator_fields (calculator_id, field_key, label, field_type, unit, required, options_json, validation_json, help_text, sort_order) VALUES
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'beef_portions', '牛肉份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 10),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'mutton_portions', '羊肉份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 20),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'pork_portions', '猪肉份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 30),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'chicken_portions', '鸡肉/禽肉份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 40),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'seafood_portions', '鱼类/海鲜份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 50),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'tofu_portions', '豆腐/豆制品份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 60),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'mushroom_portions', '菌菇类份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 70),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'vegetable_portions', '蔬菜份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 80),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'potato_portions', '薯类份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 90),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'staple_portions', '主食份数', 'number', '份', 0, NULL, '{"min":0}', '每份按 200g 估算。', 100),
  ((SELECT id FROM calculators WHERE slug = 'hotpot-emission'), 'diners', '用餐人数', 'number', '人', 0, NULL, '{"min":0}', '用于计算人均排放。', 110);

-- ============================================================================
-- Emission Factors — 出行 (6)
-- ============================================================================

INSERT INTO emission_factors (factor_key, name, category, region, year, value, unit, source_id, uncertainty, notes) VALUES
  ('travel.gas_car', '汽油私家车', '出行', '中国', 2026, 0.180, 'kgCO2e/km', 1, '估算值', '国内 1.6L-2.0L 私家车平均综合排放水平测算。'),
  ('travel.ev_car', '纯电动车', '出行', '中国', 2026, 0.050, 'kgCO2e/km', 1, '估算值', '基于全国电力平均碳足迹与新能源车平均能耗（约14kWh/100km）测算。'),
  ('travel.bus', '公共汽车', '出行', '中国', 2026, 0.030, 'kgCO2e/pkm', 1, '估算值', '《深圳市低碳公共出行碳普惠方法学》城市公共交通人均公里排放。'),
  ('travel.subway', '地铁/轻轨', '出行', '中国', 2026, 0.015, 'kgCO2e/pkm', 1, '估算值', '城市轨道交通人均公里排放参考。'),
  ('travel.train', '高铁/火车', '出行', '中国', 2026, 0.019, 'kgCO2e/pkm', 1, '估算值', '国际能源署（IEA）铁路客运生命周期排放均值。'),
  ('travel.flight', '飞机经济舱', '出行', '中国', 2026, 0.139, 'kgCO2e/pkm', 1, '估算值', '民航出行人均排放因子通用行业标准。');

-- ============================================================================
-- Emission Factors — 饮食 (4)
-- ============================================================================

INSERT INTO emission_factors (factor_key, name, category, region, year, value, unit, source_id, uncertainty, notes) VALUES
  ('diet.meat_heavy', '肉食爱好者', '饮食', '全球', 2018, 9.0, 'kgCO2e/天', 5, '估算值', '牛津大学 Our World in Data 膳食碳足迹研究。'),
  ('diet.balanced', '均衡饮食', '饮食', '全球', 2018, 6.0, 'kgCO2e/天', 5, '估算值', '每日肉类适量摄入者的平均水平。'),
  ('diet.pescatarian', '素食/鱼素', '饮食', '全球', 2018, 4.1, 'kgCO2e/天', 5, '估算值', '含鱼类但不含其他肉类的膳食模式。'),
  ('diet.vegan', '纯素食', '饮食', '全球', 2018, 2.7, 'kgCO2e/天', 5, '估算值', '完全植物性膳食模式。');

-- ============================================================================
-- Emission Factors — 居住 (3)
-- ============================================================================

INSERT INTO emission_factors (factor_key, name, category, region, year, value, unit, source_id, uncertainty, notes) VALUES
  ('housing.electricity', '电力', '居住', '中国', 2026, 0.5568, 'kgCO2e/kWh', 1, '官方值', '生态环境部、国家统计局公布的全国电力平均CO2排放因子。'),
  ('housing.gas', '天然气', '居住', '中国', 2019, 2.160, 'kgCO2e/m³', 3, '标准值', '附件A 主要能源碳排放因子，天然气单位热值排放折算。'),
  ('housing.water', '自来水', '居住', '中国', 2019, 0.168, 'kgCO2e/t', 2, '标准值', '《建筑碳排放计算标准》GB/T 51366-2019 附录。');

-- ============================================================================
-- Emission Factors — 消费 (3)
-- ============================================================================

INSERT INTO emission_factors (factor_key, name, category, region, year, value, unit, source_id, uncertainty, notes) VALUES
  ('consumption.clothing', '新购衣物', '消费', '全球', 2026, 10.0, 'kgCO2e/件', 1, '估算值', '常见快消衣物（T恤、牛仔裤等）生产生命周期均值。'),
  ('consumption.phone', '手机/平板', '消费', '全球', 2026, 80.0, 'kgCO2e/台', 1, '估算值', '智能电子设备制造和回收生命周期平均碳足迹。'),
  ('consumption.computer', '电脑/笔记本', '消费', '全球', 2026, 250.0, 'kgCO2e/台', 1, '估算值', '常见14寸便携式电脑生命周期平均碳足迹。');

-- ============================================================================
-- Emission Factors — 电网 (9)
-- ============================================================================

INSERT INTO emission_factors (factor_key, name, category, region, year, value, unit, source_id, uncertainty, notes) VALUES
  ('grid.coal', '燃煤发电', '电网', '中国', 2023, 0.9440, 'kgCO2e/kWh', 4, '官方值', '2023年电力碳足迹因子数据——生态环境部、统计局、能源局2025年1月发布。'),
  ('grid.gas_gen', '燃气发电', '电网', '中国', 2023, 0.4792, 'kgCO2e/kWh', 4, '官方值', '同上。'),
  ('grid.solar', '光伏发电', '电网', '中国', 2023, 0.0545, 'kgCO2e/kWh', 4, '官方值', '同上。'),
  ('grid.biomass', '生物质发电', '电网', '中国', 2023, 0.0457, 'kgCO2e/kWh', 4, '官方值', '同上。'),
  ('grid.wind', '风力发电', '电网', '中国', 2023, 0.0336, 'kgCO2e/kWh', 4, '官方值', '同上。'),
  ('grid.csp', '光热发电', '电网', '中国', 2023, 0.0313, 'kgCO2e/kWh', 4, '官方值', '同上。'),
  ('grid.hydro', '水力发电', '电网', '中国', 2023, 0.0143, 'kgCO2e/kWh', 4, '官方值', '同上。'),
  ('grid.nuclear', '核能发电', '电网', '中国', 2023, 0.0065, 'kgCO2e/kWh', 4, '官方值', '同上。'),
  ('grid.transmission', '电网输配电修正', '电网', '中国', 2026, 0.0463, 'kgCO2e/kWh', 1, '估算值', '电网线损及输配电阶段产生的碳足迹修正系数。');

-- ============================================================================
-- Emission Factors — 火锅食材 (10)
-- ============================================================================

INSERT INTO emission_factors (factor_key, name, category, region, year, value, unit, source_id, uncertainty, notes) VALUES
  ('food.beef', '牛肉', '火锅食材', '全球', 2018, 60.0, 'kgCO2e/kg', 5, '估算值', '反刍动物肠道发酵产生高额甲烷气体，碳足迹极高。'),
  ('food.mutton', '羊肉', '火锅食材', '全球', 2018, 40.0, 'kgCO2e/kg', 5, '估算值', '同属反刍动物，碳排仅次于牛肉。'),
  ('food.pork', '猪肉', '火锅食材', '全球', 2018, 12.3, 'kgCO2e/kg', 5, '估算值', '非反刍动物，饲料转化周期相对较长。'),
  ('food.chicken', '鸡肉/禽肉', '火锅食材', '全球', 2018, 9.9, 'kgCO2e/kg', 5, '估算值', '规模化饲养，饲料转化率高。'),
  ('food.seafood', '鱼类/海鲜', '火锅食材', '全球', 2018, 6.0, 'kgCO2e/kg', 5, '估算值', '捕捞或养殖的综合平均值。'),
  ('food.tofu', '豆腐/豆制品', '火锅食材', '全球', 2018, 3.2, 'kgCO2e/kg', 5, '估算值', '优质植物蛋白替代品，碳足迹显著低于肉类。'),
  ('food.mushroom', '菌菇类', '火锅食材', '全球', 2018, 1.5, 'kgCO2e/kg', 5, '估算值', '种植过程需温控、基质加工能耗。'),
  ('food.vegetable', '蔬菜（绿叶菜/大白菜）', '火锅食材', '全球', 2018, 1.0, 'kgCO2e/kg', 5, '估算值', '常规大棚或露天种植及保鲜运输。'),
  ('food.potato', '薯类（土豆/红薯）', '火锅食材', '全球', 2018, 0.5, 'kgCO2e/kg', 5, '估算值', '土地利用率和产量极高，碳足迹极低。'),
  ('food.staple', '主食（面条/粉丝）', '火锅食材', '全球', 2018, 1.5, 'kgCO2e/kg', 5, '估算值', '大米或小麦加工制成品的平均足迹。');
