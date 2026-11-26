import React, { useState } from 'react';
import { Power, RotateCcw, ShieldCheck, Wrench } from 'lucide-react';
import {
  LifecycleState,
  LifecycleTransition,
  transitionLifecycleState,
} from '../../logic/ros2Simulators';

const STATE_DETAILS: Record<
  LifecycleState,
  {
    title: string;
    hardwareBehavior: string;
    publisherStatus: string;
    allowedActions: LifecycleTransition[];
  }
> = {
  unconfigured: {
    title: 'Unconfigured（未配置初态）',
    hardwareBehavior: '刚实例化 LifecycleNode，尚未打开激光雷达串口、CAN 网卡或分配大块点云内存缓冲。',
    publisherStatus: 'LifecyclePublisher 尚未创建（nullptr）。',
    allowedActions: ['configure', 'shutdown'],
  },
  inactive: {
    title: 'Inactive（已配置待命态）',
    hardwareBehavior: '已完成 YAML 参数读取、文件描述符打开与内存池预分配，但电机未使能、雷达未发射激光。适合安全急停后保留上下文热恢复。',
    publisherStatus: '已创建 LifecyclePublisher，但 is_activated() == false，调用 publish() 不会发往 DDS。',
    allowedActions: ['activate', 'cleanup', 'shutdown'],
  },
  active: {
    title: 'Active（全速运行激活态）',
    hardwareBehavior: '硬件驱动处于工作状态：使能伺服电机力矩、激光雷达持续发射测距并接收 CAN 编码器帧。',
    publisherStatus: 'scan_pub_->on_activate() 已调用，实时向 /scan 与 /odom 输出有效数据帧。',
    allowedActions: ['deactivate', 'shutdown'],
  },
  finalized: {
    title: 'Finalized（终态已销毁）',
    hardwareBehavior: '所有智能指针已 reset()，硬件连接已安全关闭，等待析构退出，不可回退。',
    publisherStatus: '全部通讯端点已注销。',
    allowedActions: [],
  },
};

const TRANSITION_LABELS: Record<LifecycleTransition, string> = {
  configure: 'configure (on_configure)',
  activate: 'activate (on_activate)',
  deactivate: 'deactivate (on_deactivate)',
  cleanup: 'cleanup (on_cleanup)',
  shutdown: 'shutdown (on_shutdown)',
};

export const LifecycleStateSim: React.FC = () => {
  const [state, setState] = useState<LifecycleState>('unconfigured');
  const [lastMsg, setLastMsg] = useState<string>('初始进入 Unconfigured：等待 lifecycle_manager 下发 configure 指令。');
  const [lastCb, setLastCb] = useState<string>('Constructor');

  const trigger = (t: LifecycleTransition) => {
    const res = transitionLifecycleState(state, t);
    setState(res.state);
    setLastMsg(res.message);
    if (res.valid) {
      setLastCb(res.lastCallback);
    }
  };

  const reset = () => {
    setState('unconfigured');
    setLastMsg('已重置至 Unconfigured 初态。');
    setLastCb('Constructor');
  };

  const detail = STATE_DETAILS[state];

  const getNodeStyle = (target: LifecycleState) => {
    const active = state === target;
    if (target === 'active') {
      return active
        ? { fill: 'rgba(5,150,105,0.16)', stroke: '#059669', text: '#059669' }
        : { fill: 'transparent', stroke: '#94a3b8', text: '#64748b' };
    }
    if (target === 'finalized') {
      return active
        ? { fill: 'rgba(220,38,38,0.14)', stroke: '#dc2626', text: '#dc2626' }
        : { fill: 'transparent', stroke: '#94a3b8', text: '#64748b' };
    }
    return active
      ? { fill: 'rgba(2,132,199,0.16)', stroke: '#0284c7', text: '#0284c7' }
      : { fill: 'transparent', stroke: '#94a3b8', text: '#64748b' };
  };

  const sUnconf = getNodeStyle('unconfigured');
  const sInact = getNodeStyle('inactive');
  const sAct = getNodeStyle('active');
  const sFin = getNodeStyle('finalized');

  return (
    <div
      data-testid="sim-lifecycle"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交互图 4：LifecycleNode 确定性生命周期状态机交互图
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            点击状态节点或触发状态转换按钮，观察传感器与底盘驱动的资源分配与安全启停逻辑
          </p>
        </div>

        <button
          type="button"
          onClick={reset}
          className="no-print inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>重置状态机</span>
        </button>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* SVG FSM */}
        <div className="lg:col-span-7">
          <svg viewBox="0 0 560 220" className="w-full h-auto" role="img" aria-label="ROS 2 LifecycleNode 状态机">
            <defs>
              <marker id="lc-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7 Z" fill="#64748b" />
              </marker>
            </defs>

            {/* Transitions Arrows */}
            {/* Unconfigured <-> Inactive */}
            <line x1="146" y1="62" x2="212" y2="62" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#lc-arrow)" />
            <text x="179" y="54" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#64748b">configure</text>
            <line x1="212" y1="84" x2="146" y2="84" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#lc-arrow)" />
            <text x="179" y="99" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#64748b">cleanup</text>

            {/* Inactive <-> Active */}
            <line x1="346" y1="62" x2="412" y2="62" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#lc-arrow)" />
            <text x="379" y="54" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#64748b">activate</text>
            <line x1="412" y1="84" x2="346" y2="84" stroke="#64748b" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#lc-arrow)" />
            <text x="379" y="99" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#64748b">deactivate</text>

            {/* Shutdown lines */}
            <path d="M 80 100 L 80 176 L 210 176" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" markerEnd="url(#lc-arrow)" />
            <line x1="280" y1="100" x2="280" y2="144" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" markerEnd="url(#lc-arrow)" />
            <path d="M 480 100 L 480 176 L 350 176" fill="none" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" markerEnd="url(#lc-arrow)" />
            <text x="280" y="132" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#94a3b8">on_shutdown()</text>

            {/* State Boxes */}
            <g onClick={() => setState('unconfigured')} className="cursor-pointer">
              <rect x="16" y="44" width="128" height="56" rx="8" fill={sUnconf.fill} stroke={sUnconf.stroke} strokeWidth={state === 'unconfigured' ? '2.2' : '1.4'} />
              <text x="80" y="69" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={sUnconf.text}>Unconfigured</text>
              <text x="80" y="87" textAnchor="middle" fontSize="10" fill="#64748b">未配置初态</text>
            </g>

            <g onClick={() => setState('inactive')} className="cursor-pointer">
              <rect x="216" y="44" width="128" height="56" rx="8" fill={sInact.fill} stroke={sInact.stroke} strokeWidth={state === 'inactive' ? '2.2' : '1.4'} />
              <text x="280" y="69" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={sInact.text}>Inactive</text>
              <text x="280" y="87" textAnchor="middle" fontSize="10" fill="#64748b">待命（未使能）</text>
            </g>

            <g onClick={() => setState('active')} className="cursor-pointer">
              <rect x="416" y="44" width="128" height="56" rx="8" fill={sAct.fill} stroke={sAct.stroke} strokeWidth={state === 'active' ? '2.2' : '1.4'} />
              <text x="480" y="69" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={sAct.text}>Active</text>
              <text x="480" y="87" textAnchor="middle" fontSize="10" fill="#64748b">激活运行中</text>
            </g>

            <g onClick={() => setState('finalized')} className="cursor-pointer">
              <rect x="216" y="148" width="128" height="52" rx="8" fill={sFin.fill} stroke={sFin.stroke} strokeWidth={state === 'finalized' ? '2.2' : '1.4'} />
              <text x="280" y="172" textAnchor="middle" fontSize="12.5" fontWeight="600" fill={sFin.text}>Finalized</text>
              <text x="280" y="189" textAnchor="middle" fontSize="10" fill="#64748b">终态已销毁</text>
            </g>
          </svg>

          {/* Transition Trigger Buttons */}
          <div className="mt-3 flex flex-wrap gap-2 no-print">
            {(['configure', 'activate', 'deactivate', 'cleanup', 'shutdown'] as LifecycleTransition[]).map((tr) => {
              const allowed = detail.allowedActions.includes(tr);
              return (
                <button
                  key={tr}
                  type="button"
                  disabled={!allowed}
                  onClick={() => trigger(tr)}
                  className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                    allowed
                      ? 'bg-sky-600 hover:bg-sky-700 text-white cursor-pointer'
                      : 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 border border-slate-200 dark:border-slate-800 cursor-not-allowed'
                  }`}
                >
                  {TRANSITION_LABELS[tr]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Hardware & Publisher Inspection */}
        <div className="lg:col-span-5 space-y-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-100" data-testid="lifecycle-current-state">
                {detail.title}
              </span>
              <span className="font-mono text-sky-700 dark:text-sky-300">{lastCb}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{lastMsg}</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>硬件句柄与内存资源行为</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{detail.hardwareBehavior}</p>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 space-y-1">
            <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              {state === 'active' ? (
                <Power className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5 text-slate-500" aria-hidden="true" />
              )}
              <span>LifecyclePublisher 状态</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{detail.publisherStatus}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
