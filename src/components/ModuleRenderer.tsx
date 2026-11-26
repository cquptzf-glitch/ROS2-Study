import React from 'react';
import { Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { HandbookModule, SimulatorId } from '../types/handbook';
import { CodeBlock } from './CodeBlock';
import { ArchitectureLayersSim } from './simulators/ArchitectureLayersSim';
import { CommQosZeroCopySim } from './simulators/CommQosZeroCopySim';
import { ExecutorDeadlockSim } from './simulators/ExecutorDeadlockSim';
import { LifecycleStateSim } from './simulators/LifecycleStateSim';
import { Tf2ControlLoopSim } from './simulators/Tf2ControlLoopSim';
import { QtRosThreadSim } from './simulators/QtRosThreadSim';
import { Ros2OverviewGraphSim } from './simulators/Ros2OverviewGraphSim';
import { WslVscodeBridgeSim } from './simulators/WslVscodeBridgeSim';
import { Nav2SlamPipelineSim } from './simulators/Nav2SlamPipelineSim';
import { CppOwnershipPitfallSim } from './simulators/CppOwnershipPitfallSim';

function renderSimulator(id: SimulatorId) {
  switch (id) {
    case 'sim1':
      return <ArchitectureLayersSim />;
    case 'sim2':
      return <CommQosZeroCopySim />;
    case 'sim3':
      return <ExecutorDeadlockSim />;
    case 'sim4':
      return <LifecycleStateSim />;
    case 'sim5':
      return <Tf2ControlLoopSim />;
    case 'sim6':
      return <QtRosThreadSim />;
    case 'sim7':
      return <Ros2OverviewGraphSim />;
    case 'sim8':
      return <WslVscodeBridgeSim />;
    case 'sim9':
      return <Nav2SlamPipelineSim />;
    case 'sim10':
      return <CppOwnershipPitfallSim />;
  }
}

function renderInlineText(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">
          {renderInlineText(part.slice(2, -2))}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 mx-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 font-mono text-[13px] text-sky-800 dark:text-sky-300 [overflow-wrap:anywhere]"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

export const ModuleRenderer: React.FC<{ module: HandbookModule }> = ({ module }) => {
  return (
    <section
      id={module.id}
      data-module-id={module.id}
      className="scroll-mt-20 pb-14 border-b border-slate-200 dark:border-slate-800/90"
    >
      {/* Editorial Module Header (Zero pill tags, clean typographic metadata separator) */}
      <div className="mb-8 pt-4">
        <div className="text-xs font-mono text-sky-700 dark:text-sky-400 tracking-wide mb-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold">CHAPTER {module.number}</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-slate-500 dark:text-slate-400">{module.versionScope}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug">
          {module.title}
        </h2>
        <p className="mt-2.5 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
          {renderInlineText(module.subtitle)}
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-12">
        {module.sections.map((section) => (
          <article key={section.id} id={section.id} data-section-id={section.id} className="scroll-mt-20">
            <h3 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-slate-100 mb-3.5">
              {section.title}
            </h3>

            <div className="space-y-3 text-[15px] text-slate-700 dark:text-slate-300 leading-7 max-w-4xl">
              {section.paragraphs.map((p, idx) => (
                <p key={idx}>{renderInlineText(p)}</p>
              ))}
            </div>

            {/* Clean Callout Boxes (All-around hairline border, NO thick left accent bar) */}
            {section.callouts && section.callouts.length > 0 && (
              <div className="mt-4 space-y-3">
                {section.callouts.map((c, idx) => {
                  const toneStyle =
                    c.tone === 'warn'
                      ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/70 text-amber-900 dark:text-amber-100'
                      : c.tone === 'tip'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/70 text-emerald-900 dark:text-emerald-100'
                      : 'bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/70 text-sky-950 dark:text-sky-100';

                  const icon =
                    c.tone === 'warn' ? (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : c.tone === 'tip' ? (
                      <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
                    );

                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border text-sm flex items-start gap-3 ${toneStyle}`}
                    >
                      {icon}
                      <div>
                        <div className="font-semibold mb-0.5">{c.label}</div>
                        <p className="leading-relaxed opacity-90">{renderInlineText(c.text)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Comparison Table */}
            {section.table && (
              <div className="my-5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900 print-break-inside-avoid">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {section.table.caption}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900">
                        {section.table.headers.map((h, i) => (
                          <th key={i} className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {section.table.rows.map((row, rIdx) => (
                        <tr key={rIdx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          {row.map((cell, cIdx) => (
                            <td
                              key={cIdx}
                              className={`px-4 py-2.5 text-slate-700 dark:text-slate-300 tabular-nums align-top ${
                                cIdx === 0 ? 'font-medium text-slate-900 dark:text-slate-100 min-w-[140px] max-w-[240px]' : ''
                              }`}
                            >
                              {renderInlineText(cell)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Embedded Interactive Simulator */}
            {section.simulatorId && renderSimulator(section.simulatorId)}

            {/* Code Blocks */}
            {section.codeBlocks &&
              section.codeBlocks.map((cb, idx) => <CodeBlock key={idx} block={cb} />)}
          </article>
        ))}
      </div>
    </section>
  );
};
