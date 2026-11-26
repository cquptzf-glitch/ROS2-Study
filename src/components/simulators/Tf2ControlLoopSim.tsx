import React, { useState } from 'react';
import { Compass, Cpu } from 'lucide-react';

interface NodeDetail {
  id: string;
  category: 'TF2 坐标系' | 'ros2_control 闭环';
  title: string;
  publisher: string;
  frequency: string;
  details: string;
}

const INSPECT_ITEMS: Record<string, NodeDetail> = {
  map: {
    id: 'map',
    category: 'TF2 坐标系',
    title: 'map -> odom 全局定位修正变换',
    publisher: 'AMCL / Cartographer / SLAM Toolbox',
    frequency: '1–5 Hz（允许离散跳变修正累积漂移）',
    details: '将局部里程计坐标系锚定到全局静态栅格地图。因为闭环修正时会发生瞬时位姿跳变，局部避障控制器不应直接在 map 下做高频微分控制。',
  },
  odom: {
    id: 'odom',
    category: 'TF2 坐标系',
    title: 'odom -> base_link 连续里程计变换',
    publisher: 'diff_drive_controller / EKF (robot_localization)',
    frequency: '50–100 Hz（局部绝对连续，不允许跳变）',
    details: '由轮式编码器或轮速+IMU 融合积分得到，随时间存在累积误差，但短期内平滑连续，供局部轨迹追踪与代价地图滚动窗口使用。',
  },
  base_link: {
    id: 'base_link',
    category: 'TF2 坐标系',
    title: 'base_link 机器人底盘几何中心刚体',
    publisher: 'robot_state_publisher (解析 URDF)',
    frequency: '静态/动态子关节联动枢纽',
    details: '连接地面投影 base_footprint、传感器刚体（laser_link）以及左右连续转动车轮（left_wheel_joint / right_wheel_joint）。',
  },
  laser_link: {
    id: 'laser_link',
    category: 'TF2 坐标系',
    title: 'base_link -> laser_link 静态外参变换',
    publisher: 'StaticTransformBroadcaster / robot_state_publisher',
    frequency: '仅发一次（Transient Local QoS）',
    details: '激光雷达固连于车体（x=+0.20m, z=+0.10m），使用静态 TF 广播无需持续消耗带宽，且可被任意时刻的 TF 查询无外推地插值引用。',
  },
  controller_mgr: {
    id: 'controller_mgr',
    category: 'ros2_control 闭环',
    title: 'Controller Manager 实时调度中枢',
    publisher: 'ros2_control_node（独立实时线程 100–500 Hz）',
    frequency: 'update_rate = 100 Hz 确定性控制环',
    details: '接收上层 Nav2 的 /cmd_vel，由 diff_drive_controller 运动学逆解算出左右轮目标角速度写入 CommandInterface，同时驱动 joint_state_broadcaster 发布 /joint_states。',
  },
  system_interface: {
    id: 'system_interface',
    category: 'ros2_control 闭环',
    title: 'C++ SystemInterface 插件 (read / write)',
    publisher: 'pluginlib 动态加载 libdiff_hw_interface.so',
    frequency: '与 ControllerManager 同频锁步执行',
    details: '在 read() 中从 SocketCAN 无锁缓冲区读取编码器位置与转速写入 StateInterface；在 write() 中将 CommandInterface 的目标速度下发给伺服电机寄存器。严禁在 read/write 中执行 malloc 或阻塞 I/O。',
  },
};

export const Tf2ControlLoopSim: React.FC = () => {
  const [selected, setSelected] = useState<string>('system_interface');
  const active = INSPECT_ITEMS[selected] ?? INSPECT_ITEMS.system_interface;

  const isActive = (id: string) => selected === id;

  return (
    <div
      data-testid="sim-tf2-control"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交互图 5：TF2 坐标变换树与 ros2_control C++ 硬件插件闭环图
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            点击任意坐标系或控制插件模块，查看数据流向、发布频率与 C++ 实时性契约
          </p>
        </div>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        <div className="lg:col-span-7">
          <svg viewBox="0 0 560 250" className="w-full h-auto" role="img" aria-label="TF2 与 ros2_control 闭环图">
            <defs>
              <marker id="tf-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7 Z" fill="#0284c7" />
              </marker>
              <marker id="hw-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7 Z" fill="#059669" />
              </marker>
            </defs>

            {/* Left Half: TF2 Tree */}
            <text x="12" y="20" fontSize="11.5" fontWeight="600" fill="#0284c7">
              TF2 坐标变换树 (DAG)
            </text>

            <g onClick={() => setSelected('map')} className="cursor-pointer">
              <rect x="65" y="34" width="110" height="36" rx="6" fill={isActive('map') ? 'rgba(2,132,199,0.18)' : 'rgba(2,132,199,0.06)'} stroke="#0284c7" strokeWidth={isActive('map') ? '2.2' : '1.2'} />
              <text x="120" y="56" textAnchor="middle" fontSize="12" fontFamily="JetBrains Mono, monospace" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">map</text>
            </g>

            <line x1="120" y1="70" x2="120" y2="94" stroke="#0284c7" strokeWidth="1.5" markerEnd="url(#tf-arrow)" />

            <g onClick={() => setSelected('odom')} className="cursor-pointer">
              <rect x="65" y="96" width="110" height="36" rx="6" fill={isActive('odom') ? 'rgba(2,132,199,0.18)' : 'rgba(2,132,199,0.06)'} stroke="#0284c7" strokeWidth={isActive('odom') ? '2.2' : '1.2'} />
              <text x="120" y="118" textAnchor="middle" fontSize="12" fontFamily="JetBrains Mono, monospace" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">odom</text>
            </g>

            <line x1="120" y1="132" x2="120" y2="156" stroke="#0284c7" strokeWidth="1.5" markerEnd="url(#tf-arrow)" />

            <g onClick={() => setSelected('base_link')} className="cursor-pointer">
              <rect x="55" y="158" width="130" height="36" rx="6" fill={isActive('base_link') ? 'rgba(2,132,199,0.18)' : 'rgba(2,132,199,0.06)'} stroke="#0284c7" strokeWidth={isActive('base_link') ? '2.2' : '1.2'} />
              <text x="120" y="180" textAnchor="middle" fontSize="12" fontFamily="JetBrains Mono, monospace" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">base_link</text>
            </g>

            <line x1="90" y1="194" x2="68" y2="214" stroke="#0284c7" strokeWidth="1.4" markerEnd="url(#tf-arrow)" />
            <line x1="150" y1="194" x2="172" y2="214" stroke="#0284c7" strokeWidth="1.4" markerEnd="url(#tf-arrow)" />

            <g onClick={() => setSelected('laser_link')} className="cursor-pointer">
              <rect x="12" y="216" width="104" height="28" rx="5" fill={isActive('laser_link') ? 'rgba(2,132,199,0.18)' : 'rgba(2,132,199,0.06)'} stroke="#0284c7" strokeWidth={isActive('laser_link') ? '2' : '1.2'} />
              <text x="64" y="234" textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-800 dark:text-slate-100">laser_link</text>
            </g>

            <rect x="132" y="216" width="114" height="28" rx="5" fill="rgba(100,116,139,0.08)" stroke="#64748b" strokeWidth="1.2" />
            <text x="189" y="234" textAnchor="middle" fontSize="11" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-700 dark:text-slate-300">wheel_joint</text>

            {/* Divider */}
            <line x1="270" y1="18" x2="270" y2="240" stroke="#cbd5e1" strokeDasharray="4 4" />

            {/* Right Half: ros2_control Loop */}
            <text x="292" y="20" fontSize="11.5" fontWeight="600" fill="#059669">
              ros2_control C++ 实时硬件闭环
            </text>

            <rect x="305" y="34" width="225" height="36" rx="6" fill="rgba(100,116,139,0.08)" stroke="#64748b" />
            <text x="417" y="56" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="currentColor" className="text-slate-800 dark:text-slate-200">
              上层规划器 Nav2 (/cmd_vel)
            </text>

            <line x1="417" y1="70" x2="417" y2="94" stroke="#059669" strokeWidth="1.6" markerEnd="url(#hw-arrow)" />

            <g onClick={() => setSelected('controller_mgr')} className="cursor-pointer">
              <rect x="295" y="96" width="245" height="50" rx="7" fill={isActive('controller_mgr') ? 'rgba(5,150,105,0.18)' : 'rgba(5,150,105,0.07)'} stroke="#059669" strokeWidth={isActive('controller_mgr') ? '2.2' : '1.4'} />
              <text x="417" y="117" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">
                Controller Manager + DiffDrive
              </text>
              <text x="417" y="135" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#059669">
                CommandInterface / StateInterface
              </text>
            </g>

            {/* Read/Write bidirectional arrows */}
            <line x1="365" y1="146" x2="365" y2="178" stroke="#059669" strokeWidth="1.6" markerEnd="url(#hw-arrow)" />
            <text x="358" y="166" textAnchor="end" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#059669">write()</text>

            <line x1="468" y1="180" x2="468" y2="148" stroke="#0284c7" strokeWidth="1.6" markerEnd="url(#tf-arrow)" />
            <text x="475" y="166" textAnchor="start" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#0284c7">read()</text>

            <g onClick={() => setSelected('system_interface')} className="cursor-pointer">
              <rect x="295" y="182" width="245" height="56" rx="7" fill={isActive('system_interface') ? 'rgba(5,150,105,0.18)' : 'rgba(5,150,105,0.07)'} stroke="#059669" strokeWidth={isActive('system_interface') ? '2.2' : '1.4'} />
              <text x="417" y="205" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-white">
                C++ SystemInterface (pluginlib)
              </text>
              <text x="417" y="224" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-600 dark:text-slate-300">
                SocketCAN / 电机寄存器读写
              </text>
            </g>

            {/* Feedback link from Controller Manager to odom */}
            <path d="M 295 121 L 245 121 L 178 114" fill="none" stroke="#0284c7" strokeWidth="1.3" strokeDasharray="3 2" markerEnd="url(#tf-arrow)" />
          </svg>

          <div className="mt-3 flex flex-wrap gap-1.5 no-print">
            {Object.values(INSPECT_ITEMS).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item.id)}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selected === item.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {item.id}
              </button>
            ))}
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-5 space-y-3 text-xs">
          <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
            <div className="flex items-center gap-1.5 text-sky-700 dark:text-sky-300 font-medium">
              {active.category === 'TF2 坐标系' ? (
                <Compass className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Cpu className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{active.category}</span>
            </div>
            <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{active.title}</h5>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              <div>
                <span className="text-slate-500 dark:text-slate-400">归属/发布节点：</span>
                <span className="font-mono text-slate-800 dark:text-slate-200">{active.publisher}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-slate-400">频率与语义：</span>
                <span className="text-slate-800 dark:text-slate-200">{active.frequency}</span>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed pt-1 border-t border-slate-200 dark:border-slate-700">
              {active.details}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
