import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

// BitBrief Color Scheme
const COLORS = {
  darkNavy: '#0B132B',
  navy: '#1C2541', 
  steelBlue: '#3A506B',
  turquoise: '#5BC0BE',
  lightAqua: '#6FFFE9',
  white: '#FFFFFF',
  gray: '#8E9AAF',
  lightGray: '#F5F5F5',
  error: '#FF4757',
  success: '#2ED573',
};

interface Feed {
  id: string;
  title: string;
  url: string;
  category: string;
  subcategory?: string;
  description?: string;
  last_updated: string;
  is_active: boolean;
  error_count: number;
}

export default function ManageFeeds() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingFeed, setAddingFeed] = useState(false);
  
  // Form state
  const [feedTitle, setFeedTitle] = useState('');
  const [feedUrl, setFeedUrl] = useState('');
  const [feedCategory, setFeedCategory] = useState('Technology');
  const [feedSubcategory, setFeedSubcategory] = useState('');
  const [feedDescription, setFeedDescription] = useState('');

  const categories = {
    'Technology': ['Startups', 'Gadgets', 'Software Dev', 'AI', 'Cybersecurity'],
    'Sports': ['Football', 'Cricket', 'F1', 'E-Sports', 'General Sports'],
    'News': ['World News', 'Politics', 'Business', 'Local News', 'Breaking News'],
    'Entertainment': ['Movies', 'Music', 'TV Shows', 'Celebrity News', 'Pop Culture'],
    'Science': ['Space', 'Health', 'Environment', 'Psychology', 'General Science']
  };

  useEffect(() => {
    loadFeeds();
  }, []);

  const loadFeeds = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/feeds`);
      if (response.ok) {
        const feedData = await response.json();
        setFeeds(feedData);
      }
    } catch (error) {
      console.error('Error loading feeds:', error);
      Alert.alert('Error', 'Failed to load feeds');
    } finally {
      setLoading(false);
    }
  };

  const validateFeedUrl = (url: string): boolean => {
    // Basic URL validation
    const urlPattern = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
    if (!urlPattern.test(url)) return false;
    
    // Check for common RSS patterns
    const rssPatterns = [
      /.*\.xml$/i,
      /.*rss.*/i,
      /.*feed.*/i,
      /.*atom.*/i
    ];
    
    return rssPatterns.some(pattern => pattern.test(url));
  };

  const addFeed = async () => {
    if (!feedTitle.trim()) {
      Alert.alert('Error', 'Please enter a feed title');
      return;
    }

    if (!feedUrl.trim()) {
      Alert.alert('Error', 'Please enter a feed URL');
      return;
    }

    if (!validateFeedUrl(feedUrl)) {
      Alert.alert('Error', 'Please enter a valid RSS feed URL (should contain .xml, rss, feed, or atom)');
      return;
    }

    try {
      setAddingFeed(true);
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/feeds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: feedTitle.trim(),
          url: feedUrl.trim(),
          category: feedCategory,
          subcategory: feedSubcategory || undefined,
          description: feedDescription.trim() || undefined,
        }),
      });

      if (response.ok) {
        const newFeed = await response.json();
        setFeeds([newFeed, ...feeds]);
        
        // Reset form
        setFeedTitle('');
        setFeedUrl('');
        setFeedCategory('Technology');
        setFeedSubcategory('');
        setFeedDescription('');
        setShowAddModal(false);
        
        Alert.alert('Success', 'RSS feed added successfully!');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to add RSS feed');
      }
    } catch (error) {
      console.error('Error adding feed:', error);
      Alert.alert('Error', 'Failed to add RSS feed. Please check your connection.');
    } finally {
      setAddingFeed(false);
    }
  };

  const deleteFeed = async (feedId: string, feedTitle: string) => {
    Alert.alert(
      'Delete Feed',
      `Are you sure you want to delete "${feedTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/feeds/${feedId}`, {
                method: 'DELETE',
              });

              if (response.ok) {
                setFeeds(feeds.filter(feed => feed.id !== feedId));
                Alert.alert('Success', 'Feed deleted successfully');
              } else {
                Alert.alert('Error', 'Failed to delete feed');
              }
            } catch (error) {
              console.error('Error deleting feed:', error);
              Alert.alert('Error', 'Failed to delete feed');
            }
          },
        },
      ]
    );
  };

  const refreshFeed = async (feedId: string, feedTitle: string) => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/feeds/refresh/${feedId}`, {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        Alert.alert('Success', `${feedTitle}: ${result.message}`);
        loadFeeds(); // Reload to get updated timestamp
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.detail || 'Failed to refresh feed');
      }
    } catch (error) {
      console.error('Error refreshing feed:', error);
      Alert.alert('Error', 'Failed to refresh feed');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCategoryColor = (category: string) => {
    const colorMap: { [key: string]: string } = {
      'Technology': COLORS.turquoise,
      'Sports': COLORS.lightAqua,
      'News': COLORS.steelBlue,
      'Entertainment': '#FF6B9D',
      'Science': '#4ECDC4',
    };
    return colorMap[category] || COLORS.gray;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.turquoise} />
          <Text style={styles.loadingText}>Loading Feeds...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.lightAqua} />
        </TouchableOpacity>
        <Text style={styles.title}>Manage Feeds</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
          <Ionicons name="add" size={24} color={COLORS.lightAqua} />
        </TouchableOpacity>
      </View>

      {/* Feeds List */}
      <ScrollView style={styles.feedsList}>
        {feeds.map((feed) => (
          <View key={feed.id} style={styles.feedCard}>
            <View style={styles.feedHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(feed.category) }]}>
                <Text style={styles.categoryBadgeText}>{feed.subcategory || feed.category}</Text>
              </View>
              <Text style={styles.feedDate}>Updated: {formatDate(feed.last_updated)}</Text>
            </View>
            
            <Text style={styles.feedTitle} numberOfLines={1}>{feed.title}</Text>
            <Text style={styles.feedUrl} numberOfLines={1}>{feed.url}</Text>
            
            {feed.description && (
              <Text style={styles.feedDescription} numberOfLines={2}>{feed.description}</Text>
            )}

            {/* Status Indicators */}
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: feed.is_active ? COLORS.success : COLORS.error }]}>
                <Text style={styles.statusText}>{feed.is_active ? 'Active' : 'Inactive'}</Text>
              </View>
              {feed.error_count > 0 && (
                <View style={[styles.statusBadge, { backgroundColor: COLORS.error }]}>
                  <Text style={styles.statusText}>{feed.error_count} errors</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity 
                onPress={() => refreshFeed(feed.id, feed.title)}
                style={[styles.actionButton, styles.refreshButton]}
              >
                <Ionicons name="refresh" size={16} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Refresh</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                onPress={() => deleteFeed(feed.id, feed.title)}
                style={[styles.actionButton, styles.deleteButton]}
              >
                <Ionicons name="trash" size={16} color={COLORS.white} />
                <Text style={styles.actionButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {feeds.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="rss-outline" size={64} color={COLORS.gray} />
            <Text style={styles.emptyText}>No RSS feeds yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add your first feed</Text>
          </View>
        )}
      </ScrollView>

      {/* Add Feed Modal */}
      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoidingView}
          >
            <StatusBar style="light" />
            
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Text style={styles.cancelButton}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Add RSS Feed</Text>
              <TouchableOpacity onPress={addFeed} disabled={addingFeed}>
                <Text style={[styles.saveButton, addingFeed && styles.disabledButton]}>
                  {addingFeed ? 'Adding...' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              {/* Feed Title */}
              <Text style={styles.label}>Feed Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g., TechCrunch"
                placeholderTextColor={COLORS.gray}
                value={feedTitle}
                onChangeText={setFeedTitle}
                returnKeyType="next"
              />

              {/* Feed URL */}
              <Text style={styles.label}>RSS Feed URL *</Text>
              <TextInput
                style={styles.input}
                placeholder="https://example.com/rss.xml"
                placeholderTextColor={COLORS.gray}
                value={feedUrl}
                onChangeText={setFeedUrl}
                keyboardType="url"
                autoCapitalize="none"
                returnKeyType="next"
              />

              {/* Category */}
              <Text style={styles.label}>Category *</Text>
              <View style={styles.categorySelector}>
                {Object.keys(categories).map((category) => (
                  <TouchableOpacity
                    key={category}
                    style={[
                      styles.categoryOption,
                      feedCategory === category && styles.selectedCategory
                    ]}
                    onPress={() => {
                      setFeedCategory(category);
                      setFeedSubcategory(''); // Reset subcategory
                    }}
                  >
                    <Text style={[
                      styles.categoryOptionText,
                      feedCategory === category && styles.selectedCategoryText
                    ]}>
                      {category}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Subcategory */}
              {feedCategory && (
                <>
                  <Text style={styles.label}>Subcategory</Text>
                  <View style={styles.subcategorySelector}>
                    {categories[feedCategory as keyof typeof categories].map((subcategory) => (
                      <TouchableOpacity
                        key={subcategory}
                        style={[
                          styles.subcategoryOption,
                          feedSubcategory === subcategory && styles.selectedSubcategory
                        ]}
                        onPress={() => setFeedSubcategory(feedSubcategory === subcategory ? '' : subcategory)}
                      >
                        <Text style={[
                          styles.subcategoryOptionText,
                          feedSubcategory === subcategory && styles.selectedSubcategoryText
                        ]}>
                          {subcategory}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Description */}
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.descriptionInput]}
                placeholder="Optional description..."
                placeholderTextColor={COLORS.gray}
                value={feedDescription}
                onChangeText={setFeedDescription}
                multiline
                numberOfLines={3}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
              />

              {/* URL Validation Hint */}
              <Text style={styles.hint}>
                💡 RSS URLs typically contain: .xml, /rss, /feed, or /atom
              </Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.darkNavy,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.lightAqua,
    fontSize: 16,
    marginTop: 16,
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navy,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.lightAqua,
  },
  addButton: {
    padding: 4,
  },
  feedsList: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  feedCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.steelBlue,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: 120,
  },
  categoryBadgeText: {
    color: COLORS.darkNavy,
    fontSize: 12,
    fontWeight: 'bold',
  },
  feedDate: {
    color: COLORS.gray,
    fontSize: 12,
  },
  feedTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  feedUrl: {
    color: COLORS.turquoise,
    fontSize: 12,
    marginBottom: 8,
  },
  feedDescription: {
    color: COLORS.gray,
    fontSize: 14,
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '500',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 100,
    justifyContent: 'center',
  },
  refreshButton: {
    backgroundColor: COLORS.turquoise,
  },
  deleteButton: {
    backgroundColor: COLORS.error,
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    color: COLORS.gray,
    fontSize: 18,
    fontWeight: '500',
    marginTop: 16,
  },
  emptySubtext: {
    color: COLORS.gray,
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.darkNavy,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.navy,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.lightAqua,
  },
  cancelButton: {
    color: COLORS.gray,
    fontSize: 16,
  },
  saveButton: {
    color: COLORS.turquoise,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    color: COLORS.gray,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  label: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.navy,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.white,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.steelBlue,
  },
  descriptionInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  categorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.navy,
    marginRight: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.steelBlue,
  },
  selectedCategory: {
    backgroundColor: COLORS.turquoise,
    borderColor: COLORS.turquoise,
  },
  categoryOptionText: {
    color: COLORS.gray,
    fontSize: 14,
  },
  selectedCategoryText: {
    color: COLORS.darkNavy,
    fontWeight: 'bold',
  },
  subcategorySelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  subcategoryOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.steelBlue,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedSubcategory: {
    backgroundColor: COLORS.lightAqua,
  },
  subcategoryOptionText: {
    color: COLORS.white,
    fontSize: 12,
  },
  selectedSubcategoryText: {
    color: COLORS.darkNavy,
    fontWeight: 'bold',
  },
  hint: {
    color: COLORS.gray,
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 20,
  },
});