import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';

export async function generateSpeechFile(
  text: string,
  signal: AbortSignal
): Promise<File> {
  const message = text.trim();

  if (!message || message.length > 5000) {
    throw new Error('Speech requires between 1 and 5,000 characters.');
  }

  const baseUrl = process.env.EXPO_PUBLIC_API_URL
    ?.trim()
    .replace(/\/+$/, '');

  if (!baseUrl) {
    throw new Error('The backend URL is not configured.');
  }

  const response = await fetch(`${baseUrl}/speak`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
    signal,
  });

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => null);

    const detail =
      typeof data === 'object' &&
      data !== null &&
      'detail' in data &&
      typeof data.detail === 'string'
        ? data.detail
        : `Speech generation failed (HTTP ${response.status}).`;

    throw new Error(detail);
  }

  const bytes = await response.bytes();

  if (
    bytes.length < 12 ||
    String.fromCharCode(...bytes.subarray(0, 4)) !== 'RIFF' ||
    String.fromCharCode(...bytes.subarray(8, 12)) !== 'WAVE'
  ) {
    throw new Error('The backend returned invalid WAV audio.');
  }

  const file = new File(
    Paths.cache,
    `translated-speech-${Date.now()}.wav`
  );

  try {
    await file.write(bytes);
    return file;
  } catch (err) {
    try {
      if (file.exists) file.delete();
    } catch {
      // Preserve the original write error.
    }
    throw err;
  }
}