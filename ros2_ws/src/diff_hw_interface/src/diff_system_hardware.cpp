#include "diff_hw_interface/diff_system_hardware.hpp"
#include <algorithm>
#include "hardware_interface/types/hardware_interface_type_values.hpp"
#include "pluginlib/class_list_macros.hpp"
#include "rclcpp/rclcpp.hpp"

namespace diff_hw_interface {

hardware_interface::CallbackReturn DiffBotSystemHardware::on_init(
  const hardware_interface::HardwareInfo & info) {
  if (hardware_interface::SystemInterface::on_init(info) !=
      hardware_interface::CallbackReturn::SUCCESS) {
    return hardware_interface::CallbackReturn::ERROR;
  }

  auto it = info_.hardware_parameters.find("can_interface");
  if (it == info_.hardware_parameters.end()) {
    RCLCPP_FATAL(rclcpp::get_logger("DiffBotSystemHardware"),
      "Missing required hardware parameter: can_interface");
    return hardware_interface::CallbackReturn::ERROR;
  }
  can_interface_ = it->second;

  const size_t n = info_.joints.size();
  hw_commands_vel_.assign(n, 0.0);
  hw_states_pos_.assign(n, 0.0);
  hw_states_vel_.assign(n, 0.0);

  for (const auto & joint : info_.joints) {
    if (joint.command_interfaces.size() != 1 ||
        joint.command_interfaces[0].name != hardware_interface::HW_IF_VELOCITY) {
      RCLCPP_FATAL(rclcpp::get_logger("DiffBotSystemHardware"),
        "Joint '%s' must expose exactly 1 velocity command interface.", joint.name.c_str());
      return hardware_interface::CallbackReturn::ERROR;
    }
  }
  return hardware_interface::CallbackReturn::SUCCESS;
}

std::vector<hardware_interface::StateInterface>
DiffBotSystemHardware::export_state_interfaces() {
  std::vector<hardware_interface::StateInterface> state_interfaces;
  for (size_t i = 0; i < info_.joints.size(); ++i) {
    state_interfaces.emplace_back(
      info_.joints[i].name, hardware_interface::HW_IF_POSITION, &hw_states_pos_[i]);
    state_interfaces.emplace_back(
      info_.joints[i].name, hardware_interface::HW_IF_VELOCITY, &hw_states_vel_[i]);
  }
  return state_interfaces;
}

std::vector<hardware_interface::CommandInterface>
DiffBotSystemHardware::export_command_interfaces() {
  std::vector<hardware_interface::CommandInterface> command_interfaces;
  for (size_t i = 0; i < info_.joints.size(); ++i) {
    command_interfaces.emplace_back(
      info_.joints[i].name, hardware_interface::HW_IF_VELOCITY, &hw_commands_vel_[i]);
  }
  return command_interfaces;
}

hardware_interface::CallbackReturn DiffBotSystemHardware::on_activate(
  const rclcpp_lifecycle::State &) {
  std::fill(hw_commands_vel_.begin(), hw_commands_vel_.end(), 0.0);
  RCLCPP_INFO(rclcpp::get_logger("DiffBotSystemHardware"),
    "CAN hardware activated on interface %s", can_interface_.c_str());
  return hardware_interface::CallbackReturn::SUCCESS;
}

hardware_interface::CallbackReturn DiffBotSystemHardware::on_deactivate(
  const rclcpp_lifecycle::State &) {
  std::fill(hw_commands_vel_.begin(), hw_commands_vel_.end(), 0.0);
  RCLCPP_INFO(rclcpp::get_logger("DiffBotSystemHardware"), "CAN hardware deactivated safely");
  return hardware_interface::CallbackReturn::SUCCESS;
}

hardware_interface::return_type DiffBotSystemHardware::read(
  const rclcpp::Time &, const rclcpp::Duration & period) {
  const double dt = period.seconds();
  for (size_t i = 0; i < hw_states_pos_.size(); ++i) {
    hw_states_vel_[i] = hw_commands_vel_[i];
    hw_states_pos_[i] += hw_states_vel_[i] * dt;
  }
  return hardware_interface::return_type::OK;
}

hardware_interface::return_type DiffBotSystemHardware::write(
  const rclcpp::Time &, const rclcpp::Duration &) {
  return hardware_interface::return_type::OK;
}

}  // namespace diff_hw_interface

PLUGINLIB_EXPORT_CLASS(
  diff_hw_interface::DiffBotSystemHardware,
  hardware_interface::SystemInterface)
