/**
 * @file cpp_pitfalls_node.cpp
 * @brief 演示 ROS 2 中现代 C++17 核心写法与 6 大高频工程坑点的标准防坑范式：
 *  1. 不在构造函数内调用 shared_from_this()，改用 init() 或单次定时器延迟绑定
 *  2. 异步/定时器 lambda 捕获 weak_from_this()，防止节点销毁后悬垂崩溃
 *  3. 严格遵守成员声明顺序：mutex/数据/pub 在前，sub/timer 在最后（逆序先停回调）
 *  4. UniquePtr 零拷贝发布 std::move 后不再解引用原指针（避免 Use-After-Move）
 *  5. 使用 std::scoped_lock、std::optional、std::string_view、structured bindings
 *  6. 热路径预先 std::vector::reserve()，避免控制循环中触发堆扩容
 */
#include <atomic>
#include <chrono>
#include <cstdint>
#include <memory>
#include <mutex>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "geometry_msgs/msg/twist_stamped.hpp"
#include "rclcpp/rclcpp.hpp"

using namespace std::chrono_literals;

namespace chassis_core
{

struct WheelTelemetry
{
  double left_mps{0.0};
  double right_mps{0.0};
  uint64_t seq{0};
};

class CppPitfallsSafeNode : public rclcpp::Node
{
public:
  explicit CppPitfallsSafeNode(const rclcpp::NodeOptions & options = rclcpp::NodeOptions())
  : Node("cpp_pitfalls_safe_node", options)
  {
    // 热路径缓冲区在构造期一次性 reserve，运行期禁止频繁扩容
    samples_buffer_.reserve(128);

    // 创建 Publisher（声明顺序在 timer_ / sub_ 之前，析构时最后释放）
    cmd_pub_ = this->create_publisher<geometry_msgs::msg::TwistStamped>(
      "safe_cmd_vel", rclcpp::QoS(10));

    // 注意：构造函数内绝对不能调用 shared_from_this()！
    // 若注册逻辑必须使用 shared_ptr<Node>，可通过单次定时器延迟到 spin() 启动后执行。
    init_once_timer_ = this->create_wall_timer(
      1ms,
      [this]() {
        init_once_timer_->cancel();  // 仅执行一次
        this->deferred_post_init();
      });

    RCLCPP_INFO(this->get_logger(), "CppPitfallsSafeNode 构造完成（未在 ctor 中调用 shared_from_this）");
  }

  ~CppPitfallsSafeNode() override
  {
    running_.store(false, std::memory_order_release);
    // 即使在自定义析构中也可显式 cancel 定时器；此外因 timer_ 声明在类成员最底部，
    // C++ 会先按声明逆序销毁 timer_ 与 sub_，彻底杜绝回调访问已销毁的 mutex_ 或 pub_。
    if (control_timer_) {
      control_timer_->cancel();
    }
  }

  /// 若使用裸指针/显式生命周期，也可提供两段式 init() 入口
  void deferred_post_init()
  {
    // 此时 std::make_shared 控制块已完整建立，可安全获取 weak_from_this()
    std::weak_ptr<rclcpp::Node> weak_node = this->weak_from_this();

    sub_ = this->create_subscription<geometry_msgs::msg::TwistStamped>(
      "raw_cmd_vel",
      rclcpp::SensorDataQoS(),
      [weak_node](geometry_msgs::msg::TwistStamped::ConstSharedPtr msg) {
        auto base = weak_node.lock();
        if (!base) {
          return;  // 节点已进入销毁阶段，直接安全返回
        }
        auto self = std::static_pointer_cast<CppPitfallsSafeNode>(base);
        self->on_cmd_received(*msg);
      });

    control_timer_ = this->create_wall_timer(
      20ms,
      [weak_node]() {
        auto base = weak_node.lock();
        if (!base) {
          return;
        }
        auto self = std::static_pointer_cast<CppPitfallsSafeNode>(base);
        self->on_control_tick();
      });

    RCLCPP_INFO(this->get_logger(), "延迟初始化完成：weak_from_this() 回调已安全绑定");
  }

private:
  static std::optional<std::pair<double, double>> validate_cmd(
    double linear_x, double angular_z, std::string_view frame_id)
  {
    if (frame_id.empty() || std::abs(linear_x) > 3.0) {
      return std::nullopt;
    }
    return std::make_pair(linear_x, angular_z);
  }

  void on_cmd_received(const geometry_msgs::msg::TwistStamped & msg)
  {
    auto parsed = validate_cmd(msg.twist.linear.x, msg.twist.angular.z, msg.header.frame_id);
    if (!parsed.has_value()) {
      return;
    }
    // C++17 结构化绑定
    const auto [vx, wz] = *parsed;

    // C++17 std::scoped_lock：多把锁同时加锁且内置防死锁算法
    std::scoped_lock lock(state_mutex_, history_mutex_);
    latest_telemetry_ = WheelTelemetry{vx - wz * 0.2, vx + wz * 0.2, ++seq_counter_};
    if (samples_buffer_.size() < samples_buffer_.capacity()) {
      samples_buffer_.push_back(latest_telemetry_);
    }
  }

  void on_control_tick()
  {
    if (!running_.load(std::memory_order_acquire)) {
      return;
    }

    WheelTelemetry snapshot;
    {
      std::scoped_lock lock(state_mutex_);
      snapshot = latest_telemetry_;
    }

    auto out_msg = std::make_unique<geometry_msgs::msg::TwistStamped>();
    out_msg->header.stamp = this->now();  // 始终用 this->now() 兼容 use_sim_time
    out_msg->header.frame_id = "base_link";
    out_msg->twist.linear.x = 0.5 * (snapshot.left_mps + snapshot.right_mps);

    // 关键陷阱防御：必须在 std::move(out_msg) 之前读取需要打印/记录的字段！
    const double cmd_vx = out_msg->twist.linear.x;
    cmd_pub_->publish(std::move(out_msg));
    // 此行之后 out_msg 已变为 nullptr，绝不可再访问 out_msg->twist！

    RCLCPP_DEBUG(this->get_logger(), "Published safe vx=%.3f, seq=%lu", cmd_vx, snapshot.seq);
  }

  // ==================== 成员声明顺序（析构严格逆序）====================
  // 第一梯队：原子标志、互斥锁与纯数据状态（最后被析构）
  std::atomic<bool> running_{true};
  std::mutex state_mutex_;
  std::mutex history_mutex_;
  uint64_t seq_counter_{0};
  WheelTelemetry latest_telemetry_{};
  std::vector<WheelTelemetry> samples_buffer_;

  // 第二梯队：发布器（先于数据销毁，晚于回调销毁）
  rclcpp::Publisher<geometry_msgs::msg::TwistStamped>::SharedPtr cmd_pub_;

  // 第三梯队（最底部）：订阅器与定时器（析构时最先停止并释放，阻止新回调进入）
  rclcpp::Subscription<geometry_msgs::msg::TwistStamped>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr init_once_timer_;
  rclcpp::TimerBase::SharedPtr control_timer_;
};

}  // namespace chassis_core

int main(int argc, char ** argv)
{
  rclcpp::init(argc, argv);
  auto node = std::make_shared<chassis_core::CppPitfallsSafeNode>();
  rclcpp::spin(node);
  rclcpp::shutdown();
  return 0;
}
