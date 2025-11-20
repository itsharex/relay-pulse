/**
 * 根据可用率计算渐变颜色
 * - 60%以下 → 红色
 * - 60%-80% → 红到黄渐变
 * - 80%-100% → 黄到绿渐变
 * - -1（无数据）→ 灰色
 */

import type { CSSProperties } from 'react';

// 颜色常量
const RED = { r: 239, g: 68, b: 68 };     // #ef4444
const YELLOW = { r: 234, g: 179, b: 8 };   // #eab308
const GREEN = { r: 34, g: 197, b: 94 };    // #22c55e
const GRAY = { r: 148, g: 163, b: 184 };   // #94a3b8

interface RGB {
  r: number;
  g: number;
  b: number;
}

/**
 * 线性插值两个颜色
 */
function lerpColor(color1: RGB, color2: RGB, t: number): string {
  const r = Math.round(color1.r + (color2.r - color1.r) * t);
  const g = Math.round(color1.g + (color2.g - color1.g) * t);
  const b = Math.round(color1.b + (color2.b - color1.b) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * 根据可用率返回背景颜色（CSS color string）
 */
export function availabilityToColor(availability: number): string {
  // 无数据
  if (availability < 0) {
    return `rgb(${GRAY.r}, ${GRAY.g}, ${GRAY.b})`;
  }

  // 60%以下 → 红色
  if (availability < 60) {
    return `rgb(${RED.r}, ${RED.g}, ${RED.b})`;
  }

  // 60%-80% → 红到黄渐变
  if (availability < 80) {
    const t = (availability - 60) / 20;
    return lerpColor(RED, YELLOW, t);
  }

  // 80%-100% → 黄到绿渐变
  const t = (availability - 80) / 20;
  return lerpColor(YELLOW, GREEN, t);
}

/**
 * 根据可用率返回 Tailwind 兼容的 style 对象
 */
export function availabilityToStyle(availability: number): CSSProperties {
  return {
    backgroundColor: availabilityToColor(availability),
  };
}
