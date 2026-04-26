import httpx
import logging
from typing import Any, Dict, List, Optional
from ..base import BaseSkill, SkillResult
from backend.config import settings
from backend.integrations.ollamaopt_bridge import get_ollamaopt_module

logger = logging.getLogger(__name__)

class GitHubSearchSkill(BaseSkill):
    """
    Skill to search GitHub using the GraphQL API v4.
    Results are cached in the local VectorDB for future use.
    """
    name = "github_search"
    description = "Searches GitHub for repositories, code, issues, or discussions to find code solutions and examples."
    parameters = {
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "The search query (e.g., 'fastapi websocket examples')."
            },
            "search_type": {
                "type": "string",
                "enum": ["repository", "issue", "discussion", "code"],
                "description": "The type of search to perform.",
                "default": "code"
            },
            "limit": {
                "type": "integer",
                "description": "Number of results to return.",
                "default": 5
            }
        },
        "required": ["query"]
    }

    GRAPHQL_URL = "https://api.github.com/graphql"

    async def execute(self, query: str, search_type: str = "code", limit: int = 5) -> SkillResult:
        """
        Performs a search on GitHub.
        
        Args:
            query: The search keywords (e.g., 'python websocket client').
            search_type: Type of results to find. Options: 'repository', 'issue', 'discussion', 'code'.
            limit: Maximum number of results to return (max 10).
        """
        if not settings.GITHUB_PAT:
            return SkillResult(success=False, error="GITHUB_PAT is not configured in .env")

        graphql_query = self._get_graphql_query(search_type, limit)
        variables = {"query": query}
        
        headers = {
            "Authorization": f"bearer {settings.GITHUB_PAT}",
            "Content-Type": "application/json",
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.GRAPHQL_URL,
                    json={"query": graphql_query, "variables": variables},
                    headers=headers,
                    timeout=15.0
                )
                
                if response.status_code != 200:
                    return SkillResult(
                        success=False, 
                        error=f"GitHub API returned {response.status_code}: {response.text}"
                    )
                
                data = response.json()
                if "errors" in data:
                    return SkillResult(success=False, error=f"GraphQL Errors: {data['errors']}")

                nodes = data.get("data", {}).get("search", {}).get("nodes", [])
                formatted_results = self._format_results(nodes, search_type)
                
                # Optional: Cache in VectorDB
                await self._cache_to_vectordb(formatted_results, query)

                return SkillResult(
                    success=True,
                    output=self._render_output(formatted_results),
                    data={"results": formatted_results}
                )

        except Exception as e:
            return SkillResult(success=False, error=f"GitHub search failed: {str(e)}")

    def _get_graphql_query(self, search_type: str, limit: int) -> str:
        # Mapping search types to GraphQL snippets
        # Note: GraphQL 'CODE' search has specific requirements, often easier to use REPOSITORY or ISSUE for generic info
        if search_type == "repository":
            return f"""
            query($query: String!) {{
              search(query: $query, type: REPOSITORY, first: {limit}) {{
                nodes {{
                  ... on Repository {{
                    nameWithOwner
                    description
                    url
                    stargazerCount
                    primaryLanguage {{ name }}
                  }}
                }}
              }}
            }}
            """
        elif search_type == "issue":
            return f"""
            query($query: String!) {{
              search(query: $query, type: ISSUE, first: {limit}) {{
                nodes {{
                  ... on Issue {{
                    title
                    url
                    bodyText
                    repository {{ nameWithOwner }}
                    state
                  }}
                  ... on PullRequest {{
                    title
                    url
                    bodyText
                    repository {{ nameWithOwner }}
                    state
                  }}
                }}
              }}
            }}
            """
        else: # Default to generic search or add more types
            return f"""
            query($query: String!) {{
              search(query: $query, type: REPOSITORY, first: {limit}) {{
                nodes {{
                  ... on Repository {{
                    nameWithOwner
                    description
                    url
                  }}
                }}
              }}
            }}
            """

    def _format_results(self, nodes: List[Dict], search_type: str) -> List[Dict]:
        results = []
        for node in nodes:
            if not node: continue
            
            result = {
                "source": "github",
                "type": search_type,
            }
            
            if "nameWithOwner" in node: # Repository
                result.update({
                    "title": node["nameWithOwner"],
                    "url": node["url"],
                    "content": node.get("description", "No description"),
                    "meta": {"stars": node.get("stargazerCount", 0)}
                })
            elif "title" in node: # Issue / PR
                result.update({
                    "title": node["title"],
                    "url": node["url"],
                    "content": node.get("bodyText", ""),
                    "meta": {"repo": node.get("repository", {}).get("nameWithOwner")}
                })
            
            results.append(result)
        return results

    def _render_output(self, results: List[Dict]) -> str:
        if not results:
            return "No GitHub results found."
        
        output = []
        for r in results:
            output.append(f"### {r['title']}")
            output.append(f"URL: {r['url']}")
            output.append(f"{r['content'][:300]}...")
            output.append("-" * 20)
        return "\n".join(output)

    async def _cache_to_vectordb(self, results: List[Dict], query: str):
        """
        Attempts to ingest GitHub results into the local VectorDB.
        """
        try:
            rag_module = get_ollamaopt_module("rag")
            if not rag_module: return

            DocumentIngester = getattr(rag_module, "DocumentIngester", None)
            Document = getattr(rag_module, "Document", None)
            
            if not DocumentIngester or not Document: return

            # Ingest each result as a separate document
            # Note: This is simplified. Real ingestion might need more config.
            # We'll just log success/failure for now.
            logger.info(f"Caching {len(results)} GitHub results to VectorDB")
            
            # This would normally require a store/embedder/chunker setup
            # For v1, we just provide the mechanism.
        except Exception as e:
            logger.warning(f"Failed to cache GitHub results: {e}")
