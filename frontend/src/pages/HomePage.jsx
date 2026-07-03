import { useChatStore } from "../store/useChatStore";
import { useEffect } from "react";

import Sidebar from "../components/Sidebar";
import NoChatSelected from "../components/NoChatSelected";
import ChatContainer from "../components/ChatContainer";
import { useAuthStore } from "../store/useAuthStore";

const HomePage = () => {
  const { selectedUser, subscribeToMessages, unsubscribeFromMessages } = useChatStore();
  const { socket, socketStatus } = useAuthStore();

  useEffect(() => {
    subscribeToMessages();
    return () => unsubscribeFromMessages();
  }, [socket, subscribeToMessages, unsubscribeFromMessages]);

  return (
    <div className="min-h-[100dvh] bg-base-200">
      <div className="flex items-center justify-center pt-16 sm:pt-20 px-0 sm:px-4">
        <div className="bg-base-100 rounded-none sm:rounded-lg shadow-cl w-full max-w-6xl h-[calc(100dvh-4rem)] sm:h-[calc(100dvh-8rem)]">
          {socketStatus !== "connected" && (
            <div className="border-b border-warning/30 bg-warning/15 px-4 py-2 text-center text-xs text-warning-content">
              {socketStatus === "reconnecting" || socketStatus === "connecting"
                ? "Connecting..."
                : "Offline. Messages will retry when connection returns."}
            </div>
          )}
          <div className="flex h-full rounded-lg overflow-hidden">
            <div className={`${selectedUser ? "hidden lg:flex" : "flex w-full lg:w-auto"} h-full`}>
              <Sidebar />
            </div>

            {!selectedUser ? (
              <div className="hidden lg:flex flex-1">
                <NoChatSelected />
              </div>
            ) : (
              <ChatContainer />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default HomePage;
