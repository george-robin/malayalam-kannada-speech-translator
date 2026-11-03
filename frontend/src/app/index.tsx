import { SpeechControls } from '@/components/speech-controls';
import { translateRecording } from '@/lib/api';
import type { TranslationResult } from '@/lib/api';
import { useRef, useState } from 'react';

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';

export default function HomeScreen() {
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [translating, setTranslating] = useState(false);
  const languages = ['Kannada', 'Malayalam', 'English'] as const;
  const [targetLanguage, setTargetLanguage] =
    useState<(typeof languages)[number]>('Kannada');

  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [savedDuration, setSavedDuration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const operationInProgress = useRef(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);
  const player = useAudioPlayer(recordingUri);
  const playback = useAudioPlayerStatus(player);

  const isRecording = recorderState.isRecording;
  const duration = isRecording
    ? recorderState.durationMillis
    : savedDuration;

  const totalSeconds = Math.floor(duration / 1000);
  const timer = `${Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(totalSeconds % 60)
    .toString()
    .padStart(2, '0')}`;

  async function toggleRecording() {
    if (operationInProgress.current) return;

    operationInProgress.current = true;
    setBusy(true);
    setError(null);

    try {
      if (recorder.isRecording) {
        const elapsed = recorder.getStatus().durationMillis;
        await recorder.stop();

        const uri = recorder.uri;
        if (!uri) {
          throw new Error('No recording was saved. Please try again.');
        }

        setRecordingUri(uri);
        setSavedDuration(elapsed);

        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });
      } else {
        const permission =
          await AudioModule.requestRecordingPermissionsAsync();

        if (!permission.granted) {
          setError(
            'Microphone access is needed to record. Enable it in your phone settings.'
          );
          return;
        }

        player.pause();

        await setAudioModeAsync({
          allowsRecording: true,
          playsInSilentMode: true,
        });

        await recorder.prepareToRecordAsync();

        setRecordingUri(null);
        setSavedDuration(0);
        setResult(null);
        recorder.record();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Recording failed. Try again.'
      );
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  async function handleTranslate() {
  if (
    operationInProgress.current ||
    !recordingUri ||
    recorder.isRecording
  ) {
    return;
  }

  operationInProgress.current = true;
  setBusy(true);
  setTranslating(true);
  setError(null);

  try {
    player.pause();

    const translation = await translateRecording(
      recordingUri,
      targetLanguage
    );

    setResult(translation);
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : 'Translation failed. Please try again.'
    );
  } finally {
    operationInProgress.current = false;
    setBusy(false);
    setTranslating(false);
  }
}

  async function togglePlayback() {
    if (
      operationInProgress.current ||
      !recordingUri ||
      recorder.isRecording
    ) {
      return;
    }

    operationInProgress.current = true;
    setBusy(true);
    setError(null);

    try {
      if (player.playing) {
        player.pause();
      } else {
        await setAudioModeAsync({
          allowsRecording: false,
          playsInSilentMode: true,
        });

        await player.seekTo(0);
        player.play();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not play the recording.'
      );
    } finally {
      operationInProgress.current = false;
      setBusy(false);
    }
  }

  const replayDisabled =
    !recordingUri || isRecording || busy || !playback.isLoaded;

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top', 'left', 'right']}
    >
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.eyebrow}>VOICE TRANSLATOR</Text>
          <Text style={styles.title}>Speak naturally.</Text>
          <Text style={styles.subtitle}>
            Start with your voice. Choose the language you want to be
            understood in.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Translate into</Text>

          <View style={styles.languageRow}>
            {languages.map((language) => {
              const selected = targetLanguage === language;

              return (
                <Pressable
                  key={language}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: busy }}
                  disabled={busy}
                  onPress={() => {
                     if (language !== targetLanguage) {
                      setTargetLanguage(language);
                      setResult(null);
                      setError(null);
                    }
                  }}
                  style={[
                    styles.language,
                    selected && styles.languageSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.languageText,
                      selected && styles.languageTextSelected,
                    ]}
                  >
                    {language}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.recorderCard}>
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusDot,
                isRecording && styles.statusDotRecording,
              ]}
            />
            <Text style={styles.statusText}>
              {isRecording
                ? 'Recording'
                : recordingUri
                  ? 'Recording saved'
                  : 'Ready to record'}
            </Text>
          </View>

          <Text style={styles.timer}>{timer}</Text>

          <Text style={styles.recordingHint}>
            Speak in Kannada, Malayalam, English, or a mix.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? 'Stop recording' : 'Start recording'
            }
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => void toggleRecording()}
            style={({ pressed }) => [
              styles.recordButton,
              isRecording && styles.stopButton,
              (pressed || busy) && styles.dimmed,
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <View
                  style={
                    isRecording ? styles.stopIcon : styles.recordIcon
                  }
                />
                <Text style={styles.recordButtonText}>
                  {isRecording
                    ? 'Stop recording'
                    : recordingUri
                      ? 'Record again'
                      : 'Start recording'}
                </Text>
              </>
            )}
          </Pressable>

                    <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: replayDisabled }}
            disabled={replayDisabled}
            onPress={() => void togglePlayback()}
            style={({ pressed }) => [
              styles.replayButton,
              (replayDisabled || pressed) && styles.dimmed,
            ]}
          >
            <Text style={styles.replayText}>
              {playback.playing
                ? 'Pause recording'
                : 'Replay recording'}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            disabled: !recordingUri || isRecording || busy,
            busy: translating,
          }}
          disabled={!recordingUri || isRecording || busy}
          onPress={() => void handleTranslate()}
          style={({ pressed }) => [
            styles.recordButton,
            (!recordingUri || isRecording || busy || pressed) &&
              styles.dimmed,
          ]}
        >
          {translating && <ActivityIndicator color="#FFFFFF" />}

          <Text style={styles.recordButtonText}>
            {translating
              ? 'Translating...'
              : `Translate to ${targetLanguage}`}
          </Text>
        </Pressable>
        

        {error && (
          <View style={styles.errorBox} accessibilityRole="alert">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.section}>
  <Text style={styles.sectionTitle}>Your conversation</Text>

  <View style={styles.resultCard}>
    <Text style={styles.resultLabel}>ORIGINAL TRANSCRIPT</Text>
    <Text
      selectable
      style={result ? styles.resultText : styles.placeholder}
    >
      {result?.transcript ?? 'Your original words will appear here.'}
    </Text>
  </View>

  <View style={styles.resultCard}>
    <Text style={styles.resultLabel}>ENGLISH MEANING</Text>
    <Text
      selectable
      style={result ? styles.resultText : styles.placeholder}
    >
      {result?.english_meaning ??
        'The meaning in English will appear here.'}
    </Text>
  </View>

  <View style={[styles.resultCard, styles.translationCard]}>
    <Text style={styles.resultLabel}>
      TRANSLATION · {targetLanguage.toUpperCase()}
    </Text>
    <Text
      selectable
      style={result ? styles.resultText : styles.placeholder}
    >
      {result?.translation ??
        'Your translated message will appear here.'}
    </Text>
    <SpeechControls
  key={`${result?.target_language ?? ''}:${result?.translation ?? ''}`}
  text={result?.translation ?? ''}
  disabled={isRecording || busy || playback.playing}
/>
  </View>
</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F3F6F2' },
  resultText: {
  fontSize: 16,
  lineHeight: 26,
  color: '#172D24',
},
  content: {
    padding: 22,
    paddingBottom: 120,
    gap: 26,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  header: { gap: 10, paddingTop: 16 },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#28654C',
  },
  title: { fontSize: 36, fontWeight: '800', color: '#172D24' },
  subtitle: { fontSize: 16, lineHeight: 24, color: '#596A61' },
  section: { gap: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#172D24' },
  languageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  language: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE4DC',
  },
  languageSelected: { backgroundColor: '#205B43', borderColor: '#205B43' },
  languageText: { fontSize: 14, fontWeight: '600', color: '#43594B' },
  languageTextSelected: { color: '#FFFFFF' },
  recorderCard: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7DD',
    alignItems: 'center',
    gap: 18,
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6F8977',
  },
  statusDotRecording: { backgroundColor: '#C54343' },
  statusText: { fontSize: 14, fontWeight: '600', color: '#596A61' },
  timer: {
    fontSize: 54,
    fontWeight: '300',
    fontVariant: ['tabular-nums'],
    color: '#172D24',
  },
  recordingHint: {
    fontSize: 14,
    lineHeight: 21,
    color: '#68796C',
    textAlign: 'center',
  },
  recordButton: {
    width: '100%',
    minHeight: 58,
    borderRadius: 17,
    backgroundColor: '#205B43',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  stopButton: { backgroundColor: '#AE3838' },
  recordButtonText: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  recordIcon: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#FFFFFF',
  },
  stopIcon: {
    width: 14,
    height: 14,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  replayButton: {
    minHeight: 46,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replayText: { fontSize: 15, fontWeight: '600', color: '#205B43' },
  dimmed: { opacity: 0.45 },
  resultCard: {
    padding: 20,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E7DD',
    gap: 10,
  },
  translationCard: { backgroundColor: '#E5EFE3', borderColor: '#CCDCC8' },
  resultLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: '#41634D',
  },
  placeholder: { fontSize: 15, lineHeight: 23, color: '#758477' },
  errorBox: { padding: 16, borderRadius: 14, backgroundColor: '#FBE9E7' },
  errorText: { fontSize: 14, lineHeight: 21, color: '#9A3232' },
});