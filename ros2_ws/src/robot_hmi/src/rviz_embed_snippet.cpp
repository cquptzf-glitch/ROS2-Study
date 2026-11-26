// Reference snippet showing how to embed rviz_common::RenderPanel inside a Qt widget layout.
// Requires linking rviz_common::rviz_common and rviz_rendering::rviz_rendering in CMakeLists.txt.
#include <memory>
#include <QVBoxLayout>
#include "rclcpp/rclcpp.hpp"
#include "rviz_common/render_panel.hpp"
#include "rviz_common/visualization_manager.hpp"
#include "rviz_common/ros_integration/ros_node_abstraction.hpp"

inline void attachEmbeddedRviz(QWidget * parent, QVBoxLayout * layout, const rclcpp::Node::SharedPtr & ros_node) {
  auto rviz_ros_node = std::make_shared<rviz_common::ros_integration::RosNodeAbstraction>("rviz_embed_node");
  auto * render_panel = new rviz_common::RenderPanel(parent);
  layout->addWidget(render_panel);

  auto * viz_manager = new rviz_common::VisualizationManager(
    render_panel, rviz_ros_node, nullptr, ros_node->get_clock());
  render_panel->initialize(viz_manager);
  viz_manager->initialize();
  viz_manager->startUpdate();

  viz_manager->createDisplay("rviz_default_plugins/Grid", "GroundGrid", true);
  auto * scan_display = viz_manager->createDisplay("rviz_default_plugins/LaserScan", "LidarScan", true);
  scan_display->subProp("Topic")->setValue("/scan");
  scan_display->subProp("Size (m)")->setValue(0.05);
}
