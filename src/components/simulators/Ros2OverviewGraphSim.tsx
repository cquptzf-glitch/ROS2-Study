import React, { useState } from 'react';
import { GitBranch, Layers, Network, FolderTree } from 'lucide-react';

type OverviewTab = 'graph' | 'workspace' | 'evolution';

interface GraphElementDetail {
  id: string;
  label: string;
  category: string;
  summary: string;
  cliCommand: string;
  cppHint: string;
}

const GRAPH_ELEMENTS: Record<string, GraphElementDetail> = {
  lidar: {
    id: 'lidar',
    label: '/lidar_driver_node（感知采集节点）',
    category: 'Node · 传感器驱动',
    summary:
      '负责通过网口或 USB 读取激光雷达原始点云并转换为 sensor_msgs/msg/LaserScan。作为独立 Node 运行，即使雷达驱动异常断开也不会拖垮底盘电机控制进程。',
    cliCommand: 'ros2 node info /lidar_driver_node',
    cppHint: '使用 rclcpp::SensorDataQoS()（BestEffort）避免无线/弱网下的队列阻塞延迟。',
  },
  nav2: {
    id: 'nav2',
    label: '/nav2_controller（导航决策与规划）',
    category: 'Node · 上层算法栈',
    summary:
      '订阅 /scan 与 /odom，结合全局路径与局部代价地图计算避障速度指令（/cmd_vel），并在低电量或抵达对接区时向底盘发起回充 Action 请求。',
    cliCommand: 'ros2 lifecycle list /controller_server',
    cppHint: '通过 tf2_ros::Buffer 对齐雷达与底盘坐标系，再发布几何速度指令。',
  },
  chassis: {
    id: 'chassis',
    label: '/chassis_manager_node（底盘主控节点）',
    category: 'Node · 执行与状态中心',
    summary:
      '本教程核心实战节点：同时扮演“Topic 发布/订阅者 + Service 服务端 + Action 服务端 + 参数服务器”，解算轮速并向下层硬件输出控制量。',
    cliCommand: 'ros2 topic echo /wheel_telemetry',
    cppHint: '继承 rclcpp::Node 并透传 NodeOptions，可零修改升级为组件节点。',
  },
  hmi: {
    id: 'hmi',
    label: '/robot_hmi_qt（Qt 上位机控制台）',
    category: 'Node · 人机交互客户端',
    summary:
      '运行在 Windows WSLg 或工控机触摸屏上的 C++ Qt 界面，后台独立线程 spin ROS 2，通过 Service 调整限速并实时显示电池与速度曲线。',
    cliCommand: 'ros2 service call /set_max_speed chassis_interfaces/srv/SetMaxSpeed "{max_linear_mps: 1.5}"',
    cppHint: '必须用 QMetaObject::invokeMethod(..., Qt::QueuedConnection) 跨线程刷新 UI。',
  },
  topic_flow: {
    id: 'topic_flow',
    label: 'Topic 异步数据流（/scan · /cmd_vel · /wheel_telemetry）',
    category: '通信原语 · 多对多发布订阅',
    summary:
      '单向、持续、解耦的数据管道。发送方只管 publish，不关心谁在订阅；底层依托 DDS SPDP/SEDP 自动完成端到端发现与 RxO QoS 匹配。',
    cliCommand: 'ros2 topic info -v /cmd_vel',
    cppHint: '高频连续状态流一律选 Topic；禁止在回调中阻塞睡眠。',
  },
  srv_action_flow: {
    id: 'srv_action_flow',
    label: 'Service / Action 控制事务（/set_max_speed · /dock_to_charger）',
    category: '通信原语 · 短事务与长任务',
    summary:
      '瞬时配置或状态查询走 Service（Request/Response）；耗时数秒到数分钟且需要反馈进度与中途取消（Cancel）的长任务（如自动回充）必须走 Action。',
    cliCommand: 'ros2 action send_goal /dock_to_charger chassis_interfaces/action/DockToCharger "{charger_id: 1}" --feedback',
    cppHint: 'Action 服务端在 handle_accepted 中必须派生线程或状态机，绝不能卡死 Executor。',
  },
};

const WORKSPACE_LAYERS = [
  {
    id: 'src',
    title: 'src/（唯一手写源码目录）',
    desc: '按功能包划分（chassis_interfaces、chassis_core 等），每个包必须含 package.xml（给 rosdep/colcon 看依赖）和 CMakeLists.txt（给编译器/链接器看规则）。',
    cmd: 'ros2 pkg create --build-type ament_cmake my_pkg --dependencies rclcpp',
  },
  {
    id: 'build',
    title: 'build/（CMake 中间构建产物）',
    desc: '存放每个功能包独立的 CMake 缓存、目标文件 .o 与 clangd 依赖的 compile_commands.json。删掉它可彻底清理重编，不纳入 Git。',
    cmd: 'colcon build --cmake-args -DCMAKE_EXPORT_COMPILE_COMMANDS=ON',
  },
  {
    id: 'install',
    title: 'install/（交付运行目录 & setup.bash）',
    desc: '存放编译出的可执行程序、动态库 .so、Launch/YAML 资源以及 Overlay 激活脚本 setup.bash。实机部署时仅需打包此目录。',
    cmd: 'source install/setup.bash  # 叠加覆盖 /opt/ros/${ROS_DISTRO}',
  },
  {
    id: 'underlay',
    title: 'Underlay（/opt/ros/${ROS_DISTRO} 底层基底）',
    desc: '系统通过 apt 安装的官方 ROS 2 发行版（Humble / Jazzy / Lyrical）。环境变量 AMENT_PREFIX_PATH 会先检索 Overlay 再回退 Underlay。',
    cmd: 'echo $AMENT_PREFIX_PATH  # 验证 Overlay 是否生效',
  },
];

const EVOLUTION_ROWS = [
  {
    dim: '服务发现机制',
    ros1: '中心化 roscore（单点故障，Master 挂掉全网失联）',
    ros2: '去中心化 DDS（SPDP 组播 + SEDP 端点交换，无中心节点）',
  },
  {
    dim: '实时性与确定性',
    ros1: '依赖 TCPROS/UDPROS，缺乏原生 QoS 与无锁零拷贝规范',
    ros2: '支持 Reliable/BestEffort QoS、同进程 unique_ptr 零拷贝与 PREEMPT_RT 友好接口',
  },
  {
    dim: '节点生命周期',
    ros1: '节点启动即自由运行，多传感器协同初始化竞态难控',
    ros2: '内置 LifecycleNode（Unconfigured → Inactive → Active → Finalized）',
  },
  {
    dim: '构建与多平台',
    ros1: 'catkin_make（强绑定 Ubuntu Linux，Python 2/3 混杂）',
    ros2: 'ament_cmake + colcon（原生支持 Ubuntu、WSL 2、Windows、RTOS，C++17/20）',
  },
  {
    dim: '进程内组合',
    ros1: 'nodelet（宏与 XML 写法繁琐，接口不统一）',
    ros2: 'rclcpp_components（普通继承 Node 类加一行宏即可装载进同一容器）',
  },
];

export const Ros2OverviewGraphSim: React.FC = () => {
  const [activeTab, setActiveTab] = useState<OverviewTab>('graph');
  const [selectedGraphId, setSelectedGraphId] = useState<string>('chassis');
  const [selectedWsId, setSelectedWsId] = useState<string>('src');

  const activeGraph = GRAPH_ELEMENTS[selectedGraphId] ?? GRAPH_ELEMENTS.chassis;
  const activeWs = WORKSPACE_LAYERS.find((w) => w.id === selectedWsId) ?? WORKSPACE_LAYERS[0];

  return (
    <div
      data-testid="sim-overview"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      {/* Header + Tabs */}
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            全景图解 1：ROS 2 核心框架概览、计算图与工作空间流向
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            切换视图直观掌握 ROS 2 节点通信拓扑、Underlay/Overlay 目录流向与 ROS 1 演进差异
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-200/70 dark:bg-slate-800 no-print">
          <button
            type="button"
            onClick={() => setActiveTab('graph')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'graph'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Network className="w-3.5 h-3.5" aria-hidden="true" />
            <span>计算图通信全景</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('workspace')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'workspace'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <FolderTree className="w-3.5 h-3.5" aria-hidden="true" />
            <span>工作空间与构建流向</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('evolution')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeTab === 'evolution'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" aria-hidden="true" />
            <span>ROS 1 vs ROS 2 演进</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Computation Graph Overview */}
      {activeTab === 'graph' && (
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
            <svg
              viewBox="0 0 560 310"
              className="w-full h-auto"
              role="img"
              aria-label="ROS 2 分布式计算图全景"
            >
              <defs>
                <marker id="ov-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M1,1 L7,4 L1,7 Z" fill="#0284c7" />
                </marker>
                <marker id="ov-arrow-amber" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M1,1 L7,4 L1,7 Z" fill="#d97706" />
                </marker>
              </defs>

              {/* Background DDS Bus Banner */}
              <rect
                x="18"
                y="246"
                width="524"
                height="48"
                rx="8"
                fill="rgba(5, 150, 105, 0.08)"
                stroke="#059669"
                strokeWidth="1.2"
                strokeDasharray="4 3"
              />
              <text x="280" y="267" textAnchor="middle" fontSize="11.5" fontWeight="600" fill="#059669">
                去中心化 DDS 软总线（SPDP 自动发现 + SEDP 点对点通信 + /tf & /rosout）
              </text>
              <text
                x="280"
                y="284"
                textAnchor="middle"
                fontSize="10"
                fontFamily="JetBrains Mono, monospace"
                fill="currentColor"
                className="text-slate-500 dark:text-slate-400"
              >
                FastDDS / CycloneDDS / Zenoh · 无需中心 roscore
              </text>

              {/* Edges: Topic /scan */}
              <g
                onClick={() => setSelectedGraphId('topic_flow')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Topic 异步数据流"
              >
                <line
                  x1="158"
                  y1="62"
                  x2="245"
                  y2="62"
                  stroke="#0284c7"
                  strokeWidth={selectedGraphId === 'topic_flow' ? '2.5' : '1.6'}
                  markerEnd="url(#ov-arrow)"
                />
                <text x="202" y="52" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#0284c7">
                  /scan
                </text>

                <line
                  x1="316"
                  y1="92"
                  x2="316"
                  y2="146"
                  stroke="#0284c7"
                  strokeWidth={selectedGraphId === 'topic_flow' ? '2.5' : '1.6'}
                  markerEnd="url(#ov-arrow)"
                />
                <text x="354" y="122" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="#0284c7">
                  /cmd_vel
                </text>
              </g>

              {/* Edges: Service / Action */}
              <g
                onClick={() => setSelectedGraphId('srv_action_flow')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Service 与 Action 控制事务"
              >
                <line
                  x1="158"
                  y1="176"
                  x2="232"
                  y2="176"
                  stroke="#d97706"
                  strokeWidth={selectedGraphId === 'srv_action_flow' ? '2.5' : '1.6'}
                  strokeDasharray="4 2"
                  markerEnd="url(#ov-arrow-amber)"
                />
                <text x="195" y="166" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#d97706">
                  Service 限速
                </text>

                <line
                  x1="406"
                  y1="62"
                  x2="452"
                  y2="148"
                  stroke="#d97706"
                  strokeWidth={selectedGraphId === 'srv_action_flow' ? '2.5' : '1.6'}
                  strokeDasharray="4 2"
                  markerEnd="url(#ov-arrow-amber)"
                />
                <text x="458" y="102" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="#d97706">
                  Action 回充
                </text>
              </g>

              {/* Node: Lidar */}
              <g
                onClick={() => setSelectedGraphId('lidar')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="激光雷达驱动节点"
              >
                <rect
                  x="22"
                  y="32"
                  width="136"
                  height="58"
                  rx="8"
                  fill={selectedGraphId === 'lidar' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                  stroke={selectedGraphId === 'lidar' ? '#0284c7' : '#94a3b8'}
                  strokeWidth={selectedGraphId === 'lidar' ? '2' : '1.2'}
                />
                <text x="90" y="55" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  /lidar_driver
                </text>
                <text x="90" y="74" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  SensorDataQoS
                </text>
              </g>

              {/* Node: Nav2 */}
              <g
                onClick={() => setSelectedGraphId('nav2')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Nav2 导航规划节点"
              >
                <rect
                  x="248"
                  y="32"
                  width="158"
                  height="58"
                  rx="8"
                  fill={selectedGraphId === 'nav2' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                  stroke={selectedGraphId === 'nav2' ? '#0284c7' : '#94a3b8'}
                  strokeWidth={selectedGraphId === 'nav2' ? '2' : '1.2'}
                />
                <text x="327" y="55" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  /nav2_controller
                </text>
                <text x="327" y="74" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  TF2 + BT 导航栈
                </text>
              </g>

              {/* Node: Qt HMI */}
              <g
                onClick={() => setSelectedGraphId('hmi')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="Qt 上位机节点"
              >
                <rect
                  x="22"
                  y="148"
                  width="136"
                  height="58"
                  rx="8"
                  fill={selectedGraphId === 'hmi' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                  stroke={selectedGraphId === 'hmi' ? '#0284c7' : '#94a3b8'}
                  strokeWidth={selectedGraphId === 'hmi' ? '2' : '1.2'}
                />
                <text x="90" y="171" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  /robot_hmi_qt
                </text>
                <text x="90" y="190" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  双线程上位机
                </text>
              </g>

              {/* Node: Chassis Manager */}
              <g
                onClick={() => setSelectedGraphId('chassis')}
                className="cursor-pointer"
                role="button"
                tabIndex={0}
                aria-label="底盘主控节点"
              >
                <rect
                  x="234"
                  y="148"
                  width="298"
                  height="58"
                  rx="8"
                  fill={selectedGraphId === 'chassis' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                  stroke={selectedGraphId === 'chassis' ? '#0284c7' : '#94a3b8'}
                  strokeWidth={selectedGraphId === 'chassis' ? '2' : '1.2'}
                />
                <text x="383" y="171" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  /chassis_manager_node（核心节点）
                </text>
                <text x="383" y="190" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  Topic + Service + Action + Parameter
                </text>
              </g>

              {/* Vertical links down to DDS Bus */}
              <line x1="90" y1="206" x2="90" y2="246" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
              <line x1="383" y1="206" x2="383" y2="246" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
            </svg>

            <div className="mt-3 flex flex-wrap gap-1.5 no-print">
              {Object.values(GRAPH_ELEMENTS).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedGraphId(item.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedGraphId === item.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {item.label.split('（')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div>
                <div className="text-xs font-mono text-sky-700 dark:text-sky-400">{activeGraph.category}</div>
                <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">{activeGraph.label}</h5>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{activeGraph.summary}</p>
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">CLI 查看 / 调试命令</div>
                <code className="text-xs font-mono text-sky-700 dark:text-sky-300 break-all">{activeGraph.cliCommand}</code>
              </div>
              <div className="p-3 rounded-lg bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-900/60">
                <div className="text-xs font-semibold text-sky-800 dark:text-sky-300 mb-1">C++ 工程原则</div>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{activeGraph.cppHint}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Workspace & Overlay Pipeline */}
      {activeTab === 'workspace' && (
        <div className="grid grid-cols-1 lg:grid-cols-12">
          <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
            <svg viewBox="0 0 560 250" className="w-full h-auto" role="img" aria-label="ROS 2 工作空间构建与 Overlay 链路">
              <defs>
                <marker id="ws-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                  <path d="M1,1 L7,4 L1,7 Z" fill="#0284c7" />
                </marker>
              </defs>

              {/* Underlay base box */}
              <g onClick={() => setSelectedWsId('underlay')} className="cursor-pointer" role="button" tabIndex={0}>
                <rect
                  x="20"
                  y="175"
                  width="520"
                  height="52"
                  rx="8"
                  fill={selectedWsId === 'underlay' ? 'rgba(5, 150, 105, 0.12)' : 'rgba(5, 150, 105, 0.05)'}
                  stroke={selectedWsId === 'underlay' ? '#059669' : '#94a3b8'}
                  strokeWidth={selectedWsId === 'underlay' ? '2' : '1.2'}
                />
                <text x="280" y="198" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  Underlay 底层系统：/opt/ros/${'{ROS_DISTRO}'}/setup.bash
                </text>
                <text x="280" y="216" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  官方预编译包 (rclcpp, tf2, nav2, gazebo_ros) · 只读基底
                </text>
              </g>

              {/* src -> build -> install */}
              <g onClick={() => setSelectedWsId('src')} className="cursor-pointer" role="button" tabIndex={0}>
                <rect
                  x="20"
                  y="28"
                  width="150"
                  height="96"
                  rx="8"
                  fill={selectedWsId === 'src' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                  stroke={selectedWsId === 'src' ? '#0284c7' : '#94a3b8'}
                  strokeWidth={selectedWsId === 'src' ? '2' : '1.2'}
                />
                <text x="95" y="54" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  1. src/
                </text>
                <text x="95" y="75" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  C++17 源码 · Launch
                </text>
                <text x="95" y="93" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  package.xml
                </text>
                <text x="95" y="110" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  CMakeLists.txt
                </text>
              </g>

              <line x1="170" y1="76" x2="202" y2="76" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#ws-arrow)" />

              <g onClick={() => setSelectedWsId('build')} className="cursor-pointer" role="button" tabIndex={0}>
                <rect
                  x="204"
                  y="28"
                  width="150"
                  height="96"
                  rx="8"
                  fill={selectedWsId === 'build' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                  stroke={selectedWsId === 'build' ? '#0284c7' : '#94a3b8'}
                  strokeWidth={selectedWsId === 'build' ? '2' : '1.2'}
                />
                <text x="279" y="54" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  2. build/
                </text>
                <text x="279" y="75" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  colcon 并行调度
                </text>
                <text x="279" y="93" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  compile_commands
                </text>
                <text x="279" y="110" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  供 clangd 索引跳转
                </text>
              </g>

              <line x1="354" y1="76" x2="386" y2="76" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#ws-arrow)" />

              <g onClick={() => setSelectedWsId('install')} className="cursor-pointer" role="button" tabIndex={0}>
                <rect
                  x="388"
                  y="28"
                  width="152"
                  height="96"
                  rx="8"
                  fill={selectedWsId === 'install' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                  stroke={selectedWsId === 'install' ? '#0284c7' : '#94a3b8'}
                  strokeWidth={selectedWsId === 'install' ? '2' : '1.2'}
                />
                <text x="464" y="54" textAnchor="middle" fontSize="12.5" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                  3. install/
                </text>
                <text x="464" y="75" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  Overlay 业务覆盖层
                </text>
                <text x="464" y="93" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  setup.bash
                </text>
                <text x="464" y="110" textAnchor="middle" fontSize="10" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                  可独立打包上车交付
                </text>
              </g>

              <line x1="464" y1="175" x2="464" y2="128" stroke="#059669" strokeWidth="1.6" strokeDasharray="4 2" markerEnd="url(#ws-arrow)" />
              <text x="380" y="156" fontSize="10" fill="#059669">
                Overlay 优先覆盖 Underlay 同名包
              </text>
            </svg>

            <div className="mt-3 flex flex-wrap gap-1.5 no-print">
              {WORKSPACE_LAYERS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWsId(w.id)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedWsId === w.id
                      ? 'bg-sky-600 text-white'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {w.title.split('（')[0]}
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
                <Layers className="w-4 h-4" aria-hidden="true" />
                <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{activeWs.title}</h5>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{activeWs.desc}</p>
              <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">常用构建与检查指令</div>
                <code className="text-xs font-mono text-sky-700 dark:text-sky-300 break-all">{activeWs.cmd}</code>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: ROS 1 vs ROS 2 Evolution */}
      {activeTab === 'evolution' && (
        <div className="p-5">
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800">
                  <th className="px-4 py-2.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">架构维度</th>
                  <th className="px-4 py-2.5 font-semibold text-slate-600 dark:text-slate-400">ROS 1 (已停止维护 EOL)</th>
                  <th className="px-4 py-2.5 font-semibold text-sky-700 dark:text-sky-300">ROS 2 (Humble / Jazzy / Lyrical Luth)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {EVOLUTION_ROWS.map((row) => (
                  <tr key={row.dim} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">{row.dim}</td>
                    <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{row.ros1}</td>
                    <td className="px-4 py-2.5 text-slate-800 dark:text-slate-200">{row.ros2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
