import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import type { File } from 'expo-file-system';

import { generateSpeechFile } from '@/lib/speech';

type Props = {
  text: string;
  disabled?: boolean;
};

function removeCachedFile(file: File | null) {
  try {
    if (file?.exists) file.delete();
  } catch {
    // Temporary audio can also be cleared by the system.
  }
}

export function SpeechControls({ text, disabled = false }: Props) {
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const session = useRef({
    mounted: true,
    busy: false,
    controller: null as AbortController | null,
    file: null as File | null,
  });

  useEffect(() => {
    const current = session.current;
    current.mounted = true;

    return () => {
      current.mounted = false;
      current.controller?.abort();
      removeCachedFile(current.file);
    };
  }, []);

  useEffect(() => {
    if (disabled) {
      player.pause();
      session.current.controller?.abort();
    }
  }, [disabled, player]);

  async function handleSpeech() {
    const current = session.current;

    if (disabled || current.busy || !text.trim()) return;

    if (player.playing) {
      player.pause();
      return;
    }

    current.busy = true;
    setLoading(true);
    setError(null);

    const controller = new AbortController();
    current.controller = controller;

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 75_000);

    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      if (!current.file) {
        const file = await generateSpeechFile(
          text,
          controller.signal
        );

        if (!current.mounted || controller.signal.aborted) {
          removeCachedFile(file);
          return;
        }

        current.file = file;
      }

      if (!current.mounted || controller.signal.aborted) return;

      if (player.isLoaded) {
        await player.seekTo(0);
      } else {
        player.replace(current.file.uri);
      }

      if (current.mounted && !controller.signal.aborted) {
        player.play();
      }
    } catch (err) {
      if (
        current.mounted &&
        (!controller.signal.aborted || timedOut)
      ) {
        setError(
          timedOut
            ? 'Speech generation timed out. Please try again.'
            : err instanceof Error
              ? err.message
              : 'Could not generate speech.'
        );
      }
    } finally {
      clearTimeout(timeout);
      current.controller = null;
      current.busy = false;

      if (current.mounted) setLoading(false);
    }
  }

  if (!text.trim()) return null;

  const blocked = disabled || loading;
  const displayedError = error || status.error;

  return (
    <View style={styles.container}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{
          disabled: blocked,
          busy: loading,
        }}
        disabled={blocked}
        onPress={() => void handleSpeech()}
        style={({ pressed }) => [
          styles.button,
          (blocked || pressed) && styles.dimmed,
        ]}
      >
        {loading && <ActivityIndicator color="#FFFFFF" />}

        <Text style={styles.buttonText}>
          {loading
            ? 'Preparing speech...'
            : status.playing
              ? 'Pause speech'
              : status.isLoaded
                ? 'Replay translation'
                : 'Listen to translation'}
        </Text>
      </Pressable>

      {displayedError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {displayedError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, marginTop: 10 },
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#205B43',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  dimmed: { opacity: 0.45 },
  error: { color: '#9A3232', fontSize: 14, lineHeight: 21 },
});