from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import Command, PathJoinSubstitution
from launch_ros.actions import Node


def generate_launch_description():
    sim_share = get_package_share_directory("sim_bringup")
    desc_share = get_package_share_directory("robot_description")
    gz_share = get_package_share_directory("ros_gz_sim")

    xacro_file = PathJoinSubstitution([desc_share, "urdf", "diff_bot.urdf.xacro"])
    bridge_yaml = PathJoinSubstitution([sim_share, "config", "gz_bridge.yaml"])

    gz_sim = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            PathJoinSubstitution([gz_share, "launch", "gz_sim.launch.py"])
        ),
        launch_arguments={"gz_args": "-r empty.sdf"}.items(),
    )

    rsp = Node(
        package="robot_state_publisher",
        executable="robot_state_publisher",
        parameters=[{
            "use_sim_time": True,
            "robot_description": Command(["xacro ", xacro_file]),
        }],
        output="screen",
    )

    spawn_bot = Node(
        package="ros_gz_sim",
        executable="create",
        arguments=["-topic", "robot_description", "-name", "diff_bot", "-z", "0.1"],
        output="screen",
    )

    bridge = Node(
        package="ros_gz_bridge",
        executable="parameter_bridge",
        parameters=[{"config_file": bridge_yaml}],
        output="screen",
    )

    return LaunchDescription([gz_sim, rsp, spawn_bot, bridge])
