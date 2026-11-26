import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Play, RotateCcw, StepForward } from 'lucide-react';
import { ExecutorMode, getDeadlockTrace } from '../../logic/ros2Simulators';

const MODE_OPTIONS: { id: ExecutorMode; label: string; shortTag: string }[] = [
  { id: 'single_mutually_exclusive', label: 'SingleThreaded (默认组)', shortTag: '单线程' },
  { id: 'multi_mutually_exclusive', label: 'MultiThreaded (同组 MutuallyExclusive)', shortTag: '踩坑组' },
  { id: 'multi_reentrant', label: 'MultiThreaded (Reentrant 组)', shortTag: '可重入' },
  { id: 'multi_dual_groups', label: 'MultiThreaded (双独立回调组)', shortTag: '最佳实践' },
];

export const ExecutorDeadlockSim: React.FC = () => {
  const [mode, setMode] = useState<ExecutorMode>('multi_mutually_exclusive');
  const [stepIndex, setStepIndex] = useState<number>(2);

  const trace = getDeadlockTrace(mode);
  const current = trace[Math.min(stepIndex, trace.length - 1)];

  const handleModeChange = (nextMode: ExecutorMode) => {
    setMode(nextMode);
    setStepIndex(0);
  };

  const getThreadBadge = (state: string) => {
    switch (state) {
      case 'running_timer':
        return { text: '执行 timer_callback()', color: '#0284c7', bg: 'rgba(2,132,199,0.12)' };
      case 'blocked_future':
        return { text: '阻塞等待 future.get()', color: '#d97706', bg: 'rgba(217,119,6,0.14)' };
      case 'blocked_mutex':
        return { text: '被回调组互斥锁阻塞', color: '#dc2626', bg: 'rgba(220,38,38,0.14)' };
      case 'running_response':
        return { text: '并发执行 Service 响应', color: '#059669', bg: 'rgba(5,150,105,0.14)' };
      case 'completed':
        return { text: '完成并释放回调', color: '#059669', bg: 'rgba(5,150,105,0.12)' };
      case 'idle':
        return { text: '空闲待命', color: '#64748b', bg: 'rgba(100,116,139,0.10)' };
      default:
        return { text: '无第二线程', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' };
    }
  };

  const t1 = getThreadBadge(current.thread1State);
  const t2 = getThreadBadge(current.thread2State);

  return (
    <div
      data-testid="sim-executor"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交互图 3：rclcpp Executor 与 CallbackGroup 并发死锁演示器
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            逐步推演 Timer 内部同步请求 Service 时，单线程、多线程同互斥组与双回调组的锁状态演变
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setStepIndex((prev) => (prev + 1) % trace.length)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <StepForward className="w-3.5 h-3.5" aria-hidden="true" />
            <span>下一步 ({current.step}/{trace.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setStepIndex(trace.length - 1)}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>直达终态</span>
          </button>
          <button
            type="button"
            onClick={() => setStepIndex(0)}
            aria-label="重置执行器步骤"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>重置</span>
          </button>
        </div>
      </div>

      {/* Mode Selector Bar */}
      <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 bg-slate-50/40 dark:bg-slate-950/30 no-print">
        {MODE_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => handleModeChange(opt.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              mode === opt.id
                ? 'bg-slate-900 dark:bg-sky-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* SVG Thread & CallbackGroup Canvas */}
        <div className="lg:col-span-7">
          <svg viewBox="0 0 540 210" className="w-full h-auto" role="img" aria-label="Executor 线程与回调组并发时序图">
            {/* Thread 1 Box */}
            <rect x="16" y="20" width="236" height="72" rx="8" fill={t1.bg} stroke={t1.color} strokeWidth="1.5" />
            <text x="30" y="44" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">
              Thread 1 (Executor 工作线程)
            </text>
            <text x="30" y="68" fontSize="11.5" fontFamily="JetBrains Mono, monospace" fill={t1.color}>
              {t1.text}
            </text>

            {/* Thread 2 Box */}
            <rect
              x="16"
              y="114"
              width="236"
              height="72"
              rx="8"
              fill={t2.bg}
              stroke={t2.color}
              strokeWidth="1.5"
              strokeDasharray={current.thread2State === 'none' ? '4 3' : 'none'}
            />
            <text x="30" y="138" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">
              Thread 2 (线程池并发线程)
            </text>
            <text x="30" y="162" fontSize="11.5" fontFamily="JetBrains Mono, monospace" fill={t2.color}>
              {t2.text}
            </text>

            {/* Callback Group Box */}
            <rect
              x="292"
              y="20"
              width="232"
              height="166"
              rx="10"
              fill={current.groupLocked ? 'rgba(220,38,38,0.06)' : 'rgba(5,150,105,0.06)'}
              stroke={current.groupLocked ? '#dc2626' : '#059669'}
              strokeWidth="1.5"
            />
            <text x="308" y="45" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">
              {mode === 'multi_dual_groups'
                ? '双独立 MutuallyExclusive 组'
                : mode === 'multi_reentrant'
                ? 'CallbackGroup: Reentrant'
                : '默认 MutuallyExclusive 组'}
            </text>

            {/* Timer Slot */}
            <rect x="308" y="60" width="200" height="44" rx="6" fill="rgba(2,132,199,0.1)" stroke="#0284c7" />
            <text x="320" y="80" fontSize="11" fontWeight="600" fill="#0284c7">
              Timer Callback
            </text>
            <text x="320" y="96" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-600 dark:text-slate-300">
              {current.groupLocked ? 'Mutex: LOCKED by T1' : 'Group 1: timer_cb_group_'}
            </text>

            {/* Service Response Slot */}
            <rect
              x="308"
              y="120"
              width="200"
              height="48"
              rx="6"
              fill={current.isDeadlocked ? 'rgba(220,38,38,0.12)' : 'rgba(5,150,105,0.1)'}
              stroke={current.isDeadlocked ? '#dc2626' : '#059669'}
            />
            <text
              x="320"
              y="141"
              fontSize="11"
              fontWeight="600"
              fill={current.isDeadlocked ? '#dc2626' : '#059669'}
            >
              Service Response Callback
            </text>
            <text x="320" y="157" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-600 dark:text-slate-300">
              {current.isDeadlocked
                ? '阻塞！无法获取组执行权'
                : mode === 'multi_dual_groups'
                ? 'Group 2: client_cb_group_ (畅通)'
                : 'Reentrant 允许并发调度'}
            </text>

            {/* Connector lines */}
            <line x1="252" y1="56" x2="306" y2="80" stroke={t1.color} strokeWidth="1.8" />
            {current.thread2State !== 'none' && (
              <line
                x1="252"
                y1="150"
                x2="306"
                y2="144"
                stroke={t2.color}
                strokeWidth="1.8"
                strokeDasharray={current.isDeadlocked ? '4 3' : 'none'}
              />
            )}
          </svg>
        </div>

        {/* Step Explanation & Status */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center gap-2">
            {trace.map((s, idx) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setStepIndex(idx)}
                className={`flex-1 py-1.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer ${
                  idx === stepIndex
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                Step {s.step}
              </button>
            ))}
          </div>

          <div
            data-testid="deadlock-status"
            className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
              current.isDeadlocked
                ? 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
                : current.step === trace.length
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
            }`}
          >
            <div className="font-semibold flex items-center gap-1.5 text-sm">
              {current.isDeadlocked ? (
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              )}
              <span>{current.title}</span>
            </div>
            <p className="leading-relaxed opacity-95">{current.description}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
