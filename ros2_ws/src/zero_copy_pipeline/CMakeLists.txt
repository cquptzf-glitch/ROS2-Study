cmake_minimum_required(VERSION 3.16)
project(zero_copy_pipeline LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(rclcpp_components REQUIRED)
find_package(sensor_msgs REQUIRED)

add_library(zero_copy_components SHARED
  src/intra_process_components.cpp
)

target_link_libraries(zero_copy_components PUBLIC
  rclcpp::rclcpp
  rclcpp_components::component
  ${sensor_msgs_TARGETS}
)

rclcpp_components_register_nodes(zero_copy_components
  "zero_copy_pipeline::CameraProducerComponent"
)
rclcpp_components_register_nodes(zero_copy_components
  "zero_copy_pipeline::PerceptionConsumerComponent"
)

install(TARGETS zero_copy_components
  ARCHIVE DESTINATION lib
  LIBRARY DESTINATION lib
  RUNTIME DESTINATION bin
)

install(DIRECTORY launch
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
