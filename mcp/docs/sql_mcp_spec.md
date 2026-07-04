# SQL Schema & Query Assistant (sql-mcp)

## Overview
The `sql-mcp` server provides the Spirit Bird Platform with the ability to understand and interact with local database schemas. This eliminates the "hallucination" of column names and provides a grounding layer for SQL generation.

## Core Features
1. **Schema Discovery**: Tools to list tables, describe specific tables, and fetch foreign key relationships.
2. **Query Templating**: Generates common query patterns (JOINs, Aggregations) based on discovered schema.
3. **Syntax Validation**: Interfaces with a local SQL parser to verify query validity before the user runs it.
4. **Contextual Mapping**: Maps natural language entity requests to actual database table/column names.

## Technical Implementation
- **Connectivity**: Supports multiple dialects via a pluggable adapter pattern (starting with SQLite for local dev).
- **Schema Cache**: Maintains a local representation of the schema to reduce repeated DB hits.
- **Gemma 4 Integration**: Feeds the `DESCRIBE table` output directly into the model context to ground the SQL generation.

## MTP Benefit
By providing the exact table and column names in the prompt context, Gemma 4's MTP can speculatively decode the `SELECT` and `JOIN` clauses with extremely high accuracy, as the "vocabulary" of the query is strictly limited to the provided schema.
