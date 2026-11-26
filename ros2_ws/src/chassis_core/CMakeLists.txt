cmake_minimum_required(VERSION 3.16)
project(chassis_core LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(rclcpp_action REQUIRED)
find_package(rclcpp_lifecycle REQUIRED)
find_package(std_msgs REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(message_filters REQUIRED)
find_package(tf2 REQUIRED)
find_package(tf2_ros REQUIRED)
find_package(tf2_geometry_msgs REQUIRED)
find_package(chassis_interfaces REQUIRED)

add_executable(minimal_pubsub_node src/minimal_pubsub_node.cpp)
target_link_libraries(minimal_pubsub_node PUBLIC
  rclcpp::rclcpp
  ${std_msgs_TARGETS}
)

add_executable(chassis_manager_node src/chassis_manager_node.cpp)
target_link_libraries(chassis_manager_node PUBLIC
  rclcpp::rclcpp
  rclcpp_action::rclcpp_action
  ${geometry_msgs_TARGETS}
  ${chassis_interfaces_TARGETS}
)

add_executable(chassis_client_node src/chassis_client_node.cpp)
target_link_libraries(chassis_client_node PUBLIC
  rclcpp::rclcpp
  rclcpp_action::rclcpp_action
  ${chassis_interfaces_TARGETS}
)

add_executable(deadlock_free_client_node src/deadlock_free_client_node.cpp)
target_link_libraries(deadlock_free_client_node PUBLIC
  rclcpp::rclcpp
  ${chassis_interfaces_TARGETS}
)

add_executable(lidar_lifecycle_node src/lidar_lifecycle_node.cpp)
target_link_libraries(lidar_lifecycle_node PUBLIC
  rclcpp::rclcpp
  rclcpp_lifecycle::rclcpp_lifecycle
  ${sensor_msgs_TARGETS}
)

add_executable(tf2_pipeline_node src/tf2_pipeline_node.cpp)
target_link_libraries(tf2_pipeline_node PUBLIC
  rclcpp::rclcpp
  tf2::tf2
  tf2_ros::tf2_ros
  ${geometry_msgs_TARGETS}
  ${tf2_geometry_msgs_TARGETS}
)

add_executable(sensor_sync_node src/sensor_sync_node.cpp)
target_link_libraries(sensor_sync_node PUBLIC
  rclcpp::rclcpp
  message_filters::message_filters
  ${nav_msgs_TARGETS}
  ${sensor_msgs_TARGETS}
)

add_executable(cpp_pitfalls_node src/cpp_pitfalls_node.cpp)
target_link_libraries(cpp_pitfalls_node PUBLIC
  rclcpp::rclcpp
  ${geometry_msgs_TARGETS}
)

install(TARGETS
  minimal_pubsub_node
  chassis_manager_node
  chassis_client_node
  deadlock_free_client_node
  lidar_lifecycle_node
  tf2_pipeline_node
  sensor_sync_node
  cpp_pitfalls_node
  DESTINATION lib/${PROJECT_NAME}
)

install(DIRECTORY launch config
  DESTINATION share/${PROJECT_NAME}
)

if(BUILD_TESTING)
  find_package(ament_cmake_gtest REQUIRED)
  ament_add_gtest(test_chassis_kinematics test/test_chassis_kinematics.cpp)
endif()

ament_package()
