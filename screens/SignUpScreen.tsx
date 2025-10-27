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
  FlatList,
  Dimensions,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "../contexts/WalletContext";
import { updateUserData } from "../utils/contract";
import Slider from "@react-native-community/slider";

const { width, height } = Dimensions.get("window");

// Sample data for suggestions
const GENDER_OPTIONS = ["Male", "Female"];
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

export default function SignUpScreen({ navigation }) {
  const { signer } = useWallet();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
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
  const [showLocationSuggestions, setShowLocationSuggestions] = useState(false);
  const [showOccupationSuggestions, setShowOccupationSuggestions] =
    useState(false);
  const [showCareerSuggestions, setShowCareerSuggestions] = useState(false);
  const [showMbtiSuggestions, setShowMbtiSuggestions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const [permission, requestPermission] = useCameraPermissions();
  const [faceScanned, setFaceScanned] = useState(false);
  const cameraRef = useRef<any>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleMbtiLink = () => {
    Linking.openURL("https://www.16personalities.com/free-personality-test");
  };

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      // TODO: Process face
      setFaceScanned(true);
    }
  };

  const handleSignUp = async () => {
    if (!signer) {
      Alert.alert("Error", "Please connect your wallet first");
      return;
    }

    if (
      !firstName ||
      !lastName ||
      !email ||
      !dob ||
      !gender ||
      !userLocation ||
      !occupation ||
      !careerAspiration ||
      !mbti ||
      bio.split(" ").length < 200
    ) {
      Alert.alert(
        "Error",
        "Please fill all required fields. Bio must be at least 200 words."
      );
      return;
    }

    // Show gas confirmation popup
    Alert.alert(
      "Confirm Transaction",
      "This will store your encrypted profile data on the Polygon blockchain. This requires a small gas fee.\n\nEstimated gas cost: ~0.01 MATIC\n\nDo you want to proceed?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Pay Gas & Create Account",
          style: "default",
          onPress: executeSignUp,
        },
      ]
    );
  };

  const executeSignUp = async () => {
    try {
      Alert.alert("Processing", "Storing your encrypted data on the blockchain...");

      const traitsStr = JSON.stringify({
        extroversion,
        openness,
        conscientiousness,
        agreeableness,
        neuroticism,
      });

      await updateUserData(
        signer,
        firstName,
        lastName,
        dob,
        gender,
        userLocation,
        id,
        traitsStr,
        mbti
      );

      // Store locally as well for quick access
      await AsyncStorage.setItem(
        "userData",
        JSON.stringify({
          firstName,
          lastName,
          email,
          dob,
          gender,
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
        })
      );

      Alert.alert("Success", "Account created successfully! Your encrypted data has been stored on the blockchain.");
      navigation.navigate("Main");
    } catch (error) {
      Alert.alert(
        "Transaction Failed",
        "Failed to store data on blockchain: " + (error as Error).message
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
        Alert.alert(
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
          <FlatList
            data={suggestions
              .filter((s) =>
                s.toLowerCase().includes(currentValue.toLowerCase())
              )
              .slice(0, 5)}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => {
                  onSelect(item);
                  setShowSuggestions(false);
                }}
              >
                <Text>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );

  const wordCount = bio.split(" ").filter((word) => word.length > 0).length;

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={styles.title}>Create Your Fuse Profile</Text>

        {/* Basic Information */}
        <Text style={styles.sectionTitle}>Basic Information</Text>
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
        <Text style={styles.bioHint}>
          Write a genuine bio about yourself. This helps our AI understand you
          better for matching. Minimum 200 words required. Current: {wordCount}{" "}
          words
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
          <View style={styles.cameraContainer}>
            <CameraView style={styles.camera} facing="front" ref={cameraRef}>
              <View style={styles.cameraOverlay}>
                <TouchableOpacity
                  style={styles.scanButton}
                  onPress={takePicture}
                >
                  <Text style={styles.scanButtonText}>Scan Face</Text>
                </TouchableOpacity>
              </View>
            </CameraView>
          </View>
        ) : (
          <View style={styles.scannedContainer}>
            <Text style={styles.scannedText}>✓ Face scanned successfully!</Text>
          </View>
        )}

        {/* Sign Up Button */}
        <TouchableOpacity
          style={[
            styles.signUpButton,
            (!firstName ||
              !lastName ||
              !email ||
              !dob ||
              !gender ||
              !userLocation ||
              !occupation ||
              !careerAspiration ||
              !mbti ||
              wordCount < 200 ||
              !faceScanned) &&
              styles.signUpButtonDisabled,
          ]}
          onPress={handleSignUp}
          disabled={
            !firstName ||
            !lastName ||
            !email ||
            !dob ||
            !gender ||
            !userLocation ||
            !occupation ||
            !careerAspiration ||
            !mbti ||
            wordCount < 200 ||
            !faceScanned
          }
        >
          <Text style={styles.signUpButtonText}>Create Account</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  cameraContainer: { marginBottom: 20, borderRadius: 12, overflow: "hidden" },
  camera: { height: 300 },
  cameraOverlay: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    alignItems: "center",
  },
  scanButton: {
    backgroundColor: "rgba(0, 122, 255, 0.9)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 25,
    alignItems: "center",
    minWidth: 120,
  },
  scanButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  scannedContainer: {
    backgroundColor: "#e8f5e8",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  scannedText: { color: "#2e7d32", fontSize: 16, fontWeight: "bold" },
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
  bottomPadding: { height: 50 },
});
