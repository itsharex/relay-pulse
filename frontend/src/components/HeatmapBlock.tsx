import type { ProcessedMonitorData } from '../types';
import { availabilityToStyle } from '../utils/color';

// 直接使用 ProcessedMonitorData 中的 history 类型，确保字段完整性
type HeatmapPoint = ProcessedMonitorData['history'][number];

interface HeatmapBlockProps {
  point: HeatmapPoint;
  width: string;
  height?: string;
  onHover: (e: React.MouseEvent<HTMLDivElement>, point: HeatmapPoint) => void;
  onLeave: () => void;
}

export function HeatmapBlock({
  point,
  width,
  height = 'h-8',
  onHover,
  onLeave,
}: HeatmapBlockProps) {
  return (
    <div
      className={`${height} rounded-sm transition-all duration-200 hover:scale-110 hover:z-10 cursor-pointer opacity-80 hover:opacity-100`}
      style={{ width, ...availabilityToStyle(point.availability) }}
      onMouseEnter={(e) => onHover(e, point)}
      onMouseLeave={onLeave}
    />
  );
}
