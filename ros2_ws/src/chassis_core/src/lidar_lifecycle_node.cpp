#include <chrono>
#include <memory>
#include <string>
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_lifecycle/lifecycle_node.hpp"
#include "sensor_msgs/msg/laser_scan.hpp"

using namespace std::chrono_literals;
using CallbackReturn = rclcpp_lifecycle::node_interfaces::LifecycleNodeInterface::CallbackReturn;

class LidarLifecycleDriver : public rclcpp_lifecycle::LifecycleNode {
public:
  explicit LidarLifecycleDriver(const std::string & node_name)
  : LifecycleNode(node_name) {}

  CallbackReturn on_configure(const rclcpp_lifecycle::State &) override {
    RCLCPP_INFO(this->get_logger(), "[on_configure] Allocating memory and opening LiDAR socket...");
    scan_pub_ = this->create_publisher<sensor_msgs::msg::LaserScan>("scan", rclcpp::SensorDataQoS());
    timer_ = this->create_wall_timer(100ms, std::bind(&LidarLifecycleDriver::publish_scan, this));
    return CallbackReturn::SUCCESS;
  }

  CallbackReturn on_activate(const rclcpp_lifecycle::State & state) override {
    LifecycleNode::on_activate(state);
    RCLCPP_INFO(this->get_logger(), "[on_activate] Enabling laser emission and LifecyclePublisher");
    if (scan_pub_) {
      scan_pub_->on_activate();
    }
    return CallbackReturn::SUCCESS;
  }

  CallbackReturn on_deactivate(const rclcpp_lifecycle::State & state) override {
    LifecycleNode::on_deactivate(state);
    RCLCPP_INFO(this->get_logger(), "[on_deactivate] Pausing laser emission cleanly");
    if (scan_pub_) {
      scan_pub_->on_deactivate();
    }
    return CallbackReturn::SUCCESS;
  }

  CallbackReturn on_cleanup(const rclcpp_lifecycle::State &) override {
    RCLCPP_INFO(this->get_logger(), "[on_cleanup] Releasing publisher, timer and hardware handle");
    timer_.reset();
    scan_pub_.reset();
    return CallbackReturn::SUCCESS;
  }

  CallbackReturn on_shutdown(const rclcpp_lifecycle::State &) override {
    RCLCPP_INFO(this->get_logger(), "[on_shutdown] Finalizing LiDAR driver");
    timer_.reset();
    scan_pub_.reset();
    return CallbackReturn::SUCCESS;
  }

private:
  void publish_scan() {
    if (!scan_pub_ || !scan_pub_->is_activated()) {
      return;
    }
    auto msg = sensor_msgs::msg::LaserScan();
    msg.header.stamp = this->now();
    msg.header.frame_id = "laser_link";
    msg.angle_min = -1.57F;
    msg.angle_max = 1.57F;
    msg.angle_increment = 0.01745F;
    msg.range_min = 0.1F;
    msg.range_max = 30.0F;
    msg.ranges.assign(180, 5.0F);
    scan_pub_->publish(msg);
  }

  rclcpp_lifecycle::LifecyclePublisher<sensor_msgs::msg::LaserScan>::SharedPtr scan_pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  auto node = std::make_shared<LidarLifecycleDriver>("lidar_lifecycle_driver");
  rclcpp::executors::SingleThreadedExecutor executor;
  executor.add_node(node->get_node_base_interface());
  executor.spin();
  rclcpp::shutdown();
  return 0;
}
