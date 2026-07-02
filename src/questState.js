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
    sideSwapped: Boolean(deck.sideSwapped),
  };
}

function normalizeFlashCards(cards = []) {
  const knownFronts = new Set();
  const normalized = [];
  cards.map(normalizeCard).forEach((card) => {
    const sideKey = frontKey(card.frontText || card.front, card.frontPhonetic);
    const hasFront = Boolean(card.frontText || card.frontPhonetic);
    const hasBack = Boolean(card.backText || card.backPhonetic || card.meaning);
    const key = `${card.deckId}:${sideKey}`;
    if (!hasFront || !hasBack || knownFronts.has(key)) return;
    knownFronts.add(key);
    normalized.push(card);
  });
  return normalized;
}

function normalizeCard(card = {}) {
  const legacy = parseLegacyCard(card);
  const frontText = String(card.frontText || legacy.frontText || '').trim();
  const frontPhonetic = stripOuterBrackets(card.frontPhonetic || legacy.frontPhonetic || '');
  const backFields = normalizeBackFields(
    card.backText || legacy.backText || '',
    card.backPhonetic || legacy.backPhonetic || '',
    card.meaning || legacy.meaning || '',
  );
  const backText = backFields.backText;
  const backPhonetic = backFields.backPhonetic;
  const meaning = backFields.meaning;
  const front = sideText(frontText, frontPhonetic);
  const back = backSideText(backText, backPhonetic, meaning);

  return {
    id: String(card.id || crypto.randomUUID()),
    deckId: String(card.deckId || 'default-flashcard-deck'),
    front,
    back,
    frontText,
    frontPhonetic,
    backText,
    backPhonetic,
    meaning,
    mastered: Boolean(card.mastered),
  };
}

function frontKey(front, phonetic = '') {
  const value = String(front || '').trim() || String(phonetic || '').trim();
  return value.replace(/\s+/g, ' ').toLowerCase();
}

function sideText(text, phonetic) {
  const parts = [];
  if (text) parts.push(text);
  if (phonetic) parts.push(`[${stripOuterBrackets(phonetic)}]`);
  return parts.join('\n');
}

function backSideText(text, phonetic, meaning) {
  return [sideText(text, phonetic), meaning]
    .filter((part) => String(part || '').trim())
    .join('\n');
}

function normalizeBackFields(rawBackText, rawBackPhonetic, rawMeaning) {
  const parsed = parseBackTextLines(rawBackText);
  const hasBackStructure = Boolean(parsed.phonetic || parsed.meaning);
  return {
    backText: hasBackStructure ? parsed.text : String(rawBackText || '').trim(),
    backPhonetic: stripOuterBrackets(rawBackPhonetic || (hasBackStructure ? parsed.phonetic : '')),
    meaning: String(rawMeaning || parsed.meaning || '').trim(),
  };
}

function parseBackTextLines(value) {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { text: '', phonetic: '', meaning: '' };
  const phoneticIndex = lines.findIndex(
    (line) => line.startsWith('[') && line.endsWith(']') && line.length > 1,
  );
  if (phoneticIndex >= 0) {
    return {
      text: lines.slice(0, phoneticIndex).join('\n'),
      phonetic: stripOuterBrackets(lines[phoneticIndex]),
      meaning: lines.slice(phoneticIndex + 1).join('\n'),
    };
  }
  return {
    text: lines[0],
    phonetic: '',
    meaning: lines.slice(1).join('\n'),
  };
}

function parseLegacyCard(card = {}) {
  const frontSide = parseSide(card.front || '');
  const backLines = String(card.back || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const backSide = parseSide(backLines.slice(0, 2).join('\n'));
  const hasStructuredBack = Boolean(card.backText || card.backPhonetic);
  return {
    frontText: frontSide.text || String(card.front || '').trim(),
    frontPhonetic: frontSide.phonetic,
    backText: hasStructuredBack ? card.backText || backSide.text || '' : '',
    backPhonetic: hasStructuredBack
      ? card.backPhonetic || backSide.phonetic || String(card.phonetic || '').trim()
      : '',
    meaning:
      card.meaning ||
      (backLines.length > 2 ? backLines.slice(2).join('\n') : '') ||
      (!hasStructuredBack ? backSide.text : ''),
  };
}

function parseSide(value) {
  const lines = String(value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { text: '', phonetic: '' };
  const last = lines.at(-1);
  const hasPhonetic = last.startsWith('[') && last.endsWith(']') && last.length > 1;
  return {
    text: hasPhonetic ? lines.slice(0, -1).join('\n') : lines.join('\n'),
    phonetic: hasPhonetic ? stripOuterBrackets(last) : '',
  };
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
