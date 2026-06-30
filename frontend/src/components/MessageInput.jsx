import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { FileText, Paperclip, Send, X } from "lucide-react";
import toast from "react-hot-toast";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const MessageInput = () => {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const { sendMessage } = useChatStore();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be smaller than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachment({
        data: reader.result,
        name: file.name,
        type: file.type || "application/octet-stream",
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!text.trim() && !attachment) return;

    try {
      const isImageAttachment = attachment?.type?.startsWith("image/");

      await sendMessage({
        text: text.trim(),
        image: isImageAttachment ? attachment.data : undefined,
        attachment: isImageAttachment ? null : attachment,
      });

      // Clear form
      setText("");
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  return (
    <div className="p-4 w-full">
      {attachment && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {attachment.type.startsWith("image/") ? (
              <img
                src={attachment.data}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-zinc-700"
              />
            ) : (
              <div className="w-56 min-h-16 rounded-lg border border-zinc-700 p-3 bg-base-200 flex items-center gap-3">
                <FileText className="size-6 shrink-0" />
                <span className="text-sm truncate">{attachment.name}</span>
              </div>
            )}
            <button
              onClick={removeAttachment}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-base-300
              flex items-center justify-center"
              type="button"
            >
              <X className="size-3" />
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            type="file"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileChange}
          />

          <button
            type="button"
            className={`btn btn-circle shrink-0
                     ${attachment ? "text-emerald-500" : "text-zinc-400"}`}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach file"
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={!text.trim() && !attachment}
        >
          <Send size={22} />
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
