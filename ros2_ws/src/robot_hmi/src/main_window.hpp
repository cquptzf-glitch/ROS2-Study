#ifndef ROBOT_HMI__MAIN_WINDOW_HPP_
#define ROBOT_HMI__MAIN_WINDOW_HPP_

#include <memory>
#include <thread>
#include <QCloseEvent>
#include <QLabel>
#include <QMainWindow>
#include <QProgressBar>
#include <QPushButton>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "sensor_msgs/msg/battery_state.hpp"

class MainWindow : public QMainWindow {
  Q_OBJECT

public:
  explicit MainWindow(QWidget * parent = nullptr);
  ~MainWindow() override;

protected:
  void closeEvent(QCloseEvent * event) override;

private slots:
  void onForwardClicked();
  void onStopClicked();

private:
  void setupUi();
  void initRos();
  void shutdownRos();

  QProgressBar * battery_bar_;
  QLabel * status_label_;
  QPushButton * forward_btn_;
  QPushButton * stop_btn_;

  rclcpp::Node::SharedPtr ros_node_;
  rclcpp::Publisher<geometry_msgs::msg::Twist>::SharedPtr cmd_pub_;
  rclcpp::Subscription<sensor_msgs::msg::BatteryState>::SharedPtr battery_sub_;
  std::shared_ptr<rclcpp::executors::SingleThreadedExecutor> executor_;
  std::thread ros_thread_;
};

#endif
