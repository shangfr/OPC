"use client";

import { useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  initialArtifactData,
  useArtifact,
  useArtifactSelector,
} from "@/hooks/use-artifact";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Artifact } from "./artifact";
import { ChatHeader } from "./chat-header";
import { ConnectionStatus } from "./connection-status";
import { DataStreamHandler } from "./data-stream-handler";
import { submitEditedMessage } from "./message-editor";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

export function ChatShell() {
  const {
    chatId,
    agentName,
    messages,
    setMessages,
    sendMessage,
    status,
    stop,
    regenerate,
    addToolApprovalResponse,
    input,
    setInput,
    visibilityType,
    isReadonly,
    isLoading,
    votes,
    currentModelId,
    setCurrentModelId,
    thinkingEnabled,
    setThinkingEnabled,
  } = useActiveChat();

  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(
    null
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const isArtifactVisible = useArtifactSelector((state) => state.isVisible);
  const { setArtifact } = useArtifact();

  const stopRef = useRef(stop);
  stopRef.current = stop;

  const prevChatIdRef = useRef(chatId);
  useEffect(() => {
    if (prevChatIdRef.current !== chatId) {
      prevChatIdRef.current = chatId;
      stopRef.current();
      setArtifact(initialArtifactData);
      setEditingMessage(null);
      setAttachments([]);
    }
  }, [chatId, setArtifact]);

  return (
    <>
      <ConnectionStatus />
      <div className="flex h-dvh w-full flex-row overflow-hidden">
        <div
          className={cn(
            "flex min-w-0 flex-col bg-sidebar transition-[width] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            isArtifactVisible ? "w-[40%]" : "w-full"
          )}
        >
          <ChatHeader
            agentName={agentName}
            chatId={chatId}
            isReadonly={isReadonly}
            selectedVisibilityType={visibilityType}
          />

          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
            {messages.length === 0 && status !== "submitted" ? (
              <div className="flex flex-1 items-center justify-center" />
            ) : (
              <Messages
                isArtifactVisible={isArtifactVisible}
                onEditMessage={(msg) => {
                  const text = msg.parts
                    ?.filter((p) => p.type === "text")
                    .map((p) => p.text)
                    .join("");
                  setInput(text ?? "");
                  setEditingMessage(msg);
                }}
                onSelectPrompt={(prompt) => {
                  setInput(prompt);
                }}
              />
            )}

            <div className="sticky bottom-0 z-10 mx-auto flex w-full max-w-3xl gap-2 bg-gradient-to-t from-background via-background to-transparent px-2 pb-3 pt-4 md:px-4 md:pb-5">
              {!isReadonly && (
                <MultimodalInput
                  attachments={attachments}
                  chatId={chatId}
                  editingMessage={editingMessage}
                  input={input}
                  isLoading={isLoading}
                  messages={messages}
                  onCancelEdit={() => {
                    setEditingMessage(null);
                    setInput("");
                  }}
                  onModelChange={setCurrentModelId}
                  onThinkingChange={setThinkingEnabled}
                  selectedModelId={currentModelId}
                  selectedVisibilityType={visibilityType}
                  sendMessage={
                    editingMessage
                      ? async () => {
                          const msg = editingMessage;
                          setEditingMessage(null);
                          await submitEditedMessage({
                            message: msg,
                            text: input,
                            setMessages,
                            regenerate,
                          });
                          setInput("");
                        }
                      : sendMessage
                  }
                  setAttachments={setAttachments}
                  setInput={setInput}
                  setMessages={setMessages}
                  status={status}
                  stop={stop}
                  thinkingEnabled={thinkingEnabled}
                />
              )}
            </div>
          </div>
        </div>

        <ErrorBoundary>
          <Artifact
            addToolApprovalResponse={addToolApprovalResponse}
            attachments={attachments}
            chatId={chatId}
            input={input}
            isReadonly={isReadonly}
            messages={messages}
            regenerate={regenerate}
            selectedModelId={currentModelId}
            selectedVisibilityType={visibilityType}
            sendMessage={sendMessage}
            setAttachments={setAttachments}
            setInput={setInput}
            setMessages={setMessages}
            status={status}
            stop={stop}
            votes={votes}
          />
        </ErrorBoundary>
      </div>

      <DataStreamHandler />
    </>
  );
}
