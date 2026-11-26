import { HandbookModule } from '../types/handbook';

export const MODULES_PART_2: HandbookModule[] = [
  {
    id: 'module-5',
    number: '05',
    title: '模块五：机器人建模、TF2 时空变换与 ros2_control 硬件插件',
    shortTitle: 'TF2 与 ros2_control 插件',
    subtitle: '掌握 REP-103/REP-105 坐标系规范、URDF/Xacro 建模逻辑、TF2 外推异常根治以及 ros2_control C++ SystemInterface 实时硬件抽象。',
    versionScope: 'REP-103 / REP-105 · TF2 Buffer · ros2_control SystemInterface',
    sections: [
      {
        id: 'm5-tf2-control-sim',
        title: '5.1 机器人坐标系规范（REP-103 / REP-105）与控制闭环',
        paragraphs: [
          '对于零基础进入机器人领域的 C++ 工程师，必须先记住 ROS 全球统一的两条坐标系铁律：1) **REP-103 右手坐标系（ENU 东北天）**：车体正前方为 +X，左侧为 +Y，垂直向上为 +Z（逆时针旋转 Yaw 角为正）；2) **REP-105 标准变换链 `map -> odom -> base_link`**：严禁只发布一层 `map -> base_link`。因为轮式里程计或 VIO（`odom -> base_link`）绝对连续平滑但会随时间漂移，供局部避障控制使用；而 SLAM 全局定位（`map -> odom`）在闭环修正时会发生离散跳变。拆成两层既保证了全局定位准确，又不会因定位跳变瞬间拉扯底层 PID 导致车体剧烈抖动。',
          '此外，TF2 变换树是一棵严格的**单父节点有向无环图（DAG）**：每个子坐标系（child_frame）同一时刻只能有一个发布者维护其父节点，否则会导致树结构闪烁撕裂。点击下方交互拓扑图查看从上层导航到底层电机寄存器的完整数据流。',
        ],
        simulatorId: 'sim5',
      },
      {
        id: 'm5-urdf-xacro',
        title: '5.2 URDF / Xacro 机器人建模核心要素',
        paragraphs: [
          'URDF（Unified Robot Description Format）用 XML 描述机器人的刚体连杆（`<link>`）与关节约束（`<joint>`），每个 Link 通常包含三组子标签：`<visual>`（RViz2/Gazebo 渲染外观）、`<collision>`（物理引擎简化碰撞包络）与 `<inertial>`（质量与 3x3 惯性张量矩阵，仿真稳定性关键）。',
          '写好 Xacro 文件后，RViz2 并不会直接读取 XML，中间需要 **`robot_state_publisher`** 作为翻译桥梁：它解析 `robot_description` 参数，将固定关节（如 `base_link -> laser_link`）一次性广播至 `/tf_static`，同时订阅 `/joint_states` 实时计算活动轮关节（`left_wheel_joint`）的世界位姿并广播至 `/tf`。调试阶段常配合 `joint_state_publisher_gui` 滑动条直观检查轮轴旋转方向是否正确。',
          '工业工程普遍使用 Xacro 宏语言消除左右轮对称结构的重复代码，并在同一份模型文件末尾嵌入 `<ros2_control>` 标签，把逻辑关节（`left_wheel_joint`）直接绑定到你用 C++ 编写的硬件插件类（`diff_hw_interface/DiffBotSystemHardware`）。',
        ],
        codeBlocks: [
          {
            title: '关键片段：Xacro 对称轮组宏与 <ros2_control> 插件绑定',
            filename: 'diff_bot.urdf.xacro (核心片段)',
            language: 'xml',
            code: `<xacro:macro name="drive_wheel" params="prefix y_offset">
  <link name="\${prefix}_wheel_link">
    <visual><origin rpy="1.5707963 0 0"/><geometry><cylinder radius="0.08" length="0.04"/></geometry></visual>
    <inertial><mass value="1.5"/><inertia ixx="0.0026" ixy="0" ixz="0" iyy="0.0026" iyz="0" izz="0.0048"/></inertial>
  </link>
  <joint name="\${prefix}_wheel_joint" type="continuous">
    <parent link="base_link"/><child link="\${prefix}_wheel_link"/><origin xyz="0 \${y_offset} 0"/><axis xyz="0 1 0"/>
  </joint>
</xacro:macro>

<ros2_control name="DiffBotHardwareSystem" type="system">
  <hardware>
    <plugin>diff_hw_interface/DiffBotSystemHardware</plugin>
    <param name="can_interface">can0</param>
  </hardware>
  <joint name="left_wheel_joint">
    <command_interface name="velocity"/><state_interface name="position"/><state_interface name="velocity"/>
  </joint>
</ros2_control>`,
            sourcePath: 'ros2_ws/src/robot_description/urdf/diff_bot.urdf.xacro',
          },
          {
            title: '模型可视化验证：启动 robot_state_publisher 与 RViz2 检查坐标系',
            filename: 'display.launch.py (调用与核心片段)',
            language: 'python',
            code: `# 1. 启动命令（打开 RViz2 + 关节滑动条检查轮组与雷达外参）
# ros2 launch robot_description display.launch.py

# 2. Launch 核心：通过 xacro 动态展开生成 robot_description 参数传给 robot_state_publisher
robot_state_publisher = Node(
    package="robot_state_publisher",
    executable="robot_state_publisher",
    parameters=[{"robot_description": Command(["xacro ", xacro_file])}],
)`,
            sourcePath: 'ros2_ws/src/robot_description/launch/display.launch.py',
          },
        ],
      },
      {
        id: 'm5-tf2-cpp',
        title: '5.3 TF2 广播异常根治与 message_filters 多传感器时间同步',
        paragraphs: [
          'TF2 内部将静态变换与动态变换分离为两个话题：`/tf_static`（使用 Transient Local 持久化 QoS，对激光雷达等固连传感器只需开机广播一次，后启动的节点也能立刻收到）与 `/tf`（高频动态发布，缓存默认保留最近 10 秒的历史滑动窗口用于时间线性插值 SLERP）。',
          '写 C++ 代码时最高频的运行时异常是 `tf2::ExtrapolationException`（请求时间需要向未来外推）。根源往往是雷达点云刚采集完打上时间戳 `T`，而最新的 `odom -> base_link` 变换还在 DDS 队列中滞后 15ms。工程标准解法是调用 `tf_buffer_->transform(pt, "odom", tf2::durationFromSec(0.05))` 传入 50ms 容忍等待超时，或用 `tf2_ros::MessageFilter` 异步等待 TF 就绪后再触发算法回调。',
          '同样在感知融合中，里程计 `/odom`（50Hz）与激光雷达 `/scan`（10Hz）或双目 RGB/Depth 的硬件采集时间戳几乎不可能纳秒级严格相等，直接用 `ExactTime` 会导致一帧都配对不上。ROS 2 标准方案是引入 **`message_filters::Subscriber` + `ApproximateTime`** 近似时间同步器，在指定时间窗口（如 50ms）内自动对齐距离最近的消息组并触发融合回调。',
        ],
        codeBlocks: [
          {
            title: '关键代码 1：静态/动态 TF2 广播与带超时容错的坐标转换',
            filename: 'tf2_pipeline_node.cpp (核心片段)',
            language: 'cpp',
            code: `// 1. 静态广播（base_link -> laser_link）仅需启动时发送一次
static_broadcaster_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);
static_broadcaster_->sendTransform(static_tf_msg);

// 2. 动态广播（odom -> base_link）随里程计高频更新
tf2::Quaternion q;
q.setRPY(0.0, 0.0, yaw);
odom_tf.transform.rotation = tf2::toMsg(q);
dynamic_broadcaster_->sendTransform(odom_tf);

// 3. 安全查询：传入 50ms 等待超时并用 try-catch 捕获 TransformException，彻底消除外推崩溃
try {
  auto pt_odom = tf_buffer_->transform(pt_laser, "odom", tf2::durationFromSec(0.05));
} catch (const tf2::TransformException & ex) {
  RCLCPP_WARN_THROTTLE(this->get_logger(), *this->get_clock(), 1000, "TF2 error: %s", ex.what());
}`,
            sourcePath: 'ros2_ws/src/chassis_core/src/tf2_pipeline_node.cpp',
          },
          {
            title: '关键代码 2：message_filters::ApproximateTime 同步 /odom 与 /scan',
            filename: 'sensor_sync_node.cpp (核心片段)',
            language: 'cpp',
            code: `using SyncPolicy = message_filters::sync_policies::ApproximateTime<
  nav_msgs::msg::Odometry, sensor_msgs::msg::LaserScan>;

odom_sub_.subscribe(this, "odom", rmw_qos_profile_sensor_data);
scan_sub_.subscribe(this, "scan", rmw_qos_profile_sensor_data);

sync_ = std::make_shared<message_filters::Synchronizer<SyncPolicy>>(
  SyncPolicy(20), odom_sub_, scan_sub_);
sync_->setMaxIntervalDuration(rclcpp::Duration::from_seconds(0.05));
sync_->registerCallback(
  std::bind(&SensorSyncNode::on_synced, this, std::placeholders::_1, std::placeholders::_2));`,
            sourcePath: 'ros2_ws/src/chassis_core/src/sensor_sync_node.cpp',
          },
        ],
      },
      {
        id: 'm5-ros2-control-plugin',
        title: '5.4 ros2_control C++ SystemInterface 实时性铁律与插件导出',
        paragraphs: [
          '为什么不推荐自己写一个订阅 `/cmd_vel` 的节点直接驱动电机，而要遵循 `ros2_control` 架构？因为官方 `diff_drive_controller`、`joint_trajectory_controller` 已内置完善的轮距运动学解算、加减速平滑限幅与 `/odom` TF 广播。你只需专注编写继承 `hardware_interface::SystemInterface` 的 C++ 硬件插件，通过 `pluginlib` 导出共享库给 `ControllerManager` 动态加载即可。',
          '编写插件时必须恪守**实时控制环（Real-Time Loop）三大禁忌**：`read()` 与 `write()` 运行在 100Hz~1000Hz 的实时调度线程中，内部**严禁动态内存分配（new/malloc/vector 扩容）、严禁阻塞式系统调用或磁盘文件 I/O、严禁打印海量日志**。实机开发中通常开启独立异步 I/O 线程读写 SocketCAN / RS485，通过无锁环形缓冲区与 `read()`/`write()` 交换双精度浮点数组。',
        ],
        codeBlocks: [
          {
            title: '关键代码：SystemInterface 核心接口暴露与实时读写周期',
            filename: 'diff_system_hardware.cpp (核心片段)',
            language: 'cpp',
            code: `// 1. 将内存数组指针注册为状态与指令句柄（零拷贝直接供上层控制器读写）
std::vector<hardware_interface::StateInterface> DiffBotSystemHardware::export_state_interfaces() {
  std::vector<hardware_interface::StateInterface> out;
  for (size_t i = 0; i < info_.joints.size(); ++i) {
    out.emplace_back(info_.joints[i].name, hardware_interface::HW_IF_POSITION, &hw_states_pos_[i]);
    out.emplace_back(info_.joints[i].name, hardware_interface::HW_IF_VELOCITY, &hw_states_vel_[i]);
  }
  return out;
}

// 2. 实时控制周期 read() / write()：O(1) 复杂度，无阻塞、无内存分配
hardware_interface::return_type DiffBotSystemHardware::read(
  const rclcpp::Time &, const rclcpp::Duration & period) {
  const double dt = period.seconds();
  for (size_t i = 0; i < hw_states_pos_.size(); ++i) {
    hw_states_vel_[i] = hw_commands_vel_[i];  // 实机此处从无锁环形队列读取编码器反馈
    hw_states_pos_[i] += hw_states_vel_[i] * dt;
  }
  return hardware_interface::return_type::OK;
}

// 3. 宏导出插件符号，并在 CMakeLists.txt 调用 pluginlib_export_plugin_description_file()
PLUGINLIB_EXPORT_CLASS(diff_hw_interface::DiffBotSystemHardware, hardware_interface::SystemInterface)`,
            sourcePath: 'ros2_ws/src/diff_hw_interface/src/diff_system_hardware.cpp',
          },
          {
            title: '关键配置：pluginlib XML 描述文件与控制器加载启动验证',
            filename: 'diff_hw_interface.xml & diff_control.launch.py',
            language: 'xml',
            code: `<!-- diff_hw_interface.xml（缺此文件运行时将报错找不到硬件插件） -->
<library path="diff_hw_interface">
  <class name="diff_hw_interface/DiffBotSystemHardware"
         type="diff_hw_interface::DiffBotSystemHardware"
         base_class_type="hardware_interface::SystemInterface">
    <description>Industrial differential-drive CAN hardware plugin.</description>
  </class>
</library>

<!-- 完整闭环启动与调试命令：
  ros2 launch diff_hw_interface diff_control.launch.py
  ros2 control list_controllers
  ros2 topic pub /diff_drive_base_controller/cmd_vel geometry_msgs/msg/Twist "{linear: {x: 0.5}}"
-->`,
            sourcePath: 'ros2_ws/src/diff_hw_interface/launch/diff_control.launch.py',
          },
        ],
      },
    ],
  },
  {
    id: 'module-6',
    number: '06',
    title: '模块六：Modern Gazebo 仿真、Nav2 / MoveIt 2 与内存排错',
    shortTitle: 'Modern Gazebo、Nav2 与排错',
    subtitle: '掌握新版 gz-sim 与 ros_gz_bridge 仿真时钟桥接原理，理解 Nav2 行为树与 MoveIt 2 异步线程架构，并建立 GDB/ASAN/MCAP 排错闭环。',
    versionScope: 'Modern Gazebo (gz-sim) · Nav2 BT · MoveIt 2 · ASAN & MCAP',
    sections: [
      {
        id: 'm6-modern-gazebo',
        title: '6.1 Modern Gazebo（gz-sim）仿真引擎与 /clock 同步原理',
        paragraphs: [
          '旧版 Gazebo Classic（gazebo11）已于 2025 年正式停止维护（EOL），Humble/Jazzy/Lyrical Luth 全面转向模块化重构的 Modern Gazebo（执行命令为 `gz sim`）。新版 Gazebo 底层使用完全独立的 `gz-transport` 通信框架，不直接依赖 DDS，因此必须通过 `ros_gz_bridge` 节点按 YAML 映射表在 `gz.msgs` 与 `ROS 2 msg` 之间双向转发消息。',
          '仿真中最容易踩的时间同步陷阱是：**忘记桥接 `/clock` 话题或忘记给算法节点传入 `use_sim_time: true`**。在物理仿真中（尤其开启复杂激光点云或摄像头渲染时），仿真时间步长往往慢于物理墙钟（RTF < 1.0）。只有全系统节点统一订阅 `/clock` 并使用 `this->now()`，TF2 缓存、Nav2 控制器与传感器时间戳才能保持严格同步。',
        ],
        codeBlocks: [
          {
            title: '关键配置：ros_gz_bridge 双向桥接与仿真 Launch 核心编排',
            filename: 'gz_bridge.yaml & sim_bringup.launch.py (核心片段)',
            language: 'yaml',
            code: `# config/gz_bridge.yaml：务必首条桥接 /clock (GZ_TO_ROS) 驱动全部节点仿真时钟
- ros_topic_name: "/clock"
  gz_topic_name: "/clock"
  ros_type_name: "rosgraph_msgs/msg/Clock"
  gz_type_name: "gz.msgs.Clock"
  direction: GZ_TO_ROS

- ros_topic_name: "/cmd_vel"
  gz_topic_name: "/model/diff_bot/cmd_vel"
  ros_type_name: "geometry_msgs/msg/Twist"
  gz_type_name: "gz.msgs.Twist"
  direction: ROS_TO_GZ`,
            sourcePath: 'ros2_ws/src/sim_bringup/config/gz_bridge.yaml',
          },
        ],
      },
      {
        id: 'm6-nav2-moveit2',
        title: '6.2 从 SLAM 建图过渡到 Nav2 行为树与 MoveIt 2 规划',
        paragraphs: [
          '从 Gazebo 仿真过渡到自主导航前，必须先经过 **SLAM 建图过渡阶段**：在仿真或实机拉起雷达与里程计后，启动 `slam_toolbox` 在线异步建图并用键盘遥控机器人走完环境一圈；接着用 `nav2_map_server map_saver_cli` 导出静态栅格地图（`.yaml` + `.pgm`）；最后切入 Nav2 栈由 `AMCL` 在已知地图中做粒子滤波定位并发布 `map -> odom` 变换。',
          'Nav2 并非单一路径规划节点，而是由 LifecycleManager 统一编排的一组状态机节点群：定位（AMCL / SLAM Toolbox）、全局规划（PlannerServer：NavFn/Smac）、局部控制（ControllerServer：RPP 纯追踪 / MPPI 预测控制）以及由 BehaviorTree.CPP 驱动的顶层决策树（BT Navigator）。工程落地时，调优代价地图膨胀半径（`inflation_radius` 与 `cost_scaling_factor`）能决定窄道能否顺利通过，而自定义 C++ BT 插件则负责接入充电对接、门禁联动等业务判断。',
          '对于机械臂岗位，MoveIt 2 的 C++ 核心类 `MoveGroupInterface` 内部在构造时会请求多个机器人状态服务与 Action。因此在 `main()` 中**必须先启动一个后台 `std::thread` 运行 Executor `spin()`**，主线程再安全调用 `move_group.plan()` 与 `execute()`，否则程序会在初始化阶段永久阻塞死锁。',
        ],
        simulatorId: 'sim9',
        codeBlocks: [
          {
            title: 'SLAM 建图保存地图与 Nav2 联动调试关键指令',
            filename: 'slam_to_nav2.sh',
            language: 'bash',
            code: `# 1. 启动仿真机器人后，拉起 slam_toolbox 在线建图（注意传 use_sim_time:=true）
ros2 launch slam_toolbox online_async_launch.py use_sim_time:=true

# 2. 遥控绕场建图完成后，导出地图供 Nav2 AMCL 定位加载
mkdir -p ~/maps && ros2 run nav2_map_server map_saver_cli -f ~/maps/warehouse

# 3. 带入自建地图与 sim_bringup/config/nav2_tuning.yaml 参数启动 Nav2 导航
ros2 launch nav2_bringup bringup_launch.py use_sim_time:=true map:=~/maps/warehouse.yaml \\
  params_file:=$(ros2 pkg prefix sim_bringup)/share/sim_bringup/config/nav2_tuning.yaml`,
            sourcePath: 'ros2_ws/src/sim_bringup/config/nav2_tuning.yaml',
          },
          {
            title: '关键代码：Nav2 自定义 BehaviorTree.CPP 条件节点与导出宏',
            filename: 'check_battery_condition.cpp (核心片段)',
            language: 'cpp',
            code: `class CheckBatteryCondition : public BT::ConditionNode {
public:
  CheckBatteryCondition(const std::string & name, const BT::NodeConfig & config)
  : BT::ConditionNode(name, config) {}

  static BT::PortsList providedPorts() {
    return { BT::InputPort<double>("min_voltage", 44.0, "Min voltage"),
             BT::InputPort<double>("current_voltage", "Live voltage") };
  }

  BT::NodeStatus tick() override {
    double min_v = 44.0, cur_v = 0.0;
    getInput("min_voltage", min_v);
    return (getInput("current_voltage", cur_v) && cur_v >= min_v)
      ? BT::NodeStatus::SUCCESS : BT::NodeStatus::FAILURE;
  }
};

// 必须导出 BehaviorTree.CPP 插件符号，供 Nav2 bt_navigator XML 动态加载
BT_REGISTER_NODES(factory) {
  factory.registerNodeType<nav2_custom_bt::CheckBatteryCondition>("CheckBatteryCondition");
}`,
            sourcePath: 'ros2_ws/src/nav2_custom_bt/src/check_battery_condition.cpp',
          },
          {
            title: '关键代码：MoveIt 2 MoveGroupInterface 必须配合独立 spin 线程',
            filename: 'moveit_pose_demo.cpp (核心片段)',
            language: 'cpp',
            code: `// MoveGroupInterface 依赖异步服务与 TF 接收，必须开启独立线程 spin 节点
rclcpp::executors::SingleThreadedExecutor executor;
executor.add_node(node);
std::thread spinner([&executor]() { executor.spin(); });

moveit::planning_interface::MoveGroupInterface move_group(node, "ur_manipulator");
move_group.setPoseTarget(target_pose);
MoveGroupInterface::Plan plan;
if (move_group.plan(plan) == moveit::core::MoveItErrorCode::SUCCESS) {
  move_group.execute(plan);
}
rclcpp::shutdown();
spinner.join();`,
            sourcePath: 'ros2_ws/src/arm_planner/src/moveit_pose_demo.cpp',
          },
        ],
      },
      {
        id: 'm6-debug-docker',
        title: '6.3 企业级测试与排错闭环：GTest、ASAN、GDB、PlotJuggler 与 MCAP',
        paragraphs: [
          '工业研发团队对运动学解算、安全限幅和状态机边界强制要求自动化回归测试：在 `CMakeLists.txt` 的 `if(BUILD_TESTING)` 分支中使用 **`ament_add_gtest`** 集成 GoogleTest，提交代码前运行 `colcon test` 即可在毫秒级拦截数学回归 Bug，无需每次拉起仿真器。',
          '在实机长期运行观测上，推荐使用官方 **`diagnostic_updater::Updater`** 库将电机温度、CAN 掉线率、传感器帧率统一汇总发布到 `/diagnostics` 话题（`OK`/`WARN`/`ERROR` 三态分级），供上位机与车队调度平台统一告警；线下复现现场 Bug 时，则用 `ros2 bag play run_01 --clock --rate 0.5` 以半速回放并重写 `/clock`，让算法节点像实机一样逐帧重演。',
          '面对 C++ ROS 2 线上偶发段错误或控制曲线抖动，高效工程师遵循四步排错闭环：1) 编译开启 `-DCMAKE_BUILD_TYPE=RelWithDebInfo` 或挂载 AddressSanitizer（`-fsanitize=address`）精准抓出悬垂指针与容器越界；2) 用 `ros2 run --prefix "gdb -ex run --args"` 直接挂接 GDB 还原崩溃堆栈；3) 使用 PlotJuggler 实时绘制 `/cmd_vel` 与 `/odom` 响应曲线排查相位滞后；4) 高频点云/图像录包切换为现代 **MCAP** 存储格式（`-s mcap`），避免默认 SQLite3 I/O 阻塞丢帧，并用 Foxglove Studio 秒开回放。',
        ],
        codeBlocks: [
          {
            title: '关键代码：ament_add_gtest 运动学单元测试与 colcon test 执行',
            filename: 'test_chassis_kinematics.cpp (核心片段)',
            language: 'cpp',
            code: `TEST(ChassisKinematicsTest, ClampsLinearVelocityWithinSafeBounds) {
  auto [left, right] = chassis_kinematics::twistToWheelSpeeds(3.0, 0.0, 0.42, 1.5);
  EXPECT_DOUBLE_EQ(left, 1.5);
  EXPECT_DOUBLE_EQ(right, 1.5);
}

// CMakeLists.txt:
// if(BUILD_TESTING)
//   find_package(ament_cmake_gtest REQUIRED)
//   ament_add_gtest(test_chassis_kinematics test/test_chassis_kinematics.cpp)
// endif()
// 终端执行：colcon test --packages-select chassis_core --event-handlers console_direct+`,
            sourcePath: 'ros2_ws/src/chassis_core/test/test_chassis_kinematics.cpp',
          },
          {
            title: 'ASAN 内存检测、GDB 挂载、MCAP 录包与 --clock 慢速回放复现指令',
            filename: 'debug_tools.sh',
            language: 'bash',
            code: `# 1. 开启 AddressSanitizer 抓野指针与越界访问
colcon build --packages-select chassis_core \\
  --cmake-args -DCMAKE_BUILD_TYPE=Debug -DCMAKE_CXX_FLAGS="-fsanitize=address -fno-omit-frame-pointer -g"

# 2. 启动节点时自动挂载 GDB 捕获段错误现场
ros2 run --prefix 'gdb -ex run --args' chassis_core chassis_manager_node

# 3. 安装 PlotJuggler 与 Foxglove Bridge，使用 MCAP 录包并在离线节点按 --clock 回放
sudo apt-get install -y ros-\${ROS_DISTRO}-plotjuggler-ros ros-\${ROS_DISTRO}-foxglove-bridge
ros2 bag record -s mcap --max-cache-size 104857600 -o run_01 /scan /odom /tf /tf_static
ros2 bag play run_01 --clock --rate 0.5 --remap /scan:=/scan_replay`,
          },
        ],
      },
    ],
  },
  {
    id: 'module-7',
    number: '07',
    title: '模块七：C++ Qt（Qt5/Qt6）机器人上位机双线程开发实战',
    shortTitle: 'Qt + ROS 2 双线程上位机',
    subtitle: '彻底理解 Qt 主事件循环与 rclcpp Executor 线程冲突根源，掌握 Qt::QueuedConnection 安全刷新、优雅退出时序与 RViz2 视口内嵌。',
    versionScope: 'CMAKE_AUTOMOC · QMetaObject::invokeMethod · rclcpp::shutdown()',
    sections: [
      {
        id: 'm7-qt-thread-sim',
        title: '7.1 Qt GUI 主线程与 ROS 2 后台线程并发原理',
        paragraphs: [
          '在开发巡检机器人监控台或机械臂示教器时，新手最容易犯两大致命错误：错误一，把 `rclcpp::spin()` 放进 Qt 主线程（结果 `spin` 死循环抢占 CPU，Qt 窗口点击无响应直接卡死）；错误二，把 `rclcpp::spin()` 放进子线程，然后在 ROS 2 订阅回调里直接写 `battery_bar_->setValue(pct)`（结果触发随机界面闪烁或 `QBackingStore` 段错误崩溃）。',
          '根本原因在于 **Qt 强规定所有 QWidget 绘制与状态修改必须在运行 `QApplication::exec()` 的主线程执行**。标准工业架构是：主线程专职 Qt 界面事件循环，后台单独开辟 `std::thread` 运行 `rclcpp::executors::SingleThreadedExecutor`；后台收到话题数据后只拷贝轻量级值类型（如 `int pct`），通过 `QMetaObject::invokeMethod(..., Qt::QueuedConnection)` 将刷新闭包安全投递到 Qt 主线程队列；窗口关闭时则在 `closeEvent` 中严格按 `cancel() -> rclcpp::shutdown() -> join()` 顺序先回收后台线程再销毁控件。点击下方时序图逐阶段演练。',
        ],
        simulatorId: 'sim6',
      },
      {
        id: 'm7-qt-code',
        title: '7.2 关键代码讲解：CMake AUTOMOC、安全刷新、优雅退出与 RViz2 内嵌',
        paragraphs: [
          '混编 Qt 与 ROS 2 工程时，CMake 必须显式开启 `set(CMAKE_AUTOMOC ON)` 以便自动处理头文件中的 `Q_OBJECT` 宏，同时兼顾 Qt6 优先、Qt5 自动回退的查找策略。下面提炼出最核心的三段工程代码，完整可编译 Qt 上位机工程已存放在 `ros2_ws/src/robot_hmi/`。',
        ],
        codeBlocks: [
          {
            title: '关键代码 1：Qt5/Qt6 兼容 CMakeLists.txt 核心配置',
            filename: 'robot_hmi/CMakeLists.txt (核心片段)',
            language: 'cmake',
            code: `set(CMAKE_AUTOMOC ON)  # 必须开启，否则 Q_OBJECT 信号槽链接时报 undefined reference to vtable
find_package(Qt6 COMPONENTS Widgets QUIET)
if(NOT Qt6_FOUND)
  find_package(Qt5 COMPONENTS Widgets REQUIRED)
endif()

add_executable(robot_hmi_app src/main.cpp src/main_window.hpp src/main_window.cpp)
target_link_libraries(robot_hmi_app PUBLIC rclcpp::rclcpp \${geometry_msgs_TARGETS} \${sensor_msgs_TARGETS})
target_link_libraries(robot_hmi_app PUBLIC $<IF:$<BOOL:\${Qt6_FOUND}>,Qt6::Widgets,Qt5::Widgets>)`,
            sourcePath: 'ros2_ws/src/robot_hmi/CMakeLists.txt',
          },
          {
            title: '关键代码 2：Qt::QueuedConnection 跨线程刷新与 closeEvent 优雅退出时序',
            filename: 'main_window.cpp (核心片段)',
            language: 'cpp',
            code: `// 1. ROS 2 回调运行在后台 std::thread，必须通过 Qt::QueuedConnection 封送回 GUI 主线程更新控件
battery_sub_ = ros_node_->create_subscription<sensor_msgs::msg::BatteryState>(
  "battery_state", rclcpp::SensorDataQoS(),
  [this](const sensor_msgs::msg::BatteryState::SharedPtr msg) {
    int pct = static_cast<int>(std::clamp(msg->percentage * 100.0F, 0.0F, 100.0F));
    QMetaObject::invokeMethod(this, [this, pct]() {
      battery_bar_->setValue(pct);
      status_label_->setText(QString("Battery telemetry updated: %1%").arg(pct));
    }, Qt::QueuedConnection);
  });

// 2. 窗口关闭事件：严格先 cancel + shutdown 再 join()，确保后台线程完全退出后才销毁 UI 控件
void MainWindow::shutdownRos() {
  if (executor_) executor_->cancel();
  if (rclcpp::ok()) rclcpp::shutdown();
  if (ros_thread_.joinable()) ros_thread_.join();
}`,
            sourcePath: 'ros2_ws/src/robot_hmi/src/main_window.cpp',
          },
          {
            title: '关键代码 3：在 Qt 布局内原生嵌入 RViz2 3D 点云视口（rviz_common::RenderPanel）',
            filename: 'rviz_embed_snippet.cpp (核心片段)',
            language: 'cpp',
            code: `auto rviz_node = std::make_shared<rviz_common::ros_integration::RosNodeAbstraction>("rviz_embed_node");
auto * render_panel = new rviz_common::RenderPanel(this);  // 本质上是继承 QWidget 的 3D 视口
layout->addWidget(render_panel);

auto * viz_manager = new rviz_common::VisualizationManager(
  render_panel, rviz_node, nullptr, ros_node_->get_clock());
render_panel->initialize(viz_manager);
viz_manager->initialize();
viz_manager->startUpdate();

auto * scan = viz_manager->createDisplay("rviz_default_plugins/LaserScan", "LidarScan", true);
scan->subProp("Topic")->setValue("/scan");`,
            sourcePath: 'ros2_ws/src/robot_hmi/src/rviz_embed_snippet.cpp',
          },
        ],
      },
    ],
  },
  {
    id: 'module-cpp-deep-dive',
    number: '08',
    shortTitle: 'ROS 2 核心 C++ 精讲与排坑',
    title: '模块八：ROS 2 必学现代 C++17 精讲、疑难排坑与专项面试',
    subtitle:
      '系统梳理 rclcpp、Nav2 与 ros2_control 源码高频依赖的现代 C++17/20 核心语法、内存所有权与并发原语，深度剖析 8 类隐蔽崩溃现场与专项面试高频追问。',
    versionScope: 'C++17 / C++20 · Humble / Jazzy / Lyrical Luth',
    sections: [
      {
        id: 'm8cpp-modern-syntax',
        title: '8.1 ROS 2 必须吃透的现代 C++17 核心语法与内存模型',
        paragraphs: [
          '许多传统 C++ 工程师刚打开 `rclcpp` 或 `Nav2` 源码时，会被满屏的 `SharedPtr`、`ConstSharedPtr`、`UniquePtr`、`std::weak_ptr`、`std::bind`、`std::placeholders::_1`、`std::chrono_literals` 以及 Lambda 捕获列表劝退。实际上，ROS 2 的 C++ API 本质上是对现代 C++17 **RAII 资源管理、移动语义（Move Semantics）与多态并发安全** 的高度凝练封装。',
          '第一支柱是**智能指针与类型别名体系**：ROS 2 每个 `.msg` 与 `Node` 类均通过宏（`RCLCPP_SMART_PTR_DEFINITIONS`）自动生成 `Msg::SharedPtr`、`Msg::ConstSharedPtr`、`Msg::UniquePtr` 与 `Msg::WeakPtr`。订阅回调默认推荐使用 `ConstSharedPtr`（只读共享，零拷贝多播）；而同进程零拷贝流水线必须配合 `std::make_unique<Msg>()` 与 `std::move()` 转移 `UniquePtr` 独占权。此外，`rclcpp::Node` 继承自 `std::enable_shared_from_this<rclcpp::Node>`，为异步回调安全获取 `weak_from_this()` 提供底层支撑。',
          '第二支柱是**Lambda、`std::function` 与 `std::bind`**：简单 Topic 订阅与定时器推荐直接写轻量 Lambda（如 `[this](const Msg::ConstSharedPtr msg) { ... }`）；而在 `rclcpp_action` 三回调、`message_filters::Synchronizer` 或参数较多时，常见 `std::bind(&MyNode::on_goal, this, _1, _2)`。面试需注意：`std::bind` 生成的可调用对象类型与性能开销略高于直接 Lambda，C++17 新项目优先推荐 Lambda（必要时用泛型参数 `auto` 简化长类型签名）。',
          '第三支柱是**C++17 零开销工程语法与并发原语**：高频使用 `using namespace std::chrono_literals;`（`20ms`、`1s`）、`std::optional<T>`（表达传感器校验失败或轨迹求解无解而非返回魔法值 `-1`）、`std::string_view`（解析 TF `frame_id` 时零堆内存拷贝）、结构化绑定 `const auto [vx, wz] = ...`、多锁防死锁的 `std::scoped_lock(m1, m2)`、`std::atomic<bool>` 原子标志位，以及异步服务返回的 `std::shared_future`。',
        ],
        table: {
          caption: 'ROS 2 源码高频现代 C++17/20 核心语法与工程映射速查表',
          headers: ['C++ 核心特性', 'ROS 2 典型应用场景', '底层机制与注意事项'],
          rows: [
            [
              '`ConstSharedPtr` vs `UniquePtr`',
              'Topic 订阅回调 / 同进程零拷贝发布',
              '`ConstSharedPtr` 为只读共享计数（多订阅者安全复用）；`UniquePtr` 独占所有权，需 `std::move()` 移交且允许下游原地修改',
            ],
            [
              '`std::enable_shared_from_this`',
              '`node->shared_from_this()` / `weak_from_this()`',
              '依托 `make_shared` 控制块内的 `weak_this` 指针；绝对禁止在构造函数执行期间调用',
            ],
            [
              '`std::scoped_lock` vs `std::unique_lock`',
              '多线程 `Executor` 共享状态互斥保护',
              'C++17 `scoped_lock` 支持同时锁多把互斥量且内置死锁避免算法；需要配合 `condition_variable` 等待时才用 `unique_lock`',
            ],
            [
              '`std::optional` & `std::string_view`',
              '运动学逆解、TF 校验、字符串 Frame 解析',
              '零堆分配表达“可能无结果”和只读字符串切片；注意 `string_view` 不可绑定即将析构的临时 `std::string`',
            ],
            [
              '`std::vector::reserve()` & `std::array`',
              '`ros2_control` `read()`/`write()` 1kHz 控制环',
              '启动期一次性预分配容量，杜绝实时控制循环中因 `push_back` 扩容触发 `malloc` 造成微秒级抖动',
            ],
            [
              '`std::shared_future` & `std::atomic`',
              '`async_send_request` 异步响应 / 线程停机标志',
              '`SharedFuture` 允许多个线程或回调安全读取同一异步服务结果；`atomic<bool>` 用于无锁高频状态切换',
            ],
          ],
        },
        callouts: [
          {
            label: 'C++17 vs C++20 在 Humble / Jazzy / Lyrical Luth 的工程现状',
            text: 'Humble 默认标准为 C++17，Jazzy 全面支持 C++17/20，2026 年的 Lyrical Luth 及其生态（如 Modern Gazebo、MoveIt 2）已广泛兼容 C++20（如 `std::span`、`std::jthread`、`std::format`）。但在跨团队通用功能包 `CMakeLists.txt` 中，建议统一声明 `target_compile_features(target PUBLIC cxx_std_17)` 以保证向后兼容全部三个 LTS 版本。',
            tone: 'info',
          },
        ],
      },
      {
        id: 'm8cpp-tricky-pitfalls',
        title: '8.2 ROS 2 C++ 疑难问题与 8 大隐蔽崩溃排坑指南',
        paragraphs: [
          '掌握了基本 API 之后，真正拉开初级开发者与资深 ROS 2 C++ 工程师差距的，是对**对象生命周期交叉、成员析构次序、时间源异常以及 CMake 链接符号错误**的诊断能力。下面交互图解直观推演了工程中最容易导致“平时测试正常、偶发线上崩溃”的 4 类 C++ 所有权陷阱：',
        ],
        simulatorId: 'sim10',
        table: {
          caption: 'ROS 2 C++ 线上 8 大高频疑难问题排查手册',
          headers: ['故障现象 / 报错信息', '根本 C++ / ROS 2 原因', '标准工程解决方案'],
          rows: [
            [
              '构造期报错 `std::bad_weak_ptr`',
              '`std::make_shared<Node>()` 尚未完成构造，控制块 `weak_this` 仍为空时调用了 `shared_from_this()`',
              '移至 `init()` 两段初始化、单次 `1ms` `wall_timer` 延迟绑定，或改用 `LifecycleNode::on_configure()`',
            ],
            [
              'Ctrl+C 退出偶发 `SIGSEGV` 段错误',
              '类成员把 `timer_` / `sub_` 写在 `mutex_` / `pub_` 前面，C++ 逆序析构先销毁了锁和发布器，回调仍在运行',
              '严格遵守声明顺序：`atomic`/`mutex`/状态放顶部，`pub_` 居中，`sub_` 与 `timer_` 永远放类最底部',
            ],
            [
              '异步回调 / 线程中访问 `[this]` 崩溃',
              '外部释放了 Node `shared_ptr`，但 `async_send_request` 或后台线程仍持有裸指针 `[this]`',
              '改捕获 `[weak = weak_from_this()]`，回调首行 `auto self = weak.lock(); if (!self) return;`',
            ],
            [
              '`publish(std::move(msg))` 后读字段崩溃',
              '`std::unique_ptr` 移交所有权后局部变量立即变为 `nullptr`，后续日志/统计直接空指针解引用',
              '在 `std::move(msg)` 前先把要记录的标量拷贝到栈上局部变量，move 后严禁再碰原指针',
            ],
            [
              '订阅端修改 `SharedPtr` 消息引发数据竞态',
              '`std::shared_ptr` 仅保证引用计数原子安全，**不保证所指消息内容线程安全**；多回调并发读写即未定义行为',
              '普通订阅一律用 `ConstSharedPtr` 只读访问；需要原地修改则强制使用 `UniquePtr` 独占签名',
            ],
            [
              '`can\'t subtract times with different time sources`',
              '将 `this->now()`（`RCL_ROS_TIME`，受 `use_sim_time` 控制）与 `rclcpp::Time(0)` 默认系统时钟或 `SteadyClock` 直接相减',
              '统一时钟源：`rclcpp::Time(msg->header.stamp, this->get_clock()->get_clock_type())` 或全程使用节点 `get_clock()`',
            ],
            [
              '`std::async` 并发任务莫名串行阻塞',
              '未接收返回值：`std::async(...)` 返回的临时 `std::future` 析构时会强制阻塞等待任务结束！',
              '将 `std::future` 存入成员变量或容器，或改用专属工作线程 + `CallbackGroup`',
            ],
            [
              '链接报错 `undefined reference to vtable`',
              '1）继承纯虚基类（如 `SystemInterface` / `LifecycleNode`）漏写 `override` 方法实现；2）Qt 类加了 `Q_OBJECT` 却漏开 `CMAKE_AUTOMOC`；3）`pluginlib` 宏漏写',
              '检查基类全部纯虚函数是否实现、确认 `set(CMAKE_AUTOMOC ON)` 以及 `PLUGINLIB_EXPORT_CLASS` 与 XML 一致性',
            ],
          ],
        },
        codeBlocks: [
          {
            title: '关键代码：集齐构造延迟初始化、weak_from_this、scoped_lock 与成员逆序安全的工程模板',
            filename: 'cpp_pitfalls_node.cpp (核心片段)',
            language: 'cpp',
            code: `class CppPitfallsSafeNode : public rclcpp::Node {
public:
  explicit CppPitfallsSafeNode(const rclcpp::NodeOptions & options = rclcpp::NodeOptions())
  : Node("cpp_pitfalls_safe_node", options) {
    samples_buffer_.reserve(128);  // 启动期预分配容量，避免运行期堆扩容
    cmd_pub_ = create_publisher<TwistStamped>("safe_cmd_vel", 10);

    // 1. 构造期不调 shared_from_this()，用单次定时器延迟到 spin() 就绪后绑定
    init_once_timer_ = create_wall_timer(1ms, [this]() {
      init_once_timer_->cancel();
      this->deferred_post_init();
    });
  }

  void deferred_post_init() {
    std::weak_ptr<rclcpp::Node> weak_node = this->weak_from_this();
    control_timer_ = create_wall_timer(20ms, [weak_node]() {
      auto base = weak_node.lock();  // 2. 弱指针升强失败说明节点正在析构，安全跳过
      if (!base) return;
      std::static_pointer_cast<CppPitfallsSafeNode>(base)->on_control_tick();
    });
  }

private:
  // 3. 成员变量声明铁律（析构严格逆序）：锁与数据放最前，Publisher 居中，Timer/Sub 放最底！
  std::atomic<bool> running_{true};
  std::mutex state_mutex_;
  std::vector<WheelTelemetry> samples_buffer_;
  rclcpp::Publisher<TwistStamped>::SharedPtr cmd_pub_;
  rclcpp::TimerBase::SharedPtr init_once_timer_;
  rclcpp::TimerBase::SharedPtr control_timer_;
};`,
            sourcePath: 'ros2_ws/src/chassis_core/src/cpp_pitfalls_node.cpp',
          },
        ],
      },
      {
        id: 'm8cpp-interview-topics',
        title: '8.3 ROS 2 C++ 专项面试高频考察矩阵（衔接第 9 章真题 Q23–Q28）',
        paragraphs: [
          '在机器人研发（自动驾驶、移动底盘、机械臂控制）岗位面试中，面试官往往先问 ROS 2 通信机制，随后立刻切入底层 C++ 拷问：**“你刚才说同进程零拷贝用 `unique_ptr`，那它的所有权和析构是怎么发生的？”、“Node 析构崩溃怎么查？”、“`ros2_control` 里为什么禁用 `push_back`？”**。',
          '下表汇总了针对 C++ 语言底层与 ROS 2 交叉考察的 6 大核心考点，完整标准答案与追问加分点已收录至下一章 **模块九真题 Q23 – Q28**，建议结合对照演练并配合 `cpp_pitfalls_node.cpp` 上机验证。',
        ],
        table: {
          caption: 'ROS 2 C++ 专项面试核心考察点与题库索引',
          headers: ['高频面试考点', '面试官真实考察意图', '对应真题精讲'],
          rows: [
            [
              'Node 类成员变量声明与析构逆序规则',
              '考察对 C++ 对象析构顺序与多线程回调资源释放时序的工程敏感度',
              '模块九 · Q23',
            ],
            [
              '`std::shared_ptr` 线程安全边界与消息数据竞态',
              '区分“控制块引用计数原子性”与“所指消息对象并发读写安全”',
              '模块九 · Q24',
            ],
            [
              '`weak_from_this()` 与异步 Future 回调防悬垂',
              '考察异步编程下如何防止 Use-After-Free 偶发段错误',
              '模块九 · Q25',
            ],
            [
              '`std::move` 与 `UniquePtr` 零拷贝及 Use-After-Move',
              '考察对右值引用、所有权独占语义及发布后指针置空陷阱的理解',
              '模块九 · Q26',
            ],
            [
              '实时控制环（1kHz）内存管理与无锁优化原则',
              '考察 `reserve()`、内存池、禁用异常/锁竞争与工业实时性经验',
              '模块九 · Q27',
            ],
            [
              '`rclcpp::Time` 时钟源异常与 `std::async` 临时对象陷阱',
              '考察实际排错深度：时间源类型校验与临时 `future` 隐式阻塞问题',
              '模块九 · Q28',
            ],
          ],
        },
        callouts: [
          {
            label: '排查 C++ 内存问题必备编译参数：ASAN + UBSAN',
            text: '面试中被问“如何在线下测试阶段提前抓出隐藏的内存越界、Use-After-Free 和未定义行为”，直接回答在工作空间执行 `colcon build --cmake-args -DCMAKE_BUILD_TYPE=RelWithDebInfo -DCMAKE_CXX_FLAGS="-fsanitize=address,undefined -fno-omit-frame-pointer"`，比单纯靠肉眼看代码更具工程说服力。',
            tone: 'tip',
          },
        ],
      },
    ],
  },
];
