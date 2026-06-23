import { config } from './config.js';
import { getQuestStatesCollection } from './db.js';

export function emptyState() {
  return {
    coins: 0,
    tasks: [],
    shopItems: [],
    flashDecks: [
      {
        id: 'default-flashcard-deck',
        name: 'Tu vung chung',
        createdAt: 0,
        rewardClaimed: false,
      },
    ],
    flashCards: [],
  };
}

export function normalizeState(state = {}) {
  return {
    coins: Number.isFinite(Number(state.coins)) ? Number(state.coins) : 0,
    tasks: Array.isArray(state.tasks) ? state.tasks.map(normalizeTask) : [],
    shopItems: Array.isArray(state.shopItems)
      ? state.shopItems.map(normalizeShopItem)
      : [],
    flashDecks:
      Array.isArray(state.flashDecks) && state.flashDecks.length > 0
        ? state.flashDecks.map(normalizeDeck)
        : emptyState().flashDecks,
    flashCards: Array.isArray(state.flashCards)
      ? normalizeFlashCards(state.flashCards)
      : [],
  };
}

export async function readState() {
  const collection = await getQuestStatesCollection();
  const document = await collection.findOne({ userId: config.userId });
  if (!document) return emptyState();
  return normalizeState(document.state);
}

export async function writeState(state) {
  const normalized = normalizeState(state);
  const now = new Date();
  const collection = await getQuestStatesCollection();
  await collection.updateOne(
    { userId: config.userId },
    {
      $set: {
        userId: config.userId,
        state: normalized,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true },
  );
  return normalized;
}

function normalizeTask(task = {}) {
  return {
    id: String(task.id || crypto.randomUUID()),
    title: String(task.title || ''),
    dateKey: String(task.dateKey || ''),
    reward: Math.max(1, Number.parseInt(task.reward, 10) || 1),
    done: Boolean(task.done),
  };
}

function normalizeShopItem(item = {}) {
  return {
    id: String(item.id || crypto.randomUUID()),
    name: String(item.name || ''),
    price: Math.max(1, Number.parseInt(item.price, 10) || 1),
    note: String(item.note || ''),
    bought: Boolean(item.bought),
  };
}

function normalizeDeck(deck = {}) {
  return {
    id: String(deck.id || crypto.randomUUID()),
    name: String(deck.name || ''),
    createdAt: Number.parseInt(deck.createdAt, 10) || 0,
    rewardClaimed: Boolean(deck.rewardClaimed),
  };
}

function normalizeFlashCards(cards = []) {
  const knownFronts = new Set();
  const normalized = [];
  cards.map(normalizeCard).forEach((card) => {
    const key = `${card.deckId}:${frontKey(card.front)}`;
    if (!frontKey(card.front) || knownFronts.has(key)) return;
    knownFronts.add(key);
    normalized.push(card);
  });
  return normalized;
}

function normalizeCard(card = {}) {
  const front = String(card.front || '');
  const backParts = parseFlashcardBack(card.back);
  const meaning = String(card.meaning || backParts.meaning || '');
  const phonetic = stripOuterBrackets(
    String(card.phonetic || backParts.phonetic || ''),
  );
  const hasStructuredBack = Boolean(card.meaning || card.phonetic);
  const back = buildFlashcardBack(
    hasStructuredBack ? '' : card.back,
    meaning,
    phonetic,
  );

  return {
    id: String(card.id || crypto.randomUUID()),
    deckId: String(card.deckId || 'default-flashcard-deck'),
    front,
    back,
    meaning,
    phonetic,
    mastered: Boolean(card.mastered),
  };
}

function frontKey(front) {
  return String(front || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildFlashcardBack(back, meaning, phonetic) {
  const existingBack = String(back || '').trim();
  if (existingBack) return existingBack;

  const parts = [];
  if (meaning) parts.push(meaning);
  if (phonetic) parts.push(`[${phonetic}]`);
  return parts.join('\n');
}

function parseFlashcardBack(back) {
  const lines = String(back || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { meaning: '', phonetic: '' };

  const maybePhonetic = lines.at(-1);
  const hasPhonetic =
    maybePhonetic.startsWith('[') &&
    maybePhonetic.endsWith(']') &&
    maybePhonetic.length > 1;

  return {
    meaning: hasPhonetic ? lines.slice(0, -1).join('\n') : lines.join('\n'),
    phonetic: hasPhonetic ? stripOuterBrackets(maybePhonetic) : '',
  };
}

function stripOuterBrackets(value) {
  const trimmed = String(value || '').trim();
  return trimmed.startsWith('[') && trimmed.endsWith(']') && trimmed.length > 1
    ? trimmed.slice(1, -1).trim()
    : trimmed;
}
