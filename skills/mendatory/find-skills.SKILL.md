---
name: find-skills
kind: mandatory
description: Finds relevant installable skills when a user explicitly requests a reusable capability.
platforms: [all]
requires_capabilities: []
excludes_platforms: []
triggers: []
priority: 50
---

## Use Case: Finding Relevant Skills

**Trigger**:
- The user explicitly asks for a skill recommendation.
- The user wants to find a skill for a specific task, tool, or domain (e.g., "find a skill for writing tests with Jest", "look for skills for TypeScript").
- The agent needs to discover and surface relevant skills available on skills.sh for the user's context.

## Behavior

The `find-skills` skill should implement the following logic:

### 1. Skill Discovery

```typescript
async findSkills(query: string): Promise<SkillRecommendation[]> {
  // 1. Query the skills.sh API or local skill registry
  const candidates = await SkillsRegistry.search(query);
  
  // 2. Filter and rank candidates based on relevance and quality signals
  const relevantSkills = candidates
    .filter(skill => this.isRelevant(skill, query))
    .sort((a, b) => this.calculateScore(b, a))
    .slice(0, 5); // Return top 5 recommendations
  
  // 3. Package each skill for local workspace installation
  const packagedSkills = relevantSkills.map(skill => {
    const skillPath = this.packageSkill(skill);
    
    return {
      id: skill.id,
      name: skill.name,
      description: skill.description,
      score: skill.score,
      confidence: skill.confidence,
      path: skillPath,
      installable: true
    };
  });
  
  return packagedSkills;
}
```

### 2. Skill Relevance Logic

```typescript
isRelevant(skill: Skill, query: string): boolean {
  const queryTerms = query.toLowerCase().split(' ');
  const skillText = (
    skill.name + ' ' + 
    skill.description + ' ' + 
    skill.tags.join(' ') + ' ' + 
    skill.author
  ).toLowerCase();
  
  // Match at least 50% of query terms in skill metadata
  const matches = queryTerms.filter(term => skillText.includes(term));
  return matches.length >= queryTerms.length / 2;
}
```

### 3. Skill Scoring and Ranking

```typescript
calculateScore(skillA: Skill, skillB: Skill): number {
  // Priority: Install count > Reviews > Freshness
  if (skillA.installCount !== skillB.installCount) {
    return skillA.installCount - skillB.installCount;
  }
  if (skillA.reviewScore !== skillB.reviewScore) {
    return skillA.reviewScore - skillB.reviewScore;
  }
  return new Date(skillA.updatedAt).getTime() - new Date(skillB.updatedAt).getTime();
}
```

### 4. Packaging for Local Workspace

```typescript
packageSkill(skill: Skill): string {
  const skillDir = path.join(process.cwd(), 'skills', skill.name);
  
  // Create directory structure if it doesn't exist
  if (!fs.existsSync(skillDir)) {
    fs.mkdirSync(skillDir, { recursive: true });
  }
  
  // Copy/generate the skill package files
  const skillContent = {
    "name": skill.name,
    "version": "1.0.0",
    "description": skill.description,
    "author": skill.author,
    "skills": skill.skills
  };
  
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), this.generateSkillMarkdown(skill));
  fs.writeFileSync(path.join(skillDir, 'package.json'), JSON.stringify(skillContent, null, 2));
  
  // Copy any source files or assets
  if (skill.files) {
    skill.files.forEach(file => {
      const sourcePath = path.join(skill.sourceDir, file.path);
      const destPath = path.join(skillDir, file.path);
      
      if (fs.existsSync(sourcePath)) {
        fs.copyFileSync(sourcePath, destPath);
      }
    });
  }
  
  return skillDir;
}
```

## Example Interaction

### User Input
```
Find a skill for writing unit tests with Jest.
```

### Agent Process
1. Call `findSkills('Jest unit tests')`
2. Search skills.sh for 'Jest' and 'unit tests'
3. Identify `jest-test-generator` (high install count)
4. Identify `testing-with-jest` (good reviews)
5. Package both skills locally

### Agent Output
```
I found 2 skills from skills.sh that can help with writing Jest unit tests:

1. **jest-test-generator**
   - Description: Generate Jest test files with various testing patterns.
   - Install Count: 12,450
   - Reviews: ⭐⭐⭐⭐⭐ (4.8)
   - Source: [https://skills.sh/jest-test-generator](https://skills.sh/jest-test-generator)
   - Location: ./skills/jest-test-generator

2. **testing-with-jest**
   - Description: Comprehensive guide and tools for testing with Jest in TypeScript projects.
   - Install Count: 8,760
   - Reviews: ⭐⭐⭐⭐ (4.6)
   - Source: [https://skills.sh/testing-with-jest](https://skills.sh/testing-with-jest)
   - Location: ./skills/testing-with-jest

You can install these skills by running:
  pnpm mcp install ./skills/jest-test-generator
  pnpm mcp install ./skills/testing-with-jest
```

## Parameters

### Required Parameters

- `query` (string): The search query describing the desired skill functionality.
  - Example: "Jest unit tests", "React component testing", "Git commit messages"

### Optional Parameters

- `category` (string): Filter by category if supported by the registry.
  - Example: "testing", "git", "react", "javascript"

- `limit` (integer): Maximum number of recommendations to return (default: 5).
  - Example: 3

- `sortBy` (string): Sorting criteria.
  - Options: "popularity", "rating", "newest"
  - Example: "popularity"

## Return Format

```typescript
interface SkillRecommendation {
  id: string;
  name: string;
  description: string;
  source: string;
  score: number;
  confidence: number;
  path: string;  // Local path to the packaged skill
  installable: boolean;
}
```

## Configuration

```typescript
{
  "skillsDir": "./skills",
  "maxRecommendations": 5,
  "includeExperimental": false
}
```

## Error Handling

```typescript
{
  "error": "No skills found matching your query",
  "suggestions": [
    "Try broadening your search query",
    "Check skills.sh directly for more options"
  ]
}
```

## Security & Trust

- Verify skill package integrity before installation
- Prefer official or verified sources from skills.sh
- Display install counts and review scores to help users make informed decisions
- Provide clear source attribution for all recommendations

## Versioning

- Current version: 1.0.0
- Last updated: 2026-07-13
-