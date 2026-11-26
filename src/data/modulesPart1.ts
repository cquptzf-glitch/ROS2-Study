import { HandbookModule } from '../types/handbook';

export const MODULES_PART_1: HandbookModule[] = [
  {
    id: 'module-1',
    number: '01',
    title: '模块一：ROS 2 核心基础概念、安装部署与 C++ 工程环境',
    shortTitle: '核心概念与安装部署',
    subtitle: '零基础系统掌握 ROS 2 计算图、工作空间 Overlay 机制，从零完成 Ubuntu / WSL 2 安装、串口透传与 VS Code clangd 工程化部署。',
    versionScope: 'Humble (22.04) · Jazzy (24.04) · Lyrical Luth (26.04 LTS, 维护至 2031)',
    sections: [
      {
        id: 'm1-core-concepts',
        title: '1.1 ROS 2 基础概览、五大子系统框架与核心通信原语',
        paragraphs: [
          '对于习惯传统 C++17 单机开发的工程师，机器人软件最初往往是一个“单体进程”：主程序里用 `std::thread` 拆出雷达采集、SLAM 建图、路径规划和电机控制线程，靠共享内存队列（`std::queue + std::mutex`）传结构体指针。但这种模式一旦某个视觉或激光算法空指针崩溃（`SIGSEGV`），整个底盘控制进程会瞬间宕机。',
          'ROS 2 本质上是一套**分布式机器人计算图（Computation Graph）与全栈软件框架**：它将每个功能模块拆解为独立可部署的 Node（节点）。从宏观框架看，ROS 2 生态由五大核心子系统构成：1）**通信与客户端内核**（`rclcpp`/`rcl`/`RMW`/DDS/Zenoh，实现去中心化 SPDP/SEDP 发现与 QoS 传输）；2）**构建与接口体系**（`ament_cmake`/`colcon`/`rosdep`/`rosidl` 跨语言代码生成）；3）**空间建模与硬件控制**（`TF2` 时空变换、`URDF/Xacro`、`ros2_control`）；4）**行业标准算法栈**（`slam_toolbox`、`Nav2`、`MoveIt 2`）；5）**仿真与诊断工具链**（`Modern Gazebo`、`RViz2`、`rqt_graph`、`MCAP`/`PlotJuggler`）。',
          '一个运行中的 ROS 2 计算图由五大通信与配置原语协同运转：Node（算力封装单元）、Topic（异步单向数据流）、Service（短耗时请求-响应事务）、Action（长耗时、可中途取消并回传进度的任务模型）以及 Parameter（节点内强类型运行时动态参数）。点击下方全景交互图探索计算图节点、工作空间流向及 ROS 1 vs ROS 2 演进。',
        ],
        simulatorId: 'sim7',
        table: {
          caption: '现代 C++17 单机机制 vs ROS 2 分布式原语核心映射',
          headers: ['传统 C++17 单机概念', 'ROS 2 分布式等价物', '核心定位与底层机制'],
          rows: [
            ['std::thread 工作单元', 'rclcpp::Node / ComposableNode', '既可作为独立进程实现崩溃隔离，也可编译为 .so 装载进同一容器进程'],
            ['std::queue + std::mutex', 'Topic (Publisher / Subscription)', '基于 DDS 发布订阅，支持 QoS 策略控制丢包重传与同机共享内存（SHM）'],
            ['函数调用 / 阻塞 RPC', 'Service (Client / Server)', '短事务请求-响应（开关雷达、查状态），底层由 Request/Response 两个隐式 Topic 组成'],
            ['后台异步任务 + 回调通知', 'Action (Goal / Feedback / Result)', '面向导航/回充等长耗时动作，支持 Cancel 抢占与进度实时回传'],
            ['全局 Config 结构体', 'Node Parameter + YAML', '节点私有强类型参数，支持 `add_on_set_parameters_callback` 在线热更新校验'],
            ['Eigen 刚体位姿矩阵手算', 'TF2 (Buffer / Broadcaster / Listener)', '维护带时间戳滑动窗口缓存的坐标系有向无环树（DAG），自动插值历史时刻变换'],
          ],
        },
        callouts: [
          {
            label: '版本号怎么选？（Humble / Jazzy / Lyrical Luth）',
            text: 'Ubuntu 22.04 对应 Humble Hawksbill（维护至 2027.05，存量量产项目最多）；Ubuntu 24.04 对应 Jazzy Jalisco（维护至 2029.05，新项目与 Modern Gazebo Harmonic 首选）；Ubuntu 26.04 对应最新 LTS Lyrical Luth（维护至 2031，默认原生增强 C++20 与 `rmw_zenoh_cpp` 跨网段路由）。',
            tone: 'info',
          },
        ],
      },
      {
        id: 'm1-workspace-overlay',
        title: '1.2 工作空间原理：Underlay / Overlay、colcon 与 package.xml',
        paragraphs: [
          '初学 ROS 2 最容易困惑的是“为什么每次开新终端都要 source，编译完还要再 source 一次？”。这源于 ROS 2 的工作空间层叠（Underlay / Overlay）架构：系统预装的 ROS 2 根目录（如 /opt/ros/jazzy/）称为 **Underlay（底层基底）**，而你自己新建的业务工作空间（如 ~/ros2_ws/）称为 **Overlay（上层覆盖层）**。当你编译完 ~/ros2_ws 并执行 source install/setup.bash 后，环境变量 AMENT_PREFIX_PATH 会优先检索你编译的包，实现“只改一个包、无需重编整个系统”的增量覆盖。',
          '一个标准工作空间 ~/ros2_ws 下有四个核心目录：1) src/（唯一手写并纳入 Git 管理的源码目录，内部按功能包 Package 划分）；2) build/（CMake 中间构建产物与 compile_commands.json）；3) install/（编译安装后的可执行文件、动态库 .so、头文件和 setup.bash 入口，实机部署只拷贝此目录）；4) log/（colcon 编译日志与单元测试输出）。',
          '在每个 C++ 功能包根目录下，有两个缺一不可的描述文件：package.xml 与 CMakeLists.txt。很多 C++ 新手只改 CMakeLists.txt 却忘了改 package.xml——记住一条铁律：package.xml 面向包管理器与编译调度器（rosdep 据此自动安装 apt 依赖，colcon 据此拓扑排序编译先后顺序），而 CMakeLists.txt 面向编译器与链接器（find_package 与 target_link_libraries）。',
        ],
        table: {
          caption: 'ROS 2 功能包核心工具链分工总览',
          headers: ['工具 / 文件', '职责定位', 'C++ 开发者必知要点'],
          rows: [
            ['rosdep', '跨平台依赖自动解析器', '读取所有功能包的 package.xml，一键调用 apt 安装缺失的第三方库与 ROS 依赖'],
            ['colcon', '多包并行构建调度器', '按 package.xml 拓扑排序并依次调用每个包的 CMake，支持 --symlink-install'],
            ['package.xml (Format 3)', '功能包清单与依赖声明', '<buildtool_depend>、<depend>、<exec_depend> 决定 rosdep 与 colcon 构建顺序'],
            ['CMakeLists.txt (ament_cmake)', 'C++17 编译链接规则', '用 find_package + target_link_libraries 链接 rclcpp::rclcpp 并 install 到 lib/${PROJECT_NAME}'],
          ],
        },
        callouts: [
          {
            label: '什么场景必须加 --symlink-install？',
            text: '执行 colcon build --symlink-install 时，install/ 目录下的 Python Launch 启动脚本、YAML 参数文件与 URDF 模型会以软链接指向 src/ 原文件。调试期间修改 YAML 阈值或 Launch 拓扑后无需重新 colcon build 即可直接生效（仅修改 C++ 源码仍需重新编译）。',
            tone: 'tip',
          },
        ],
      },
      {
        id: 'm1-install-deploy',
        title: '1.3 安装部署完整教程：Ubuntu 原生安装、WSL 2 透传与工作空间初始化',
        paragraphs: [
          '在 Ubuntu 22.04（Humble）、24.04（Jazzy）或 26.04（Lyrical Luth）原生环境中，安装 ROS 2 的标准流程分为四步：校验 UTF-8 语言环境 → 配置官方 APT 密钥与软件源 → 安装 Desktop（含 RViz2/GUI）或 Base（无界面工控机部署用）版本 → 初始化 rosdep 与配置自动 source。',
          '如果研发主力机是 Windows 11，推荐使用 WSL 2（Ubuntu 24.04 + ROS 2 Jazzy）：WSL 2 默认的 NAT 网卡会阻断跨机器的 DDS UDP 组播发现，必须在 Windows 用户目录配置 networkingMode=mirrored 镜像网络；激光雷达或 USB-CAN 适配器则通过微软官方 usbipd-win 工具透传进 Linux 内核；同时需用 glxinfo -B 验证 WSLg OpenGL D3D12 GPU 硬件加速是否生效，避免 Gazebo 黑屏卡顿。',
        ],
        codeBlocks: [
          {
            title: 'Ubuntu 原生环境：ROS 2 官方安装、rosdep 初始化与环境冒烟测试（支持 Humble/Jazzy/Lyrical）',
            filename: 'install_ros2_ubuntu.sh',
            language: 'bash',
            code: `#!/usr/bin/env bash
set -euo pipefail

# 1. 确保系统 Locale 为 UTF-8（ROS 2 编译与 CLI 工具硬性要求）
sudo apt-get update && sudo apt-get install -y locales curl software-properties-common
sudo locale-gen en_US en_US.UTF-8
sudo update-locale LC_ALL=en_US.UTF-8 LANG=en_US.UTF-8
export LANG=en_US.UTF-8

# 2. 启用 Universe 源并安装官方 ros2-apt-source（自动适配 22.04/24.04/26.04）
sudo add-apt-repository -y universe
ROS_APT_VER=$(curl -s https://api.github.com/repos/ros-infrastructure/ros-apt-source/releases/latest | grep -F "tag_name" | awk -F\\" '{print $4}')
curl -L -o /tmp/ros2-apt-source.deb \\
  "https://github.com/ros-infrastructure/ros-apt-source/releases/download/\${ROS_APT_VER}/ros2-apt-source_\${ROS_APT_VER}.\$(. /etc/os-release && echo \$VERSION_CODENAME)_all.deb"
sudo dpkg -i /tmp/ros2-apt-source.deb
sudo apt-get update && sudo apt-get upgrade -y

# 3. 按系统版本自动选择 LTS 发行版（22.04->humble, 24.04->jazzy, 26.04->lyrical）
CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
case "$CODENAME" in
  jammy)   DISTRO="humble" ;;
  noble)   DISTRO="jazzy" ;;
  resolute) DISTRO="lyrical" ;;
  *)       echo "Unsupported Ubuntu codename: $CODENAME"; exit 1 ;;
esac

# 开发机安装 desktop（含 RViz2/示例），实机工控机无显示器可改为 ros-\${DISTRO}-ros-base
sudo apt-get install -y ros-\${DISTRO}-desktop ros-dev-tools python3-colcon-common-extensions python3-rosdep

# 4. 初始化 rosdep 并配置环境变量（固定 ROS_DOMAIN_ID 避免同局域网多机串台）
sudo rosdep init || true
rosdep update
grep -q "/opt/ros/\${DISTRO}/setup.bash" ~/.bashrc || cat <<EOF >> ~/.bashrc
source /opt/ros/\${DISTRO}/setup.bash
export ROS_DOMAIN_ID=42
export RMW_IMPLEMENTATION=rmw_fastrtps_cpp
EOF

# 5. 冒烟验证：运行经典小海龟节点检查通信与 GUI
source /opt/ros/\${DISTRO}/setup.bash
ros2 doctor --report | head -n 20
# 另开两个终端分别执行：
#   ros2 run turtlesim turtlesim_node
#   ros2 run turtlesim turtle_teleop_key`,
          },
          {
            title: 'Windows 11 + WSL 2 专项：镜像网络配置（解决多机 DDS 发现隔离）',
            filename: 'C:\\Users\\<YourName>\\.wslconfig',
            language: 'ini',
            code: `[wsl2]
memory=16GB
processors=8
swap=4GB
localhostForwarding=true
nestedVirtualization=true

[experimental]
networkingMode=mirrored
dnsTunneling=true
autoProxy=true
hostAddressLoopback=true`,
          },
          {
            title: 'WSL 2 硬件加速校验、串口透传与本仓库 ros2_ws 一键编译部署',
            filename: 'setup_wsl2_and_workspace.sh',
            language: 'bash',
            code: `# 1. 验证 WSLg OpenGL 硬件加速（应输出 D3D12 或真实 GPU，而非 llvmpipe）
sudo apt-get install -y mesa-utils
glxinfo -B | grep -E "OpenGL renderer|Accelerated"
export GZ_SIM_RENDER_ENGINE_GUI=ogre2

# 2. Windows 管理员 PowerShell 透传 USB 激光雷达/CAN 卡至 WSL 2：
#    winget install dorssel.usbipd-win
#    usbipd list
#    usbipd bind --busid 1-4 && usbipd attach --wsl --busid 1-4
sudo usermod -aG dialout "$USER"

# 3. 编译本指南配套的独立工程源码工作空间（ros2_ws/）
cd ros2_ws
rosdep install --from-paths src --ignore-src -r -y
colcon build --symlink-install --cmake-args -DCMAKE_BUILD_TYPE=RelWithDebInfo -DCMAKE_EXPORT_COMPILE_COMMANDS=ON
source install/setup.bash`,
            sourcePath: 'ros2_ws/README.md',
          },
        ],
      },
      {
        id: 'm1-ide-clangd',
        title: '1.4 Windows VS Code 连接 WSL 2 开发配置、clangd 与诊断速查',
        paragraphs: [
          '在 Windows 下使用 VS Code 开发 WSL 2 中的 ROS 2 C++ 工程，核心是遵循 **Remote-WSL 客户端-服务端架构**：Windows 侧只安装 VS Code 主程序与官方扩展 `WSL (ms-vscode-remote.remote-wsl)`，**绝对不要**在 Windows 资源管理器直接打开 `\\\\wsl$\\...` 目录或用 Windows 本地编译器解析头文件。正确做法是在 WSL 2 Ubuntu 终端进入工作空间后输入 `code .`，VS Code 会自动在 Linux 子系统内拉起服务端，此时窗口左下角会显示 **`WSL: Ubuntu-24.04`**。',
          '解决 `rclcpp/rclcpp.hpp` 找不到与模板报错飘红的标准工程流分为四步：1）在 WSL 2 内安装系统级语言服务器 `sudo apt install -y clangd`；2）在已连接 WSL 的扩展栏安装 **clangd (`llvm-vs-code-extensions.vscode-clangd`)**、CMake 与 C/C++（仅用于 GDB 调试），并在 `.vscode/settings.json` 中设置 `"C_Cpp.intelliSenseEngine": "disabled"` 禁用微软双引擎冲突；3）配置 `~/.colcon/defaults.yaml` 全局导出 `build/compile_commands.json`；4）在 `.vscode/tasks.json` 与 `.vscode/launch.json` 中配置自动 `source setup.bash` 的一键编译（`Ctrl+Shift+B`）与 F5 GDB 断点调试。',
          '点击下方交互架构图检查 Windows 与 WSL 2 各层连接关系，完整 `.vscode/` 配置文件已随本仓库 `ros2_ws/.vscode/` 一并交付。',
        ],
        simulatorId: 'sim8',
        codeBlocks: [
          {
            title: '步骤 1：WSL 2 终端初始化 Remote-WSL、全局 colcon 默认参数与 settings.json',
            filename: 'setup_vscode_wsl2.sh & .vscode/settings.json',
            language: 'json',
            code: `// 1. 在 WSL 2 终端安装 clangd 并在工作空间拉起远程 VS Code：
//    sudo apt-get install -y clangd gdb
//    cd ~/ros2_ws && code .
//    (确认 VS Code 左下角显示 "WSL: Ubuntu-24.04"，并在 "WSL: UBUNTU-24.04 - 已安装" 下启用 clangd 扩展)

// 2. ros2_ws/.vscode/settings.json（禁用微软 IntelliSense，直连 clangd + compile_commands.json）
{
  "C_Cpp.intelliSenseEngine": "disabled",
  "clangd.path": "/usr/bin/clangd",
  "clangd.arguments": [
    "--compile-commands-dir=\${workspaceFolder}/build",
    "--background-index",
    "--header-insertion=never"
  ],
  "files.associations": { "*.xacro": "xml", "*.urdf": "xml" }
}`,
            sourcePath: 'ros2_ws/.vscode/settings.json',
          },
          {
            title: '步骤 2：VS Code tasks.json 一键 colcon 编译与 launch.json F5 GDB 调试',
            filename: '.vscode/tasks.json & .vscode/launch.json',
            language: 'json',
            code: `// ros2_ws/.vscode/tasks.json 关键片段（按 Ctrl+Shift+B 自动加载环境并编译）：
// "command": "source /opt/ros/\${env:ROS_DISTRO:-jazzy}/setup.bash && colcon build --symlink-install --cmake-args -DCMAKE_BUILD_TYPE=Debug -DCMAKE_EXPORT_COMPILE_COMMANDS=ON"

// ros2_ws/.vscode/launch.json（按 F5 直接在 C++ 回调函数打断点调试）：
{
  "name": "Debug C++ Node: chassis_manager_node (GDB)",
  "type": "cppdbg",
  "request": "launch",
  "program": "\${workspaceFolder}/install/chassis_core/lib/chassis_core/chassis_manager_node",
  "environment": [
    { "name": "ROS_DOMAIN_ID", "value": "42" },
    { "name": "AMENT_PREFIX_PATH", "value": "\${workspaceFolder}/install/chassis_core:\${workspaceFolder}/install/chassis_interfaces:/opt/ros/jazzy" }
  ],
  "MIMode": "gdb",
  "preLaunchTask": "ROS 2: colcon build (Debug for GDB)"
}`,
            sourcePath: 'ros2_ws/.vscode/launch.json',
          },
          {
            title: 'ROS 2 日常开发、计算图拓扑与排错必背 CLI 命令速查',
            filename: 'ros2_cli_cheatsheet.sh',
            language: 'bash',
            code: `ros2 node list                            # 查看当前活跃节点
ros2 node info /chassis_manager_node      # 查看节点订阅/发布/服务/动作列表
ros2 topic list -t                        # 列出话题及其消息类型
ros2 topic info -v /wheel_telemetry       # 排查 QoS 不匹配必看（显示两端 Reliability/Durability）
ros2 interface show chassis_interfaces/msg/WheelTelemetry  # 查看消息结构体字段定义
ros2 run rqt_graph rqt_graph              # 图形化实时查看节点与话题拓扑连接
ros2 run tf2_tools view_frames            # 生成完整 TF2 树 PDF 检查断链与发布周期
ros2 component list                       # 查看容器进程内已加载的零拷贝组件节点
ros2 bag record -s mcap -o run_01 /scan /odom /tf /tf_static
ros2 doctor --report                      # 全系统网络、RMW 与环境健康检查`,
          },
        ],
      },
    ],
  },
  {
    id: 'module-2',
    number: '02',
    title: '模块二：ament_cmake 现代构建体系与四大通信机制精讲',
    shortTitle: 'ament_cmake 与四大通信',
    subtitle: '掌握 RMW 动态抽象架构、现代 CMake 目标传递链接规范，以及 Topic / Service / Action / Parameter 的设计原理与核心 C++ 实现。',
    versionScope: '现代 CMake Target-based 链接 · rclcpp::Node OOP 范式',
    sections: [
      {
        id: 'm2-arch-sim',
        title: '2.1 ROS 2 分层架构与动态库链接机制',
        paragraphs: [
          '理解 ROS 2 为什么能在不修改一行 C++ 业务代码的情况下切换底层通信引擎（FastDDS、CycloneDDS 或 2026 Lyrical Luth 增强的 Zenoh），关键在于它的五层解耦设计：用户节点只直接链接 C++ 客户端库 rclcpp；rclcpp 内部封装纯 C 语言编写的状态与时序核心 rcl（保证 Python/Rust/C++ 行为严格一致）；rcl 再通过 RMW（ROS Middleware Interface）统一接口层动态加载具体的 DDS 厂商实现库。',
          '点击下方交互式分层架构图中的任意层级，查看对应的动态库（.so）依赖机制与面试高频追问点。',
        ],
        simulatorId: 'sim1',
      },
      {
        id: 'm2-first-cpp-node',
        title: '2.2 平滑入门：从零编写第一个 30 行 C++ ROS 2 节点',
        paragraphs: [
          '在直接编写复杂的自定义消息包与四合一控制器之前，先用最小成本跑通第一个现代 C++17 节点。使用 `ros2 pkg create --build-type ament_cmake my_first_pkg --dependencies rclcpp std_msgs` 即可生成标准骨架。',
          '所有 ROS 2 C++ 节点入口遵循三段式生命线：`rclcpp::init(argc, argv)` 初始化中间件上下文 → `rclcpp::spin(node)` 阻塞式进入事件循环派发定时器与订阅回调 → 收到 `Ctrl+C (SIGINT)` 后由 `rclcpp::shutdown()` 释放 DDS 资源。如果你的主循环需要和外部高频算法（如游戏引擎或自定义传感器轮询）合用，可改用 `rclcpp::Rate` 配合非阻塞的 `rclcpp::spin_some(node)`。',
          '工程编码习惯上：单参数的订阅/定时器回调优先用 `[this](...)` Lambda（简洁无 `std::placeholders::_1` 噪点）；打印日志统一使用 `RCLCPP_INFO` / `RCLCPP_INFO_THROTTLE` / `RCLCPP_INFO_ONCE` 宏，它们自动附带仿真时间戳并同步发布到 `/rosout` 供上位机收集，切忌在 100Hz 高频回调里滥用 `std::cout`。',
          '此外新手极易忽略 **ROS 2 时间与定时器时钟源陷阱**：`this->create_wall_timer()` 永远绑定物理单调时钟（`steady_clock`），即使设置了 `use_sim_time:=true` 也不会随 Gazebo 仿真 `/clock` 或 `rosbag2` 倍速放慢！若算法定时器必须严格跟随仿真时钟，应改用 **`rclcpp::create_timer(this, this->get_clock(), 500ms, cb)`**；同时注意不同 `Clock` 类型（如 `RCL_ROS_TIME` 与 `RCL_STEADY_TIME`）的 `rclcpp::Time` 直接相减会在运行时抛出异常。',
        ],
        table: {
          caption: 'rclcpp 事件循环调度模式、时钟与日志宏速查',
          headers: ['API / 宏', '行为特性', '典型使用场景'],
          rows: [
            ['rclcpp::spin(node)', '阻塞当前线程并持续唤醒内部回调', '绝大多数标准事件驱动节点（定时器 + 订阅回调）'],
            ['rclcpp::spin_some(node) + Rate', '处理当前已就绪队列后立即返回', '与外部固定帧率物理/控制主循环整合'],
            ['create_wall_timer vs create_timer', '前者绑定物理墙钟；后者绑定 node->get_clock()', '仿真控制/回放严格同步 `/clock` 时必须用 `rclcpp::create_timer`'],
            ['RCLCPP_INFO_THROTTLE(..., ms, ...)', '至少间隔指定毫秒才输出一次', '高频传感器回调或异常状态告警，防止刷爆磁盘日志'],
            ['RCLCPP_INFO_ONCE(...)', '节点生命周期内仅打印一次', '记录硬件握手成功或参数加载完成里程碑'],
          ],
        },
        codeBlocks: [
          {
            title: '入门最小闭环：Timer + Publisher + Lambda 订阅 + 限频日志',
            filename: 'minimal_pubsub_node.cpp (核心片段)',
            language: 'cpp',
            code: `class MinimalPubSubNode : public rclcpp::Node {
public:
  MinimalPubSubNode() : Node("minimal_pubsub_node"), count_(0) {
    pub_ = this->create_publisher<std_msgs::msg::String>("heartbeat", 10);
    sub_ = this->create_subscription<std_msgs::msg::String>(
      "heartbeat", 10, [this](const std_msgs::msg::String::ConstSharedPtr msg) {
        RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 2000,
          "Received heartbeat: '%s'", msg->data.c_str());
      });
    timer_ = this->create_wall_timer(500ms, [this]() {
      std_msgs::msg::String msg;
      msg.data = "AMR alive seq #" + std::to_string(++count_);
      pub_->publish(msg);
    });
  }
};
// 启动验证：ros2 run chassis_core minimal_pubsub_node`,
            sourcePath: 'ros2_ws/src/chassis_core/src/minimal_pubsub_node.cpp',
          },
        ],
      },
      {
        id: 'm2-modern-cmake',
        title: '2.3 现代 CMake 链接规范与独立接口包设计原则',
        paragraphs: [
          '在新建自定义接口前，行业铁律是**优先复用 ROS 2 官方标准消息包**（这样才能直接对接 RViz2、Nav2、Foxglove 与 PlotJuggler 生态），只有业务强耦合结构才单独建包。在 Jazzy 及 Lyrical Luth 新版本控制链路中，底层速度控制正逐步从无时间戳的 `geometry_msgs/msg/Twist` 迁移到带 `header` 的 `TwistStamped` 以增强多传感器时序审计能力。',
          '为什么工业级 ROS 2 工程强制把自定义 `.msg` / `.srv` / `.action` 放在独立的功能包（如 `chassis_interfaces`）中，而不是塞在业务算法包里？核心原因有两点：1) 避免环形依赖，多个下游算法包（感知、规划、上位机）可以轻量只依赖接口包而无需拉入重型算法库；2) 在 IDL 编译阶段，`rosidl_default_generators` 会自动生成强类型 C++17 头文件（如 `wheel_telemetry.hpp`，自带 `SharedPtr`/`UniquePtr`/`ConstSharedPtr` 类型别名）。',
          '在编写 `CMakeLists.txt` 时，老旧教程常用的 `ament_target_dependencies()` 宏会把头文件路径以非作用域隔离的方式全局注入目标，破坏下游包的传递性依赖（在 Jazzy 中已警告，Lyrical Luth 推荐全面弃用）。现代 CMake 统一采用 `target_link_libraries(target PUBLIC rclcpp::rclcpp ${pkg_TARGETS})`。',
        ],
        table: {
          caption: '先复用、再定制：ROS 2 常用标准消息包速查表',
          headers: ['标准包 / 消息类型', '核心字段', '典型工程用途'],
          rows: [
            ['geometry_msgs/msg/Twist & TwistStamped', 'linear(x,y,z), angular(x,y,z)', '底盘线速度/角速度指令（Jazzy+ `ros2_control` 默认推荐 `TwistStamped`）'],
            ['nav_msgs/msg/Odometry', 'header, pose(with covariance), twist', '轮式里程计/LIO 位姿与速度融合输出'],
            ['sensor_msgs/msg/LaserScan & PointCloud2', 'ranges[], intensities[] / 字节流点云', '2D 单线雷达与 3D 多线激光雷达/深度相机点云'],
            ['sensor_msgs/msg/Imu & BatteryState', 'orientation, angular_velocity / voltage', '惯性测量单元姿态角速度与电池健康电量遥测'],
            ['diagnostic_msgs/msg/DiagnosticArray', 'status[] (OK/WARN/ERROR, key-value)', '结合 `diagnostic_updater` 上报电机温度、CAN 丢包与节点健康状态'],
          ],
        },
        codeBlocks: [
          {
            title: '现代 CMake Target-based 链接核心片段（对比旧式宏）',
            filename: 'chassis_core/CMakeLists.txt (核心链接片段)',
            language: 'cmake',
            code: `# ❌ 旧式宏（全局污染头文件路径、破坏导出目标传递性，不推荐）
# ament_target_dependencies(chassis_manager_node rclcpp geometry_msgs chassis_interfaces)

# ✅ 现代 CMake Target-based 写法（精确控制 PUBLIC/PRIVATE 依赖边界）
add_executable(chassis_manager_node src/chassis_manager_node.cpp)
target_link_libraries(chassis_manager_node PUBLIC
  rclcpp::rclcpp
  rclcpp_action::rclcpp_action
  \${geometry_msgs_TARGETS}
  \${chassis_interfaces_TARGETS}
)

# ✅ 若接口包同包内 C++ 节点需直接引用本包刚生成的消息头文件：
# rosidl_get_typesupport_target(cpp_ts \${PROJECT_NAME} "rosidl_typesupport_cpp")
# target_link_libraries(internal_node PUBLIC "\${cpp_ts}")`,
            sourcePath: 'ros2_ws/src/chassis_core/CMakeLists.txt',
          },
          {
            title: '自定义接口包 rosidl 代码生成关键指令与 package.xml 声明',
            filename: 'chassis_interfaces/CMakeLists.txt (核心片段)',
            language: 'cmake',
            code: `rosidl_generate_interfaces(\${PROJECT_NAME}
  "msg/WheelTelemetry.msg"
  "srv/SetMaxSpeed.srv"
  "action/DockToCharger.action"
  DEPENDENCIES std_msgs action_msgs
)
ament_export_dependencies(rosidl_default_runtime)
# package.xml 中必须声明：<member_of_group>rosidl_interface_packages</member_of_group>`,
            sourcePath: 'ros2_ws/src/chassis_interfaces/CMakeLists.txt',
          },
        ],
      },
      {
        id: 'm2-comm-sim',
        title: '2.4 四大通信模型原理与 QoS RxO 契约模拟器',
        paragraphs: [
          '设计机器人系统时，选错通信模型是常见架构缺陷：高频连续状态流（激光雷达、轮速里程计）必须用 Topic；瞬时配置开关或状态查询（修改限速、复位 IMU）用 Service；耗时数秒到数分钟且必须支持中途取消（Cancel）与进度反馈（Feedback）的任务（自动回充、导航到点）必须用 Action。',
          '更隐蔽的问题在于 DDS QoS（服务质量契约）遵循 **RxO（Requested vs Offered）原则**：发布方提供的保障等级必须大于等于订阅方请求的等级，否则两者会“静默失配”（Topic 名字类型全对却收不到一条数据）。使用下方模拟器直观对比四种通信拓扑、测试 QoS 兼容性并查看零拷贝内存路径差异。',
        ],
        simulatorId: 'sim2',
      },
      {
        id: 'm2-full-cpp-node',
        title: '2.5 现代 C++17 核心通信关键代码精讲（OOP 节点与防坑规范）',
        paragraphs: [
          '企业级 ROS 2 C++ 节点几乎全部采用**面向对象继承 rclcpp::Node**的写法，配合构造列表初始化与 RAII 成员管理：这样不仅析构顺序确定，还能在构造函数透传 const rclcpp::NodeOptions & options，为后续零修改升级为零拷贝组件（ComposableNode）铺平道路。',
          '以下仅抽取工程中最关键的三段核心代码进行解剖（完整可编译包已存放在 ros2_ws/src/chassis_core/ 目录）：1) 带 QoS 契约的发布订阅与动态参数校验回调；2) Action Server 三回调与 weak_from_this() 异步工作线程；3) 零死锁全异步 Service/Action Client 调用范式。',
        ],
        codeBlocks: [
          {
            title: '关键代码 1：继承 rclcpp::Node、自定义 QoS 与参数热更新校验',
            filename: 'chassis_manager_node.cpp (关键片段)',
            language: 'cpp',
            code: `class ChassisManagerNode : public rclcpp::Node {
public:
  explicit ChassisManagerNode(const rclcpp::NodeOptions & options = rclcpp::NodeOptions())
  : Node("chassis_manager_node", options) {
    // 1. 声明参数并注册回调：在回调内校验合法性，绝不可在回调里递归调用 set_parameter()
    this->declare_parameter<double>("max_linear_mps", 1.2);
    param_cb_handle_ = this->add_on_set_parameters_callback(
      [this](const std::vector<rclcpp::Parameter> & params) {
        rcl_interfaces::msg::SetParametersResult res;
        res.successful = true;
        for (const auto & p : params) {
          if (p.get_name() == "max_linear_mps" && (p.as_double() <= 0.0 || p.as_double() > 3.5)) {
            res.successful = false;
            res.reason = "max_linear_mps out of safe bounds (0.0, 3.5]";
          }
        }
        return res;
      });

    // 2. 传感器/遥测用 BestEffort 防队头阻塞，控制指令用 Reliable 确保必达
    telemetry_pub_ = this->create_publisher<WheelTelemetry>(
      "wheel_telemetry", rclcpp::QoS(10).best_effort().durability_volatile());
    cmd_vel_sub_ = this->create_subscription<geometry_msgs::msg::Twist>(
      "cmd_vel", rclcpp::QoS(5).reliable(),
      std::bind(&ChassisManagerNode::on_cmd_vel, this, std::placeholders::_1));
  }`,
            sourcePath: 'ros2_ws/src/chassis_core/src/chassis_manager_node.cpp',
          },
          {
            title: '关键代码 2：Action 服务端三回调与 weak_from_this() 防悬垂线程',
            filename: 'chassis_manager_node.cpp (Action 核心片段)',
            language: 'cpp',
            code: `  void handle_dock_accepted(const std::shared_ptr<GoalHandleDock> goal_handle) {
    // ⚠️ 严禁在 Executor 回调中直接 while 循环跑耗时任务，必须剥离到独立工作线程
    // ⚠️ 捕获 weak_from_this() 而非裸 this，防止节点提前析构触发后台线程悬垂访问
    std::weak_ptr<rclcpp::Node> weak_self = this->weak_from_this();
    std::thread([weak_self, goal_handle]() {
      if (auto base = weak_self.lock()) {
        std::static_pointer_cast<ChassisManagerNode>(base)->execute_docking(goal_handle);
      }
    }).detach();
  }

  void execute_docking(const std::shared_ptr<GoalHandleDock> goal_handle) {
    const auto start_time = this->now();
    rclcpp::Rate rate(10);
    while (rclcpp::ok() && remaining > 0.02F) {
      if ((this->now() - start_time).seconds() > goal_handle->get_goal()->timeout_sec) {
        goal_handle->abort(result);  // 超时中止状态机
        return;
      }
      if (goal_handle->is_canceling()) {
        goal_handle->canceled(result);  // 响应客户端取消请求
        return;
      }
      goal_handle->publish_feedback(feedback);
      rate.sleep();
    }
    goal_handle->succeed(result);
  }`,
            sourcePath: 'ros2_ws/src/chassis_core/src/chassis_manager_node.cpp',
          },
          {
            title: '关键代码 3：全异步 Service 与 Action 客户端调用（零阻塞不卡死 Executor）',
            filename: 'chassis_client_node.cpp (核心片段)',
            language: 'cpp',
            code: `// 1. 异步 Service 调用：传入回调 lambda，不调用阻塞式的 future.get()
speed_client_->async_send_request(
  req, [this](rclcpp::Client<SetMaxSpeed>::SharedFuture future) {
    auto resp = future.get();  // 此回调触发时 future 已就绪，立即返回无阻塞
    RCLCPP_INFO(this->get_logger(), "Applied limit: %.2f m/s", resp->applied_limit_mps);
  });

// 2. 异步 Action SendGoalOptions 三回调配置
auto opts = rclcpp_action::Client<DockAction>::SendGoalOptions();
opts.goal_response_callback = [this](const GoalHandleDock::SharedPtr & gh) { /* 鉴权结果 */ };
opts.feedback_callback = [this](GoalHandleDock::SharedPtr, const auto fb) { /* 实时进度 */ };
opts.result_callback = [this](const GoalHandleDock::WrappedResult & res) { /* 终态结果 */ };
dock_client_->async_send_goal(goal_msg, opts);`,
            sourcePath: 'ros2_ws/src/chassis_core/src/chassis_client_node.cpp',
          },
        ],
      },
    ],
  },
  {
    id: 'module-3',
    number: '03',
    title: '模块三：Launch 多节点编排、YAML 参数与实机部署教程',
    shortTitle: 'Launch 编排与实机部署',
    subtitle: '深入理解 ROS 2 命名空间、重映射与 YAML 参数注入原理，掌握单机调试到多机 Systemd / Docker 生产部署全链路。',
    versionScope: 'Python LaunchDescription · YAML Node Hierarchy · Systemd & Docker',
    sections: [
      {
        id: 'm3-launch-yaml',
        title: '3.1 Launch 编排原理与 YAML 注入规则精讲',
        paragraphs: [
          '虽然全栈算法使用 C++ 编写，但 ROS 2 官方唯一推荐的系统启动编排层是 Python 编写的 .launch.py 文件（C++ 写计算节点，Python 写启动描述）。Launch 框架采用声明式图构建模式：你在 generate_launch_description() 中返回一组 Action（节点、参数声明、命名空间分组、嵌套子 Launch），由 ROS 2 启动引擎统一托管子进程生命周期与退出信号。',
          '工程中三个核心概念必须分清：1) **Namespace（命名空间）**：通过 PushRosNamespace("amr_01") 将节点与相对话题统一加上 /amr_01 前缀，实现多车同网零冲突；2) **Remapping（话题重映射）**：在不改 C++ 源码的前提下，把节点内部的 "cmd_vel" 重定向到 "cmd_vel_safe"，对接安全仲裁器；3) **YAML 参数层级**：YAML 首行必须匹配节点名或使用 /** 通配符（强烈推荐，可跨命名空间复用），且其下必须严格拼写 ros__parameters（双下划线）。',
        ],
        callouts: [
          {
            label: '命名坑点：千万别在 C++ 代码里写死前导斜杠 "/cmd_vel"',
            text: '在 C++ create_publisher("cmd_vel") 中不加前导 "/" 属于相对名称，才能被 Launch 的 PushRosNamespace 自动隔离为 /amr_01/cmd_vel；一旦代码里写死 "/cmd_vel"（全局绝对名称），命名空间隔离将彻底失效！',
            tone: 'warn',
          },
        ],
        codeBlocks: [
          {
            title: 'YAML 通配符参数结构与 Launch 关键编排片段',
            filename: 'chassis_params.yaml & robot_bringup.launch.py (核心片段)',
            language: 'python',
            code: `# 1. config/chassis_params.yaml（/** 通配符确保任意 namespace 均可正确注入）
# /**:
#   ros__parameters:
#     max_linear_mps: 1.65
#     wheel_base_m: 0.44

# 2. launch/robot_bringup.launch.py 核心编排模式：
robot_group = GroupAction(actions=[
    PushRosNamespace(LaunchConfiguration("robot_ns")),
    Node(
        package="chassis_core",
        executable="chassis_manager_node",
        parameters=[params_file, {"use_sim_time": LaunchConfiguration("use_sim_time")}],
        remappings=[("cmd_vel", "cmd_vel_safe")],
        respawn=True,          # 节点异常崩溃时 2 秒后自动拉起自愈
        respawn_delay=2.0,
    ),
])

# 3. 跨包总控组合（system_bringup/launch/fleet_master.launch.py）：
# IncludeLaunchDescription(PythonLaunchDescriptionSource(...), launch_arguments={"robot_ns": "amr_01"}.items())`,
            sourcePath: 'ros2_ws/src/chassis_core/launch/robot_bringup.launch.py',
          },
        ],
      },
      {
        id: 'm3-production-deploy',
        title: '3.2 生产环境部署教程：工控机免源码部署、Systemd 自启与容器化',
        paragraphs: [
          '代码在开发机调通后，如何安全交付到现场工控机或嵌入式域控制器（如 Jetson Orin）？企业生产环境严禁直接把未编译源码和编译工具链暴露在现场，标准部署有两条路径：',
          '路径 A（裸机工控机交付）：仅将编译产物 `install/` 目录打包（`tar -czf release.tar.gz install/`），在目标机安装轻量的 `ros-${ROS_DISTRO}-ros-base`，配合 **Systemd 服务**（`amr_ros2.service`）实现开机自动 source 并拉起 Launch 栈与崩溃重启。路径 B（云原生多阶段 Docker 部署）：第一阶段在 `ros-base` 镜像内完成 `rosdep` + Release 编译，第二阶段仅拷贝 `/ws/install` 到极简 `ros-core` 镜像，大幅缩小镜像体积并锁定环境一致性。',
          '针对商用室外与车间级量产安全要求，还需关注两项工程加固：1）**SROS 2（DDS-Security）**：通过 `ros2 security create_keystore` 生成 X.509 证书与权限治理策略，防止同一局域网恶意节点伪造 `/cmd_vel` 劫持车辆；2）**工控机实时性调优（`PREEMPT_RT`）**：对高实时底盘控制节点使用 `sched_setscheduler(SCHED_FIFO)` 配合 `mlockall(MCL_CURRENT | MCL_FUTURE)` 锁定物理内存页，消除 Linux 缺页中断带来的控制周期尖峰抖动。',
        ],
        table: {
          caption: '多机现场部署网络、DDS 隔离与实时安全策略对照表',
          headers: ['部署场景', '核心痛点', '推荐工程配置'],
          rows: [
            ['单机开发调试', '防止被实验室其他人电脑误订阅', '设置 `ROS_DOMAIN_ID=<学号/车号>` + `ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST`'],
            ['车间多台 AMR 同 Wi-Fi', 'UDP 组播发现风暴导致通信卡顿', '机内走 SHM 共享内存；跨机启用 FastDDS Discovery Server 单播或 `rmw_zenoh_cpp`'],
            ['Docker 容器实机运行', '容器网络隔离导致找不到宿主机雷达', '启动加 `--net=host --ipc=host`，保证与宿主机 DDS 共享内存与网卡组播互通'],
            ['商用安全与强实时控制', '防恶意注入控制帧、控制环抖动', '启用 `ROS_SECURITY_ENABLE=true` (SROS 2) + `PREEMPT_RT` 内核与 `mlockall`'],
          ],
        },
        codeBlocks: [
          {
            title: '生产部署全流程命令（裸机安装包、Systemd 托管与 Docker 运行）',
            filename: 'deploy_production.sh',
            language: 'bash',
            code: `# === 方式 A：打包 install/ 部署到现场工控机 + Systemd 开机自启 ===
cd ros2_ws && colcon build --cmake-args -DCMAKE_BUILD_TYPE=Release
tar -czf amr_release_v1.tar.gz install/
# 在目标工控机解压至 /opt/robot/ros2_ws/ 后启用 Systemd：
sudo cp ros2_ws/src/system_bringup/systemd/amr_ros2.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now amr_ros2.service
journalctl -u amr_ros2.service -f

# === 方式 B：多阶段构建 Docker 镜像并以主机网络+共享内存模式拉起 ===
cd ros2_ws && docker build -t amr_ros2:v1.0 .
docker run -d --name amr_stack --restart unless-stopped \\
  --net=host --ipc=host -e ROS_DOMAIN_ID=42 amr_ros2:v1.0`,
            sourcePath: 'ros2_ws/Dockerfile',
          },
        ],
      },
    ],
  },
  {
    id: 'module-4',
    number: '04',
    title: '模块四：高并发执行器、零拷贝与 Lifecycle 工业进阶',
    shortTitle: '并发执行器、零拷贝与生命周期',
    subtitle: '深入理解 rclcpp Executor 调度原理、CallbackGroup 防死锁、ComposableNode 指针零拷贝与确定性状态机管理。',
    versionScope: 'MultiThreadedExecutor · rclcpp_components · LifecycleNode · RMW 调优',
    sections: [
      {
        id: 'm4-executor-sim',
        title: '4.1 Executor 调度机制与 CallbackGroup 并发死锁深度解析',
        paragraphs: [
          '在普通 C++ 中你通过线程池处理并发；而在 ROS 2 中，所有订阅、定时器、服务和动作回调的调度都由 **Executor（执行器）** 接管。SingleThreadedExecutor 只有一条线程串行轮询 DDS wait_set，绝对不会有竞态，但任何一个回调阻塞就会卡死整个节点。',
          '为了并发，很多开发者换成 MultiThreadedExecutor 却依然发生死锁——根源在于：rclcpp::Node 默认把所有回调接口归入同一个 MutuallyExclusive（互斥）回调组！当 Thread 1 在定时器回调里同步调用 Service（future.wait_for / future.get）时，它占着互斥组锁不放，导致线程池里空闲的 Thread 2 根本进不去同一互斥组执行 Service 响应回调。下方的交互式演示器分步还原了死锁与解锁机制。',
        ],
        simulatorId: 'sim3',
        codeBlocks: [
          {
            title: '关键代码：双 MutuallyExclusive 回调组隔离解除死锁',
            filename: 'deadlock_free_client_node.cpp (核心片段)',
            language: 'cpp',
            code: `// 1. 创建两个独立的互斥回调组：Timer 与 Client 互不阻塞，同时各自内部仍保串行安全
timer_cb_group_ = this->create_callback_group(rclcpp::CallbackGroupType::MutuallyExclusive);
client_cb_group_ = this->create_callback_group(rclcpp::CallbackGroupType::MutuallyExclusive);

client_ = this->create_client<SetMaxSpeed>("set_max_speed", rclcpp::ServicesQoS(), client_cb_group_);
timer_ = this->create_wall_timer(2s, std::bind(&DeadlockFreeClientNode::on_timer, this), timer_cb_group_);

// 2. main() 必须匹配使用 MultiThreadedExecutor（线程数 >= 2）
// rclcpp::executors::MultiThreadedExecutor executor(rclcpp::ExecutorOptions(), 4);
// executor.add_node(node);
// executor.spin();`,
            sourcePath: 'ros2_ws/src/chassis_core/src/deadlock_free_client_node.cpp',
          },
        ],
      },
      {
        id: 'm4-zero-copy',
        title: '4.2 rclcpp_components 组件化与 std::unique_ptr 同进程零拷贝',
        paragraphs: [
          '以 1080p 30Hz 图像（单帧 ~6.2 MB，每秒 ~186 MB）或 128 线激光点云为例：如果相机驱动和感知节点分属两个独立进程，即使走本机共享内存（SHM），依然存在“对象序列化 → 拷贝进共享段 → 反序列化构造对象”的 CPU 与内存带宽消耗。',
          'ROS 2 的同进程零拷贝机制（Intra-Process Communication）要求同时满足四个条件：1) 两个节点编译为 SHARED 动态共享库（.so），通过 RCLCPP_COMPONENTS_REGISTER_NODE 注册进同一 component_container 进程容器；2) 构造 NodeOptions 时启用 use_intra_process_comms(true)；3) 发布端用 std::make_unique<Msg> 堆分配并用 pub_->publish(std::move(msg)) 移交独占所有权；4) 单订阅者回调签名使用 Msg::UniquePtr，此时底层仅传递 8 字节裸指针地址，实现真正的 0 字节拷贝！',
        ],
        codeBlocks: [
          {
            title: '关键代码：Component 组件注册与 std::unique_ptr 所有权零拷贝移交',
            filename: 'intra_process_components.cpp (核心片段)',
            language: 'cpp',
            code: `// 1. 构造透传 NodeOptions 并开启进程内零拷贝开关
CameraProducerComponent(const rclcpp::NodeOptions & options)
: Node("camera_producer", rclcpp::NodeOptions(options).use_intra_process_comms(true)) {
  timer_ = this->create_wall_timer(33ms, [this]() {
    auto msg = std::make_unique<sensor_msgs::msg::Image>();
    // ... 填充图像数据 ...
    pub_->publish(std::move(msg));  // 所有权直接移交，0 次深拷贝
  });
}

// 2. 订阅端接收 UniquePtr（指针地址与发布端完全一致）
sub_ = this->create_subscription<sensor_msgs::msg::Image>(
  "camera/image_raw", 10,
  [this](sensor_msgs::msg::Image::UniquePtr msg) { /* 原地处理像素 */ });

// 3. 宏导出为动态库插件供 component_container_mt 加载
RCLCPP_COMPONENTS_REGISTER_NODE(zero_copy_pipeline::CameraProducerComponent)`,
            sourcePath: 'ros2_ws/src/zero_copy_pipeline/src/intra_process_components.cpp',
          },
        ],
      },
      {
        id: 'm4-lifecycle-dds',
        title: '4.3 LifecycleNode 状态机与主流 RMW 中间件选型调优',
        paragraphs: [
          '普通节点一旦创建就会开始发数据或驱动执行器，多模块协同启动时经常因底层尚未校准而误发控制帧。LifecycleNode 强制引入类似工业设备 PLC 的四态有限状态机（Unconfigured → Inactive → Active → Finalized）：资源分配放在 on_configure()，硬件使能放在 on_activate()，急停可瞬间切回 on_deactivate() 而不重启进程。配合 LifecyclePublisher，处于 Inactive 状态时调用 publish() 会被底层安全拦截。',
          '点击下方状态机交互图体验合法与非法状态跳转，并参考下表进行企业级 RMW 中间件选型。',
        ],
        simulatorId: 'sim4',
        codeBlocks: [
          {
            title: '关键代码：LifecycleNode 状态回调与 LifecyclePublisher 安全使能',
            filename: 'lidar_lifecycle_node.cpp (核心片段)',
            language: 'cpp',
            code: `CallbackReturn on_configure(const rclcpp_lifecycle::State &) override {
  scan_pub_ = this->create_publisher<sensor_msgs::msg::LaserScan>("scan", rclcpp::SensorDataQoS());
  return CallbackReturn::SUCCESS;  // 此时 scan_pub_ 处于未激活态，调用 publish() 不会对外发包
}

CallbackReturn on_activate(const rclcpp_lifecycle::State & state) override {
  LifecycleNode::on_activate(state);
  scan_pub_->on_activate();        // 显式激活发布器，开始对外输出激光帧
  return CallbackReturn::SUCCESS;
}

// main() 注意：LifecycleNode 需通过 get_node_base_interface() 加入 Executor
// executor.add_node(node->get_node_base_interface());`,
            sourcePath: 'ros2_ws/src/chassis_core/src/lidar_lifecycle_node.cpp',
          },
        ],
        table: {
          caption: 'ROS 2 主流 RMW 中间件选型对比（含 Lyrical Luth 2026 LTS Zenoh 支持）',
          headers: ['RMW 实现', '底层协议 / 架构', '优势特性', '企业典型选型场景'],
          rows: [
            ['rmw_fastrtps_cpp', 'eProsima FastDDS (默认)', '内置 SHM 共享内存、Discovery Server 单播、XML 调优丰富', '车载/室内 AMR 单机高吞吐与通用研发默认栈'],
            ['rmw_cyclonedds_cpp', 'Eclipse CycloneDDS', 'C 语言内核极简低延迟、Iceoryx 跨进程零拷贝生态成熟', 'Nav2 / Autoware 自动驾驶高频点云低抖动场景'],
            ['rmw_zenoh_cpp', 'Eclipse Zenoh (2026 LTS 增强)', '无 UDP 组播风暴、天然穿透 NAT/跨公网与极低内存占用', '多机车队云边协同、弱网无线遥控与嵌入式 MCU'],
          ],
        },
      },
    ],
  },
];
