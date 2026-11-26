cmake_minimum_required(VERSION 3.16)
project(robot_hmi LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)
set(CMAKE_AUTOUIC ON)
set(CMAKE_AUTORCC ON)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(Qt6 COMPONENTS Widgets QUIET)
if(NOT Qt6_FOUND)
  find_package(Qt5 COMPONENTS Widgets REQUIRED)
endif()

add_executable(robot_hmi_app
  src/main.cpp
  src/main_window.hpp
  src/main_window.cpp
)

target_link_libraries(robot_hmi_app PUBLIC
  rclcpp::rclcpp
  ${geometry_msgs_TARGETS}
  ${sensor_msgs_TARGETS}
)

if(Qt6_FOUND)
  target_link_libraries(robot_hmi_app PUBLIC Qt6::Widgets)
else()
  target_link_libraries(robot_hmi_app PUBLIC Qt5::Widgets)
endif()

install(TARGETS robot_hmi_app
  DESTINATION lib/${PROJECT_NAME}
)

ament_package()
