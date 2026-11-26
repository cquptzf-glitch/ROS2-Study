import React, { useState } from 'react';
import { Check, Copy, FileCode2 } from 'lucide-react';
import { CodeBlockData, CodeLanguage } from '../types/handbook';

interface Token {
  text: string;
  cls: string;
}

const CPP_KEYWORDS = new Set([
  'class', 'public', 'private', 'protected', 'explicit', 'virtual', 'override',
  'const', 'constexpr', 'auto', 'void', 'int', 'double', 'float', 'bool', 'char',
  'size_t', 'uint8_t', 'uint32_t', 'if', 'else', 'for', 'while', 'return', 'using',
  'namespace', 'new', 'delete', 'true', 'false', 'nullptr', 'try', 'catch', 'struct',
  'static', 'include', 'ifndef', 'define', 'endif', 'slots', 'this',
]);

const CMAKE_KEYWORDS = new Set([
  'cmake_minimum_required', 'project', 'set', 'if', 'endif', 'find_package',
  'add_executable', 'add_library', 'add_compile_options', 'target_include_directories',
  'target_link_libraries', 'install', 'ament_package', 'ament_export_dependencies',
  'rosidl_generate_interfaces', 'rclcpp_components_register_nodes', 'PUBLIC', 'PRIVATE',
  'REQUIRED', 'SHARED', 'LANGUAGES', 'CXX', 'VERSION', 'DESTINATION', 'DIRECTORY',
  'COMPONENTS', 'QUIET', 'ON', 'OFF',
]);

const PYTHON_KEYWORDS = new Set([
  'import', 'from', 'def', 'return', 'if', 'else', 'elif', 'True', 'False', 'None',
  'as', 'for', 'in', 'not', 'and', 'or',
]);

function tokenizeLine(line: string, lang: CodeLanguage): Token[] {
  if (!line) {
    return [{ text: ' ', cls: '' }];
  }

  // Whole-line or trailing comments
  if (lang === 'cpp') {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('#')) {
      return [{ text: line, cls: 'text-violet-400 dark:text-violet-300' }];
    }
  }
  if (lang === 'bash' || lang === 'yaml' || lang === 'python' || lang === 'cmake' || lang === 'dockerfile' || lang === 'ini') {
    const hashIdx = line.indexOf('#');
    if (hashIdx === 0) {
      return [{ text: line, cls: 'text-slate-400 italic' }];
    }
  }
  if (lang === 'xml') {
    const trimmed = line.trim();
    if (trimmed.startsWith('<!--')) {
      return [{ text: line, cls: 'text-slate-400 italic' }];
    }
  }

  const tokens: Token[] = [];
  const regex =
    lang === 'cpp'
      ? /(\/\/.*$|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'|\b(?:rclcpp|rclcpp_action|rclcpp_lifecycle|rclcpp_components|std|tf2|tf2_ros|QMetaObject|Qt|QString|QMainWindow|QApplication)\b|\b[A-Za-z_]\w*\b|\b\d+(?:\.\d+)?[FfUu]?\b)/g
      : lang === 'xml'
      ? /(<\/?[A-Za-z0-9_:-]+|\s[A-Za-z0-9_:-]+(?==)|"(?:\\.|[^"])*"|\?>|\/?>)/g
      : lang === 'yaml'
      ? /(#.*$|"[^"]*"|'[^']*'|\b(?:true|false|null)\b|^[ \t-]*[A-Za-z0-9_/*.-]+(?=:)|\b\d+(?:\.\d+)?\b)/g
      : /(#.*$|"[^"]*"|'[^']*'|\$\{[^}]+\}|\b[A-Za-z_][A-Za-z0-9_]*\b|\b\d+(?:\.\d+)?\b)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), cls: 'text-slate-200' });
    }
    const word = match[0];
    let cls = 'text-slate-200';

    if (word.startsWith('//') || word.startsWith('#')) {
      cls = 'text-slate-400 italic';
    } else if (word.startsWith('"') || word.startsWith("'")) {
      cls = 'text-emerald-300';
    } else if (word.startsWith('<') || word === '?>' || word === '/>' || word === '>') {
      cls = 'text-sky-300';
    } else if (lang === 'yaml' && line.slice(match.index + word.length).startsWith(':')) {
      cls = 'text-sky-300 font-medium';
    } else if (word.startsWith('${')) {
      cls = 'text-amber-300';
    } else if (/^\d/.test(word)) {
      cls = 'text-amber-300';
    } else if (
      word === 'rclcpp' ||
      word === 'rclcpp_action' ||
      word === 'rclcpp_lifecycle' ||
      word === 'rclcpp_components' ||
      word === 'std' ||
      word === 'tf2' ||
      word === 'tf2_ros' ||
      word === 'QMetaObject' ||
      word === 'Qt' ||
      word === 'QApplication' ||
      word === 'QMainWindow' ||
      word === 'QString'
    ) {
      cls = 'text-cyan-300 font-medium';
    } else if (
      (lang === 'cpp' && CPP_KEYWORDS.has(word)) ||
      (lang === 'cmake' && CMAKE_KEYWORDS.has(word)) ||
      (lang === 'python' && PYTHON_KEYWORDS.has(word))
    ) {
      cls = 'text-sky-400 font-medium';
    } else if (lang === 'xml' && word.startsWith(' ')) {
      cls = 'text-amber-200';
    }

    tokens.push({ text: word, cls });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < line.length) {
    tokens.push({ text: line.slice(lastIndex), cls: 'text-slate-200' });
  }

  return tokens;
}

const LANG_DISPLAY: Record<CodeLanguage, string> = {
  cpp: 'C++17',
  cmake: 'CMakeLists.txt',
  xml: 'XML',
  yaml: 'YAML',
  python: 'Python Launch',
  bash: 'Bash',
  json: 'JSON',
  dockerfile: 'Dockerfile',
  ini: 'INI Config',
};

export const CodeBlock: React.FC<{ block: CodeBlockData }> = ({ block }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(block.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback copy via temporary textarea
      const ta = document.createElement('textarea');
      ta.value = block.code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const lines = block.code.split('\n');

  return (
    <div className="my-5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-900 text-slate-100 print-break-inside-avoid">
      <div className="flex items-center justify-between gap-4 px-4 py-2.5 bg-slate-950/70 border-b border-slate-800">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode2 className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <span className="font-mono text-slate-200 truncate font-medium">{block.filename}</span>
            <span className="text-slate-600" aria-hidden="true">·</span>
            <span className="text-slate-400 whitespace-nowrap shrink-0">{block.title}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-xs font-mono text-slate-400 hidden sm:inline whitespace-nowrap">
            {LANG_DISPLAY[block.language]}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label={`复制代码 ${block.filename}`}
            className="no-print inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-sky-400"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
                <span className="text-emerald-300">已复制</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-400" aria-hidden="true" />
                <span>一键复制</span>
              </>
            )}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto p-4 text-[13px] leading-6 font-mono">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-slate-800/40">
                <td className="select-none pr-4 text-right text-slate-600 tabular-nums w-8 align-top">
                  {idx + 1}
                </td>
                <td className="whitespace-pre">
                  {tokenizeLine(line, block.language).map((tok, tIdx) => (
                    <span key={tIdx} className={tok.cls}>
                      {tok.text}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {block.sourcePath && (
        <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800 text-[11.5px] font-mono text-slate-400 flex items-center justify-between gap-2">
          <span>完整可运行源码：{block.sourcePath}</span>
        </div>
      )}
    </div>
  );
};
