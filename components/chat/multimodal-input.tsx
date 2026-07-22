"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import equal from "fast-deep-equal";
import {
  ArrowUpIcon,
  BrainIcon,
  EyeIcon,
  LockIcon,
  WrenchIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  type ChangeEvent,
  type Dispatch,
  memo,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import useSWR from "swr";
import { useLocalStorage, useWindowSize } from "usehooks-ts";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@/components/ai-elements/model-selector";
import { useActiveChat } from "@/hooks/use-active-chat";
import {
  type ChatModel,
  chatModels,
  DEFAULT_CHAT_MODEL,
  getCapabilities,
  type ModelCapabilities,
} from "@/lib/ai/models";
import type { Attachment, ChatMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "../ai-elements/prompt-input";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { PaperclipIcon, StopIcon } from "./icons";
import { AudioRecorderButton } from "./audio-recorder-button";
import { NotificationToggle } from "./notification-toggle";
import { PreviewAttachment } from "./preview-attachment";
import {
  type SlashCommand,
  SlashCommandMenu,
  slashCommands,
} from "./slash-commands";
import { SuggestedActions } from "./suggested-actions";
import type { VisibilityType } from "./visibility-selector";
import { VoiceInputButton } from "./voice-input-button";

function setCookie(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  // biome-ignore lint/suspicious/noDocumentCookie: needed for client-side cookie setting
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}`;
}

function PureMultimodalInput({
  chatId,
  input,
  setInput,
  status,
  stop,
  attachments,
  setAttachments,
  messages,
  setMessages,
  sendMessage,
  className,
  selectedVisibilityType,
  selectedModelId,
  onModelChange,
  editingMessage,
  onCancelEdit,
  isLoading,
  thinkingEnabled,
  onThinkingChange,
}: {
  chatId: string;
  input: string;
  setInput: Dispatch<SetStateAction<string>>;
  status: UseChatHelpers<ChatMessage>["status"];
  stop: () => void;
  attachments: Attachment[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  messages: UIMessage[];
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
  sendMessage:
    | UseChatHelpers<ChatMessage>["sendMessage"]
    | (() => Promise<void>);
  className?: string;
  selectedVisibilityType: VisibilityType;
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
  editingMessage?: ChatMessage | null;
  onCancelEdit?: () => void;
  isLoading?: boolean;
  thinkingEnabled?: boolean;
  onThinkingChange?: (enabled: boolean) => void;
}) {
  const router = useRouter();
  const { agentId } = useActiveChat();
  const { setTheme, resolvedTheme } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { width } = useWindowSize();
  const hasAutoFocused = useRef(false);
  const [isSending, startSendTransition] = useTransition();
  useEffect(() => {
    if (!hasAutoFocused.current && width > 768) {
      const timer = setTimeout(() => {
        textareaRef.current?.focus();
        hasAutoFocused.current = true;
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [width]);

  const [localStorageInput, setLocalStorageInput] = useLocalStorage(
    "input",
    ""
  );

  useEffect(() => {
    if (textareaRef.current) {
      const domValue = textareaRef.current.value;
      const finalValue = domValue || localStorageInput || "";
      setInput(finalValue);
    }
  }, [localStorageInput, setInput]);

  useEffect(() => {
    setLocalStorageInput(input);
  }, [input, setLocalStorageInput]);

  const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = event.target.value;
    setInput(val);

    if (val.startsWith("/") && !val.includes(" ")) {
      setSlashOpen(true);
      setSlashQuery(val.slice(1));
      setSlashIndex(0);
    } else {
      setSlashOpen(false);
    }
  };

  const handleSlashSelect = (cmd: SlashCommand) => {
    setSlashOpen(false);
    setInput("");
    switch (cmd.action) {
      case "new":
        router.push("/chat");
        break;
      case "clear":
        setMessages(() => []);
        break;
      case "rename":
        toast("请从侧边栏聊天菜单中重命名");
        break;
      case "model": {
        const modelBtn = document.querySelector<HTMLButtonElement>(
          "[data-testid='model-selector']"
        );
        modelBtn?.click();
        break;
      }
      case "theme":
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        break;
      case "delete":
        toast("删除此对话？", {
          action: {
            label: "删除",
            onClick: () => {
              fetch(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/chat?id=${chatId}`,
                { method: "DELETE" }
              );
              router.push("/chat");
              toast.success("对话已删除");
            },
          },
        });
        break;
      case "purge":
        toast("删除所有对话？", {
          action: {
            label: "全部删除",
            onClick: () => {
              fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/history`, {
                method: "DELETE",
              });
              router.push("/chat");
              toast.success("所有对话已删除");
            },
          },
        });
        break;
      default:
        break;
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadQueue, setUploadQueue] = useState<string[]>([]);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashIndex, setSlashIndex] = useState(0);

  const submitForm = useCallback(() => {
    window.history.pushState(
      {},
      "",
      `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/chat/${chatId}`
    );

    startSendTransition(() => {
      sendMessage({
        role: "user",
        parts: [
          ...attachments.map((attachment) => ({
            type: "file" as const,
            url: attachment.url,
            name: attachment.name,
            mediaType: attachment.contentType,
          })),
          {
            type: "text",
            text: input,
          },
        ],
      });
    });

    setAttachments([]);
    setLocalStorageInput("");
    setInput("");

    if (width && width > 768) {
      textareaRef.current?.focus();
    }
  }, [
    input,
    setInput,
    attachments,
    sendMessage,
    setAttachments,
    setLocalStorageInput,
    width,
    chatId,
  ]);

  const uploadFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/files/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      if (response.ok) {
        const data = await response.json();
        const { url, pathname, contentType } = data;

        return {
          url,
          name: pathname,
          contentType,
        };
      }
      const { error } = await response.json();
      toast.error(error);
    } catch (_error) {
      toast.error("文件上传失败，请重试");
    }
  }, []);

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);

      setUploadQueue(files.map((file) => file.name));

      try {
        const uploadPromises = files.map((file) => uploadFile(file));
        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) => attachment !== undefined
        );

        setAttachments((currentAttachments) => [
          ...currentAttachments,
          ...successfullyUploadedAttachments,
        ]);
      } catch (_error) {
        toast.error("文件上传失败");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }

      const imageItems = Array.from(items).filter((item) =>
        item.type.startsWith("image/")
      );

      if (imageItems.length === 0) {
        return;
      }

      event.preventDefault();

      setUploadQueue((prev) => [...prev, "Pasted image"]);

      try {
        const uploadPromises = imageItems
          .map((item) => item.getAsFile())
          .filter((file): file is File => file !== null)
          .map((file) => uploadFile(file));

        const uploadedAttachments = await Promise.all(uploadPromises);
        const successfullyUploadedAttachments = uploadedAttachments.filter(
          (attachment) =>
            attachment !== undefined &&
            attachment.url !== undefined &&
            attachment.contentType !== undefined
        );

        setAttachments((curr) => [
          ...curr,
          ...(successfullyUploadedAttachments as Attachment[]),
        ]);
      } catch (_error) {
        toast.error("粘贴的图片上传失败");
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, uploadFile]
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  return (
    <div className={cn("relative flex w-full flex-col gap-4", className)}>
      {editingMessage && onCancelEdit && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 text-[12px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="inline-block size-1.5 animate-pulse rounded-full bg-violet-500" />
            <span className="font-medium text-violet-600 dark:text-violet-400">正在编辑消息</span>
            <button
              aria-label="取消编辑"
              className="ml-auto rounded px-1.5 py-0.5 text-muted-foreground/50 transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onMouseDown={(e) => {
                e.preventDefault();
                onCancelEdit();
              }}
              type="button"
            >
              取消
            </button>
          </div>
          {(() => {
            const originalText = editingMessage.parts
              ?.filter((p) => p.type === "text")
              .map((p) => (p as { text: string }).text)
              .join("");
            if (!originalText) {
              return null;
            }
            return (
              <div className="max-h-20 overflow-y-auto rounded-md border border-border/50 bg-muted/30 px-2.5 py-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
                <span className="select-none font-medium text-muted-foreground/50">
                  原文：
                </span>
                {originalText}
              </div>
            );
          })()}
        </div>
      )}

      {!editingMessage &&
        !isLoading &&
        messages.length === 0 &&
        attachments.length === 0 &&
        uploadQueue.length === 0 && (
          <SuggestedActions
            agentId={agentId}
            chatId={chatId}
            selectedVisibilityType={selectedVisibilityType}
            sendMessage={sendMessage}
          />
        )}

      <input
        accept="image/*,video/*,.pdf,.txt,.csv,.md,.json,.xml,.docx,.xlsx,.pptx"
        className="pointer-events-none fixed -top-4 -left-4 size-0.5 opacity-0"
        multiple
        onChange={handleFileChange}
        ref={fileInputRef}
        tabIndex={-1}
        type="file"
      />

      <div className="relative">
        {slashOpen && (
          <SlashCommandMenu
            onClose={() => setSlashOpen(false)}
            onSelect={handleSlashSelect}
            query={slashQuery}
            selectedIndex={slashIndex}
          />
        )}
      </div>

      <PromptInput
        onSubmit={() => {
          if (input.startsWith("/")) {
            const query = input.slice(1).trim();
            const cmd = slashCommands.find((c) => c.name === query);
            if (cmd) {
              handleSlashSelect(cmd);
            }
            return;
          }
          if (!input.trim() && attachments.length === 0) {
            return;
          }
          if (status === "ready" || status === "error") {
            submitForm();
          } else {
            toast.error("请等待模型完成回复");
          }
        }}
      >
        {(attachments.length > 0 || uploadQueue.length > 0) && (
          <div
            className="flex w-full self-start flex-row gap-2 overflow-x-auto px-3 pt-3 no-scrollbar"
            data-testid="attachments-preview"
          >
            {attachments.map((attachment) => (
              <PreviewAttachment
                attachment={attachment}
                key={attachment.url}
                onRemove={() => {
                  setAttachments((currentAttachments) =>
                    currentAttachments.filter((a) => a.url !== attachment.url)
                  );
                  if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                  }
                }}
              />
            ))}

            {uploadQueue.map((filename) => (
              <PreviewAttachment
                attachment={{
                  url: "",
                  name: filename,
                  contentType: "",
                }}
                isUploading={true}
                key={filename}
              />
            ))}
          </div>
        )}
        <PromptInputTextarea
          data-testid="multimodal-input"
          onChange={handleInput}
          onKeyDown={(e) => {
            if (slashOpen) {
              const filtered = slashCommands.filter((cmd) =>
                cmd.name.startsWith(slashQuery.toLowerCase())
              );
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSlashIndex((i) => Math.min(i + 1, filtered.length - 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSlashIndex((i) => Math.max(i - 1, 0));
                return;
              }
              if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                if (filtered[slashIndex]) {
                  handleSlashSelect(filtered[slashIndex]);
                }
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setSlashOpen(false);
                return;
              }
            }
            if (e.key === "Escape" && editingMessage && onCancelEdit) {
              e.preventDefault();
              onCancelEdit();
            }
          }}
          placeholder={editingMessage ? "编辑消息..." : "随便问点什么..."}
          ref={textareaRef}
          value={input}
        />
        <PromptInputFooter className="px-3 pb-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <PromptInputTools>
            <AttachmentsButton
              fileInputRef={fileInputRef}
              selectedModelId={selectedModelId}
              status={status}
            />
            <VoiceInputButton
              value={input}
              onChange={setInput}
              disabled={status !== "ready"}
            />
            <AudioRecorderButton
              value={input}
              onChange={setInput}
              disabled={status !== "ready"}
            />
            <NotificationToggle />
            <ThinkingToggle
              enabled={thinkingEnabled}
              onChange={onThinkingChange}
              selectedModelId={selectedModelId}
            />
            <ModelSelectorCompact
              onModelChange={onModelChange}
              selectedModelId={selectedModelId}
            />
          </PromptInputTools>

          {status === "submitted" || status === "streaming" ? (
            <StopButton chatId={chatId} setMessages={setMessages} stop={stop} />
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={-1} className="inline-flex">
                  <PromptInputSubmit
                    aria-label={input.trim() ? "发送消息" : "请输入消息后再发送"}
                    className={cn(
                      // 响应式触摸目标：移动端 44px 符合 HIG，桌面端保持 32px 紧凑
                      "h-11 w-11 rounded-xl transition-all duration-200 md:h-8 md:w-8",
                      input.trim()
                        ? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-95"
                        : "bg-muted text-muted-foreground/30 cursor-not-allowed",
                    )}
                    data-testid="send-button"
                    disabled={!input.trim() || uploadQueue.length > 0}
                    status={status}
                    variant="secondary"
                  >
                    <ArrowUpIcon className="size-4" />
                  </PromptInputSubmit>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {input.trim() ? "发送消息 (Enter)" : "请输入消息后再发送"}
              </TooltipContent>
            </Tooltip>
          )}
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export const MultimodalInput = memo(
  PureMultimodalInput,
  (prevProps, nextProps) => {
    if (prevProps.input !== nextProps.input) {
      return false;
    }
    if (prevProps.status !== nextProps.status) {
      return false;
    }
    if (!equal(prevProps.attachments, nextProps.attachments)) {
      return false;
    }
    if (prevProps.selectedVisibilityType !== nextProps.selectedVisibilityType) {
      return false;
    }
    if (prevProps.selectedModelId !== nextProps.selectedModelId) {
      return false;
    }
    if (prevProps.editingMessage !== nextProps.editingMessage) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.thinkingEnabled !== nextProps.thinkingEnabled) {
      return false;
    }
    if (prevProps.messages.length !== nextProps.messages.length) {
      return false;
    }

    return true;
  }
);

function PureAttachmentsButton({
  fileInputRef,
  status,
  selectedModelId,
}: {
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  status: UseChatHelpers<ChatMessage>["status"];
  selectedModelId: string;
}) {
  const { data: modelsResponse } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      revalidateOnFocus: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
      dedupingInterval: 3_600_000,
      fallbackData: getCapabilities(),
    }
  );

  const caps: Record<string, ModelCapabilities> =
    modelsResponse?.capabilities ?? modelsResponse ?? getCapabilities();
  const hasVision = caps?.[selectedModelId]?.vision ?? false;

  return (
    <Button
      aria-label={hasVision ? "添加附件" : "当前模型不支持图片附件"}
      className={cn(
        "h-8 w-8 rounded-lg border border-border/40 p-1 transition-colors",
        hasVision
          ? "text-foreground hover:border-border hover:bg-accent hover:text-foreground"
          : "text-muted-foreground/30 cursor-not-allowed"
      )}
      data-testid="attachments-button"
      disabled={status !== "ready" || !hasVision}
      onClick={(event) => {
        event.preventDefault();
        fileInputRef.current?.click();
      }}
      variant="ghost"
    >
      <PaperclipIcon size={14} className="size-3.5 text-sky-500" />
    </Button>
  );
}

const AttachmentsButton = memo(PureAttachmentsButton);

function PureModelSelectorCompact({
  selectedModelId,
  onModelChange,
}: {
  selectedModelId: string;
  onModelChange?: (modelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      revalidateOnFocus: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
      dedupingInterval: 3_600_000,
      fallbackData: { capabilities: getCapabilities() },
    }
  );

  const capabilities: Record<string, ModelCapabilities> =
    modelsData?.capabilities ?? modelsData ?? getCapabilities();
  const dynamicModels: ChatModel[] | undefined = modelsData?.models;
  const activeModels = dynamicModels ?? chatModels;

  const selectedModel =
    activeModels.find((m: ChatModel) => m.id === selectedModelId) ??
    activeModels.find((m: ChatModel) => m.id === DEFAULT_CHAT_MODEL) ??
    activeModels[0];
  const provider = selectedModel.provider;

  return (
    <ModelSelector onOpenChange={setOpen} open={open}>
      <ModelSelectorTrigger asChild>
        <Button
          aria-label={`当前模型：${selectedModel.name}，点击切换模型`}
          data-testid="model-selector"
          variant="ghost"
        >
          {provider && <ModelSelectorLogo provider={provider} />}
          <ModelSelectorName>{selectedModel.name}</ModelSelectorName>
        </Button>
      </ModelSelectorTrigger>
      <ModelSelectorContent>
        <div className="sr-only">
          <ModelSelectorInput />
        </div>
        <ModelSelectorList>
          {(() => {
            const curatedIds = new Set(chatModels.map((m) => m.id));
            const allModels = dynamicModels
              ? [
                  ...chatModels,
                  ...dynamicModels.filter((m) => !curatedIds.has(m.id)),
                ]
              : chatModels;

            const grouped: Record<
              string,
              { model: ChatModel; curated: boolean }[]
            > = {};
            for (const model of allModels) {
              const key = curatedIds.has(model.id)
                ? "_available"
                : model.provider;
              if (!grouped[key]) {
                grouped[key] = [];
              }
              grouped[key].push({ model, curated: curatedIds.has(model.id) });
            }

            const sortedKeys = Object.keys(grouped).sort((a, b) => {
              if (a === "_available") {
                return -1;
              }
              if (b === "_available") {
                return 1;
              }
              return a.localeCompare(b);
            });

            const providerNames: Record<string, string> = {
              alibaba: "Alibaba",
              anthropic: "Anthropic",
              "arcee-ai": "Arcee AI",
              bytedance: "ByteDance",
              cohere: "Cohere",
              deepseek: "DeepSeek",
              google: "Google",
              inception: "Inception",
              kwaipilot: "Kwaipilot",
              meituan: "Meituan",
              meta: "Meta",
              minimax: "MiniMax",
              mistral: "Mistral",
              moonshotai: "Moonshot",
              morph: "Morph",
              nvidia: "Nvidia",
              openai: "OpenAI",
              perplexity: "Perplexity",
              "prime-intellect": "Prime Intellect",
              xiaomi: "Xiaomi",
              xai: "xAI",
              zai: "Zai",
              zhipu: "ZhipuAI",
              zhipuai: "ZhipuAI",
            };

            return sortedKeys.map((key) => (
              <ModelSelectorGroup
                heading={
                  key === "_available"
                    ? "可用模型"
                    : (providerNames[key] ?? key)
                }
                key={key}
              >
                {grouped[key].map(({ model, curated }) => {
                  const logoProvider = model.provider;
                  return (
                    <ModelSelectorItem
                      className={cn(
                        "flex w-full",
                        model.id === selectedModel.id &&
                          "border-b border-dashed border-foreground/50",
                        !curated && "opacity-40 cursor-default"
                      )}
                      key={model.id}
                      onSelect={() => {
                        if (!curated) {
                          toast.error("该模型暂不可用");
                          return;
                        }
                        if (model.id !== selectedModel.id) {
                          onModelChange?.(model.id);
                          setCookie("chat-model", model.id);
                          toast.success(`已切换到 ${model.name}`);
                        }
                        setOpen(false);
                        setTimeout(() => {
                          if (window.innerWidth > 768) {
                            document
                              .querySelector<HTMLTextAreaElement>(
                                "[data-testid='multimodal-input']"
                              )
                              ?.focus();
                          }
                        }, 50);
                      }}
                      value={model.id}
                    >
                      <ModelSelectorLogo provider={logoProvider} />
                      <ModelSelectorName>{model.name}</ModelSelectorName>
                      <div className="ml-auto flex items-center gap-2 text-foreground/70">
                        {capabilities?.[model.id]?.tools && (
                          <WrenchIcon className="size-3.5 text-amber-500" />
                        )}
                        {capabilities?.[model.id]?.vision && (
                          <EyeIcon className="size-3.5 text-sky-500" />
                        )}
                        {capabilities?.[model.id]?.reasoning && (
                          <BrainIcon className="size-3.5 text-violet-500" />
                        )}
                        {!curated && (
                          <LockIcon className="size-3 text-muted-foreground/50" />
                        )}
                      </div>
                    </ModelSelectorItem>
                  );
                })}
              </ModelSelectorGroup>
            ));
          })()}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
}

const ModelSelectorCompact = memo(PureModelSelectorCompact);

function ThinkingToggle({
  selectedModelId,
  enabled,
  onChange,
}: {
  selectedModelId: string;
  enabled?: boolean;
  onChange?: (enabled: boolean) => void;
}) {
  const { data: modelsData } = useSWR(
    `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/models`,
    (url: string) => fetch(url).then((r) => r.json()),
    {
      revalidateOnFocus: false,
      revalidateOnMount: false,
      revalidateIfStale: false,
      dedupingInterval: 3_600_000,
      fallbackData: { capabilities: getCapabilities() },
    }
  );

  const capabilities: Record<string, ModelCapabilities> =
    modelsData?.capabilities ?? modelsData ?? getCapabilities();
  const isReasoningModel = capabilities?.[selectedModelId]?.reasoning ?? false;

  if (!isReasoningModel) {
    return null;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="思考模式"
          aria-pressed={enabled}
          data-testid="thinking-toggle"
          onClick={() => {
            onChange?.(!enabled);
          }}
          className={cn(
            "size-8 rounded-lg text-muted-foreground hover:text-foreground transition-colors",
            enabled
              ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
              : "hover:bg-accent",
          )}
        >
          <BrainIcon className={cn("size-[18px]", enabled ? "text-violet-500" : "text-primary")} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {enabled ? "关闭思考模式" : "开启思考模式"}
      </TooltipContent>
    </Tooltip>
  );
}

function PureStopButton({
  chatId,
  stop,
  setMessages,
}: {
  chatId: string;
  stop: () => void;
  setMessages: UseChatHelpers<ChatMessage>["setMessages"];
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          aria-label="停止生成"
          className="relative h-8 w-8 rounded-xl bg-primary p-1 text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 active:scale-95 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground/30"
          data-testid="stop-button"
          onClick={(event) => {
        event.preventDefault();
        stop();
        // Add a "stopped" indicator to the last assistant message and persist to DB
        setMessages((messages) => {
          const lastMsg = messages.at(-1);
          if (lastMsg && lastMsg.role === "assistant") {
            const updatedParts = [
              ...lastMsg.parts,
              { type: "data-stopped" as const, data: null },
            ];
            const updatedMsg = { ...lastMsg, parts: updatedParts };
            // Persist the stopped marker to database
            fetch(`/api/messages?chatId=${chatId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messageId: lastMsg.id,
                parts: updatedParts,
                role: lastMsg.role,
              }),
            }).catch((err) =>
              console.error("Failed to persist stopped marker:", err)
            );
            return [...messages.slice(0, -1), updatedMsg];
          }
          return messages;
        });
      }}
    >
      <span className="absolute inset-0 animate-ping rounded-xl bg-primary/40" aria-hidden="true" />
      <StopIcon size={14} className="relative" />
    </Button>
      </TooltipTrigger>
      <TooltipContent>停止生成</TooltipContent>
    </Tooltip>
  );
}

const StopButton = memo(PureStopButton);
