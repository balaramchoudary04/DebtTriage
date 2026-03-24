import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, Text } from 'react-native';
import { useTheme } from '../../src/theme';

export default function TabLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="debts"
        options={{
          title: 'My Debts',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>💳</Text>,
        }}
      />
      <Tabs.Screen
        name="payoff"
        options={{
          title: 'Payoff',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📈</Text>,
        }}
      />
      <Tabs.Screen
        name="transfer"
        options={{
          title: 'Transfer',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🔄</Text>,
        }}
      />
      <Tabs.Screen
        name="score"
        options={{
          title: 'Score',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>⭐</Text>,
        }}
      />
      <Tabs.Screen
        name="letters"
        options={{
          title: 'Letters',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>✉️</Text>,
        }}
      />
    </Tabs>
  );
}
