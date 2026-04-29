// 美甲服务时长估算配置
// 单位：小时（可为小数，如 0.5 表示30分钟）
// 方便后续随时调整

export const ESTIMATE_CONFIG = {
  // 长度对应的基准时长
  length: {
    '本甲': 2,
    '短甲': 2,
    '中长': 3,
    '长甲': 3.5,
    '延长': 4,
    '待定': 2, // 默认按本甲估算
  },

  // 款式叠加时长（在长度基准上累加）
  style: {
    '纯色': 0,      // 纯色不额外加时间，已包含在长度基准的前置+涂色里
    '跳色': 0.5,    // 跳色略复杂
    '法式': 1,      // 法式需要画边
    '猫眼': 0.5,    // 猫眼吸光
    '渐变': 1,      // 渐变晕染
    '设计': 1.5,    // 一般设计款
    '待定': 0,      // 未定不额外加
  },

  // 卸甲叠加时长
  remove: {
    '需要': 0.5,    // 卸甲平均30分钟
    '不需要': 0,
    '待定': 0,
  },
};

// 价格估算配置（人民币）
// 可根据实际定价调整
export const PRICE_CONFIG = {
  // 长度基础价格
  length: {
    '本甲': 158,
    '短甲': 158,
    '中长': 228,
    '长甲': 268,
    '延长': 328,
    '待定': 158,
  },

  // 款式加价
  style: {
    '纯色': 0,
    '跳色': 20,
    '法式': 50,
    '猫眼': 30,
    '渐变': 50,
    '设计': 80,
    '待定': 0,
  },

  // 卸甲价格
  remove: {
    '需要': 30,
    '不需要': 0,
    '待定': 0,
  },
};

// 计算预估时长（返回小时数）
export function estimateDuration(length, styles, remove) {
  const base = ESTIMATE_CONFIG.length[length] ?? ESTIMATE_CONFIG.length['待定'];
  let styleAdd = 0;
  if (Array.isArray(styles) && styles.length > 0) {
    styleAdd = Math.max(...styles.map(s => ESTIMATE_CONFIG.style[s] ?? 0));
    // 如果选了多个款式，取最大值，再额外加0.5小时作为复杂叠加
    if (styles.length > 1) {
      styleAdd += 0.5;
    }
  }
  const removeAdd = ESTIMATE_CONFIG.remove[remove] ?? 0;
  return base + styleAdd + removeAdd;
}

// 计算预估价格（返回人民币）
export function estimatePrice(length, styles, remove) {
  const base = PRICE_CONFIG.length[length] ?? PRICE_CONFIG.length['待定'];
  let styleAdd = 0;
  if (Array.isArray(styles) && styles.length > 0) {
    styleAdd = Math.max(...styles.map(s => PRICE_CONFIG.style[s] ?? 0));
    if (styles.length > 1) {
      styleAdd += 30;
    }
  }
  const removeAdd = PRICE_CONFIG.remove[remove] ?? 0;
  return base + styleAdd + removeAdd;
}

// 格式化时长显示（如 2.5 -> "2小时30分钟"）
export function formatDuration(hours) {
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (h > 0 && m > 0) return `${h}小时${m}分钟`;
  if (h > 0) return `${h}小时`;
  return `${m}分钟`;
}
