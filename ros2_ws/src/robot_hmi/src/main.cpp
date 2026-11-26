#include <QApplication>
#include "rclcpp/rclcpp.hpp"
#include "main_window.hpp"

int main(int argc, char * argv[]) {
  rclcpp::init(argc, argv);

  QApplication app(argc, argv);
  MainWindow window;
  window.show();

  int ret = app.exec();

  if (rclcpp::ok()) {
    rclcpp::shutdown();
  }
  return ret;
}
