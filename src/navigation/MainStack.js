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

// 👇 THIS IS THE FIX: Point to 'components', not 'screens'
import ChatScreen from '../components/ChatScreen'; 

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// --- LOGOUT BUTTON ---
const LogoutButton = () => {
  const handleLogout = async () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Log Out', 
        style: 'destructive', 
        onPress: async () => {
            const { error } = await supabase.auth.signOut();
            if (error) console.log("Error:", error.message);
        }
      }
    ]);
  };
  return (
    <TouchableOpacity onPress={handleLogout} style={{ marginRight: 15 }}>
      <Text style={{ color: '#ff3b30', fontWeight: 'bold' }}>Log Out</Text>
    </TouchableOpacity>
  );
};

// 1. BOTTOM TABS
function BottomTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <LogoutButton />,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Groups') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'Contacts') iconName = focused ? 'people' : 'people-outline';
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Groups" component={GroupsScreen} />
      <Tab.Screen name="Contacts" component={ContactsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// 2. MAIN STACK
export default function MainStack() {
  return (
    <Stack.Navigator>
      
      {/* Home (Tabs) */}
      <Stack.Screen 
        name="Home" 
        component={BottomTabs} 
        options={{ headerShown: false }} 
      />
      
      {/* Chat Screen */}
      <Stack.Screen 
        name="ChatScreen" 
        component={ChatScreen} 
        options={({ route }) => ({ 
          title: route.params?.roomName || 'Chat' 
        })}
      />

    </Stack.Navigator>
  );
}