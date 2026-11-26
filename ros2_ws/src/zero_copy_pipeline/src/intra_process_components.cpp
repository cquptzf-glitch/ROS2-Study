#include <chrono>
#include <cstdint>
#include <memory>
#include <utility>
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_components/register_node_macro.hpp"
#include "sensor_msgs/msg/image.hpp"

using namespace std::chrono_literals;

namespace zero_copy_pipeline {

class CameraProducerComponent : public rclcpp::Node {
public:
  explicit CameraProducerComponent(const rclcpp::NodeOptions & options)
  : Node("camera_producer", rclcpp::NodeOptions(options).use_intra_process_comms(true)) {
    pub_ = this->create_publisher<sensor_msgs::msg::Image>("camera/image_raw", 10);
    timer_ = this->create_wall_timer(33ms, [this]() {
      auto msg = std::make_unique<sensor_msgs::msg::Image>();
      msg->header.stamp = this->now();
      msg->header.frame_id = "camera_optical_frame";
      msg->width = 1920;
      msg->height = 1080;
      msg->encoding = "rgb8";
      msg->step = 1920 * 3;
      msg->data.resize(msg->step * msg->height, 128);

      RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 2000,
        "Publishing unique_ptr addr: %p", static_cast<const void *>(msg.get()));
      pub_->publish(std::move(msg));
    });
  }

private:
  rclcpp::Publisher<sensor_msgs::msg::Image>::SharedPtr pub_;
  rclcpp::TimerBase::SharedPtr timer_;
};

class PerceptionConsumerComponent : public rclcpp::Node {
public:
  explicit PerceptionConsumerComponent(const rclcpp::NodeOptions & options)
  : Node("perception_consumer", rclcpp::NodeOptions(options).use_intra_process_comms(true)) {
    sub_ = this->create_subscription<sensor_msgs::msg::Image>(
      "camera/image_raw",
      10,
      [this](sensor_msgs::msg::Image::UniquePtr msg) {
        RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 2000,
          "Zero-copy received addr: %p (size=%zu bytes)",
          static_cast<const void *>(msg.get()), msg->data.size());
      });
  }

private:
  rclcpp::Subscription<sensor_msgs::msg::Image>::SharedPtr sub_;
};

}  // namespace zero_copy_pipeline

RCLCPP_COMPONENTS_REGISTER_NODE(zero_copy_pipeline::CameraProducerComponent)
RCLCPP_COMPONENTS_REGISTER_NODE(zero_copy_pipeline::PerceptionConsumerComponent)
