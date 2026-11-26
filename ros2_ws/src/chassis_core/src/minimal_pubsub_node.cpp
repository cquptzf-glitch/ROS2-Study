#include <chrono>
#include <memory>
#include <string>
#include "rclcpp/rclcpp.hpp"
#include "std_msgs/msg/string.hpp"

using namespace std::chrono_literals;

class MinimalPubSubNode : public rclcpp::Node {
public:
  MinimalPubSubNode()
  : Node("minimal_pubsub_node"), count_(0) {
    // 1. 创建发布者：队列深度 10，使用默认可靠 QoS
    pub_ = this->create_publisher<std_msgs::msg::String>("heartbeat", 10);

    // 2. 创建订阅者：推荐现代 C++17 Lambda 回调，简洁且无需 std::bind 占位符
    sub_ = this->create_subscription<std_msgs::msg::String>(
      "heartbeat",
      10,
      [this](const std_msgs::msg::String::ConstSharedPtr msg) {
        RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 2000,
          "Received heartbeat: '%s'", msg->data.c_str());
      });

    // 3. 创建 500ms 定时器驱动周期发布
    timer_ = this->create_wall_timer(500ms, [this]() {
      std_msgs::msg::String msg;
      msg.data = "AMR alive seq #" + std::to_string(++count_);
      pub_->publish(msg);
    });

    RCLCPP_INFO_ONCE(this->get_logger(), "MinimalPubSubNode started successfully.");
  }

private:
  size_t count_;
  rclcpp::Publisher<std_msgs::msg::String>::SharedPtr pub_;
  rclcpp::Subscription<std_msgs::msg::String>::SharedPtr sub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<MinimalPubSubNode>());
  rclcpp::shutdown();
  return 0;
}
