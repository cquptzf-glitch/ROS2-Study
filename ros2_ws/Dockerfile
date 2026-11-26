# Stage 1: Build stage
FROM ros:jazzy-ros-base AS builder
WORKDIR /ws
COPY src/ ./src/

RUN apt-get update && \
    rosdep update && \
    rosdep install --from-paths src --ignore-src -r -y && \
    rm -rf /var/lib/apt/lists/*

RUN . /opt/ros/jazzy/setup.sh && \
    colcon build \
      --packages-up-to chassis_core system_bringup zero_copy_pipeline \
      --cmake-args -DCMAKE_BUILD_TYPE=Release

# Stage 2: Minimal runtime stage
FROM ros:jazzy-ros-core AS runtime
WORKDIR /app
COPY --from=builder /ws/install /app/install

RUN echo "source /opt/ros/jazzy/setup.bash" >> ~/.bashrc && \
    echo "source /app/install/setup.bash" >> ~/.bashrc

CMD ["bash", "-c", "source /opt/ros/jazzy/setup.bash && source /app/install/setup.bash && ros2 launch chassis_core robot_bringup.launch.py"]
