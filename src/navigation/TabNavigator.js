import React from 'react';
import { StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import LiveCaptioningScreen from '../screens/LiveCaptioningScreen';
import VoiceRecorderScreen from '../screens/VoiceRecorderScreen';
import { COLORS } from '../styles/theme';

const Tab = createBottomTabNavigator();

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'Captioning') {
            iconName = focused ? 'chatbubble' : 'chatbubble-outline';
          } else if (route.name === 'Recorder') {
            iconName = focused ? 'mic' : 'mic-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Captioning"
        component={LiveCaptioningScreen}
        options={{
          tabBarLabel: 'Live Caption',
        }}
      />
      <Tab.Screen
        name="Recorder"
        component={VoiceRecorderScreen}
        options={{
          tabBarLabel: 'Voice Recorder',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 0,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'android' ? 48 : 8,
    height: Platform.OS === 'android' ? 104 : 70,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
