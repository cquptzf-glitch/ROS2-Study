#include <algorithm>
#include <utility>
#include <gtest/gtest.h>

namespace chassis_kinematics {

inline std::pair<double, double> twistToWheelSpeeds(
  double linear_mps, double angular_rps, double wheel_base_m, double max_linear_mps) {
  const double v = std::clamp(linear_mps, -max_linear_mps, max_linear_mps);
  const double half_base = wheel_base_m * 0.5;
  return {v - angular_rps * half_base, v + angular_rps * half_base};
}

}  // namespace chassis_kinematics

TEST(ChassisKinematicsTest, ClampsLinearVelocityWithinSafeBounds) {
  auto [left, right] = chassis_kinematics::twistToWheelSpeeds(3.0, 0.0, 0.42, 1.5);
  EXPECT_DOUBLE_EQ(left, 1.5);
  EXPECT_DOUBLE_EQ(right, 1.5);
}

TEST(ChassisKinematicsTest, ComputesDifferentialTurnSpeedsAccurately) {
  auto [left, right] = chassis_kinematics::twistToWheelSpeeds(1.0, 2.0, 0.40, 2.0);
  EXPECT_NEAR(left, 0.6, 1e-9);
  EXPECT_NEAR(right, 1.4, 1e-9);
}

int main(int argc, char ** argv) {
  testing::InitGoogleTest(&argc, argv);
  return RUN_ALL_TESTS();
}
