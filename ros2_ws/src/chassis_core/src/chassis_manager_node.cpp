#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <functional>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <vector>

#include "rclcpp/rclcpp.hpp"
#include "rclcpp_action/rclcpp_action.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "rcl_interfaces/msg/set_parameters_result.hpp"

#include "chassis_interfaces/msg/wheel_telemetry.hpp"
#include "chassis_interfaces/srv/set_max_speed.hpp"
#include "chassis_interfaces/action/dock_to_charger.hpp"

using namespace std::chrono_literals;

class ChassisManagerNode : public rclcpp::Node {
public:
  using DockAction = chassis_interfaces::action::DockToCharger;
  using GoalHandleDock = rclcpp_action::ServerGoalHandle<DockAction>;
  using SetMaxSpeed = chassis_interfaces::srv::SetMaxSpeed;
  using WheelTelemetry = chassis_interfaces::msg::WheelTelemetry;

  explicit ChassisManagerNode(const rclcpp::NodeOptions & options = rclcpp::NodeOptions())
  : Node("chassis_manager_node", options),
    max_linear_mps_(1.2),
    current_linear_cmd_(0.0),
    current_angular_cmd_(0.0) {
    this->declare_parameter<double>("max_linear_mps", 1.2);
    this->declare_parameter<double>("wheel_base_m", 0.42);
    max_linear_mps_ = this->get_parameter("max_linear_mps").as_double();
    wheel_base_m_ = this->get_parameter("wheel_base_m").as_double();

    param_cb_handle_ = this->add_on_set_parameters_callback(
      std::bind(&ChassisManagerNode::on_parameters_set, this, std::placeholders::_1));

    auto telemetry_qos = rclcpp::QoS(rclcpp::KeepLast(10)).best_effort().durability_volatile();
    telemetry_pub_ = this->create_publisher<WheelTelemetry>("wheel_telemetry", telemetry_qos);

    auto cmd_qos = rclcpp::QoS(rclcpp::KeepLast(5)).reliable();
    cmd_vel_sub_ = this->create_subscription<geometry_msgs::msg::Twist>(
      "cmd_vel",
      cmd_qos,
      std::bind(&ChassisManagerNode::on_cmd_vel, this, std::placeholders::_1));

    speed_srv_ = this->create_service<SetMaxSpeed>(
      "set_max_speed",
      std::bind(
        &ChassisManagerNode::on_set_max_speed,
        this,
        std::placeholders::_1,
        std::placeholders::_2));

    dock_action_server_ = rclcpp_action::create_server<DockAction>(
      this,
      "dock_to_charger",
      std::bind(&ChassisManagerNode::handle_dock_goal, this, std::placeholders::_1, std::placeholders::_2),
      std::bind(&ChassisManagerNode::handle_dock_cancel, this, std::placeholders::_1),
      std::bind(&ChassisManagerNode::handle_dock_accepted, this, std::placeholders::_1));

    telemetry_timer_ = this->create_wall_timer(
      20ms, std::bind(&ChassisManagerNode::publish_telemetry, this));

    RCLCPP_INFO(this->get_logger(), "ChassisManagerNode initialized. Max speed: %.2f m/s",
      max_linear_mps_.load());
  }

private:
  rcl_interfaces::msg::SetParametersResult on_parameters_set(
    const std::vector<rclcpp::Parameter> & parameters) {
    rcl_interfaces::msg::SetParametersResult result;
    result.successful = true;
    result.reason = "Parameters accepted";

    for (const auto & param : parameters) {
      if (param.get_name() == "max_linear_mps") {
        double val = param.as_double();
        if (val <= 0.0 || val > 3.5) {
          result.successful = false;
          result.reason = "max_linear_mps must be in range (0.0, 3.5]";
          return result;
        }
        max_linear_mps_.store(val);
        RCLCPP_INFO(this->get_logger(), "Dynamic update max_linear_mps = %.2f", val);
      } else if (param.get_name() == "wheel_base_m") {
        double val = param.as_double();
        if (val <= 0.1) {
          result.successful = false;
          result.reason = "wheel_base_m must be > 0.1m";
          return result;
        }
        wheel_base_m_.store(val);
      }
    }
    return result;
  }

  void on_cmd_vel(const geometry_msgs::msg::Twist::SharedPtr msg) {
    std::lock_guard<std::mutex> lock(cmd_mutex_);
    const double limit = max_linear_mps_.load();
    current_linear_cmd_ = std::clamp(msg->linear.x, -limit, limit);
    current_angular_cmd_ = msg->angular.z;
  }

  void publish_telemetry() {
    double v = 0.0;
    double w = 0.0;
    {
      std::lock_guard<std::mutex> lock(cmd_mutex_);
      v = current_linear_cmd_;
      w = current_angular_cmd_;
    }
    const double half_base = wheel_base_m_.load() * 0.5;

    WheelTelemetry msg;
    msg.header.stamp = this->now();
    msg.header.frame_id = "base_link";
    msg.left_velocity_mps = v - w * half_base;
    msg.right_velocity_mps = v + w * half_base;
    msg.bus_voltage_v = 48.2F;
    msg.fault_code = 0;
    telemetry_pub_->publish(msg);
  }

  void on_set_max_speed(
    const std::shared_ptr<SetMaxSpeed::Request> request,
    std::shared_ptr<SetMaxSpeed::Response> response) {
    if (request->max_linear_mps <= 0.0 || request->max_linear_mps > 3.5) {
      response->accepted = false;
      response->message = "Rejected: speed limit out of safe bounds (0.0, 3.5]";
      response->applied_limit_mps = max_linear_mps_.load();
      return;
    }
    max_linear_mps_.store(request->max_linear_mps);
    response->accepted = true;
    response->message = "Speed limit updated";
    response->applied_limit_mps = request->max_linear_mps;
    RCLCPP_INFO(this->get_logger(), "Service updated max speed to %.2f m/s", request->max_linear_mps);
  }

  rclcpp_action::GoalResponse handle_dock_goal(
    const rclcpp_action::GoalUUID & uuid,
    std::shared_ptr<const DockAction::Goal> goal) {
    (void)uuid;
    if (goal->station_id == 0 || goal->timeout_sec <= 1.0F) {
      RCLCPP_WARN(this->get_logger(), "Rejected invalid dock goal: station=%u", goal->station_id);
      return rclcpp_action::GoalResponse::REJECT;
    }
    RCLCPP_INFO(this->get_logger(), "Accepted dock goal for station #%u", goal->station_id);
    return rclcpp_action::GoalResponse::ACCEPT_AND_EXECUTE;
  }

  rclcpp_action::CancelResponse handle_dock_cancel(
    const std::shared_ptr<GoalHandleDock> goal_handle) {
    (void)goal_handle;
    RCLCPP_INFO(this->get_logger(), "Received request to cancel docking action");
    return rclcpp_action::CancelResponse::ACCEPT;
  }

  void handle_dock_accepted(const std::shared_ptr<GoalHandleDock> goal_handle) {
    std::weak_ptr<rclcpp::Node> weak_self = this->weak_from_this();
    std::thread([weak_self, goal_handle]() {
      if (auto base = weak_self.lock()) {
        std::static_pointer_cast<ChassisManagerNode>(base)->execute_docking(goal_handle);
      }
    }).detach();
  }

  void execute_docking(const std::shared_ptr<GoalHandleDock> goal_handle) {
    const auto goal = goal_handle->get_goal();
    const auto start_time = this->now();
    auto feedback = std::make_shared<DockAction::Feedback>();
    auto result = std::make_shared<DockAction::Result>();

    rclcpp::Rate loop_rate(10);
    float remaining = 2.0F;

    while (rclcpp::ok() && remaining > 0.02F) {
      if ((this->now() - start_time).seconds() > static_cast<double>(goal->timeout_sec)) {
        result->success = false;
        result->final_alignment_error_mm = remaining * 1000.0F;
        result->status_message = "Docking aborted: timeout exceeded";
        goal_handle->abort(result);
        RCLCPP_ERROR(this->get_logger(), "Docking timed out after %.1fs", goal->timeout_sec);
        return;
      }

      if (goal_handle->is_canceling()) {
        result->success = false;
        result->final_alignment_error_mm = remaining * 1000.0F;
        result->status_message = "Docking canceled by client";
        goal_handle->canceled(result);
        RCLCPP_INFO(this->get_logger(), "Docking canceled cleanly");
        return;
      }

      remaining = std::max(0.0F, remaining - 0.1F);
      feedback->current_phase = remaining > 0.5F ? "Visual Servoing" : "Final Contact Alignment";
      feedback->distance_remaining_m = remaining;
      goal_handle->publish_feedback(feedback);
      loop_rate.sleep();
    }

    if (rclcpp::ok()) {
      result->success = true;
      result->final_alignment_error_mm = 3.5F;
      result->status_message = "Docked successfully at station #" + std::to_string(goal->station_id);
      goal_handle->succeed(result);
      RCLCPP_INFO(this->get_logger(), "Docking succeeded at station #%u", goal->station_id);
    }
  }

  std::atomic<double> max_linear_mps_;
  std::atomic<double> wheel_base_m_;
  std::mutex cmd_mutex_;
  double current_linear_cmd_;
  double current_angular_cmd_;

  rclcpp::node_interfaces::OnSetParametersCallbackHandle::SharedPtr param_cb_handle_;
  rclcpp::Publisher<WheelTelemetry>::SharedPtr telemetry_pub_;
  rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr cmd_vel_sub_;
  rclcpp::Service<SetMaxSpeed>::SharedPtr speed_srv_;
  rclcpp_action::Server<DockAction>::SharedPtr dock_action_server_;
  rclcpp::TimerBase::SharedPtr telemetry_timer_;
};

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  auto node = std::make_shared<ChassisManagerNode>();
  rclcpp::spin(node);
  rclcpp::shutdown();
  return 0;
}
