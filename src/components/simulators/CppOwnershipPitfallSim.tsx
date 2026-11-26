import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, Cpu, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  CppPitfallScenarioId,
  getCppPitfallScenario,
} from '../../logic/ros2Simulators';

const SCENARIO_IDS: CppPitfallScenarioId[] = [
  'shared_from_this_ctor',
  'member_destruction_order',
  'lambda_this_dangling',
  'unique_ptr_use_after_move',
];

function splitIdentifierSafeLines(text: string, maxVisualWidth = 30): string[] {
  const tokens = text.match(/[A-Za-z0-9_:.()->&/*]+|\s+|[\u4e00-\u9fff]|[^\sA-Za-z0-9_:.()->&/*\u4e00-\u9fff]+/g) ?? [text];
  const lines: string[] = [];
  let current = '';
  let currentWidth = 0;

  for (const token of tokens) {
    const tokenWidth = /[\u4e00-\u9fff]/.test(token) ? 1.85 : token.length;
    if (currentWidth > 0 && currentWidth + tokenWidth > maxVisualWidth) {
      lines.push(current.trimEnd());
      current = token.trimStart();
      currentWidth = /[\u4e00-\u9fff]/.test(current) ? 1.85 : current.length;
    } else {
      current += token;
      currentWidth += tokenWidth;
    }
  }
  if (current.trim().length > 0) {
    lines.push(current.trimEnd());
  }
  return lines.slice(0, 4);
}

export const CppOwnershipPitfallSim: React.FC = () => {
  const [selectedId, setSelectedId] = useState<CppPitfallScenarioId>('shared_from_this_ctor');
  const [inspectMode, setInspectMode] = useState<'bug' | 'fix'>('bug');

  const scenario = getCppPitfallScenario(selectedId);

  return (
    <div className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-xs print-break-inside-avoid">
      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-mono text-sky-700 dark:text-sky-400 font-semibold flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
            <span>交互图解 10 · 现代 C++ 所有权、生命周期与崩溃机制推演器</span>
          </div>
          <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
            点击切换 4 类 ROS 2 C++ 隐蔽段错误/异常现场与工业级 RAII 修复方案
          </h4>
        </div>

        {/* Bug vs Fix Mode Toggle */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 no-print">
          <button
            type="button"
            onClick={() => setInspectMode('bug')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              inspectMode === 'bug'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            <span>错误写法（崩溃推演）</span>
          </button>
          <button
            type="button"
            onClick={() => setInspectMode('fix')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 cursor-pointer ${
              inspectMode === 'fix'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>工业级修复（RAII 安全）</span>
          </button>
        </div>
      </div>

      {/* Scenario Selector Tabs */}
      <div className="px-5 pt-4 flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-800/80 pb-3">
        {SCENARIO_IDS.map((id) => {
          const item = getCppPitfallScenario(id);
          const active = id === selectedId;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedId(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                active
                  ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 dark:border-sky-600 text-sky-800 dark:text-sky-200'
                  : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              {item.tabLabel}
            </button>
          );
        })}
      </div>

      <div className="p-5 space-y-5">
        <div>
          <h5 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-slate-100">
            {scenario.title}
          </h5>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
            <span className="font-semibold text-slate-800 dark:text-slate-200">现场症状：</span>
            {scenario.symptom}
          </p>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
            <span className="font-semibold text-slate-800 dark:text-slate-200">底层原理：</span>
            {scenario.rootCause}
          </p>
        </div>

        {/* SVG Memory & Execution Lifecycle Timeline */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 overflow-x-auto">
          <svg
            viewBox="0 0 840 172"
            className="w-full min-w-[660px] h-auto"
            role="img"
            aria-label={`${scenario.title} 生命周期推演图`}
          >
            <defs>
              <marker
                id="sim10-arrow"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1 L 10 5 L 0 9 z" className="fill-slate-400 dark:fill-slate-500" />
              </marker>
            </defs>

            {scenario.phases.map((phase, idx) => {
              const x = 16 + idx * 276;
              const isFatal = inspectMode === 'bug' && phase.isFatalInBug;
              const isFix = inspectMode === 'fix';
              const boxClass = isFatal
                ? 'fill-rose-50 dark:fill-rose-950/50 stroke-rose-400 dark:stroke-rose-600'
                : isFix && idx === 2
                ? 'fill-emerald-50 dark:fill-emerald-950/50 stroke-emerald-400 dark:stroke-emerald-600'
                : 'fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-700';

              const textValue = inspectMode === 'bug' ? phase.bugOutcome : phase.fixOutcome;
              const lines = splitIdentifierSafeLines(textValue, 32);

              return (
                <g key={phase.step}>
                  <rect
                    x={x}
                    y={14}
                    width={250}
                    height={144}
                    rx={10}
                    strokeWidth={1.5}
                    className={boxClass}
                  />
                  <text
                    x={x + 14}
                    y={38}
                    className={`text-[12px] font-mono font-semibold ${
                      isFatal
                        ? 'fill-rose-700 dark:fill-rose-300'
                        : isFix && idx === 2
                        ? 'fill-emerald-700 dark:fill-emerald-300'
                        : 'fill-sky-700 dark:fill-sky-400'
                    }`}
                  >
                    STEP 0{phase.step} · {phase.label}
                  </text>
                  <line
                    x1={x + 14}
                    y1={48}
                    x2={x + 236}
                    y2={48}
                    className="stroke-slate-200 dark:stroke-slate-800"
                    strokeWidth={1}
                  />
                  {lines.map((ln, lIdx) => (
                    <text
                      key={lIdx}
                      x={x + 14}
                      y={72 + lIdx * 21}
                      className="text-[11.5px] fill-slate-700 dark:fill-slate-200"
                    >
                      {ln}
                    </text>
                  ))}

                  {idx < scenario.phases.length - 1 && (
                    <line
                      x1={x + 252}
                      y1={86}
                      x2={x + 272}
                      y2={86}
                      strokeWidth={1.8}
                      className="stroke-slate-400 dark:stroke-slate-500"
                      markerEnd="url(#sim10-arrow)"
                    />
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Side-by-Side Code Comparison */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div
            className={`rounded-xl border p-4 transition-colors ${
              inspectMode === 'bug'
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50/40 dark:bg-rose-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-80'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 mb-2">
              <AlertOctagon className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>反面教材（存在隐蔽崩溃或未定义行为）</span>
            </div>
            <pre className="text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap break-words">
              <code>{scenario.badCode}</code>
            </pre>
          </div>

          <div
            className={`rounded-xl border p-4 transition-colors ${
              inspectMode === 'fix'
                ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 opacity-90'
            }`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>工业级安全写法（RAII + 控制块防线）</span>
            </div>
            <pre className="text-xs font-mono leading-relaxed text-slate-800 dark:text-slate-200 overflow-x-auto whitespace-pre-wrap break-words">
              <code>{scenario.goodCode}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
