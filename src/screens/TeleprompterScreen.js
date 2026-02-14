import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';

import { COLORS, GRADIENTS, SPACING, TYPOGRAPHY, BORDER_RADIUS } from '../styles/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const DEFAULT_SCRIPT = `Welcome to the Teleprompter!

This is a sample script to demonstrate how the teleprompter works.

Simply tap the "Edit Script" button to paste your own script.

Features:
• Adjustable scroll speed
• Text size control
• Mirror mode for reflective teleprompters
• Play/Pause controls
• Camera preview with video recording

Tip: Practice reading at a natural pace and adjust the speed to match your speaking rhythm.

Good luck with your presentation!`;

export default function TeleprompterScreen() {
  const [script, setScript] = useState(DEFAULT_SCRIPT);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMirrored, setIsMirrored] = useState(false);
  const [speed, setSpeed] = useState(50);
  const [fontSize, setFontSize] = useState(28);
  const [showSettings, setShowSettings] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editText, setEditText] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Camera & Recording states
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [facing, setFacing] = useState('front');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [mediaLibraryPermission, setMediaLibraryPermission] = useState(null);

  const cameraRef = useRef(null);
  const scrollViewRef = useRef(null);
  const scrollPosition = useRef(0);
  const animationRef = useRef(null);
  const contentHeight = useRef(0);
  const containerHeight = useRef(0);
  const durationTimerRef = useRef(null);

  // Request media library permission on mount
  useEffect(() => {
    (async () => {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setMediaLibraryPermission(status === 'granted');
    })();
  }, []);

  // Calculate scroll speed
  const getPixelsPerFrame = useCallback(() => {
    return (speed / 50) * 1.5;
  }, [speed]);

  const startScrolling = useCallback(() => {
    if (!scrollViewRef.current) return;

    const maxScroll = contentHeight.current - containerHeight.current;
    if (maxScroll <= 0) return;

    const pixelsPerFrame = getPixelsPerFrame();

    const animate = () => {
      scrollPosition.current += pixelsPerFrame;

      if (scrollPosition.current >= maxScroll) {
        scrollPosition.current = maxScroll;
        setIsPlaying(false);
        return;
      }

      if (scrollViewRef.current) {
        scrollViewRef.current.scrollTo({ y: scrollPosition.current, animated: false });
      }

      if (isPlaying) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  }, [speed, isPlaying, getPixelsPerFrame]);

  const stopScrolling = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (isPlaying && countdown === 0) {
      startScrolling();
    } else {
      stopScrolling();
    }

    return () => stopScrolling();
  }, [isPlaying, countdown, startScrolling, stopScrolling]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Recording duration timer
  useEffect(() => {
    if (isRecording) {
      setRecordingDuration(0);
      durationTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      setRecordingDuration(0);
    }
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
      }
    };
  }, [isRecording]);

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handlePlayPause = () => {
    if (!isPlaying) {
      setCountdown(3);
      setTimeout(() => setIsPlaying(true), 3000);
    } else {
      setIsPlaying(false);
    }
  };

  const handleReset = () => {
    setIsPlaying(false);
    scrollPosition.current = 0;
    if (scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }
  };

  const handleSpeedChange = (delta) => {
    setSpeed(prev => Math.max(10, Math.min(100, prev + delta)));
  };

  const handleFontSizeChange = (delta) => {
    setFontSize(prev => Math.max(16, Math.min(48, prev + delta)));
  };

  const handleEditScript = () => {
    setEditText(script);
    setShowEditor(true);
  };

  const handleSaveScript = () => {
    setScript(editText);
    setShowEditor(false);
    handleReset();
  };

  const handleScroll = (event) => {
    if (!isPlaying) {
      scrollPosition.current = event.nativeEvent.contentOffset.y;
    }
  };

  const handleContentSizeChange = (w, h) => {
    contentHeight.current = h;
  };

  const handleLayout = (event) => {
    containerHeight.current = event.nativeEvent.layout.height;
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  const startRecording = async () => {
    if (!cameraRef.current) return;

    // Ensure permissions
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is needed to record video.');
        return;
      }
    }
    if (!micPermission?.granted) {
      const result = await requestMicPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Microphone permission is needed to record video with audio.');
        return;
      }
    }

    try {
      setIsRecording(true);
      const video = await cameraRef.current.recordAsync({
        maxDuration: 600, // 10 minutes max
      });

      // Save to media library
      if (video && video.uri) {
        if (mediaLibraryPermission) {
          await MediaLibrary.saveToLibraryAsync(video.uri);
          Alert.alert('Video Saved!', 'Your recording has been saved to your gallery.');
        } else {
          Alert.alert('Video Recorded', `Video saved at: ${video.uri}\n\nEnable media library permission to save to gallery.`);
        }
      }
    } catch (err) {
      if (err.message && !err.message.includes('cancelled')) {
        console.error('Recording error:', err);
        Alert.alert('Recording Error', 'Failed to record video. Please try again.');
      }
    } finally {
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (cameraRef.current && isRecording) {
      cameraRef.current.stopRecording();
    }
  };

  const handleRecordToggle = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Check if camera permissions are ready
  const cameraReady = cameraPermission?.granted && micPermission?.granted;

  // Request all permissions
  const requestAllPermissions = async () => {
    if (!cameraPermission?.granted) await requestCameraPermission();
    if (!micPermission?.granted) await requestMicPermission();
    if (!mediaLibraryPermission) {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      setMediaLibraryPermission(status === 'granted');
    }
  };

  // Fullscreen teleprompter view with camera
  if (isFullscreen) {
    return (
      <View style={styles.fullscreenContainer}>
        <StatusBar hidden />

        {cameraEnabled && cameraReady && (
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            facing={facing}
            mode="video"
          />
        )}

        {/* Dark overlay for text readability */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.4)' }]} />

        {countdown > 0 && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingIndicator}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingTimeText}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}

        <ScrollView
          ref={scrollViewRef}
          style={styles.fullscreenScroll}
          contentContainerStyle={styles.fullscreenContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={handleContentSizeChange}
          onLayout={handleLayout}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.prompterText,
              {
                fontSize,
                lineHeight: fontSize * 1.6,
                transform: isMirrored ? [{ scaleX: -1 }] : [],
              },
            ]}
          >
            {script}
          </Text>
        </ScrollView>

        <View style={styles.floatingControls}>
          <TouchableOpacity style={styles.floatingBtn} onPress={handlePlayPause}>
            <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingBtn} onPress={handleReset}>
            <Ionicons name="refresh" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.floatingBtn, isRecording && styles.floatingBtnRecording]}
            onPress={handleRecordToggle}
          >
            <Ionicons name={isRecording ? 'stop' : 'radio-button-on'} size={24} color={isRecording ? '#FF5252' : '#fff'} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingBtn} onPress={toggleCameraFacing}>
            <Ionicons name="camera-reverse" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingBtn} onPress={() => setIsFullscreen(false)}>
            <Ionicons name="contract" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.speedIndicator}>
          <Text style={styles.speedText}>Speed: {speed}%</Text>
        </View>
      </View>
    );
  }

  // Normal view
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Camera Background */}
      {cameraEnabled && cameraReady ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          mode="video"
        />
      ) : (
        <LinearGradient colors={GRADIENTS.dark} style={StyleSheet.absoluteFill} />
      )}

      {/* Dark overlay for readability */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)' }]} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Teleprompter</Text>
          <View style={styles.headerActions}>
            {/* Camera toggle */}
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => {
                if (!cameraReady) {
                  requestAllPermissions();
                } else {
                  setCameraEnabled(!cameraEnabled);
                }
              }}
            >
              <Ionicons
                name={cameraEnabled && cameraReady ? 'videocam' : 'videocam-off'}
                size={24}
                color={cameraEnabled && cameraReady ? COLORS.success : COLORS.textMuted}
              />
            </TouchableOpacity>
            {/* Flip camera */}
            {cameraEnabled && cameraReady && (
              <TouchableOpacity style={styles.headerBtn} onPress={toggleCameraFacing}>
                <Ionicons name="camera-reverse-outline" size={24} color={COLORS.textPrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSettings(!showSettings)}>
              <Ionicons name="settings-outline" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Permission Banner */}
        {!cameraReady && (
          <TouchableOpacity style={styles.permissionBanner} onPress={requestAllPermissions}>
            <Ionicons name="camera" size={20} color={COLORS.accent} />
            <Text style={styles.permissionBannerText}>
              Tap to enable Camera & Mic for video recording
            </Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.accent} />
          </TouchableOpacity>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <View style={styles.recordingBanner}>
            <View style={styles.recordingDot} />
            <Text style={styles.recordingBannerText}>Recording</Text>
            <Text style={styles.recordingTimeText}>{formatDuration(recordingDuration)}</Text>
          </View>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <View style={styles.settingsPanel}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Speed</Text>
              <View style={styles.settingControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={() => handleSpeedChange(-10)}>
                  <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.settingValue}>{speed}%</Text>
                <TouchableOpacity style={styles.controlBtn} onPress={() => handleSpeedChange(10)}>
                  <Ionicons name="add" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Text Size</Text>
              <View style={styles.settingControls}>
                <TouchableOpacity style={styles.controlBtn} onPress={() => handleFontSizeChange(-4)}>
                  <Ionicons name="remove" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.settingValue}>{fontSize}px</Text>
                <TouchableOpacity style={styles.controlBtn} onPress={() => handleFontSizeChange(4)}>
                  <Ionicons name="add" size={20} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Mirror Mode</Text>
              <TouchableOpacity
                style={[styles.toggleBtn, isMirrored && styles.toggleBtnActive]}
                onPress={() => setIsMirrored(!isMirrored)}
              >
                <Ionicons
                  name={isMirrored ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={isMirrored ? COLORS.primary : COLORS.textMuted}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Countdown Overlay */}
        {countdown > 0 && (
          <View style={styles.countdownOverlay}>
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        )}

        {/* Script Preview */}
        <View style={styles.previewContainer}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.scriptPreview}
            contentContainerStyle={styles.scriptContent}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onContentSizeChange={handleContentSizeChange}
            onLayout={handleLayout}
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={[
                styles.prompterText,
                {
                  fontSize,
                  lineHeight: fontSize * 1.6,
                  transform: isMirrored ? [{ scaleX: -1 }] : [],
                },
              ]}
            >
              {script}
            </Text>
          </ScrollView>

          <LinearGradient
            colors={['rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 0)']}
            style={styles.topGradient}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['rgba(0, 0, 0, 0)', 'rgba(0, 0, 0, 0.8)']}
            style={styles.bottomGradient}
            pointerEvents="none"
          />
          <View style={styles.readingLine} pointerEvents="none" />
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          <View style={styles.primaryControls}>
            <TouchableOpacity style={styles.controlButton} onPress={handleReset}>
              <Ionicons name="refresh" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>

            <TouchableOpacity onPress={handlePlayPause} activeOpacity={0.8}>
              <LinearGradient
                colors={isPlaying ? GRADIENTS.recording : GRADIENTS.primary}
                style={styles.playButton}
              >
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={36}
                  color={COLORS.textPrimary}
                />
              </LinearGradient>
            </TouchableOpacity>

            {/* Record Button */}
            <TouchableOpacity
              onPress={handleRecordToggle}
              activeOpacity={0.8}
              disabled={!cameraEnabled || !cameraReady}
            >
              <LinearGradient
                colors={isRecording ? GRADIENTS.recording : ['#FF5252', '#D50000']}
                style={[
                  styles.recordButton,
                  (!cameraEnabled || !cameraReady) && styles.recordButtonDisabled,
                ]}
              >
                <Ionicons
                  name={isRecording ? 'stop' : 'radio-button-on'}
                  size={28}
                  color={COLORS.textPrimary}
                />
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.controlButton} onPress={() => setIsFullscreen(true)}>
              <Ionicons name="expand" size={28} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Script Actions */}
          <View style={styles.scriptActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={handleEditScript}>
              <Ionicons name="create-outline" size={20} color={COLORS.primary} />
              <Text style={styles.actionBtnText}>Edit Script</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Script Editor Modal */}
        <Modal visible={showEditor} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={styles.editorModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Script</Text>
                <TouchableOpacity onPress={() => setShowEditor(false)}>
                  <Ionicons name="close" size={28} color={COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.scriptInput}
                value={editText}
                onChangeText={setEditText}
                multiline
                placeholder="Paste or type your script here..."
                placeholderTextColor={COLORS.textMuted}
                textAlignVertical="top"
              />

              <TouchableOpacity onPress={handleSaveScript} activeOpacity={0.8}>
                <LinearGradient colors={GRADIENTS.primary} style={styles.saveButton}>
                  <Text style={styles.saveButtonText}>Save Script</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: TYPOGRAPHY.fontSizes.xxl,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  headerBtn: {
    padding: SPACING.sm,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
  },
  permissionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(0, 217, 255, 0.12)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(0, 217, 255, 0.25)',
    gap: SPACING.sm,
  },
  permissionBannerText: {
    flex: 1,
    color: COLORS.accent,
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: '500',
  },
  recordingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    backgroundColor: 'rgba(255, 82, 82, 0.2)',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.4)',
    gap: SPACING.sm,
  },
  recordingBannerText: {
    color: '#FF5252',
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  recordingIndicator: {
    position: 'absolute',
    top: SPACING.xl + 10,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: SPACING.xs + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full || 20,
    gap: SPACING.sm,
    zIndex: 200,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF5252',
  },
  recordingTimeText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  settingsPanel: {
    backgroundColor: 'rgba(22, 33, 62, 0.9)',
    marginHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  settingLabel: {
    color: COLORS.textSecondary,
    fontSize: TYPOGRAPHY.fontSizes.md,
  },
  settingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  controlBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingValue: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSizes.md,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'center',
  },
  toggleBtn: {
    padding: SPACING.xs,
  },
  toggleBtnActive: {
    opacity: 1,
  },
  previewContainer: {
    flex: 1,
    marginHorizontal: SPACING.md,
    position: 'relative',
  },
  scriptPreview: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: BORDER_RADIUS.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  scriptContent: {
    padding: SPACING.xl,
    paddingTop: SCREEN_HEIGHT * 0.15,
    paddingBottom: SCREEN_HEIGHT * 0.4,
  },
  prompterText: {
    color: COLORS.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 80,
    borderTopLeftRadius: BORDER_RADIUS.lg,
    borderTopRightRadius: BORDER_RADIUS.lg,
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    borderBottomLeftRadius: BORDER_RADIUS.lg,
    borderBottomRightRadius: BORDER_RADIUS.lg,
  },
  readingLine: {
    position: 'absolute',
    top: '30%',
    left: SPACING.md,
    right: SPACING.md,
    height: 2,
    backgroundColor: COLORS.primary,
    opacity: 0.5,
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  countdownText: {
    fontSize: 120,
    fontWeight: '700',
    color: COLORS.primary,
  },
  controls: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
  },
  primaryControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.lg,
    marginBottom: SPACING.md,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  recordButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#FF5252',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  recordButtonDisabled: {
    opacity: 0.35,
  },
  scriptActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BORDER_RADIUS.full || 20,
  },
  actionBtnText: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSizes.sm,
    fontWeight: '600',
  },
  // Fullscreen styles
  fullscreenContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  fullscreenScroll: {
    flex: 1,
  },
  fullscreenContent: {
    padding: SPACING.xl,
    paddingTop: SCREEN_HEIGHT * 0.25,
    paddingBottom: SCREEN_HEIGHT * 0.5,
  },
  floatingControls: {
    position: 'absolute',
    bottom: SPACING.xl,
    right: SPACING.lg,
    flexDirection: 'column',
    gap: SPACING.md,
  },
  floatingBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBtnRecording: {
    backgroundColor: 'rgba(255, 82, 82, 0.4)',
  },
  speedIndicator: {
    position: 'absolute',
    top: SPACING.xl,
    right: SPACING.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.full || 20,
  },
  speedText: {
    color: '#fff',
    fontSize: TYPOGRAPHY.fontSizes.sm,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  editorModal: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: BORDER_RADIUS.xl,
    borderTopRightRadius: BORDER_RADIUS.xl,
    padding: SPACING.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  modalTitle: {
    fontSize: TYPOGRAPHY.fontSizes.xl,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  scriptInput: {
    backgroundColor: COLORS.surface,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSizes.md,
    minHeight: 300,
    maxHeight: 400,
  },
  saveButton: {
    marginTop: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.full || 20,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.textPrimary,
    fontSize: TYPOGRAPHY.fontSizes.md,
    fontWeight: '700',
  },
});
