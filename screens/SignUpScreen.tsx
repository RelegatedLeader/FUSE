import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  ScrollView,
  Linking,
  Alert,
  TouchableOpacity,
  Modal,
  Dimensions,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import Slider from "@react-native-community/slider";
import CryptoJS from "crypto-js";
import { FirebaseService } from "../utils/firebaseService";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import CustomModal from "../components/CustomModal";
import FaceDetector from "@react-native-ml-kit/face-detection";

type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  Main: undefined;
};

type SignUpScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "SignUp"
>;

type Props = {
  navigation: SignUpScreenNavigationProp;
};

const { width, height } = Dimensions.get("window");

// Sample data for suggestions
const GENDER_OPTIONS = ["Male", "Female"];
const SEXUALITY_OPTIONS = ["Straight", "Gay"];
const LOCATION_SUGGESTIONS = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "San Jose, CA",
];
const OCCUPATION_SUGGESTIONS = [
  "Software Engineer",
  "Designer",
  "Teacher",
  "Doctor",
  "Lawyer",
  "Entrepreneur",
  "Student",
  "Marketing Manager",
  "Sales Representative",
  "Data Analyst",
];
const CAREER_SUGGESTIONS = [
  "Tech Lead",
  "Product Manager",
  "CEO",
  "Research Scientist",
  "Professor",
  "Artist",
  "Entrepreneur",
  "Consultant",
  "Executive",
  "Creative Director",
];
const MBTI_SUGGESTIONS = [
  "INTJ",
  "INTP",
  "ENTJ",
  "ENTP",
  "INFJ",
  "INFP",
  "ENFJ",
  "ENFP",
  "ISTJ",
  "ISFJ",
  "ESTJ",
  "ESFJ",
  "ISTP",
  "ISFP",
  "ESTP",
  "ESFP",
];

export default function SignUpScreen({ navigation }: Props) {
  const {
    address,
    updateUserData,
    isInitialized,
    signIn,
    isRegistered,
    checkRegistration,
  } = useWallet();
  const { theme } = useTheme();
  console.log(
    "SignUpScreen rendered with address:",
    address,
    "isInitialized:",
    isInitialized
  );

  if (!isInitialized) {
    return (
      <View
        style={[styles.container, { backgroundColor: theme.backgroundColor }]}
      >
        <Text style={{ color: theme.textColor }}>Loading wallet...</Text>
      </View>
    );
  }
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [sexuality, setSexuality] = useState("");
  const [userLocation, setUserLocation] = useState("");
  const [occupation, setOccupation] = useState("");
  const [careerAspiration, setCareerAspiration] = useState("");
  const [mbti, setMbti] = useState("");
  const [bio, setBio] = useState("");
  const [id, setId] = useState(""); // Optional ID
  const [openEnded, setOpenEnded] = useState("");

  // Personality traits 0-100
  const [extroversion, setExtroversion] = useState(50);
  const [openness, setOpenness] = useState(50);
  const [conscientiousness, setConscientiousness] = useState(50);
  const [agreeableness, setAgreeableness] = useState(50);
  const [neuroticism, setNeuroticism] = useState(50);

  // UI states
  const [showGenderDropdown, setShowGenderDropdown] = useState(false);
  const [showSexualityDropdown, setShowSexualityDropdown] = useState(false);
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showOccupationSuggestions, setShowOccupationSuggestions] =
    useState(false);
  const [showCareerSuggestions, setShowCareerSuggestions] = useState(false);
  const [showMbtiSuggestions, setShowMbtiSuggestions] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [faceValidationMessage, setFaceValidationMessage] =
    useState<string>("");
  const [isFaceValid, setIsFaceValid] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [faceScanned, setFaceScanned] = useState(false);
  const [isTransactionLoading, setIsTransactionLoading] = useState(false);
  const [showManualMetaMaskPrompt, setShowManualMetaMaskPrompt] =
    useState(false);
  const rocketAnimation = useRef(new Animated.Value(0)).current;

  // Animate rocket when loading
  useEffect(() => {
    if (isTransactionLoading) {
      // Start rocket animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(rocketAnimation, {
            toValue: -10,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(rocketAnimation, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      // Reset animation
      rocketAnimation.setValue(0);
    }
  }, [isTransactionLoading, rocketAnimation]);
  const [scanStep, setScanStep] = useState<
    "center" | "left" | "right" | "complete"
  >("center");
  const [capturedImages, setCapturedImages] = useState<{ [key: string]: any }>(
    {}
  );
  const [isScanning, setIsScanning] = useState(false);

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
  const [detectedFaceAngle, setDetectedFaceAngle] = useState<
    "center" | "left" | "right" | "unknown"
  >("unknown");
  const [isDetectingFaces, setIsDetectingFaces] = useState(false);
  const cameraRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  useEffect(() => {
    console.log("SignUpScreen address changed:", address);
  }, [address]);

  // Load saved form data on component mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        const savedData = await AsyncStorage.getItem("signupFormData");
        if (savedData) {
          const parsedData = JSON.parse(savedData);
          setFirstName(parsedData.firstName || "");
          setLastName(parsedData.lastName || "");
          setEmail(parsedData.email || "");
          setDob(parsedData.dob || "");
          setGender(parsedData.gender || "");
          setSexuality(parsedData.sexuality || "");
          setUserLocation(parsedData.userLocation || "");
          setOccupation(parsedData.occupation || "");
          setCareerAspiration(parsedData.careerAspiration || "");
          setMbti(parsedData.mbti || "");
          setBio(parsedData.bio || "");
          setId(parsedData.id || "");
          setOpenEnded(parsedData.openEnded || "");
          setExtroversion(parsedData.extroversion || 50);
          setOpenness(parsedData.openness || 50);
          setConscientiousness(parsedData.conscientiousness || 50);
          setAgreeableness(parsedData.agreeableness || 50);
          setNeuroticism(parsedData.neuroticism || 50);
          console.log("Loaded saved form data");
        }
      } catch (error) {
        console.log("Error loading saved form data:", error);
      }
    };
    loadSavedData();
  }, []);

  // Save form data whenever it changes
  const saveFormData = async () => {
    try {
      const formData = {
        firstName,
        lastName,
        email,
        dob,
        gender,
        sexuality,
        userLocation,
        occupation,
        careerAspiration,
        mbti,
        bio,
        id,
        openEnded,
        extroversion,
        openness,
        conscientiousness,
        agreeableness,
        neuroticism,
      };
      await AsyncStorage.setItem("signupFormData", JSON.stringify(formData));
    } catch (error) {
      console.log("Error saving form data:", error);
    }
  };

  // Save data on any change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(saveFormData, 500); // Save after 500ms of no changes
    return () => clearTimeout(timeoutId);
  }, [
    firstName,
    lastName,
    email,
    dob,
    gender,
    sexuality,
    userLocation,
    occupation,
    careerAspiration,
    mbti,
    bio,
    id,
    openEnded,
    extroversion,
    openness,
    conscientiousness,
    agreeableness,
    neuroticism,
  ]);

  // Real-time face detection simulation based on scan step
  useEffect(() => {
    if (showCameraModal && scanStep !== "complete") {
      // Simulate real-time detection by cycling through angles
      const interval = setInterval(() => {
        setDetectedFaceAngle((prev) => {
          if (scanStep === "center") {
            return prev === "center" ? "unknown" : "center";
          } else if (scanStep === "left") {
            return prev === "left" ? "unknown" : "left";
          } else if (scanStep === "right") {
            return prev === "right" ? "unknown" : "right";
          }
          return "unknown";
        });
      }, 1000); // Update every second

      return () => clearInterval(interval);
    } else {
      setDetectedFaceAngle("unknown");
    }
  }, [showCameraModal, scanStep]);

  // Check registration status when address changes
  useEffect(() => {
    if (address && isInitialized) {
      console.log("Address available, checking registration status...");
      checkRegistration().then((registered) => {
        console.log("Registration check result:", registered);
      });
    }
  }, [address, isInitialized, checkRegistration]);

  // Real-time validation
  const updateValidationErrors = () => {
    const errors: string[] = [];
    const currentWordCount = bio
      .split(" ")
      .filter((word) => word.length > 0).length;

    if (!firstName.trim()) errors.push("First name is required");
    if (!lastName.trim()) errors.push("Last name is required");
    if (!email.trim()) errors.push("Email is required");
    if (!dob.trim()) errors.push("Date of birth is required");
    if (!gender) errors.push("Gender selection is required");
    if (!sexuality) errors.push("Sexuality selection is required");
    if (!userLocation.trim()) errors.push("Location is required");
    if (!occupation.trim()) errors.push("Occupation is required");
    if (!careerAspiration.trim()) errors.push("Career aspiration is required");
    if (!mbti.trim()) errors.push("MBTI type is required");
    if (currentWordCount < 100)
      errors.push(
        `Bio must be at least 100 words (currently ${currentWordCount})`
      );
    if (!faceScanned) errors.push("Face verification is required");

    // Validate date format
    if (dob.trim()) {
      const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
      if (!dateRegex.test(dob)) {
        errors.push("Date must be in MM/DD/YYYY format");
      }
    }

    setValidationErrors(errors);
  };

  // Update validation on any change
  useEffect(() => {
    updateValidationErrors();
  }, [
    firstName,
    lastName,
    email,
    dob,
    gender,
    sexuality,
    userLocation,
    occupation,
    careerAspiration,
    mbti,
    bio,
    faceScanned,
  ]);

  const validateFaceAngle = async (
    photo: any,
    expectedAngle: "center" | "left" | "right"
  ): Promise<boolean> => {
    try {
      // Basic validation - check if we have image data
      if (!photo || !photo.base64) {
        setFaceValidationMessage("No image captured. Please try again.");
        setIsFaceValid(false);
        return false;
      }

      // For now, we'll do basic validation - in production you'd use ML face detection
      // Check image size as a basic proxy for content
      if (photo.base64.length < 10000) {
        // Very small image
        setFaceValidationMessage(
          "Image too small. Please ensure proper lighting and positioning."
        );
        setIsFaceValid(false);
        return false;
      }

      // Simulate angle validation with user feedback
      if (expectedAngle === "center") {
        setFaceValidationMessage("✓ Front face captured successfully!");
        setIsFaceValid(true);
        return true;
      } else if (expectedAngle === "left") {
        setFaceValidationMessage("✓ Left profile captured successfully!");
        setIsFaceValid(true);
        return true;
      } else if (expectedAngle === "right") {
        setFaceValidationMessage("✓ Right profile captured successfully!");
        setIsFaceValid(true);
        return true;
      }

      return false;
    } catch (error) {
      console.error("Face validation error:", error);
      setFaceValidationMessage("Validation failed. Please try again.");
      setIsFaceValid(false);
      return false;
    }
  };

  const detectFaceAngle = async (frameData: any) => {
    if (isDetectingFaces || !frameData || isScanning || scanStep === "complete")
      return;

    setIsDetectingFaces(true);
    try {
      const faces = await FaceDetector.detect(frameData);
      if (faces.length > 0) {
        const face = faces[0];

        // Basic angle detection based on face bounds and landmarks
        let detectedAngle: "center" | "left" | "right" | "unknown" = "unknown";
        let isProperlyPositioned = false;

        // Check if face is roughly centered in the oval
        const faceCenterX =
          (face.frame.left + face.frame.left + face.frame.width) / 2;
        const faceCenterY =
          (face.frame.top + face.frame.top + face.frame.height) / 2;
        const ovalCenterX = width / 2;
        const ovalCenterY = height * 0.4; // Approximate oval center

        const distanceFromCenter = Math.sqrt(
          Math.pow(faceCenterX - ovalCenterX, 2) +
            Math.pow(faceCenterY - ovalCenterY, 2)
        );

        // If face is close to center, consider it positioned
        if (distanceFromCenter < 100) {
          // Within 100 pixels of center
          isProperlyPositioned = true;

          // For now, assume the current scan step angle if positioned properly
          // In production, analyze facial landmarks for precise angles
          if (
            scanStep === "center" ||
            scanStep === "left" ||
            scanStep === "right"
          ) {
            detectedAngle = scanStep;
          }
        }

        setDetectedFaceAngle(detectedAngle);

        // Auto-capture if face is properly positioned and angle matches expected
        if (
          isProperlyPositioned &&
          detectedAngle === scanStep &&
          !capturedImages[scanStep]
        ) {
          console.log(`Auto-capturing ${scanStep} face...`);
          setFaceValidationMessage(
            `✓ ${
              scanStep.charAt(0).toUpperCase() + scanStep.slice(1)
            } face detected! Capturing...`
          );
          setIsFaceValid(true);

          // Auto-take picture after a short delay to show feedback
          setTimeout(async () => {
            await takePicture();
          }, 1000);
        } else if (isProperlyPositioned) {
          setFaceValidationMessage(
            `✓ Face positioned correctly. Hold still for ${scanStep} capture.`
          );
          setIsFaceValid(true);
        } else {
          setFaceValidationMessage(
            "Position your face in the center of the oval"
          );
          setIsFaceValid(false);
        }
      } else {
        setDetectedFaceAngle("unknown");
        setFaceValidationMessage(
          "No face detected. Position your face in the oval."
        );
        setIsFaceValid(false);
      }
    } catch (error) {
      console.error("Face detection error:", error);
      setDetectedFaceAngle("unknown");
      setFaceValidationMessage("Face detection error. Please try again.");
      setIsFaceValid(false);
    } finally {
      setIsDetectingFaces(false);
    }
  };

  const handleMbtiLink = () => {
    Linking.openURL("https://www.16personalities.com/free-personality-test");
  };

  const takePicture = async () => {
    if (!cameraRef.current || isScanning) return;

    setIsScanning(true);
    setFaceValidationMessage("");
    setIsFaceValid(false);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
      });

      // Validate the captured face angle (only for actual scanning steps)
      if (scanStep !== "complete") {
        const isValid = await validateFaceAngle(
          photo,
          scanStep as "center" | "left" | "right"
        );

        if (!isValid) {
          // Don't proceed to next step if validation failed
          setIsScanning(false);
          return;
        }
      }

      // Store the captured image only if validation passed
      const newCapturedImages = { ...capturedImages, [scanStep]: photo };
      setCapturedImages(newCapturedImages);

      // Move to next step or complete
      if (scanStep === "center") {
        setScanStep("left");
      } else if (scanStep === "left") {
        setScanStep("right");
      } else if (scanStep === "right") {
        setScanStep("complete");
        setFaceScanned(true);
        // Close the modal after a brief delay to show completion
        setTimeout(() => {
          setShowCameraModal(false);
        }, 1500);
        // Process all captured images here
        console.log(
          "Face scan complete! Captured images:",
          Object.keys(newCapturedImages)
        );
      }
    } catch (error) {
      console.error("Error taking picture:", error);
      setFaceValidationMessage("Failed to capture image. Please try again.");
      showCustomModal("Error", "Failed to capture image. Please try again.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleSignUp = async () => {
    console.log("SignUp handleSignUp called, address:", address);
    if (!address) {
      showCustomModal("Error", "Please connect your wallet first");
      return;
    }

    // Check for validation errors
    if (validationErrors.length > 0) {
      showCustomModal(
        "Missing Requirements",
        "Please complete the following:\n\n" +
          validationErrors.map((error) => "• " + error).join("\n")
      );
      return;
    }

    // Execute signup immediately - MetaMask will show confirmation
    await executeSignUp();
  };

  const executeSignUp = async () => {
    console.log("executeSignUp called");
    setIsTransactionLoading(true);
    setShowManualMetaMaskPrompt(false);

    try {
      const traitsStr = JSON.stringify({
        extroversion,
        openness,
        conscientiousness,
        agreeableness,
        neuroticism,
      });

      // Prepare face scan data for local storage only
      const faceScanData = {
        center: capturedImages.center?.base64 || "",
        left: capturedImages.left?.base64 || "",
        right: capturedImages.right?.base64 || "",
        timestamp: new Date().toISOString(),
      };
      const encryptedFaceData = CryptoJS.AES.encrypt(
        JSON.stringify(faceScanData),
        "face-scan-encryption-key-2025" // In production, use a more secure key derivation
      ).toString();

      // Combine user data WITHOUT face scans for blockchain (too large)
      const blockchainUserData = {
        personalityTraits: {
          extroversion,
          openness,
          conscientiousness,
          agreeableness,
          neuroticism,
        },
        bio,
        openEnded,
        sexuality,
      };

      // Show manual MetaMask prompt after a short delay if transaction doesn't complete quickly
      // NOTE: Removed manual prompt since we now force open MetaMask automatically

      // Call updateUserData directly (this handles both registration and data storage for new users)
      // Note: Face scans are stored locally only due to transaction size limits
      const result = await updateUserData(
        firstName,
        lastName,
        dob,
        gender,
        userLocation,
        id,
        JSON.stringify(blockchainUserData), // Face scans removed from blockchain storage
        mbti
      );

      // Store user profile in Firebase for matching
      try {
        await FirebaseService.storeUserProfile(address, {
          firstName,
          lastName,
          email,
          dob,
          gender,
          sexuality,
          location: userLocation,
          occupation,
          careerAspiration,
          mbti,
          bio,
          id,
          openEnded,
          personalityTraits: {
            extroversion,
            openness,
            conscientiousness,
            agreeableness,
            neuroticism,
          },
          transactionHash: result.hash,
          walletAddress: address,
        });
        console.log("User profile stored in Firebase successfully");
      } catch (firebaseError) {
        console.error(
          "Failed to store user profile in Firebase:",
          firebaseError
        );
        // Don't fail the entire sign-up if Firebase storage fails
        // User can still use the app, just won't appear in matching until Firebase is fixed
      }

      // Clear the manual prompt timer
      // NOTE: Removed since we force open MetaMask automatically
      setIsTransactionLoading(false);
      setShowManualMetaMaskPrompt(false);

      // Store locally as well for quick access (wallet-specific key)
      await AsyncStorage.setItem(
        `userData_${address}`,
        JSON.stringify({
          firstName,
          lastName,
          email,
          dob,
          gender,
          sexuality,
          location: userLocation,
          occupation,
          careerAspiration,
          mbti,
          bio,
          id,
          openEnded,
          personalityTraits: {
            extroversion,
            openness,
            conscientiousness,
            agreeableness,
            neuroticism,
          },
          faceScans: encryptedFaceData, // Store encrypted face data locally too
          transactionHash: result.hash,
        })
      );

      showCustomModal(
        "Account Created Successfully!",
        `Your encrypted profile data has been stored on the blockchain${
          result.note ? " (simulated)" : ""
        }.\n\nFace scans are securely stored locally on your device.\n\nTransaction ID: ${
          result.hash
        }\n\n${
          result.note ? result.note + "\n\n" : ""
        }You can use this transaction ID to retrieve your profile data anytime.`,
        [
          {
            text: "View Profile",
            onPress: () => {
              setModalVisible(false);
              navigation.navigate("Main");
            },
          },
        ]
      );
    } catch (error) {
      console.error("SignUp error:", error);
      setIsTransactionLoading(false);
      setShowManualMetaMaskPrompt(false);
      showCustomModal(
        "Transaction Failed",
        "Failed to store data on blockchain: " + (error as Error).message,
        [
          {
            text: "Try Again",
            onPress: () => {
              setModalVisible(false);
              executeSignUp();
            },
          },
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => setModalVisible(false),
          },
        ]
      );
    }
  };

  const renderDropdown = (
    options: string[],
    selectedValue: string,
    onSelect: (value: string) => void,
    placeholder: string
  ) => (
    <TouchableOpacity
      style={styles.dropdown}
      onPress={() => {
        showCustomModal(
          placeholder,
          "Select an option",
          options.map((option) => ({
            text: option,
            onPress: () => onSelect(option),
          }))
        );
      }}
    >
      <Text
        style={selectedValue ? styles.dropdownText : styles.placeholderText}
      >
        {selectedValue || placeholder}
      </Text>
    </TouchableOpacity>
  );

  const renderSuggestions = (
    suggestions: string[],
    currentValue: string,
    onSelect: (value: string) => void,
    placeholder: string,
    showSuggestions: boolean,
    setShowSuggestions: (show: boolean) => void
  ) => (
    <View>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={currentValue}
        onChangeText={(text) => {
          onSelect(text);
          setShowSuggestions(text.length > 0);
        }}
        onFocus={() => setShowSuggestions(true)}
      />
      {showSuggestions && currentValue.length > 0 && (
        <View style={styles.suggestionsContainer}>
          {suggestions
            .filter((s) => s.toLowerCase().includes(currentValue.toLowerCase()))
            .slice(0, 5)
            .map((item) => (
              <TouchableOpacity
                key={item}
                style={styles.suggestionItem}
                onPress={() => {
                  onSelect(item);
                  setShowSuggestions(false);
                }}
              >
                <Text>{item}</Text>
              </TouchableOpacity>
            ))}
        </View>
      )}
    </View>
  );

  const wordCount = bio.split(" ").filter((word) => word.length > 0).length;

  return (
    <View
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      {/* Transaction Loading Modal with Rocket Ship */}
      <Modal
        visible={isTransactionLoading}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.loadingModal}>
            <Animated.View
              style={[
                styles.rocketContainer,
                {
                  transform: [{ translateY: rocketAnimation }],
                },
              ]}
            >
              <Text style={styles.rocketEmoji}>🚀</Text>
              <View style={styles.rocketTrail}>
                <Text style={styles.trailDot}>•</Text>
                <Text style={styles.trailDot}>•</Text>
                <Text style={styles.trailDot}>•</Text>
              </View>
            </Animated.View>
            <Text style={styles.loadingTitle}>Launching to Polygon</Text>
            <Text style={styles.loadingSubtitle}>
              Storing your encrypted profile data on the blockchain...
              {"\n\n"}🔗 Opening MetaMask automatically to approve the
              transaction.
            </Text>
          </View>
        </View>
      </Modal>
      <ScrollView
        ref={scrollViewRef}
        style={[styles.scrollView, { backgroundColor: theme.backgroundColor }]}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        {/* Wallet Display */}
        {address && (
          <View style={styles.walletDisplay}>
            <Text style={styles.walletText}>
              Connected: {address.slice(0, 6)}...{address.slice(-4)}
            </Text>
          </View>
        )}
        <Text style={[styles.title, { color: theme.textColor }]}>
          Create Your Fuse Profile
        </Text>

        {/* Data Immutability Warning */}
        <View style={styles.warningContainer}>
          <Text style={styles.warningIcon}>⚠️</Text>
          <Text style={styles.warningText}>
            <Text style={styles.warningTitle}>IMPORTANT:</Text> All information
            you provide will be stored encrypted on the Polygon blockchain and
            become your permanent digital profile. This data is immutable and
            cannot be changed once submitted. It will help match you with the
            best possible beings out there. Please ensure all information is
            100% accurate as it represents your real digital identity.
          </Text>
        </View>

        {/* Validation Errors */}
        {validationErrors.length > 0 && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorIcon}>❌</Text>
            <Text style={styles.errorText}>
              <Text style={styles.errorTitle}>MISSING REQUIREMENTS:</Text>
              {"\n"}
              {validationErrors.join("\n• ")}
            </Text>
          </View>
        )}

        {/* Basic Information */}
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          Basic Information
        </Text>
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
        />
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={lastName}
          onChangeText={setLastName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Date of Birth (MM/DD/YYYY)"
          value={dob}
          onChangeText={setDob}
        />
        {renderDropdown(GENDER_OPTIONS, gender, setGender, "Select Gender")}
        {renderDropdown(
          SEXUALITY_OPTIONS,
          sexuality,
          setSexuality,
          "Select Sexuality"
        )}
        {/* Location & Career */}
        <Text style={styles.sectionTitle}>Location & Career</Text>
        {renderSuggestions(
          LOCATION_SUGGESTIONS,
          userLocation,
          setUserLocation,
          "Enter your location",
          showLocationSuggestions,
          setShowLocationSuggestions
        )}
        {renderSuggestions(
          OCCUPATION_SUGGESTIONS,
          occupation,
          setOccupation,
          "Current occupation",
          showOccupationSuggestions,
          setShowOccupationSuggestions
        )}
        {renderSuggestions(
          CAREER_SUGGESTIONS,
          careerAspiration,
          setCareerAspiration,
          "Career aspiration",
          showCareerSuggestions,
          setShowCareerSuggestions
        )}
        {/* Personality Traits */}
        <Text style={styles.sectionTitle}>Personality Traits</Text>
        <Text style={styles.sliderLabel}>Extroversion: {extroversion}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={extroversion}
          onValueChange={setExtroversion}
          minimumTrackTintColor="#007AFF"
          maximumTrackTintColor="#CCCCCC"
        />
        <Text style={styles.sliderLabel}>Openness: {openness}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={openness}
          onValueChange={setOpenness}
          minimumTrackTintColor="#007AFF"
          maximumTrackTintColor="#CCCCCC"
        />
        <Text style={styles.sliderLabel}>
          Conscientiousness: {conscientiousness}%
        </Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={conscientiousness}
          onValueChange={setConscientiousness}
          minimumTrackTintColor="#007AFF"
          maximumTrackTintColor="#CCCCCC"
        />
        <Text style={styles.sliderLabel}>Agreeableness: {agreeableness}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={agreeableness}
          onValueChange={setAgreeableness}
          minimumTrackTintColor="#007AFF"
          maximumTrackTintColor="#CCCCCC"
        />
        <Text style={styles.sliderLabel}>Neuroticism: {neuroticism}%</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          value={neuroticism}
          onValueChange={setNeuroticism}
          minimumTrackTintColor="#007AFF"
          maximumTrackTintColor="#CCCCCC"
        />
        {/* MBTI */}
        <Text style={styles.sectionTitle}>MBTI Personality Type</Text>
        <TouchableOpacity style={styles.linkButton} onPress={handleMbtiLink}>
          <Text style={styles.linkText}>
            Take Official MBTI Test (Recommended)
          </Text>
        </TouchableOpacity>
        {renderSuggestions(
          MBTI_SUGGESTIONS,
          mbti,
          setMbti,
          "Enter your MBTI (e.g., ENFP)",
          showMbtiSuggestions,
          setShowMbtiSuggestions
        )}
        {/* Bio */}
        <Text style={styles.sectionTitle}>Personal Bio</Text>
        <Text
          style={[
            styles.bioHint,
            { color: wordCount >= 100 ? "#28a745" : "#dc3545" },
          ]}
        >
          Write a genuine bio about yourself. This helps our AI understand you
          better for matching. Minimum 100 words required. Current: {wordCount}{" "}
          words. Note: This bio is immutable and will be stored on the Polygon
          blockchain permanently.
        </Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          placeholder="Tell us about your interests, values, goals, and what makes you unique..."
          multiline
          value={bio}
          onChangeText={setBio}
          textAlignVertical="top"
        />
        {/* Optional ID */}
        <Text style={styles.sectionTitle}>Optional Verification</Text>
        <TextInput
          style={styles.input}
          placeholder="ID Number (optional - for enhanced verification)"
          value={id}
          onChangeText={setId}
        />
        {/* Open-Ended Question */}
        <Text style={styles.sectionTitle}>Tell Us More</Text>
        <TextInput
          style={[styles.input, styles.openEndedInput]}
          placeholder="What's something interesting about you that isn't covered above?"
          multiline
          value={openEnded}
          onChangeText={setOpenEnded}
          textAlignVertical="top"
        />
        {/* Face Scan */}
        <Text style={styles.sectionTitle}>Face Verification</Text>
        {!permission ? (
          <Text style={styles.permissionText}>
            Requesting camera permission...
          </Text>
        ) : !permission.granted ? (
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <Text style={styles.permissionButtonText}>
              Grant Camera Permission
            </Text>
          </TouchableOpacity>
        ) : !faceScanned ? (
          <TouchableOpacity
            style={styles.startScanButton}
            onPress={() => {
              setScanStep("center");
              setCapturedImages({});
              setShowCameraModal(true);
            }}
          >
            <Text style={styles.startScanButtonText}>
              Start Face Verification
            </Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.scannedContainer}>
            <Text style={styles.scannedText}>
              ✓ Face verification complete!
            </Text>
            <Text style={styles.scannedSubtext}>
              3 face angles captured and encrypted
            </Text>
          </View>
        )}

        {/* Full Screen Camera Modal */}
        <Modal
          visible={showCameraModal}
          animationType="fade"
          presentationStyle="fullScreen"
          onRequestClose={() => setShowCameraModal(false)}
        >
          <View style={styles.fullScreenCameraContainer}>
            <CameraView
              style={styles.fullScreenCamera}
              facing="front"
              ref={cameraRef}
            />
            <View style={styles.cameraOverlay}>
              {/* Oval Guide */}
              <View style={styles.ovalGuide}>
                <View style={styles.oval} />
              </View>

              {/* Instructions */}
              <View style={styles.instructionsContainer}>
                <Text style={styles.instructionsTitle}>Face Verification</Text>
                <Text style={styles.instructionsText}>
                  {scanStep === "center" &&
                    detectedFaceAngle === "center" &&
                    "✓ Face detected - hold steady for front capture"}
                  {scanStep === "center" &&
                    detectedFaceAngle !== "center" &&
                    "Position your face in the center of the oval"}
                  {scanStep === "left" &&
                    detectedFaceAngle === "left" &&
                    "✓ Left profile detected - hold steady for capture"}
                  {scanStep === "left" &&
                    detectedFaceAngle !== "left" &&
                    "Slowly turn your head to the left"}
                  {scanStep === "right" &&
                    detectedFaceAngle === "right" &&
                    "✓ Right profile detected - hold steady for capture"}
                  {scanStep === "right" &&
                    detectedFaceAngle !== "right" &&
                    "Slowly turn your head to the right"}
                  {scanStep === "complete" && "Face scan complete!"}
                </Text>

                {/* Real-time Status */}
                {detectedFaceAngle !== "unknown" && scanStep !== "complete" && (
                  <Text style={styles.realTimeStatus}>
                    {detectedFaceAngle === "center" &&
                      "📷 Scanning front face..."}
                    {detectedFaceAngle === "left" && "📷 Scanning left side..."}
                    {detectedFaceAngle === "right" &&
                      "📷 Scanning right side..."}
                  </Text>
                )}

                {/* Validation Message */}
                {faceValidationMessage ? (
                  <Text
                    style={[
                      styles.validationMessage,
                      isFaceValid
                        ? styles.validationSuccess
                        : styles.validationError,
                    ]}
                  >
                    {faceValidationMessage}
                  </Text>
                ) : null}

                {/* Progress Indicators */}
                <View style={styles.progressContainer}>
                  <View
                    style={[
                      styles.progressDot,
                      scanStep === "center" ||
                      scanStep === "left" ||
                      scanStep === "right" ||
                      scanStep === "complete"
                        ? styles.progressDotActive
                        : null,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressDot,
                      scanStep === "left" ||
                      scanStep === "right" ||
                      scanStep === "complete"
                        ? styles.progressDotActive
                        : null,
                    ]}
                  />
                  <View
                    style={[
                      styles.progressDot,
                      scanStep === "right" || scanStep === "complete"
                        ? styles.progressDotActive
                        : null,
                    ]}
                  />
                </View>

                <Text style={styles.progressText}>
                  Step{" "}
                  {scanStep === "center"
                    ? "1"
                    : scanStep === "left"
                    ? "2"
                    : scanStep === "right"
                    ? "3"
                    : "Complete"}{" "}
                  of 3
                </Text>
              </View>

              {/* Scan Button */}
              <TouchableOpacity
                style={[
                  styles.scanButton,
                  isScanning && styles.scanButtonDisabled,
                ]}
                onPress={takePicture}
                disabled={isScanning}
              >
                <Text style={styles.scanButtonText}>
                  {isScanning
                    ? "Capturing..."
                    : scanStep === "complete"
                    ? "Complete"
                    : "Capture"}
                </Text>
              </TouchableOpacity>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowCameraModal(false)}
              >
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Sign Up Button */}
        <TouchableOpacity
          style={[
            styles.signUpButton,
            validationErrors.length > 0 && styles.signUpButtonDisabled,
          ]}
          onPress={handleSignUp}
          disabled={validationErrors.length > 0}
        >
          <Text style={styles.signUpButtonText}>Create Account</Text>
        </TouchableOpacity>
        <View style={styles.bottomPadding} />
      </ScrollView>
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
  container: { flex: 1, backgroundColor: "#f5f5f5" },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 100 },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    textAlign: "center",
    color: "#333",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 25,
    marginBottom: 15,
    color: "#007AFF",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    fontSize: 16,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#fff",
    justifyContent: "center",
  },
  dropdownText: { fontSize: 16, color: "#333" },
  placeholderText: { fontSize: 16, color: "#999" },
  suggestionsContainer: {
    maxHeight: 150,
    borderWidth: 1,
    borderColor: "#ddd",
    borderTopWidth: 0,
    backgroundColor: "#fff",
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  suggestionItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  slider: { width: "100%", height: 40, marginBottom: 20 },
  sliderLabel: { fontSize: 16, marginBottom: 8, color: "#333" },
  linkButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: "center",
  },
  linkText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  bioHint: { fontSize: 14, color: "#666", marginBottom: 8, lineHeight: 20 },
  bioInput: { height: 120, textAlignVertical: "top" },
  openEndedInput: { height: 80, textAlignVertical: "top" },
  permissionText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 12,
  },
  permissionButton: {
    backgroundColor: "#007AFF",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  permissionButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  fullScreenCameraContainer: { flex: 1, backgroundColor: "#000" },
  fullScreenCamera: { flex: 1 },
  cameraContainer: { marginBottom: 20, borderRadius: 12, overflow: "hidden" },
  camera: { height: 300 },
  cameraOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  ovalGuide: {
    position: "absolute",
    top: "15%",
    left: "15%",
    right: "15%",
    bottom: "35%",
    justifyContent: "center",
    alignItems: "center",
  },
  oval: {
    width: Math.min(width * 0.7, 400), // Responsive width, max 400
    height: Math.min(height * 0.4, 550), // Responsive height, max 550
    borderRadius: Math.min(width * 0.35, 200), // Half of width for oval
    borderWidth: 4,
    borderColor: "#007AFF",
    backgroundColor: "transparent",
  },
  instructionsContainer: {
    position: "absolute",
    bottom: 120,
    left: 20,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  instructionsTitle: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  instructionsText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 12,
    lineHeight: 20,
  },
  progressContainer: {
    flexDirection: "row",
    marginBottom: 8,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#666",
    marginHorizontal: 4,
  },
  progressDotActive: {
    backgroundColor: "#007AFF",
  },
  progressText: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.8,
  },
  scanButton: {
    position: "absolute",
    bottom: 40,
    backgroundColor: "rgba(0, 122, 255, 0.9)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: "center",
    minWidth: 120,
  },
  scanButtonDisabled: {
    backgroundColor: "rgba(102, 102, 102, 0.9)",
  },
  scanButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  startScanButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  startScanButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  realTimeStatus: {
    color: "#4CAF50",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  validationMessage: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  validationSuccess: {
    backgroundColor: "rgba(0, 128, 0, 0.8)",
    color: "#fff",
  },
  validationError: {
    backgroundColor: "rgba(255, 0, 0, 0.8)",
    color: "#fff",
  },
  scannedContainer: {
    backgroundColor: "#e8f5e8",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  scannedText: { color: "#2e7d32", fontSize: 16, fontWeight: "bold" },
  scannedSubtext: {
    color: "#2e7d32",
    fontSize: 12,
    marginTop: 4,
    opacity: 0.8,
  },
  signUpButton: {
    backgroundColor: "#007AFF",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
    marginBottom: 20,
  },
  signUpButtonDisabled: { backgroundColor: "#ccc" },
  signUpButtonText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  walletDisplay: {
    backgroundColor: "#f0f0f0",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  walletText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "600",
  },
  bottomPadding: { height: 50 },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    minWidth: 300,
  },
  rocketContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  rocketEmoji: {
    fontSize: 60,
    marginBottom: 10,
  },
  rocketTrail: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  trailDot: {
    fontSize: 20,
    color: "#007AFF",
    marginHorizontal: 2,
    opacity: 0.6,
  },
  loadingTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
  },
  loadingSubtitle: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  manualPrompt: {
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  manualPromptTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 8,
    textAlign: "center",
  },
  manualPromptText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  manualButton: {
    backgroundColor: "#F6851B", // MetaMask orange
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  manualButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  warningContainer: {
    backgroundColor: "#fff3cd",
    borderColor: "#ffeaa7",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  warningIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: "#856404",
    lineHeight: 20,
  },
  warningTitle: {
    fontWeight: "bold",
    fontSize: 14,
  },
  errorContainer: {
    backgroundColor: "#f8d7da",
    borderColor: "#f5c6cb",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  errorIcon: {
    fontSize: 24,
    marginRight: 12,
    marginTop: 2,
    color: "#721c24",
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: "#721c24",
    lineHeight: 20,
  },
  errorTitle: {
    fontWeight: "bold",
    fontSize: 14,
  },
});
