// 简易 iCal / .ics 解析与事件工具
// 核心逻辑：所有时间计算统一转换为 UTC 时间戳（毫秒）进行比较
// 定义 "Shanghai Time" 为 UTC+8

const WORK_CAL_URL = import.meta.env.VITE_WORK_CAL_URL;
const HOLIDAY_CAL_URL = 'https://calendars.icloud.com/holidays/cn_zh.ics/';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DEMO_MODE = true;

/**
 * 将 .ics 时间字符串解析为 UTC 时间戳 (ms)
 * @param {string} str - e.g. "20260227T100000Z" or "20260227T100000"
 * @returns {number|null} timestamp
 */
function parseICalDateToTimestamp(str) {
  if (!str) return null;
  let s = String(str).trim();
  
  // 1. 处理 YYYYMMDD (全天事件，通常用于节假日)
  // 我们将其视为上海当天的 00:00:00 => 转为 UTC
  const mDate = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (mDate) {
    const [_, y, mo, d] = mDate;
    // 构造上海时间的 00:00:00
    // UTC Timestamp = UTC(y, m-1, d, 0, 0, 0) - 8h
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), 0, 0, 0) - SHANGHAI_OFFSET_MS;
  }

  // 2. 处理 YYYYMMDDThhmmss[Z]
  const isZulu = s.endsWith('Z');
  if (isZulu) s = s.slice(0, -1);
  
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const [_, y, mo, d, h, mi, se] = m;

  if (isZulu) {
    // 已经是 UTC
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se));
  } else {
    // 浮动时间，视为上海时间
    // UTC Timestamp = UTC(y, m-1, d, h, mi, se) - 8h
    return Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(se)) - SHANGHAI_OFFSET_MS;
  }
}

// 解析 .ics 文本为事件列表
function parseICS(text) {
  if (!text) return [];
  // 行续行处理
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    if (/^[ \t]/.test(line) && lines.length > 0) {
      lines[lines.length - 1] += line.trim();
    } else {
      lines.push(line);
    }
  }

  const events = [];
  let current = null;

  lines.forEach(line => {
    if (line.startsWith('BEGIN:VEVENT')) {
      current = {};
    } else if (line.startsWith('END:VEVENT')) {
      if (current) {
        if (current.DTSTART) { 
           // Determine if it is a date-only event (length 8) or date-time
           const isDateOnly = current.DTSTART.length === 8;
           const start = parseICalDateToTimestamp(current.DTSTART);
           
           let end = null;
           if (current.DTEND) {
             end = parseICalDateToTimestamp(current.DTEND);
           } else {
             // Fallback: if date-only, duration is 1 day; otherwise 0 (point)
             // We treat point events as 0 duration, which won't block slots unless we add padding.
             // But usually calendar blocking events have duration.
             if (isDateOnly) {
               end = start + 24 * 60 * 60 * 1000;
             } else {
               end = start;
             }
           }
           
           if (start !== null && end !== null) {
             events.push({
               summary: current.SUMMARY || '',
               start, // timestamp
               end    // timestamp
             });
           }
        }
      }
      current = null;
    } else if (current) {
      const idx = line.indexOf(':');
      if (idx > -1) {
        const rawKey = line.slice(0, idx);
        const value = line.slice(idx + 1);
        const keyOnly = rawKey.split(';')[0].toUpperCase();
        current[keyOnly] = value;
      }
    }
  });

  return events;
}

// 获取 "上海时间" 的当前日期组件
function getShanghaiTodayComponents() {
  const now = Date.now();
  // 当前时间 + 8小时 => 对应的 UTC 时间组件即为上海时间组件
  const d = new Date(now + SHANGHAI_OFFSET_MS);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    d: d.getUTCDate()
  };
}

// 获取未来 N 天的列表（每项包含 y, m, d, weekday）
function getDateRangeDays(days) {
  const res = [];
  const start = getShanghaiTodayComponents();
  
  // 使用 UTC 时间戳来递增天数，避免月份/年份计算错误
  // 基准：上海今天 00:00:00 的“伪”时间戳 (用于计算日期)
  // 其实直接构造 Date(UTC) 递增即可
  const base = Date.UTC(start.y, start.m - 1, start.d, 0, 0, 0);

  // 从今天开始 (i=0) 到 i < days（共 days 天）
  for (let i = 0; i < days; i++) {
    const ts = base + i * 24 * 3600 * 1000;
    const d = new Date(ts); // 这里的 d 是 UTC 时间，其 getUTC... 就是上海的日期
    res.push({
      y: d.getUTCFullYear(),
      m: d.getUTCMonth() + 1,
      d: d.getUTCDate(),
      weekdayIdx: d.getUTCDay(), // 0=Sun, 1=Mon...
      // 我们还是保留一个 Date 对象用于 UI 显示（虽然 UI 应该主要用 ymd）
      // 为了兼容旧代码，这里构造一个 Date 对象，但要注意它的本地时间显示可能不对，
      // 最好 UI 只用 label。为了兼容 `formatOrderText`，我们需要一个 Date 对象。
      // 我们构造一个 "Local Date" 使得 getFullYear/Month/Date 等于上海时间
      dateObj: new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
    });
  }
  return res;
}

export const TIME_SLOTS = [
  { key: 'morning', label: '上午', start: '10:00', end: '12:00' },
  { key: 'noon', label: '中午', start: '13:00', end: '15:00' },
  { key: 'afternoon', label: '下午', start: '15:00', end: '18:00' },
  { key: 'evening', label: '晚上', start: '18:00', end: '22:00' }
];

const DEMO_DAYS = 42;
const DEMO_FIRST_WEEK_FREE = {
  1: ['evening'],
  3: ['noon'],
  5: ['afternoon']
};
const DEMO_SECOND_WEEK_FREE = {
  7: ['morning'],
  8: ['afternoon'],
  9: ['noon', 'evening'],
  10: ['afternoon'],
  11: ['morning'],
  12: ['noon'],
  13: ['afternoon', 'evening']
};
const DEMO_LATER_BUSY = {
  14: ['morning'],
  17: ['evening'],
  20: ['noon'],
  23: ['afternoon'],
  27: ['morning', 'noon'],
  31: ['evening'],
  35: ['afternoon'],
  39: ['noon']
};

function getDemoSlotStatus(dayIndex, slotKey) {
  if (dayIndex < 7) {
    return DEMO_FIRST_WEEK_FREE[dayIndex]?.includes(slotKey) ? 'free' : 'busy';
  }

  if (dayIndex < 14) {
    return DEMO_SECOND_WEEK_FREE[dayIndex]?.includes(slotKey) ? 'free' : 'busy';
  }

  return DEMO_LATER_BUSY[dayIndex]?.includes(slotKey) ? 'busy' : 'free';
}

function getDemoSchedule() {
  const targetDays = getDateRangeDays(DEMO_DAYS);
  const schedule = targetDays.map((day, dayIndex) => {
    const label = `${day.m}月${day.d}日`;
    const weekday = '日一二三四五六'.charAt(day.weekdayIdx);
    const key = `${day.y}-${day.m}-${day.d}`;

    const slots = TIME_SLOTS.map(slot => ({
      key: slot.key,
      label: slot.label,
      start: slot.start,
      end: slot.end,
      displayTime: `${slot.start}～${slot.end}`,
      status: getDemoSlotStatus(dayIndex, slot.key),
      isTight: false
    }));

    return {
      date: day.dateObj,
      key,
      label,
      weekday,
      holidayName: '',
      slots
    };
  });

  return { workEvents: [], holidayEvents: [], schedule, isDemo: true, isMock: true };
}

// 检查冲突并返回可用时间段
function getSlotAvailability(day, slot, events) {
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);

  // 1. 定义扩展后的检测范围 (前后各扩展1小时)
  // 上午 10:00-12:00 -> 09:00-13:00
  // 中午 13:00-15:00 -> 12:00-16:00
  // 下午 15:00-18:00 -> 14:00-19:00
  // 晚上 18:00-22:00 -> 17:00-23:00
  
  // 扩展后的开始时间
  let extSh = sh - 1;
  let extSm = sm;
  if (extSh < 0) extSh = 0; // 不跨天到昨天

  // 扩展后的结束时间
  let extEh = eh + 1;
  let extEm = em;
  if (extEh > 24) extEh = 24; // 不跨天到明天

  // 构造 UTC 时间戳
  const rangeStart = Date.UTC(day.y, day.m - 1, day.d, extSh, extSm, 0) - SHANGHAI_OFFSET_MS;
  const rangeEnd = Date.UTC(day.y, day.m - 1, day.d, extEh, extEm, 0) - SHANGHAI_OFFSET_MS;

  // 2. 找出该范围内所有的忙碌时间段，并进行合并
  const busyRanges = events
    .filter(e => e.start < rangeEnd && e.end > rangeStart)
    .map(e => ({
      start: Math.max(e.start, rangeStart),
      end: Math.min(e.end, rangeEnd)
    }))
    .sort((a, b) => a.start - b.start);

  // 合并重叠的忙碌时间
  const mergedBusy = [];
  if (busyRanges.length > 0) {
    let curr = busyRanges[0];
    for (let i = 1; i < busyRanges.length; i++) {
      const next = busyRanges[i];
      if (next.start < curr.end) {
        curr.end = Math.max(curr.end, next.end);
      } else {
        mergedBusy.push(curr);
        curr = next;
      }
    }
    mergedBusy.push(curr);
  }

  // 3. 计算空闲时间段
  const freeRanges = [];
  let pointer = rangeStart;

  mergedBusy.forEach(busy => {
    if (busy.start > pointer) {
      freeRanges.push({ start: pointer, end: busy.start });
    }
    pointer = Math.max(pointer, busy.end);
  });

  if (pointer < rangeEnd) {
    freeRanges.push({ start: pointer, end: rangeEnd });
  }

  // 4. 筛选出 > 1小时 (3600000ms) 的空闲段
  const validFreeRanges = freeRanges.filter(r => (r.end - r.start) >= 3600000);

  // 5. 冲突解决 (方案B)：优先归属给原本的时段
  // 规则：如果找到的空闲时间主要位于原始时段内，则归属；否则看它是否主要位于扩展区域
  // 简化策略：只要空闲段与原始时段有交集，或者完全包含原始时段，或者被原始时段包含，都算。
  // 但为了避免重复显示，我们需要更严格的归属：
  // 实际上，前端显示是分卡片的。如果一个空闲段 12:00-13:00，既在上午(09-13)也在中午(12-16)。
  // 上午原始 10-12，扩展后包含 12-13。
  // 中午原始 13-15，扩展后包含 12-13。
  // 方案B要求：优先归属给原本的时段。
  // 12:00-13:00 不在上午原始(10-12)，也不在中午原始(13-15)。它是“夹缝”。
  // 我们定义“归属权”：
  // - 如果空闲段与原始时段有重叠 -> 归属当前时段（最优先）
  // - 如果空闲段完全在原始时段之外：
  //   - 比较它距离原始时段的距离？或者简单点：
  //   - 上午负责：09:00 - 12:30
  //   - 中午负责：12:30 - 15:00
  //   - 下午负责：15:00 - 18:00
  //   - 晚上负责：18:00 - 23:00
  // 这样硬性划分可能最简单且无重叠。
  
  // 重新定义“负责范围”用于归属判定 (Hardcoded for Scheme B)
  // Morning: < 12:30 (start time)
  // Noon: 12:30 <= start < 15:00
  // Afternoon: 15:00 <= start < 18:00
  // Evening: >= 18:00
  
  // 转换时间戳回小时数 (Shanghai)
  const getHour = (ts) => {
    const d = new Date(ts + SHANGHAI_OFFSET_MS);
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  };

  const finalRanges = validFreeRanges.filter(r => {
    const startH = getHour(r.start);
    // const endH = getHour(r.end);
    
    if (slot.key === 'morning') return startH < 12.5;
    if (slot.key === 'noon') return startH >= 12.5 && startH < 15.0;
    if (slot.key === 'afternoon') return startH >= 15.0 && startH < 18.0;
    if (slot.key === 'evening') return startH >= 18.0;
    return false;
  });

  if (finalRanges.length === 0) {
    return { status: 'busy', displayTime: null };
  }

  // 如果有多个空闲段，取最长的一个？或者合并显示？
  // 简单起见，取第一个（通常也是最早的）
  const bestRange = finalRanges[0];
  
  // 格式化显示时间
  const fmt = (ts) => {
    const d = new Date(ts + SHANGHAI_OFFSET_MS);
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return {
    status: 'free',
    displayTime: `${fmt(bestRange.start)}~${fmt(bestRange.end)}`,
    isTight: (bestRange.end - bestRange.start) < (2 * 3600000) // 如果小于2小时，标记为紧张（可选）
  };
}
// 检查冲突
function isSlotBusy(day, slot, events) {
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);

  // 构造 Slot 的真实 UTC 时间戳
  // Slot Start (Shanghai) = UTC(y, m-1, d, sh, sm) - 8h
  const slotStart = Date.UTC(day.y, day.m - 1, day.d, sh, sm, 0) - SHANGHAI_OFFSET_MS;
  const slotEnd = Date.UTC(day.y, day.m - 1, day.d, eh, em, 0) - SHANGHAI_OFFSET_MS;

  // 检查是否过期 (Past check)
  // 获取当前时间 (UTC) + Shanghai Offset
  const now = Date.now();
  // 注意：slotStart 已经是 UTC 时间戳，但代表的是 Shanghai 的某个时刻
  // Date.now() 是 UTC 时间戳
  // 比较时，slotEnd (UTC) 和 now (UTC) 直接比较即可
  // 但我们之前构造 slotStart 时减去了 SHANGHAI_OFFSET_MS
  // Date.UTC(...) 返回的是该日期在 UTC 下的时间戳。
  // 我们要表达的是“上海时间的 Y-M-D H:m:s”，它对应的真实 UTC 时间戳是 Date.UTC(...) - 8h
  // 所以 slotEnd 是真实 UTC 时间戳。
  // 只要 slotEnd < now，说明该时段已结束
  if (slotEnd < now) {
    return true; // 已过期，视为 busy
  }

  return events.some(e => {
    // 冲突逻辑：(EventStart < SlotEnd) && (EventEnd > SlotStart)
    return e.start < slotEnd && e.end > slotStart;
  });
}

// 牛马模式 (Niuma Mode) - 灵活时间判定备份
// 包含前后1小时扩展、碎片时间利用、动态时间范围计算
// eslint-disable-next-line no-unused-vars
function getSlotAvailabilityNiuma(day, slot, events) {
  const [sh, sm] = slot.start.split(':').map(Number);
  const [eh, em] = slot.end.split(':').map(Number);

  // ... (保留之前的逻辑)
  let extSh = sh - 1;
  let extSm = sm;
  if (extSh < 0) extSh = 0; 

  let extEh = eh + 1;
  let extEm = em;
  if (extEh > 24) extEh = 24; 

  const rangeStart = Date.UTC(day.y, day.m - 1, day.d, extSh, extSm, 0) - SHANGHAI_OFFSET_MS;
  const rangeEnd = Date.UTC(day.y, day.m - 1, day.d, extEh, extEm, 0) - SHANGHAI_OFFSET_MS;

  // 检查过期：如果整个扩展范围都过去了，肯定不行
  // 但这里应该检查具体的 freeRange 是否过期。
  // 为简单起见，如果 rangeEnd < now，直接 busy
  if (rangeEnd < Date.now()) return { status: 'busy', displayTime: null };

  const busyRanges = events
    .filter(e => e.start < rangeEnd && e.end > rangeStart)
    .map(e => ({
      start: Math.max(e.start, rangeStart),
      end: Math.min(e.end, rangeEnd)
    }))
    .sort((a, b) => a.start - b.start);

  const mergedBusy = [];
  if (busyRanges.length > 0) {
    let curr = busyRanges[0];
    for (let i = 1; i < busyRanges.length; i++) {
      const next = busyRanges[i];
      if (next.start < curr.end) {
        curr.end = Math.max(curr.end, next.end);
      } else {
        mergedBusy.push(curr);
        curr = next;
      }
    }
    mergedBusy.push(curr);
  }

  const freeRanges = [];
  let pointer = rangeStart;

  mergedBusy.forEach(busy => {
    if (busy.start > pointer) {
      freeRanges.push({ start: pointer, end: busy.start });
    }
    pointer = Math.max(pointer, busy.end);
  });

  if (pointer < rangeEnd) {
    freeRanges.push({ start: pointer, end: rangeEnd });
  }

  // 过滤掉过去的时间
  const now = Date.now();
  const futureFreeRanges = freeRanges.map(r => ({
    start: Math.max(r.start, now),
    end: r.end
  })).filter(r => r.end > r.start);

  const validFreeRanges = futureFreeRanges.filter(r => (r.end - r.start) >= 3600000);

  const getHour = (ts) => {
    const d = new Date(ts + SHANGHAI_OFFSET_MS);
    return d.getUTCHours() + d.getUTCMinutes() / 60;
  };

  const finalRanges = validFreeRanges.filter(r => {
    const startH = getHour(r.start);
    if (slot.key === 'morning') return startH < 12.5;
    if (slot.key === 'noon') return startH >= 12.5 && startH < 15.0;
    if (slot.key === 'afternoon') return startH >= 15.0 && startH < 18.0;
    if (slot.key === 'evening') return startH >= 18.0;
    return false;
  });

  if (finalRanges.length === 0) {
    return { status: 'busy', displayTime: null };
  }

  const bestRange = finalRanges[0];
  
  const fmt = (ts) => {
    const d = new Date(ts + SHANGHAI_OFFSET_MS);
    const h = d.getUTCHours().toString().padStart(2, '0');
    const m = d.getUTCMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  };

  return {
    status: 'free',
    displayTime: `${fmt(bestRange.start)}~${fmt(bestRange.end)}`,
    isTight: (bestRange.end - bestRange.start) < (2 * 3600000)
  };
}

// 构建数据
export function buildScheduleData(workEvents, holidayEvents, months = 2) {
  // const days = Math.ceil(30 * months); // Old logic
  const days = 21; // Future 21 days (including today)
  const targetDays = getDateRangeDays(days);
  const holidayMap = buildHolidayMap(holidayEvents);

  return targetDays.map(day => {
    const label = `${day.m}月${day.d}日`;
    const weekday = '日一二三四五六'.charAt(day.weekdayIdx);
    
    const slots = TIME_SLOTS.map(slot => {
      // 切换逻辑：使用严格模式
      const busy = isSlotBusy(day, slot, workEvents);
      // 如果需要切回牛马模式，解开下面注释并注释掉上面一行
      // const avail = getSlotAvailabilityNiuma(day, slot, workEvents);

      return {
        key: slot.key,
        label: slot.label,
        start: slot.start,
        end: slot.end,
        // 严格模式下，displayTime 就是原始时间
        displayTime: `${slot.start}～${slot.end}`, 
        status: busy ? 'busy' : 'free',
        isTight: false // 严格模式没有 tight 概念
      };
    });

    const key = `${day.y}-${day.m}-${day.d}`;

    return {
      date: day.dateObj, // 传给 UI/formatOrderText 使用
      key,
      label,
      weekday,
      holidayName: holidayMap[key] || '',
      slots
    };
  });
}

function buildHolidayMap(holidayEvents) {
  const map = {};
  holidayEvents.forEach(e => {
    if (!e.summary) return;
    // 节假日通常是全天事件，start 是 00:00 Shanghai (in UTC)
    // 我们将其转回上海的 Y-M-D
    const d = new Date(e.start + SHANGHAI_OFFSET_MS);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const day = d.getUTCDate();
    const key = `${y}-${m}-${day}`;
    if (!map[key]) {
      map[key] = e.summary;
    }
  });
  return map;
}

async function fetchICS(url, type) {
  let targetUrl = url;
  
  // Vercel Serverless API 优先 (生产环境/部署后)
  // 如果当前是 Vercel 部署环境，直接请求 /api/calendar
  // 简单判断：如果域名不是 localhost，或者显式配置了 VERCEL_URL?
  // 更好的方式：默认先尝试 /api/calendar，如果 404 再尝试其他？
  // 或者直接看是否是相对路径。Vercel Function 部署后会在同源下。
  
  // 策略：总是优先尝试 /api/calendar?type=...
  // 因为 Vercel Function 解决了 CORS 和 缓存问题。
  
  if (type) {
    return fetch(`/api/calendar?type=${type}`)
      .then(res => {
        if (!res.ok) throw new Error('API fetch failed');
        return res.text();
      })
      .catch(err => {
        console.warn('Vercel API fetch failed, falling back to direct/proxy fetch:', err);
        // Fallback logic below
        return fallbackFetch(url);
      });
  }

  return fallbackFetch(url);
}

async function fallbackFetch(url) {
  let targetUrl = url;
  
  // 本地开发代理逻辑：如果没有配置 VITE_PROXY_URL，则尝试走本地 Vite 代理
  if (import.meta.env.DEV) {
    if (url.includes('outlook.live.com/owa/calendar')) {
      targetUrl = '/api/work-calendar';
    } else if (url.includes('calendars.icloud.com')) {
      targetUrl = '/api/holiday-calendar';
    }
  }

  try {
    const res = await fetch(targetUrl);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return await res.text();
  } catch (err) {
    throw err;
  }
}

const CACHE_KEY = 'wt_schedule_cache_v1';
const CACHE_TTL = 3 * 60 * 1000;

// Hardcoded holidays for demo/fallback (2024-2026)
const FALLBACK_HOLIDAYS = {
  // Add some fake ones for testing if needed, or rely on real date
};

// Simple seeded random function
function seededRandom(seed) {
  let h = 0xdeadbeef;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 2654435761);
  }
  h = ((h ^ h >>> 16) >>> 0);
  return h / 4294967296;
}

function getMockSchedule() {
  const targetDays = getDateRangeDays(60);
  const schedule = targetDays.map((day, i) => {
    const label = `${day.m}月${day.d}日`;
    const weekday = '日一二三四五六'.charAt(day.weekdayIdx);
    const key = `${day.y}-${day.m}-${day.d}`;
    
    // Check fallback holidays
    const holidayName = FALLBACK_HOLIDAYS[key] || '';

    const slots = TIME_SLOTS.map(slot => {
      // Use date + slot key as seed for deterministic random
      const seed = `${key}-${slot.key}`;
      const rand = seededRandom(seed);
      
      return {
        key: slot.key,
        label: slot.label,
        start: slot.start,
        end: slot.end,
        status: rand > 0.4 ? 'free' : 'busy' // Slightly more chance to be free
      };
    });
    return {
      date: day.dateObj,
      key,
      label,
      weekday,
      holidayName,
      slots
    };
  });
  return { workEvents: [], holidayEvents: [], schedule };
}

export async function getCalendarsWithCache() {
  if (DEMO_MODE) {
    return getDemoSchedule();
  }

  const now = Date.now();
  try {
    const cachedStr = localStorage.getItem(CACHE_KEY);
    if (cachedStr) {
      const cached = JSON.parse(cachedStr);
      if (cached && cached.timestamp && now - cached.timestamp < CACHE_TTL) {
        return hydrateDates(cached.data);
      }
    }
  } catch (e) {
    console.error('Cache read fail:', e);
  }

  try {
    // Pass 'work' and 'holiday' types to enable Vercel API routing
    const [workText, holidayText] = await Promise.all([
      fetchICS(WORK_CAL_URL, 'work'),
      fetchICS(HOLIDAY_CAL_URL, 'holiday')
    ]);

    const workEvents = parseICS(workText);
    const holidayEvents = parseICS(holidayText);
    const schedule = buildScheduleData(workEvents, holidayEvents, 2);

    const data = { workEvents, holidayEvents, schedule, isMock: false };
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data }));
    } catch (e) {
      console.error('Cache write fail:', e);
    }
    return data;
  } catch (e) {
    console.error('Fetch fail:', e);
    const mockData = getMockSchedule();
    // Mark as mock so UI can show a warning
    mockData.isMock = true;
    return mockData;
  }
}

function hydrateDates(data) {
  if (!data || !data.schedule) return data;
  data.schedule.forEach(day => {
    if (typeof day.date === 'string') {
      day.date = new Date(day.date);
    }
  });
  return data;
}

// 导出 helper 供 time.js 使用 (如果有必要)
export function toShanghaiDate(date) {
    // 兼容旧接口，虽然这里主要内部逻辑已改
    // 返回一个 Date 对象，其本地时间分量 = 上海时间分量
    // 主要用于 formatRelativeDate
    const ts = date.getTime();
    const utc = ts + date.getTimezoneOffset() * 60000;
    return new Date(utc + SHANGHAI_OFFSET_MS);
}
