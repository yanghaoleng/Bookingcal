import { toShanghaiDate } from './ical';

export function formatRelativeDate(targetDate) {
  const now = toShanghaiDate(new Date());
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());

  const diffDays = Math.round((t.getTime() - base.getTime()) / 86400000);

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '明天';
  if (diffDays === 2) return '后天';

  // 其他情况直接给出“X天后”
  if (diffDays > 0) {
    return `${diffDays}天后`;
  }

  return `${-diffDays}天前`;
}

export function formatOrderText(dateObj, slotLabel, lengthText, styleText, removeText, remarkText) {
  const m = dateObj.getMonth() + 1;
  const d = dateObj.getDate();
  const relative = formatRelativeDate(dateObj);
  const lenPart = lengthText || '';
  const stylePart = styleText || '';
  const removePart = removeText || '';
  const remark = remarkText ? `备注：${remarkText}` : '备注：无';

  return `预约${m}月${d}日${slotLabel}（${relative}）做${lenPart}${stylePart}，${removePart}，${remark}。静候 Bookingcal 安排！`;
}
