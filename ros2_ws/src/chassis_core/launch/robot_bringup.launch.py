from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument, GroupAction, LogInfo
from launch.conditions import IfCondition
from launch.substitutions import LaunchConfiguration, PathJoinSubstitution
from launch_ros.actions import Node, PushRosNamespace


def generate_launch_description():
    pkg_share = get_package_share_directory("chassis_core")

    robot_ns_arg = DeclareLaunchArgument(
        "robot_ns",
        default_value="amr_01",
        description="Robot namespace for multi-fleet isolation",
    )
    use_sim_time_arg = DeclareLaunchArgument(
        "use_sim_time",
        default_value="false",
        description="Use simulation clock /clock if true",
    )
    enable_safety_arg = DeclareLaunchArgument(
        "enable_safety_filter",
        default_value="false",
        description="Launch optional twist_mux velocity safety limiter node",
    )

    robot_ns = LaunchConfiguration("robot_ns")
    use_sim_time = LaunchConfiguration("use_sim_time")
    enable_safety_filter = LaunchConfiguration("enable_safety_filter")

    params_file = PathJoinSubstitution([pkg_share, "config", "chassis_params.yaml"])

    robot_group = GroupAction(
        actions=[
            PushRosNamespace(robot_ns),
            LogInfo(msg=["Starting ROS 2 C++ chassis stack under namespace: ", robot_ns]),
            Node(
                package="chassis_core",
                executable="chassis_manager_node",
                name="chassis_manager_node",
                output="screen",
                emulate_tty=True,
                parameters=[
                    params_file,
                    {"use_sim_time": use_sim_time},
                ],
                remappings=[
                    ("cmd_vel", "cmd_vel_safe"),
                    ("wheel_telemetry", "diagnostics/wheel_telemetry"),
                ],
                respawn=True,
                respawn_delay=2.0,
            ),
            Node(
                package="twist_mux",
                executable="twist_mux",
                name="twist_mux",
                condition=IfCondition(enable_safety_filter),
                output="screen",
                parameters=[{"use_sim_time": use_sim_time}],
                remappings=[("cmd_vel_out", "cmd_vel_safe")],
            ),
        ]
    )

    return LaunchDescription(
        [
            robot_ns_arg,
            use_sim_time_arg,
            enable_safety_arg,
            robot_group,
        ]
    )
