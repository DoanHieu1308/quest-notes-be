import { pinyin } from 'pinyin-pro';

const MAX_ITEMS = 80;
const TRANSLATE_API_URL = 'https://api.mymemory.translated.net/get';
const TRANSLATE_FALLBACK_URL = 'https://translate.googleapis.com/translate_a/single';
const DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en';

export async function enrichFlashcards(items = []) {
  const words = normalizeItems(items).slice(0, MAX_ITEMS);
  const cards = [];
  const errors = [];

  for (const word of words) {
    try {
      cards.push(await enrichWord(word));
    } catch (error) {
      errors.push({
        text: word,
        message: error instanceof Error ? error.message : 'Could not enrich word',
      });
    }
  }

  return { cards, errors };
}

async function enrichWord(word) {
  const [frontPhonetic, backText, meaning] = await Promise.all([
    getEnglishPhonetic(word),
    translate(word, 'zh-CN'),
    translate(word, 'vi'),
  ]);
  const backPhonetic = backText ? pinyin(backText, { toneType: 'symbol', type: 'array' }).join(' ') : '';

  return {
    frontText: word,
    frontPhonetic,
    backText,
    backPhonetic,
    meaning,
  };
}

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const normalized = [];

  items.forEach((item) => {
    const text = String(typeof item === 'string' ? item : item?.frontText || item?.text || '')
      .trim()
      .replace(/\s+/g, ' ');
    const key = text.toLowerCase();
    if (!text || seen.has(key)) return;
    seen.add(key);
    normalized.push(text);
  });

  return normalized;
}

async function getEnglishPhonetic(word) {
  const response = await fetch(`${DICTIONARY_API_URL}/${encodeURIComponent(word)}`);
  if (!response.ok) return '';
  const entries = await response.json();
  if (!Array.isArray(entries)) return '';

  for (const entry of entries) {
    const direct = cleanPhonetic(entry?.phonetic);
    if (direct) return direct;
    const phonetics = Array.isArray(entry?.phonetics) ? entry.phonetics : [];
    for (const item of phonetics) {
      const phonetic = cleanPhonetic(item?.text);
      if (phonetic) return phonetic;
    }
  }

  return '';
}

async function translate(text, targetLanguage) {
  const translated = await translateWithMyMemory(text, targetLanguage);
  if (translated && translated.toLowerCase() !== text.toLowerCase()) {
    return translated;
  }
  return translateWithGoogle(text, targetLanguage);
}

async function translateWithMyMemory(text, targetLanguage) {
  const url = new URL(TRANSLATE_API_URL);
  url.searchParams.set('q', text);
  url.searchParams.set('langpair', `en|${targetLanguage}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation failed for ${text}`);
  }
  const payload = await response.json();
  return String(payload?.responseData?.translatedText || '').trim();
}

async function translateWithGoogle(text, targetLanguage) {
  const url = new URL(TRANSLATE_FALLBACK_URL);
  url.searchParams.set('client', 'gtx');
  url.searchParams.set('sl', 'en');
  url.searchParams.set('tl', targetLanguage === 'zh-CN' ? 'zh-CN' : targetLanguage);
  url.searchParams.set('dt', 't');
  url.searchParams.set('q', text);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Translation failed for ${text}`);
  }
  const payload = await response.json();
  return Array.isArray(payload?.[0])
    ? payload[0].map((part) => part?.[0] || '').join('').trim()
    : '';
}

function cleanPhonetic(value) {
  return String(value || '')
    .trim()
    .replace(/^\/|\/$/g, '');
}
