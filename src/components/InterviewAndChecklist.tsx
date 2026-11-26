import React, { useEffect, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  RotateCcw,
  Award,
  BookOpenCheck,
} from 'lucide-react';
import { EIGHT_WEEK_CHECKLIST, INTERVIEW_QUESTIONS } from '../data/module8Data';
import { calculateChecklistProgress } from '../logic/ros2Simulators';

const STORAGE_KEY = 'ros2_cpp_8week_checklist_v1';

export const InterviewAndChecklist: React.FC<{
  searchQuery?: string;
}> = ({ searchQuery = '' }) => {
  const [expandedIds, setExpandedIds] = useState<number[]>([1]);
  const [difficultyFilter, setDifficultyFilter] = useState<string>('全部');
  const [checkedTasks, setCheckedTasks] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as string[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(checkedTasks));
    } catch {
      // Ignore storage quota errors in restricted environments
    }
  }, [checkedTasks]);

  const toggleQuestion = (id: number) => {
    setExpandedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const expandAll = () => {
    setExpandedIds(INTERVIEW_QUESTIONS.map((q) => q.id));
  };

  const collapseAll = () => {
    setExpandedIds([]);
  };

  const toggleTask = (taskId: string) => {
    setCheckedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((t) => t !== taskId) : [...prev, taskId]
    );
  };

  const resetChecklist = () => {
    setCheckedTasks([]);
  };

  const allTaskIds = EIGHT_WEEK_CHECKLIST.flatMap((w) => w.tasks.map((t) => t.id));
  const progress = calculateChecklistProgress(checkedTasks, allTaskIds.length);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredQuestions = INTERVIEW_QUESTIONS.filter((q) => {
    const matchesDiff = difficultyFilter === '全部' || q.difficulty === difficultyFilter;
    const matchesSearch =
      !normalizedQuery ||
      q.question.toLowerCase().includes(normalizedQuery) ||
      q.standardAnswer.toLowerCase().includes(normalizedQuery) ||
      q.bonusPoints.toLowerCase().includes(normalizedQuery) ||
      q.category.toLowerCase().includes(normalizedQuery);
    return matchesDiff && matchesSearch;
  });

  return (
    <section id="module-9" data-module-id="module-9" className="scroll-mt-20 pt-4 pb-16">
      <div className="mb-8">
        <div className="text-xs font-mono text-sky-700 dark:text-sky-400 tracking-wide mb-2 flex flex-wrap items-center gap-2">
          <span className="font-semibold">CHAPTER 09</span>
          <span aria-hidden="true" className="text-slate-400">·</span>
          <span className="text-slate-500 dark:text-slate-400">{INTERVIEW_QUESTIONS.length} 道企业级真题 · 8 周上岗实战路线图</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-snug">
          模块九：C++ 方向 ROS 2 研发高频面试题库（{INTERVIEW_QUESTIONS.length} 题精讲 + 8 周速通清单）
        </h2>
        <p className="mt-2.5 text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
          覆盖 rclcpp 生命周期、现代 C++ 内存与并发陷阱、现代 CMake 链接、多线程回调死锁、零拷贝、TF2 时间同步、ros2_control 实时性以及 Qt 上位机跨线程段错误排错。点击题目可展开“标准回答 + 面试官追问加分点”；打印/导出 PDF 时将自动展开全部答案。
        </p>
      </div>

      {/* Interview Question Controls */}
      <div id="m9-interview-bank" className="scroll-mt-20 mb-14">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5 no-print">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            {['全部', '高频基础', '进阶原理', '架构排错'].map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => setDifficultyFilter(diff)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  difficultyFilter === diff
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {diff}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={expandAll}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              展开全部 {INTERVIEW_QUESTIONS.length} 题
            </button>
            <button
              type="button"
              onClick={collapseAll}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
            >
              全部收起
            </button>
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="p-8 rounded-xl border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
            当前筛选条件或搜索词未匹配到面试题，请尝试重置搜索条件。
          </div>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((q) => {
              const isOpen = expandedIds.includes(q.id);
              return (
                <div
                  key={q.id}
                  id={`interview-q-${q.id}`}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
                >
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => toggleQuestion(q.id)}
                    className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                  >
                    <div className="space-y-1">
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
                        <span className="text-sky-700 dark:text-sky-400 font-semibold tabular-nums">
                          Q{String(q.id).padStart(2, '0')}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{q.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{q.difficulty}</span>
                      </div>
                      <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                        {q.question}
                      </h3>
                    </div>
                    <span className="no-print text-slate-400 mt-1 shrink-0">
                      {isOpen ? (
                        <ChevronUp className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-4 h-4" aria-hidden="true" />
                      )}
                    </span>
                  </button>

                  {/* Answer body: collapsed visually unless expanded, but forced visible during print */}
                  <div
                    className={`print-expand-answer px-5 pb-5 pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-3 text-sm ${
                      isOpen ? 'block' : 'hidden'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1 flex items-center gap-1.5">
                        <BookOpenCheck className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                        <span>标准回答</span>
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                        {q.standardAnswer}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-lg bg-emerald-50/60 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/60">
                      <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 mb-1 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>面试官追问加分点</span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                        {q.bonusPoints}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 8-Week Checklist with localStorage Persistence */}
      <div id="m9-checklist" className="scroll-mt-20">
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mb-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                8 周 C++ 工程师转 ROS 2 上岗实战自检清单
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                勾选任务后进度自动保存至本地浏览器（localStorage），刷新页面不丢失
              </p>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs text-slate-500 dark:text-slate-400">当前完成进度</div>
                <div
                  data-testid="checklist-progress-text"
                  className="text-lg font-mono font-semibold tabular-nums text-sky-700 dark:text-sky-400"
                >
                  {progress.completed} / {progress.total} ({progress.percent}%)
                </div>
              </div>
              <button
                type="button"
                onClick={resetChecklist}
                className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                <span>重置进度</span>
              </button>
            </div>
          </div>

          <div className="mt-4 w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-600 dark:bg-sky-500 transition-all duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {EIGHT_WEEK_CHECKLIST.map((week) => (
            <div
              key={week.week}
              className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 print-break-inside-avoid"
            >
              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {week.title}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  {week.goal}
                </p>
              </div>

              <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                {week.tasks.map((task) => {
                  const checked = checkedTasks.includes(task.id);
                  return (
                    <button
                      key={task.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleTask(task.id)}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors flex items-start gap-2.5 cursor-pointer"
                    >
                      <span className="mt-0.5 shrink-0">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" aria-hidden="true" />
                        )}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span
                          className={`block text-xs sm:text-sm leading-snug ${
                            checked
                              ? 'line-through text-slate-400 dark:text-slate-500'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {task.text}
                        </span>
                        <span className="block text-[11px] font-mono text-slate-500 dark:text-slate-400 mt-0.5">
                          验收产物：{task.deliverable}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
