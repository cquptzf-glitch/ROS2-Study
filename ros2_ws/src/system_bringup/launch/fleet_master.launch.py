from ament_index_python.packages import get_package_share_directory
from launch import LaunchDescription
from launch.actions import IncludeLaunchDescription
from launch.launch_description_sources import PythonLaunchDescriptionSource
from launch.substitutions import PathJoinSubstitution


def generate_launch_description():
    chassis_share = get_package_share_directory("chassis_core")

    amr_01 = IncludeLaunchDescription(
        PythonLaunchDescriptionSource(
            PathJoinSubstitution([chassis_share, "launch", "robot_bringup.launch.py"])
        ),
        launch_arguments={
            "robot_ns": "amr_01",
            "use_sim_time": "true",
            "enable_safety_filter": "true",
        }.items(),
    )

    return LaunchDescription([amr_01])
