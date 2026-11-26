import React, { useState } from 'react';
import { StepForward, RotateCcw, Monitor, Cpu } from 'lucide-react';

interface SequenceStage {
  id: number;
  title: string;
  mainThreadAction: string;
  rosThreadAction: string;
  crossThreadSignal: string;
  highlightY: number;
  explanation: string;
  safetyNote: string;
}

const SEQUENCE_STAGES: SequenceStage[] = [
  {
    id: 1,
    title: '1. 启动初始化与双线程分离',
    mainThreadAction: 'rclcpp::init() -> QApplication::exec() 阻塞渲染 GUI',
    rosThreadAction: 'std::thread 启动 executor_->spin()',
    crossThreadSignal: '无跨线程访问，两套事件循环各司其职',
    highlightY: 56,
    explanation:
      'main() 先剥离 ROS 参数并初始化上下文，随后把 MainWindow 留在主线程运行 QApplication::exec()；MainWindow 内部启动后台 std::thread 专职跑 rclcpp::Executor::spin()。',
    safetyNote: '切忌在主线程直接调用 rclcpp::spin()，否则 Qt 界面会立即无响应卡死。',
  },
  {
    id: 2,
    title: '2. 点击 Qt 按钮发送控制指令 (/cmd_vel)',
    mainThreadAction: '用户点击 Forward -> onForwardClicked() 构造 Twist',
    rosThreadAction: 'DDS 异步写出 /cmd_vel 数据帧',
    crossThreadSignal: 'cmd_pub_->publish(cmd)（rclcpp::Publisher 线程安全）',
    highlightY: 102,
    explanation:
      '用户在 Qt 主线程点击按钮触发槽函数，直接调用 cmd_pub_->publish(cmd)。rclcpp::Publisher 的 publish() 内部具备锁保护与无锁缓冲，可安全从 Qt 主线程直接发起发布。',
    safetyNote: 'publish() 前需检查 if (cmd_pub_ && rclcpp::ok()) 防止退出阶段误发。',
  },
  {
    id: 3,
    title: '3. 后台收到 /battery_state 并跨线程安全刷新 UI',
    mainThreadAction: '主线程事件队列取出 lambda，安全刷新 battery_bar_->setValue(pct)',
    rosThreadAction: '订阅回调提取值类型 int pct',
    crossThreadSignal: 'QMetaObject::invokeMethod(this, [this, pct]{...}, Qt::QueuedConnection)',
    highlightY: 148,
    explanation:
      '后台 ROS 线程收到电池话题后，绝不直接调用 Qt 控件方法，而是将轻量的值拷贝 pct 封装进 lambda，通过 Qt::QueuedConnection 异步投递至主线程 Qt 事件循环排队执行。',
    safetyNote: '禁止直接跨线程操作 QWidget 指针，且 lambda 捕获必须按值捕获 [this, pct]，切勿按引用捕获局部变量！',
  },
  {
    id: 4,
    title: '4. 关闭窗口与 rclcpp::shutdown() 优雅退出',
    mainThreadAction: 'closeEvent() 触发 shutdownRos() 并等待 join() 返回后才析构控件',
    rosThreadAction: 'executor_->spin() 退出循环 -> 线程安全结束',
    crossThreadSignal: 'executor_->cancel() -> rclcpp::shutdown() -> ros_thread_.join()',
    highlightY: 194,
    explanation:
      '当用户关闭上位机窗口时，closeEvent 立即调用 executor_->cancel() 与 rclcpp::shutdown() 唤醒并退出后台 spin 循环，紧接着阻塞 ros_thread_.join() 确保后台线程彻底死亡后，再销毁 MainWindow 的控件指针。',
    safetyNote: '若未先 join() 就销毁 QProgressBar，后台刚投递的队列事件或正在运行的回调将访问野指针导致退出段错误。',
  },
];

export const QtRosThreadSim: React.FC = () => {
  const [stageIdx, setStageIdx] = useState<number>(2);
  const current = SEQUENCE_STAGES[stageIdx];

  return (
    <div
      data-testid="sim-qt-thread"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交互图 6：C++ Qt 上位机与 ROS 2 双线程并发交互时序图
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            演练 Qt 主事件循环与后台 rclcpp Executor 的安全交互、QueuedConnection 投递及优雅退出时序
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setStageIdx((prev) => (prev + 1) % SEQUENCE_STAGES.length)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <StepForward className="w-3.5 h-3.5" aria-hidden="true" />
            <span>下一阶段 ({current.id}/4)</span>
          </button>
          <button
            type="button"
            onClick={() => setStageIdx(0)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>从头演练</span>
          </button>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-7">
          <svg viewBox="0 0 600 232" className="w-full h-auto" role="img" aria-label="Qt 与 ROS 2 双线程交互时序图">
            <defs>
              <marker id="qt-right" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7 Z" fill="#0284c7" />
              </marker>
              <marker id="qt-left" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
                <path d="M7,1 L1,4 L7,7 Z" fill="#059669" />
              </marker>
            </defs>

            {/* Lifelines */}
            <rect x="18" y="10" width="168" height="32" rx="6" fill="rgba(2,132,199,0.12)" stroke="#0284c7" />
            <text x="102" y="30" textAnchor="middle" fontSize="12" fontWeight="600" fill="#0284c7">
              Main Thread (Qt GUI)
            </text>
            <line x1="102" y1="42" x2="102" y2="220" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />

            <rect x="414" y="10" width="168" height="32" rx="6" fill="rgba(5,150,105,0.12)" stroke="#059669" />
            <text x="498" y="30" textAnchor="middle" fontSize="12" fontWeight="600" fill="#059669">
              std::thread (rclcpp Spin)
            </text>
            <line x1="498" y1="42" x2="498" y2="220" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 3" />

            {/* Highlight Active Row Band */}
            <rect
              x="10"
              y={current.highlightY - 18}
              width="580"
              height="38"
              rx="6"
              fill="rgba(2,132,199,0.08)"
              stroke="#0284c7"
              strokeWidth="1"
            />

            {/* Row 1: Init */}
            <g onClick={() => setStageIdx(0)} className="cursor-pointer">
              <line x1="108" y1="58" x2="492" y2="58" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#qt-right)" />
              <text x="300" y="52" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-700 dark:text-slate-200">
                1. std::thread([&]&#123; executor_-&gt;spin(); &#125;)
              </text>
            </g>

            {/* Row 2: Button -> cmd_vel */}
            <g onClick={() => setStageIdx(1)} className="cursor-pointer">
              <line x1="108" y1="104" x2="492" y2="104" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#qt-right)" />
              <text x="300" y="98" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#0284c7">
                2. Clicked() -&gt; cmd_pub_-&gt;publish(cmd)
              </text>
            </g>

            {/* Row 3: ROS Sub -> QueuedConnection */}
            <g onClick={() => setStageIdx(2)} className="cursor-pointer">
              <line x1="492" y1="150" x2="108" y2="150" stroke="#059669" strokeWidth="1.8" markerEnd="url(#qt-left)" />
              <text x="300" y="144" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#059669">
                3. QMetaObject::invokeMethod(..., Qt::QueuedConnection)
              </text>
            </g>

            {/* Row 4: Shutdown + join */}
            <g onClick={() => setStageIdx(3)} className="cursor-pointer">
              <line x1="108" y1="196" x2="492" y2="196" stroke="#d97706" strokeWidth="1.8" markerEnd="url(#qt-right)" />
              <text x="300" y="190" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#d97706">
                4. closeEvent: cancel() + rclcpp::shutdown() + join()
              </text>
            </g>
          </svg>

          <div className="mt-3 flex flex-wrap gap-1.5 no-print">
            {SEQUENCE_STAGES.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStageIdx(idx)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  stageIdx === idx
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                阶段 {s.id}
              </button>
            ))}
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-5 space-y-3 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2">
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100" data-testid="qt-stage-title">
              {current.title}
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{current.explanation}</p>
          </div>

          <div className="grid grid-cols-1 gap-2">
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="font-semibold text-sky-700 dark:text-sky-300 flex items-center gap-1.5 mb-0.5">
                <Monitor className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Qt 主线程行为</span>
              </div>
              <p className="font-mono text-slate-700 dark:text-slate-300">{current.mainThreadAction}</p>
            </div>
            <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-800">
              <div className="font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 mb-0.5">
                <Cpu className="w-3.5 h-3.5" aria-hidden="true" />
                <span>ROS 后台线程行为</span>
              </div>
              <p className="font-mono text-slate-700 dark:text-slate-300">{current.rosThreadAction}</p>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 leading-relaxed">
            <strong className="font-semibold">崩溃防范要点：</strong>
            {current.safetyNote}
          </div>
        </div>
      </div>
    </div>
  );
};
