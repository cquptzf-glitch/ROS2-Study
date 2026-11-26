from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.conditions import IfCondition
from launch.substitutions import Command, LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node


def generate_launch_description():
    desc_share = get_package_share_directory("robot_description")
    xacro_file = PathJoinSubstitution([desc_share, "urdf", "diff_bot.urdf.xacro"])

    use_gui_arg = DeclareLaunchArgument(
        "use_gui",
        default_value="true",
        description="Launch joint_state_publisher_gui to test continuous wheel joints",
    )

    robot_state_publisher = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        parameters=[{
            "robot_description": Command(["xacro ", xacro_file]),
        }],
        output="screen",
    )

    joint_state_publisher_gui = Node(
        package="joint_state_publisher_gui",
        executable="joint_state_publisher_gui",
        condition=IfCondition(LaunchConfiguration("use_gui")),
        output="screen",
    )

    rviz2 = Node(
        package="rviz2",
        executable="rviz2",
        arguments=["-f", "base_footprint"],
        output="screen",
    )

    return LaunchDescription([
        use_gui_arg,
        robot_state_publisher,
        joint_state_publisher_gui,
        rviz2,
    ])
