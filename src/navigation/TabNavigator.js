import React from 'react';
import { StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import LiveCaptioningScreen from '../screens/LiveCaptioningScreen';
import TeleprompterScreen from '../screens/TeleprompterScreen';
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
            iconName = focused ? 'mic' : 'mic-outline';
          } else if (route.name === 'Teleprompter') {
            iconName = focused ? 'videocam' : 'videocam-outline';
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
        name="Teleprompter"
        component={TeleprompterScreen}
        options={{
          tabBarLabel: 'Teleprompter',
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: 0,
    paddingTop: 8,
    paddingBottom: 8,
    height: 70,
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
