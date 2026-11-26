#include <chrono>
#include <functional>
#include <memory>
#include "rclcpp/rclcpp.hpp"
#include "rclcpp_action/rclcpp_action.hpp"
#include "chassis_interfaces/srv/set_max_speed.hpp"
#include "chassis_interfaces/action/dock_to_charger.hpp"

using namespace std::chrono_literals;

class ChassisClientNode : public rclcpp::Node {
public:
  using SetMaxSpeed = chassis_interfaces::srv::SetMaxSpeed;
  using DockAction = chassis_interfaces::action::DockToCharger;
  using GoalHandleDock = rclcpp_action::ClientGoalHandle<DockAction>;

  ChassisClientNode()
  : Node("chassis_client_node") {
    speed_client_ = this->create_client<SetMaxSpeed>("set_max_speed");
    dock_client_ = rclcpp_action::create_client<DockAction>(this, "dock_to_charger");

    startup_timer_ = this->create_wall_timer(500ms, [this]() {
      startup_timer_->cancel();
      this->send_speed_limit(1.5);
      this->send_dock_goal(2, 15.0F);
    });
  }

private:
  void send_speed_limit(double limit_mps) {
    if (!speed_client_->wait_for_service(2s)) {
      RCLCPP_ERROR(this->get_logger(), "set_max_speed service unavailable");
      return;
    }
    auto req = std::make_shared<SetMaxSpeed::Request>();
    req->max_linear_mps = limit_mps;

    speed_client_->async_send_request(
      req,
      [this](rclcpp::Client<SetMaxSpeed>::SharedFuture future) {
        auto resp = future.get();
        RCLCPP_INFO(this->get_logger(), "Service response: accepted=%d, applied=%.2f m/s",
          resp->accepted, resp->applied_limit_mps);
      });
  }

  void send_dock_goal(uint32_t station_id, float timeout_sec) {
    if (!dock_client_->wait_for_action_server(2s)) {
      RCLCPP_ERROR(this->get_logger(), "dock_to_charger action server unavailable");
      return;
    }
    auto goal_msg = DockAction::Goal();
    goal_msg.station_id = station_id;
    goal_msg.timeout_sec = timeout_sec;

    auto send_goal_options = rclcpp_action::Client<DockAction>::SendGoalOptions();
    send_goal_options.goal_response_callback =
      [this](const GoalHandleDock::SharedPtr & goal_handle) {
        if (!goal_handle) {
          RCLCPP_ERROR(this->get_logger(), "Dock goal was rejected by server");
        } else {
          RCLCPP_INFO(this->get_logger(), "Dock goal accepted, waiting for result...");
        }
      };

    send_goal_options.feedback_callback =
      [this](GoalHandleDock::SharedPtr, const std::shared_ptr<const DockAction::Feedback> fb) {
        RCLCPP_INFO(this->get_logger(), "Docking [%s] remaining: %.2f m",
          fb->current_phase.c_str(), fb->distance_remaining_m);
      };

    send_goal_options.result_callback =
      [this](const GoalHandleDock::WrappedResult & result) {
        if (result.code == rclcpp_action::ResultCode::SUCCEEDED) {
          RCLCPP_INFO(this->get_logger(), "Dock succeeded: %s (err=%.1f mm)",
            result.result->status_message.c_str(), result.result->final_alignment_error_mm);
        } else {
          RCLCPP_WARN(this->get_logger(), "Dock finished with non-success status");
        }
      };

    dock_client_->async_send_goal(goal_msg, send_goal_options);
  }

  rclcpp::Client<SetMaxSpeed>::SharedPtr speed_client_;
  rclcpp_action::Client<DockAction>::SharedPtr dock_client_;
  rclcpp::TimerBase::SharedPtr startup_timer_;
};

int main(int argc, char ** argv) {
  rclcpp::init(argc, argv);
  rclcpp::spin(std::make_shared<ChassisClientNode>());
  rclcpp::shutdown();
  return 0;
}
