import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import CustomModal from "../components/CustomModal";
import { StackNavigationProp } from "@react-navigation/stack";

// Define navigation types
type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  Main: undefined;
};

type SignInScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SignIn"
>;

type Props = {
  navigation: SignInScreenNavigationProp;
};

export default function SignInScreen({ navigation }: Props) {
  const { address, isRegistered, signIn, checkRegistration } = useWallet();
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);

  // Custom modal states
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  const [modalButtons, setModalButtons] = useState<any[]>([]);

  // Helper function to show custom modal
  const showCustomModal = (
    title: string,
    message: string,
    buttons: any[] = []
  ) => {
    setModalTitle(title);
    setModalMessage(message);
    setModalButtons(buttons);
    setModalVisible(true);
  };

  useEffect(() => {
    const initialize = async () => {
      if (address) {
        await checkRegistration();
      }
      setLoading(false);
    };
    initialize();
  }, [address, checkRegistration]);

  const handleSignIn = async () => {
    if (isRegistered) {
      // Show gas confirmation for sign in transaction
      showCustomModal(
        "Confirm Sign In",
        "This will update your activity data on the blockchain. This requires a small gas fee.\n\nEstimated gas cost: ~0.005 MATIC\n\nDo you want to proceed?",
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Pay Gas & Sign In",
            style: "default",
            onPress: () => {
              // Execute immediately without async wrapper
              executeSignIn();
            },
          },
        ]
      );
    } else {
      navigation.navigate("SignUp");
    }
  };

  const executeSignIn = async () => {
    try {
      // Show processing modal
      showCustomModal(
        "Processing",
        "Updating your activity on the blockchain..."
      );

      console.log("Calling signIn...");
      await signIn();

      // Close processing modal and show success modal
      setModalVisible(false);
      setTimeout(() => {
        showCustomModal(
          "Success",
          "Signed in successfully! Your activity has been recorded on the blockchain.",
          [
            {
              text: "OK",
              onPress: () => {
                setModalVisible(false);
                navigation.navigate("Main");
              },
            },
          ]
        );
      }, 300); // Small delay to ensure smooth transition
    } catch (error) {
      console.error("SignIn error:", error);
      // Close processing modal and show error modal
      setModalVisible(false);
      setTimeout(() => {
        showCustomModal(
          "Sign In Failed",
          "Failed to sign in: " + (error as Error).message,
          [
            {
              text: "Try Again",
              onPress: () => {
                setModalVisible(false);
                executeSignIn();
              },
            },
            {
              text: "Cancel",
              style: "cancel",
              onPress: () => setModalVisible(false),
            },
          ]
        );
      }, 300);
    }
  };

  if (loading) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text style={{ color: theme.textColor }}>Loading...</Text>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <Text style={theme.title}>Welcome to Fuse</Text>
      <Text style={theme.subtitle}>Piece together your social network</Text>
      <Text
        style={{
          color: theme.textColor,
          textAlign: "center",
          marginBottom: 30,
        }}
      >
        Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}
      </Text>
      <TouchableOpacity style={theme.button} onPress={handleSignIn}>
        <Text style={theme.buttonTextStyle}>
          🚀 {isRegistered ? "Sign In & Launch" : "Sign Up & Launch"}
        </Text>
      </TouchableOpacity>
      <CustomModal
        visible={modalVisible}
        title={modalTitle}
        message={modalMessage}
        buttons={modalButtons}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
});
