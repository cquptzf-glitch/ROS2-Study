cmake_minimum_required(VERSION 3.16)
project(arm_planner LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(moveit_ros_planning_interface REQUIRED)
find_package(geometry_msgs REQUIRED)

add_executable(moveit_pose_demo src/moveit_pose_demo.cpp)
target_link_libraries(moveit_pose_demo PUBLIC
  rclcpp::rclcpp
  moveit_ros_planning_interface::moveit_move_group_interface
  ${geometry_msgs_TARGETS}
)

install(TARGETS moveit_pose_demo
  DESTINATION lib/${PROJECT_NAME}
)

ament_package()
