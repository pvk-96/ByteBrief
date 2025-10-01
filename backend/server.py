from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import feedparser
import aiohttp
import asyncio
from urllib.parse import urlparse
import re

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# RSS Feed Models
class RSSFeed(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    url: str
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    last_updated: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    is_active: bool = True
    error_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class RSSFeedCreate(BaseModel):
    title: str
    url: str
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None

class Article(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    feed_id: str
    title: str
    link: str
    description: Optional[str] = None
    published: datetime
    author: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserInterest(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str = "default"  # For now, single user
    categories: List[str] = []
    subcategories: List[str] = []
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Utility functions
def clean_html(text: str) -> str:
    """Remove HTML tags and clean text"""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.compile('<.*?>')
    text = re.sub(clean, '', text)
    # Remove extra whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def validate_rss_url(url: str) -> bool:
    """Validate if URL looks like a valid RSS feed URL"""
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.netloc:
        return False
    
    # Check for common RSS patterns
    rss_patterns = [
        r'.*\.xml$',
        r'.*rss.*',
        r'.*feed.*',
        r'.*atom.*'
    ]
    
    return any(re.search(pattern, url.lower()) for pattern in rss_patterns)

async def fetch_feed(url: str) -> Dict[str, Any]:
    """Fetch and parse RSS feed"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as response:
                if response.status != 200:
                    raise HTTPException(status_code=400, detail=f"Failed to fetch feed: HTTP {response.status}")
                
                content = await response.text()
                feed = feedparser.parse(content)
                
                if feed.bozo and not feed.entries:
                    raise HTTPException(status_code=400, detail="Invalid RSS feed format")
                
                return feed
    except aiohttp.ClientError as e:
        raise HTTPException(status_code=400, detail=f"Network error fetching feed: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error parsing feed: {str(e)}")

# Default feeds data
DEFAULT_FEEDS = {
    "Technology": [
        {"title": "TechCrunch", "url": "https://techcrunch.com/feed/", "subcategory": "Startups"},
        {"title": "The Verge", "url": "https://www.theverge.com/rss/index.xml", "subcategory": "Gadgets"},
        {"title": "Ars Technica", "url": "http://feeds.arstechnica.com/arstechnica/index", "subcategory": "Software Dev"},
        {"title": "MIT Technology Review", "url": "https://www.technologyreview.com/feed/", "subcategory": "AI"},
        {"title": "Krebs on Security", "url": "https://krebsonsecurity.com/feed/", "subcategory": "Cybersecurity"}
    ],
    "Sports": [
        {"title": "BBC Sport Football", "url": "https://feeds.bbci.co.uk/sport/football/rss.xml", "subcategory": "Football"},
        {"title": "ESPN Cricket", "url": "https://www.espn.com/espn/rss/cricket/news", "subcategory": "Cricket"},
        {"title": "Formula 1", "url": "https://www.formula1.com/content/fom-website/en/latest.rss.xml", "subcategory": "F1"},
        {"title": "Dexerto E-Sports", "url": "https://www.dexerto.com/feed/", "subcategory": "E-Sports"},
        {"title": "ESPN Sports", "url": "https://www.espn.com/espn/rss/news", "subcategory": "General Sports"}
    ],
    "News": [
        {"title": "BBC News", "url": "https://feeds.bbci.co.uk/news/rss.xml", "subcategory": "World News"},
        {"title": "CNN Top Stories", "url": "http://rss.cnn.com/rss/edition.rss", "subcategory": "Breaking News"},
        {"title": "Reuters Business", "url": "http://feeds.reuters.com/reuters/businessNews", "subcategory": "Business"},
        {"title": "NPR News", "url": "https://feeds.npr.org/1001/rss.xml", "subcategory": "Local News"},
        {"title": "Politico", "url": "https://www.politico.com/rss/politics08.xml", "subcategory": "Politics"}
    ],
    "Entertainment": [
        {"title": "Variety Movies", "url": "https://variety.com/feed/", "subcategory": "Movies"},
        {"title": "Rolling Stone Music", "url": "https://www.rollingstone.com/music/music-news/feed/", "subcategory": "Music"},
        {"title": "Hollywood Reporter TV", "url": "https://www.hollywoodreporter.com/tv/tv-news/rss", "subcategory": "TV Shows"},
        {"title": "E! Online", "url": "https://www.eonline.com/syndication/feeds/rssfeeds/topstories.xml", "subcategory": "Celebrity News"},
        {"title": "BuzzFeed Entertainment", "url": "https://www.buzzfeed.com/entertainment.xml", "subcategory": "Pop Culture"}
    ],
    "Science": [
        {"title": "NASA Breaking News", "url": "https://www.nasa.gov/rss/dyn/breaking_news.rss", "subcategory": "Space"},
        {"title": "Science Daily Health", "url": "https://www.sciencedaily.com/rss/health_medicine.xml", "subcategory": "Health"},
        {"title": "National Geographic Environment", "url": "https://www.nationalgeographic.com/environment/rss", "subcategory": "Environment"},
        {"title": "Psychology Today", "url": "https://www.psychologytoday.com/us/rss", "subcategory": "Psychology"},
        {"title": "Scientific American", "url": "https://www.scientificamerican.com/feed/", "subcategory": "General Science"}
    ]
}

# API Routes
@api_router.get("/")
async def root():
    return {"message": "BitBrief RSS Reader API"}

# Feed management endpoints
@api_router.post("/feeds", response_model=RSSFeed)
async def create_feed(feed_data: RSSFeedCreate):
    """Add a new RSS feed"""
    
    # Validate URL format
    if not validate_rss_url(feed_data.url):
        raise HTTPException(status_code=400, detail="URL doesn't appear to be a valid RSS feed")
    
    # Test fetch the feed
    try:
        feed_content = await fetch_feed(feed_data.url)
        feed_title = feed_content.feed.get('title', feed_data.title)
        feed_description = feed_content.feed.get('description', feed_data.description)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to fetch RSS feed: {str(e)}")
    
    # Check if feed already exists
    existing_feed = await db.rss_feeds.find_one({"url": feed_data.url})
    if existing_feed:
        raise HTTPException(status_code=400, detail="RSS feed already exists")
    
    # Create feed object
    feed_dict = feed_data.dict()
    feed_dict['title'] = feed_title
    feed_dict['description'] = feed_description
    feed_obj = RSSFeed(**feed_dict)
    
    # Save to database
    await db.rss_feeds.insert_one(feed_obj.dict())
    
    return feed_obj

@api_router.get("/feeds", response_model=List[RSSFeed])
async def get_feeds(category: Optional[str] = None):
    """Get all RSS feeds, optionally filtered by category"""
    query = {"is_active": True}
    if category:
        query["category"] = category
    
    feeds = await db.rss_feeds.find(query).sort("created_at", -1).to_list(1000)
    return [RSSFeed(**feed) for feed in feeds]

@api_router.delete("/feeds/{feed_id}")
async def delete_feed(feed_id: str):
    """Delete an RSS feed"""
    result = await db.rss_feeds.delete_one({"id": feed_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    # Also delete related articles
    await db.articles.delete_many({"feed_id": feed_id})
    
    return {"message": "Feed deleted successfully"}

@api_router.post("/feeds/refresh/{feed_id}")
async def refresh_feed(feed_id: str):
    """Refresh articles from a specific RSS feed"""
    
    # Get feed details
    feed = await db.rss_feeds.find_one({"id": feed_id, "is_active": True})
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    
    try:
        # Fetch latest articles
        feed_content = await fetch_feed(feed['url'])
        
        articles_added = 0
        for entry in feed_content.entries[:10]:  # Limit to latest 10 articles
            
            # Parse published date
            published_date = datetime.now(timezone.utc)
            if hasattr(entry, 'published_parsed') and entry.published_parsed:
                try:
                    published_date = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                except:
                    pass
            
            # Check if article already exists
            existing_article = await db.articles.find_one({"link": entry.link})
            if existing_article:
                continue
            
            # Create article object
            article_data = {
                "feed_id": feed_id,
                "title": clean_html(entry.get('title', 'No Title')),
                "link": entry.get('link', ''),
                "description": clean_html(entry.get('summary', entry.get('description', ''))),
                "published": published_date,
                "author": entry.get('author', ''),
                "category": feed['category'],
                "subcategory": feed.get('subcategory', '')
            }
            
            article_obj = Article(**article_data)
            await db.articles.insert_one(article_obj.dict())
            articles_added += 1
        
        # Update feed last_updated timestamp
        await db.rss_feeds.update_one(
            {"id": feed_id},
            {"$set": {"last_updated": datetime.now(timezone.utc), "error_count": 0}}
        )
        
        return {"message": f"Added {articles_added} new articles", "articles_added": articles_added}
        
    except Exception as e:
        # Increment error count
        await db.rss_feeds.update_one(
            {"id": feed_id},
            {"$inc": {"error_count": 1}}
        )
        raise HTTPException(status_code=400, detail=f"Error refreshing feed: {str(e)}")

@api_router.post("/feeds/refresh-all")
async def refresh_all_feeds():
    """Refresh all active RSS feeds"""
    
    feeds = await db.rss_feeds.find({"is_active": True}).to_list(1000)
    results = []
    
    for feed in feeds:
        try:
            result = await refresh_feed(feed['id'])
            results.append({"feed_id": feed['id'], "title": feed['title'], "status": "success", "data": result})
        except Exception as e:
            results.append({"feed_id": feed['id'], "title": feed['title'], "status": "error", "error": str(e)})
    
    return {"results": results}

# Article endpoints
@api_router.get("/articles", response_model=List[Article])
async def get_articles(
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    limit: int = 50,
    skip: int = 0,
    search: Optional[str] = None
):
    """Get articles with optional filtering"""
    
    query = {}
    if category:
        query["category"] = category
    if subcategory:
        query["subcategory"] = subcategory
    if search:
        query["$or"] = [
            {"title": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
    
    articles = await db.articles.find(query).sort("published", -1).skip(skip).limit(limit).to_list(limit)
    return [Article(**article) for article in articles]

# Default feeds setup
@api_router.post("/feeds/setup-defaults")
async def setup_default_feeds():
    """Set up default RSS feeds for first launch"""
    
    added_feeds = []
    
    for category, feeds in DEFAULT_FEEDS.items():
        for feed_info in feeds:
            try:
                # Check if feed already exists
                existing = await db.rss_feeds.find_one({"url": feed_info["url"]})
                if existing:
                    continue
                
                # Create feed
                feed_data = RSSFeedCreate(
                    title=feed_info["title"],
                    url=feed_info["url"],
                    category=category,
                    subcategory=feed_info["subcategory"],
                    description=f"Default {category} feed"
                )
                
                # Test the feed first - skip if it fails
                try:
                    await fetch_feed(feed_info["url"])
                except:
                    continue
                
                feed_obj = RSSFeed(**feed_data.dict())
                await db.rss_feeds.insert_one(feed_obj.dict())
                added_feeds.append(feed_obj.title)
                
            except Exception as e:
                logger.error(f"Error adding default feed {feed_info['title']}: {str(e)}")
                continue
    
    return {"message": f"Added {len(added_feeds)} default feeds", "feeds": added_feeds}

# User interests
@api_router.post("/user/interests")
async def save_user_interests(categories: List[str], subcategories: List[str] = []):
    """Save user interests for notifications"""
    
    # For now, using default user ID
    user_id = "default"
    
    # Check if interests already exist
    existing = await db.user_interests.find_one({"user_id": user_id})
    
    interest_data = {
        "user_id": user_id,
        "categories": categories,
        "subcategories": subcategories
    }
    
    if existing:
        await db.user_interests.update_one(
            {"user_id": user_id},
            {"$set": interest_data}
        )
    else:
        interest_obj = UserInterest(**interest_data)
        await db.user_interests.insert_one(interest_obj.dict())
    
    return {"message": "User interests saved successfully"}

@api_router.get("/user/interests")
async def get_user_interests():
    """Get user interests"""
    
    interests = await db.user_interests.find_one({"user_id": "default"})
    if interests:
        return UserInterest(**interests)
    else:
        return UserInterest(categories=[], subcategories=[])

# Categories endpoint
@api_router.get("/categories")
async def get_categories():
    """Get all available categories and subcategories"""
    
    return {
        "categories": {
            "Technology": ["Startups", "Gadgets", "Software Dev", "AI", "Cybersecurity"],
            "Sports": ["Football", "Cricket", "F1", "E-Sports", "General Sports"],
            "News": ["World News", "Politics", "Business", "Local News", "Breaking News"],
            "Entertainment": ["Movies", "Music", "TV Shows", "Celebrity News", "Pop Culture"],
            "Science": ["Space", "Health", "Environment", "Psychology", "General Science"]
        }
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()