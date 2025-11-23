import { Activity, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { FEEDBACK_URLS } from '../constants';

interface HeaderProps {
  stats: {
    total: number;
    healthy: number;
    issues: number;
  };
}

export function Header({ stats }: HeaderProps) {
  return (
    <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-4 border-b border-slate-800/50 pb-3">
      {/* 左侧：Logo 和标语 */}
      <div>
        <div className="flex items-center gap-2 sm:gap-3 mb-1 sm:mb-2">
          <div className="p-1.5 sm:p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400">
            RelayPulse
          </h1>
        </div>
        <p className="text-slate-400 text-xs sm:text-sm flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          实时监控API中转服务可用性矩阵
        </p>
      </div>

      {/* 右侧：统计和推荐按钮 */}
      <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 sm:gap-4 text-sm md:items-center">
        {/* 推荐按钮 */}
        <a
          href={FEEDBACK_URLS.PROVIDER_SUGGESTION}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full sm:w-auto items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-xl border border-cyan-500/40 bg-cyan-500/10 text-cyan-200 font-semibold tracking-wide shadow-[0_0_12px_rgba(6,182,212,0.25)] hover:bg-cyan-500/20 transition min-h-[44px]"
        >
          <Sparkles size={14} />
          推荐服务商
        </a>

        {/* 统计卡片 - 移动端横向排列 */}
        <div className="grid grid-cols-2 sm:flex gap-2 sm:gap-4">
          <div className="px-3 sm:px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm flex items-center gap-2 sm:gap-3 shadow-lg">
            <div className="p-1 sm:p-1.5 rounded-full bg-emerald-500/10 text-emerald-400">
              <CheckCircle size={14} className="sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="text-slate-400 text-[10px] sm:text-xs">正常运行</div>
              <div className="font-mono font-bold text-emerald-400 text-sm sm:text-base">
                {stats.healthy}
              </div>
            </div>
          </div>
          <div className="px-3 sm:px-4 py-2 rounded-xl bg-slate-900/50 border border-slate-800 backdrop-blur-sm flex items-center gap-2 sm:gap-3 shadow-lg">
            <div className="p-1 sm:p-1.5 rounded-full bg-rose-500/10 text-rose-400">
              <AlertTriangle size={14} className="sm:w-4 sm:h-4" />
            </div>
            <div>
              <div className="text-slate-400 text-[10px] sm:text-xs">异常告警</div>
              <div className="font-mono font-bold text-rose-400 text-sm sm:text-base">
                {stats.issues}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
