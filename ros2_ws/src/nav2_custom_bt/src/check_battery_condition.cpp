#include <string>
#include "behaviortree_cpp/bt_factory.h"
#include "behaviortree_cpp/condition_node.h"
#include "rclcpp/rclcpp.hpp"

namespace nav2_custom_bt {

class CheckBatteryCondition : public BT::ConditionNode {
public:
  CheckBatteryCondition(const std::string & name, const BT::NodeConfig & config)
  : BT::ConditionNode(name, config) {}

  static BT::PortsList providedPorts() {
    return {
      BT::InputPort<double>("min_voltage", 44.0, "Minimum safe battery voltage"),
      BT::InputPort<double>("current_voltage", "Live battery voltage from blackboard")
    };
  }

  BT::NodeStatus tick() override {
    double min_v = 44.0;
    double cur_v = 0.0;
    getInput("min_voltage", min_v);
    if (!getInput("current_voltage", cur_v)) {
      return BT::NodeStatus::FAILURE;
    }
    return (cur_v >= min_v) ? BT::NodeStatus::SUCCESS : BT::NodeStatus::FAILURE;
  }
};

}  // namespace nav2_custom_bt

BT_REGISTER_NODES(factory) {
  factory.registerNodeType<nav2_custom_bt::CheckBatteryCondition>("CheckBatteryCondition");
}
