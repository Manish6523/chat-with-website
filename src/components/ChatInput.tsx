interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
}

export default function ChatInput({
  value,
  onChange,
  onSend,
  disabled,
}: ChatInputProps) {
  return (
    <div className="border-t border-gray-200 p-3 flex gap-2">
      <input
        id="question-input"
        type="text"
        placeholder="Ask a question…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onSend()}
        disabled={disabled}
        className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm
                   focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500
                   disabled:bg-gray-100 disabled:cursor-not-allowed"
      />
      <button
        id="send-button"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white
                   hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed
                   transition-colors"
      >
        Send
      </button>
    </div>
  );
}
