import React, { useState } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
  showThinkTags?: boolean;
  expandThinkTagsByDefault?: boolean;
  enableSyntaxHighlighting?: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  content, 
  className = '',
  showThinkTags = true,
  expandThinkTagsByDefault = false,
  enableSyntaxHighlighting = true
}) => {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(
    expandThinkTagsByDefault ? new Set([0, 1, 2, 3, 4]) : new Set()
  );

  // Extract and handle think tags
  const processThinkTags = (text: string) => {
    if (!showThinkTags) {
      return { cleanedText: text.replace(/<think>([\s\S]*?)<\/think>/gi, ''), thinkSections: [] };
    }

    const thinkSections: Array<{ content: string; index: number }> = [];
    let cleanedText = text;
    let sectionIndex = 0;

    cleanedText = cleanedText.replace(/<think>([\s\S]*?)<\/think>/gi, (match, thinkContent) => {
      thinkSections.push({
        content: thinkContent.trim(),
        index: sectionIndex
      });
      return `__THINK_SECTION_${sectionIndex++}__`;
    });

    return { cleanedText, thinkSections };
  };

  // Simple markdown parsing
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const { cleanedText, thinkSections } = processThinkTags(text);
    const lines = cleanedText.split('\n');
    const elements: React.ReactNode[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const key = `line-${i}`;

      // Think section placeholders
      const thinkMatch = line.match(/__THINK_SECTION_(\d+)__/);
      if (thinkMatch) {
        const sectionIndex = parseInt(thinkMatch[1]);
        const section = thinkSections.find(s => s.index === sectionIndex);
        if (section) {
          const isExpanded = expandedSections.has(sectionIndex);
          elements.push(
            <div key={key} className="my-3 border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedSections);
                  if (isExpanded) {
                    newExpanded.delete(sectionIndex);
                  } else {
                    newExpanded.add(sectionIndex);
                  }
                  setExpandedSections(newExpanded);
                }}
                className="w-full px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left text-sm font-medium text-gray-700 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center">
                  <span className="mr-2">🤔</span>
                  <span>Thought process</span>
                </span>
                <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>
              {isExpanded && (
                <div className="px-3 py-2 bg-gray-25 border-t border-gray-200">
                  <div className="text-sm text-gray-600 italic whitespace-pre-wrap">
                    {section.content}
                  </div>
                </div>
              )}
            </div>
          );
        }
        continue;
      }

      // Code blocks
      if (line.startsWith('```')) {
        const codeLines = [line];
        let j = i + 1;
        while (j < lines.length && !lines[j].startsWith('```')) {
          codeLines.push(lines[j]);
          j++;
        }
        if (j < lines.length) {
          codeLines.push(lines[j]);
          const language = line.replace('```', '');
          const code = codeLines.slice(1, -1).join('\n');
          elements.push(
            <div key={key} className="my-2">
              <pre className={`${enableSyntaxHighlighting ? 'bg-gray-800 text-gray-100' : 'bg-gray-100 text-gray-800'} p-3 rounded-md overflow-x-auto text-sm`}>
                <code>{code}</code>
              </pre>
            </div>
          );
          i = j;
          continue;
        }
      }

      // Headers
      if (line.startsWith('#')) {
        const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
        if (headerMatch) {
          const level = headerMatch[1].length;
          const text = headerMatch[2];
          const headerClasses = {
            1: 'text-xl font-bold mt-4 mb-2',
            2: 'text-lg font-bold mt-3 mb-2',
            3: 'text-md font-bold mt-2 mb-1',
            4: 'text-sm font-bold mt-2 mb-1',
            5: 'text-sm font-semibold mt-1 mb-1',
            6: 'text-xs font-semibold mt-1 mb-1'
          };
          const HeaderTag = `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
          elements.push(
            React.createElement(HeaderTag, {
              key,
              className: headerClasses[level as keyof typeof headerClasses]
            }, parseInline(text))
          );
          continue;
        }
      }

      // Lists
      if (line.match(/^[\s]*[-*+]\s/)) {
        elements.push(
          <li key={key} className="ml-4">
            {parseInline(line.replace(/^[\s]*[-*+]\s/, ''))}
          </li>
        );
        continue;
      }

      if (line.match(/^[\s]*\d+\.\s/)) {
        elements.push(
          <li key={key} className="ml-4">
            {parseInline(line.replace(/^[\s]*\d+\.\s/, ''))}
          </li>
        );
        continue;
      }

      // Regular paragraphs
      if (line.trim()) {
        elements.push(
          <p key={key} className="mb-2">
            {parseInline(line)}
          </p>
        );
      } else {
        elements.push(<br key={key} />);
      }
    }

    return elements;
  };

  // Parse inline markdown elements
  const parseInline = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let remaining = text;
    let keyIndex = 0;

    while (remaining.length > 0) {
      let found = false;

      // Bold **text**
      const boldMatch = remaining.match(/\*\*(.*?)\*\*/);
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) {
          parts.push(remaining.substring(0, boldMatch.index));
        }
        parts.push(<strong key={`bold-${keyIndex++}`}>{boldMatch[1]}</strong>);
        remaining = remaining.substring(boldMatch.index + boldMatch[0].length);
        found = true;
      }
      // Italic *text*
      else if (!found) {
        const italicMatch = remaining.match(/\*(.*?)\*/);
        if (italicMatch && italicMatch.index !== undefined) {
          if (italicMatch.index > 0) {
            parts.push(remaining.substring(0, italicMatch.index));
          }
          parts.push(<em key={`italic-${keyIndex++}`}>{italicMatch[1]}</em>);
          remaining = remaining.substring(italicMatch.index + italicMatch[0].length);
          found = true;
        }
      }
      // Code `text`
      if (!found) {
        const codeMatch = remaining.match(/`(.*?)`/);
        if (codeMatch && codeMatch.index !== undefined) {
          if (codeMatch.index > 0) {
            parts.push(remaining.substring(0, codeMatch.index));
          }
          parts.push(
            <code key={`code-${keyIndex++}`} className="bg-gray-200 px-1 rounded text-sm">
              {codeMatch[1]}
            </code>
          );
          remaining = remaining.substring(codeMatch.index + codeMatch[0].length);
          found = true;
        }
      }
      // Links [text](url)
      if (!found) {
        const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
        if (linkMatch && linkMatch.index !== undefined) {
          if (linkMatch.index > 0) {
            parts.push(remaining.substring(0, linkMatch.index));
          }
          parts.push(
            <a 
              key={`link-${keyIndex++}`}
              href={linkMatch[2]} 
              className="text-blue-500 hover:text-blue-700 underline" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {linkMatch[1]}
            </a>
          );
          remaining = remaining.substring(linkMatch.index + linkMatch[0].length);
          found = true;
        }
      }

      if (!found) {
        parts.push(remaining);
        break;
      }
    }

    return parts;
  };

  return (
    <div className={`markdown-content ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
};

export default MarkdownRenderer;