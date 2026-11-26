from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import RegisterEventHandler
from launch.event_handlers import OnProcessExit
from launch.substitutions import Command, PathJoinSubstitution
from launch_ros.actions import Node


def generate_launch_description():
    desc_share = get_package_share_directory("robot_description")
    hw_share = get_package_share_directory("diff_hw_interface")

    xacro_file = PathJoinSubstitution([desc_share, "urdf", "diff_bot.urdf.xacro"])
    controllers_yaml = PathJoinSubstitution([hw_share, "config", "controllers.yaml"])
    robot_description = {"robot_description": Command(["xacro ", xacro_file])}

    robot_state_publisher = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        parameters=[robot_description],
        output="screen",
    )

    control_node = Node(
        package="controller_manager",
        executable="ros2_control_node",
        parameters=[robot_description, controllers_yaml],
        output="both",
    )

    joint_state_broadcaster_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=["joint_state_broadcaster", "--controller-manager", "/controller_manager"],
        output="screen",
    )

    diff_drive_controller_spawner = Node(
        package="controller_manager",
        executable="spawner",
        arguments=["diff_drive_base_controller", "--controller-manager", "/controller_manager"],
        output="screen",
    )

    # 工业级顺序依赖：等 joint_state_broadcaster 激活后再加载差速控制器
    delay_diff_drive_after_jsb = RegisterEventHandler(
        event_handler=OnProcessExit(
            target_action=joint_state_broadcaster_spawner,
            on_exit=[diff_drive_controller_spawner],
        )
    )

    return LaunchDescription([
        robot_state_publisher,
        control_node,
        joint_state_broadcaster_spawner,
        delay_diff_drive_after_jsb,
    ])
