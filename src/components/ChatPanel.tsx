import type { ChatMessage } from "@/types/chat";
import ChatMessageList from "@/components/ChatMessageList";
import ChatInput from "@/components/ChatInput";

interface ChatPanelProps {
  messages: ChatMessage[];
  isThinking: boolean;
  questionInput: string;
  onQuestionChange: (value: string) => void;
  onSend: () => void;
}

export default function ChatPanel({
  messages,
  isThinking,
  questionInput,
  onQuestionChange,
  onSend,
}: ChatPanelProps) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <ChatMessageList messages={messages} isThinking={isThinking} />
      <ChatInput
        value={questionInput}
        onChange={onQuestionChange}
        onSend={onSend}
        disabled={isThinking}
      />
    </div>
  );
}
