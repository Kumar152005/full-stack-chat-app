import { useChatStore } from "../store/useChatStore";
import { useEffect, useRef, useState } from "react";

import ChatHeader from "./ChatHeader";
import MessageInput from "./MessageInput";
import MessageSkeleton from "./skeletons/MessageSkeleton";
import { useAuthStore } from "../store/useAuthStore";
import { formatMessageTime } from "../lib/utils";
import { FileText } from "lucide-react";
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

const ChatContainer = () => {
  const {
    messages,
    getMessages,
    isMessagesLoading,
    selectedUser,
    subscribeToMessages,
    unsubscribeFromMessages,
  } = useChatStore();
  const { authUser, socket } = useAuthStore();
  const messageEndRef = useRef(null);

  useEffect(() => {
    getMessages(selectedUser._id);

    subscribeToMessages();

    return () => unsubscribeFromMessages();
  }, [selectedUser._id, socket, getMessages, subscribeToMessages, unsubscribeFromMessages]);

  useEffect(() => {
    if (messageEndRef.current && messages) {
      messageEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

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
    <div className="flex-1 flex flex-col overflow-auto">
      <ChatHeader />

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message._id}
            className={`chat ${message.senderId === authUser._id ? "chat-end" : "chat-start"}`}
            ref={messageEndRef}
          >
            <div className=" chat-image avatar">
              <div className="size-10 rounded-full border">
                <img
                  src={
                    message.senderId === authUser._id
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
              {message.image && <MessageImage src={message.image} />}
              {message.attachment?.url && !message.attachment?.type?.startsWith("image/") && (
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
            </div>
          </div>
        ))}
      </div>

      <MessageInput />
    </div>
  );
};
export default ChatContainer;
