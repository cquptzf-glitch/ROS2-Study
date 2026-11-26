import { MODULES_PART_1 } from '../data/modulesPart1';
import { MODULES_PART_2 } from '../data/modulesPart2';
import { INTERVIEW_QUESTIONS } from '../data/module8Data';

export interface SearchHit {
  id: string;
  anchorId: string;
  moduleLabel: string;
  title: string;
  snippet: string;
  kind: '章节' | '代码' | '面试题';
}

export function searchHandbook(query: string): SearchHit[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return [];
  }

  const hits: SearchHit[] = [];
  const allModules = [...MODULES_PART_1, ...MODULES_PART_2];

  for (const mod of allModules) {
    for (const sec of mod.sections) {
      const calloutText = sec.callouts?.map((c) => `${c.label} ${c.text}`).join(' ') ?? '';
      const tableText = sec.table
        ? `${sec.table.caption} ${sec.table.headers.join(' ')} ${sec.table.rows.flat().join(' ')}`
        : '';
      const hay = `${sec.title} ${sec.paragraphs.join(' ')} ${calloutText} ${tableText}`.toLowerCase();
      if (hay.includes(q)) {
        hits.push({
          id: `sec-${sec.id}`,
          anchorId: sec.id,
          moduleLabel: `模块 ${mod.number}`,
          title: sec.title,
          snippet: sec.paragraphs[0]?.slice(0, 88) + '...',
          kind: '章节',
        });
      }

      if (sec.codeBlocks) {
        for (const cb of sec.codeBlocks) {
          const codeHay = `${cb.title} ${cb.filename} ${cb.code}`.toLowerCase();
          if (codeHay.includes(q)) {
            hits.push({
              id: `code-${sec.id}-${cb.filename}`,
              anchorId: sec.id,
              moduleLabel: `模块 ${mod.number}`,
              title: `${cb.filename} — ${cb.title}`,
              snippet: `匹配代码片段 (${cb.language})`,
              kind: '代码',
            });
          }
        }
      }
    }
  }

  for (const iq of INTERVIEW_QUESTIONS) {
    const iqHay = `${iq.category} ${iq.question} ${iq.standardAnswer} ${iq.bonusPoints}`.toLowerCase();
    if (iqHay.includes(q)) {
      hits.push({
        id: `iq-${iq.id}`,
        anchorId: `interview-q-${iq.id}`,
        moduleLabel: `模块 09`,
        title: `Q${String(iq.id).padStart(2, '0')}: ${iq.question}`,
        snippet: iq.standardAnswer.slice(0, 88) + '...',
        kind: '面试题',
      });
    }
  }

  return hits.slice(0, 14);
}
