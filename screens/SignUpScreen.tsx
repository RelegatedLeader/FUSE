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
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useWallet } from "../contexts/WalletContext";
import { updateUserData } from "../utils/contract";

export default function SignUpScreen({ navigation }) {
  const { provider } = useWallet();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
  const [permission, requestPermission] = useCameraPermissions();
  const [faceScanned, setFaceScanned] = useState(false);
  const cameraRef = useRef<any>(null);

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
    try {
      const traitsStr = JSON.stringify({
        extroversion,
        openness,
        conscientiousness,
        agreeableness,
        neuroticism,
      });
      const faceStr = faceScanned ? "face_scanned" : "not_scanned";
      await updateUserData(
        provider,
        firstName,
        lastName,
        dob,
        gender,
        userLocation,
        id,
        traitsStr,
        mbti
      );
      Alert.alert("Success", "Data stored on blockchain!");
      navigation.navigate("Main");
    } catch (error: any) {
      Alert.alert("Error", "Failed to store data: " + error.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Sign Up</Text>
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
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Date of Birth"
        value={dob}
        onChangeText={setDob}
      />
      <TextInput
        style={styles.input}
        placeholder="Gender"
        value={gender}
        onChangeText={setGender}
      />
      <TextInput
        style={styles.input}
        placeholder="Location"
        value={userLocation}
        onChangeText={setUserLocation}
      />
      <TextInput
        style={styles.input}
        placeholder="Current Occupation"
        value={occupation}
        onChangeText={setOccupation}
      />
      <TextInput
        style={styles.input}
        placeholder="Career Aspiration"
        value={careerAspiration}
        onChangeText={setCareerAspiration}
      />

      <Text style={styles.section}>Personality Traits (0-100%)</Text>
      <Text>Extroversion: {extroversion}%</Text>
      <TextInput
        style={styles.input}
        placeholder="0-100"
        keyboardType="numeric"
        value={extroversion.toString()}
        onChangeText={(v) => setExtroversion(parseInt(v) || 0)}
      />
      <Text>Openness: {openness}%</Text>
      <TextInput
        style={styles.input}
        placeholder="0-100"
        keyboardType="numeric"
        value={openness.toString()}
        onChangeText={(v) => setOpenness(parseInt(v) || 0)}
      />
      <Text>Conscientiousness: {conscientiousness}%</Text>
      <TextInput
        style={styles.input}
        placeholder="0-100"
        keyboardType="numeric"
        value={conscientiousness.toString()}
        onChangeText={(v) => setConscientiousness(parseInt(v) || 0)}
      />
      <Text>Agreeableness: {agreeableness}%</Text>
      <TextInput
        style={styles.input}
        placeholder="0-100"
        keyboardType="numeric"
        value={agreeableness.toString()}
        onChangeText={(v) => setAgreeableness(parseInt(v) || 0)}
      />
      <Text>Neuroticism: {neuroticism}%</Text>
      <TextInput
        style={styles.input}
        placeholder="0-100"
        keyboardType="numeric"
        value={neuroticism.toString()}
        onChangeText={(v) => setNeuroticism(parseInt(v) || 0)}
      />

      <Text style={styles.section}>MBTI</Text>
      <Button title="Take Official MBTI Test" onPress={handleMbtiLink} />
      <TextInput
        style={styles.input}
        placeholder="Enter your MBTI (e.g., ENFP)"
        value={mbti}
        onChangeText={setMbti}
      />

      <Text style={styles.section}>Personal Bio</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Write a genuine bio about yourself (up to 200 words)..."
        multiline
        value={bio}
        onChangeText={setBio}
      />

      <Text style={styles.section}>Optional ID (for verification)</Text>
      <TextInput
        style={styles.input}
        placeholder="ID Number (optional)"
        value={id}
        onChangeText={setId}
      />

      <Text style={styles.section}>Open-Ended Questions</Text>
      <TextInput
        style={[styles.input, { height: 100 }]}
        placeholder="Tell us about yourself..."
        multiline
        value={openEnded}
        onChangeText={setOpenEnded}
      />

      <Text style={styles.section}>Face Scan</Text>
      {!permission ? (
        <Text>Requesting camera permission...</Text>
      ) : !permission.granted ? (
        <Text>No access to camera</Text>
      ) : !faceScanned ? (
        <CameraView style={styles.camera} facing="front" ref={cameraRef}>
          <View style={styles.buttonContainer}>
            <Button title="Scan Face" onPress={takePicture} />
          </View>
        </CameraView>
      ) : (
        <Text>Face scanned successfully!</Text>
      )}

      <Button title="Sign Up" onPress={handleSignUp} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, marginBottom: 20, textAlign: "center" },
  input: { borderWidth: 1, padding: 10, marginBottom: 10 },
  section: {
    fontSize: 18,
    marginTop: 20,
    marginBottom: 10,
    fontWeight: "bold",
  },
  camera: { height: 300, marginBottom: 10 },
  buttonContainer: {
    flex: 1,
    backgroundColor: "transparent",
    flexDirection: "row",
    justifyContent: "center",
    margin: 20,
  },
});
