import { fetch } from 'expo/fetch';
import { File } from 'expo-file-system';

export type TranslationResult = {
  transcript: string;
  english_meaning: string;
  translation: string;
  target_language: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function translateRecording(
  recordingUri: string,
  targetLanguage: 'Kannada' | 'Malayalam' | 'English'
): Promise<TranslationResult> {
  const baseUrl = process.env.EXPO_PUBLIC_API_URL
    ?.trim()
    .replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('Set EXPO_PUBLIC_API_URL in frontend/.env.local.');
  }

  const audio = new File(recordingUri);

  if (!audio.exists || audio.size === 0) {
    throw new Error('The recording is empty or unavailable. Record again.');
  }

  if (audio.size > 10 * 1024 * 1024) {
    throw new Error('The recording exceeds 10 MiB. Try a shorter recording.');
  }

const form = new FormData();
form.append('audio', audio);
form.append('target_language', targetLanguage);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);

  try {
    const response = await fetch(`${baseUrl}/translate`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });

    const data: unknown = await response.json();

    if (!response.ok) {
      const message =
        isObject(data) && typeof data.detail === 'string'
          ? data.detail
          : `Translation failed (HTTP ${response.status}).`;

      throw new Error(message);
    }

    if (
      !isObject(data) ||
      typeof data.transcript !== 'string' ||
      typeof data.english_meaning !== 'string' ||
      typeof data.translation !== 'string' ||
      data.target_language !== targetLanguage ||
      !data.transcript.trim() ||
      !data.english_meaning.trim() ||
      !data.translation.trim()
    ) {
      throw new Error('The server returned an invalid translation response.');
    }

    return {
      transcript: data.transcript,
      english_meaning: data.english_meaning,
      translation: data.translation,
      target_language: targetLanguage,
    };
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('Translation took too long. Please try again.');
    }

    throw err;
  } finally {
    clearTimeout(timeout);
  }
}