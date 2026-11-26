import React, { useState } from 'react';
import { Layers, Cpu, Network, Code2, Boxes } from 'lucide-react';

interface LayerInfo {
  id: string;
  label: string;
  sublabel: string;
  y: number;
  colorClass: string;
  strokeHex: string;
  fillHex: string;
  libMechanism: string;
  cmakeLink: string;
  interviewFocus: string;
}

const LAYERS: LayerInfo[] = [
  {
    id: 'user-node',
    label: '5. 用户 C++ 节点与组件层',
    sublabel: 'ChassisManagerNode : public rclcpp::Node / ComponentContainer',
    y: 22,
    colorClass: 'text-sky-600 dark:text-sky-400',
    strokeHex: '#0284c7',
    fillHex: 'rgba(2, 132, 199, 0.12)',
    libMechanism:
      '编译为独立可执行文件或动态共享库（lib*.so）。若使用 rclcpp_components，多个节点共享同一个进程地址空间与全局内存堆，由 component_container 通过 class_loader (dlopen) 动态加载。',
    cmakeLink: 'target_link_libraries(my_node PUBLIC rclcpp::rclcpp ${my_msgs_TARGETS})',
    interviewFocus:
      '为什么推荐继承 rclcpp::Node 并传入 const rclcpp::NodeOptions &？答：保证 RAII 析构顺序安全，且零改动即可注册为组件节点开启同进程零拷贝。',
  },
  {
    id: 'rclcpp-rcl',
    label: '4. C++ 客户端库 (rclcpp) 与 C 核心库 (rcl)',
    sublabel: 'librclcpp.so -> librcl.so (Executor / WaitSet / NodeInterfaces)',
    y: 96,
    colorClass: 'text-cyan-600 dark:text-cyan-400',
    strokeHex: '#0891b2',
    fillHex: 'rgba(8, 145, 178, 0.10)',
    libMechanism:
      'rclcpp 提供 C++17 面向对象模板（std::shared_ptr、CallbackGroup、Timer、Action）；其内部委托纯 C 编写的 librcl.so 统一管理节点状态、参数与 wait_set 事件多路复用，确保 Python (rclpy) 与 Rust (rclrs) 共享同一份状态机内核。',
    cmakeLink: 'find_package(rclcpp REQUIRED) -> 导出 rclcpp::rclcpp 导入目标',
    interviewFocus:
      'Executor 线程模型与 wait_set 唤醒原理：rclcpp::spin() 阻塞在 rcl_wait()（底层对应 DDS GuardCondition/WaitSet），有消息或定时器就绪时再从回调组取任务执行。',
  },
  {
    id: 'rmw',
    label: '3. RMW 中间件抽象接口层 (ROS Middleware)',
    sublabel: 'librmw.so + rmw_implementation.so (运行时动态切换插件)',
    y: 170,
    colorClass: 'text-indigo-600 dark:text-indigo-400',
    strokeHex: '#4f46e5',
    fillHex: 'rgba(79, 70, 229, 0.10)',
    libMechanism:
      '定义纯 C 抽象接口（rmw_publish / rmw_take / rmw_create_node）。用户 C++ 二进制文件只链接 librmw.so，在进程启动时读取环境变量 RMW_IMPLEMENTATION，通过 dlopen 动态加载具体 DDS 适配器，无需重新编译业务代码。',
    cmakeLink: '业务代码不直接链接 rmw_fastrtps_cpp，由运行时动态符号解析完成绑定',
    interviewFocus:
      '不重新编译代码，如何将底层通信从 FastDDS 切换到 CycloneDDS 或 Lyrical Luth 的 Zenoh？答：export RMW_IMPLEMENTATION=rmw_cyclonedds_cpp 或 rmw_zenoh_cpp。',
  },
  {
    id: 'dds',
    label: '2. 通信中间件层 (DDS / Zenoh)',
    sublabel: 'FastDDS (eProsima) · CycloneDDS (Eclipse) · Zenoh (2026 LTS 重点增强)',
    y: 244,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    strokeHex: '#059669',
    fillHex: 'rgba(5, 150, 105, 0.10)',
    libMechanism:
      '负责 SPDP/SEDP 去中心化服务发现、CDR 序列化、QoS 契约校验（RxO）、可靠性重传（Reliable NACK/ACK）以及同机共享内存（SHM）零拷贝传输。FastDDS 可通过 FASTRTPS_DEFAULT_PROFILES_FILE 加载 XML 调优。',
    cmakeLink: '由 rmw_fastrtps_cpp.so / rmw_cyclonedds_cpp.so 内部桥接至 Fast-CDR 与 DDS 运行时',
    interviewFocus:
      '为什么 Wi-Fi 环境下多台 ROS 2 机器人容易通信卡顿？答：DDS UDP 组播发现风暴（SPDP），生产环境应改用 FastDDS Discovery Server 单播或 Zenoh 路由器。',
  },
  {
    id: 'os',
    label: '1. 操作系统与内核传输层',
    sublabel: 'Ubuntu 22.04/24.04/26.04 · WSL 2 Mirrored · PREEMPT_RT',
    y: 318,
    colorClass: 'text-slate-600 dark:text-slate-300',
    strokeHex: '#475569',
    fillHex: 'rgba(71, 85, 105, 0.10)',
    libMechanism:
      '提供 POSIX 线程调度（SCHED_FIFO 实时优先级）、/dev/shm POSIX 共享内存段、UDP/TCP 套接字缓冲区（net.core.rmem_max）以及 SocketCAN / usbipd-win 外设驱动支撑。',
    cmakeLink: '底层链接 pthread、dl、rt 等系统标准动态库',
    interviewFocus:
      'WSL 2 默认 NAT 模式为何无法跨机发现 DDS 节点？答：NAT 阻断了局域网 UDP 组播包，必须在 .wslconfig 开启 networkingMode=mirrored 镜像网络模式。',
  },
];

export const ArchitectureLayersSim: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('user-node');
  const activeLayer = LAYERS.find((l) => l.id === selectedId) ?? LAYERS[0];

  const getIcon = (id: string) => {
    switch (id) {
      case 'user-node':
        return <Boxes className="w-4 h-4" aria-hidden="true" />;
      case 'rclcpp-rcl':
        return <Code2 className="w-4 h-4" aria-hidden="true" />;
      case 'rmw':
        return <Layers className="w-4 h-4" aria-hidden="true" />;
      case 'dds':
        return <Network className="w-4 h-4" aria-hidden="true" />;
      default:
        return <Cpu className="w-4 h-4" aria-hidden="true" />;
    }
  };

  return (
    <div
      data-testid="sim-architecture"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            交互图 1：ROS 2 五层架构与 C++ 动态链接依赖图
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            点击任意架构层级，检视其动态库加载机制、CMake 链接写法与面试考点
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          交互提示：点击左侧层块切换
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left Interactive SVG Stack */}
        <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
          <svg
            viewBox="0 0 540 392"
            className="w-full h-auto max-h-[380px]"
            role="img"
            aria-label="ROS 2 分层架构图"
          >
            <defs>
              <marker
                id="arch-arrow"
                markerWidth="8"
                markerHeight="8"
                refX="4"
                refY="4"
                orient="auto"
              >
                <path d="M1,1 L7,4 L1,7 Z" fill="#64748b" />
              </marker>
            </defs>

            {LAYERS.map((layer, index) => {
              const isSelected = layer.id === selectedId;
              return (
                <g key={layer.id}>
                  {/* Downward dependency arrow between layers */}
                  {index < LAYERS.length - 1 && (
                    <line
                      x1="270"
                      y1={layer.y + 54}
                      x2="270"
                      y2={layer.y + 72}
                      stroke="#64748b"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      markerEnd="url(#arch-arrow)"
                    />
                  )}
                  <g
                    onClick={() => setSelectedId(layer.id)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={layer.label}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(layer.id);
                      }
                    }}
                  >
                    <rect
                      x="20"
                      y={layer.y}
                      width="500"
                      height="54"
                      rx="8"
                      fill={isSelected ? layer.fillHex : 'transparent'}
                      stroke={isSelected ? layer.strokeHex : '#94a3b8'}
                      strokeWidth={isSelected ? '2' : '1'}
                      className="transition-all duration-150"
                    />
                    <text
                      x="38"
                      y={layer.y + 22}
                      fontSize="13.5"
                      fontWeight="600"
                      fill="currentColor"
                      className={isSelected ? 'text-slate-900 dark:text-white' : 'text-slate-700 dark:text-slate-300'}
                    >
                      {layer.label}
                    </text>
                    <text
                      x="38"
                      y={layer.y + 41}
                      fontSize="10.5"
                      fontFamily="JetBrains Mono, monospace"
                      fill="currentColor"
                      className="text-slate-500 dark:text-slate-400"
                    >
                      {layer.sublabel}
                    </text>
                    {isSelected && (
                      <text
                        x="504"
                        y={layer.y + 31}
                        textAnchor="end"
                        fontSize="11"
                        fontWeight="600"
                        fill={layer.strokeHex}
                      >
                        当前选中
                      </text>
                    )}
                  </g>
                </g>
              );
            })}
          </svg>

          {/* Accessible quick-switch buttons */}
          <div className="mt-3 flex flex-wrap gap-1.5 no-print">
            {LAYERS.map((layer) => {
              const shortLabel =
                layer.id === 'user-node'
                  ? '5. 节点层'
                  : layer.id === 'rclcpp-rcl'
                  ? '4. rclcpp/rcl'
                  : layer.id === 'rmw'
                  ? '3. RMW 抽象'
                  : layer.id === 'dds'
                  ? '2. DDS/Zenoh'
                  : '1. OS 内核';
              return (
                <button
                  key={layer.id}
                  type="button"
                  onClick={() => setSelectedId(layer.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedId === layer.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {getIcon(layer.id)}
                  <span>{shortLabel}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Detail Panel */}
        <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className={activeLayer.colorClass}>{getIcon(activeLayer.id)}</span>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {activeLayer.label}
              </h5>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                底层动态库与运行时机制
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {activeLayer.libMechanism}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">
                CMake / 编译链接契约
              </div>
              <code className="text-xs font-mono text-sky-700 dark:text-sky-300 break-all">
                {activeLayer.cmakeLink}
              </code>
            </div>

            <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60">
              <div className="text-xs font-semibold text-sky-800 dark:text-sky-300 mb-1">
                高频面试追问点
              </div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                {activeLayer.interviewFocus}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
