import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useWallet } from "../contexts/WalletContext";
import { useTheme } from "../contexts/ThemeContext";
import { BioAnalyzer, BioAnalysis, BioSuggestion } from "../utils/bioAnalyzer";
import { FirebaseService } from "../utils/firebaseService";

import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";

type RootStackParamList = {
  Wallet: undefined;
  SignUp: undefined;
  SignIn: undefined;
  BioSetup: undefined;
  Main: undefined;
  Settings: undefined;
  Profile: undefined;
};

type BioSetupScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  "BioSetup"
>;

const BioSetupScreen: React.FC = () => {
  const { address } = useWallet();
  const { theme } = useTheme();
  const navigation = useNavigation<BioSetupScreenNavigationProp>();

  const [bio, setBio] = useState("");
  const [analysis, setAnalysis] = useState<BioAnalysis | null>(null);
  const [suggestions, setSuggestions] = useState<BioSuggestion[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const bioAnalyzer = new BioAnalyzer();

  // Analyze bio when it changes (debounced)
  useEffect(() => {
    if (bio.length < 10) {
      setAnalysis(null);
      setSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsAnalyzing(true);
      try {
        const bioAnalysis = await bioAnalyzer.analyzeBio(bio);
        const bioSuggestions = bioAnalyzer.generateBioSuggestions(bioAnalysis);

        setAnalysis(bioAnalysis);
        setSuggestions(bioSuggestions);
      } catch (error) {
        console.error("Bio analysis failed:", error);
        Alert.alert(
          "Analysis Error",
          "Failed to analyze your bio. Please try again."
        );
      } finally {
        setIsAnalyzing(false);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [bio]);

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case "excellent":
        return "#4CAF50";
      case "good":
        return "#FFC107";
      case "needs_improvement":
        return "#FF9800";
      case "poor":
        return "#F44336";
      default:
        return theme.textColor;
    }
  };

  const getCompatibilityColor = (score: number) => {
    if (score >= 80) return "#4CAF50";
    if (score >= 60) return "#FFC107";
    if (score >= 40) return "#FF9800";
    return "#F44336";
  };

  const handleSubmit = async () => {
    if (!analysis) {
      Alert.alert("Incomplete", "Please write a bio and wait for analysis.");
      return;
    }

    if (analysis.algorithmCompatibility < 50) {
      Alert.alert(
        "Bio Needs Improvement",
        "Your bio may not work well with our matching algorithm. Consider the suggestions below to improve compatibility.",
        [
          { text: "Continue Anyway", style: "destructive" },
          { text: "Improve Bio", style: "default" },
        ]
      );
      return;
    }

    try {
      // Submit the bio to Firebase
      await FirebaseService.updateUserBio(address!, bio);

      Alert.alert(
        "Success",
        "Your bio has been saved! You can now discover friends.",
        [
          {
            text: "Start Discovering",
            onPress: () => navigation.navigate("Main"),
          },
        ]
      );
    } catch (error) {
      console.error("Failed to save bio:", error);
      Alert.alert("Error", "Failed to save your bio. Please try again.");
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: theme.backgroundColor }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.textColor }]}>
          Tell Us About Yourself
        </Text>
        <Text style={[styles.subtitle, { color: theme.textColor + "CC" }]}>
          Write a bio that helps us find your perfect friends. Be honest, be
          yourself!
        </Text>
      </View>

      <View style={styles.bioSection}>
        <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
          Your Bio
        </Text>
        <TextInput
          style={[
            styles.bioInput,
            {
              color: theme.textColor,
              borderColor: theme.textColor + "40",
              backgroundColor: theme.card.backgroundColor,
            },
          ]}
          placeholder="Tell us about yourself, your interests, what you're looking for in friends..."
          placeholderTextColor={theme.textColor + "60"}
          multiline
          numberOfLines={8}
          value={bio}
          onChangeText={setBio}
          maxLength={500}
        />
        <Text style={[styles.charCount, { color: theme.textColor + "80" }]}>
          {bio.length}/500 characters
        </Text>
      </View>

      {/* Analysis Results */}
      {isAnalyzing && (
        <View style={styles.analyzingContainer}>
          <ActivityIndicator size="small" color={theme.textColor} />
          <Text style={[styles.analyzingText, { color: theme.textColor }]}>
            Analyzing your bio...
          </Text>
        </View>
      )}

      {analysis && !isAnalyzing && (
        <View style={styles.analysisSection}>
          <Text style={[styles.sectionTitle, { color: theme.textColor }]}>
            Bio Analysis
          </Text>

          {/* Quality Score */}
          <View
            style={[
              styles.scoreCard,
              { backgroundColor: theme.card.backgroundColor },
            ]}
          >
            <Text style={[styles.scoreLabel, { color: theme.textColor }]}>
              Writing Quality
            </Text>
            <Text
              style={[
                styles.scoreValue,
                { color: getQualityColor(analysis.writingQuality.quality) },
              ]}
            >
              {analysis.writingQuality.quality.replace("_", " ").toUpperCase()}
            </Text>
            {analysis.writingQuality.suggestions.length > 0 && (
              <Text
                style={[styles.scoreDetail, { color: theme.textColor + "CC" }]}
              >
                {analysis.writingQuality.suggestions[0]}
              </Text>
            )}
          </View>

          {/* Algorithm Compatibility */}
          <View
            style={[
              styles.scoreCard,
              { backgroundColor: theme.card.backgroundColor },
            ]}
          >
            <Text style={[styles.scoreLabel, { color: theme.textColor }]}>
              Friend Matching Potential
            </Text>
            <Text
              style={[
                styles.scoreValue,
                {
                  color: getCompatibilityColor(analysis.algorithmCompatibility),
                },
              ]}
            >
              {analysis.algorithmCompatibility}%
            </Text>
            <Text
              style={[styles.scoreDetail, { color: theme.textColor + "CC" }]}
            >
              {analysis.algorithmCompatibility >= 80
                ? "Excellent for matching!"
                : analysis.algorithmCompatibility >= 60
                ? "Good potential"
                : analysis.algorithmCompatibility >= 40
                ? "Could be better"
                : "Needs significant improvement"}
            </Text>
          </View>

          {/* Key Insights */}
          <View
            style={[
              styles.insightsCard,
              { backgroundColor: theme.card.backgroundColor },
            ]}
          >
            <Text style={[styles.insightsTitle, { color: theme.textColor }]}>
              What We Learned About You
            </Text>

            {analysis.lifeGoals.length > 0 && (
              <Text style={[styles.insightText, { color: theme.textColor }]}>
                🎯 Goals: {analysis.lifeGoals.join(", ")}
              </Text>
            )}

            <Text style={[styles.insightText, { color: theme.textColor }]}>
              💬 Communication: {analysis.communicationStyle.formality} &{" "}
              {analysis.communicationStyle.directness}
            </Text>

            <Text style={[styles.insightText, { color: theme.textColor }]}>
              💕 Relationship Style: {analysis.relationshipStyle.style} (
              {analysis.relationshipStyle.preference})
            </Text>

            <Text style={[styles.insightText, { color: theme.textColor }]}>
              😊 Humor: {analysis.humorStyle.styles.join(", ") || "subtle"}
            </Text>
          </View>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={styles.suggestionsSection}>
              <TouchableOpacity
                style={styles.suggestionsToggle}
                onPress={() => setShowSuggestions(!showSuggestions)}
              >
                <Text
                  style={[styles.suggestionsTitle, { color: theme.textColor }]}
                >
                  💡 AI Suggestions ({suggestions.length})
                </Text>
                <Text style={[styles.toggleIcon, { color: theme.textColor }]}>
                  {showSuggestions ? "▼" : "▶"}
                </Text>
              </TouchableOpacity>

              {showSuggestions && (
                <View style={styles.suggestionsList}>
                  {suggestions.map((suggestion, index) => (
                    <View
                      key={index}
                      style={[
                        styles.suggestionCard,
                        {
                          backgroundColor:
                            suggestion.priority === "high"
                              ? "rgba(244, 67, 54, 0.1)"
                              : suggestion.priority === "medium"
                              ? "rgba(255, 152, 0, 0.1)"
                              : "rgba(76, 175, 80, 0.1)",
                          borderLeftColor:
                            suggestion.priority === "high"
                              ? "#F44336"
                              : suggestion.priority === "medium"
                              ? "#FF9800"
                              : "#4CAF50",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.suggestionType,
                          {
                            color:
                              suggestion.priority === "high"
                                ? "#F44336"
                                : suggestion.priority === "medium"
                                ? "#FF9800"
                                : "#4CAF50",
                          },
                        ]}
                      >
                        {suggestion.type.toUpperCase()} •{" "}
                        {suggestion.priority.toUpperCase()}
                      </Text>
                      <Text
                        style={[
                          styles.suggestionText,
                          { color: theme.textColor },
                        ]}
                      >
                        {suggestion.message}
                      </Text>
                      {suggestion.examples.length > 0 && (
                        <View style={styles.examplesList}>
                          {suggestion.examples.map((example, idx) => (
                            <Text
                              key={idx}
                              style={[
                                styles.exampleText,
                                { color: theme.textColor + "CC" },
                              ]}
                            >
                              • {example}
                            </Text>
                          ))}
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* Submit Button */}
      <View style={styles.submitSection}>
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                analysis && analysis.algorithmCompatibility >= 50
                  ? theme.buttonBackground
                  : "#666",
              opacity:
                analysis && analysis.algorithmCompatibility >= 50 ? 1 : 0.6,
            },
          ]}
          onPress={handleSubmit}
          disabled={
            !analysis || (analysis && analysis.algorithmCompatibility < 50)
          }
        >
          <Text style={[styles.submitButtonText, { color: theme.buttonText }]}>
            Save Bio & Continue
          </Text>
        </TouchableOpacity>

        {analysis && analysis.algorithmCompatibility < 50 && (
          <Text style={[styles.warningText, { color: "#F44336" }]}>
            Your bio needs improvement to work well with our matching system.
            Check the suggestions above!
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    lineHeight: 24,
  },
  bioSection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 15,
  },
  bioInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    textAlignVertical: "top",
    minHeight: 120,
  },
  charCount: {
    fontSize: 12,
    textAlign: "right",
    marginTop: 5,
  },
  analyzingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  analyzingText: {
    marginLeft: 10,
    fontSize: 16,
  },
  analysisSection: {
    marginBottom: 30,
  },
  scoreCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  scoreLabel: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  scoreValue: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 5,
  },
  scoreDetail: {
    fontSize: 14,
    lineHeight: 20,
  },
  insightsCard: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  insightText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 8,
  },
  suggestionsSection: {
    marginTop: 20,
  },
  suggestionsToggle: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  suggestionsTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  toggleIcon: {
    fontSize: 16,
  },
  suggestionsList: {
    marginTop: 10,
  },
  suggestionCard: {
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  suggestionType: {
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  suggestionText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  examplesList: {
    marginLeft: 10,
  },
  exampleText: {
    fontSize: 13,
    fontStyle: "italic",
    marginBottom: 3,
  },
  submitSection: {
    marginTop: 20,
    marginBottom: 40,
  },
  submitButton: {
    borderRadius: 25,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: "bold",
  },
  warningText: {
    fontSize: 14,
    textAlign: "center",
    marginTop: 10,
    fontWeight: "500",
  },
});

export default BioSetupScreen;
