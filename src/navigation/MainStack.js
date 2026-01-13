import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../supabaseClient'; 

// --- IMPORT SCREENS ---
import GroupsScreen from '../screens/GroupsScreen';
import ContactsScreen from '../screens/ContactsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import ChatScreen from '../components/ChatScreen'; 

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// --- LOGOUT BUTTON COMPONENT ---
const LogoutButton = () => {
  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Log Out', 
        style: 'destructive', 
        onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) console.log("Error logging out:", error.message);
        }
      }
    ]);
  };

  return (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
      <Text style={{ color: '#ff3b30', fontWeight: 'bold', fontSize: 16 }}>Log Out</Text>
    </TouchableOpacity>
  );
};

// 1. Create the Bottom Tabs
function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <LogoutButton />, // <--- SHOWS LOGOUT ON EVERY TAB
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Groups') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Contacts') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#007AFF',
        tabBarInactiveTintColor: 'gray',
      })}
    >
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// 2. Main Stackssss
// 2. Main Stackssssfwreewr
export default function MainStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="Home" 
        component={BottomTabs} 
        options={{ headerShown: false }} 
      />
      <Stack.Screen name="Chat" component={ChatScreen} />
    </Stack.Navigator>
  );
}