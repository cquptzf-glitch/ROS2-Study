from launch import LaunchDescription
from launch_ros.actions import ComposableNodeContainer
from launch_ros.descriptions import ComposableNode


def generate_launch_description():
    container = ComposableNodeContainer(
        name="perception_container",
        namespace="",
        package="rclcpp_components",
        executable="component_container_mt",
        composable_node_descriptions=[
            ComposableNode(
                package="zero_copy_pipeline",
                plugin="zero_copy_pipeline::CameraProducerComponent",
                name="camera_producer",
                extra_arguments=[{"use_intra_process_comms": True}],
            ),
            ComposableNode(
                package="zero_copy_pipeline",
                plugin="zero_copy_pipeline::PerceptionConsumerComponent",
                name="perception_consumer",
                extra_arguments=[{"use_intra_process_comms": True}],
            ),
        ],
        output="screen",
    )
    return LaunchDescription([container])
