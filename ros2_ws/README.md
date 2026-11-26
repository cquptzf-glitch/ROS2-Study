# ROS 2 C++17 企业级实战工程工作空间 (`ros2_ws`)

本目录存放《C++ 开发者速通 ROS 2 研发工程师》教程配套的**完整可编译、可运行工程源码**，适用于 **ROS 2 Humble (Ubuntu 22.04)**、**Jazzy (Ubuntu 24.04)** 与 **Lyrical Luth (Ubuntu 26.04 LTS)**。

## 目录结构

- `src/chassis_interfaces`：独立接口功能包（`.msg` / `.srv` / `.action`）
- `src/chassis_core`：核心 C++17 业务节点（入门 `minimal_pubsub_node`、四合一 `chassis_manager_node`、多传感器时间同步 `sensor_sync_node`、现代 C++ 防坑示范 `cpp_pitfalls_node`、异步客户端、回调组防死锁、`LifecycleNode`、TF2）、GTest 单元测试与 Launch/YAML
- `src/system_bringup`：跨包嵌套总控 Launch、FastDDS XML 调优配置、Systemd 自启服务模板
- `src/zero_copy_pipeline`：`rclcpp_components` 动态库组件与 `std::unique_ptr` 同进程零拷贝管道
- `src/robot_description`：差速移动机器人 URDF/Xacro 模型（含 `<ros2_control>` 硬件声明与 `display.launch.py` RViz2 可视化）
- `src/diff_hw_interface`：基于 `pluginlib` 的 `ros2_control` `SystemInterface` C++ 实时硬件插件与 `diff_control.launch.py` 控制器加载入口
- `src/sim_bringup`：Modern Gazebo (`gz-sim`) + `ros_gz_bridge` 与 Nav2 调优配置
- `src/nav2_custom_bt`：Nav2 自定义 `BehaviorTree.CPP` C++ 条件插件节点
- `src/arm_planner`：MoveIt 2 `MoveGroupInterface` C++ 机械臂位姿规划示例
- `src/robot_hmi`：Qt5/Qt6 + ROS 2 双线程跨线程安全上位机工程
- `.vscode/`：Windows VS Code Remote-WSL 2 开发配置（clangd 索引、`colcon` 一键编译任务与 F5 GDB 调试）
- `Dockerfile`：多阶段构建生产级容器镜像配置

## 快速编译与运行

```bash
# 1. 加载底层 ROS 2 Underlay 环境（以 jazzy 为例，可替换为 humble 或 lyrical）
source /opt/ros/${ROS_DISTRO}/setup.bash

# 2. 在 ros2_ws 根目录安装所有系统依赖
cd ros2_ws
sudo rosdep init || true
rosdep update
rosdep install --from-paths src --ignore-src -r -y

# 3. 编译工作空间并导出 compile_commands.json
colcon build --symlink-install --cmake-args -DCMAKE_BUILD_TYPE=RelWithDebInfo -DCMAKE_EXPORT_COMPILE_COMMANDS=ON

# 4. 激活当前工作空间 Overlay
source install/setup.bash

# 5. 运行核心示例与单元测试
ros2 run chassis_core minimal_pubsub_node
ros2 run chassis_core sensor_sync_node
ros2 launch chassis_core robot_bringup.launch.py robot_ns:=amr_01
ros2 launch robot_description display.launch.py
ros2 launch diff_hw_interface diff_control.launch.py

# 6. 运行 C++ GTest 单元测试并查看详细输出
colcon test --packages-select chassis_core --event-handlers console_direct+
colcon test-result --verbose
```
