# Codex Spaces Access Rulesets

This document outlines the official architectural rules governing access to Codex Spaces within the AI Codex platform. It serves as the authoritative source of truth for all access-control implementations across the frontend and backend.

## Architectural Context
All spaces on the AI Codex platform utilize the high-performance GPU Backend (Colab). Therefore, the legacy distinction between "Premium" (GPU) and "Non-Premium" (Standard Compute) spaces is deprecated. Instead, spaces are categorized as **Standard** or **Exclusive**.

## Official Ruleset

### 1. Universal Catalog Visibility
All users (Standard, Admin, and Super Admin) are permitted to **view and access the premium spaces catalog**. The backend API will return the complete list of active spaces to all authenticated users, allowing them to browse the capabilities of the platform.

### 2. Standard Access Constraints
Standard users are granted full operational access to the following base environments:
- **General Default Workspace (Codex Space)**
- **SpiritChat (SpiritBook Space)**

**Limitation**: Within these spaces, standard users have full access to Bring-Your-Own-Key (BYOK) providers (e.g., Groq, OpenRouter, Gemini). However, if they select the native **Local LLM (Colab)** provider, they are restricted to a single default model (e.g., Llama 3.5). Advanced models and model switching on the native provider are locked and require an administrative account or specialized premium access.

### 3. Exclusive Spaces & Donation Gate
All specialized, domain-specific Codex Spaces are classified as **Exclusive Spaces**. These include, but are not limited to:
- FinTrader Analytics Lab
- Gemma Code Lab
- HealthTech Soft Lab
- ArtGen Design Lab

**Enforcement**: 
- Standard users attempting to access an Exclusive Space will encounter a **Donation Gate**. 
- The frontend will render a Call-to-Action (CTA) button (e.g., "One-Time Donation of $5 to unlock") instead of the standard entry button. 
- The backend API will actively reject conversation creation attempts for Exclusive Spaces from standard users with a `403 Forbidden` response.

### 4. Administrative Override
The platform's singular super-user, designated by the role `nexus-architect` (or generic `super_admin`), possesses unrestricted, platform-wide access. This role bypasses all Donation Gates and Provider Model restrictions across both Standard and Exclusive Spaces.

---
*Maintained by the AICodex System Architect.*
