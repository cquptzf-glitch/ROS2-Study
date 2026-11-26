import React, { useState } from 'react';
import { CheckCircle2, XCircle, ArrowRightLeft, Radio, Cpu, Zap } from 'lucide-react';
import {
  evaluateQosCompatibility,
  calculateZeroCopyMetrics,
  QosReliability,
  QosDurability,
  TransportMode,
} from '../../logic/ros2Simulators';

type CommPattern = 'topic' | 'service' | 'action' | 'parameter';

const COMM_DETAILS: Record<
  CommPattern,
  {
    title: string;
    direction: string;
    cppApi: string;
    underlying: string;
    useCase: string;
  }
> = {
  topic: {
    title: 'Topic（发布/订阅单向异步流）',
    direction: 'Publisher ───(DDS Pub/Sub)───▶ Subscriber (1:N / N:M)',
    cppApi: 'create_publisher<Msg>() + create_subscription<Msg>()',
    underlying: '基于 DDS DataWriter / DataReader，支持 Best Effort 与零拷贝指针传递',
    useCase: '激光雷达 /scan、相机图像、/cmd_vel 速度流、/odom 里程计',
  },
  service: {
    title: 'Service（请求/响应短事务）',
    direction: 'Client ──Req──▶ Server ──Resp──▶ Client (N:1 同步/异步回调)',
    cppApi: 'create_service<Srv>() + client->async_send_request(req, cb)',
    underlying: '底层由 rq/<srv> 与 rr/<srv> 两个可靠 DDS Topic 拼装实现',
    useCase: '地图保存、紧急使能开关、修改底盘限速、触发单次标定',
  },
  action: {
    title: 'Action（长耗时可抢占反馈任务）',
    direction: 'Client ⇄ [Goal Srv / Cancel Srv / Result Srv + Feedback Topic + Status Topic]',
    cppApi: 'rclcpp_action::create_server<Act>() (Goal / Cancel / Accepted 三回调)',
    underlying: '内部组合 3 个 Service 与 2 个 Topic；服务端必须在独立线程执行循环',
    useCase: 'Nav2 导航至目标点、自动回充对接、机械臂多点轨迹执行',
  },
  parameter: {
    title: 'Parameter（节点私有动态配置）',
    direction: 'Client ──(ros2 param set)──▶ Node 参数服务 ──▶ OnSetParametersCallback',
    cppApi: 'declare_parameter() + add_on_set_parameters_callback()',
    underlying: 'ROS 2 取消全局参数服务器，每个节点内置 6 个参数管理 Service',
    useCase: '在线调整 PID 增益、实时修改最高限速、动态开关调试日志',
  },
};

export const CommQosZeroCopySim: React.FC = () => {
  const [pattern, setPattern] = useState<CommPattern>('topic');
  const [pubRel, setPubRel] = useState<QosReliability>('best_effort');
  const [pubDur, setPubDur] = useState<QosDurability>('volatile');
  const [subRel, setSubRel] = useState<QosReliability>('reliable');
  const [subDur, setSubDur] = useState<QosDurability>('volatile');
  const [transportMode, setTransportMode] = useState<TransportMode>('inter_process');

  const qosResult = evaluateQosCompatibility(
    { reliability: pubRel, durability: pubDur },
    { reliability: subRel, durability: subDur }
  );

  const memMetrics = calculateZeroCopyMetrics(transportMode, 6.2);
  const currentComm = COMM_DETAILS[pattern];

  return (
    <div
      data-testid="sim-comm-qos"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      {/* Header + Comm Pattern Tabs */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交互图 2：四大通信机制、QoS 兼容性检测与零拷贝内存路径模拟器
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            切换通信模型、调整 Pub/Sub QoS 契约，并对比跨进程与同进程 std::unique_ptr 内存开销
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 no-print">
          {(['topic', 'service', 'action', 'parameter'] as CommPattern[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPattern(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                pattern === p
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Section 1: Dynamic Comm Topology SVG */}
      <div className="p-5 border-b border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          <div className="lg:col-span-7">
            <svg viewBox="0 0 560 135" className="w-full h-auto" role="img" aria-label="ROS 2 通信链路图">
              <defs>
                <marker id="flow-right" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M1,1 L7,4 L1,7 Z" fill={qosResult.compatible ? '#0284c7' : '#dc2626'} />
                </marker>
                <marker id="flow-left" markerWidth="8" markerHeight="8" refX="2" refY="4" orient="auto">
                  <path d="M7,1 L1,4 L7,7 Z" fill="#059669" />
                </marker>
              </defs>

              {/* Left Node */}
              <rect
                x="14"
                y="26"
                width="136"
                height="82"
                rx="8"
                fill="rgba(2,132,199,0.09)"
                stroke="#0284c7"
                strokeWidth="1.5"
              />
              <text x="82" y="58" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">
                {pattern === 'topic' ? 'Publisher 节点' : pattern === 'parameter' ? 'Param Client' : 'Client 节点'}
              </text>
              <text x="82" y="80" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#0284c7">
                {pattern === 'topic' ? 'camera_node' : 'planner_node'}
              </text>

              {/* Right Node */}
              <rect
                x="410"
                y="26"
                width="136"
                height="82"
                rx="8"
                fill="rgba(5,150,105,0.09)"
                stroke="#059669"
                strokeWidth="1.5"
              />
              <text x="478" y="58" textAnchor="middle" fontSize="13" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">
                {pattern === 'topic' ? 'Subscriber 节点' : pattern === 'parameter' ? 'Target Node' : 'Server 节点'}
              </text>
              <text x="478" y="80" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#059669">
                {pattern === 'topic' ? 'perception_node' : 'chassis_manager'}
              </text>

              {/* Connection Lines */}
              {pattern === 'topic' && (
                <g>
                  <line
                    x1="154"
                    y1="67"
                    x2="404"
                    y2="67"
                    stroke={qosResult.compatible ? '#0284c7' : '#dc2626'}
                    strokeWidth="2.5"
                    strokeDasharray={qosResult.compatible ? 'none' : '5 4'}
                    markerEnd="url(#flow-right)"
                  />
                  <text
                    x="280"
                    y="54"
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                    fill={qosResult.compatible ? '#0284c7' : '#dc2626'}
                  >
                    {qosResult.compatible ? '异步消息流 (/scan, /image_raw)' : 'QoS 不兼容 — DDS 断连阻断'}
                  </text>
                </g>
              )}

              {pattern === 'service' && (
                <g>
                  <line x1="154" y1="50" x2="404" y2="50" stroke="#0284c7" strokeWidth="2" markerEnd="url(#flow-right)" />
                  <text x="280" y="40" textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono, monospace" fill="#0284c7">
                    1. Request (SetMaxSpeed::Request)
                  </text>
                  <line x1="406" y1="86" x2="156" y2="86" stroke="#059669" strokeWidth="2" markerEnd="url(#flow-left)" />
                  <text x="280" y="106" textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono, monospace" fill="#059669">
                    2. Response (SetMaxSpeed::Response)
                  </text>
                </g>
              )}

              {pattern === 'action' && (
                <g>
                  <line x1="154" y1="38" x2="404" y2="38" stroke="#0284c7" strokeWidth="2" markerEnd="url(#flow-right)" />
                  <text x="280" y="28" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#0284c7">
                    Goal / Cancel Service
                  </text>
                  <line x1="406" y1="67" x2="156" y2="67" stroke="#d97706" strokeWidth="2" strokeDasharray="4 3" markerEnd="url(#flow-left)" />
                  <text x="280" y="61" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#d97706">
                    Continuous Feedback Topic (10Hz)
                  </text>
                  <line x1="406" y1="96" x2="156" y2="96" stroke="#059669" strokeWidth="2" markerEnd="url(#flow-left)" />
                  <text x="280" y="114" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#059669">
                    Final Result Service
                  </text>
                </g>
              )}

              {pattern === 'parameter' && (
                <g>
                  <line x1="154" y1="50" x2="404" y2="50" stroke="#0284c7" strokeWidth="2" markerEnd="url(#flow-right)" />
                  <text x="280" y="40" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#0284c7">
                    /node/set_parameters Service
                  </text>
                  <line x1="406" y1="86" x2="156" y2="86" stroke="#059669" strokeWidth="2" markerEnd="url(#flow-left)" />
                  <text x="280" y="105" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#059669">
                    SetParametersResult (成功/拦截原因)
                  </text>
                </g>
              )}
            </svg>
          </div>

          <div className="lg:col-span-5 space-y-2 text-xs">
            <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>{currentComm.title}</span>
            </div>
            <p className="font-mono text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded">
              {currentComm.cppApi}
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-800 dark:text-slate-200">底层机制：</strong>
              {currentComm.underlying}
            </p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong className="text-slate-800 dark:text-slate-200">典型场景：</strong>
              {currentComm.useCase}
            </p>
          </div>
        </div>
      </div>

      {/* Section 2: QoS Checker + Zero-Copy Memory Comparison */}
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
        {/* QoS RxO Compatibility Tester */}
        <div className="p-5 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>QoS 契约匹配检测器（RxO: Offered &ge; Requested）</span>
            </h5>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="font-semibold text-slate-700 dark:text-slate-200">Publisher (Offered)</div>
              <label className="block">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Reliability</span>
                <select
                  aria-label="Publisher Reliability"
                  value={pubRel}
                  onChange={(e) => setPubRel(e.target.value as QosReliability)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-slate-800 dark:text-slate-100"
                >
                  <option value="reliable">Reliable (必达重传)</option>
                  <option value="best_effort">Best Effort (尽最大努力)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Durability</span>
                <select
                  aria-label="Publisher Durability"
                  value={pubDur}
                  onChange={(e) => setPubDur(e.target.value as QosDurability)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-slate-800 dark:text-slate-100"
                >
                  <option value="transient_local">Transient Local (保留末帧)</option>
                  <option value="volatile">Volatile (仅发在线)</option>
                </select>
              </label>
            </div>

            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="font-semibold text-slate-700 dark:text-slate-200">Subscriber (Requested)</div>
              <label className="block">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Reliability</span>
                <select
                  aria-label="Subscriber Reliability"
                  value={subRel}
                  onChange={(e) => setSubRel(e.target.value as QosReliability)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-slate-800 dark:text-slate-100"
                >
                  <option value="reliable">Reliable (必达重传)</option>
                  <option value="best_effort">Best Effort (尽最大努力)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-slate-500 dark:text-slate-400 block mb-1">Durability</span>
                <select
                  aria-label="Subscriber Durability"
                  value={subDur}
                  onChange={(e) => setSubDur(e.target.value as QosDurability)}
                  className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-1 text-slate-800 dark:text-slate-100"
                >
                  <option value="transient_local">Transient Local (需补历史)</option>
                  <option value="volatile">Volatile (不需历史)</option>
                </select>
              </label>
            </div>
          </div>

          <div
            data-testid="qos-status-box"
            className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
              qosResult.compatible
                ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200'
                : 'bg-red-50/80 dark:bg-red-950/30 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200'
            }`}
          >
            {qosResult.compatible ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
            ) : (
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
            )}
            <div>
              <div className="font-semibold">
                {qosResult.compatible ? '状态：QoS 匹配成功（可通信）' : '状态：QoS 不兼容（静默丢包阻断）'}
              </div>
              <p className="mt-0.5 leading-relaxed opacity-90">{qosResult.reason}</p>
            </div>
          </div>
        </div>

        {/* Zero-Copy Memory Path Comparison */}
        <div className="p-5 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h5 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>内存拷贝路径对比（1080p RGB 图像 6.2 MB/帧）</span>
            </h5>

            <div className="flex items-center gap-1 p-0.5 rounded-md bg-slate-100 dark:bg-slate-800 no-print">
              <button
                type="button"
                onClick={() => setTransportMode('inter_process')}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  transportMode === 'inter_process'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                跨进程 DDS 拷贝
              </button>
              <button
                type="button"
                onClick={() => setTransportMode('intra_process_unique_ptr')}
                className={`px-2.5 py-1 rounded text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer ${
                  transportMode === 'intra_process_unique_ptr'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                同进程 unique_ptr 零拷贝
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">内存拷贝次数</div>
              <div
                data-testid="zerocopy-copies"
                className={`text-lg font-mono font-semibold tabular-nums mt-0.5 ${
                  memMetrics.copiesCount === 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {memMetrics.copiesCount} 次
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">单帧内存吞吐</div>
              <div className="text-lg font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {memMetrics.totalBandwidthMb} MB
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-[11px] text-slate-500 dark:text-slate-400">端到端传输耗时</div>
              <div className="text-lg font-mono font-semibold tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                {memMetrics.estimatedLatencyUs} µs
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
              <Cpu className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" aria-hidden="true" />
              <span>
                {transportMode === 'intra_process_unique_ptr'
                  ? '路径：pub->publish(std::move(unique_ptr)) ──▶ 8B 指针移交 ──▶ sub(UniquePtr)'
                  : '路径：堆分配 ──▶ CDR序列化拷贝 ──▶ DDS Socket/SHM ──▶ 反序列化拷贝'}
              </span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{memMetrics.summary}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
