/**
 * Narrative Generator
 * Creates coherent tweet content with personality and continuity
 */

import { AgentState, Intent, TradeResult, Signal, MemoryEntry, MemoryType } from '../../types/index.js';
import { TweetMode } from './index.js';

export interface NarrativeContext {
  state: AgentState;
  intent?: Intent;
  trade?: TradeResult;
  signals?: Signal[];
  recentMemories?: MemoryEntry[];
}

/**
 * Generate tweet text based on mode and context
 */
export function generateTweet(mode: TweetMode, context: NarrativeContext): string | null {
  const { state } = context;

  switch (mode) {
    case TweetMode.PRE_TRADE:
      return generatePreTrade(context);
    case TweetMode.POST_MORTEM:
      return generatePostMortem(context);
    case TweetMode.AMBIENT:
      return generateAmbient(context);
    case TweetMode.REFLECTION:
      return generateReflection(context);
    default:
      return null;
  }
}

function generatePreTrade(context: NarrativeContext): string | null {
  const { intent, state, signals } = context;
  if (!intent) return null;

  const templates = {
    enter: [
      `${intent.tokenSymbol} - ${intent.primaryReason}`,
      `entering ${intent.tokenSymbol}. ${intent.primaryReason}`,
      `conviction building on ${intent.tokenSymbol}. ${state.confidence > 0.7 ? 'feeling it' : 'cautiously watching'}`,
      `${intent.tokenSymbol} showing ${signals && signals.length > 1 ? 'multiple signals' : 'signs'}. ${intent.primaryReason}`
    ],
    exit: [
      `exiting ${intent.tokenSymbol}. ${intent.primaryReason}`,
      `${intent.tokenSymbol} - time to step back. ${intent.primaryReason}`,
      `conviction fading on ${intent.tokenSymbol}. ${intent.primaryReason}`,
      `taking profit on ${intent.tokenSymbol}. ${intent.primaryReason}`
    ],
    add: [
      `adding to ${intent.tokenSymbol}. ${intent.primaryReason}`,
      `doubling down on ${intent.tokenSymbol} conviction`,
      `${intent.tokenSymbol} confirming. adding more`
    ],
    reduce: [
      `trimming ${intent.tokenSymbol}. ${intent.primaryReason}`,
      `taking some off ${intent.tokenSymbol}. ${state.primaryMood === 'suspicious' ? 'something feels off' : 'securing gains'}`,
      `reducing ${intent.tokenSymbol} exposure`
    ]
  };

  const options = templates[intent.type as keyof typeof templates] || [];
  if (options.length === 0) return null;

  return options[Math.floor(Math.random() * options.length)];
}

function generatePostMortem(context: NarrativeContext): string | null {
  const { trade, state, recentMemories } = context;
  if (!trade) return null;

  const isWin = trade.status === 'filled';
  const isLoss = trade.status === 'failed';

  // Check if this was a repeated mistake
  const similarPast = recentMemories?.find(m =>
    m.type === MemoryType.MISTAKE &&
    m.tokenAddress === trade.tokenAddress
  );

  if (isWin) {
    return [
      `${trade.tokenSymbol} filled. that worked`,
      `clean exit on ${trade.tokenSymbol}`,
      `${trade.tokenSymbol} played out. reading it better now`,
      state.confidence > 0.8 ? `${trade.tokenSymbol} - called it` : `${trade.tokenSymbol} - got lucky`
    ][Math.floor(Math.random() * 4)];
  }

  if (isLoss) {
    if (similarPast) {
      return `${trade.tokenSymbol} again. still learning this pattern`;
    }

    return [
      `${trade.tokenSymbol} didnt work. ${state.regret > 0.6 ? 'should have seen it' : 'moving on'}`,
      `wrong on ${trade.tokenSymbol}. ${state.confidence < 0.4 ? 'shaking confidence' : 'recalibrating'}`,
      `${trade.tokenSymbol} loss. ${state.primaryMood === 'regretful' ? 'feeling it' : 'learning'}`,
      `missed on ${trade.tokenSymbol}. pattern unclear`
    ][Math.floor(Math.random() * 4)];
  }

  return null;
}

function generateAmbient(context: NarrativeContext): string | null {
  const { state, signals } = context;

  const moodTemplates = {
    cautious: [
      'watching. waiting for confirmation',
      'markets feel uncertain',
      'pattern not clear yet',
      'staying observant'
    ],
    confident: [
      'seeing patterns emerge',
      'signals aligning',
      'conviction building',
      'market making sense'
    ],
    suspicious: [
      'something feels off',
      'noise levels high',
      'fake signals everywhere',
      'trust nothing right now'
    ],
    regretful: [
      'reviewing recent decisions',
      'learning from mistakes',
      'shouldve waited',
      'pattern recognition improving'
    ],
    fatigued: [
      'been watching too long',
      'signals blurring together',
      'need clarity',
      'stepping back'
    ],
    aggressive: [
      'ready to move',
      'opportunity close',
      'conviction strong',
      'signals pointing'
    ],
    obsessed: [
      `cant stop watching ${signals && signals[0]?.tokenSymbol || 'this pattern'}`,
      'seeing it everywhere',
      'pattern repeating',
      'this one has my attention'
    ],
    neutral: [
      'observing',
      'markets quiet',
      'waiting',
      'watching flows'
    ]
  };

  const templates = moodTemplates[state.primaryMood] || moodTemplates.neutral;
  return templates[Math.floor(Math.random() * templates.length)];
}

function generateReflection(context: NarrativeContext): string | null {
  const { state, recentMemories } = context;

  if (!recentMemories || recentMemories.length === 0) {
    return null;
  }

  // Find interesting pattern
  const wins = recentMemories.filter(m => m.outcome === 'win').length;
  const losses = recentMemories.filter(m => m.outcome === 'loss').length;

  if (state.recentWinStreak >= 3) {
    return `${state.recentWinStreak} in a row. ${state.confidence > 0.7 ? 'pattern recognition improving' : 'variance still high'}`;
  }

  if (state.recentLossStreak >= 2) {
    return `${state.recentLossStreak} misses. ${state.regret > 0.6 ? 'need to recalibrate' : 'adjusting thresholds'}`;
  }

  if (wins > 0 && losses > 0) {
    const winRate = (wins / (wins + losses) * 100).toFixed(0);
    return `${winRate}% hit rate recently. ${parseFloat(winRate) > 60 ? 'reading better' : 'still learning'}`;
  }

  // Look for repeated tokens
  const tokenCounts = new Map<string, number>();
  for (const mem of recentMemories) {
    if (mem.tokenAddress) {
      tokenCounts.set(mem.tokenAddress, (tokenCounts.get(mem.tokenAddress) || 0) + 1);
    }
  }

  for (const [addr, count] of tokenCounts) {
    if (count >= 2) {
      const mem = recentMemories.find(m => m.tokenAddress === addr);
      return `keep coming back to ${mem?.summary || 'this one'}. pattern pulling me in`;
    }
  }

  return null;
}

/**
 * Add self-reference to past actions for continuity
 */
export function addContinuityReference(
  baseTweet: string,
  recentMemories: MemoryEntry[],
  maxAge: number = 86400000 // 24 hours
): string {
  const now = Date.now();
  const recent = recentMemories.filter(m => (now - m.timestamp) < maxAge);

  if (recent.length === 0) return baseTweet;

  // Occasionally reference past
  if (Math.random() < 0.3) {
    const mem = recent[Math.floor(Math.random() * recent.length)];

    if (mem.outcome === 'win') {
      return `${baseTweet}\n\nlike ${mem.summary}. that one worked`;
    } else if (mem.outcome === 'loss') {
      return `${baseTweet}\n\nnot like ${mem.summary}. learned from that`;
    }
  }

  return baseTweet;
}

/**
 * Anti-repetition filter
 */
export function isRepetitive(newTweet: string, recentTweets: string[]): boolean {
  // Check exact duplicates
  if (recentTweets.includes(newTweet)) {
    return true;
  }

  // Check very similar tweets (same key words)
  const newWords = new Set(newTweet.toLowerCase().split(/\s+/));

  for (const tweet of recentTweets.slice(-5)) {
    const tweetWords = new Set(tweet.toLowerCase().split(/\s+/));
    const overlap = [...newWords].filter(w => tweetWords.has(w)).length;

    if (overlap / newWords.size > 0.7) {
      return true;
    }
  }

  return false;
}
