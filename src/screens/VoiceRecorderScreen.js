import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Animated,
  Dimensions,
  Platform,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';

import { COLORS, GRADIENTS, SPACING, TYPOGRAPHY, BORDER_RADIUS, SHADOWS } from '../styles/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_WAVEFORM_BARS = 30;

// Mic input interaction modes
const MIC_MODES = {
  TAP_TOGGLE: 'tap_toggle',
  LONG_PRESS: 'long_press',
  HOLD_TO_RECORD: 'hold_to_record',
};

const MIC_MODE_LABELS = {
  [MIC_MODES.TAP_TOGGLE]: { label: 'Tap to Toggle', icon: 'radio-button-on', desc: 'Tap once to start, tap again to stop' },
  [MIC_MODES.LONG_PRESS]: { label: 'Long Press', icon: 'finger-print', desc: 'Long press to start, tap to stop' },
  [MIC_MODES.HOLD_TO_RECORD]: { label: 'Hold to Record', icon: 'hand-left', desc: 'Hold button to record, release to stop' },
};

export default function VoiceRecorderScreen({ navigation }) {
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordings, setRecordings] = useState([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasPermission, setHasPermission] = useState(null);
  const [micMode, setMicMode] = useState(MIC_MODES.TAP_TOGGLE);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isHolding, setIsHolding] = useState(false);

  // Refs
  const recordingRef = useRef(null);
  const timerRef = useRef(null);
  const meterIntervalRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const isStartingRef = useRef(false);
  const stopRequestedRef = useRef(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const waveformAnims = useRef(
    Array.from({ length: NUM_WAVEFORM_BARS }, () => new Animated.Value(0.15))
  ).current;
  const buttonScaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkPermission();
    loadRecordings();
    return () => {
      cleanupRecording();
    };
  }, []);

  // Pulse animation for recording state
  useEffect(() => {
    if (isRecording && !isPaused) {
      startPulseAnimation();
      startWaveformAnimation();
    } else {
      stopPulseAnimation();
      stopWaveformAnimation();
    }
  }, [isRecording, isPaused]);



  const cleanupRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (meterIntervalRef.current) clearInterval(meterIntervalRef.current);
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.isRecording || status.isDoneRecording === false) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch (e) {
        // Already stopped
      }
    }
  };

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(ringAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopPulseAnimation = () => {
    pulseAnim.stopAnimation();
    ringAnim.stopAnimation();
    Animated.timing(pulseAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    Animated.timing(ringAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  const startWaveformAnimation = () => {
    meterIntervalRef.current = setInterval(() => {
      waveformAnims.forEach((anim) => {
        const randomHeight = Math.random() * 0.85 + 0.15;
        Animated.timing(anim, {
          toValue: randomHeight,
          duration: 80 + Math.random() * 60,
          useNativeDriver: true,
        }).start();
      });
    }, 100);
  };

  const stopWaveformAnimation = () => {
    if (meterIntervalRef.current) {
      clearInterval(meterIntervalRef.current);
      meterIntervalRef.current = null;
    }
    waveformAnims.forEach((anim) => {
      Animated.timing(anim, {
        toValue: 0.15,
        duration: 400,
        useNativeDriver: true,
      }).start();
    });
  };

  const checkPermission = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    setHasPermission(status === 'granted');
  };

  const loadRecordings = async () => {
    try {
      const dir = FileSystem.documentDirectory + 'recordings/';
      const dirInfo = await FileSystem.getInfoAsync(dir);

      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        return;
      }

      const files = await FileSystem.readDirectoryAsync(dir);
      const recordingFiles = files
        .filter(f => f.endsWith('.m4a'))
        .sort((a, b) => b.localeCompare(a)) // Newest first
        .map((file, index) => {
          // Extract timestamp from filename
          const timestamp = file.replace('recording_', '').replace('.m4a', '');
          const date = new Date(parseInt(timestamp));
          const dateStr = isNaN(date.getTime())
            ? 'Unknown date'
            : date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

          return {
            id: index.toString(),
            name: file,
            uri: dir + file,
            date: dateStr,
          };
        });

      setRecordings(recordingFiles);
    } catch (error) {
      console.error('Error loading recordings:', error);
    }
  };

  const startRecording = async () => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Please grant microphone permission to record.');
      return;
    }

    if (isStartingRef.current || isRecording) return;

    isStartingRef.current = true;
    stopRequestedRef.current = false;

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      if (stopRequestedRef.current) {
        // Stop was requested while we were setting up. Abort recording immediately.
        await recording.stopAndUnloadAsync();
        isStartingRef.current = false;
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
        return;
      }

      recordingRef.current = recording;
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    } finally {
      isStartingRef.current = false;
    }
  };

  const pauseRecording = async () => {
    try {
      if (recordingRef.current && isRecording && !isPaused) {
        await recordingRef.current.pauseAsync();
        setIsPaused(true);
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to pause recording:', error);
      Alert.alert('Error', 'Failed to pause recording');
    }
  };

  const resumeRecording = async () => {
    try {
      if (recordingRef.current && isRecording && isPaused) {
        await recordingRef.current.startAsync();
        setIsPaused(false);
        timerRef.current = setInterval(() => {
          setRecordingTime(prev => prev + 1);
        }, 1000);
      }
    } catch (error) {
      console.error('Failed to resume recording:', error);
      Alert.alert('Error', 'Failed to resume recording');
    }
  };

  const stopRecording = async () => {
    stopRequestedRef.current = true;

    // If still starting, the startRecording function will handle the abort to cleanly kill the recording
    if (isStartingRef.current) return;

    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      setIsRecording(false);
      setIsPaused(false);

      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();

        // Save to recordings directory
        const dir = FileSystem.documentDirectory + 'recordings/';
        const dirInfo = await FileSystem.getInfoAsync(dir);
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
        }

        const fileName = `recording_${Date.now()}.m4a`;
        const newUri = dir + fileName;

        await FileSystem.moveAsync({
          from: uri,
          to: newUri,
        });

        recordingRef.current = null;

        // Reset audio mode to playback (prevents echo/feedback)
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        // Reload recordings list
        loadRecordings();

        Alert.alert('✅ Recording Saved', 'Your recording has been saved successfully.');
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Failed to save recording');
    }
  };

  const deleteRecording = async (recording) => {
    Alert.alert(
      'Delete Recording',
      'Are you sure you want to delete this recording?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await FileSystem.deleteAsync(recording.uri);
              loadRecordings();
            } catch (error) {
              console.error('Error deleting recording:', error);
            }
          },
        },
      ]
    );
  };

  const playRecording = async (recording) => {
    try {
      // Ensure audio mode is set for playback, not recording
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: recording.uri },
        { shouldPlay: true }
      );

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          sound.unloadAsync();
        }
      });
    } catch (error) {
      console.error('Error playing recording:', error);
      Alert.alert('Error', 'Failed to play recording');
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── MIC INTERACTION HANDLERS ───────────────────────────

  const handleTapToggle = () => {
    if (isRecording || isStartingRef.current) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const handleLongPressStart = () => {
    longPressTriggeredRef.current = true;
    if (!isRecording && !isStartingRef.current) {
      startRecording();
    }
  };

  const handleLongPressTap = () => {
    // Skip if this tap was the release of a long press
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (isRecording || isStartingRef.current) {
      stopRecording();
    }
  };

  const handleHoldStart = () => {
    setIsHolding(true);
    Animated.spring(buttonScaleAnim, {
      toValue: 0.88,
      friction: 5,
      useNativeDriver: true,
    }).start();
    if (!isRecording && !isStartingRef.current) {
      startRecording();
    }
  };

  const handleHoldEnd = () => {
    setIsHolding(false);
    Animated.spring(buttonScaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();
    if (isRecording || isStartingRef.current) {
      stopRecording();
    }
  };

  // ─── MIC BUTTON RENDERER ───────────────────────────────

  const renderMicButton = () => {
    const ringScale = ringAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 1.8],
    });

    const ringOpacity = ringAnim.interpolate({
      inputRange: [0, 0.5, 1],
      outputRange: [0.6, 0.3, 0],
    });

    const buttonContent = (
      <>
        {/* Animated ring */}
        {isRecording && !isPaused && (
          <Animated.View
            style={[
              styles.micRing,
              {
                transform: [{ scale: ringScale }],
                opacity: ringOpacity,
              },
            ]}
          />
        )}

        {/* Pulse background */}
        <Animated.View
          style={[
            styles.micPulseBackground,
            isRecording && !isPaused && styles.micPulseBackgroundActive,
            { transform: [{ scale: pulseAnim }] },
          ]}
        />

        {/* Main button */}
        <Animated.View style={{ transform: [{ scale: buttonScaleAnim }] }}>
          <LinearGradient
            colors={
              isRecording
                ? isPaused
                  ? ['#FFB300', '#FF8F00']
                  : GRADIENTS.recording
                : GRADIENTS.primary
            }
            style={styles.micButton}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons
              name={
                isRecording
                  ? isPaused
                    ? 'mic-off'
                    : 'mic'
                  : 'mic-outline'
              }
              size={48}
              color={COLORS.textPrimary}
            />
          </LinearGradient>
        </Animated.View>
      </>
    );

    // Different touch behaviors based on mode
    switch (micMode) {
      case MIC_MODES.TAP_TOGGLE:
        return (
          <TouchableOpacity
            onPress={handleTapToggle}
            activeOpacity={0.8}
            style={styles.micTouchArea}
          >
            {buttonContent}
          </TouchableOpacity>
        );

      case MIC_MODES.LONG_PRESS:
        return (
          <TouchableOpacity
            onPress={handleLongPressTap}
            onLongPress={handleLongPressStart}
            delayLongPress={400}
            activeOpacity={0.8}
            style={styles.micTouchArea}
          >
            {buttonContent}
          </TouchableOpacity>
        );

      case MIC_MODES.HOLD_TO_RECORD:
        return (
          <Pressable
            onPressIn={handleHoldStart}
            onPressOut={handleHoldEnd}
            style={styles.micTouchArea}
          >
            {buttonContent}
          </Pressable>
        );

      default:
        return null;
    }
  };

  // ─── WAVEFORM RENDERER ─────────────────────────────────

  const renderWaveform = () => (
    <View style={styles.waveformContainer}>
      {waveformAnims.map((anim, index) => {
        const barColor =
          isRecording && !isPaused
            ? index % 3 === 0
              ? '#FF5252'
              : index % 3 === 1
              ? '#FF7043'
              : '#FF8A65'
            : COLORS.surfaceLight;

        return (
          <Animated.View
            key={index}
            style={[
              styles.waveformBar,
              {
                backgroundColor: barColor,
                transform: [{ scaleY: anim }],
              },
            ]}
          />
        );
      })}
    </View>
  );



  // ─── RECORDING ITEM ────────────────────────────────────

  const renderRecordingItem = ({ item, index }) => (
    <View style={[styles.recordingItem, { opacity: 1 }]}>
      <TouchableOpacity
        style={styles.recordingInfo}
        onPress={() => playRecording(item)}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={['rgba(108, 99, 255, 0.15)', 'rgba(108, 99, 255, 0.05)']}
          style={styles.recordingIconWrap}
        >
          <Ionicons name="musical-note" size={20} color={COLORS.primary} />
        </LinearGradient>
        <View style={styles.recordingDetails}>
          <Text style={styles.recordingName} numberOfLines={1}>
            Recording {recordings.length - index}
          </Text>
          <Text style={styles.recordingDate}>{item.date}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.recordingActions}>
        <TouchableOpacity
          onPress={() => playRecording(item)}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="play-circle" size={28} color={COLORS.success} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => deleteRecording(item)}
          style={styles.actionBtn}
          activeOpacity={0.7}
        >
          <Ionicons name="trash-outline" size={22} color={COLORS.error} />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── MAIN RENDER ───────────────────────────────────────

  return (
    <LinearGradient colors={GRADIENTS.dark} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Voice Recorder</Text>
          <Text style={styles.subtitle}>
            Record audio with pause & resume
          </Text>
        </View>

        {/* Mode Chips - Always Visible */}
        <View style={styles.modeChipsRow}>
          {Object.entries(MIC_MODE_LABELS).map(([mode, info]) => {
            const isActive = micMode === mode;
            return (
              <TouchableOpacity
                key={mode}
                style={[
                  styles.modeChip,
                  isActive && styles.modeChipActive,
                ]}
                onPress={() => {
                  if (!isRecording) setMicMode(mode);
                }}
                disabled={isRecording}
                activeOpacity={0.7}
              >
                <Ionicons
                  name={info.icon}
                  size={16}
                  color={isActive ? '#fff' : COLORS.textMuted}
                />
                <Text
                  style={[
                    styles.modeChipText,
                    isActive && styles.modeChipTextActive,
                  ]}
                >
                  {info.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recording Section */}
        <View style={styles.recordSection}>
          {/* Timer */}
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
            {isRecording && (
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.statusDot,
                    isPaused ? styles.statusDotPaused : styles.statusDotRecording,
                  ]}
                />
                <Text
                  style={[
                    styles.statusLabel,
                    isPaused ? styles.statusLabelPaused : styles.statusLabelRecording,
                  ]}
                >
                  {isPaused ? 'Paused' : 'Recording'}
                </Text>
              </View>
            )}
          </View>

          {/* Waveform Visualization */}
          {renderWaveform()}

          {/* Main Mic Button */}
          <View style={styles.micArea}>{renderMicButton()}</View>

          {/* Pause / Resume Button (visible only when recording) */}
          {isRecording && micMode !== MIC_MODES.HOLD_TO_RECORD && (
            <View style={styles.secondaryControls}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={isPaused ? resumeRecording : pauseRecording}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={isPaused ? GRADIENTS.success : ['#FFB300', '#FF8F00']}
                  style={styles.secondaryBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons
                    name={isPaused ? 'play' : 'pause'}
                    size={24}
                    color={COLORS.textPrimary}
                  />
                </LinearGradient>
                <Text style={styles.secondaryBtnText}>
                  {isPaused ? 'Resume' : 'Pause'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={stopRecording}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={GRADIENTS.recording}
                  style={styles.secondaryBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="stop" size={24} color={COLORS.textPrimary} />
                </LinearGradient>
                <Text style={styles.secondaryBtnText}>Stop & Save</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Hint text */}
          {!isRecording && (
            <Text style={styles.hintText}>
              {MIC_MODE_LABELS[micMode].desc}
            </Text>
          )}
        </View>

        {/* Recordings List */}
        <View style={styles.recordingsList}>
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Your Recordings</Text>
            <Text style={styles.listCount}>
              {recordings.length} {recordings.length === 1 ? 'file' : 'files'}
            </Text>
          </View>

          {recordings.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="mic-off-outline" size={40} color={COLORS.textMuted} />
              </View>
              <Text style={styles.emptyText}>No recordings yet</Text>
              <Text style={styles.emptySubtext}>
                Record your first audio using the mic button above
              </Text>
            </View>
          ) : (
            <FlatList
              data={recordings}
              renderItem={renderRecordingItem}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
            />
          )}
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

// ─── STYLES ──────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },

  // Header
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.textSecondary,
  },

  // Mode Chips Row
  modeChipsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  modeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: SPACING.sm + 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: BORDER_RADIUS.round,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  modeChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  modeChipText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSizes.xs,
    fontWeight: '600',
  },
  modeChipTextActive: {
    color: '#fff',
  },

  // Recording Section
  recordSection: {
    alignItems: 'center',
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },

  // Timer
  timerContainer: {
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  timerText: {
    fontSize: 52,
    fontWeight: '200',
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: 2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: SPACING.xs,
  },
  statusDotRecording: {
    backgroundColor: COLORS.error,
  },
  statusDotPaused: {
    backgroundColor: '#FFB300',
  },
  statusLabel: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  statusLabelRecording: {
    color: COLORS.error,
  },
  statusLabelPaused: {
    color: '#FFB300',
  },

  // Waveform
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
    width: SCREEN_WIDTH - SPACING.xl * 2,
    marginBottom: SPACING.md,
    gap: 3,
  },
  waveformBar: {
    width: (SCREEN_WIDTH - SPACING.xl * 2 - NUM_WAVEFORM_BARS * 3) / NUM_WAVEFORM_BARS,
    height: 50,
    borderRadius: 2,
  },

  // Mic Button
  micArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.sm,
  },
  micTouchArea: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 160,
    height: 160,
  },
  micRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: COLORS.error,
  },
  micPulseBackground: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(31, 43, 71, 0.6)',
  },
  micPulseBackgroundActive: {
    backgroundColor: 'rgba(255, 82, 82, 0.15)',
  },
  micButton: {
    width: 110,
    height: 110,
    borderRadius: 55,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
  },

  // Secondary Controls (Pause / Stop)
  secondaryControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xl,
    marginTop: SPACING.md,
  },
  secondaryBtn: {
    alignItems: 'center',
  },
  secondaryBtnGradient: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  secondaryBtnText: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSizes.xs,
    marginTop: SPACING.xs,
    fontWeight: '500',
  },

  // Hint
  hintText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSizes.sm,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },

  // Recordings List
  recordingsList: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  listHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  listTitle: {
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  listCount: {
    fontSize: TYPOGRAPHY.fontSizes.sm,
    color: COLORS.textMuted,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  recordingIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingDetails: {
    marginLeft: SPACING.md,
    flex: 1,
  },
  recordingName: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSizes.md,
    fontWeight: '500',
  },
  recordingDate: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSizes.xs,
    marginTop: 2,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  actionBtn: {
    padding: SPACING.xs,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSizes.lg,
    fontWeight: '500',
  },
  emptySubtext: {
    color: COLORS.textMuted,
    fontSize: TYPOGRAPHY.fontSizes.sm,
    marginTop: SPACING.xs,
    textAlign: 'center',
    paddingHorizontal: SPACING.xl,
  },
});
