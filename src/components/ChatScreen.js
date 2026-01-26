import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Image, LogBox 
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { Audio } from 'expo-av';

// --- 🛠️ FIX FOR CRASH: Import from 'legacy' for new Expo versions ---
import * as FileSystem from 'expo-file-system/legacy'; 

// --- IGNORE WARNINGS ---
LogBox.ignoreLogs([
  'Expo AV has been deprecated',
  'Method readAsStringAsync',
]);

export default function ChatScreen({ route, navigation }) {
  const { roomId, roomName } = route.params || {};

  // Messages & Input State
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Audio State
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sound, setSound] = useState(null); 
  const [playingAudioId, setPlayingAudioId] = useState(null);

  // User Info
  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentUsername, setCurrentUsername] = useState('User');
  const [currentUserAvatar, setCurrentUserAvatar] = useState(null);

  // Edit / Typing Indicators
  const [editingMessage, setEditingMessage] = useState(null); 
  const [typingText, setTypingText] = useState(''); 
  const typingTimeoutRef = useRef(null); 
  const lastTypedTime = useRef(0); 
  const channelRef = useRef(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        const { data: profile } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        setCurrentUsername(profile?.username || user.email);
        setCurrentUserAvatar(profile?.avatar_url || null);
      }
    };
    fetchUser();

    if (!roomId) return;
    navigation.setOptions({ title: roomName || 'Chat' });
    fetchMessages();

    // Realtime Subscription
    channelRef.current = supabase.channel(`room:${roomId}`)
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'messages', filter: `room_id=eq.${roomId}` },
        (payload) => handleRealtimeEvent(payload)
      )
      .on('broadcast', { event: 'typing' }, (payload) => {
        if (payload.payload.userId !== currentUserId) {
          setTypingText(`${payload.payload.username} is typing...`);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setTypingText(''), 3000);
        }
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      if (sound) sound.unloadAsync();
    };
  }, [roomId, currentUserId]); 

  const handleRealtimeEvent = (payload) => {
    // Only process updates from OTHERS. 
    // If it's my own action, I already updated the UI instantly.
    
    if (payload.eventType === 'INSERT') {
       // Check if we already have this ID (to prevent duplicates from instant update)
       setMessages(prev => {
         if (prev.find(m => m.id === payload.new.id)) return prev;
         return [payload.new, ...prev];
       });
    }
    else if (payload.eventType === 'DELETE') {
       setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
    }
    else if (payload.eventType === 'UPDATE') {
       setMessages(prev => prev.map(msg => msg.id === payload.new.id ? payload.new : msg));
    }
  };

  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: false });
    if (!error) setMessages(data || []);
    setLoading(false);
  };

  const handleInputChange = (text) => {
    setInputText(text);
    const now = Date.now();
    if (now - lastTypedTime.current > 2000) {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'typing',
          payload: { username: currentUsername, userId: currentUserId }
        });
      }
      lastTypedTime.current = now;
    }
  };

  // --- 📸 IMAGE PICKER ---
  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: false,
      quality: 0.7,
      base64: true, 
    });

    if (!result.canceled && result.assets.length > 0) {
      uploadFile(result.assets[0], 'image');
    }
  };

  // --- 🎤 RECORDING FUNCTIONS ---
  const startRecording = async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return Alert.alert('Permission needed', 'Microphone access is required.');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      Alert.alert('Failed to start recording', err.message);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;
      
      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      
      const uri = recording.getURI(); 
      setRecording(null); 
      
      if (uri) {
        await uploadFile({ uri }, 'audio');
      }
    } catch (error) {
      console.log("Stop Recording Error:", error);
    }
  };

  // --- 🔊 PLAYBACK FUNCTIONS ---
  const playSound = async (audioUrl, messageId) => {
    try {
      if (sound) {
        await sound.unloadAsync();
        setPlayingAudioId(null);
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );
      setSound(newSound);
      setPlayingAudioId(messageId);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setPlayingAudioId(null);
        }
      });
    } catch (error) {
      Alert.alert("Playback Error", "Could not play audio");
    }
  };

  // --- 📤 UNIVERSAL UPLOADER ---
  const uploadFile = async (asset, type) => {
    try {
      setUploading(true);
      const fileName = `${Date.now()}_${currentUserId}.${type === 'image' ? 'jpg' : 'm4a'}`;
      const bucketName = type === 'image' ? 'chat-images' : 'chat-audio';

      let base64;

      if (type === 'image') {
        base64 = asset.base64;
      } else {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: 'base64', 
        });
      }

      if (!base64) throw new Error("Could not convert file to base64");

      const { error } = await supabase.storage
        .from(bucketName)
        .upload(fileName, decode(base64), { 
          contentType: type === 'image' ? 'image/jpeg' : 'audio/m4a' 
        });

      if (error) throw error;

      const { data: urlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);

      await sendMessage(
        null, 
        type === 'image' ? urlData.publicUrl : null, 
        type === 'audio' ? urlData.publicUrl : null
      );

    } catch (error) {
      console.log("Upload Error:", error);
      Alert.alert("Upload Failed", error.message);
    } finally {
      setUploading(false);
    }
  };

  // --- SEND MESSAGE TO DB ---
  const sendMessage = async (text, imageUrl, audioUrl) => {
    let content = text;
    if (!content) content = imageUrl ? '📷 Image' : (audioUrl ? '🎤 Voice Message' : '');

    const { error } = await supabase.from('messages').insert({
      room_id: roomId,
      content: content,
      image_url: imageUrl,
      audio_url: audioUrl,
      sender_id: currentUserId,
      sender_name: currentUsername,
      sender_avatar: currentUserAvatar
    });
    if (error) Alert.alert("Error", "Could not send message");
  };

  const handleSendOrUpdate = async () => {
    if (!inputText.trim()) return;
    const textToSend = inputText.trim();
    setInputText(''); 

    if (editingMessage) {
      // 🔥 1. INSTANTLY UPDATE UI (Optimistic)
      setMessages(prev => prev.map(msg => 
        msg.id === editingMessage.id ? { ...msg, content: textToSend } : msg
      ));
      
      const messageIdToEdit = editingMessage.id;
      setEditingMessage(null); // Close edit mode immediately

      // 🔥 2. SEND TO SERVER
      const { error } = await supabase
        .from('messages')
        .update({ content: textToSend })
        .eq('id', messageIdToEdit);
      
      if (error) Alert.alert("Error", "Failed to save edit");
    
    } else {
      await sendMessage(textToSend, null, null);
    }
  };

  // --- 🔥 LONG PRESS HANDLER (Edit/Delete) ---
  const handleLongPress = (item) => {
    if (item.sender_id !== currentUserId) return; 

    Alert.alert(
      "Message Options",
      "Choose an action",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Edit", 
          onPress: () => {
            if (item.image_url || item.audio_url) {
              Alert.alert("Cannot Edit", "You can only edit text messages.");
              return;
            }
            setInputText(item.content);
            setEditingMessage(item);
          } 
        },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            // 🔥 1. INSTANTLY REMOVE FROM UI (Optimistic Delete)
            setMessages(current => current.filter(m => m.id !== item.id));

            // 🔥 2. TELL SERVER TO DELETE
            const { error } = await supabase.from('messages').delete().eq('id', item.id);
            if (error) {
               Alert.alert("Error", "Could not delete message");
               // Optionally add it back if it failed, but usually not needed for chat
            }
          }
        }
      ]
    );
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender_id === currentUserId;
    const isPlaying = playingAudioId === item.id;
    const isImage = !!item.image_url; 
    const timeString = new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageRow, isMe ? styles.rowRight : styles.rowLeft]}>
        {!isMe && (
          <View style={styles.avatarContainer}>
             {item.sender_avatar ? (
              <Image source={{ uri: item.sender_avatar }} style={styles.smallAvatar} />
            ) : (
              <View style={styles.placeholderAvatar}>
                <Text style={styles.avatarText}>{item.sender_name?.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
        )}
        <View style={{ maxWidth: '80%' }}>
           {!isMe && <Text style={styles.senderName}>{item.sender_name}</Text>}
           
           <TouchableOpacity 
             onLongPress={() => handleLongPress(item)} 
             activeOpacity={0.8}
             style={[
               styles.bubble, 
               isMe ? styles.myBubble : styles.theirBubble,
               isImage && { backgroundColor: 'transparent', padding: 0 }
             ]}
           >
             
             {isImage && <Image source={{ uri: item.image_url }} style={styles.messageImage} />}
             
             {item.audio_url && (
                <TouchableOpacity style={styles.audioBubble} onPress={() => playSound(item.audio_url, item.id)}>
                   <Ionicons 
                     name={isPlaying ? "pause-circle" : "play-circle"} 
                     size={30} 
                     color={isMe ? "#fff" : "#007AFF"} 
                   />
                   <Text style={{ color: isMe ? '#fff' : '#000', marginLeft: 5 }}>
                     {isPlaying ? "Playing..." : "Voice Message"}
                   </Text>
                </TouchableOpacity>
             )}

             {(!item.image_url && !item.audio_url) && (
               <Text style={[styles.messageText, isMe ? styles.myText : styles.theirText]}>{item.content}</Text>
             )}

             <Text style={[
               styles.timeText, 
               (isMe && !isImage) ? styles.myTimeText : styles.theirTimeText
             ]}>
               {timeString}
             </Text>
           </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) return <ActivityIndicator size="large" style={styles.center} />;

  return (
    <View style={styles.container}>
      <FlatList 
        data={messages} 
        keyExtractor={i => i.id.toString()} 
        inverted 
        contentContainerStyle={styles.listContent} 
        renderItem={renderMessage} 
      />
      
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={90}>
        
        {editingMessage && (
          <View style={styles.editingContainer}>
            <Text style={styles.editingText}>Editing message...</Text>
            <TouchableOpacity onPress={() => { setEditingMessage(null); setInputText(''); }}>
              <Ionicons name="close-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}

        {typingText !== '' && <View style={styles.typingContainer}><Text style={styles.typingText}>{typingText}</Text></View>}
        
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={pickImage} style={styles.iconButton} disabled={uploading}>
             <Ionicons name="camera" size={24} color="#007AFF" />
          </TouchableOpacity>

          <TextInput 
            style={styles.input} 
            placeholder={editingMessage ? "Edit your message..." : "Type a message..."} 
            value={inputText} 
            onChangeText={handleInputChange} 
            multiline 
          />

          {inputText.trim() ? (
            <TouchableOpacity onPress={handleSendOrUpdate} style={styles.sendButton}>
               <Ionicons name={editingMessage ? "checkmark" : "send"} size={24} color="#fff" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
               onPress={isRecording ? stopRecording : startRecording} 
               style={[styles.micButton, isRecording && styles.recordingButton]}
            >
               <Ionicons name={isRecording ? "stop" : "mic"} size={24} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 15, paddingBottom: 20 },
  messageRow: { flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  avatarContainer: { marginRight: 8, marginBottom: 2 },
  smallAvatar: { width: 30, height: 30, borderRadius: 15 },
  placeholderAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#ccc', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  senderName: { fontSize: 12, color: '#666', marginBottom: 4, marginLeft: 4 },
  
  bubble: { padding: 12, borderRadius: 20 },
  myBubble: { backgroundColor: '#007AFF', borderBottomRightRadius: 2 },
  theirBubble: { backgroundColor: '#E5E5EA', borderBottomLeftRadius: 2 },
  
  messageText: { fontSize: 16 },
  myText: { color: '#fff' },
  theirText: { color: '#000' },
  
  messageImage: { 
    width: 200, 
    height: 300, 
    borderRadius: 15, 
    resizeMode: 'cover', 
    marginBottom: 5 
  },
  
  audioBubble: { flexDirection: 'row', alignItems: 'center', padding: 5, width: 150 },
  
  timeText: { fontSize: 10, marginTop: 5, textAlign: 'right' },
  myTimeText: { color: 'rgba(255, 255, 255, 0.7)' },
  theirTimeText: { color: 'rgba(0, 0, 0, 0.4)' },
  
  inputContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#fff', alignItems: 'center', borderTopWidth: 1, borderColor: '#eee' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 10, fontSize: 16, maxHeight: 100, marginRight: 10 },
  iconButton: { marginRight: 10, padding: 5 },
  sendButton: { backgroundColor: '#007AFF', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  micButton: { backgroundColor: '#34C759', width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center' },
  recordingButton: { backgroundColor: '#FF3B30' },
  typingContainer: { paddingHorizontal: 20, paddingBottom: 5, backgroundColor: '#f5f5f5' },
  typingText: { fontSize: 12, color: '#888', fontStyle: 'italic' },
  
  editingContainer: { 
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', 
    backgroundColor: '#FFF8E1', padding: 10, borderTopWidth: 1, borderColor: '#eee' 
  },
  editingText: { color: '#F57C00', fontWeight: 'bold' }
});