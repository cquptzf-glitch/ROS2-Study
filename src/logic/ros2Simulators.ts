export type QosReliability = 'reliable' | 'best_effort';
export type QosDurability = 'volatile' | 'transient_local';

export interface QosProfile {
  reliability: QosReliability;
  durability: QosDurability;
}

export interface QosCompatibilityResult {
  compatible: boolean;
  reliabilityMatch: boolean;
  durabilityMatch: boolean;
  reason: string;
}

/**
 * Evaluates ROS 2 / DDS RxO (Request vs Offered) QoS compatibility.
 * Rule: Offered (Publisher) must be >= Requested (Subscriber).
 */
export function evaluateQosCompatibility(
  pub: QosProfile,
  sub: QosProfile
): QosCompatibilityResult {
  const reliabilityMatch = !(pub.reliability === 'best_effort' && sub.reliability === 'reliable');
  const durabilityMatch = !(pub.durability === 'volatile' && sub.durability === 'transient_local');
  const compatible = reliabilityMatch && durabilityMatch;

  const issues: string[] = [];
  if (!reliabilityMatch) {
    issues.push('Reliability 不兼容：Publisher 为 Best Effort，无法满足 Subscriber 的 Reliable（必达重传）契约');
  }
  if (!durabilityMatch) {
    issues.push('Durability 不兼容：Publisher 为 Volatile，无法向后加入的 Transient Local Subscriber 提供历史缓存');
  }

  return {
    compatible,
    reliabilityMatch,
    durabilityMatch,
    reason: compatible
      ? 'QoS 契约匹配（Offered >= Requested），DDS 匹配成功，通信正常建立。'
      : issues.join('；'),
  };
}

export type TransportMode = 'inter_process' | 'intra_process_unique_ptr';

export interface ZeroCopyMetrics {
  mode: TransportMode;
  payloadSizeMb: number;
  copiesCount: number;
  totalBandwidthMb: number;
  estimatedLatencyUs: number;
  sameProcessRequired: boolean;
  summary: string;
}

export function calculateZeroCopyMetrics(
  mode: TransportMode,
  payloadSizeMb = 6.2
): ZeroCopyMetrics {
  if (mode === 'intra_process_unique_ptr') {
    return {
      mode,
      payloadSizeMb,
      copiesCount: 0,
      totalBandwidthMb: 0,
      estimatedLatencyUs: 1.8,
      sameProcessRequired: true,
      summary: '同进程 ComposableNode 容器内直接移交 std::unique_ptr<Msg> 所有权，零序列化与零内存拷贝（仅传递 8 字节指针）。',
    };
  }
  return {
    mode,
    payloadSizeMb,
    copiesCount: 4,
    totalBandwidthMb: Number((payloadSizeMb * 4).toFixed(1)),
    estimatedLatencyUs: Math.round(payloadSizeMb * 1450),
    sameProcessRequired: false,
    summary: '跨进程通信历经用户态序列化 -> DDS 共享内存/Socket -> 内核/中间件缓冲 -> 订阅端反序列化，高分辨率点云/图像将引发显著 CPU 与内存带宽开销。',
  };
}

export type ExecutorMode =
  | 'single_mutually_exclusive'
  | 'multi_mutually_exclusive'
  | 'multi_reentrant'
  | 'multi_dual_groups';

export interface DeadlockStep {
  step: number;
  title: string;
  thread1State: 'idle' | 'running_timer' | 'blocked_future' | 'completed';
  thread2State: 'none' | 'idle' | 'blocked_mutex' | 'running_response' | 'completed';
  groupLocked: boolean;
  isDeadlocked: boolean;
  description: string;
}

export function getDeadlockTrace(mode: ExecutorMode): DeadlockStep[] {
  if (mode === 'single_mutually_exclusive') {
    return [
      {
        step: 1,
        title: '1. 定时器回调触发',
        thread1State: 'running_timer',
        thread2State: 'none',
        groupLocked: true,
        isDeadlocked: false,
        description: 'SingleThreadedExecutor 唯一线程进入 timer_callback()，准备同步请求计算服务。',
      },
      {
        step: 2,
        title: '2. 发起 Service 请求并同步阻塞',
        thread1State: 'blocked_future',
        thread2State: 'none',
        groupLocked: true,
        isDeadlocked: false,
        description: '调用 client->async_send_request(req) 后立即执行 future.get()（或 wait_for），唯一线程被挂起等待结果。',
      },
      {
        step: 3,
        title: '3. 服务端返回响应但无法调度 -> 死锁',
        thread1State: 'blocked_future',
        thread2State: 'none',
        groupLocked: true,
        isDeadlocked: true,
        description: 'Service 响应数据已到达 rclcpp 队列，但处理响应回调需要 Executor 线程；唯一线程仍在 timer_callback 中死等 future.get()，永久死锁！',
      },
    ];
  }

  if (mode === 'multi_mutually_exclusive') {
    return [
      {
        step: 1,
        title: '1. Thread 1 执行定时器并持有组锁',
        thread1State: 'running_timer',
        thread2State: 'idle',
        groupLocked: true,
        isDeadlocked: false,
        description: 'MultiThreadedExecutor 分配 Thread 1 执行 timer_callback()，默认 MutuallyExclusive 回调组加锁。',
      },
      {
        step: 2,
        title: '2. Thread 1 调用 future.get() 阻塞',
        thread1State: 'blocked_future',
        thread2State: 'idle',
        groupLocked: true,
        isDeadlocked: false,
        description: 'Thread 1 发出请求后在回调内同步等待 future.get()，未退出回调，因此未释放 MutuallyExclusive 组互斥锁。',
      },
      {
        step: 3,
        title: '3. Thread 2 被同一个回调组互斥锁阻挡 -> 依然死锁',
        thread1State: 'blocked_future',
        thread2State: 'blocked_mutex',
        groupLocked: true,
        isDeadlocked: true,
        description: '虽然线程池有空闲的 Thread 2，但 Service Client 默认与 Timer 同属一个 MutuallyExclusive 回调组，Thread 2 无法并发进入响应回调！面试高频坑点：光换多线程执行器不改回调组照样死锁！',
      },
    ];
  }

  if (mode === 'multi_reentrant') {
    return [
      {
        step: 1,
        title: '1. Thread 1 进入 Reentrant 组定时器',
        thread1State: 'running_timer',
        thread2State: 'idle',
        groupLocked: false,
        isDeadlocked: false,
        description: '节点将 Timer 与 Service Client 放入 CallbackGroupType::Reentrant 回调组，允许同组内多回调并发执行。',
      },
      {
        step: 2,
        title: '2. Thread 1 挂起等待 future.get()',
        thread1State: 'blocked_future',
        thread2State: 'running_response',
        groupLocked: false,
        isDeadlocked: false,
        description: 'Service 响应到达后，MultiThreadedExecutor 立即调度空闲的 Thread 2 并发执行响应回调，填充 std::promise 值。',
      },
      {
        step: 3,
        title: '3. future.get() 唤醒返回，顺利完成',
        thread1State: 'completed',
        thread2State: 'completed',
        groupLocked: false,
        isDeadlocked: false,
        description: 'Thread 1 拿到响应结果继续执行并安全退出。注意：Reentrant 组内若共享成员变量需自行加 std::mutex 保护线程安全。',
      },
    ];
  }

  // multi_dual_groups
  return [
    {
      step: 1,
      title: '1. 双 MutuallyExclusive 回调组隔离',
      thread1State: 'running_timer',
      thread2State: 'idle',
      groupLocked: false,
      isDeadlocked: false,
      description: '工业界最推荐做法：创建 timer_cb_group_ 与 client_cb_group_ 两个独立的 MutuallyExclusive 回调组，各自串行、互不阻塞。',
    },
    {
      step: 2,
      title: '2. Thread 2 调度 client_cb_group_ 响应回调',
      thread1State: 'blocked_future',
      thread2State: 'running_response',
      groupLocked: false,
      isDeadlocked: false,
      description: 'Thread 1 等待期间，client_cb_group_ 处于未锁定状态，Thread 2 立即执行 Service 响应回调并唤醒 future。',
    },
    {
      step: 3,
      title: '3. 零死锁完成且兼具同源回调串行安全性',
      thread1State: 'completed',
      thread2State: 'completed',
      groupLocked: false,
      isDeadlocked: false,
      description: '既消除了嵌套请求死锁，又保证同一个定时器自身不会重入竞争，是企业级 ROS 2 C++ 节点架构的标准范式（更优解是直接用异步 lambda 回调避免阻塞线程）。',
    },
  ];
}

export type LifecycleState = 'unconfigured' | 'inactive' | 'active' | 'finalized';
export type LifecycleTransition =
  | 'configure'
  | 'activate'
  | 'deactivate'
  | 'cleanup'
  | 'shutdown';

export interface LifecycleResult {
  state: LifecycleState;
  lastCallback: string;
  valid: boolean;
  message: string;
}

export function transitionLifecycleState(
  current: LifecycleState,
  transition: LifecycleTransition
): LifecycleResult {
  if (current === 'finalized') {
    return {
      state: 'finalized',
      lastCallback: 'none',
      valid: false,
      message: 'Finalized 为终态，节点资源已彻底释放，不可逆转。',
    };
  }

  if (transition === 'shutdown') {
    return {
      state: 'finalized',
      lastCallback: 'on_shutdown()',
      valid: true,
      message: `从 ${current} 触发 on_shutdown()，安全销毁驱动句柄与线程，进入 Finalized 终态。`,
    };
  }

  const transitions: Record<
    Exclude<LifecycleState, 'finalized'>,
    Partial<Record<LifecycleTransition, { next: LifecycleState; cb: string; msg: string }>>
  > = {
    unconfigured: {
      configure: {
        next: 'inactive',
        cb: 'on_configure()',
        msg: '执行 on_configure()：读取 YAML 参数、分配内存池、创建 Publisher（此时不发送数据）、打开串口/CAN 句柄但不使能电机。',
      },
    },
    inactive: {
      activate: {
        next: 'active',
        cb: 'on_activate()',
        msg: '执行 on_activate()：激活 LifecyclePublisher（on_activate）、启动定时器与高频采集线程，激光雷达开始发布 /scan。',
      },
      cleanup: {
        next: 'unconfigured',
        cb: 'on_cleanup()',
        msg: '执行 on_cleanup()：释放参数与发布者智能指针、关闭硬件文件描述符，回退至 Unconfigured。',
      },
    },
    active: {
      deactivate: {
        next: 'inactive',
        cb: 'on_deactivate()',
        msg: '执行 on_deactivate()：暂停电机力矩使能、停用 LifecyclePublisher 停止对外发布控制帧，但保留硬件连接与内存以备快速热重启。',
      },
    },
  };

  const match = transitions[current]?.[transition];
  if (!match) {
    return {
      state: current,
      lastCallback: 'none',
      valid: false,
      message: `非法状态转换：当前处于 ${current} 状态，不能直接执行 ${transition}。`,
    };
  }

  return {
    state: match.next,
    lastCallback: match.cb,
    valid: true,
    message: match.msg,
  };
}

export function calculateChecklistProgress(
  checkedIds: string[],
  totalCount: number
): { completed: number; total: number; percent: number } {
  if (totalCount <= 0) {
    return { completed: 0, total: 0, percent: 0 };
  }
  const uniqueCount = new Set(checkedIds).size;
  const clamped = Math.min(uniqueCount, totalCount);
  return {
    completed: clamped,
    total: totalCount,
    percent: Math.round((clamped / totalCount) * 100),
  };
}

export type CppPitfallScenarioId =
  | 'shared_from_this_ctor'
  | 'member_destruction_order'
  | 'lambda_this_dangling'
  | 'unique_ptr_use_after_move';

export interface CppPitfallTimelinePhase {
  step: number;
  label: string;
  bugOutcome: string;
  fixOutcome: string;
  isFatalInBug: boolean;
}

export interface CppPitfallScenario {
  id: CppPitfallScenarioId;
  tabLabel: string;
  title: string;
  symptom: string;
  rootCause: string;
  badCode: string;
  goodCode: string;
  phases: CppPitfallTimelinePhase[];
}

export function getCppPitfallScenario(id: CppPitfallScenarioId): CppPitfallScenario {
  switch (id) {
    case 'shared_from_this_ctor':
      return {
        id,
        tabLabel: '构造期 shared_from_this',
        title: '陷阱 1：在 Node 构造函数中调用 shared_from_this() 抛出 std::bad_weak_ptr',
        symptom: '节点刚启动尚未进入 spin() 即 Abort 核心转储：terminate called after throwing an instance of \'std::bad_weak_ptr\'。',
        rootCause:
          'std::make_shared<MyNode>() 的内部顺序是“先分配控制块内存 → 执行 MyNode 构造函数 → 构造完成后再把 weak_this 指针写入 enable_shared_from_this 基类”。因此在构造函数执行期间，控制块对 weak_this 的绑定尚未完成。',
        badCode: `MyNode() : Node("my_node") {
  // 此时 make_shared 尚未返回，weak_this 为空！
  auto self = this->shared_from_this(); // 💥 抛出 std::bad_weak_ptr
  tf_listener_ = std::make_shared<TransformListener>(*this);
}`,
        goodCode: `MyNode() : Node("my_node") {
  // 方案 A：使用单次 wall_timer 延迟到 spin() 后绑定
  init_timer_ = create_wall_timer(1ms, [this]() {
    init_timer_->cancel();
    auto self = shared_from_this(); // ✅ 此时 控制块已就绪
  });
}
// 方案 B：使用 LifecycleNode 的 on_configure() 或显式 node->init()`,
        phases: [
          {
            step: 1,
            label: '分配控制块',
            bugOutcome: 'make_shared 分配内存，weak_this = nullptr',
            fixOutcome: 'make_shared 分配内存，weak_this = nullptr',
            isFatalInBug: false,
          },
          {
            step: 2,
            label: '执行构造函数',
            bugOutcome: '调用 shared_from_this() -> 读取空 weak_this -> 💥 std::bad_weak_ptr',
            fixOutcome: '仅注册 1ms init_once_timer_，不触发 shared_from_this()',
            isFatalInBug: true,
          },
          {
            step: 3,
            label: 'spin() 首次就绪',
            bugOutcome: '进程已终止，永远无法到达 spin()',
            fixOutcome: '✅ 控制块绑定完成，延迟初始化安全拿到 shared_ptr',
            isFatalInBug: false,
          },
        ],
      };

    case 'member_destruction_order':
      return {
        id,
        tabLabel: '成员析构顺序崩溃',
        title: '陷阱 2：timer_/sub_ 声明在 mutex_/pub_ 之前导致析构期偶发段错误',
        symptom: 'Ctrl+C 退出或节点动态卸载时偶发 SIGSEGV，GDB 栈顶指向 std::mutex::lock() 或 Publisher 虚表空指针。',
        rootCause:
          'C++ 严格按照成员变量声明顺序的“逆序”执行析构。若把 timer_ / sub_ 写在类顶部，把 mutex_ / pub_ 写在底部，析构时会先销毁 pub_ 与 mutex_；在 timer_ 析构取消前的一瞬间，后台线程仍可能回调并访问已销毁的 pub_ 或锁！',
        badCode: `class BadOrderNode : public rclcpp::Node {
private:
  rclcpp::TimerBase::SharedPtr timer_;     // 第 1 个构造 -> 最后销毁！
  rclcpp::Publisher<Msg>::SharedPtr pub_;  // 第 2 个构造 -> 先于 timer_ 销毁！
  std::mutex state_mutex_;                 // 第 3 个构造 -> 最先销毁！💥
};`,
        goodCode: `class SafeOrderNode : public rclcpp::Node {
private:
  // 1. 锁与共享状态放最前面（最后销毁）
  std::mutex state_mutex_;
  rclcpp::Publisher<Msg>::SharedPtr pub_;
  // 2. 回调源（Subscription / Timer）永远放在类成员最底部（最先销毁停回调）
  rclcpp::Subscription<Msg>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr timer_;     // ✅ 最先析构并停止调度
};`,
        phases: [
          {
            step: 1,
            label: '触发 ~Node() 析构',
            bugOutcome: '先销毁 state_mutex_ 与 pub_（置空/释放）',
            fixOutcome: '先销毁 timer_ 与 sub_，彻底切断新回调入口',
            isFatalInBug: false,
          },
          {
            step: 2,
            label: '并发线程窗口期',
            bugOutcome: 'Executor 线程正在运行 timer 回调，锁死已销毁的 mutex_ -> 💥 SIGSEGV',
            fixOutcome: '等待当前回调退出后安全释放 pub_ 与 mutex_',
            isFatalInBug: true,
          },
          {
            step: 3,
            label: '进程回收',
            bugOutcome: 'Core Dump / ASAN 报错 heap-use-after-free',
            fixOutcome: '✅ 0 内存泄漏、0 竞态安全退出',
            isFatalInBug: false,
          },
        ],
      };

    case 'lambda_this_dangling':
      return {
        id,
        tabLabel: 'Lambda [this] 悬垂',
        title: '陷阱 3：异步回调 / 后台线程捕获裸 [this] 引发 Use-After-Free',
        symptom: '多节点热插拔或 Client 异步等待超时后节点被重置，延迟到达的 Future 回调触发野指针崩溃。',
        rootCause:
          'async_send_request / std::thread / 第三方回调捕获裸指针 [this] 不会增加 shared_ptr 引用计数。一旦外部重置节点 shared_ptr，this 指向的内存被释放，但后台回调队列里的 lambda 仍持有旧地址。',
        badCode: `client_->async_send_request(req,
  [this](Client::SharedFuture fut) {
    // 若节点已先销毁，this 为野指针！💥
    RCLCPP_INFO(this->get_logger(), "Result: %d", fut.get()->ok);
  });`,
        goodCode: `std::weak_ptr<rclcpp::Node> weak_self = this->weak_from_this();
client_->async_send_request(req,
  [weak_self](Client::SharedFuture fut) {
    auto self = weak_self.lock();
    if (!self) return; // ✅ 节点已销毁，安全跳过
    RCLCPP_INFO(self->get_logger(), "Result: %d", fut.get()->ok);
  });`,
        phases: [
          {
            step: 1,
            label: '派发异步回调',
            bugOutcome: 'lambda 按值复制裸指针 this（引用计数不变）',
            fixOutcome: 'lambda 仅捕获 weak_from_this()（weak_count +1）',
            isFatalInBug: false,
          },
          {
            step: 2,
            label: '节点提前释放',
            bugOutcome: 'strong_count 归零，Node 对象内存被操作系统回收',
            fixOutcome: 'strong_count 归零释放 Node，但控制块保留标记 expired',
            isFatalInBug: false,
          },
          {
            step: 3,
            label: '响应到达执行回调',
            bugOutcome: '访问 this->get_logger() -> 💥 Use-After-Free SIGSEGV',
            fixOutcome: '✅ weak_self.lock() 返回 nullptr，优雅 return',
            isFatalInBug: true,
          },
        ],
      };

    case 'unique_ptr_use_after_move':
      return {
        id,
        tabLabel: 'UniquePtr Move 后空解引用',
        title: '陷阱 4：零拷贝 publish(std::move(msg)) 后继续读取 msg 字段',
        symptom: '开启 intra_process_comms 后代码在日志打印或统计一行瞬间崩溃（Null pointer dereference）。',
        rootCause:
          'std::unique_ptr<Msg> 独占内存所有权。调用 cmd_pub_->publish(std::move(msg)) 会将底层指针直接移交给 rclcpp 同进程分发器或 DDS 序列化器，原局部变量 msg 内部指针立即被置为 nullptr。',
        badCode: `auto msg = std::make_unique<geometry_msgs::msg::TwistStamped>();
msg->twist.linear.x = 0.8;
pub_->publish(std::move(msg)); // 所有权已交出，msg == nullptr!
// 💥 解引用空指针：
RCLCPP_INFO(get_logger(), "sent vx=%.2f", msg->twist.linear.x);`,
        goodCode: `auto msg = std::make_unique<geometry_msgs::msg::TwistStamped>();
msg->twist.linear.x = 0.8;
const double sent_vx = msg->twist.linear.x; // ✅ 移交所有权前先拷贝轻量标量
pub_->publish(std::move(msg));              // 零拷贝移交，此后禁止再碰 msg
RCLCPP_INFO(get_logger(), "sent vx=%.2f", sent_vx);`,
        phases: [
          {
            step: 1,
            label: '构造 UniquePtr',
            bugOutcome: 'msg 指向堆上新分配的 TwistStamped（有效地址）',
            fixOutcome: 'msg 指向堆上 TwistStamped，先提取标量 sent_vx',
            isFatalInBug: false,
          },
          {
            step: 2,
            label: '调用 publish(std::move)',
            bugOutcome: '指针所有权转移给 rclcpp，局部变量 msg 变为 nullptr',
            fixOutcome: '指针所有权零拷贝转移给订阅端，局部变量 msg 置空',
            isFatalInBug: false,
          },
          {
            step: 3,
            label: '打印日志 / 统计状态',
            bugOutcome: '访问 msg->twist.linear.x -> 💥 空指针解引用段错误',
            fixOutcome: '✅ 打印栈上局部变量 sent_vx，安全零拷贝',
            isFatalInBug: true,
          },
        ],
      };
  }
}

