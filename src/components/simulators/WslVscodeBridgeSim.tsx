import React, { useState } from 'react';
import { Monitor, Terminal, Cpu, Usb, Wifi } from 'lucide-react';

interface WslNodeInfo {
  id: string;
  title: string;
  zone: string;
  detail: string;
  actionCmd: string;
  pitfall: string;
}

const WSL_NODES: WslNodeInfo[] = [
  {
    id: 'win-vscode',
    title: 'Windows 11 VS Code 客户端（仅做界面渲染）',
    zone: 'Windows 宿主机侧',
    detail:
      'Windows 侧只需安装 VS Code 主程序与微软官方扩展“WSL”（ms-vscode-remote.remote-wsl）。切勿在 Windows 侧手动配置 MinGW/MSVC 去打开 \\\\wsl$ 共享目录，否则头文件路径和 Linux ABI 完全对不上。',
    actionCmd: '在 WSL 2 终端直接输入：cd ~/ros2_ws && code .',
    pitfall: '确认窗口左下角显示“WSL: Ubuntu-24.04”状态块，才说明已真正连入 Linux 远端容器。',
  },
  {
    id: 'wsl-clangd',
    title: 'WSL 2 Remote Server + clangd + compile_commands.json',
    zone: 'WSL 2 Linux 远端开发宿主',
    detail:
      '通过 code . 连接后，VS Code 会在 WSL 内自动拉起轻量 VS Code Server。你必须在“WSL 远端标签页”里安装 clangd 与 CMake 扩展，并把 C_Cpp.intelliSenseEngine 设为 disabled，让 clangd 直接读取 colcon 导出的 build/compile_commands.json。',
    actionCmd: 'sudo apt install -y clangd && colcon build --cmake-args -DCMAKE_EXPORT_COMPILE_COMMANDS=ON',
    pitfall: '若在 Windows 装了 C/C++ 插件却没禁用 IntelliSense，两个引擎抢占 CPU 且满屏假红线。',
  },
  {
    id: 'wsl-gdb',
    title: 'VS Code tasks.json + launch.json 一键编译与 F5 GDB 调试',
    zone: 'WSL 2 编译调试闭环',
    detail:
      '在 ros2_ws/.vscode/tasks.json 中配置先 source /opt/ros/jazzy/setup.bash 再执行 colcon build（Ctrl+Shift+B）；在 launch.json 中通过 cppdbg 直接启动 install/ 下的 C++ 可执行节点并注入 ROS_DOMAIN_ID 与 AMENT_PREFIX_PATH，即可直接打断点单步调试回调函数！',
    actionCmd: '按 Ctrl+Shift+B 编译 Debug 版本 -> 按 F5 启动 GDB 断点调试',
    pitfall: '直接用 GDB 启动 install/.../node 时必须保证 environment 注入 AMENT_PREFIX_PATH，否则找不到动态库 .so。',
  },
  {
    id: 'wslg-gpu',
    title: 'WSLg Wayland/X11 + D3D12 GPU 硬件加速桥',
    zone: '图形渲染与硬件透传',
    detail:
      'Windows 11 内置 WSLg，可将 WSL 2 里运行的 RViz2、Modern Gazebo（gz sim）、PlotJuggler 和 Qt 上位机界面无缝渲染成 Windows 原生桌面窗口，并通过 D3D12 映射宿主机独立显卡加速。',
    actionCmd: 'glxinfo -B | grep "OpenGL renderer"  # 应看到 D3D12 或独立 GPU',
    pitfall: '若输出 llvmpipe（纯 CPU 软渲染），Gazebo 会极度卡顿甚至黑屏，需更新 Windows 显卡驱动并设置 GZ_SIM_RENDER_ENGINE_GUI=ogre2。',
  },
  {
    id: 'usbipd-mirrored',
    title: 'usbipd-win 外设透传 & networkingMode=mirrored 镜像网络',
    zone: '外设与局域网跨机通信',
    detail:
      '1) 激光雷达/USB-CAN 适配器插在 Windows 上，用 usbipd attach --wsl 透传进 /dev/ttyUSB0；2) 在 Windows 用户目录 .wslconfig 开启 networkingMode=mirrored，打通 WSL 2 与车间真机的 UDP 组播发现。',
    actionCmd: 'PowerShell: usbipd bind --busid 1-4 && usbipd attach --wsl --busid 1-4',
    pitfall: '更改 .wslconfig 后必须在 PowerShell 执行 wsl --shutdown 完全重启 WSL 2 才生效。',
  },
];

export const WslVscodeBridgeSim: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string>('wsl-clangd');
  const active = WSL_NODES.find((n) => n.id === selectedId) ?? WSL_NODES[0];

  const getIcon = (id: string) => {
    switch (id) {
      case 'win-vscode':
        return <Monitor className="w-4 h-4" aria-hidden="true" />;
      case 'wsl-clangd':
        return <Terminal className="w-4 h-4" aria-hidden="true" />;
      case 'wsl-gdb':
        return <Cpu className="w-4 h-4" aria-hidden="true" />;
      case 'wslg-gpu':
        return <Monitor className="w-4 h-4" aria-hidden="true" />;
      default:
        return <Usb className="w-4 h-4" aria-hidden="true" />;
    }
  };

  return (
    <div
      data-testid="sim-wsl-vscode"
      className="my-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print-break-inside-avoid"
    >
      <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            全景图解 2：Windows 11 下 VS Code 连接 WSL 2 开发调试 ROS 2 架构图
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            点击任意模块查看 Remote-WSL 客户端/服务端分工、clangd 索引与硬件/网络透传要点
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
          交互提示：点击架构块检视配置
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12">
        <div className="lg:col-span-7 p-5 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-950/40">
          <svg
            viewBox="0 0 560 310"
            className="w-full h-auto"
            role="img"
            aria-label="Windows VS Code 连接 WSL 2 开发 ROS 2 架构"
          >
            <defs>
              <marker id="wsl-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M1,1 L7,4 L1,7 Z" fill="#0284c7" />
              </marker>
            </defs>

            {/* Windows Host Zone */}
            <rect
              x="16"
              y="18"
              width="210"
              height="274"
              rx="10"
              fill="rgba(100, 116, 139, 0.05)"
              stroke="#94a3b8"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text x="121" y="38" textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor" className="text-slate-600 dark:text-slate-400">
              Windows 11 宿主机侧
            </text>

            {/* WSL 2 Linux Zone */}
            <rect
              x="266"
              y="18"
              width="278"
              height="274"
              rx="10"
              fill="rgba(2, 132, 199, 0.05)"
              stroke="#0284c7"
              strokeWidth="1"
              strokeDasharray="4 3"
            />
            <text x="405" y="38" textAnchor="middle" fontSize="11" fontWeight="600" fill="#0284c7">
              WSL 2 Ubuntu 24.04（真实编译运行环境）
            </text>

            {/* Box 1: Windows VS Code UI */}
            <g onClick={() => setSelectedId('win-vscode')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="28"
                y="54"
                width="186"
                height="62"
                rx="8"
                fill={selectedId === 'win-vscode' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                stroke={selectedId === 'win-vscode' ? '#0284c7' : '#94a3b8'}
                strokeWidth={selectedId === 'win-vscode' ? '2' : '1.2'}
              />
              <text x="121" y="79" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                VS Code 客户端 (UI)
              </text>
              <text x="121" y="99" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                扩展：Remote - WSL
              </text>
            </g>

            {/* Arrow: Remote-WSL Socket */}
            <line x1="214" y1="85" x2="278" y2="85" stroke="#0284c7" strokeWidth="1.8" markerEnd="url(#wsl-arrow)" />
            <text x="246" y="76" textAnchor="middle" fontSize="9.5" fill="#0284c7">
              code .
            </text>

            {/* Box 2: WSL Remote Server + clangd */}
            <g onClick={() => setSelectedId('wsl-clangd')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="280"
                y="54"
                width="250"
                height="68"
                rx="8"
                fill={selectedId === 'wsl-clangd' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                stroke={selectedId === 'wsl-clangd' ? '#0284c7' : '#94a3b8'}
                strokeWidth={selectedId === 'wsl-clangd' ? '2' : '1.2'}
              />
              <text x="405" y="77" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                VS Code Server + clangd
              </text>
              <text x="405" y="96" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                build/compile_commands.json
              </text>
              <text x="405" y="112" textAnchor="middle" fontSize="9.5" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                毫秒级跳转 · 禁用 C_Cpp IntelliSense
              </text>
            </g>

            {/* Box 3: colcon + GDB */}
            <g onClick={() => setSelectedId('wsl-gdb')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="280"
                y="136"
                width="250"
                height="66"
                rx="8"
                fill={selectedId === 'wsl-gdb' ? 'rgba(2, 132, 199, 0.14)' : 'transparent'}
                stroke={selectedId === 'wsl-gdb' ? '#0284c7' : '#94a3b8'}
                strokeWidth={selectedId === 'wsl-gdb' ? '2' : '1.2'}
              />
              <text x="405" y="160" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                colcon build & F5 GDB 调试
              </text>
              <text x="405" y="178" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                .vscode/tasks.json + launch.json
              </text>
              <text x="405" y="194" textAnchor="middle" fontSize="9.5" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                一键编译 · 断点调试 rclcpp 回调
              </text>
            </g>

            {/* Box 4: WSLg GPU */}
            <g onClick={() => setSelectedId('wslg-gpu')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="28"
                y="136"
                width="186"
                height="66"
                rx="8"
                fill={selectedId === 'wslg-gpu' ? 'rgba(5, 150, 105, 0.14)' : 'transparent'}
                stroke={selectedId === 'wslg-gpu' ? '#059669' : '#94a3b8'}
                strokeWidth={selectedId === 'wslg-gpu' ? '2' : '1.2'}
              />
              <text x="121" y="160" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                WSLg 图形窗口输出
              </text>
              <text x="121" y="178" textAnchor="middle" fontSize="9.5" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                D3D12 OpenGL GPU 加速
              </text>
              <text x="121" y="194" textAnchor="middle" fontSize="9.5" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                RViz2 · Gazebo · Qt 上位机
              </text>
            </g>
            <line x1="280" y1="169" x2="216" y2="169" stroke="#059669" strokeWidth="1.6" strokeDasharray="3 2" markerEnd="url(#wsl-arrow)" />

            {/* Box 5: usbipd + mirrored network */}
            <g onClick={() => setSelectedId('usbipd-mirrored')} className="cursor-pointer" role="button" tabIndex={0}>
              <rect
                x="28"
                y="218"
                width="502"
                height="60"
                rx="8"
                fill={selectedId === 'usbipd-mirrored' ? 'rgba(217, 119, 6, 0.14)' : 'transparent'}
                stroke={selectedId === 'usbipd-mirrored' ? '#d97706' : '#94a3b8'}
                strokeWidth={selectedId === 'usbipd-mirrored' ? '2' : '1.2'}
              />
              <text x="279" y="242" textAnchor="middle" fontSize="12" fontWeight="600" fill="currentColor" className="text-slate-900 dark:text-slate-100">
                usbipd-win 外设透传 (/dev/ttyUSB*) + networkingMode=mirrored 镜像网络
              </text>
              <text x="279" y="262" textAnchor="middle" fontSize="10" fontFamily="JetBrains Mono, monospace" fill="currentColor" className="text-slate-500 dark:text-slate-400">
                解决激光雷达/CAN卡识别 + 局域网实机 DDS UDP 组播互通
              </text>
            </g>
          </svg>

          <div className="mt-3 flex flex-wrap gap-1.5 no-print">
            {WSL_NODES.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedId(n.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedId === n.id
                    ? 'bg-sky-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {getIcon(n.id)}
                <span>{n.title.split('（')[0].split('+')[0].trim()}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-5 p-5 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-mono text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{active.zone}</span>
              </div>
              <h5 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-1">{active.title}</h5>
            </div>

            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{active.detail}</p>

            <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">标准配置 / 验证命令</div>
              <code className="text-xs font-mono text-sky-700 dark:text-sky-300 break-all">{active.actionCmd}</code>
            </div>

            <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60">
              <div className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">新手常见避坑</div>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{active.pitfall}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
