import { useRef, useState } from "react";
import { useChatStore } from "../store/useChatStore";
import { FileText, Mic, Paperclip, Send, Square, X } from "lucide-react";
import toast from "react-hot-toast";
import { compressImageFile, uploadToCloudinary } from "../lib/upload";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const VOICE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg;codecs=opus",
];

const getSupportedVoiceMimeType = () => {
  if (typeof MediaRecorder === "undefined") return "";
  return VOICE_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) || "";
};

const MessageInput = () => {
  const [text, setText] = useState("");
  const [attachment, setAttachment] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const { sendMessage, startTyping, stopTyping } = useChatStore();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be smaller than 10MB");
      return;
    }

    if (file.type.startsWith("image/")) {
      try {
        const compressed = await compressImageFile(file);
        setAttachment({
          data: compressed.dataUrl,
          file: compressed.blob,
          name: compressed.name,
          type: compressed.type,
          size: compressed.size,
          isImage: true,
        });
      } catch (error) {
        console.error("Unable to compress image:", error);
        toast.error("Unable to prepare image");
      }
      return;
    }

    setAttachment({
      file,
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
      isImage: false,
    });
  };

  const handleTextChange = (e) => {
    setText(e.target.value);
    startTyping();

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1200);
  };

  const sendVoiceNote = (blob) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        setIsSendingVoice(true);
        await sendMessage({
          voice: {
            data: reader.result,
            name: "Voice note",
            type: blob.type || "audio/webm",
            size: blob.size,
          },
        });
        toast.success("Voice note sent");
      } catch (error) {
        console.error("Failed to send voice note:", error);
      } finally {
        setIsSendingVoice(false);
      }
    };
    reader.readAsDataURL(blob);
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Voice recording is not supported in this browser");
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      toast.error("This browser cannot record voice notes");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedVoiceMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
        if (blob.size > 0) {
          sendVoiceNote(blob);
        } else {
          toast.error("Voice note was empty. Please try again.");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(1000);
      setIsRecording(true);
    } catch (error) {
      console.error("Unable to record voice note:", error);
      toast.error("Please allow microphone access");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if ((!text.trim() && !attachment) || isSending) return;

    try {
      setIsSending(true);
      setUploadProgress(0);
      let uploadedAttachment = null;

      if (attachment?.file) {
        uploadedAttachment = await uploadToCloudinary(
          {
            blob: attachment.file,
            name: attachment.name,
            type: attachment.type,
            size: attachment.size,
          },
          setUploadProgress
        );
      }

      await sendMessage({
        text: text.trim(),
        uploadedImage: attachment?.isImage ? uploadedAttachment : undefined,
        attachment: attachment && !attachment.isImage ? uploadedAttachment : undefined,
      });
      stopTyping();

      setText("");
      setAttachment(null);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 w-full">
      {attachment && (
        <div className="mb-3 flex items-center gap-2">
          <div className="relative">
            {attachment.isImage ? (
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
          {isSending && uploadProgress > 0 && (
            <span className="text-xs text-base-content/60">{uploadProgress}%</span>
          )}
        </div>
      )}

      <form onSubmit={handleSendMessage} className="flex items-center gap-2 pb-[env(safe-area-inset-bottom)]">
        <div className="flex-1 flex gap-2">
          <input
            type="text"
            className="w-full input input-bordered rounded-lg input-sm sm:input-md"
            placeholder="Type a message..."
            value={text}
            onChange={handleTextChange}
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
            disabled={isSending}
            aria-label="Attach file"
            title="Attach file"
          >
            <Paperclip size={20} />
          </button>
        </div>
        <button
          type="submit"
          className="btn btn-sm btn-circle"
          disabled={isSending || (!text.trim() && !attachment)}
        >
          <Send size={22} />
        </button>
        <button
          type="button"
          className={`btn btn-sm btn-circle ${isRecording ? "btn-error" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isSendingVoice}
          aria-label={isRecording ? "Stop recording" : "Record voice note"}
          title={isRecording ? "Stop recording" : isSendingVoice ? "Sending voice note" : "Record voice note"}
        >
          {isRecording ? <Square size={18} /> : <Mic size={20} />}
        </button>
      </form>
    </div>
  );
};
export default MessageInput;
