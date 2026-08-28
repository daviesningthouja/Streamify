"use client";

import { FormEvent } from "react";
import type { ChatMessage } from "@/types/chat";
//import type { PeerRole } from "@/types/peer";

interface ChatBoxProps {
  messages: ChatMessage[];
  participantId: string | null;
  message: string;
  onMessageChange: (value: string) => void;
  onSend: () => void;
}

export default function ChatBox({
  messages,
  participantId,
  message,
  onMessageChange,
  onSend,
}: ChatBoxProps) {
  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSend();
  }

  return (
    <div className="flex h-[500px] flex-col rounded-xl border bg-black shadow-sm">
      {/* Header */}
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold">Chat</h2>

        <p className="text-xs text-gray-500">{messages.length} messages</p>
      </div>

      {/* Messages */}
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            No messages yet
          </div>
        ) : (
          messages.map((msg) => {
            const isMine =
  msg.sender.participantId === participantId;
              // messages.find((message) => message.id === msg.id)?.sender
              //   .participantId;

            return (
              <div
                key={msg.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[75%] rounded-xl px-3 py-2 ${
                    isMine ? "bg-black text-white" : "bg-gray-100 text-black"
                  }`}
                >
                  <p className="text-xs opacity-60">
                    {msg.sender.displayName}
                  </p>

                  <p className="break-words text-sm">{msg.text}</p>

                  <p className="mt-1 text-[10px] opacity-50">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2 border-t p-3">
        <input
          value={message}
          onChange={(event) => onMessageChange(event.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2"
        />

        <button
          type="submit"
          disabled={!message.trim()}
          className="rounded-lg bg-black px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
