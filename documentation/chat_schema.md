---
title: GP HealthMedAgentix Chat History Schema
---

erDiagram
    Conversation {
        INTEGER id PK "Primary key"
        TEXT title "Conversation title or subject"
        DATETIME created_at "Conversation start time"
    }
    Message {
        INTEGER id PK "Primary key"
        INTEGER conversation_id FK "References Conversation(id)"
        TEXT sender "'user' or 'bot' or agent name"
        TEXT provider "'openai', 'gemini', etc."
        TEXT content "Message text/content"
        DATETIME timestamp "Message time"
    }

    Conversation ||--o{ Message : contains
