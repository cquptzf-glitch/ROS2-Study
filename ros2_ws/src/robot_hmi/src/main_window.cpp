#include "main_window.hpp"
#include <algorithm>
#include <QHBoxLayout>
#include <QMetaObject>
#include <QString>
#include <QVBoxLayout>
#include <QWidget>

MainWindow::MainWindow(QWidget * parent)
: QMainWindow(parent) {
  setupUi();
  initRos();
}

MainWindow::~MainWindow() {
  shutdownRos();
}

void MainWindow::closeEvent(QCloseEvent * event) {
  shutdownRos();
  event->accept();
}

void MainWindow::setupUi() {
  setWindowTitle("AMR Industrial HMI (Qt + ROS 2 C++)");
  resize(420, 220);

  auto * central = new QWidget(this);
  auto * layout = new QVBoxLayout(central);

  status_label_ = new QLabel("Status: Connected to ROS 2 DDS", this);
  battery_bar_ = new QProgressBar(this);
  battery_bar_->setRange(0, 100);
  battery_bar_->setValue(85);
  battery_bar_->setFormat("Battery: %p%");

  auto * btn_row = new QHBoxLayout();
  forward_btn_ = new QPushButton("Move Forward (0.5 m/s)", this);
  stop_btn_ = new QPushButton("Emergency Stop", this);
  btn_row->addWidget(forward_btn_);
  btn_row->addWidget(stop_btn_);

  layout->addWidget(status_label_);
  layout->addWidget(battery_bar_);
  layout->addLayout(btn_row);
  setCentralWidget(central);

  connect(forward_btn_, &QPushButton::clicked, this, &MainWindow::onForwardClicked);
  connect(stop_btn_, &QPushButton::clicked, this, &MainWindow::onStopClicked);
}

void MainWindow::initRos() {
  ros_node_ = std::make_shared<rclcpp::Node>("qt_hmi_node");
  cmd_pub_ = ros_node_->create_publisher<geometry_msgs::msg::Twist>("cmd_vel", 10);

  battery_sub_ = ros_node_->create_subscription<sensor_msgs::msg::BatteryState>(
    "battery_state",
    rclcpp::SensorDataQoS(),
    [this](const sensor_msgs::msg::BatteryState::SharedPtr msg) {
      int pct = static_cast<int>(std::clamp(msg->percentage * 100.0F, 0.0F, 100.0F));
      QMetaObject::invokeMethod(
        this,
        [this, pct]() {
          battery_bar_->setValue(pct);
          status_label_->setText(QString("Battery telemetry updated: %1%").arg(pct));
        },
        Qt::QueuedConnection);
    });

  executor_ = std::make_shared<rclcpp::executors::SingleThreadedExecutor>();
  executor_->add_node(ros_node_);
  ros_thread_ = std::thread([this]() {
    executor_->spin();
  });
}

void MainWindow::shutdownRos() {
  if (executor_) {
    executor_->cancel();
  }
  if (rclcpp::ok()) {
    rclcpp::shutdown();
  }
  if (ros_thread_.joinable()) {
    ros_thread_.join();
  }
}

void MainWindow::onForwardClicked() {
  if (!cmd_pub_ || !rclcpp::ok()) {
    return;
  }
  geometry_msgs::msg::Twist cmd;
  cmd.linear.x = 0.5;
  cmd_pub_->publish(cmd);
  status_label_->setText("Published cmd_vel: linear.x = 0.5 m/s");
}

void MainWindow::onStopClicked() {
  if (!cmd_pub_ || !rclcpp::ok()) {
    return;
  }
  geometry_msgs::msg::Twist cmd;
  cmd.linear.x = 0.0;
  cmd.angular.z = 0.0;
  cmd_pub_->publish(cmd);
  status_label_->setText("Published Emergency Stop (0.0 m/s)");
}
