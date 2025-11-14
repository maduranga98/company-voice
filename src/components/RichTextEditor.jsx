import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading2,
  Undo,
  Redo,
  Code,
  Quote,
} from "lucide-react";

/**
 * Rich Text Editor Component using TipTap
 *
 * A WYSIWYG editor with visual formatting controls
 */
const RichTextEditor = ({ value, onChange, placeholder, rows = 8 }) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Write something...",
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
    editorProps: {
      attributes: {
        class: `prose prose-sm max-w-none px-4 py-3 focus:outline-none prose-ul:list-disc prose-ol:list-decimal prose-li:ml-4`,
        style: `min-height: ${rows * 1.5}rem`,
      },
    },
  });

  if (!editor) {
    return null;
  }

  const MenuButton = ({ onClick, active, disabled, icon: Icon, title }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-2 rounded hover:bg-slate-100 transition ${
        active ? 'bg-slate-200 text-blue-600' : 'text-slate-600'
      } ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent bg-white">
      {/* Add custom styles for lists */}
      <style>{`
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
        .ProseMirror li p {
          margin: 0;
        }
        .ProseMirror h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin: 0.5rem 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #e2e8f0;
          padding-left: 1rem;
          margin: 0.5rem 0;
          color: #64748b;
        }
        .ProseMirror code {
          background-color: #f1f5f9;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.875em;
        }
      `}</style>
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-slate-50 border-b border-slate-200 flex-wrap">
        <MenuButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          icon={Bold}
          title="Bold (Ctrl+B)"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          icon={Italic}
          title="Italic (Ctrl+I)"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          active={editor.isActive('code')}
          icon={Code}
          title="Inline Code"
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          icon={Heading2}
          title="Heading"
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          icon={List}
          title="Bullet List"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          icon={ListOrdered}
          title="Numbered List"
        />
        <MenuButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          icon={Quote}
          title="Blockquote"
        />

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <MenuButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          icon={Undo}
          title="Undo (Ctrl+Z)"
        />
        <MenuButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          icon={Redo}
          title="Redo (Ctrl+Y)"
        />
      </div>

      {/* Editor Content */}
      <EditorContent editor={editor} />

      {/* Help Text */}
      <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
        Rich text formatting with visual controls
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
