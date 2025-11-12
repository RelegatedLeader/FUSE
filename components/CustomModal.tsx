import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { useTheme } from "../contexts/ThemeContext";

const { width, height } = Dimensions.get("window");

interface CustomModalProps {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  message: string;
  buttons?: Array<{
    text: string;
    onPress: () => void;
    style?: "primary" | "secondary" | "danger";
  }>;
  showCloseButton?: boolean;
  icon?: string;
  loading?: boolean;
}

export default function CustomModal({
  visible,
  onClose,
  title,
  message,
  buttons = [],
  showCloseButton = false,
  icon,
  loading = false,
}: CustomModalProps) {
  const { theme } = useTheme();

  const getButtonStyle = (style?: string) => {
    switch (style) {
      case "danger":
        return { backgroundColor: "#ff4444" };
      case "secondary":
        return { backgroundColor: theme.buttonBackground };
      default:
        return { backgroundColor: theme.buttonBackground };
    }
  };

  const getButtonTextStyle = (style?: string) => {
    switch (style) {
      case "danger":
        return { color: "white" };
      default:
        return theme.buttonTextStyle;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.card.backgroundColor },
          ]}
        >
          {/* Close button */}
          {showCloseButton && onClose && (
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          )}

          {/* Icon */}
          {icon && (
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
          )}

          {/* Title */}
          {title && (
            <Text style={[styles.title, { color: theme.textColor }]}>
              {title}
            </Text>
          )}

          {/* Message */}
          <Text style={[styles.message, { color: theme.textColor }]}>
            {message}
          </Text>

          {/* Loading indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: theme.textColor }]}>
                🚀 Processing...
              </Text>
            </View>
          )}

          {/* Buttons */}
          {buttons.length > 0 && (
            <View style={styles.buttonContainer}>
              {buttons.map((button, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    getButtonStyle(button.style),
                    { borderColor: theme.buttonBackground },
                  ]}
                  onPress={button.onPress}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      getButtonTextStyle(button.style),
                    ]}
                  >
                    {button.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 20,
    padding: 25,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
    borderWidth: 2,
    borderColor: "#333",
  },
  closeButton: {
    position: "absolute",
    top: 15,
    right: 15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  iconContainer: {
    marginBottom: 15,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 25,
  },
  loadingContainer: {
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 16,
    textAlign: "center",
  },
  buttonContainer: {
    width: "100%",
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: "center",
    minWidth: 120,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
