import httpx
import logging
from typing import Any, Dict, List, Optional
from ..base import BaseSkill, SkillResult
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

class URLReaderSkill(BaseSkill):
    """
    Skill to fetch and read the content of a public URL.
    Useful for research and documentation gathering.
    """
    name = "read_url"
    description = (
        "Fetches the content of a public URL and returns a text summary. "
        "Use this to research documentation or specific website content."
    )
    parameters = {
        "type": "object",
        "properties": {
            "url": {
                "type": "string",
                "description": "The absolute URL to fetch (e.g., 'https://docs.python.org')."
            },
            "summarize": {
                "type": "boolean",
                "description": "Whether to return a summarized version of the content.",
                "default": True
            }
        },
        "required": ["url"]
    }

    async def execute(self, url: str, summarize: bool = True) -> SkillResult:
        logger.info(f"Fetching URL: {url}")
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }

        try:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                response = await client.get(url, headers=headers, timeout=20.0)
                
                if response.status_code != 200:
                    return SkillResult(
                        success=False, 
                        error=f"Failed to fetch URL. HTTP {response.status_code}: {response.reason_phrase}"
                    )

                # Parse HTML
                soup = BeautifulSoup(response.text, "html.parser")
                
                # Remove script and style elements
                for script_or_style in soup(["script", "style", "nav", "footer", "header"]):
                    script_or_style.decompose()

                # Get text
                text = soup.get_text(separator="\n")
                
                # Basic cleaning
                lines = (line.strip() for line in text.splitlines())
                chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
                text = "\n".join(chunk for chunk in chunks if chunk)

                if summarize and len(text) > 2000:
                    text = text[:2000] + "\n... (Content truncated for summary) ..."

                return SkillResult(
                    success=True,
                    output=f"Successfully read content from {url}:\n\n{text}",
                    data={"url": url, "full_text_length": len(text)}
                )

        except Exception as e:
            logger.error(f"URL fetch failed: {e}")
            return SkillResult(success=False, error=f"Failed to read URL: {str(e)}")
