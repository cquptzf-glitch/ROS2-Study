import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Printer,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { MODULES_PART_1 } from './data/modulesPart1';
import { MODULES_PART_2 } from './data/modulesPart2';
import { ModuleRenderer } from './components/ModuleRenderer';
import { InterviewAndChecklist } from './components/InterviewAndChecklist';
import { searchHandbook } from './logic/searchIndex';

const ALL_MODULES = [...MODULES_PART_1, ...MODULES_PART_2];

interface TocItem {
  id: string;
  number: string;
  shortTitle: string;
  sections: { id: string; title: string }[];
}

const TOC_ITEMS: TocItem[] = [
  ...ALL_MODULES.map((m) => ({
    id: m.id,
    number: m.number,
    shortTitle: m.shortTitle,
    sections: m.sections.map((s) => ({ id: s.id, title: s.title })),
  })),
  {
    id: 'module-9',
    number: '09',
    shortTitle: '28 道面试精讲与 8 周清单',
    sections: [
      { id: 'm9-interview-bank', title: '9.1 企业级高频面试题库（28 题）' },
      { id: 'm9-checklist', title: '9.2 8 周转 ROS 2 上岗自检清单' },
    ],
  },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ros2_handbook_theme') === 'dark';
    } catch {
      return false;
    }
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [activeModuleId, setActiveModuleId] = useState<string>('module-1');
  const searchWrapperRef = useRef<HTMLDivElement>(null);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('ros2_handbook_theme', darkMode ? 'dark' : 'light');
    } catch {
      // Ignore storage failures
    }
  }, [darkMode]);

  // Accurate scroll-spy for left navigation highlighting
  useEffect(() => {
    const moduleElements = Array.from(document.querySelectorAll<HTMLElement>('section[data-module-id]'));
    if (moduleElements.length === 0) return;

    let ticking = false;
    let settleTimer: number | undefined;

    const updateActive = () => {
      ticking = false;
      let currentId = moduleElements[0].getAttribute('data-module-id') ?? 'module-1';
      for (const el of moduleElements) {
        const top = el.getBoundingClientRect().top;
        if (top <= 160) {
          const id = el.getAttribute('data-module-id');
          if (id) currentId = id;
        }
      }
      setActiveModuleId(currentId);
    };

    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(updateActive);
      }
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer);
      }
      settleTimer = window.setTimeout(updateActive, 140);
    };

    updateActive();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scrollend', updateActive, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('scrollend', updateActive);
      if (settleTimer !== undefined) {
        window.clearTimeout(settleTimer);
      }
    };
  }, []);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapperRef.current && !searchWrapperRef.current.contains(e.target as Node)) {
        setSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchHits = useMemo(() => searchHandbook(searchQuery), [searchQuery]);

  const scrollToAnchor = (anchorId: string) => {
    const el = document.getElementById(anchorId);
    if (el) {
      const ownerSection = el.closest('section[data-module-id]');
      const ownerId = ownerSection?.getAttribute('data-module-id');
      if (ownerId) {
        setActiveModuleId(ownerId);
      } else if (anchorId === 'top') {
        setActiveModuleId('module-1');
      }
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    setSearchFocused(false);
    setMobileMenuOpen(false);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Top Bar (Fixed single-row workspace bar) */}
      <header className="no-print sticky top-0 z-40 h-14 bg-white/90 dark:bg-slate-900/90 backdrop-blur border-b border-slate-200 dark:border-slate-800 px-4 lg:px-6 flex items-center justify-between gap-4">
        {/* Zone 1: Sidebar toggle + Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={sidebarOpen ? '折叠章节目录' : '展开章节目录'}
            className="hidden lg:inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label="打开移动导航目录"
            className="lg:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-4 h-4" aria-hidden="true" />
          </button>
          <a
            href="#top"
            className="font-semibold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            <span className="hidden sm:inline">C++ 速通 ROS 2 研发指南</span>
            <span className="sm:hidden">C++ × ROS 2</span>
          </a>
        </div>

        {/* Zone 2: Global Real-Time Search */}
        <div ref={searchWrapperRef} className="relative flex-1 max-w-md">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              aria-label="全局关键词搜索"
              value={searchQuery}
              onFocus={() => setSearchFocused(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchFocused(true);
              }}
              placeholder="搜索节点、死锁、QoS、CMake、Qt、面试题..."
              className="w-full h-9 pl-9 pr-8 rounded-lg text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40 focus:border-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="清空搜索词"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          {searchFocused && searchQuery.trim().length > 0 && (
            <div
              data-testid="search-results-dropdown"
              className="absolute left-0 right-0 mt-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-lg max-h-96 overflow-y-auto z-50 divide-y divide-slate-100 dark:divide-slate-800"
            >
              {searchHits.length === 0 ? (
                <div className="p-4 text-xs text-slate-500 dark:text-slate-400 text-center">
                  未找到包含 “{searchQuery}” 的内容
                </div>
              ) : (
                searchHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    onClick={() => scrollToAnchor(hit.anchorId)}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/70 transition-colors cursor-pointer"
                  >
                    <div className="text-[11px] font-mono text-sky-700 dark:text-sky-400 flex items-center gap-1.5">
                      <span>{hit.moduleLabel}</span>
                      <span aria-hidden="true">·</span>
                      <span>{hit.kind}</span>
                    </div>
                    <div className="text-xs sm:text-sm font-medium text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                      {hit.title}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {hit.snippet}
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Zone 3: Theme Toggle + Print/Export PDF */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setDarkMode((v) => !v)}
            aria-label={darkMode ? '切换浅色主题' : '切换深色主题'}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {darkMode ? (
              <Sun className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
            )}
            <span className="hidden sm:inline">{darkMode ? '浅色' : '深色'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-sky-600 hover:bg-sky-700 text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">打印 / 导出 PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
        </div>
      </header>

      <div className="flex max-w-[1440px] mx-auto">
        {/* Desktop Collapsible Left Sidebar */}
        {sidebarOpen && (
          <aside
            aria-label="章节导航目录"
            className="no-print hidden lg:block w-72 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 px-4 py-6"
          >
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 px-2 mb-3">
              课程章节导航（共 9 模块）
            </div>
            <nav className="space-y-4">
              {TOC_ITEMS.map((item) => {
                const isActive = activeModuleId === item.id;
                return (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => scrollToAnchor(item.id)}
                      className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer ${
                        isActive
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
                      }`}
                    >
                      <span className="font-mono tabular-nums text-[11px] opacity-80">{item.number}.</span>
                      <span className="truncate">{item.shortTitle}</span>
                    </button>
                    <div className="pl-6 space-y-0.5">
                      {item.sections.map((sec) => (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => scrollToAnchor(sec.id)}
                          className="w-full text-left px-2 py-1 rounded text-[11.5px] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 truncate transition-colors cursor-pointer"
                        >
                          {sec.title}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </nav>
          </aside>
        )}

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <div className="no-print fixed inset-0 z-50 lg:hidden flex">
            <div
              className="fixed inset-0 bg-slate-950/50"
              onClick={() => setMobileMenuOpen(false)}
              aria-hidden="true"
            />
            <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-slate-900 h-full overflow-y-auto p-5 border-r border-slate-200 dark:border-slate-800 z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-semibold">章节导航目录</span>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="关闭目录"
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
              <nav className="space-y-3">
                {TOC_ITEMS.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => scrollToAnchor(item.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                        activeModuleId === item.id
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      <span className="font-mono tabular-nums">{item.number}.</span>
                      <span>{item.shortTitle}</span>
                    </button>
                  </div>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main Content Area */}
        <main id="top" className="flex-1 min-w-0 px-5 sm:px-8 lg:px-12 py-8 print-full-width">
          <div className="max-w-4xl mx-auto">
            {/* Editorial Document Hero */}
            <header className="pb-10 mb-8 border-b border-slate-200 dark:border-slate-800">
              <div className="text-xs font-mono text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sky-700 dark:text-sky-400 font-semibold">现代 C++17 + ament_cmake 全栈</span>
                <span aria-hidden="true">·</span>
                <span>Humble (22.04) / Jazzy (24.04) / Lyrical Luth (26.04 LTS)</span>
                <span aria-hidden="true">·</span>
                <span>10 个交互图解与模拟器 + 28 道真题</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                C++ 开发者速通 ROS 2 研发工程师：从零基础到上岗面试实战指南
              </h1>

              <p className="mt-4 text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                本指南专为已具备现代 C++17 与基础 CMake 经验、但对机器人操作系统（ROS）体系零基础的工程师打造。全篇涵盖 ROS 2 基础架构概览、Ubuntu / Windows VS Code 远程 WSL 2 完整配置、现代 C++ 核心通信与时间体系、多线程回调组防死锁、同进程零拷贝、ros2_control 硬件插件、Modern Gazebo + Nav2 仿真、Qt 上位机开发及 ROS 2 核心 C++ 避坑精讲；完整可编译运行的 ROS 2 工程源码独立存放于 <code className="px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-800 text-xs">ros2_ws/</code> 目录。
              </p>

              {/* Quick Module Jump Bar */}
              <div className="no-print mt-6 flex flex-wrap gap-2">
                {TOC_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToAnchor(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 text-slate-700 dark:text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {item.number}. {item.shortTitle}
                  </button>
                ))}
              </div>
            </header>

            {/* Modules 1 - 8 */}
            <div className="space-y-12">
              {ALL_MODULES.map((mod) => (
                <ModuleRenderer key={mod.id} module={mod} />
              ))}
            </div>

            {/* Module 9: 28 Interview Questions + 8-Week Checklist */}
            <InterviewAndChecklist searchQuery={searchQuery} />

            {/* Quiet Editorial Footer */}
            <footer className="pt-8 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4">
              <div>
                C++ 开发者速通 ROS 2 研发工程师实战指南 · 覆盖 Humble / Jazzy / Lyrical Luth (2026 LTS)
              </div>
              <div className="no-print flex items-center gap-4">
                <a href="#top" className="hover:text-slate-900 dark:hover:text-slate-200">
                  返回顶部
                </a>
                <button
                  type="button"
                  onClick={handlePrintPdf}
                  className="hover:text-slate-900 dark:hover:text-slate-200 cursor-pointer"
                >
                  导出 PDF 备忘录
                </button>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
