#include <memory>
#include <thread>
#include "rclcpp/rclcpp.hpp"
#include "moveit/move_group_interface/move_group_interface.hpp"
#include "geometry_msgs/msg/pose.hpp"

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  rclcpp::NodeOptions node_options;
  node_options.automatically_declare_parameters_from_overrides(true);
  auto node = rclcpp::Node::make_shared("moveit_pose_demo", node_options);

  rclcpp::executors::SingleThreadedExecutor executor;
  executor.add_node(node);
  std::thread spinner([&executor]() { executor.spin(); });

  using moveit::planning_interface::MoveGroupInterface;
  MoveGroupInterface move_group(node, "ur_manipulator");
  move_group.setMaxVelocityScalingFactor(0.4);
  move_group.setMaxAccelerationScalingFactor(0.4);

  geometry_msgs::msg::Pose target_pose;
  target_pose.orientation.w = 1.0;
  target_pose.position.x = 0.35;
  target_pose.position.y = -0.15;
  target_pose.position.z = 0.45;
  move_group.setPoseTarget(target_pose);

  MoveGroupInterface::Plan plan;
  bool success = (move_group.plan(plan) == moveit::core::MoveItErrorCode::SUCCESS);
  if (success) {
    RCLCPP_INFO(node->get_logger(), "MoveIt 2 plan succeeded, executing trajectory...");
    move_group.execute(plan);
  } else {
    RCLCPP_ERROR(node->get_logger(), "MoveIt 2 planning failed!");
  }

  rclcpp::shutdown();
  spinner.join();
  return 0;
}
