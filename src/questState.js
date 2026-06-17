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
      ? state.flashCards.map(normalizeCard)
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

function normalizeCard(card = {}) {
  return {
    id: String(card.id || crypto.randomUUID()),
    deckId: String(card.deckId || 'default-flashcard-deck'),
    front: String(card.front || ''),
    back: String(card.back || ''),
    mastered: Boolean(card.mastered),
  };
}
