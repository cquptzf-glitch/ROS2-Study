import { ChecklistWeek, InterviewQuestion } from '../types/handbook';

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    id: 1,
    category: '架构与发现',
    difficulty: '高频基础',
    question: 'ROS 2 相比 ROS 1 最大的架构变革是什么？取消 roscore 后节点之间如何完成发现与通信？',
    standardAnswer:
      'ROS 2 摒弃了 ROS 1 的单点中心 Master（roscore），底层引入工业级 DDS（Data Distribution Service）中间件。节点启动后通过 DDS 的 SPDP（简单参与者发现协议）利用 UDP 组播广播自身存在，随后通过 SEDP（简单端点发现协议）交换各自发布的 Topic/Service 端点及 QoS 策略，实现去中心化的 P2P 直连通信。',
    bonusPoints:
      '提及同一主机内默认启用共享内存（SHM）传输绕过网卡协议栈；提及在大规模集群/弱网跨网段场景下，可使用 FastDDS Discovery Server 或 ROS 2 Lyrical Luth (2026 LTS) 重点增强的 rmw_zenoh_cpp 替代组播风暴。',
  },
  {
    id: 2,
    category: '构建系统',
    difficulty: '高频基础',
    question: '在 ament_cmake 中，为什么现代 ROS 2（Jazzy / Lyrical Luth）推荐 target_link_libraries(target PUBLIC rclcpp::rclcpp) 而弃用 ament_target_dependencies？',
    standardAnswer:
      'ament_target_dependencies 是历史遗留宏，会把依赖包的头文件目录、宏定义以非作用域隔离的方式全局注入目标，破坏 CMake 目标传递性（Transitive Dependencies），且在导出 library 目标给下游包时容易引发路径缺失。使用 target_link_libraries 配合 ${msg_pkg_TARGETS} 是纯正现代 CMake 范式，能精准控制 PUBLIC/PRIVATE/INTERFACE 边界。',
    bonusPoints:
      '指出在 CMakeLists.txt 编写自定义消息包时，若同包内 C++ 节点要直接引用本包刚生成的 .msg 头文件，需使用 rosidl_get_typesupport_target(cpp_typesupport_target ${PROJECT_NAME} "rosidl_typesupport_cpp") 并链接它。',
  },
  {
    id: 3,
    category: '客户端与生命周期',
    difficulty: '高频基础',
    question: '为什么在编写 rclcpp 节点时推荐继承 rclcpp::Node 类，而不是用 std::make_shared<rclcpp::Node>() 配合全局变量？',
    standardAnswer:
      '面向对象继承封装符合 RAII 原则：发布者、订阅者、定时器、回调组和线程安全锁都作为类成员变量管理，构造顺序确定且析构时自动按逆序安全释放资源；同时天然兼容 rclcpp_components::register_node_macro 将普通节点零修改编译为动态共享库（.so）加载进同一容器进程。',
    bonusPoints:
      '提醒必须在构造函数中接收 const rclcpp::NodeOptions & options 并透传给基类构造函数，否则无法支持组件化动态传参和 intra_process_comms 开关。',
  },
  {
    id: 4,
    category: 'C++ 生命周期',
    difficulty: '进阶原理',
    question: '请解释 rclcpp::spin(node) 的底层阻塞机制，以及 rclcpp::Node 构造函数中为什么绝对不能调用 shared_from_this()？',
    standardAnswer:
      'rclcpp::spin() 本质上是构造了一个临时的 SingleThreadedExecutor，把 node->get_node_base_interface() 加入后进入 while(rclcpp::ok()) 循环等待 DDS wait_set 就绪并派发回调。在构造函数执行期间，外部的 std::make_shared 尚未完成控制块（control block）的 weak_ptr 绑定，此时调用 shared_from_this() 会直接抛出 std::bad_weak_ptr 异常崩溃。',
    bonusPoints:
      '给出工程解法：将需要用到 shared_from_this() 的逻辑延迟到 init() 方法、一次性 wall_timer 回调，或使用 LifecycleNode 的 on_configure() 中执行。',
  },
  {
    id: 5,
    category: 'QoS 契约',
    difficulty: '高频基础',
    question: '为什么两个 ROS 2 节点 Topic 名称和消息类型完全一致，却收不到任何数据？如何用 QoS RxO 原则排查？',
    standardAnswer:
      '最常见原因是 DDS 的 RxO（Request vs Offered）QoS 不兼容。核心原则是发布方提供的保证（Offered）必须大于等于订阅方请求的保证（Requested）：例如 Publisher 设为 Best Effort 而 Subscriber 设为 Reliable，或 Publisher 为 Volatile 而 Subscriber 要求 Transient Local，均会导致匹配静默失败。',
    bonusPoints:
      '说出排查命令：`ros2 topic info -v /topic_name` 查看两端具体 QoS 配置，并在 C++ 中通过 SubscriptionOptions::event_callbacks.incompatible_qos_callback（或 PublisherEventCallbacks）监听 OFFERED_QOS_INCOMPATIBLE / REQUESTED_QOS_INCOMPATIBLE 事件实时报警；另外别忘了检查 ROS_DOMAIN_ID 与 rmw_implementation 是否一致。',
  },
  {
    id: 6,
    category: '并发与死锁',
    difficulty: '架构排错',
    question: '在定时器回调内同步等待 Service 响应（future.get()），为什么换成 MultiThreadedExecutor 之后依然发生死锁？',
    standardAnswer:
      '因为 rclcpp::Node 中所有未显式指定回调组的 Timer、Subscription 和 Client 都默认归属同一个 MutuallyExclusive（互斥）回调组。当 Thread 1 在定时器回调里阻塞于 future.get() 时，该互斥组的锁并未释放，即使 MultiThreadedExecutor 还有空闲的 Thread 2，也无法进入同一互斥组去执行 Service 响应回调，造成死锁。',
    bonusPoints:
      '给出两种标准解法：1）创建两个独立的 MutuallyExclusive 回调组分别绑定 Timer 和 Client（推荐，保留各自串行安全性）；2）将相关接口放入 CallbackGroupType::Reentrant 组；更彻底的架构解法是不在回调里调用阻塞 future.get()，改用 async_send_request(req, callback) 全异步回调。',
  },
  {
    id: 7,
    category: '内存与零拷贝',
    difficulty: '进阶原理',
    question: 'ROS 2 C++ 实现同进程零拷贝（Zero-Copy）必须同时满足哪些严苛条件？',
    standardAnswer:
      '1）发布端和订阅端节点必须运行在同一个进程容器（ComponentContainer）内；2）双方构造 NodeOptions 时必须开启 use_intra_process_comms(true)；3）发布端必须构造 std::unique_ptr<Msg> 并通过 pub->publish(std::move(msg)) 移交所有权；4）如果是多订阅者广播，rclcpp 会退化为 shared_ptr 引用传递或拷贝（视订阅签名而定），仅单订阅者 + UniquePtr 签名能做到彻底零拷贝且可原地修改。',
    bonusPoints:
      '补充真正的“跨进程”零拷贝方案：FastDDS / CycloneDDS 配合 Iceoryx（Shared Memory Loaned Messages），C++ 端使用 pub->borrow_loaned_message() 直接在共享内存池写入，连跨进程也不用拷贝。',
  },
  {
    id: 8,
    category: '通信选型',
    difficulty: '高频基础',
    question: 'Topic、Service 与 Action 在底层实现与工程适用场景上有何本质区别？',
    standardAnswer:
      'Topic 是基于发布-订阅的异步单向流，适合传感器高频数据与底盘状态；Service 是阻塞/非阻塞的请求-响应短事务（底层由 Request Topic + Response Topic 构成），适合开关激光、查参数等瞬时操作；Action 是面向长耗时、可抢占（Cancel）并持续反馈进度（Feedback）的任务模型，底层由 3 个 Service（SendGoal/CancelGoal/GetResult）和 2 个 Topic（Feedback/Status）组合而成。',
    bonusPoints:
      '强调 Action Server 的 handle_accepted 回调内绝不能直接死循环跑任务，必须开辟独立工作线程或异步状态机执行 execute，否则会卡死整个 Executor。',
  },
  {
    id: 9,
    category: 'Lifecycle 状态机',
    difficulty: '进阶原理',
    question: '工业级传感器驱动与 Nav2 为什么普遍采用 LifecycleNode 而不是普通 Node？LifecyclePublisher 有什么特殊行为？',
    standardAnswer:
      '普通节点一启动就激活硬件和发布数据，多模块间容易产生依赖时序竞态或未校准前误发控制帧。LifecycleNode 强制划分 Unconfigured / Inactive / Active / Finalized 确定性状态，只有外部 lifecycle_manager 确认配置就绪后才会触发 on_activate() 使能输出。LifecyclePublisher 在 Inactive 状态下即使代码调用 publish()，底层也会安全拦截丢弃而不发往 DDS。',
    bonusPoints:
      '指出把 LifecycleNode 加入 Executor 时需传入 node->get_node_base_interface()；且可利用 on_deactivate -> on_activate 实现无需重启进程的轻量级急停与热恢复。',
  },
  {
    id: 10,
    category: '坐标系 TF2',
    difficulty: '高频基础',
    question: 'ROS 2 中 map -> odom -> base_link 这条经典变换链，分别由谁发布？为什么不直接发布 map -> base_link？',
    standardAnswer:
      'odom -> base_link 由轮式里程计或 VIO/LIO 连续平滑高频发布（允许随时间产生累积漂移，但局部绝对连续，供局部避障控制使用）；map -> odom 由 AMCL、Cartographer 或 SLAM 节点低频计算全局闭环修正后发布（可能发生离散跳变）。分开两层既保证了全局精度，又避免闭环跳变直接冲击底层局部控制器引起车体剧烈抖动。',
    bonusPoints:
      '解释 TF2 树严格要求单父节点有向无环图（DAG），若两个节点同时发布了同一个 child_frame 会导致 TF 树闪烁撕裂。',
  },
  {
    id: 11,
    category: 'TF2 排错',
    difficulty: '架构排错',
    question: 'C++ 中调用 tf_buffer->transform() 频繁抛出 ExtrapolationException 如何排查与根治？',
    standardAnswer:
      '原因通常是查询时刻的时间戳超出了 TF Buffer 当前缓存的时间窗口（常见为消息头时间比最新到达的 odom->base_link 变换超前了几十毫秒，或系统未统一开启 use_sim_time 导致墙钟与仿真时钟混用）。排查先看两边 header.stamp 差值与 ros2 run tf2_tools view_frames。',
    bonusPoints:
      '代码根治：1）为 transform() 传入容忍等待超时参数 tf2::durationFromSec(0.05) 配合异步 MessageFilter（tf2_ros::MessageFilter）；2）非严格时间对齐场景传入 tf2::TimePointZero 获取最新可用变换。',
  },
  {
    id: 12,
    category: '硬件控制架构',
    difficulty: '进阶原理',
    question: '简述 ros2_control 的核心架构，编写 C++ SystemInterface 硬件插件时在 read() / write() 中有哪些实时性禁忌？',
    standardAnswer:
      'ros2_control 由 ResourceManager、ControllerManager、各类 Controller（如 DiffDriveController）以及基于 pluginlib 动态加载的 HardwareInterface 组成。ControllerManager 在固定周期内依次调用硬件的 read() -> 控制器 update() -> 硬件 write()。',
    bonusPoints:
      '实时性铁律：read()/write() 运行在高频实时控制环内，严禁动态内存分配（new/malloc/std::vector::push_back 扩容）、严禁磁盘 I/O 与打印海量 RCLCPP_INFO 日志、严禁同步阻塞锁或直接睡眠，所有 CAN/串口收发应通过无锁环形缓冲区（Lock-free RingBuffer）与异步 I/O 线程解耦。',
  },
  {
    id: 13,
    category: '参数系统',
    difficulty: '高频基础',
    question: 'ROS 2 的参数机制与 ROS 1 有何区别？如何在 C++ 中实现参数动态热更新校验？',
    standardAnswer:
      'ROS 2 取消了全局集中式 Parameter Server，参数强绑定于各个节点自身（通过节点内置的参数 Service 读写）。在 C++ 中需先调用 declare_parameter() 声明参数与默认值，再通过 add_on_set_parameters_callback() 注册回调，在回调中校验新值合法性并返回 SetParametersResult(successful=false) 拦截非法修改。',
    bonusPoints:
      '提示踩坑点：在参数回调函数体内部绝对不能再调用 this->set_parameter() 修改其他参数，否则会造成递归重入甚至死锁。',
  },
  {
    id: 14,
    category: '导航规划 Nav2',
    difficulty: '架构排错',
    question: '实际调试 Nav2 时，小车在狭窄通道出现原地左右震荡或频繁触发 Rotate Recovery 怎么排查调优？',
    standardAnswer:
      '重点排查三处：1）local_costmap 的 inflation_radius 与 cost_scaling_factor 是否过大，导致通道残余可通行代价过高；2）RegulatedPurePursuit 或 MPPI 控制器的 lookahead_dist、rotate_to_heading_min_angle 阈值与底盘实际加减速能力不匹配；3）里程计/雷达时间戳延迟或轮距参数不准导致定位抖动。',
    bonusPoints:
      '结合 PlotJuggler 同步对比 /cmd_vel 与 /odom 实际角速度响应相位滞后，以及利用 RViz2 观察局部代价地图膨胀梯度。',
  },
  {
    id: 15,
    category: 'DDS 与网络',
    difficulty: '进阶原理',
    question: '多台机器人在同一车间 Wi-Fi 下运行 ROS 2，为什么会出现严重的通信卡顿与数据串台？如何工程治理？',
    standardAnswer:
      'DDS 默认采用 UDP 组播进行节点发现（SPDP），在 Wi-Fi 环境下组播包会以最低速率广播并迅速挤占信道（发现风暴），同时默认 ROS_DOMAIN_ID=0 会导致所有机器人的相同 Topic 互相串台订阅。',
    bonusPoints:
      '治理四步：1）为每台车分配隔离的 ROS_DOMAIN_ID 或启用 ROS_LOCALHOST_ONLY / ROS_AUTOMATIC_DISCOVERY_RANGE=LOCALHOST；2）车端内部节点通过 XML 配置仅走 SHM 或本地回环；3）车与调度中心跨机通信采用 FastDDS Discovery Server（单播）或 rmw_zenoh_cpp 路由网关；4）对图像/点云话题调大内核 rmem_max 缓冲。',
  },
  {
    id: 16,
    category: '时间同步',
    difficulty: '高频基础',
    question: '什么是 use_sim_time？C++ 中为什么获取时间强烈建议用 this->now() 而非 std::chrono::system_clock？',
    standardAnswer:
      '当 use_sim_time 设为 true 时，节点会订阅仿真器（如 Modern Gazebo）发布的 /clock 话题作为虚拟时钟源，使整个系统的算法周期、TF 时间戳与仿真倍速（如 0.5x 慢放或 2x 加速）严格对齐。使用 std::chrono::system_clock 会直接读取宿主机物理墙钟，导致在回放 rosbag2 或加速仿真时时间戳完全错乱。',
    bonusPoints:
      '指出 RCLCPP_INFO_THROTTLE 必须传入 *this->get_clock() 才能受仿真时钟控制；且面试常考：this->create_wall_timer() 始终绑定物理单调墙钟，若需要定时器随 Gazebo /clock 暂停或倍速变化，必须改用 rclcpp::create_timer(this, this->get_clock(), period, cb)。',
  },
  {
    id: 17,
    category: '现代 C++ 内存',
    difficulty: '进阶原理',
    question: 'ROS 2 消息回调常见三种参数签名：ConstSharedPtr、SharedPtr 与 UniquePtr，它们在性能与安全上有何差异？',
    standardAnswer:
      'ConstSharedPtr（const std::shared_ptr<const Msg>）是默认推荐写法，多订阅者共享同一份只读内存、零拷贝且线程安全；SharedPtr 会迫使 rclcpp 在多订阅者或内部拷贝路径上额外克隆消息以确保可修改性；UniquePtr（std::unique_ptr<Msg>）允许订阅回调直接独占接管消息所有权并原地修改字段，是开启同进程零拷贝时的最佳签名。',
    bonusPoints:
      '在 C++17 中结合 rclcpp::Publisher::publish(std::unique_ptr<Msg>) 实现所有权零开销转移。',
  },
  {
    id: 18,
    category: '仿真与调试',
    difficulty: '高频基础',
    question: 'Modern Gazebo（gz-sim）与 ROS 2 之间如何通信？如何用 rosbag2 进行高频点云无丢帧录制？',
    standardAnswer:
      'gz-sim 使用自研 gz-transport 中间件，通过 ros_gz_bridge 进程按 YAML 映射表完成 gz.msgs 到 ROS 2 msg 的双向零额外编排桥接。录制高频大流量 rosbag2 时，默认 SQLite3 存储插件容易 I/O 阻塞丢帧，应切换为 MCAP 存储后端（--storage mcap）并适当调大 --max-cache-size。',
    bonusPoints:
      'MCAP 是现代机器人领域事实标准，Foxglove Studio 可直接秒开 10GB+ 的 MCAP 日志回放分析。',
  },
  {
    id: 19,
    category: '环境与部署',
    difficulty: '架构排错',
    question: '在 Windows 11 WSL 2 下用 VS Code 开发 ROS 2，如何配置环境？遇到跨机通信找不到话题或 Gazebo 黑屏闪退怎么定位？',
    standardAnswer:
      'VS Code 必须安装 Remote-WSL 扩展并在 WSL 终端通过 code . 拉起 Linux 端服务（禁用 Windows C/C++ IntelliSense 并配置 clangd 读取 build/compile_commands.json）。跨机找不到话题是因为 WSL 2 默认 NAT 虚拟网卡隔离了局域网 UDP 组播，需在 .wslconfig 开启 networkingMode=mirrored 镜像网络；Gazebo 黑屏通常是 WSLg D3D12 OpenGL 加速异常或退化为 llvmpipe 软渲染，需用 glxinfo -B 验证渲染器并尝试设置 GZ_SIM_RENDER_ENGINE_GUI=ogre2。',
    bonusPoints:
      '外设（雷达/串口/CAN）无法识别则使用宿主机 usbipd-win attach 透传并在 WSL 内加入 dialout 组；F5 GDB 调试需在 launch.json 中配置 AMENT_PREFIX_PATH 与 ROS_DOMAIN_ID。',
  },
  {
    id: 20,
    category: '排错实战',
    difficulty: '架构排错',
    question: '线上 C++ ROS 2 节点偶发 SIGSEGV 段错误，但 Release 环境无 core dump 如何快速定位？',
    standardAnswer:
      '首先用 -DCMAKE_BUILD_TYPE=RelWithDebInfo 重新编译保留调试符号且维持性能，同时开启 ulimit -c unlimited 收集 core dump 用 gdb 还原堆栈；针对隐蔽的野指针、悬垂引用（如 lambda 捕获了已销毁的局部指针）和容器越界，使用 -fsanitize=address 编译跑回归测试直接精准抓现行。',
    bonusPoints:
      '提醒 ROS 2 异步回调中 lambda 捕获 [this] 的生命周期陷阱：若节点析构前未先 cancel/reset 定时器或未停止 Executor，后台回调触发访问已析构的 this 成员就会导致偶发段错误。',
  },
  {
    id: 21,
    category: 'Qt + ROS 2 专项',
    difficulty: '架构排错',
    question: '【Qt 上位机高频坑】为什么在 ROS 2 订阅回调中直接调用 Qt 控件的 progressBar->setValue() 或 label->setText() 会导致界面偶发闪烁甚至段错误（SIGSEGV）？',
    standardAnswer:
      'Qt 的 GUI 模块（QWidget 及其底层绘制引擎）不是线程安全的，Qt 强规定所有对 UI 控件的读写与重绘必须在运行 QApplication::exec() 的主线程（GUI 线程）中进行。而 ROS 2 的订阅回调执行在后台 std::thread 的 Executor 线程中，跨线程直接操作 QWidget 内部指针、触发重绘事件或修改共享模型会造成内存竞态与 QBackingStore 崩溃。',
    bonusPoints:
      '标准解法：在 ROS 2 回调中仅拷贝轻量级值类型（如 int pct 或 QString），使用 QMetaObject::invokeMethod(this, [this, pct]() { ... }, Qt::QueuedConnection) 或发射 Qt 跨线程 Signal（自动转为 QueuedConnection）将刷新任务安全投递到主线程事件循环中执行。',
  },
  {
    id: 22,
    category: 'Qt + ROS 2 专项',
    difficulty: '架构排错',
    question: '【Qt 上位机高频坑】Qt 上位机点击右上角关闭按钮后，为什么进程在后台僵尸化不退出，或在析构阶段直接崩溃（pure virtual method called / terminate）？',
    standardAnswer:
      '两大原因：1）忘记在窗口关闭时终止后台 ROS 线程。QApplication::exec() 退出后，后台 std::thread 里的 executor->spin() 仍在死等条件变量，若未调用 executor->cancel() 与 rclcpp::shutdown()，进程会挂死或触发 std::thread 析构未 join() 的 std::terminate()；2）关闭顺序颠倒：Qt 先析构了 MainWindow 里的控件成员变量（如 battery_bar_），而此时后台 ROS 回调刚好投递或正在执行 lambda 访问 this 指针，引发野指针崩溃。',
    bonusPoints:
      '正确优雅退出时序：在 MainWindow::closeEvent（以及析构函数兜底）中，第一优先级调用 executor_->cancel() 和 rclcpp::shutdown()，紧接着阻塞等待 ros_thread_.join() 确认后台线程彻底回收后，再允许 QWidget 控件销毁。',
  },
  {
    id: 23,
    category: 'ROS 2 C++ 内存与析构',
    difficulty: '架构排错',
    question: '在继承 rclcpp::Node 的 C++ 类中，为什么成员变量声明顺序把 timer_ 和 subscription_ 放在 state_mutex_ 与 publisher_ 之前会引发析构期偶发崩溃？',
    standardAnswer:
      'C++ 类析构严格按照成员变量声明顺序的“逆序”执行。如果把 timer_ 或 subscription_ 写在类顶部，把 state_mutex_、共享数据结构和 publisher_ 写在底部，在节点析构时会先销毁互斥锁、缓存和发布器；而在 timer_ 析构停止之前的微秒级时间窗内，后台 Executor 线程仍可能触发回调并去锁已经销毁的 mutex_ 或调用已释放的 pub_，引发 Use-After-Free 段错误。',
    bonusPoints:
      '工程规范铁律：类成员按“1. 原子标志/互斥锁/业务状态数据 → 2. Publisher/Client → 3. Subscription/Timer（最底部）”顺序声明，确保析构时第一时间停掉所有回调入口，再释放底层数据与锁；并在自定义析构函数首行显式调用 timer->cancel()。',
  },
  {
    id: 24,
    category: 'ROS 2 C++ 并发安全',
    difficulty: '进阶原理',
    question: 'ROS 2 回调中广泛传递 std::shared_ptr<Msg>，有人说“shared_ptr 是线程安全的”，在 MultiThreadedExecutor 下直接修改收到的 Msg 字段安全吗？',
    standardAnswer:
      '不安全！这是一个经典的 C++ 认知误区。std::shared_ptr 仅保证其内部控制块（引用计数的增减）是原子线程安全的，但绝不保证它所指向的 Msg 载荷内存的并发读写安全。当同进程有多个订阅回调或多线程同时访问同一份 SharedPtr 所指消息时，任意一方修改消息字段都会造成数据竞态（Data Race）和未定义行为。',
    bonusPoints:
      '结合 rclcpp 最佳实践回答：普通多订阅场景一律使用 ConstSharedPtr（const std::shared_ptr<const Msg>）从编译期禁止修改；如果算法节点确实需要在流水线中原地修改消息（如点云滤波就地裁剪），应使用 UniquePtr（std::unique_ptr<Msg>）签名独占所有权。',
  },
  {
    id: 25,
    category: 'ROS 2 C++ 生命周期',
    difficulty: '进阶原理',
    question: '在 rclcpp 异步请求回调（async_send_request）或自建后台 std::thread 中捕获 [this] 为什么危险？如何用 std::weak_ptr 安全改写？',
    standardAnswer:
      'Lambda 捕获 [this] 只是按值复制了一个裸指针，并不会增加节点控制块的强引用计数。当外部容器卸载组件或程序退出销毁 Node 对象后，异步响应队列或延迟线程里残留的回调仍可能被唤醒，此时访问 this->get_logger() 或成员变量就是典型的悬垂指针崩溃。',
    bonusPoints:
      '标准解法：利用 rclcpp::Node 自带的 std::enable_shared_from_this 能力，在构造完成后的 init()/timer 中调用 weak_from_this() 获取 std::weak_ptr，Lambda 仅捕获 [weak_self]；回调内部第一行执行 if (auto self = weak_self.lock(); self) 升级为强指针使用，若节点已销毁则 lock() 返回 nullptr 安全退出。',
  },
  {
    id: 26,
    category: '现代 C++ 移动语义',
    difficulty: '高频基础',
    question: '调用 pub->publish(std::move(unique_msg)) 实现同进程零拷贝后，如果下一行继续读取 unique_msg->header.stamp 会发生什么？std::move 到底干了什么？',
    standardAnswer:
      '会直接发生空指针解引用导致进程段错误（SIGSEGV）崩溃。std::move 本身不移动任何内存，它只是在编译期将左值强制转换为右值引用（static_cast<T&&>），触发 std::unique_ptr 的移动构造函数：把堆内存地址指针移交给 rclcpp 内部队列，同时将原局部变量 unique_msg 内部的裸指针强制置为 nullptr。',
    bonusPoints:
      '工程习惯：若必须在 publish 后打印日志或记录统计指标（如帧率、速度值），务必在 std::move(msg) 之前提前将轻量标量拷贝到栈上局部变量，move 之后严禁再以任何形式解引用原 unique_ptr。',
  },
  {
    id: 27,
    category: 'C++ 实时性与性能优化',
    difficulty: '架构排错',
    question: '在 ros2_control 1kHz 高频控制环或激光点云处理热路径中，有哪些必须遵守的 C++ 内存与容器优化规则？',
    standardAnswer:
      '1）启动期通过 std::vector::reserve() 或固定长度 std::array 预分配全部缓冲区，严禁在 1kHz 循环里触发动态扩容（malloc/free 锁竞争会导致微秒级抖动）；2）尽量传递 const 引用、std::string_view 和 std::span 避免临时 string/vector 堆拷贝；3）避免在热路径中高频抛出/捕获 C++ 异常或滥用 dynamic_cast RTTI。',
    bonusPoints:
      '提及多把锁同时加锁使用 C++17 std::scoped_lock(m1, m2) 避免交叉加锁死锁；与硬件串口/CAN 线程通信时优先使用无锁单生产者单消费者环形缓冲区（Lock-free SPSC RingBuffer）替代互斥锁。',
  },
  {
    id: 28,
    category: 'ROS 2 C++ 排坑实战',
    difficulty: '架构排错',
    question: 'C++ 开发中遇到 “can\'t subtract times with different time sources” 异常，以及使用 std::async 时发现异步任务变成了串行阻塞，分别是什么原因？',
    standardAnswer:
      '第一个问题是因为混用了不同时钟源的 rclcpp::Time：例如用启用了 use_sim_time 的节点时钟 this->now()（类型 RCL_ROS_TIME）去减去默认构造的 rclcpp::Time(msg->header.stamp)（未传时钟类型时默认为 RCL_SYSTEM_TIME）或 SteadyClock。第二个问题是因为 std::async 返回的 std::future 对象如果在语句末被当作临时匿名对象立即析构，C++ 标准规定由 std::async 创建的共享状态最后一个 future 析构时必须阻塞等待后台任务执行完毕！',
    bonusPoints:
      '分别给出根治写法：1）从消息头构造时间务必显式传入节点时钟类型 rclcpp::Time(msg->header.stamp, this->get_clock()->get_clock_type())；2）不要丢弃 std::async 返回的 future，应存入成员队列或改用 ROS 2 回调组/线程池任务队列。',
  },
];

export const EIGHT_WEEK_CHECKLIST: ChecklistWeek[] = [
  {
    week: 1,
    title: '第 1 周：环境基建与分布式架构破冰',
    goal: '完成 Windows 11 + WSL 2（或原生 Ubuntu）工程环境搭建，跑通 clangd 代码跳转与镜像网络组播发现。',
    tasks: [
      { id: 'w1-1', text: '配置 .wslconfig（mirrored 网络）与 ROS_DOMAIN_ID，验证 glxinfo 硬件加速', deliverable: '双端 ros2 topic list 互通' },
      { id: 'w1-2', text: '配置 ~/.colcon/defaults.yaml 全局导出 compile_commands.json 与 VS Code clangd', deliverable: 'rclcpp 源码零报错毫秒级跳转' },
      { id: 'w1-3', text: '掌握 ros2 node / topic / service / param / doctor 常用 CLI 调试命令', deliverable: '独立排查一次话题通信不通问题' },
    ],
  },
  {
    week: 2,
    title: '第 2 周：现代 CMake 与核心通信 C++ 编程',
    goal: '彻底抛弃旧式写法，能独立从零创建接口包与基于 rclcpp::Node 的 C++17 业务节点。',
    tasks: [
      { id: 'w2-1', text: '独立创建包含 .msg / .srv / .action 的自定义接口包并成功编译导出头文件', deliverable: 'ros2 interface show 正常输出' },
      { id: 'w2-2', text: '用 target_link_libraries(target PUBLIC rclcpp::rclcpp ...) 编写 CMakeLists.txt', deliverable: '零 warning 编译通过' },
      { id: 'w2-3', text: '手写继承 rclcpp::Node 的节点，集成 Topic、Service、Action 三回调与动态参数校验', deliverable: '实现带撤回功能的充电桩 ActionDemo' },
    ],
  },
  {
    week: 3,
    title: '第 3 周：QoS 契约、Launch 编排与 YAML 工程化',
    goal: '掌握多机命名空间隔离、话题重映射与系统级 Python Launch 编排规范。',
    tasks: [
      { id: 'w3-1', text: '复现 Best Effort vs Reliable / Transient Local 的 QoS 不匹配现象并捕获事件', deliverable: '完成 QoS 兼容性验证记录' },
      { id: 'w3-2', text: '编写支持 LaunchArgument、PushRosNamespace 与 Remapping 的 .launch.py', deliverable: '一键拉起双车隔离命名空间节点' },
      { id: 'w3-3', text: '使用 /** 通配符编写 ros__parameters YAML 文件并注入节点动态参数', deliverable: 'Launch 启动自动覆盖默认参数' },
    ],
  },
  {
    week: 4,
    title: '第 4 周：高并发执行器、零拷贝与 Lifecycle 进阶',
    goal: '攻克企业级高性能与高可靠性核心架构，能手撕并发死锁与组件化零拷贝代码。',
    tasks: [
      { id: 'w4-1', text: '使用双 MutuallyExclusive 回调组 + MultiThreadedExecutor 解除定时器调服务死锁', deliverable: '高并发压测 10 分钟无死锁' },
      { id: 'w4-2', text: '编写 rclcpp_components 共享库并用 std::unique_ptr 验证同进程指针地址零拷贝传递', deliverable: '打印收发两端指针地址完全一致' },
      { id: 'w4-3', text: '手写 LifecycleNode（on_configure/activate/deactivate/cleanup）并编写 FastDDS XML', deliverable: '使用 ros2 lifecycle set 控制状态转换' },
    ],
  },
  {
    week: 5,
    title: '第 5 周：URDF 建模、TF2 与 ros2_control C++ 插件',
    goal: '打通机器人几何描述、时空坐标同步与底层实时控制硬件抽象接口。',
    tasks: [
      { id: 'w5-1', text: '用 Xacro 构建差速小车 URDF，含惯性张量、碰撞体与 <ros2_control> 插件标签', deliverable: 'RViz2 与 joint_state_publisher_gui 正常显示' },
      { id: 'w5-2', text: '编写 StaticTransformBroadcaster 与带超时/异常捕获的 tf2_ros::Buffer 查询代码', deliverable: '彻底解决 ExtrapolationException' },
      { id: 'w5-3', text: '基于 pluginlib 实现继承 SystemInterface 的 C++ 硬件插件并加载 diff_drive_controller', deliverable: '/cmd_vel 下发后正确输出 /odom' },
    ],
  },
  {
    week: 6,
    title: '第 6 周：Modern Gazebo 仿真与 Nav2 / MoveIt 2 集成',
    goal: '具备搭建完整物理仿真闭环与二次开发主流导航/规划框架的实战能力。',
    tasks: [
      { id: 'w6-1', text: '配置 gz-sim 与 ros_gz_bridge YAML（含 /clock），在纯新版 Gazebo 中跑通遥控建图', deliverable: 'SLAM Toolbox 成功保存栅格地图' },
      { id: 'w6-2', text: '完成 Nav2 代价地图与 RPP 控制器调优，并编写一个自定义 BehaviorTree.CPP C++ 节点', deliverable: '仿真自主避障导航至目标点' },
      { id: 'w6-3', text: '熟悉 MoveIt 2 MoveGroupInterface C++ API 与独立 spin 线程模式', deliverable: '代码驱动机械臂完成两点轨迹规划' },
    ],
  },
  {
    week: 7,
    title: '第 7 周：Qt + ROS 2 上位机与生产级排错发布',
    goal: '掌握 C++ Qt 跨线程上位机开发规范，并建立 ASAN、Foxglove 与多阶段 Docker 发布能力。',
    tasks: [
      { id: 'w7-1', text: '开启 CMAKE_AUTOMOC 编译 Qt + ROS 2 双线程应用，用 Qt::QueuedConnection 安全更新 UI', deliverable: '高频订阅刷新零闪烁、关闭零崩溃' },
      { id: 'w7-2', text: '演练 ASAN (-fsanitize=address) 抓野指针、PlotJuggler 调曲线与 MCAP 录包', deliverable: '输出一份完整性能与内存分析报告' },
      { id: 'w7-3', text: '编写多阶段构建 Dockerfile 将编译产物打包为精简运行时镜像', deliverable: '容器内一键拉起全套导航栈' },
    ],
  },
  {
    week: 8,
    title: '第 8 周：28 道真题模拟面试与简历项目包装',
    goal: '完成全栈知识体系串联，独立演练 28 道企业高频真题（含 C++ 底层专项）并梳理可量化的工程亮点。',
    tasks: [
      { id: 'w8-1', text: '不看答案独立口述全部 28 道面试题核心原理与加分追问点', deliverable: '自测答对率 >= 90%' },
      { id: 'w8-2', text: '将前 7 周的底盘控制、零拷贝组件、Lifecycle 与 Qt 上位机整理为一个 GitHub 作品集', deliverable: '含完整 README、架构图与演示录屏' },
      { id: 'w8-3', text: '导出本指南 PDF 错题与核心配置备忘录，完成全真模拟面试复盘', deliverable: '具备 ROS 2 C++ 研发工程师上岗能力' },
    ],
  },
];
