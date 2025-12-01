import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { MessagingService } from "../utils/messagingService";

interface MessagingContextType {
  totalUnreadCount: number;
  updateUnreadCount: (count: number) => void;
  refreshUnreadCount: () => Promise<void>;
}

const MessagingContext = createContext<MessagingContextType | undefined>(
  undefined
);

export const useMessaging = () => {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error("useMessaging must be used within a MessagingProvider");
  }
  return context;
};

export const MessagingProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const updateUnreadCount = (count: number) => {
    setTotalUnreadCount(count);
  };

  const refreshUnreadCount = async () => {
    try {
      // This will be implemented to calculate total unread messages
      // For now, we'll update it through the real-time listeners
    } catch (error) {
      console.error("Failed to refresh unread count:", error);
    }
  };

  return (
    <MessagingContext.Provider
      value={{
        totalUnreadCount,
        updateUnreadCount,
        refreshUnreadCount,
      }}
    >
      {children}
    </MessagingContext.Provider>
  );
};
