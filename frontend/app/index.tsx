import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

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
};

interface Feed {
  id: string;
  title: string;
  url: string;
  category: string;
  subcategory?: string;
  last_updated: string;
  is_active: boolean;
}

interface Article {
  id: string;
  title: string;
  link: string;
  description?: string;
  published: string;
  category: string;
  subcategory?: string;
  author?: string;
}

export default function BitBriefHome() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories = ['All', 'Technology', 'Sports', 'News', 'Entertainment', 'Science'];

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // First setup default feeds if needed
      await setupDefaultFeeds();
      // Then load feeds and articles
      await loadFeeds();
      await loadArticles();
    } catch (error) {
      console.error('Error initializing app:', error);
      Alert.alert('Error', 'Failed to initialize the app. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const setupDefaultFeeds = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/feeds/setup-defaults`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Default feeds setup:', result.message);
      }
    } catch (error) {
      console.error('Error setting up default feeds:', error);
    }
  };

  const loadFeeds = async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/feeds`);
      if (response.ok) {
        const feedData = await response.json();
        setFeeds(feedData);
      }
    } catch (error) {
      console.error('Error loading feeds:', error);
    }
  };

  const loadArticles = async (category?: string) => {
    try {
      let url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/api/articles?limit=20`;
      if (category && category !== 'All') {
        url += `&category=${category}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const articleData = await response.json();
        setArticles(articleData);
      }
    } catch (error) {
      console.error('Error loading articles:', error);
    }
  };

  const refreshAllFeeds = async () => {
    try {
      setRefreshing(true);
      
      const response = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/feeds/refresh-all`, {
        method: 'POST',
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Feeds refreshed:', result);
        
        // Reload articles after refresh
        await loadArticles(selectedCategory === 'All' ? undefined : selectedCategory);
        
        Alert.alert('Success', 'All feeds refreshed successfully!');
      } else {
        throw new Error('Failed to refresh feeds');
      }
    } catch (error) {
      console.error('Error refreshing feeds:', error);
      Alert.alert('Error', 'Failed to refresh feeds. Please try again.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCategorySelect = async (category: string) => {
    setSelectedCategory(category);
    setLoading(true);
    await loadArticles(category === 'All' ? undefined : category);
    setLoading(false);
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

  if (loading && articles.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.turquoise} />
          <Text style={styles.loadingText}>Loading BitBrief...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>BitBrief</Text>
        <TouchableOpacity onPress={refreshAllFeeds} disabled={refreshing}>
          <Ionicons 
            name={refreshing ? "sync" : "refresh-outline"} 
            size={24} 
            color={COLORS.lightAqua} 
            style={refreshing ? { transform: [{ rotate: '180deg' }] } : {}}
          />
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        style={styles.categoryContainer}
        contentContainerStyle={styles.categoryContent}
      >
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.categoryButton,
              selectedCategory === category && styles.categoryButtonActive
            ]}
            onPress={() => handleCategorySelect(category)}
          >
            <Text
              style={[
                styles.categoryText,
                selectedCategory === category && styles.categoryTextActive
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Feed Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{feeds.length}</Text>
          <Text style={styles.statLabel}>Feeds</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{articles.length}</Text>
          <Text style={styles.statLabel}>Articles</Text>
        </View>
      </View>

      {/* Articles List */}
      <ScrollView
        style={styles.articlesList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAllFeeds}
            colors={[COLORS.turquoise]}
            tintColor={COLORS.turquoise}
          />
        }
      >
        {articles.map((article) => (
          <TouchableOpacity key={article.id} style={styles.articleCard}>
            <View style={styles.articleHeader}>
              <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(article.category) }]}>
                <Text style={styles.categoryBadgeText}>{article.subcategory || article.category}</Text>
              </View>
              <Text style={styles.articleDate}>{formatDate(article.published)}</Text>
            </View>
            
            <Text style={styles.articleTitle} numberOfLines={2}>
              {article.title}
            </Text>
            
            {article.description && (
              <Text style={styles.articleDescription} numberOfLines={3}>
                {article.description}
              </Text>
            )}
            
            {article.author && (
              <Text style={styles.articleAuthor}>By {article.author}</Text>
            )}
          </TouchableOpacity>
        ))}
        
        {articles.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={COLORS.gray} />
            <Text style={styles.emptyText}>No articles found</Text>
            <Text style={styles.emptySubtext}>Pull down to refresh feeds</Text>
          </View>
        )}
      </ScrollView>
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.lightAqua,
  },
  categoryContainer: {
    maxHeight: 60,
  },
  categoryContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: COLORS.navy,
    minWidth: 80,
    alignItems: 'center',
  },
  categoryButtonActive: {
    backgroundColor: COLORS.turquoise,
  },
  categoryText: {
    color: COLORS.gray,
    fontSize: 14,
    fontWeight: '500',
  },
  categoryTextActive: {
    color: COLORS.darkNavy,
    fontWeight: 'bold',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 16,
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.turquoise,
  },
  statLabel: {
    fontSize: 14,
    color: COLORS.gray,
    marginTop: 4,
  },
  articlesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  articleCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.steelBlue,
  },
  articleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    maxWidth: width * 0.3,
  },
  categoryBadgeText: {
    color: COLORS.darkNavy,
    fontSize: 12,
    fontWeight: 'bold',
  },
  articleDate: {
    color: COLORS.gray,
    fontSize: 12,
  },
  articleTitle: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 22,
    marginBottom: 8,
  },
  articleDescription: {
    color: COLORS.gray,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  articleAuthor: {
    color: COLORS.turquoise,
    fontSize: 12,
    fontStyle: 'italic',
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
  },
});