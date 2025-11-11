import { useState, useRef } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Link as LinkIcon,
  Code,
  Quote,
} from "lucide-react";

/**
 * Simple Rich Text Editor Component
 *
 * For production, consider integrating TipTap, Quill, or Draft.js
 * This is a basic implementation with toolbar controls
 */
const RichTextEditor = ({ value, onChange, placeholder, rows = 8 }) => {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const textareaRef = useRef(null);

  const insertAtCursor = (before, after = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    const newText =
      value.substring(0, start) +
      before +
      selectedText +
      after +
      value.substring(end);

    onChange(newText);

    // Restore focus and selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleBold = () => {
    insertAtCursor("**", "**");
  };

  const handleItalic = () => {
    insertAtCursor("*", "*");
  };

  const handleCode = () => {
    insertAtCursor("`", "`");
  };

  const handleQuote = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newText = value.substring(0, lineStart) + "> " + value.substring(lineStart);

    onChange(newText);
  };

  const handleList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newText = value.substring(0, lineStart) + "- " + value.substring(lineStart);

    onChange(newText);
  };

  const handleOrderedList = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const newText = value.substring(0, lineStart) + "1. " + value.substring(lineStart);

    onChange(newText);
  };

  const handleLink = () => {
    if (linkUrl) {
      insertAtCursor("[", `](${linkUrl})`);
      setLinkUrl("");
      setShowLinkInput(false);
    } else {
      setShowLinkInput(true);
    }
  };

  const insertLink = () => {
    if (linkUrl) {
      handleLink();
    }
  };

  const toolbarButtons = [
    { icon: Bold, action: handleBold, title: "Bold (**text**)" },
    { icon: Italic, action: handleItalic, title: "Italic (*text*)" },
    { icon: Code, action: handleCode, title: "Code (`code`)" },
    { icon: Quote, action: handleQuote, title: "Quote (> text)" },
    { icon: List, action: handleList, title: "Bullet List (- item)" },
    { icon: ListOrdered, action: handleOrderedList, title: "Numbered List (1. item)" },
    { icon: LinkIcon, action: () => setShowLinkInput(!showLinkInput), title: "Insert Link" },
  ];

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200">
        {toolbarButtons.map(({ icon: Icon, action, title }, index) => (
          <button
            key={index}
            type="button"
            onClick={action}
            title={title}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded transition"
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}

        {/* Link Input */}
        {showLinkInput && (
          <div className="flex items-center gap-2 ml-2 flex-1">
            <input
              type="url"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  insertLink();
                }
              }}
              placeholder="https://example.com"
              className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded"
            />
            <button
              type="button"
              onClick={insertLink}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Insert
            </button>
          </div>
        )}
      </div>

      {/* Editor Area */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-4 py-3 text-slate-900 placeholder-slate-400 resize-none focus:outline-none font-mono text-sm"
      />

      {/* Help Text */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        Supports Markdown: **bold**, *italic*, `code`, [link](url), lists, and quotes
      </div>
    </div>
  );
};

/**
 * Markdown Preview Component
 * Renders markdown text as formatted HTML
 */
export const MarkdownPreview = ({ content }) => {
  // Simple markdown to HTML conversion
  // For production, use a library like marked or react-markdown
  const renderMarkdown = (text) => {
    if (!text) return "";

    let html = text;

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

    // Italic
    html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

    // Code
    html = html.replace(/`(.+?)`/g, "<code>$1</code>");

    // Links
    html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Quotes
    html = html.replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>");

    // Lists
    html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

    html = html.replace(/^\d+\. (.+)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>.*<\/li>)/s, "<ol>$1</ol>");

    // Line breaks
    html = html.replace(/\n/g, "<br />");

    return html;
  };

  return (
    <div
      className="prose prose-slate max-w-none"
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
};

export default RichTextEditor;
