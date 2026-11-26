import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateQosCompatibility,
  calculateZeroCopyMetrics,
  getDeadlockTrace,
  transitionLifecycleState,
  calculateChecklistProgress,
  getCppPitfallScenario,
} from './ros2Simulators';
import { searchHandbook } from './searchIndex';

test('QoS compatibility follows Offered >= Requested rule', () => {
  const ok = evaluateQosCompatibility(
    { reliability: 'reliable', durability: 'transient_local' },
    { reliability: 'best_effort', durability: 'volatile' }
  );
  assert.equal(ok.compatible, true);

  const failReliability = evaluateQosCompatibility(
    { reliability: 'best_effort', durability: 'volatile' },
    { reliability: 'reliable', durability: 'volatile' }
  );
  assert.equal(failReliability.compatible, false);
  assert.equal(failReliability.reliabilityMatch, false);

  const failDurability = evaluateQosCompatibility(
    { reliability: 'reliable', durability: 'volatile' },
    { reliability: 'reliable', durability: 'transient_local' }
  );
  assert.equal(failDurability.compatible, false);
  assert.equal(failDurability.durabilityMatch, false);
});

test('Zero-copy metrics compare intra-process vs inter-process accurately', () => {
  const intra = calculateZeroCopyMetrics('intra_process_unique_ptr', 6.2);
  assert.equal(intra.copiesCount, 0);
  assert.equal(intra.totalBandwidthMb, 0);
  assert.equal(intra.sameProcessRequired, true);

  const inter = calculateZeroCopyMetrics('inter_process', 6.2);
  assert.equal(inter.copiesCount, 4);
  assert.ok(inter.totalBandwidthMb > 20);
  assert.equal(inter.sameProcessRequired, false);
});

test('Executor deadlock trace detects deadlock in both Single and Multi MutuallyExclusive', () => {
  const single = getDeadlockTrace('single_mutually_exclusive');
  assert.equal(single[single.length - 1].isDeadlocked, true);

  const multiSingleGroup = getDeadlockTrace('multi_mutually_exclusive');
  assert.equal(multiSingleGroup[multiSingleGroup.length - 1].isDeadlocked, true);

  const multiReentrant = getDeadlockTrace('multi_reentrant');
  assert.equal(multiReentrant[multiReentrant.length - 1].isDeadlocked, false);

  const multiDual = getDeadlockTrace('multi_dual_groups');
  assert.equal(multiDual[multiDual.length - 1].isDeadlocked, false);
});

test('LifecycleNode state machine enforces valid ROS 2 transitions', () => {
  const s1 = transitionLifecycleState('unconfigured', 'configure');
  assert.equal(s1.valid, true);
  assert.equal(s1.state, 'inactive');

  const illegal = transitionLifecycleState('unconfigured', 'activate');
  assert.equal(illegal.valid, false);
  assert.equal(illegal.state, 'unconfigured');

  const s2 = transitionLifecycleState(s1.state, 'activate');
  assert.equal(s2.valid, true);
  assert.equal(s2.state, 'active');

  const s3 = transitionLifecycleState(s2.state, 'deactivate');
  assert.equal(s3.valid, true);
  assert.equal(s3.state, 'inactive');

  const s4 = transitionLifecycleState(s3.state, 'shutdown');
  assert.equal(s4.valid, true);
  assert.equal(s4.state, 'finalized');
});

test('Checklist progress calculates percentage safely', () => {
  assert.deepEqual(calculateChecklistProgress(['a', 'b', 'a'], 10), {
    completed: 2,
    total: 10,
    percent: 20,
  });
  assert.deepEqual(calculateChecklistProgress([], 0), {
    completed: 0,
    total: 0,
    percent: 0,
  });
});

test('CppOwnershipPitfallSim returns complete bug/fix phases for all 4 scenarios', () => {
  const scenarios = [
    'shared_from_this_ctor',
    'member_destruction_order',
    'lambda_this_dangling',
    'unique_ptr_use_after_move',
  ] as const;

  for (const id of scenarios) {
    const s = getCppPitfallScenario(id);
    assert.equal(s.id, id);
    assert.equal(s.phases.length, 3);
    assert.ok(s.phases.some((p) => p.isFatalInBug));
    assert.ok(s.badCode.length > 20 && s.goodCode.length > 20);
  }
});

test('searchHandbook finds matches across sections, code, tables, and interview bank', () => {
  const qtHits = searchHandbook('QueuedConnection');
  assert.ok(qtHits.length >= 2);
  assert.ok(qtHits.some((h) => h.kind === '面试题'));
  assert.ok(qtHits.some((h) => h.kind === '代码'));

  const btHits = searchHandbook('BT_REGISTER_NODES');
  assert.ok(btHits.some((h) => h.kind === '代码' && h.anchorId === 'm6-nav2-moveit2'));

  const zenohHits = searchHandbook('rmw_zenoh_cpp');
  assert.ok(zenohHits.some((h) => h.kind === '章节' && h.anchorId === 'm4-lifecycle-dds'));

  const installHits = searchHandbook('rosdep');
  assert.ok(installHits.some((h) => h.anchorId === 'm1-workspace-overlay'));
  assert.ok(installHits.some((h) => h.anchorId === 'm1-install-deploy'));

  const starterHits = searchHandbook('minimal_pubsub_node');
  assert.ok(starterHits.some((h) => h.anchorId === 'm2-first-cpp-node'));

  const syncHits = searchHandbook('ApproximateTime');
  assert.ok(syncHits.some((h) => h.anchorId === 'm5-tf2-cpp'));

  const slamHits = searchHandbook('slam_toolbox');
  assert.ok(slamHits.some((h) => h.anchorId === 'm6-nav2-moveit2'));

  const gtestHits = searchHandbook('ament_add_gtest');
  assert.ok(gtestHits.some((h) => h.anchorId === 'm6-debug-docker'));

  const wslVscodeHits = searchHandbook('Remote-WSL');
  assert.ok(wslVscodeHits.some((h) => h.anchorId === 'm1-ide-clangd'));

  const timerHits = searchHandbook('create_timer');
  assert.ok(timerHits.some((h) => h.anchorId === 'm2-first-cpp-node'));

  const twistStampedHits = searchHandbook('TwistStamped');
  assert.ok(twistStampedHits.some((h) => h.anchorId === 'm2-modern-cmake'));

  const rtHits = searchHandbook('PREEMPT_RT');
  assert.ok(rtHits.some((h) => h.anchorId === 'm3-production-deploy'));

  const diagHits = searchHandbook('diagnostic_updater');
  assert.ok(diagHits.some((h) => h.anchorId === 'm6-debug-docker'));

  const cppPitfallHits = searchHandbook('weak_from_this');
  assert.ok(cppPitfallHits.some((h) => h.anchorId === 'm8cpp-tricky-pitfalls'));
  assert.ok(cppPitfallHits.some((h) => h.anchorId === 'interview-q-25' && h.moduleLabel === '模块 09'));

  const scopedLockHits = searchHandbook('scoped_lock');
  assert.ok(scopedLockHits.some((h) => h.anchorId === 'm8cpp-modern-syntax'));

  assert.deepEqual(searchHandbook('   '), []);
});
