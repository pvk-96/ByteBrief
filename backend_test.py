#!/usr/bin/env python3
"""
BitBrief RSS Feed Backend API Testing Suite
Tests all RSS feed management, parsing, and article retrieval endpoints
"""

import requests
import json
import time
from datetime import datetime
from typing import Dict, List, Any

# Configuration
BACKEND_URL = "https://feedzen.preview.emergentagent.com/api"
TIMEOUT = 30

class BitBriefAPITester:
    def __init__(self):
        self.session = requests.Session()
        self.session.timeout = TIMEOUT
        self.test_results = []
        
    def log_test(self, test_name: str, success: bool, details: str = "", response_data: Any = None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "details": details,
            "timestamp": datetime.now().isoformat(),
            "response_data": response_data
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        
    def test_api_health(self):
        """Test basic API connectivity"""
        try:
            response = self.session.get(f"{BACKEND_URL}/")
            if response.status_code == 200:
                data = response.json()
                if "BitBrief RSS Reader API" in data.get("message", ""):
                    self.log_test("API Health Check", True, "API is responding correctly")
                    return True
                else:
                    self.log_test("API Health Check", False, f"Unexpected response: {data}")
                    return False
            else:
                self.log_test("API Health Check", False, f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("API Health Check", False, f"Connection error: {str(e)}")
            return False
    
    def test_setup_default_feeds(self):
        """Test setting up default RSS feeds"""
        try:
            response = self.session.post(f"{BACKEND_URL}/feeds/setup-defaults")
            if response.status_code == 200:
                data = response.json()
                feeds_added = len(data.get("feeds", []))
                self.log_test("Setup Default Feeds", True, 
                            f"Successfully added {feeds_added} default feeds", data)
                return True
            else:
                self.log_test("Setup Default Feeds", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Setup Default Feeds", False, f"Error: {str(e)}")
            return False
    
    def test_get_feeds(self):
        """Test retrieving all feeds"""
        try:
            response = self.session.get(f"{BACKEND_URL}/feeds")
            if response.status_code == 200:
                feeds = response.json()
                if isinstance(feeds, list):
                    self.log_test("Get All Feeds", True, 
                                f"Retrieved {len(feeds)} feeds", {"count": len(feeds)})
                    return feeds
                else:
                    self.log_test("Get All Feeds", False, "Response is not a list")
                    return []
            else:
                self.log_test("Get All Feeds", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return []
        except Exception as e:
            self.log_test("Get All Feeds", False, f"Error: {str(e)}")
            return []
    
    def test_get_feeds_by_category(self):
        """Test retrieving feeds filtered by category"""
        categories = ["Technology", "Sports", "News", "Entertainment", "Science"]
        
        for category in categories:
            try:
                response = self.session.get(f"{BACKEND_URL}/feeds?category={category}")
                if response.status_code == 200:
                    feeds = response.json()
                    if isinstance(feeds, list):
                        category_feeds = [f for f in feeds if f.get("category") == category]
                        if len(category_feeds) == len(feeds):
                            self.log_test(f"Get {category} Feeds", True, 
                                        f"Retrieved {len(feeds)} {category} feeds")
                        else:
                            self.log_test(f"Get {category} Feeds", False, 
                                        "Some feeds don't match category filter")
                    else:
                        self.log_test(f"Get {category} Feeds", False, "Response is not a list")
                else:
                    self.log_test(f"Get {category} Feeds", False, 
                                f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_test(f"Get {category} Feeds", False, f"Error: {str(e)}")
    
    def test_add_custom_feed(self):
        """Test adding a custom RSS feed"""
        test_feed = {
            "title": "Test RSS Feed",
            "url": "https://rss.cnn.com/rss/edition.rss",
            "category": "News",
            "subcategory": "Test News",
            "description": "Test feed for API validation"
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/feeds", json=test_feed)
            if response.status_code == 200:
                feed_data = response.json()
                if feed_data.get("url") == test_feed["url"]:
                    self.log_test("Add Custom Feed", True, 
                                f"Successfully added feed: {feed_data.get('title')}", feed_data)
                    return feed_data.get("id")
                else:
                    self.log_test("Add Custom Feed", False, "Feed data mismatch")
                    return None
            else:
                # Check if it's a duplicate feed error (which is acceptable)
                if "already exists" in response.text:
                    self.log_test("Add Custom Feed", True, 
                                "Feed already exists (acceptable)", {"status": "duplicate"})
                    return "existing"
                else:
                    self.log_test("Add Custom Feed", False, 
                                f"HTTP {response.status_code}: {response.text}")
                    return None
        except Exception as e:
            self.log_test("Add Custom Feed", False, f"Error: {str(e)}")
            return None
    
    def test_refresh_specific_feed(self, feed_id: str):
        """Test refreshing a specific feed"""
        if not feed_id or feed_id == "existing":
            self.log_test("Refresh Specific Feed", False, "No valid feed ID provided")
            return
            
        try:
            response = self.session.post(f"{BACKEND_URL}/feeds/refresh/{feed_id}")
            if response.status_code == 200:
                data = response.json()
                articles_added = data.get("articles_added", 0)
                self.log_test("Refresh Specific Feed", True, 
                            f"Refreshed feed, added {articles_added} articles", data)
            else:
                self.log_test("Refresh Specific Feed", False, 
                            f"HTTP {response.status_code}: {response.text}")
        except Exception as e:
            self.log_test("Refresh Specific Feed", False, f"Error: {str(e)}")
    
    def test_refresh_all_feeds(self):
        """Test refreshing all feeds"""
        try:
            response = self.session.post(f"{BACKEND_URL}/feeds/refresh-all")
            if response.status_code == 200:
                data = response.json()
                results = data.get("results", [])
                successful = len([r for r in results if r.get("status") == "success"])
                total = len(results)
                self.log_test("Refresh All Feeds", True, 
                            f"Refreshed {successful}/{total} feeds successfully", 
                            {"successful": successful, "total": total})
                return True
            else:
                self.log_test("Refresh All Feeds", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Refresh All Feeds", False, f"Error: {str(e)}")
            return False
    
    def test_get_articles(self):
        """Test retrieving articles"""
        try:
            response = self.session.get(f"{BACKEND_URL}/articles?limit=20")
            if response.status_code == 200:
                articles = response.json()
                if isinstance(articles, list):
                    self.log_test("Get Articles", True, 
                                f"Retrieved {len(articles)} articles", {"count": len(articles)})
                    return articles
                else:
                    self.log_test("Get Articles", False, "Response is not a list")
                    return []
            else:
                self.log_test("Get Articles", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return []
        except Exception as e:
            self.log_test("Get Articles", False, f"Error: {str(e)}")
            return []
    
    def test_get_articles_by_category(self):
        """Test retrieving articles filtered by category"""
        categories = ["Technology", "Sports", "News"]
        
        for category in categories:
            try:
                response = self.session.get(f"{BACKEND_URL}/articles?category={category}&limit=10")
                if response.status_code == 200:
                    articles = response.json()
                    if isinstance(articles, list):
                        category_articles = [a for a in articles if a.get("category") == category]
                        if len(category_articles) == len(articles):
                            self.log_test(f"Get {category} Articles", True, 
                                        f"Retrieved {len(articles)} {category} articles")
                        else:
                            self.log_test(f"Get {category} Articles", False, 
                                        "Some articles don't match category filter")
                    else:
                        self.log_test(f"Get {category} Articles", False, "Response is not a list")
                else:
                    self.log_test(f"Get {category} Articles", False, 
                                f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_test(f"Get {category} Articles", False, f"Error: {str(e)}")
    
    def test_search_articles(self):
        """Test searching articles"""
        search_terms = ["technology", "sports", "news"]
        
        for term in search_terms:
            try:
                response = self.session.get(f"{BACKEND_URL}/articles?search={term}&limit=5")
                if response.status_code == 200:
                    articles = response.json()
                    if isinstance(articles, list):
                        self.log_test(f"Search Articles '{term}'", True, 
                                    f"Found {len(articles)} articles matching '{term}'")
                    else:
                        self.log_test(f"Search Articles '{term}'", False, "Response is not a list")
                else:
                    self.log_test(f"Search Articles '{term}'", False, 
                                f"HTTP {response.status_code}: {response.text}")
            except Exception as e:
                self.log_test(f"Search Articles '{term}'", False, f"Error: {str(e)}")
    
    def test_get_categories(self):
        """Test retrieving available categories"""
        try:
            response = self.session.get(f"{BACKEND_URL}/categories")
            if response.status_code == 200:
                data = response.json()
                categories = data.get("categories", {})
                if isinstance(categories, dict) and len(categories) > 0:
                    category_count = len(categories)
                    subcategory_count = sum(len(subs) for subs in categories.values())
                    self.log_test("Get Categories", True, 
                                f"Retrieved {category_count} categories with {subcategory_count} subcategories", 
                                categories)
                    return True
                else:
                    self.log_test("Get Categories", False, "Invalid categories structure")
                    return False
            else:
                self.log_test("Get Categories", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get Categories", False, f"Error: {str(e)}")
            return False
    
    def test_user_interests(self):
        """Test user interests functionality"""
        # Test saving interests
        test_interests = {
            "categories": ["Technology", "Science"],
            "subcategories": ["AI", "Space", "Gadgets"]
        }
        
        try:
            response = self.session.post(f"{BACKEND_URL}/user/interests", 
                                       params={"categories": test_interests["categories"], 
                                              "subcategories": test_interests["subcategories"]})
            if response.status_code == 200:
                self.log_test("Save User Interests", True, "Successfully saved user interests")
            else:
                self.log_test("Save User Interests", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Save User Interests", False, f"Error: {str(e)}")
            return False
        
        # Test retrieving interests
        try:
            response = self.session.get(f"{BACKEND_URL}/user/interests")
            if response.status_code == 200:
                interests = response.json()
                if isinstance(interests, dict):
                    self.log_test("Get User Interests", True, 
                                f"Retrieved user interests", interests)
                    return True
                else:
                    self.log_test("Get User Interests", False, "Invalid interests structure")
                    return False
            else:
                self.log_test("Get User Interests", False, 
                            f"HTTP {response.status_code}: {response.text}")
                return False
        except Exception as e:
            self.log_test("Get User Interests", False, f"Error: {str(e)}")
            return False
    
    def run_all_tests(self):
        """Run comprehensive test suite"""
        print("🚀 Starting BitBrief RSS Feed Backend API Tests")
        print(f"🔗 Testing against: {BACKEND_URL}")
        print("=" * 60)
        
        # Basic connectivity
        if not self.test_api_health():
            print("❌ API is not accessible. Stopping tests.")
            return False
        
        # Setup default feeds
        self.test_setup_default_feeds()
        
        # Wait a moment for setup to complete
        time.sleep(2)
        
        # Test feed management
        feeds = self.test_get_feeds()
        self.test_get_feeds_by_category()
        
        # Test adding custom feed
        custom_feed_id = self.test_add_custom_feed()
        
        # Test feed refresh
        if custom_feed_id and custom_feed_id != "existing":
            self.test_refresh_specific_feed(custom_feed_id)
        
        # Test refresh all feeds
        refresh_success = self.test_refresh_all_feeds()
        
        # Wait for articles to be processed
        if refresh_success:
            print("⏳ Waiting for articles to be processed...")
            time.sleep(5)
        
        # Test article retrieval
        articles = self.test_get_articles()
        self.test_get_articles_by_category()
        self.test_search_articles()
        
        # Test categories
        self.test_get_categories()
        
        # Test user interests
        self.test_user_interests()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = len([t for t in self.test_results if t["success"]])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"✅ Passed: {passed_tests}")
        print(f"❌ Failed: {failed_tests}")
        print(f"Success Rate: {(passed_tests/total_tests)*100:.1f}%")
        
        if failed_tests > 0:
            print("\n🔍 FAILED TESTS:")
            for test in self.test_results:
                if not test["success"]:
                    print(f"  ❌ {test['test']}: {test['details']}")
        
        return failed_tests == 0

if __name__ == "__main__":
    tester = BitBriefAPITester()
    success = tester.run_all_tests()
    
    if success:
        print("\n🎉 All tests passed! BitBrief RSS API is working correctly.")
    else:
        print("\n⚠️  Some tests failed. Check the details above.")