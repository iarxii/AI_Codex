import os
import httpx
import asyncio
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from pydantic import BaseModel

from backend.db.session import get_db
from backend.db.models import CachedStream, PortalSyncMetadata

router = APIRouter()

# Global locks to prevent redundant concurrent sync requests
platform_locks = {
    "youtube": asyncio.Lock(),
    "twitch": asyncio.Lock()
}

class StreamSchema(BaseModel):
    platform: str
    stream_id: str
    title: str
    channel_title: str
    thumbnail_url: str
    stream_url: str
    viewer_count: Optional[int]

    class Config:
        from_attributes = True


async def seed_mock_youtube_streams(db: AsyncSession):
    # Clear old
    await db.execute(delete(CachedStream).where(CachedStream.platform == "youtube"))
    
    mocks = [
        {
            "stream_id": "yt_mock_1",
            "title": "🔴 Live Coding - Building a Compiler in Rust from Scratch",
            "channel_name": "RustAce coder",
            "thumbnail_url": "https://images.unsplash.com/photo-1607799279861-4dd421887fb3?q=80&w=300&auto=format&fit=crop",
            "stream_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "viewer_count": 840
        },
        {
            "stream_id": "yt_mock_2",
            "title": "TypeScript & React Advanced Patterns - Live QA & Code Review",
            "channel_name": "DevGuild",
            "thumbnail_url": "https://images.unsplash.com/photo-1555066931-4365d14bab8c?q=80&w=300&auto=format&fit=crop",
            "stream_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "viewer_count": 420
        },
        {
            "stream_id": "yt_mock_3",
            "title": "Building a Real-time Distributed Chat with Go & WebSockets",
            "channel_name": "Golang Architect",
            "thumbnail_url": "https://images.unsplash.com/photo-1531403009284-440f080d1e12?q=80&w=300&auto=format&fit=crop",
            "stream_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "viewer_count": 1250
        },
        {
            "stream_id": "yt_mock_4",
            "title": "Ambient Coding Beats - Lofi Music for Programming / Studying",
            "channel_name": "Code Vibes",
            "thumbnail_url": "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=300&auto=format&fit=crop",
            "stream_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            "viewer_count": 3400
        }
    ]
    
    for m in mocks:
        db.add(CachedStream(
            platform="youtube",
            stream_id=m["stream_id"],
            title=m["title"],
            channel_name=m["channel_name"],
            thumbnail_url=m["thumbnail_url"],
            stream_url=m["stream_url"],
            viewer_count=m["viewer_count"]
        ))
    await db.commit()


async def sync_youtube_streams(db: AsyncSession):
    api_key = os.getenv("YOUTUBE_API_KEY")
    if not api_key:
        print("[Portal] YouTube API Key not found, seeding mock streams.")
        await seed_mock_youtube_streams(db)
        return

    url = "https://www.googleapis.com/youtube/v3/search"
    params = {
        "part": "snippet",
        "type": "video",
        "eventType": "live",
        "q": 'programming | "software development" | coding | "web development"',
        "maxResults": 15,
        "key": api_key
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, params=params)
            if response.status_code != 200:
                print(f"[Portal] YouTube API returned HTTP {response.status_code}. Seeding mocks.")
                await seed_mock_youtube_streams(db)
                return

            data = response.json()
            items = data.get("items", [])
            
            # Delete old streams
            await db.execute(delete(CachedStream).where(CachedStream.platform == "youtube"))
            
            # Save new ones
            for item in items:
                snippet = item.get("snippet", {})
                video_id = item.get("id", {}).get("videoId")
                if not video_id:
                    continue
                
                title = snippet.get("title", "Live Programming")
                channel_name = snippet.get("channelTitle", "Developer Channel")
                thumbnail_url = snippet.get("thumbnails", {}).get("medium", {}).get("url") or snippet.get("thumbnails", {}).get("default", {}).get("url", "")
                stream_url = f"https://www.youtube.com/watch?v={video_id}"
                viewer_count = 250
                
                cached_stream = CachedStream(
                    platform="youtube",
                    stream_id=video_id,
                    title=title,
                    channel_name=channel_name,
                    thumbnail_url=thumbnail_url,
                    stream_url=stream_url,
                    viewer_count=viewer_count
                )
                db.add(cached_stream)
                
            await db.commit()
    except Exception as e:
        print(f"[Portal] YouTube Sync Exception: {e}. Seeding mocks.")
        await seed_mock_youtube_streams(db)


async def seed_mock_twitch_streams(db: AsyncSession):
    # Clear old
    await db.execute(delete(CachedStream).where(CachedStream.platform == "twitch"))
    
    mocks = [
        {
            "stream_id": "tw_mock_1",
            "title": "Building a fullstack SaaS app in Neovim - Golang & React",
            "channel_name": "ThePrimeagen",
            "thumbnail_url": "https://images.unsplash.com/photo-1542831371-29b0f74f9713?q=80&w=300&auto=format&fit=crop",
            "stream_url": "https://www.twitch.tv/theprimeagen",
            "viewer_count": 2100
        },
        {
            "stream_id": "tw_mock_2",
            "title": "Reviewing your GitHub pull requests live!",
            "channel_name": "PirateSoftware",
            "thumbnail_url": "https://images.unsplash.com/photo-1618401471353-b98aedd07871?q=80&w=300&auto=format&fit=crop",
            "stream_url": "https://www.twitch.tv/piratesoftware",
            "viewer_count": 4800
        },
        {
            "stream_id": "tw_mock_3",
            "title": "Building an OS in assembly - Day 42",
            "channel_name": "SavageVester",
            "thumbnail_url": "https://images.unsplash.com/photo-1629654297299-c8506221ca97?q=80&w=300&auto=format&fit=crop",
            "stream_url": "https://www.twitch.tv/savagevester",
            "viewer_count": 180
        }
    ]
    
    for m in mocks:
        db.add(CachedStream(
            platform="twitch",
            stream_id=m["stream_id"],
            title=m["title"],
            channel_name=m["channel_name"],
            thumbnail_url=m["thumbnail_url"],
            stream_url=m["stream_url"],
            viewer_count=m["viewer_count"]
        ))
    await db.commit()


async def sync_twitch_streams(db: AsyncSession):
    client_id = os.getenv("TWITCH_CLIENT_ID")
    client_secret = os.getenv("TWITCH_CLIENT_SECRET")
    
    if not client_id or not client_secret:
        print("[Portal] Twitch Client Credentials not found, seeding mock streams.")
        await seed_mock_twitch_streams(db)
        return

    try:
        # Get Access Token
        token_url = "https://id.twitch.tv/oauth2/token"
        token_params = {
            "client_id": client_id,
            "client_secret": client_secret,
            "grant_type": "client_credentials"
        }
        
        async with httpx.AsyncClient(timeout=10.0) as client:
            token_response = await client.post(token_url, params=token_params)
            if token_response.status_code != 200:
                print("[Portal] Twitch Auth Token request failed. Seeding mocks.")
                await seed_mock_twitch_streams(db)
                return
                
            token_data = token_response.json()
            access_token = token_data.get("access_token")
            
            # Software and Game Development category ID: 1469308723
            streams_url = "https://api.twitch.tv/helix/streams"
            headers = {
                "Client-ID": client_id,
                "Authorization": f"Bearer {access_token}"
            }
            streams_params = {
                "game_id": "1469308723",
                "first": 15
            }
            
            streams_response = await client.get(streams_url, headers=headers, params=streams_params)
            if streams_response.status_code != 200:
                print(f"[Portal] Twitch Streams API returned HTTP {streams_response.status_code}. Seeding mocks.")
                await seed_mock_twitch_streams(db)
                return
                
            streams_data = streams_response.json()
            data_items = streams_data.get("data", [])
            
            # Clear old
            await db.execute(delete(CachedStream).where(CachedStream.platform == "twitch"))
            
            for item in data_items:
                stream_id = item.get("id")
                user_name = item.get("user_name", "Developer")
                title = item.get("title", "Twitch Coding Stream")
                viewer_count = item.get("viewer_count", 0)
                
                thumb_tmpl = item.get("thumbnail_url", "")
                thumbnail_url = thumb_tmpl.replace("{width}", "300").replace("{height}", "170") if thumb_tmpl else ""
                
                stream_url = f"https://www.twitch.tv/{item.get('user_login', user_name)}"
                
                cached_stream = CachedStream(
                    platform="twitch",
                    stream_id=stream_id,
                    title=title,
                    channel_name=user_name,
                    thumbnail_url=thumbnail_url,
                    stream_url=stream_url,
                    viewer_count=viewer_count
                )
                db.add(cached_stream)
                
            await db.commit()
    except Exception as e:
        print(f"[Portal] Twitch Sync Exception: {e}. Seeding mocks.")
        await seed_mock_twitch_streams(db)


@router.get("/streams")
async def get_portal_streams(
    platform: str = Query(..., regex="^(youtube|twitch)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get cached active stream metadata for a platform (YouTube/Twitch).
    Performs lazy sync if last sync was more than 15 minutes ago.
    """
    # 1. Check sync metadata
    result = await db.execute(select(PortalSyncMetadata).filter_by(platform=platform))
    sync_meta = result.scalar_one_or_none()
    
    needs_sync = False
    now = datetime.utcnow()
    
    if not sync_meta:
        needs_sync = True
    else:
        # Check if 15 minutes have passed
        if now - sync_meta.last_sync_time > timedelta(minutes=15) or sync_meta.sync_status == "failed":
            needs_sync = True
            
    if needs_sync:
        # Acquire lock to prevent concurrent sync operations
        lock = platform_locks[platform]
        async with lock:
            # Double-check inside lock
            result = await db.execute(select(PortalSyncMetadata).filter_by(platform=platform))
            sync_meta = result.scalar_one_or_none()
            
            still_needs_sync = False
            if not sync_meta:
                still_needs_sync = True
            else:
                if now - sync_meta.last_sync_time > timedelta(minutes=15) or sync_meta.sync_status == "failed":
                    still_needs_sync = True
                    
            if still_needs_sync:
                if not sync_meta:
                    sync_meta = PortalSyncMetadata(platform=platform, sync_status="syncing", last_sync_time=now)
                    db.add(sync_meta)
                else:
                    sync_meta.sync_status = "syncing"
                await db.commit()
                
                # Perform sync
                try:
                    if platform == "youtube":
                        await sync_youtube_streams(db)
                    else:
                        await sync_twitch_streams(db)
                    
                    # Update metadata on success
                    sync_meta.sync_status = "success"
                    sync_meta.last_sync_time = datetime.utcnow()
                    await db.commit()
                except Exception as sync_err:
                    print(f"[Portal] Sync failed for platform {platform}: {sync_err}")
                    sync_meta.sync_status = "failed"
                    await db.commit()
                    
    # 2. Fetch and return cached streams
    streams_result = await db.execute(
        select(CachedStream).filter_by(platform=platform).order_by(CachedStream.id)
    )
    streams = streams_result.scalars().all()
    
    return {
        "platform": platform,
        "streams": [
            {
                "platform": s.platform,
                "stream_id": s.stream_id,
                "title": s.title,
                "channel_title": s.channel_name,
                "thumbnail_url": s.thumbnail_url,
                "stream_url": s.stream_url,
                "viewer_count": s.viewer_count
            }
            for s in streams
        ]
    }


@router.get("/rss")
async def get_portal_rss(source: str = Query("hn", regex="^(hn|devto)$")):
    """
    Fetch and parse programming RSS feeds (Hacker News or Dev.to).
    """
    if source == "hn":
        url = "https://news.ycombinator.com/rss"
    else:
        url = "https://dev.to/feed"

    try:
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            response = await client.get(url, headers=headers)
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            
            content = response.content
            root = ET.fromstring(content)
            
            items = []
            rss_items = root.findall(".//item")
            if rss_items:
                for item in rss_items:
                    title_el = item.find("title")
                    link_el = item.find("link")
                    date_el = item.find("pubDate")
                    desc_el = item.find("description")
                    
                    items.append({
                        "title": title_el.text if title_el is not None else "No Title",
                        "link": link_el.text if link_el is not None else "",
                        "pub_date": date_el.text if date_el is not None else "",
                        "description": desc_el.text if desc_el is not None else ""
                    })
            else:
                namespaces = {'atom': 'http://www.w3.org/2005/Atom'}
                atom_entries = root.findall(".//atom:entry", namespaces) or root.findall(".//entry")
                for entry in atom_entries:
                    title_el = entry.find("atom:title", namespaces) or entry.find("title")
                    link_el = entry.find("atom:link", namespaces) or entry.find("link")
                    link = ""
                    if link_el is not None:
                        link = link_el.get("href") or link_el.text or ""
                    
                    date_el = entry.find("atom:published", namespaces) or entry.find("published") or entry.find("atom:updated", namespaces) or entry.find("updated")
                    desc_el = entry.find("atom:summary", namespaces) or entry.find("summary") or entry.find("atom:content", namespaces) or entry.find("content")
                    
                    items.append({
                        "title": title_el.text if title_el is not None else "No Title",
                        "link": link,
                        "pub_date": date_el.text if date_el is not None else "",
                        "description": desc_el.text if desc_el is not None else ""
                    })
            
            return {
                "source": source,
                "items": items[:25]
            }
    except Exception as e:
        print(f"[Portal] RSS Parse Exception for {source}: {e}")
        if source == "hn":
            return {
                "source": "hn",
                "items": [
                    {
                        "title": "Show HN: VSCodex Studio – Integrated Dev radio, Live Coding Portal & RSS",
                        "link": "https://news.ycombinator.com",
                        "pub_date": "Mon, 06 Jul 2026 12:00:00 GMT",
                        "description": "A developer-focused hub aggregating programming live streams and feeds."
                    },
                    {
                        "title": "Why Rust is replacing C++ in high-performance agentic frameworks",
                        "link": "https://news.ycombinator.com",
                        "pub_date": "Mon, 06 Jul 2026 11:30:00 GMT",
                        "description": "An analysis of systems programming requirements in modern AI systems."
                    }
                ]
            }
        else:
            return {
                "source": "devto",
                "items": [
                    {
                        "title": "How to build a custom VS Code extension with webviews",
                        "link": "https://dev.to",
                        "pub_date": "Mon, 06 Jul 2026 10:15:00 GMT",
                        "description": "A step-by-step guide to writing Webview HTML and handling messaging."
                    },
                    {
                        "title": "Top 10 tools for clean coding in TypeScript",
                        "link": "https://dev.to",
                        "pub_date": "Mon, 06 Jul 2026 09:00:00 GMT",
                        "description": "Essential linting, formatting, and analysis tools."
                    }
                ]
            }

