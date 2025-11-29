import { FirebaseService } from "./firebaseService";
import { BioAnalyzer, BioAnalysis } from "./bioAnalyzer";
import { ConversationTracker, InteractionSummary } from "./conversationTracker";
import { MatchingEngine } from "./matchingEngine";

// Enhanced Matching Algorithm for FUSE
export class EnhancedMatchingEngine {
  private static bioAnalyzer = new BioAnalyzer();

  // Calculate compatibility between two users using all available data
  static async calculateCompatibility(
    user1Address: string,
    user2Address: string
  ): Promise<CompatibilityResult> {
    try {
      console.log(
        `🔍 Calculating compatibility between ${user1Address} and ${user2Address}`
      );

      // Get basic user data
      const [user1Data, user2Data] = await Promise.all([
        FirebaseService.getUserProfile(user1Address),
        FirebaseService.getUserProfile(user2Address),
      ]);

      if (!user1Data || !user2Data) {
        return this.getDefaultCompatibilityResult();
      }

      // Analyze bios
      const [user1BioAnalysis, user2BioAnalysis] = await Promise.all([
        this.bioAnalyzer.analyzeBio(user1Data.bio || ""),
        this.bioAnalyzer.analyzeBio(user2Data.bio || ""),
      ]);

      // Get interaction summaries
      const [user1Interactions, user2Interactions] = await Promise.all([
        ConversationTracker.generateInteractionSummary(user1Address),
        ConversationTracker.generateInteractionSummary(user2Address),
      ]);

      // Calculate individual compatibility scores
      const scores = {
        profileCompatibility: this.calculateProfileCompatibility(
          user1Data,
          user2Data
        ),
        bioCompatibility: this.calculateBioCompatibility(
          user1BioAnalysis,
          user2BioAnalysis
        ),
        interactionCompatibility: this.calculateInteractionCompatibility(
          user1Interactions,
          user2Interactions
        ),
        personalityCompatibility: this.calculatePersonalityCompatibility(
          user1Data,
          user2Data
        ),
        interestCompatibility: this.calculateInterestCompatibility(
          user1Data,
          user2Data
        ),
        valueAlignment: this.calculateValueAlignment(
          user1BioAnalysis,
          user2BioAnalysis
        ),
      };

      // Calculate weighted overall score
      const overallScore = this.calculateOverallScore(scores);

      // Generate detailed breakdown
      const breakdown = this.generateCompatibilityBreakdown(scores);

      // Generate match insights
      const insights = this.generateMatchInsights(
        user1BioAnalysis,
        user2BioAnalysis,
        user1Interactions,
        user2Interactions
      );

      return {
        overallScore,
        scores,
        breakdown,
        insights,
        confidence: this.calculateConfidence(scores),
        factors: this.getTopCompatibilityFactors(scores),
      };
    } catch (error) {
      console.error("Failed to calculate compatibility:", error);
      return this.getDefaultCompatibilityResult();
    }
  }

  // Default compatibility result when calculation fails
  private static getDefaultCompatibilityResult(): CompatibilityResult {
    return {
      overallScore: 50,
      scores: {
        profileCompatibility: 50,
        bioCompatibility: 50,
        interactionCompatibility: 50,
        personalityCompatibility: 50,
        interestCompatibility: 50,
        valueAlignment: 50,
      },
      breakdown: [
        {
          category: "Profile Basics",
          score: 50,
          description: "Unable to analyze profile information",
          factors: [],
        },
        {
          category: "Communication Style",
          score: 50,
          description: "Unable to analyze communication preferences",
          factors: [],
        },
        {
          category: "Interaction History",
          score: 50,
          description: "No interaction data available",
          factors: [],
        },
        {
          category: "Personality Match",
          score: 50,
          description: "Unable to analyze personality compatibility",
          factors: [],
        },
        {
          category: "Shared Interests",
          score: 50,
          description: "Unable to analyze interests",
          factors: [],
        },
        {
          category: "Values Alignment",
          score: 50,
          description: "Unable to analyze values",
          factors: [],
        },
      ],
      insights: [],
      confidence: 0.5,
      factors: ["Limited data available"],
    };
  }

  // Calculate profile compatibility (age, location, basic info)
  private static calculateProfileCompatibility(user1: any, user2: any): number {
    let score = 0;
    let factors = 0;

    // Age compatibility (if both have age)
    if (user1.birthdate && user2.birthdate) {
      const age1 =
        new Date().getFullYear() - new Date(user1.birthdate).getFullYear();
      const age2 =
        new Date().getFullYear() - new Date(user2.birthdate).getFullYear();
      const ageDiff = Math.abs(age1 - age2);

      if (ageDiff <= 2) score += 100;
      else if (ageDiff <= 5) score += 80;
      else if (ageDiff <= 10) score += 60;
      else if (ageDiff <= 15) score += 40;
      else score += 20;
      factors++;
    }

    // Location compatibility
    if (user1.location && user2.location) {
      if (user1.location === user2.location) {
        score += 100;
      } else {
        // Check if same city/state/country
        const loc1 = user1.location.toLowerCase();
        const loc2 = user2.location.toLowerCase();

        if (
          loc1.includes(loc2.split(",")[0]) ||
          loc2.includes(loc1.split(",")[0])
        ) {
          score += 80;
        } else {
          score += 40;
        }
      }
      factors++;
    }

    // Gender compatibility (for friendship, be flexible)
    if (user1.gender && user2.gender) {
      // For friendship, any gender combination can work
      score += 70; // Neutral positive score
      factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 50;
  }

  // Calculate bio compatibility using NLP analysis
  private static calculateBioCompatibility(
    analysis1: BioAnalysis,
    analysis2: BioAnalysis
  ): number {
    let score = 0;
    let factors = 0;

    // Relationship style compatibility
    if (analysis1.relationshipStyle && analysis2.relationshipStyle) {
      const style1 = analysis1.relationshipStyle.style;
      const style2 = analysis2.relationshipStyle.style;

      if (style1 === style2) score += 100;
      else if (
        (style1 === "casual" && style2 === "balanced") ||
        (style1 === "balanced" && style2 === "casual") ||
        (style1 === "serious" && style2 === "balanced") ||
        (style1 === "balanced" && style2 === "serious")
      ) {
        score += 80;
      } else {
        score += 40;
      }
      factors++;
    }

    // Communication style compatibility
    if (analysis1.communicationStyle && analysis2.communicationStyle) {
      const formalityMatch =
        analysis1.communicationStyle.formality ===
        analysis2.communicationStyle.formality;
      const directnessMatch =
        analysis1.communicationStyle.directness ===
        analysis2.communicationStyle.directness;

      if (formalityMatch && directnessMatch) score += 100;
      else if (formalityMatch || directnessMatch) score += 70;
      else score += 40;
      factors++;
    }

    // Emotional maturity compatibility
    if (analysis1.emotionalMaturity && analysis2.emotionalMaturity) {
      const level1 = analysis1.emotionalMaturity.level;
      const level2 = analysis2.emotionalMaturity.level;

      if (level1 === level2) score += 100;
      else if (
        Math.abs(
          this.maturityToNumber(level1) - this.maturityToNumber(level2)
        ) <= 1
      ) {
        score += 80;
      } else {
        score += 50;
      }
      factors++;
    }

    // Humor style compatibility
    if (analysis1.humorStyle && analysis2.humorStyle) {
      const hasSharedHumor = analysis1.humorStyle.styles.some((style) =>
        analysis2.humorStyle.styles.includes(style)
      );

      if (hasSharedHumor) score += 90;
      else score += 60;
      factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 50;
  }

  // Calculate interaction compatibility
  private static calculateInteractionCompatibility(
    interactions1: InteractionSummary,
    interactions2: InteractionSummary
  ): number {
    let score = 0;
    let factors = 0;

    // Communication style compatibility
    if (interactions1.communicationStyle && interactions2.communicationStyle) {
      const style1 = interactions1.communicationStyle.style;
      const style2 = interactions2.communicationStyle.style;

      if (style1 === style2) score += 100;
      else if (style1 === "balanced" || style2 === "balanced") score += 80;
      else score += 60;
      factors++;
    }

    // Response time compatibility
    const response1 = this.responseTimeToNumber(
      interactions1.responseTimeCategory
    );
    const response2 = this.responseTimeToNumber(
      interactions2.responseTimeCategory
    );

    if (Math.abs(response1 - response2) <= 1) score += 90;
    else if (Math.abs(response1 - response2) <= 2) score += 70;
    else score += 50;
    factors++;

    // Engagement level compatibility
    const engagementDiff = Math.abs(
      interactions1.engagementLevel - interactions2.engagementLevel
    );
    if (engagementDiff <= 10) score += 100;
    else if (engagementDiff <= 20) score += 80;
    else if (engagementDiff <= 30) score += 60;
    else score += 40;
    factors++;

    // Conversation depth compatibility
    const depthDiff = Math.abs(
      interactions1.conversationDepth - interactions2.conversationDepth
    );
    if (depthDiff <= 1) score += 100;
    else if (depthDiff <= 2) score += 80;
    else if (depthDiff <= 3) score += 60;
    else score += 40;
    factors++;

    // Social style compatibility
    if (
      interactions1.interactionPreferences &&
      interactions2.interactionPreferences
    ) {
      const social1 = interactions1.interactionPreferences.socialStyle;
      const social2 = interactions2.interactionPreferences.socialStyle;

      if (social1 === social2) score += 100;
      else score += 70; // Different social styles can still work
      factors++;
    }

    return factors > 0 ? Math.round(score / factors) : 50;
  }

  // Calculate personality compatibility
  private static calculatePersonalityCompatibility(
    user1: any,
    user2: any
  ): number {
    // Use personality traits if available (more accurate than MBTI)
    if (user1.personalityTraits && user2.personalityTraits) {
      return this.calculateTraitCompatibility(
        user1.personalityTraits,
        user2.personalityTraits
      );
    }

    // Fallback to MBTI if available
    if (user1.mbti && user2.mbti) {
      return this.calculateMBTICompatibility(user1.mbti, user2.mbti);
    }

    return 50; // Neutral score
  }

  // Calculate MBTI compatibility
  private static calculateMBTICompatibility(
    mbti1: string,
    mbti2: string
  ): number {
    // Simple MBTI compatibility matrix
    const compatibilityMatrix: { [key: string]: { [key: string]: number } } = {
      ENFP: {
        ENFP: 90,
        INFP: 95,
        ENFJ: 85,
        INFJ: 90,
        ENTP: 80,
        INTP: 75,
        ENTJ: 70,
        INTJ: 75,
      },
      INFP: {
        INFP: 90,
        ENFP: 95,
        INFJ: 95,
        ENFJ: 90,
        INTP: 80,
        ENTP: 75,
        INTJ: 70,
        ENTJ: 65,
      },
      ENFJ: {
        ENFJ: 90,
        INFJ: 95,
        ENFP: 85,
        INFP: 90,
        ENTJ: 80,
        INTJ: 75,
        ENTP: 70,
        INTP: 65,
      },
      INFJ: {
        INFJ: 90,
        ENFJ: 95,
        INFP: 95,
        ENFP: 90,
        INTJ: 80,
        ENTJ: 75,
        INTP: 70,
        ENTP: 65,
      },
      // Add more as needed, for now use 70 as default good compatibility
    };

    const score =
      compatibilityMatrix[mbti1]?.[mbti2] ||
      compatibilityMatrix[mbti2]?.[mbti1] ||
      70;
    return score;
  }

  // Calculate personality trait compatibility
  private static calculateTraitCompatibility(
    traits1: any,
    traits2: any
  ): number {
    console.log(`🧬 Comparing traits:`, traits1, traits2);

    let totalDiff = 0;
    let traitCount = 0;

    // Compare common traits
    const commonTraits = Object.keys(traits1).filter(
      (trait) => traits2[trait] !== undefined
    );

    console.log(`🧬 Common traits:`, commonTraits);

    commonTraits.forEach((trait) => {
      const diff = Math.abs(traits1[trait] - traits2[trait]);
      totalDiff += diff;
      traitCount++;
      console.log(
        `🧬 Trait ${trait}: ${traits1[trait]} vs ${traits2[trait]}, diff: ${diff}`
      );
    });

    if (traitCount === 0) {
      console.log("❌ No common traits found");
      return 50;
    }

    const avgDiff = totalDiff / traitCount;
    const score = Math.max(0, Math.min(100, 100 - avgDiff));
    console.log(`🧬 Average diff: ${avgDiff}, Final score: ${score}`);
    return score;
  }

  // Calculate interest compatibility
  private static calculateInterestCompatibility(
    user1: any,
    user2: any
  ): number {
    const interests1 = user1.interests || [];
    const interests2 = user2.interests || [];

    if (interests1.length === 0 || interests2.length === 0) {
      return 50; // Neutral score when interests unknown
    }

    const commonInterests = interests1.filter((interest: string) =>
      interests2.some(
        (interest2: string) =>
          interest.toLowerCase().includes(interest2.toLowerCase()) ||
          interest2.toLowerCase().includes(interest.toLowerCase())
      )
    );

    const compatibilityRatio =
      commonInterests.length / Math.max(interests1.length, interests2.length);
    return Math.round(compatibilityRatio * 100);
  }

  // Calculate value alignment from bio analysis
  private static calculateValueAlignment(
    analysis1: BioAnalysis,
    analysis2: BioAnalysis
  ): number {
    let score = 0;
    let factors = 0;

    // Life goals alignment
    if (analysis1.lifeGoals.length > 0 && analysis2.lifeGoals.length > 0) {
      const commonGoals = analysis1.lifeGoals.filter((goal) =>
        analysis2.lifeGoals.includes(goal)
      );
      score +=
        (commonGoals.length /
          Math.max(analysis1.lifeGoals.length, analysis2.lifeGoals.length)) *
        100;
      factors++;
    }

    // Sentiment alignment (similar emotional tone)
    const sentimentDiff = Math.abs(
      (analysis1.sentiment?.score || 0) - (analysis2.sentiment?.score || 0)
    );
    score += Math.max(0, 100 - sentimentDiff * 50);
    factors++;

    return factors > 0 ? Math.round(score / factors) : 50;
  }

  // Calculate overall weighted score
  private static calculateOverallScore(scores: CompatibilityScores): number {
    // Weights based on importance for friendship
    const weights = {
      profileCompatibility: 0.15, // Basic info (15%)
      bioCompatibility: 0.25, // Communication & personality (25%)
      interactionCompatibility: 0.2, // How they actually interact (20%)
      personalityCompatibility: 0.2, // MBTI/traits (20%)
      interestCompatibility: 0.15, // Shared interests (15%)
      valueAlignment: 0.05, // Life goals alignment (5%)
    };

    let totalScore = 0;
    let totalWeight = 0;

    Object.entries(weights).forEach(([key, weight]) => {
      const scoreKey = key as keyof CompatibilityScores;
      if (scores[scoreKey] !== undefined) {
        totalScore += scores[scoreKey] * weight;
        totalWeight += weight;
      }
    });

    return Math.max(50, Math.round(totalScore / totalWeight));
  }

  // Generate detailed compatibility breakdown
  private static generateCompatibilityBreakdown(
    scores: CompatibilityScores
  ): CompatibilityBreakdown[] {
    return [
      {
        category: "Profile Basics",
        score: scores.profileCompatibility,
        description: this.getProfileDescription(scores.profileCompatibility),
        factors: ["Age", "Location", "Basic Info"],
      },
      {
        category: "Communication Style",
        score: scores.bioCompatibility,
        description: this.getBioDescription(scores.bioCompatibility),
        factors: [
          "Writing Style",
          "Emotional Expression",
          "Communication Preferences",
        ],
      },
      {
        category: "Interaction Patterns",
        score: scores.interactionCompatibility,
        description: this.getInteractionDescription(
          scores.interactionCompatibility
        ),
        factors: ["Response Times", "Engagement Level", "Conversation Depth"],
      },
      {
        category: "Personality",
        score: scores.personalityCompatibility,
        description: this.getPersonalityDescription(
          scores.personalityCompatibility
        ),
        factors: ["MBTI Compatibility", "Trait Alignment", "Temperament"],
      },
      {
        category: "Shared Interests",
        score: scores.interestCompatibility,
        description: this.getInterestDescription(scores.interestCompatibility),
        factors: [
          "Common Hobbies",
          "Activity Preferences",
          "Leisure Interests",
        ],
      },
      {
        category: "Values & Goals",
        score: scores.valueAlignment,
        description: this.getValueDescription(scores.valueAlignment),
        factors: ["Life Goals", "Emotional Tone", "Aspiration Alignment"],
      },
    ];
  }

  // Generate match insights
  private static generateMatchInsights(
    bio1: BioAnalysis,
    bio2: BioAnalysis,
    interactions1: InteractionSummary,
    interactions2: InteractionSummary
  ): MatchInsight[] {
    const insights: MatchInsight[] = [];

    // Communication style insights
    if (bio1.communicationStyle && bio2.communicationStyle) {
      if (
        bio1.communicationStyle.formality === bio2.communicationStyle.formality
      ) {
        insights.push({
          type: "strength",
          title: "Communication Harmony",
          description:
            "You both prefer similar communication styles, making conversations flow naturally.",
        });
      }
    }

    // Interest insights
    if (
      interactions1.preferredTopics.length > 0 &&
      interactions2.preferredTopics.length > 0
    ) {
      const commonTopics = interactions1.preferredTopics.filter((topic) =>
        interactions2.preferredTopics.includes(topic)
      );

      if (commonTopics.length > 0) {
        insights.push({
          type: "strength",
          title: "Shared Interests",
          description: `You both enjoy discussing ${commonTopics
            .slice(0, 2)
            .join(" and ")}.`,
        });
      }
    }

    // Response time insights
    const response1 = this.responseTimeToNumber(
      interactions1.responseTimeCategory
    );
    const response2 = this.responseTimeToNumber(
      interactions2.responseTimeCategory
    );

    if (Math.abs(response1 - response2) <= 1) {
      insights.push({
        type: "strength",
        title: "Timing Compatibility",
        description:
          "Your response times align well, creating balanced conversations.",
      });
    }

    // Emotional maturity insights
    if (bio1.emotionalMaturity && bio2.emotionalMaturity) {
      if (bio1.emotionalMaturity.level === bio2.emotionalMaturity.level) {
        insights.push({
          type: "strength",
          title: "Emotional Alignment",
          description:
            "Similar emotional maturity levels suggest comfortable, understanding conversations.",
        });
      }
    }

    return insights.slice(0, 3); // Top 3 insights
  }

  // Calculate confidence in the compatibility score
  private static calculateConfidence(scores: CompatibilityScores): number {
    let confidence = 0;
    let factors = 0;

    // More data = higher confidence
    Object.values(scores).forEach((score) => {
      if (score > 0) {
        confidence += 80; // Each data point adds confidence
        factors++;
      }
    });

    // Interaction data is most reliable
    if (scores.interactionCompatibility > 0) confidence += 20;

    return Math.min(100, Math.round(confidence / Math.max(factors, 1)));
  }

  // Get top compatibility factors
  private static getTopCompatibilityFactors(
    scores: CompatibilityScores
  ): string[] {
    const factorMap = {
      profileCompatibility: "Basic Compatibility",
      bioCompatibility: "Communication Style",
      interactionCompatibility: "Interaction Patterns",
      personalityCompatibility: "Personality Match",
      interestCompatibility: "Shared Interests",
      valueAlignment: "Values & Goals",
    };

    return Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([key]) => factorMap[key as keyof typeof factorMap]);
  }

  // Helper methods for descriptions
  private static getProfileDescription(score: number): string {
    if (score >= 80) return "Excellent basic compatibility";
    if (score >= 60) return "Good foundational match";
    if (score >= 40) return "Moderate basic compatibility";
    return "Basic info suggests different lifestyles";
  }

  private static getBioDescription(score: number): string {
    if (score >= 80) return "Communication styles align beautifully";
    if (score >= 60) return "Compatible communication approaches";
    if (score >= 40) return "Some communication style differences";
    return "Different communication preferences";
  }

  private static getInteractionDescription(score: number): string {
    if (score >= 80) return "Interaction patterns complement each other";
    if (score >= 60) return "Compatible interaction styles";
    if (score >= 40) return "Some interaction style differences";
    return "Different interaction preferences";
  }

  private static getPersonalityDescription(score: number): string {
    if (score >= 80) return "Strong personality compatibility";
    if (score >= 60) return "Compatible personality traits";
    if (score >= 40) return "Some personality differences";
    return "Different personality approaches";
  }

  private static getInterestDescription(score: number): string {
    if (score >= 80) return "Many shared interests and hobbies";
    if (score >= 60) return "Several common interests";
    if (score >= 40) return "Some overlapping interests";
    return "Different interest areas";
  }

  private static getValueDescription(score: number): string {
    if (score >= 80) return "Strong alignment in values and goals";
    if (score >= 60) return "Compatible life approaches";
    if (score >= 40) return "Some value alignment";
    return "Different value systems";
  }

  // Helper conversion methods
  private static maturityToNumber(level: string): number {
    const levels = { high: 3, moderate: 2, developing: 1 };
    return levels[level as keyof typeof levels] || 2;
  }

  private static responseTimeToNumber(category: string): number {
    const categories = {
      very_fast: 1,
      fast: 2,
      moderate: 3,
      slow: 4,
      very_slow: 5,
    };
    return categories[category as keyof typeof categories] || 3;
  }
}

// Type definitions
export interface CompatibilityResult {
  overallScore: number;
  scores: CompatibilityScores;
  breakdown: CompatibilityBreakdown[];
  insights: MatchInsight[];
  confidence: number;
  factors: string[];
}

export interface CompatibilityScores {
  profileCompatibility: number;
  bioCompatibility: number;
  interactionCompatibility: number;
  personalityCompatibility: number;
  interestCompatibility: number;
  valueAlignment: number;
}

export interface CompatibilityBreakdown {
  category: string;
  score: number;
  description: string;
  factors: string[];
}

export interface MatchInsight {
  type: "strength" | "consideration" | "opportunity";
  title: string;
  description: string;
}
