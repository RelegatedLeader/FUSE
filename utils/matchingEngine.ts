import { FirebaseService } from "./firebaseService";
import { EncryptionService } from "./encryption";

// Client-side ML matching engine for FUSE
export class MatchingEngine {
  private static readonly COMPATIBILITY_WEIGHTS = {
    mbti: 0.25,
    personalityTraits: 0.35,
    interests: 0.2,
    location: 0.1,
    age: 0.1,
  };

  private static readonly MBTI_COMPATIBILITY_MATRIX: {
    [key: string]: { [key: string]: number };
  } = {
    // Myers-Briggs Type Indicator compatibility matrix
    // Higher scores = better compatibility (0-100)
    INTJ: {
      ENFP: 95,
      ENTP: 90,
      INFJ: 85,
      INTP: 80,
      ENFJ: 75,
      ENTJ: 70,
      INFP: 65,
      ISFJ: 40,
      INTJ: 50,
      ISTJ: 45,
      ESTJ: 35,
      ESFJ: 30,
      ISTP: 25,
      ESTP: 20,
      ISFP: 15,
      ESFP: 10,
    },
    INTP: {
      ENTJ: 95,
      ENFJ: 90,
      INTJ: 85,
      INFJ: 80,
      ENTP: 75,
      ENFP: 70,
      INFP: 65,
      ISFJ: 60,
      INTP: 50,
      ISTJ: 40,
      ESTJ: 30,
      ESFJ: 25,
      ISTP: 20,
      ESTP: 15,
      ISFP: 10,
      ESFP: 5,
    },
    ENTJ: {
      INTP: 95,
      INFP: 90,
      ENTP: 85,
      ENFP: 80,
      INTJ: 75,
      INFJ: 70,
      ENFJ: 65,
      ISTJ: 50,
      ENTJ: 45,
      ESTJ: 40,
      ESFJ: 35,
      ISFJ: 30,
      ISTP: 25,
      ESTP: 20,
      ISFP: 15,
      ESFP: 10,
    },
    ENTP: {
      INFJ: 95,
      INTJ: 90,
      ENFJ: 85,
      INTP: 80,
      INFP: 75,
      ENTJ: 70,
      ENFP: 65,
      ISTJ: 45,
      ENTP: 40,
      ESTJ: 35,
      ESFJ: 30,
      ISFJ: 25,
      ISTP: 20,
      ESTP: 15,
      ISFP: 10,
      ESFP: 5,
    },
    INFJ: {
      ENFP: 95,
      ENTP: 90,
      INFP: 85,
      INTJ: 80,
      ENFJ: 75,
      INTP: 70,
      ENTJ: 65,
      ISFJ: 50,
      INFJ: 45,
      ESFJ: 40,
      ISTJ: 35,
      ESTJ: 30,
      ISFP: 25,
      ESFP: 20,
      ISTP: 15,
      ESTP: 10,
    },
    INFP: {
      ENFJ: 95,
      ENTJ: 90,
      INFJ: 85,
      ENFP: 80,
      INTJ: 75,
      INTP: 70,
      ENTP: 65,
      ESFJ: 45,
      INFP: 40,
      ISFJ: 35,
      ESTJ: 30,
      ISTJ: 25,
      ESFP: 20,
      ISFP: 15,
      ESTP: 10,
      ISTP: 5,
    },
    ENFJ: {
      INFP: 95,
      ISFP: 90,
      INTP: 85,
      ISTP: 80,
      INFJ: 75,
      ENFP: 70,
      ENTP: 65,
      ESFJ: 50,
      ENFJ: 45,
      ISFJ: 40,
      ESTJ: 35,
      ISTJ: 30,
      ESFP: 25,
      ESTP: 20,
      ENTJ: 15,
      INTJ: 10,
    },
    ENFP: {
      INFJ: 95,
      INTJ: 90,
      INFP: 85,
      INTP: 80,
      ENFJ: 75,
      ENTJ: 70,
      ENTP: 65,
      ISFJ: 45,
      ENFP: 40,
      ESFJ: 35,
      ISTJ: 30,
      ESTJ: 25,
      ISFP: 20,
      ESFP: 15,
      ISTP: 10,
      ESTP: 5,
    },
    ISTJ: {
      ESFJ: 85,
      ESTJ: 80,
      ISFJ: 75,
      ENFJ: 60,
      ENTJ: 55,
      INFJ: 50,
      INTP: 45,
      ENTP: 40,
      ISTJ: 35,
      INTJ: 30,
      ENFP: 25,
      INFP: 20,
      ESTP: 15,
      ISTP: 10,
      ESFP: 5,
      ISFP: 0,
    },
    ISFJ: {
      ESFJ: 85,
      ESTJ: 80,
      ISTJ: 75,
      ENFJ: 60,
      INFJ: 55,
      ENTJ: 50,
      INFP: 45,
      ENFP: 40,
      ISFJ: 35,
      INTJ: 30,
      INTP: 25,
      ENTP: 20,
      ESFP: 15,
      ISFP: 10,
      ESTP: 5,
      ISTP: 0,
    },
    ESTJ: {
      ISFJ: 85,
      ESFJ: 80,
      ISTJ: 75,
      ENTJ: 60,
      ENFJ: 55,
      INFJ: 50,
      INTJ: 45,
      INTP: 40,
      ESTJ: 35,
      ENTP: 30,
      ENFP: 25,
      INFP: 20,
      ISTP: 15,
      ESTP: 10,
      ISFP: 5,
      ESFP: 0,
    },
    ESFJ: {
      ISFJ: 85,
      ISTJ: 80,
      ESTJ: 75,
      ENFJ: 60,
      INFJ: 55,
      ENTJ: 50,
      INFP: 45,
      ENFP: 40,
      ESFJ: 35,
      INTJ: 30,
      INTP: 25,
      ENTP: 20,
      ISFP: 15,
      ESFP: 10,
      ISTP: 5,
      ESTP: 0,
    },
    ISTP: {
      ESFJ: 75,
      ENFJ: 70,
      ESTJ: 65,
      ISFJ: 60,
      ENTJ: 55,
      INFJ: 50,
      INTP: 45,
      ENTP: 40,
      ISTP: 35,
      INFP: 30,
      ENFP: 25,
      INTJ: 20,
      ESTP: 15,
      ESFP: 10,
      ISFP: 5,
      ISTJ: 0,
    },
    ISFP: {
      ENFJ: 75,
      ESFJ: 70,
      INFJ: 65,
      INFP: 60,
      ENFP: 55,
      ENTJ: 50,
      ENTP: 45,
      INTP: 40,
      ISFP: 35,
      INTJ: 30,
      ISTJ: 25,
      ISFJ: 20,
      ESFP: 15,
      ISTP: 10,
      ESTP: 5,
      ESTJ: 0,
    },
    ESTP: {
      ISFJ: 75,
      ESFJ: 70,
      ISTJ: 65,
      ESTJ: 60,
      ENFJ: 55,
      ENTJ: 50,
      INFJ: 45,
      INTP: 40,
      ESTP: 35,
      ENTP: 30,
      ENFP: 25,
      INFP: 20,
      ISTP: 15,
      ESFP: 10,
      ISFP: 5,
      INTJ: 0,
    },
    ESFP: {
      ISFJ: 75,
      ESFJ: 70,
      ISTJ: 65,
      ESTJ: 60,
      ENFJ: 55,
      INFJ: 50,
      INFP: 45,
      ENFP: 40,
      ESFP: 35,
      INTJ: 30,
      INTP: 25,
      ENTP: 20,
      ISFP: 15,
      ESTP: 10,
      ISTP: 5,
      ENTJ: 0,
    },
  };

  // Find matches for a user
  static async findMatchesForUser(
    userAddress: string,
    criteria?: MatchCriteria
  ): Promise<MatchResult[]> {
    try {
      const userProfile = await FirebaseService.getUserProfile(userAddress);
      if (!userProfile) {
        throw new Error("User profile not found");
      }

      const potentialMatches = await FirebaseService.findMatches(
        userAddress,
        criteria || {}
      );

      const matchesWithScores = potentialMatches.map((match) => ({
        ...match,
        detailedScore: this.calculateDetailedCompatibility(
          userProfile,
          match.profile
        ),
      }));

      // Sort by overall compatibility score
      return matchesWithScores.sort(
        (a, b) => b.detailedScore.overall - a.detailedScore.overall
      );
    } catch (error) {
      throw new Error("Failed to find matches: " + error);
    }
  }

  // Calculate detailed compatibility between two users
  static calculateDetailedCompatibility(
    userA: any,
    userB: any
  ): DetailedCompatibilityScore {
    const mbtiScore = this.calculateMBTICompatibility(userA.mbti, userB.mbti);
    const traitScore = this.calculateTraitCompatibility(
      userA.traits?.personalityTraits,
      userB.traits?.personalityTraits
    );
    const interestScore = this.calculateInterestCompatibility(
      userA.traits?.bio,
      userB.traits?.bio
    );
    const locationScore = this.calculateLocationCompatibility(
      userA.location,
      userB.location
    );
    const ageScore = this.calculateAgeCompatibility(
      userA.birthdate,
      userB.birthdate
    );

    const overallScore = Math.round(
      mbtiScore * this.COMPATIBILITY_WEIGHTS.mbti +
        traitScore * this.COMPATIBILITY_WEIGHTS.personalityTraits +
        interestScore * this.COMPATIBILITY_WEIGHTS.interests +
        locationScore * this.COMPATIBILITY_WEIGHTS.location +
        ageScore * this.COMPATIBILITY_WEIGHTS.age
    );

    return {
      overall: Math.min(100, Math.max(0, overallScore)),
      breakdown: {
        mbti: mbtiScore,
        personalityTraits: traitScore,
        interests: interestScore,
        location: locationScore,
        age: ageScore,
      },
      reasoning: this.generateCompatibilityReasoning({
        mbti: mbtiScore,
        personalityTraits: traitScore,
        interests: interestScore,
        location: locationScore,
        age: ageScore,
      }),
    };
  }

  // Calculate MBTI compatibility
  private static calculateMBTICompatibility(
    mbtiA?: string,
    mbtiB?: string
  ): number {
    if (!mbtiA || !mbtiB) return 50; // Neutral score if MBTI not available

    const matrix = this.MBTI_COMPATIBILITY_MATRIX[mbtiA];
    return matrix?.[mbtiB] ?? 30; // Default low compatibility
  }

  // Calculate personality trait compatibility
  private static calculateTraitCompatibility(
    traitsA?: any,
    traitsB?: any
  ): number {
    if (!traitsA || !traitsB) return 50;

    const dimensions = [
      "extroversion",
      "openness",
      "conscientiousness",
      "agreeableness",
      "neuroticism",
    ];
    let totalSimilarity = 0;
    let dimensionCount = 0;

    for (const dimension of dimensions) {
      if (
        traitsA[dimension] !== undefined &&
        traitsB[dimension] !== undefined
      ) {
        const diff = Math.abs(traitsA[dimension] - traitsB[dimension]);
        const similarity = Math.max(0, 100 - diff); // Closer values = higher similarity
        totalSimilarity += similarity;
        dimensionCount++;
      }
    }

    return dimensionCount > 0
      ? Math.round(totalSimilarity / dimensionCount)
      : 50;
  }

  // Calculate interest compatibility from bio text
  private static calculateInterestCompatibility(
    bioA?: string,
    bioB?: string
  ): number {
    if (!bioA || !bioB) return 50;

    // Simple text similarity - in production, use more sophisticated NLP
    const wordsA = bioA.toLowerCase().split(/\s+/);
    const wordsB = bioB.toLowerCase().split(/\s+/);

    const commonWords = wordsA.filter(
      (word) => word.length > 3 && wordsB.includes(word)
    );

    const maxWords = Math.max(wordsA.length, wordsB.length);
    const similarity = maxWords > 0 ? (commonWords.length / maxWords) * 100 : 0;

    return Math.min(100, Math.round(similarity * 2)); // Scale up similarity
  }

  // Calculate location compatibility
  private static calculateLocationCompatibility(
    locationA?: string,
    locationB?: string
  ): number {
    if (!locationA || !locationB) return 50;

    // Simple location matching - in production, use geocoding
    const locA = locationA.toLowerCase();
    const locB = locationB.toLowerCase();

    if (locA === locB) return 100;
    if (locA.includes(locB) || locB.includes(locA)) return 80;

    // Check for same city/state/country
    const partsA = locA.split(",").map((p) => p.trim());
    const partsB = locB.split(",").map((p) => p.trim());

    for (const partA of partsA) {
      for (const partB of partsB) {
        if (partA === partB && partA.length > 2) return 70;
      }
    }

    return 30; // Different locations
  }

  // Calculate age compatibility
  private static calculateAgeCompatibility(
    birthdateA?: string,
    birthdateB?: string
  ): number {
    if (!birthdateA || !birthdateB) return 50;

    try {
      const ageA =
        new Date().getFullYear() - new Date(birthdateA).getFullYear();
      const ageB =
        new Date().getFullYear() - new Date(birthdateB).getFullYear();

      const ageDiff = Math.abs(ageA - ageB);

      // Age compatibility curve: smaller differences are better
      if (ageDiff <= 2) return 100;
      if (ageDiff <= 5) return 90;
      if (ageDiff <= 10) return 75;
      if (ageDiff <= 15) return 60;
      if (ageDiff <= 20) return 40;
      return 20;
    } catch (error) {
      return 50;
    }
  }

  // Generate human-readable compatibility reasoning
  private static generateCompatibilityReasoning(scores: {
    [key: string]: number;
  }): string[] {
    const reasons: string[] = [];

    if (scores.mbti >= 80) {
      reasons.push(
        "Excellent MBTI compatibility - your personality types work very well together"
      );
    } else if (scores.mbti >= 60) {
      reasons.push(
        "Good MBTI compatibility - complementary personality traits"
      );
    }

    if (scores.personalityTraits >= 80) {
      reasons.push(
        "Highly compatible personality traits across all dimensions"
      );
    } else if (scores.personalityTraits >= 60) {
      reasons.push(
        "Compatible personality traits with some complementary differences"
      );
    }

    if (scores.interests >= 70) {
      reasons.push("Shared interests and values based on your profiles");
    }

    if (scores.location >= 80) {
      reasons.push("Same location - convenient for meeting");
    } else if (scores.location >= 60) {
      reasons.push("Close locations - manageable distance");
    }

    if (scores.age >= 80) {
      reasons.push("Similar ages - aligned life stages");
    }

    return reasons.length > 0 ? reasons : ["Basic compatibility found"];
  }

  // Create and store a match
  static async createMatch(userA: string, userB: string): Promise<MatchResult> {
    try {
      const profileA = await FirebaseService.getUserProfile(userA);
      const profileB = await FirebaseService.getUserProfile(userB);

      if (!profileA || !profileB) {
        throw new Error("User profiles not found");
      }

      const compatibility = this.calculateDetailedCompatibility(
        profileA,
        profileB
      );

      const matchData = {
        compatibilityScore: compatibility.overall,
        matchReasoning: compatibility.breakdown,
        participantA: userA,
        participantB: userB,
        matchTimestamp: Date.now(),
        status: "pending",
      };

      const matchId = `${userA}_${userB}_${Date.now()}`;
      await FirebaseService.storeMatchData(matchId, matchData);

      // Store interactions
      await FirebaseService.storeInteraction({
        interactionType: "create_match",
        targetUser: userB,
        metadata: {
          matchScore: compatibility.overall,
        },
      });

      console.log(
        "🎯 Match created between:",
        userA,
        "and",
        userB,
        "Score:",
        compatibility.overall
      );

      return {
        address: userB,
        profile: profileB,
        compatibilityScore: compatibility.overall,
        detailedScore: compatibility,
      };
    } catch (error) {
      throw new Error("Failed to create match: " + error);
    }
  }

  // Get match recommendations with ML learning
  static async getSmartRecommendations(
    userAddress: string,
    interactionHistory: any[]
  ): Promise<MatchResult[]> {
    try {
      const baseMatches = await this.findMatchesForUser(userAddress);

      // Apply learning from interaction history
      const learnedPreferences =
        this.analyzeInteractionHistory(interactionHistory);

      const enhancedMatches = baseMatches.map((match) => ({
        ...match,
        compatibilityScore: this.applyLearning(
          match.compatibilityScore,
          learnedPreferences,
          match.profile
        ),
      }));

      return enhancedMatches.sort(
        (a, b) => b.compatibilityScore - a.compatibilityScore
      );
    } catch (error) {
      throw new Error("Failed to get smart recommendations: " + error);
    }
  }

  // Analyze interaction history to learn user preferences
  private static analyzeInteractionHistory(
    interactions: any[]
  ): LearnedPreferences {
    const preferences: LearnedPreferences = {
      preferredAgeRange: { min: 18, max: 100 },
      preferredMBTI: [],
      preferredTraits: {},
      locationPreference: null,
      interactionPatterns: {},
    };

    // Analyze positive interactions (likes, matches, messages)
    const positiveInteractions = interactions.filter((i) =>
      ["like_profile", "create_match", "send_message"].includes(
        i.interactionType
      )
    );

    if (positiveInteractions.length > 0) {
      // Learn from positive interactions
      const ages: number[] = [];
      const mbtis: string[] = [];
      const locations: string[] = [];

      positiveInteractions.forEach((interaction) => {
        // This would analyze the target user's profile
        // For now, return default preferences
      });

      // Update preferences based on analysis
      if (ages.length > 0) {
        const avgAge = ages.reduce((a, b) => a + b) / ages.length;
        preferences.preferredAgeRange = {
          min: Math.max(18, avgAge - 5),
          max: Math.min(100, avgAge + 5),
        };
      }
    }

    return preferences;
  }

  // Apply learned preferences to compatibility scoring
  private static applyLearning(
    baseScore: number,
    preferences: LearnedPreferences,
    profile: any
  ): number {
    let adjustment = 0;

    // Age preference adjustment
    if (profile.birthdate) {
      const age =
        new Date().getFullYear() - new Date(profile.birthdate).getFullYear();
      if (
        age >= preferences.preferredAgeRange.min &&
        age <= preferences.preferredAgeRange.max
      ) {
        adjustment += 5;
      } else {
        adjustment -= 5;
      }
    }

    // Location preference
    if (preferences.locationPreference && profile.location) {
      if (
        profile.location
          .toLowerCase()
          .includes(preferences.locationPreference.toLowerCase())
      ) {
        adjustment += 3;
      }
    }

    return Math.min(100, Math.max(0, baseScore + adjustment));
  }

  // Batch process compatibility for multiple users
  static async batchCompatibilityAnalysis(
    userAddress: string,
    candidateAddresses: string[]
  ): Promise<BatchCompatibilityResult> {
    try {
      const userProfile = await FirebaseService.getUserProfile(userAddress);
      if (!userProfile) {
        throw new Error("User profile not found");
      }

      const results: { [address: string]: DetailedCompatibilityScore } = {};

      for (const candidateAddress of candidateAddresses) {
        try {
          const candidateProfile = await FirebaseService.getUserProfile(
            candidateAddress
          );
          if (candidateProfile) {
            results[candidateAddress] = this.calculateDetailedCompatibility(
              userProfile,
              candidateProfile
            );
          }
        } catch (error) {
          console.warn(
            "Failed to analyze compatibility for:",
            candidateAddress
          );
        }
      }

      return {
        userAddress,
        results,
        analysisTimestamp: Date.now(),
        totalCandidates: candidateAddresses.length,
        successfulAnalyses: Object.keys(results).length,
      };
    } catch (error) {
      throw new Error("Failed to batch analyze compatibility: " + error);
    }
  }
}

// Type definitions
export interface MatchCriteria {
  minAge?: number;
  maxAge?: number;
  location?: string;
  mbti?: string;
  requiredTraits?: string[];
}

export interface DetailedCompatibilityScore {
  overall: number;
  breakdown: {
    mbti: number;
    personalityTraits: number;
    interests: number;
    location: number;
    age: number;
  };
  reasoning: string[];
}

export interface MatchResult {
  address: string;
  profile: any;
  compatibilityScore: number;
  detailedScore: DetailedCompatibilityScore;
}

export interface LearnedPreferences {
  preferredAgeRange: { min: number; max: number };
  preferredMBTI: string[];
  preferredTraits: { [trait: string]: number };
  locationPreference: string | null;
  interactionPatterns: { [key: string]: any };
}

export interface BatchCompatibilityResult {
  userAddress: string;
  results: { [address: string]: DetailedCompatibilityScore };
  analysisTimestamp: number;
  totalCandidates: number;
  successfulAnalyses: number;
}
