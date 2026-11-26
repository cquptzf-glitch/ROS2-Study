#include <functional>
#include <memory>
#include "rclcpp/rclcpp.hpp"
#include "nav_msgs/msg/odometry.hpp"
#include "sensor_msgs/msg/laser_scan.hpp"
#include "message_filters/subscriber.h"
#include "message_filters/synchronizer.h"
#include "message_filters/sync_policies/approximate_time.h"

class SensorSyncNode : public rclcpp::Node {
public:
  using OdomMsg = nav_msgs::msg::Odometry;
  using ScanMsg = sensor_msgs::msg::LaserScan;
  using SyncPolicy = message_filters::sync_policies::ApproximateTime<OdomMsg, ScanMsg>;

  SensorSyncNode()
  : Node("sensor_sync_node") {
    // 1. 使用 message_filters::Subscriber 包装两个异步传感器话题
    odom_sub_.subscribe(this, "odom", rmw_qos_profile_sensor_data);
    scan_sub_.subscribe(this, "scan", rmw_qos_profile_sensor_data);

    // 2. ApproximateTime 策略：队列长度 20，允许毫秒级时间戳偏差自动配对
    sync_ = std::make_shared<message_filters::Synchronizer<SyncPolicy>>(
      SyncPolicy(20), odom_sub_, scan_sub_);
    sync_->setMaxIntervalDuration(rclcpp::Duration::from_seconds(0.05));

    sync_->registerCallback(
      std::bind(&SensorSyncNode::on_synced, this, std::placeholders::_1, std::placeholders::_2));

    RCLCPP_INFO(this->get_logger(), "SensorSyncNode ready (ApproximateTime odom + scan)");
  }

private:
  void on_synced(const OdomMsg::ConstSharedPtr & odom, const ScanMsg::ConstSharedPtr & scan) {
    const double dt_ms = std::abs(
      (rclcpp::Time(odom->header.stamp) - rclcpp::Time(scan->header.stamp)).seconds() * 1000.0);
    RCLCPP_INFO_THROTTLE(this->get_logger(), *this->get_clock(), 1000,
      "Synced pair: x=%.2f m, ranges=%zu, |dt|=%.2f ms",
      odom->pose.pose.position.x, scan->ranges.size(), dt_ms);
  }

  message_filters::Subscriber<OdomMsg> odom_sub_;
  message_filters::Subscriber<ScanMsg> scan_sub_;
  std::shared_ptr<message_filters::Synchronizer<SyncPolicy>> sync_;
};

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<SensorSyncNode>());
  rclcpp::shutdown();
  return 0;
}
