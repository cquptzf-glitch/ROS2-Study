cmake_minimum_required(VERSION 3.16)
project(nav2_custom_bt LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(behaviortree_cpp REQUIRED)

add_library(check_battery_bt_node SHARED
  src/check_battery_condition.cpp
)
target_compile_definitions(check_battery_bt_node PRIVATE BT_PLUGIN_EXPORT)
target_link_libraries(check_battery_bt_node PUBLIC
  rclcpp::rclcpp
  behaviortree_cpp::behaviortree_cpp
)

install(TARGETS check_battery_bt_node
  ARCHIVE DESTINATION lib
  LIBRARY DESTINATION lib
  RUNTIME DESTINATION bin
)

ament_package()
