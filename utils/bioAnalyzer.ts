// @ts-ignore
import writeGood from "write-good";

// Simplified Bio Analysis for FUSE (without external NLP libraries for React Native compatibility)
export class BioAnalyzer {
  constructor() {
    // No external dependencies needed
  }

  // Analyze bio for personality traits and characteristics
  async analyzeBio(bio: string): Promise<BioAnalysis> {
    if (!bio || bio.trim().length === 0) {
      return this.getEmptyAnalysis();
    }

    const text = bio.toLowerCase();

    // Extract various personality indicators
    const analysis = {
      // Life goals and aspirations
      lifeGoals: this.extractLifeGoals(text),

      // Humor style and wit
      humorStyle: this.analyzeHumorStyle(text),

      // Communication preferences
      communicationStyle: this.analyzeCommunicationStyle(text),

      // Emotional maturity indicators
      emotionalMaturity: this.analyzeEmotionalMaturity(text),

      // Relationship style (casual vs serious)
      relationshipStyle: this.analyzeRelationshipStyle(text),

      // Overall sentiment
      sentiment: await this.analyzeSentiment(bio),

      // Grammar and writing quality
      writingQuality: this.analyzeWritingQuality(bio),

      // Content richness score
      contentScore: this.calculateContentScore(text),

      // Algorithm compatibility score (how well this bio will work for matching)
      algorithmCompatibility: 0,
    };

    // Calculate algorithm compatibility based on analysis
    analysis.algorithmCompatibility =
      this.calculateAlgorithmCompatibility(analysis);

    return analysis;
  }

  // Extract life goals and aspirations from bio
  private extractLifeGoals(text: string): string[] {
    const goals: string[] = [];

    // Look for goal-oriented words and phrases
    const goalIndicators = [
      "want to",
      "hope to",
      "plan to",
      "dream of",
      "aspire to",
      "goal",
      "ambition",
      "future",
      "career",
      "travel",
      "learn",
      "grow",
      "achieve",
      "build",
      "create",
      "explore",
    ];

    goalIndicators.forEach((indicator) => {
      if (text.includes(indicator)) {
        goals.push(indicator);
      }
    });

    return Array.from(new Set(goals)); // Remove duplicates
  }

  // Analyze humor style
  private analyzeHumorStyle(text: string): HumorAnalysis {
    const humorIndicators = {
      sarcastic:
        text.includes("sarcasm") ||
        text.includes("sarcastic") ||
        text.includes("irony") ||
        text.includes("ironic"),
      witty:
        text.includes("wit") ||
        text.includes("witty") ||
        text.includes("clever") ||
        text.includes("smart"),
      silly:
        text.includes("silly") ||
        text.includes("funny") ||
        text.includes("lol") ||
        text.includes("laugh"),
      dry:
        text.includes("dry") ||
        text.includes("deadpan") ||
        text.includes("straight"),
      none:
        !text.includes("humor") &&
        !text.includes("funny") &&
        !text.includes("lol") &&
        !text.includes("joke") &&
        !text.includes("wit"),
    };

    const styles = Object.entries(humorIndicators)
      .filter(([_, has]) => has)
      .map(([style, _]) => style);

    return {
      styles: styles.length > 0 ? styles : ["moderate"],
      intensity: this.calculateHumorIntensity(text),
    };
  }

  // Analyze communication style
  private analyzeCommunicationStyle(text: string): CommunicationStyle {
    return {
      formality: this.getFormalityLevel(text),
      directness: this.getDirectnessLevel(text),
      verbosity: this.getVerbosityLevel(text),
      emojiUsage:
        text.includes("😊") || text.includes("😂") || text.includes("❤️")
          ? "frequent"
          : "minimal",
      slangUsage: this.detectSlangUsage(text),
    };
  }

  // Analyze emotional maturity
  private analyzeEmotionalMaturity(text: string): EmotionalMaturity {
    const maturityIndicators = {
      empathy:
        text.includes("empathy") ||
        text.includes("understanding") ||
        text.includes("care") ||
        text.includes("support") ||
        text.includes("help"),
      selfAwareness:
        text.includes("growth") ||
        text.includes("learn") ||
        text.includes("change") ||
        text.includes("reflect") ||
        text.includes("aware"),
      resilience:
        text.includes("overcome") ||
        text.includes("through") ||
        text.includes("despite") ||
        text.includes("challenge"),
      positivity:
        text.includes("positive") ||
        text.includes("optimistic") ||
        text.includes("hopeful") ||
        text.includes("grateful"),
      negativity:
        text.includes("hate") ||
        text.includes("angry") ||
        text.includes("bitter") ||
        text.includes("resentful") ||
        text.includes("toxic"),
    };

    const score = Object.values(maturityIndicators).filter(Boolean).length;
    const level = score >= 3 ? "high" : score >= 1 ? "moderate" : "developing";

    return {
      level,
      indicators: Object.entries(maturityIndicators)
        .filter(([_, has]) => has)
        .map(([key, _]) => key),
    };
  }

  // Analyze relationship style
  private analyzeRelationshipStyle(text: string): RelationshipStyle {
    const casualIndicators =
      text.includes("casual") ||
      text.includes("fun") ||
      text.includes("hang out") ||
      text.includes("chill") ||
      text.includes("laid back") ||
      text.includes("easy going");
    const seriousIndicators =
      text.includes("serious") ||
      text.includes("committed") ||
      text.includes("long-term") ||
      text.includes("relationship") ||
      text.includes("deep") ||
      text.includes("meaningful");

    if (casualIndicators && seriousIndicators) {
      return { style: "balanced", preference: "flexible" };
    } else if (seriousIndicators) {
      return { style: "serious", preference: "committed" };
    } else if (casualIndicators) {
      return { style: "casual", preference: "relaxed" };
    } else {
      return { style: "open", preference: "undecided" };
    }
  }

  // Analyze sentiment (simplified string-based approach)
  private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      const positiveWords = [
        "love",
        "like",
        "great",
        "awesome",
        "amazing",
        "wonderful",
        "fantastic",
        "excellent",
        "good",
        "happy",
        "joy",
        "excited",
        "thrilled",
      ];
      const negativeWords = [
        "hate",
        "dislike",
        "terrible",
        "awful",
        "horrible",
        "bad",
        "sad",
        "angry",
        "frustrated",
        "annoyed",
        "upset",
      ];

      const words = text.toLowerCase().split(/\s+/);
      let positiveCount = 0;
      let negativeCount = 0;

      words.forEach((word) => {
        if (positiveWords.some((pw) => word.includes(pw))) positiveCount++;
        if (negativeWords.some((nw) => word.includes(nw))) negativeCount++;
      });

      const total = positiveCount + negativeCount;
      const score = total > 0 ? (positiveCount - negativeCount) / total : 0;
      const magnitude = Math.abs(score);

      let label = "neutral";
      if (score > 0.2) label = "positive";
      else if (score < -0.2) label = "negative";

      return { score, magnitude, label };
    } catch (error) {
      return { score: 0, magnitude: 0, label: "neutral" };
    }
  }

  // Analyze writing quality and grammar
  private analyzeWritingQuality(text: string): WritingQuality {
    const suggestions = writeGood(text);
    const errors = suggestions.length;

    let quality: "excellent" | "good" | "needs_improvement" | "poor";

    if (errors === 0) quality = "excellent";
    else if (errors <= 2) quality = "good";
    else if (errors <= 5) quality = "needs_improvement";
    else quality = "poor";

    return {
      quality,
      suggestions: suggestions.slice(0, 3), // Top 3 suggestions
      errorCount: errors,
    };
  }

  // Calculate content richness score
  private calculateContentScore(text: string): number {
    let score = 0;

    // Length score (0-20 points)
    const wordCount = text
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    if (wordCount >= 50) score += 20;
    else if (wordCount >= 30) score += 15;
    else if (wordCount >= 20) score += 10;
    else if (wordCount >= 10) score += 5;

    // Detail score (0-30 points)
    const detailIndicators = [
      "love",
      "enjoy",
      "like",
      "hate",
      "dream",
      "goal",
      "future",
    ];
    const detailCount = detailIndicators.filter((word) =>
      text.includes(word)
    ).length;
    score += Math.min(detailCount * 5, 30);

    // Personality indicators (0-25 points)
    const personalityWords = [
      "adventurous",
      "creative",
      "outgoing",
      "shy",
      "ambitious",
      "kind",
      "funny",
    ];
    const personalityCount = personalityWords.filter((word) =>
      text.includes(word)
    ).length;
    score += Math.min(personalityCount * 5, 25);

    // Interest variety (0-25 points) - simplified noun counting
    const words = text.split(/\s+/);
    const potentialNouns = words.filter(
      (word) => word.length > 3 && !word.includes("ing") && !word.includes("ed")
    );
    score += Math.min(potentialNouns.length * 2, 25);

    return Math.min(score, 100);
  }

  // Calculate how well this bio will work for the algorithm
  private calculateAlgorithmCompatibility(
    analysis: Partial<BioAnalysis>
  ): number {
    let score = 0;

    // Content richness (40%)
    score += (analysis.contentScore || 0) * 0.4;

    // Writing quality (20%)
    const qualityScores = {
      excellent: 100,
      good: 80,
      needs_improvement: 60,
      poor: 30,
    };
    score +=
      (qualityScores[analysis.writingQuality?.quality || "poor"] || 0) * 0.2;

    // Emotional maturity (20%)
    const maturityScores = { high: 100, moderate: 70, developing: 40 };
    score +=
      (maturityScores[analysis.emotionalMaturity?.level || "developing"] || 0) *
      0.2;

    // Sentiment balance (10%)
    const sentimentScore =
      Math.abs(analysis.sentiment?.score || 0) < 0.3
        ? 100
        : Math.abs(analysis.sentiment?.score || 0) < 0.6
        ? 80
        : 60;
    score += sentimentScore * 0.1;

    // Life goals presence (10%)
    score += (analysis.lifeGoals?.length || 0) > 0 ? 100 : 50 * 0.1;

    return Math.round(score);
  }

  // Helper methods
  private calculateHumorIntensity(text: string): number {
    const humorWords = ["lol", "haha", "funny", "joke", "wit", "clever"];
    return humorWords.filter((word) => text.includes(word)).length;
  }

  private getFormalityLevel(text: string): "formal" | "casual" | "mixed" {
    const formalWords =
      text.includes("therefore") ||
      text.includes("however") ||
      text.includes("moreover") ||
      text.includes("consequently");
    const casualWords =
      text.includes("kinda") ||
      text.includes("sorta") ||
      text.includes("wanna") ||
      text.includes("gonna") ||
      text.includes("lol") ||
      text.includes("omg");

    if (formalWords && !casualWords) return "formal";
    if (casualWords && !formalWords) return "casual";
    return "mixed";
  }

  private getDirectnessLevel(text: string): "direct" | "indirect" | "balanced" {
    const directWords =
      text.includes("i want") ||
      text.includes("i need") ||
      text.includes("i love") ||
      text.includes("i hate");
    const indirectWords =
      text.includes("maybe") ||
      text.includes("perhaps") ||
      text.includes("kinda") ||
      text.includes("sorta");

    if (directWords && !indirectWords) return "direct";
    if (indirectWords && !directWords) return "indirect";
    return "balanced";
  }

  private getVerbosityLevel(text: string): "concise" | "moderate" | "verbose" {
    const wordCount = text
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
    if (wordCount < 20) return "concise";
    if (wordCount < 50) return "moderate";
    return "verbose";
  }

  private detectSlangUsage(text: string): "minimal" | "moderate" | "heavy" {
    const slangWords = [
      "lit",
      "fam",
      "bruh",
      "sus",
      "cap",
      "no cap",
      "bet",
      "vibe",
      "flex",
    ];
    const slangCount = slangWords.filter((word) => text.includes(word)).length;

    if (slangCount === 0) return "minimal";
    if (slangCount <= 2) return "moderate";
    return "heavy";
  }

  private getEmptyAnalysis(): BioAnalysis {
    return {
      lifeGoals: [],
      humorStyle: { styles: ["none"], intensity: 0 },
      communicationStyle: {
        formality: "mixed",
        directness: "balanced",
        verbosity: "concise",
        emojiUsage: "minimal",
        slangUsage: "minimal",
      },
      emotionalMaturity: { level: "developing", indicators: [] },
      relationshipStyle: { style: "open", preference: "undecided" },
      sentiment: { score: 0, magnitude: 0, label: "neutral" },
      writingQuality: { quality: "poor", suggestions: [], errorCount: 0 },
      contentScore: 0,
      algorithmCompatibility: 0,
    };
  }

  // Generate AI suggestions for improving the bio
  generateBioSuggestions(analysis: BioAnalysis): BioSuggestion[] {
    const suggestions: BioSuggestion[] = [];

    // Content suggestions
    if (analysis.contentScore < 50) {
      suggestions.push({
        type: "content",
        priority: "high",
        message:
          "Add more details about your interests, goals, and personality to help others understand you better.",
        examples: [
          '"I love hiking and photography, always seeking new adventures"',
          '"Aspiring software developer who enjoys gaming and deep conversations"',
        ],
      });
    }

    // Writing quality suggestions
    if (
      analysis.writingQuality.quality === "poor" ||
      analysis.writingQuality.quality === "needs_improvement"
    ) {
      suggestions.push({
        type: "grammar",
        priority: "medium",
        message:
          "Consider improving grammar and clarity for better first impressions.",
        examples: analysis.writingQuality.suggestions.map((s) => s.reason),
      });
    }

    // Personality depth suggestions
    if (analysis.lifeGoals.length === 0) {
      suggestions.push({
        type: "depth",
        priority: "high",
        message:
          "Share your goals and aspirations to attract like-minded people.",
        examples: [
          '"Working towards a career in environmental science"',
          '"Dreaming of traveling the world and learning new cultures"',
        ],
      });
    }

    // Emotional maturity suggestions
    if (analysis.emotionalMaturity.level === "developing") {
      suggestions.push({
        type: "maturity",
        priority: "medium",
        message:
          "Consider adding elements that show emotional awareness and growth.",
        examples: [
          '"Always learning from experiences and growing as a person"',
          '"Value deep connections and meaningful conversations"',
        ],
      });
    }

    return suggestions;
  }
}

// Type definitions
export interface BioAnalysis {
  lifeGoals: string[];
  humorStyle: HumorAnalysis;
  communicationStyle: CommunicationStyle;
  emotionalMaturity: EmotionalMaturity;
  relationshipStyle: RelationshipStyle;
  sentiment: SentimentAnalysis;
  writingQuality: WritingQuality;
  contentScore: number;
  algorithmCompatibility: number;
}

export interface HumorAnalysis {
  styles: string[];
  intensity: number;
}

export interface CommunicationStyle {
  formality: "formal" | "casual" | "mixed";
  directness: "direct" | "indirect" | "balanced";
  verbosity: "concise" | "moderate" | "verbose";
  emojiUsage: "minimal" | "frequent";
  slangUsage: "minimal" | "moderate" | "heavy";
}

export interface EmotionalMaturity {
  level: "high" | "moderate" | "developing";
  indicators: string[];
}

export interface RelationshipStyle {
  style: "casual" | "serious" | "balanced" | "open";
  preference: string;
}

export interface SentimentAnalysis {
  score: number;
  magnitude: number;
  label: string;
}

export interface WritingQuality {
  quality: "excellent" | "good" | "needs_improvement" | "poor";
  suggestions: any[];
  errorCount: number;
}

export interface BioSuggestion {
  type: "content" | "grammar" | "depth" | "maturity";
  priority: "high" | "medium" | "low";
  message: string;
  examples: string[];
}
