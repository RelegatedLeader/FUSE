// @ts-ignore
import nlp from "compromise";
// @ts-ignore
import { SentimentManager } from "@nlpjs/sentiment";
// @ts-ignore
import writeGood from "write-good";

// Bio Analysis and NLP Processing for FUSE
export class BioAnalyzer {
  private sentiment: SentimentManager;

  constructor() {
    this.sentiment = new SentimentManager();
  }

  // Analyze bio for personality traits and characteristics
  async analyzeBio(bio: string): Promise<BioAnalysis> {
    if (!bio || bio.trim().length === 0) {
      return this.getEmptyAnalysis();
    }

    const doc = nlp(bio.toLowerCase());

    // Extract various personality indicators
    const analysis = {
      // Life goals and aspirations
      lifeGoals: this.extractLifeGoals(doc),

      // Humor style and wit
      humorStyle: this.analyzeHumorStyle(doc),

      // Communication preferences
      communicationStyle: this.analyzeCommunicationStyle(doc),

      // Emotional maturity indicators
      emotionalMaturity: this.analyzeEmotionalMaturity(doc),

      // Relationship style (casual vs serious)
      relationshipStyle: this.analyzeRelationshipStyle(doc),

      // Overall sentiment
      sentiment: await this.analyzeSentiment(bio),

      // Grammar and writing quality
      writingQuality: this.analyzeWritingQuality(bio),

      // Content richness score
      contentScore: this.calculateContentScore(doc, bio),

      // Algorithm compatibility score (how well this bio will work for matching)
      algorithmCompatibility: 0,
    };

    // Calculate algorithm compatibility based on analysis
    analysis.algorithmCompatibility =
      this.calculateAlgorithmCompatibility(analysis);

    return analysis;
  }

  // Extract life goals and aspirations from bio
  private extractLifeGoals(doc: any): string[] {
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
      if (doc.has(indicator)) {
        goals.push(indicator);
      }
    });

    return [...new Set(goals)]; // Remove duplicates
  }

  // Analyze humor style
  private analyzeHumorStyle(doc: any): HumorAnalysis {
    const humorIndicators = {
      sarcastic: doc.has("sarcasm|sarcastic|irony|ironic"),
      witty: doc.has("wit|witty|clever|smart"),
      silly: doc.has("silly|funny|lol|laugh"),
      dry: doc.has("dry|deadpan|straight"),
      none: !doc.has("humor|funny|lol|joke|wit"),
    };

    const styles = Object.entries(humorIndicators)
      .filter(([_, has]) => has)
      .map(([style, _]) => style);

    return {
      styles: styles.length > 0 ? styles : ["moderate"],
      intensity: this.calculateHumorIntensity(doc),
    };
  }

  // Analyze communication style
  private analyzeCommunicationStyle(doc: any): CommunicationStyle {
    return {
      formality: this.getFormalityLevel(doc),
      directness: this.getDirectnessLevel(doc),
      verbosity: this.getVerbosityLevel(doc),
      emojiUsage: doc.has("#Emoji") ? "frequent" : "minimal",
      slangUsage: this.detectSlangUsage(doc),
    };
  }

  // Analyze emotional maturity
  private analyzeEmotionalMaturity(doc: any): EmotionalMaturity {
    const maturityIndicators = {
      empathy: doc.has("empathy|understanding|care|support|help"),
      selfAwareness: doc.has("growth|learn|change|reflect|aware"),
      resilience: doc.has("overcome|through|despite|challenge"),
      positivity: doc.has("positive|optimistic|hopeful|grateful"),
      negativity: doc.has("hate|angry|bitter|resentful|toxic"),
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
  private analyzeRelationshipStyle(doc: any): RelationshipStyle {
    const casualIndicators = doc.has(
      "casual|fun|hang out|chill|laid back|easy going"
    );
    const seriousIndicators = doc.has(
      "serious|committed|long-term|relationship|deep|meaningful"
    );

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

  // Analyze sentiment
  private async analyzeSentiment(text: string): Promise<SentimentAnalysis> {
    try {
      const result = await this.sentiment.process("en", text);
      return {
        score: result.sentiment.score || 0,
        magnitude: Math.abs(result.sentiment.score || 0),
        label: result.sentiment.vote || "neutral",
      };
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
  private calculateContentScore(doc: any, text: string): number {
    let score = 0;

    // Length score (0-20 points)
    const wordCount = doc.wordCount();
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
    const detailCount = detailIndicators.filter((word) => doc.has(word)).length;
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
      doc.has(word)
    ).length;
    score += Math.min(personalityCount * 5, 25);

    // Interest variety (0-25 points)
    const interests = doc.match("#Noun").out("array").length;
    score += Math.min(interests * 2, 25);

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
  private calculateHumorIntensity(doc: any): number {
    const humorWords = ["lol", "haha", "funny", "joke", "wit", "clever"];
    return humorWords.filter((word) => doc.has(word)).length;
  }

  private getFormalityLevel(doc: any): "formal" | "casual" | "mixed" {
    const formalWords = doc.has("therefore|however|moreover|consequently");
    const casualWords = doc.has("kinda|sorta|wanna|gonna|lol|omg");

    if (formalWords && !casualWords) return "formal";
    if (casualWords && !formalWords) return "casual";
    return "mixed";
  }

  private getDirectnessLevel(doc: any): "direct" | "indirect" | "balanced" {
    const directWords = doc.has("i want|i need|i love|i hate");
    const indirectWords = doc.has("maybe|perhaps|kinda|sorta");

    if (directWords && !indirectWords) return "direct";
    if (indirectWords && !directWords) return "indirect";
    return "balanced";
  }

  private getVerbosityLevel(doc: any): "concise" | "moderate" | "verbose" {
    const wordCount = doc.wordCount();
    if (wordCount < 20) return "concise";
    if (wordCount < 50) return "moderate";
    return "verbose";
  }

  private detectSlangUsage(doc: any): "minimal" | "moderate" | "heavy" {
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
    const slangCount = slangWords.filter((word) => doc.has(word)).length;

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
