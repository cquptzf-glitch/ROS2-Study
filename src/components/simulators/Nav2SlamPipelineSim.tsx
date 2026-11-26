import React, { useState } from 'react';
import { Compass, Map, Navigation, Cpu } from 'lucide-react';

type NavPhase = 'slam' | 'nav2';

interface PipelineBlock {
  id: string;
  title: string;
  phaseNote: string;
  params: string;
  troubleshooting: string;
}

const PIPELINE_BLOCKS: Record<string, PipelineBlock> = {
  gz_bridge: {
    id: 'gz_bridge',
    title: 'Modern Gazebo (gz-sim) + ros_gz_bridge',
    phaseNote: '物理引擎使用 gz-transport，必须通过 YAML 桥接 /clock、/scan、/odom 与 /cmd_vel。',
    params: 'use_sim_time: true · gz_bridge.yaml 首行强制配置 /clock (GZ_TO_ROS)',
    troubleshooting: '若出现 TF 时间戳超时或机器人不动，先检查 ros2 topic hz /clock 是否有输出。',
  },
  slam_amcl: {
    id: 'slam_amcl',
    title: '阶段切换：slam_toolbox（建图）↔ AMCL（定位）',
    phaseNote:
      '两者核心职责相同：都在计算全局闭环误差并发布 map -> odom 变换。建图期用 slam_toolbox 输出 /map 后用 map_saver_cli 保存；运行期由 map_server + AMCL 粒子滤波接管。',
    params: 'slam_toolbox: resolution=0.05, max_laser_range=12.0 · AMCL: max_particles=2000',
    troubleshooting: '严禁同时启动 slam_toolbox 与 AMCL，否则两个节点抢发 map -> odom 导致 TF 树撕裂。',
  },
  costmap: {
    id: 'costmap',
    title: 'Costmap2D 代价地图（Static + Obstacle + Inflation）',
    phaseNote:
      '将静态地图与实时雷达障碍物叠加膨胀，生成从致命障碍（254）到安全自由区（0）的梯度代价场，是路径规划与窄道通行的调优核心。',
    params: 'inflation_radius: 0.45 m · cost_scaling_factor: 3.0 · robot_radius: 0.24 m',
    troubleshooting: '小车进不去窄门或原地转圈时，优先检查 inflation_radius 是否大于半通道宽度。',
  },
  bt_controller: {
    id: 'bt_controller',
    title: 'BT Navigator + PlannerServer + ControllerServer',
    phaseNote:
      'BehaviorTree.CPP 行为树节点统筹全局规划（Smac/NavFn）、局部跟踪（RPP/MPPI）与自定义业务条件（如 CheckBatteryCondition 低电量回充拦截）。',
    params: 'BT 插件宏：BT_REGISTER_NODES(factory) · RPP lookahead_dist: 0.6 m',
    troubleshooting: '局部控制震荡时配合 PlotJuggler 对比 /cmd_vel 与 /odom 角速度相位滞后。',
  },
};

export const Nav2SlamPipelineSim: React.FC = () => {
  const [phase, setPhase] = useState<NavPhase>('slam');
  const [selectedId, setSelectedId] = useState<string>('slam_amcl');

  const active = PIPELINE_BLOCKS[selectedId] ?? PIPELINE_BLOCKS.slam_amcl;

  return (
    <div
      data-testid="sim-nav2-slam"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交互图 7：Gazebo 仿真时钟 → SLAM 建图 → Nav2 自主导航数据闭环图
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            切换“建图阶段 / 导航阶段”理解 slam_toolbox 如何平滑过渡到 Nav2 AMCL + BehaviorTree
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 no-print">
          <button
            type="button"
            onClick={() => setPhase('slam')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              phase === 'slam'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Map className="w-3.5 h-3.5" aria-hidden="true" />
            <span>阶段 1：SLAM 建图保存</span>
          </button>
          <button
            type="button"
            onClick={() => setPhase('nav2')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              phase === 'nav2'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
            <span>阶段 2：Nav2 定位导航</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
          <svg
            viewBox="0 0 560 280"
            className="w-full h-auto"
            role="img"
            aria-label="Gazebo 到 SLAM 与 Nav2 数据闭环图"
          >
            <defs>
              <marker id="n2-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7 Z" fill="#0284c7" />
              </marker>
              <marker id="n2-arrow-emerald" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7 Z" fill="#059669" />
              </marker>
            </defs>

            {/* Box 1: Gazebo + ros_gz_bridge */}
            <g onClick={() => setSelectedId('gz_bridge')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="18"
                y="28"
                width="168"
                height="96"
                rx="8"
                fill={selectedId === 'gz_bridge' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                stroke={selectedId === 'gz_bridge' ? '#0284c7' : '#94a3b8'}
                strokeWidth={selectedId === 'gz_bridge' ? '2' : '1.2'}
              />
              <text x="102" y="54" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                gz-sim + ros_gz_bridge
              </text>
              <text x="102" y="74" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#059669">
                /clock (use_sim_time)
              </text>
              <text x="102" y="92" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                /scan · /odom
              </text>
              <text x="102" y="110" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                物理传感器与底盘真值
              </text>
            </g>

            {/* Arrow 1 -> 2 */}
            <line x1="186" y1="76" x2="218" y2="76" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#n2-arrow)" />

            {/* Box 2: SLAM or AMCL */}
            <g onClick={() => setSelectedId('slam_amcl')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="220"
                y="28"
                width="156"
                height="96"
                rx="8"
                fill={
                  selectedId === 'slam_amcl'
                    ? 'rgba(5, 150, 105, 0.14)'
                    : phase === 'slam'
                    ? 'rgba(5, 150, 105, 0.06)'
                    : 'transparent'
                }
                stroke={selectedId === 'slam_amcl' ? '#059669' : '#94a3b8'}
                strokeWidth={selectedId === 'slam_amcl' ? '2' : '1.2'}
              />
              <text x="298" y="54" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                {phase === 'slam' ? 'slam_toolbox' : 'map_server + AMCL'}
              </text>
              <text x="298" y="75" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#059669">
                发布 map -&gt; odom
              </text>
              <text x="298" y="93" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                {phase === 'slam' ? '在线扫描匹配建图' : '加载 .yaml/.pgm 定位'}
              </text>
              <text x="298" y="110" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                {phase === 'slam' ? 'map_saver_cli 导出' : '粒子滤波闭环定位'}
              </text>
            </g>

            {/* Arrow 2 -> 3 */}
            <line x1="376" y1="76" x2="404" y2="76" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#n2-arrow)" />

            {/* Box 3: Costmap2D */}
            <g onClick={() => setSelectedId('costmap')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="406"
                y="28"
                width="136"
                height="96"
                rx="8"
                fill={selectedId === 'costmap' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                stroke={selectedId === 'costmap' ? '#0284c7' : '#94a3b8'}
                strokeWidth={selectedId === 'costmap' ? '2' : '1.2'}
              />
              <text x="474" y="54" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                Costmap2D
              </text>
              <text x="474" y="74" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                静态层 + 障碍层
              </text>
              <text x="474" y="92" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#d97706">
                inflation_radius
              </text>
              <text x="474" y="110" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                安全膨胀代价梯度
              </text>
            </g>

            {/* Arrow 3 -> 4 */}
            <line x1="474" y1="124" x2="474" y2="160" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#n2-arrow)" />

            {/* Box 4: BT + Planner + Controller */}
            <g onClick={() => setSelectedId('bt_controller')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="220"
                y="162"
                width="322"
                height="74"
                rx="8"
                fill={
                  selectedId === 'bt_controller'
                    ? 'rgba(2, 132, 199, 0.14)'
                    : phase === 'nav2'
                    ? 'rgba(2, 132, 199, 0.06)'
                    : 'transparent'
                }
                stroke={selectedId === 'bt_controller' ? '#0284c7' : '#94a3b8'}
                strokeWidth={selectedId === 'bt_controller' ? '2' : '1.2'}
              />
              <text x="381" y="187" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                BT Navigator + Planner + Controller (RPP/MPPI)
              </text>
              <text x="381" y="206" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                CheckBatteryCondition · LifecycleManager 托管
              </text>
              <text x="381" y="224" textAnchor="middle" fontSize="10" fill="#0284c7">
                {phase === 'slam' ? '建图期可用 teleop_twist_keyboard 手动遥控绕场' : '自主跟踪全局路径并动态局部避障'}
              </text>
            </g>

            {/* Feedback arrow /cmd_vel back to Gazebo */}
            <path
              d="M 220 199 L 102 199 L 102 128"
              fill="none"
              stroke="#059669"
              strokeWidth="1.8"
              markerEnd="url(#n2-arrow-emerald)"
            />
            <text x="160" y="216" textAnchor="middle" fontSize="10.5" fontFamily="JetBrains Mono, monospace" fill="#059669">
              /cmd_vel (ROS_TO_GZ)
            </text>
          </svg>

          <div className="mt-2 flex flex-wrap gap-1.5 no-print">
            {Object.values(PIPELINE_BLOCKS).map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setSelectedId(b.id)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedId === b.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {b.title.split('：')[0].split('（')[0]}
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
              {selectedId === 'slam_amcl' ? (
                <Compass className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Cpu className="w-4 h-4" aria-hidden="true" />
              )}
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{active.title}</h5>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{active.phaseNote}</p>
            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">关键参数与配置要点</div>
              <code className="text-xs font-mono text-sky-700 dark:text-sky-300 break-all">{active.params}</code>
            </div>
            <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">常见排错经验</div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{active.troubleshooting}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
