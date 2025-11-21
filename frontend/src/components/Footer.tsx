import { Activity, Shield, AlertTriangle } from 'lucide-react';

const notices = [
  {
    icon: Activity,
    title: '数据仅供参考',
    text: '受网络环境影响，不代表服务商绝对质量',
  },
  {
    icon: Shield,
    title: '中立维护',
    text: '本项目个人维护，保持中立，无利益相关',
  },
  {
    icon: AlertTriangle,
    title: '范围说明',
    text: '仅监测 API 连通性，不对具体内容负责',
  },
];

export function Footer() {
  return (
    <footer className="mt-10 bg-slate-900/60 border border-slate-800 rounded-2xl p-5 text-slate-400">
      <div className="text-sm font-semibold text-slate-200 mb-3">免责声明</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {notices.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="flex items-start gap-3 bg-slate-900/40 border border-slate-800 rounded-xl p-3"
          >
            <div className="p-2 rounded-lg bg-slate-800/80 text-cyan-300">
              <Icon size={16} />
            </div>
            <div className="text-xs leading-relaxed">
              <div className="font-semibold text-slate-200 mb-1">{title}</div>
              <p className="text-slate-500">{text}</p>
            </div>
          </div>
        ))}
      </div>
    </footer>
  );
}
