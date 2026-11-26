#include <chrono>
#include <cmath>
#include <memory>
#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/point_stamped.hpp"
#include "geometry_msgs/msg/transform_stamped.hpp"
#include "tf2/exceptions.h"
#include "tf2/LinearMath/Quaternion.h"
#include "tf2_geometry_msgs/tf2_geometry_msgs.hpp"
#include "tf2_ros/buffer.h"
#include "tf2_ros/static_transform_broadcaster.h"
#include "tf2_ros/transform_broadcaster.h"
#include "tf2_ros/transform_listener.h"

using namespace std::chrono_literals;

class Tf2PipelineNode : public rclcpp::Node {
public:
  Tf2PipelineNode()
  : Node("tf2_pipeline_node"),
    theta_(0.0) {
    static_broadcaster_ = std::make_shared<tf2_ros::StaticTransformBroadcaster>(this);
    publish_static_laser_tf();

    dynamic_broadcaster_ = std::make_unique<tf2_ros::TransformBroadcaster>(*this);

    tf_buffer_ = std::make_unique<tf2_ros::Buffer>(this->get_clock());
    tf_listener_ = std::make_shared<tf2_ros::TransformListener>(*tf_buffer_);

    odom_timer_ = this->create_wall_timer(20ms, std::bind(&Tf2PipelineNode::publish_odom_tf, this));
    lookup_timer_ = this->create_wall_timer(200ms, std::bind(&Tf2PipelineNode::transform_obstacle, this));
  }

private:
  void publish_static_laser_tf() {
    geometry_msgs::msg::TransformStamped t;
    t.header.stamp = this->get_clock()->now();
    t.header.frame_id = "base_link";
    t.child_frame_id = "laser_link";
    t.transform.translation.x = 0.20;
    t.transform.translation.y = 0.0;
    t.transform.translation.z = 0.10;
    t.transform.rotation.w = 1.0;
    static_broadcaster_->sendTransform(t);
  }

  void publish_odom_tf() {
    theta_ += 0.01;
    geometry_msgs::msg::TransformStamped t;
    t.header.stamp = this->get_clock()->now();
    t.header.frame_id = "odom";
    t.child_frame_id = "base_link";
    t.transform.translation.x = 1.5 * std::cos(theta_);
    t.transform.translation.y = 1.5 * std::sin(theta_);
    t.transform.translation.z = 0.08;

    tf2::Quaternion q;
    q.setRPY(0.0, 0.0, theta_ + 1.5707963);
    t.transform.rotation.x = q.x();
    t.transform.rotation.y = q.y();
    t.transform.rotation.z = q.z();
    t.transform.rotation.w = q.w();

    dynamic_broadcaster_->sendTransform(t);
  }

  void transform_obstacle() {
    geometry_msgs::msg::PointStamped obstacle_in_laser;
    obstacle_in_laser.header.frame_id = "laser_link";
    obstacle_in_laser.header.stamp = this->get_clock()->now() - rclcpp::Duration::from_seconds(0.05);
    obstacle_in_laser.point.x = 1.2;
    obstacle_in_laser.point.y = 0.3;
    obstacle_in_laser.point.z = 0.0;

    try {
      auto obstacle_in_odom = tf_buffer_->transform(
        obstacle_in_laser, "odom", tf2::durationFromSec(0.05));
      RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 1000,
        "Obstacle in odom: (%.2f, %.2f)", obstacle_in_odom.point.x, obstacle_in_odom.point.y);
    } catch (const tf2::TransformException & ex) {
      RCLCPP_WARN_THROTTLE(this->get_logger(), *this->get_clock(), 1000,
        "TF2 transform failed safely: %s", ex.what());
    }
  }

  double theta_;
  std::shared_ptr<tf2_ros::StaticTransformBroadcaster> static_broadcaster_;
  std::unique_ptr<tf2_ros::TransformBroadcaster> dynamic_broadcaster_;
  std::unique_ptr<tf2_ros::Buffer> tf_buffer_;
  std::shared_ptr<tf2_ros::TransformListener> tf_listener_;
  rclcpp::TimerBase::SharedPtr odom_timer_;
  rclcpp::TimerBase::SharedPtr lookup_timer_;
};

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<Tf2PipelineNode>());
  rclcpp::shutdown();
  return 0;
}
