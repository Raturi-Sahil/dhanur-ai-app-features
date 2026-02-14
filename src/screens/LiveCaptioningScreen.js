import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

import CaptionDisplay from '../components/CaptionDisplay';
import MicButton from '../components/MicButton';
import { COLORS, GRADIENTS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../styles/theme';

let SpeechRecognitionModule = null;
let useSpeechRecognitionEventSafe = () => {};

try {
  const speechRecognitionPackage = require('@jamsch/expo-speech-recognition');
  SpeechRecognitionModule = speechRecognitionPackage.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEventSafe = speechRecognitionPackage.useSpeechRecognitionEvent;
} catch (error) {
  // Expo Go does not include this native module.
}

const isSpeechRecognitionAvailable = SpeechRecognitionModule !== null;

export default function LiveCaptioningScreen() {
  const [isListening, setIsListening] = useState(false);
  const [captions, setCaptions] = useState([]);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [hasPermission, setHasPermission] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isSpeechRecognitionAvailable) {
      setHasPermission(false);
      setError('Live captioning requires a development build. Expo Go does not include speech recognition.');
      return;
    }
    checkPermission();
  }, []);

  // Handle speech recognition results
  useSpeechRecognitionEventSafe('result', (event) => {
    const transcript = event.results[0]?.transcript || '';

    if (event.isFinal) {
      // Add final result to captions
      if (transcript.trim()) {
        setCaptions(prev => [...prev, transcript]);
      }
      setCurrentTranscript('');
    } else {
      // Update interim transcript
      setCurrentTranscript(transcript);
    }
  });

  useSpeechRecognitionEventSafe('start', () => {
    setIsListening(true);
    setError(null);
  });

  useSpeechRecognitionEventSafe('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEventSafe('error', (event) => {
    console.error('Speech recognition error:', event.error);
    setError(`Error: ${event.error}`);
    setIsListening(false);
  });

  const checkPermission = async () => {
    if (!SpeechRecognitionModule) return;

    try {
      const result = await SpeechRecognitionModule.getPermissionsAsync();
      setHasPermission(result.granted);

      if (!result.granted && result.canAskAgain) {
        const requestResult = await SpeechRecognitionModule.requestPermissionsAsync();
        setHasPermission(requestResult.granted);
      }
    } catch (err) {
      console.error('Permission check failed:', err);
      setError('Failed to check permissions');
    }
  };

  const startListening = async () => {
    if (!SpeechRecognitionModule) {
      Alert.alert(
        'Feature Not Available',
        'Live captioning needs a development build or production app. Expo Go cannot load this native module.'
      );
      return;
    }

    if (!hasPermission) {
      Alert.alert(
        'Permission Required',
        'Please grant microphone permission to use live captioning.',
        [{ text: 'OK', onPress: checkPermission }]
      );
      return;
    }

    try {
      setError(null);

      // Start speech recognition
      SpeechRecognitionModule.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
      });
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      setError('Failed to start speech recognition');
    }
  };

  const stopListening = async () => {
    if (!SpeechRecognitionModule) return;

    try {
      SpeechRecognitionModule.stop();
    } catch (err) {
      console.error('Failed to stop speech recognition:', err);
    }
  };

  const handleMicPress = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const clearCaptions = () => {
    setCaptions([]);
    setCurrentTranscript('');
  };

  // Combine captions with current interim transcript
  const displayCaptions = currentTranscript
    ? [...captions, currentTranscript]
    : captions;

  return (
    <LinearGradient colors={GRADIENTS.dark} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Live Captioning</Text>
          <Text style={styles.subtitle}>
            Real-time speech to text
          </Text>
        </View>

        {/* Error Display */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={20} color={COLORS.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Caption Display */}
        <View style={styles.captionContainer}>
          <CaptionDisplay
            captions={displayCaptions}
            isListening={isListening}
          />
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <MicButton
            isRecording={isListening}
            onPress={handleMicPress}
            disabled={!isSpeechRecognitionAvailable || hasPermission === false}
          />

          <View style={styles.secondaryControls}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={clearCaptions}
              disabled={captions.length === 0 && !currentTranscript}
            >
              <Ionicons
                name="trash-outline"
                size={24}
                color={captions.length === 0 && !currentTranscript ? COLORS.textMuted : COLORS.textPrimary}
              />
              <Text style={[
                styles.controlButtonText,
                captions.length === 0 && !currentTranscript && styles.controlButtonTextDisabled
              ]}>
                Clear
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusDot, isListening && styles.statusDotActive]} />
          <Text style={styles.statusText}>
            {!isSpeechRecognitionAvailable
              ? 'Live captioning unavailable in Expo Go'
              : isListening
              ? 'Listening... speak now'
              : 'Tap microphone to start'
            }
          </Text>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.md,
    color: COLORS.textSecondary,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.md,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.error,
    marginBottom: SPACING.md,
  },
  errorText: {
    color: COLORS.error,
    marginLeft: SPACING.sm,
    fontSize: TYPOGRAPHY.fontSizes.sm,
  },
  captionContainer: {
    flex: 1,
    marginVertical: SPACING.md,
  },
  controls: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  secondaryControls: {
    flexDirection: 'row',
    marginTop: SPACING.lg,
    gap: SPACING.xl,
  },
  controlButton: {
    alignItems: 'center',
    padding: SPACING.md,
  },
  controlButtonText: {
    color: COLORS.textPrimary,
    marginTop: SPACING.xs,
    fontSize: TYPOGRAPHY.fontSizes.sm,
  },
  controlButtonTextDisabled: {
    color: COLORS.textMuted,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: SPACING.lg,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.textMuted,
    marginRight: SPACING.sm,
  },
  statusDotActive: {
    backgroundColor: COLORS.success,
  },
  statusText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSizes.sm,
  },
});
