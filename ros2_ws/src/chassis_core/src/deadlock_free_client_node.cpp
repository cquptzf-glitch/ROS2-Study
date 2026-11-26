#include <chrono>
#include <future>
#include <memory>
#include "rclcpp/rclcpp.hpp"
#include "chassis_interfaces/srv/set_max_speed.hpp"

using namespace std::chrono_literals;

class DeadlockFreeClientNode : public rclcpp::Node {
public:
  using SetMaxSpeed = chassis_interfaces::srv::SetMaxSpeed;

  DeadlockFreeClientNode()
  : Node("deadlock_free_client_node") {
    timer_cb_group_ = this->create_callback_group(rclcpp::CallbackGroupType::MutuallyExclusive);
    client_cb_group_ = this->create_callback_group(rclcpp::CallbackGroupType::MutuallyExclusive);

    client_ = this->create_client<SetMaxSpeed>(
      "set_max_speed",
      rclcpp::ServicesQoS(),
      client_cb_group_);

    timer_ = this->create_wall_timer(
      2s,
      std::bind(&DeadlockFreeClientNode::on_timer, this),
      timer_cb_group_);
  }

private:
  void on_timer() {
    if (!client_->wait_for_service(500ms)) {
      RCLCPP_WARN(this->get_logger(), "Service not available yet");
      return;
    }

    auto request = std::make_shared<SetMaxSpeed::Request>();
    request->max_linear_mps = 1.5;

    auto future = client_->async_send_request(request);
    if (future.wait_for(1s) == std::future_status::ready) {
      auto resp = future.get();
      RCLCPP_INFO(this->get_logger(), "Sync-in-callback result: %s (%.2f m/s)",
        resp->message.c_str(), resp->applied_limit_mps);
    } else {
      RCLCPP_ERROR(this->get_logger(), "Service call timed out");
    }
  }

  rclcpp::CallbackGroup::SharedPtr timer_cb_group_;
  rclcpp::CallbackGroup::SharedPtr client_cb_group_;
  rclcpp::Client<SetMaxSpeed>::SharedPtr client_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  auto node = std::make_shared<DeadlockFreeClientNode>();
  rclcpp::executors::MultiThreadedExecutor executor(rclcpp::ExecutorOptions(), 4);
  executor.add_node(node);
  executor.spin();
  rclcpp::shutdown();
  return 0;
}
