import { useChatStore } from "../store/useChatStore";
import { memo, useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { Check, CheckCheck, FileText, Smile, Trash2 } from "lucide-react";
import { normalizeImageUrl, normalizeMessageImageUrl, useImageFallback } from "../lib/image";

const MessageImage = ({ src }) => {
  const [hasError, setHasError] = useState(false);
  const imageUrl = normalizeMessageImageUrl(src);

  if (!imageUrl) return null;

  if (hasError) {
    return (
      <a
        href={imageUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-lg bg-base-200 p-3 mb-2 hover:bg-base-300"
      >
        <FileText className="size-5 shrink-0" />
        <span className="max-w-48 truncate">Open image</span>
      </a>
    );
  }

  return (
    <a href={imageUrl} target="_blank" rel="noreferrer">
      <img
        src={imageUrl}
        alt="Attachment"
        className="w-full max-w-[240px] sm:max-w-[320px] rounded-md mb-2 object-contain"
        onError={() => setHasError(true)}
      />
    </a>
  );
};

const MessageItem = memo(({
  authUser,
  deleteMessageForEveryone,
  message,
  reactToMessage,
  retryFailedMessage,
  selectedUser,
}) => {
  const isOwnMessage = message.senderId === authUser._id;
  const isVoiceNote = message.attachment?.type?.startsWith("audio/");
  const statusIcon =
    message.isFailed ? (
      <button
        type="button"
        className="text-error underline"
        onClick={() => retryFailedMessage(message._id)}
      >
        Failed. Retry
      </button>
    ) : message.isPending ? (
      <span>Sending...</span>
    ) : message.status === "seen" ? (
      <CheckCheck className="size-4 text-sky-400" />
    ) : message.status === "delivered" ? (
      <CheckCheck className="size-4 opacity-70" />
    ) : (
      <Check className="size-4 opacity-70" />
    );

  return (
    <div className={`chat group ${isOwnMessage ? "chat-end" : "chat-start"}`}>
      <div className=" chat-image avatar">
        <div className="size-10 rounded-full border">
          <img
            src={
              isOwnMessage
                ? normalizeImageUrl(authUser.profilePic)
                : normalizeImageUrl(selectedUser.profilePic)
            }
            alt="profile pic"
            onError={useImageFallback}
          />
        </div>
      </div>
      <div className="chat-header mb-1">
        <time className="text-xs opacity-50 ml-1">
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      <div className="chat-bubble flex flex-col">
        {message.deletedForEveryone ? (
          <p className="italic opacity-70">This message was deleted</p>
        ) : (
          <>
            {message.image && <MessageImage src={message.image} />}
            {isVoiceNote && message.attachment.url && (
              <audio controls src={message.attachment.url} className="max-w-[240px]" />
            )}
            {message.attachment?.url && !message.attachment?.type?.startsWith("image/") && !isVoiceNote && (
              <a
                href={message.attachment.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg bg-base-200 p-3 mb-2 hover:bg-base-300"
              >
                <FileText className="size-5 shrink-0" />
                <span className="max-w-48 truncate">{message.attachment.name || "Attachment"}</span>
              </a>
            )}
            {message.text && <p>{message.text}</p>}
          </>
        )}
        {message.reactions?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.reactions.map((reaction) => (
              <span
                key={`${reaction.userId}-${reaction.emoji}`}
                className="rounded-full bg-base-100/80 px-2 py-0.5 text-xs"
              >
                {reaction.emoji}
              </span>
            ))}
          </div>
        )}
        {isOwnMessage && (
          <div className="mt-1 flex justify-end text-xs opacity-70">{statusIcon}</div>
        )}
      </div>

      {!message.deletedForEveryone && !message.isPending && !message.isFailed && (
        <div
          className={`mt-1 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}
        >
          {["👍", "❤️", "😂"].map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="btn btn-xs btn-circle"
              onClick={() => reactToMessage(message._id, emoji)}
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
          <button
            type="button"
            className="btn btn-xs btn-circle"
            onClick={() => reactToMessage(message._id, "🙏")}
            aria-label="React"
          >
            <Smile className="size-3" />
          </button>
          {isOwnMessage && (
            <button
              type="button"
              className="btn btn-xs btn-circle btn-error"
              onClick={() => deleteMessageForEveryone(message._id)}
              aria-label="Delete for everyone"
            >
              <Trash2 className="size-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
});

MessageItem.displayName = "MessageItem";

const ChatContainer = () => {
  const {
    deleteMessageForEveryone,
    hasMoreMessages,
    messages,
    getMessages,
    isMessagesLoading,
    isLoadingOlderMessages,
    loadOlderMessages,
    reactToMessage,
    retryFailedMessage,
    selectedUser,
    typingUserIds,
  } = useChatStore();
  const { authUser } = useAuthStore();
  const messageEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const shouldScrollToBottomRef = useRef(true);

  useEffect(() => {
    getMessages(selectedUser._id);
  }, [selectedUser._id, getMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      if (shouldScrollToBottomRef.current) {
        messageEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
      shouldScrollToBottomRef.current = true;
    }
  }, [messages]);

  const handleMessagesScroll = async (e) => {
    if (e.currentTarget.scrollTop > 80 || !hasMoreMessages || isLoadingOlderMessages) return;

    const previousScrollHeight = e.currentTarget.scrollHeight;
    shouldScrollToBottomRef.current = false;
    await loadOlderMessages();
    requestAnimationFrame(() => {
      if (!messagesContainerRef.current) return;
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight - previousScrollHeight;
    });
  };

  if (isMessagesLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-auto">
        <ChatHeader />
        <MessageSkeleton />
        <MessageInput />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <ChatHeader />

      <div
        ref={messagesContainerRef}
        onScroll={handleMessagesScroll}
        className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4"
      >
        {hasMoreMessages && (
          <div className="flex justify-center">
            <button
              type="button"
              className="btn btn-xs"
              onClick={async () => {
                shouldScrollToBottomRef.current = false;
                await loadOlderMessages();
              }}
              disabled={isLoadingOlderMessages}
            >
              {isLoadingOlderMessages ? "Loading..." : "Load older messages"}
            </button>
          </div>
        )}
        {messages.map((message) => {
          return (
            <MessageItem
              key={message._id}
              authUser={authUser}
              deleteMessageForEveryone={deleteMessageForEveryone}
              message={message}
              reactToMessage={reactToMessage}
              retryFailedMessage={retryFailedMessage}
              selectedUser={selectedUser}
            />
          );
        })}

        {typingUserIds.includes(selectedUser._id) && (
          <div className="chat chat-start">
            <div className="chat-bubble bg-base-300 text-sm">
              {selectedUser.fullName} is typing...
            </div>
          </div>
        )}
        <div ref={messageEndRef} />
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
